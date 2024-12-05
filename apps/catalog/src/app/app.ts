import * as path from 'path';
import { FastifyInstance } from 'fastify';
import AutoLoad from '@fastify/autoload';
import search from '@ecomm/Search';
import queues from '@ecomm/Queues';
import {
  ClassificationCategoryRepository,
  getClassificationCategoryCollection,
} from './repositories/classificationCategory.repo';
import {
  getProductCategoryCollection,
  ProductCategoryRepository,
} from './repositories/productCategory.repo';
import {
  ProductRepository,
  getProductCollection,
} from './repositories/product.repo';
import { getPriceCollection, PriceRepository } from './repositories/price.repo';
import {
  CatalogRepository,
  getCatalogCollection,
} from './repositories/catalog.repo';
import {
  CatalogSyncRepository,
  getCatalogSyncCollection,
} from './repositories/catalogSync.repo';
import {
  AuditLogRepository,
  getAuditLogCollection,
  auditLogListener,
} from '@ecomm/AuditLog';
import { productsIndexerListener } from './services/listeners/productsIndexer.lstnr';
import { pricesIndexerListener } from './services/listeners/pricesIndexer.lstnr';
import { updateChildAncestorsForIdListener } from './services/listeners/updateChildAncestorsForId.lstnr';

/* eslint-disable-next-line */
export interface AppOptions {}

export async function app(server: FastifyInstance, opts: AppOptions) {
  // Register plugins
  await server.register(search);
  await server.register(queues);

  // Print Routes
  if (server.config.PRINT_ROUTES === true) {
    const importDynamic = new Function(
      'modulePath',
      'return import(modulePath)',
    );
    const fastifyPrintRoutes = await importDynamic('fastify-print-routes');
    await server.register(fastifyPrintRoutes);
  }

  // Register Collections
  server.db.col.classificationCategory = getClassificationCategoryCollection(
    server.mongo.db!,
  );
  server.db.col.productCategory = getProductCategoryCollection(
    server.mongo.db!,
  );
  server.db.col.product = await getProductCollection(server.mongo.db!);

  server.db.col.price = await getPriceCollection(server.mongo.db!);
  server.db.col.catalog = getCatalogCollection(server.mongo.db!);
  server.db.col.catalogSync = getCatalogSyncCollection(server.mongo.db!);
  server.db.col.auditLog = getAuditLogCollection(server.mongo.db!);

  // Register Repositories
  server.db.repo.classificationCategoryRepository =
    new ClassificationCategoryRepository(server);
  server.db.repo.productCategoryRepository = new ProductCategoryRepository(
    server,
  );
  server.db.repo.productRepository = new ProductRepository(server);
  server.db.repo.priceRepository = new PriceRepository(server);
  server.db.repo.catalogRepository = new CatalogRepository(server);
  server.db.repo.catalogSyncRepository = new CatalogSyncRepository(server);
  server.db.repo.auditLogRepository = new AuditLogRepository(server);

  // Indexes
  const indexes: Promise<any>[] = [];
  indexes.push(
    server.db.col.classificationCategory.createIndex(
      { projectId: 1, key: 1 },
      { name: 'CC_Key' },
    ),
  ); // unique: true
  indexes.push(
    server.db.col.productCategory.createIndex(
      { projectId: 1, 'attributes.name': 1 },
      { name: 'CCA_Key' },
    ),
  );
  indexes.push(
    server.db.col.auditLog.createIndex(
      { projectId: 1, catalogId: 1, entity: 1, entityId: 1 },
      { name: 'CCA_Key' },
    ),
  );
  Object.keys(server.db.col.product).forEach((key) => {
    indexes.push(
      server.db.col.product[key].createIndex({ parent: 1 }, { name: 'parent' }),
    );
    indexes.push(
      server.db.col.product[key].createIndex({ sku: 1 }, { name: 'sku' }),
    );
  });
  Object.keys(server.db.col.price).forEach((key) => {
    indexes.push(
      server.db.col.price[key].createIndex({ sku: 1 }, { name: 'sku' }),
    );
  });
  await Promise.all(indexes);

  // Load Listeners
  auditLogListener(server);
  productsIndexerListener(server);
  pricesIndexerListener(server);
  updateChildAncestorsForIdListener(server);

  // // Register plugins
  // server.register(AutoLoad, {
  //   dir: path.join(__dirname, 'plugins'),
  //   options: { ...opts },
  // });

  // Register Routes
  server.register(AutoLoad, {
    dir: path.join(__dirname, 'routes'),
    options: { ...opts },
  });
}
