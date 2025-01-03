import * as path from 'path';
import { type FastifyInstance } from 'fastify';
import AutoLoad from '@fastify/autoload';
import search from '@ecomm/search';
import queues from '@ecomm/queues';
import eventStore from '@ecomm/event-store';
import mongo from '@ecomm/mongo';
import { Umzug, MongoDBStorage } from 'umzug';
import {
  ClassificationCategoryRepository,
  getClassificationCategoryCollection
} from './classificationCategory/classificationCategory.repo.ts';
// import {
//   getProductCategoryCollection,
//   ProductCategoryRepository,
// } from './productCategory/productCategory.repo.ts';
import { getPriceCollection, PriceRepository } from './price/price.repo.ts';
import { CatalogRepository, getCatalogCollection } from './catalog/catalog.repo.ts';
import { CatalogSyncRepository, getCatalogSyncCollection } from './catalogSync/catalogSync.repo.ts';
import { AuditLogRepository, getAuditLogCollection, auditLogListener } from '@ecomm/audit-log';
import { productsIndexerListener } from './product/productsIndexer.lstnr.ts';
import { pricesIndexerListener } from './price/pricesIndexer.lstnr.ts';
import { updateChildAncestorsForIdListener } from './lib/updateChildAncestorsForId.lstnr.ts';
import { type CollectionCreateSchema } from 'typesense/lib/Typesense/Collections.js';
import { projectorListener } from './product/product.projector.ts';

/* eslint-disable-next-line */
export interface AppOptions {}

export async function app(server: FastifyInstance, opts: AppOptions) {
  // Register plugins
  await server.register(search);
  await server.register(queues);
  await server.register(mongo);
  await server.register(eventStore);

  // Load Listeners
  auditLogListener(server);
  productsIndexerListener(server);
  pricesIndexerListener(server);
  updateChildAncestorsForIdListener(server);
  projectorListener(server);

  // Migrations
  const migGlob = `**/migrations/${server.config.NODE_ENV}/mig_${server.config.APP_NAME}*.ts`;
  const migrator = new Umzug({
    migrations: {
      glob: migGlob
    },
    storage: new MongoDBStorage({
      collection: server.mongo.db!.collection('migrations')
    }),
    logger: server.log,
    context: {
      server
    }
  });
  //await migrator.down({});
  await migrator.up({});

  // Register Collections
  // server.db.col.classificationCategory = getClassificationCategoryCollection(server.mongo.db!);
  // server.db.col.productCategory = getProductCategoryCollection(
  //   server.mongo.db!,
  // );
  server.db.col.price = await getPriceCollection(server.mongo.db!);
  server.db.col.catalog = getCatalogCollection(server.mongo.db!);
  server.db.col.catalogSync = getCatalogSyncCollection(server.mongo.db!);
  server.db.col.auditLog = getAuditLogCollection(server.mongo.db!);

  // Register Repositories
  server.db.repo.auditLogRepository = new AuditLogRepository(server);
  server.db.repo.catalogRepository = new CatalogRepository(server);
  server.db.repo.catalogSyncRepository = new CatalogSyncRepository(server);
  // server.db.repo.classificationCategoryRepository = new ClassificationCategoryRepository(server);
  // server.db.repo.productCategoryRepository = new ProductCategoryRepository(
  //   server,
  // );
  // server.db.repo.productRepository = new ProductRepository(server);
  server.db.repo.priceRepository = new PriceRepository(server);

  // Indexes
  // FIXME Move to migrations
  const indexes: Promise<any>[] = [];
  //indexes.push(server.db.col.classificationCategory.createIndex({ projectId: 1, key: 1 }, { name: 'CC_Key' })); // unique: true
  // indexes.push(
  //   server.db.col.productCategory.createIndex(
  //     { projectId: 1, 'attributes.name': 1 },
  //     { name: 'CCA_Key' },
  //   ),
  // );
  indexes.push(
    server.db.col.auditLog.createIndex({ projectId: 1, catalogId: 1, entity: 1, entityId: 1 }, { name: 'CCA_Key' })
  );
  // Object.keys(server.db.col.product).forEach((key) => {
  //   indexes.push(
  //     server.db.col.product[key].createIndex({ parent: 1 }, { name: 'parent' }),
  //   );
  //   indexes.push(
  //     server.db.col.product[key].createIndex({ sku: 1 }, { name: 'sku' }),
  //   );
  // });
  Object.keys(server.db.col.price).forEach((key) => {
    indexes.push(server.db.col.price[key].createIndex({ sku: 1 }, { name: 'sku' }));
  });
  await Promise.all(indexes);

  // Load Indexer Schemas
  if (server.index) {
    const productsSchema: CollectionCreateSchema = {
      name: 'products',
      fields: [
        { name: 'sku', type: 'string' },
        { name: 'catalogId', type: 'string' },
        { name: 'name', type: 'string' },
        { name: 'description', type: 'string', optional: true },
        {
          name: 'searchKeywords',
          type: 'string[]',
          optional: true,
          facet: true
        },
        { name: 'attributes', type: 'object', optional: true, facet: true },
        { name: 'categories', type: 'string[]', optional: true, facet: true },
        { name: 'prices', type: 'object', optional: true, facet: true },
        // Compatibility
        {
          name: 'brand',
          type: 'string',
          facet: true
        },
        {
          name: 'categories.lvl0',
          type: 'string[]',
          facet: true
        },
        {
          name: 'categories.lvl1',
          type: 'string[]',
          facet: true,
          optional: true
        },
        {
          name: 'categories.lvl2',
          type: 'string[]',
          facet: true,
          optional: true
        },
        {
          name: 'categories.lvl3',
          type: 'string[]',
          facet: true,
          optional: true
        },
        {
          name: 'price',
          type: 'float',
          facet: true,
          optional: true
        },
        {
          name: 'popularity',
          type: 'int32',
          facet: false
        },
        {
          name: 'free_shipping',
          type: 'bool',
          facet: true
        },
        {
          name: 'rating',
          type: 'int32',
          facet: true
        },
        {
          name: 'vectors',
          type: 'float[]',
          num_dim: 384,
          optional: true
        }
      ],
      enable_nested_fields: true
    };
    if (process.env.DROP_PRODUCT_INDEX === 'YES')
      await server.index
        .collections('products')
        .delete()
        .catch(function () {
          return;
        });

    await server.index
      .collections('products')
      .retrieve()
      .then(function () {
        return;
      })
      .catch(function (error) {
        server.log.info('Creating search collection [products]', error);
        return server.index!.collections().create(productsSchema);
      });
  }

  // // Register plugins
  // server.register(AutoLoad, {
  //   dir: path.join(__dirname, 'plugins'),
  //   options: { ...opts },
  // });

  // Register Routes
  server.register(AutoLoad, {
    dir: path.join(import.meta.dirname, 'routes'),
    options: { prefix: ':projectId', ...opts }
  });
}
