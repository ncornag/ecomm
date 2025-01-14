import { type Result, Ok, Err } from 'ts-results-es';
import { AppError, ErrorCode } from '@ecomm/app-error';
import { Value } from '@sinclair/typebox/value';
import { nanoid } from 'nanoid';
import { type CatalogSync, UpdateCatalogSyncAction } from './catalogSync.ts';
import { type SyncCatalogBody, type CreateCatalogSyncBody } from './catalogSync.schemas.ts';
import { type CatalogSyncDAO } from './catalogSync.dao.schema.ts';
import { ChangeNameActionHandler } from '../lib/actions/changeName.handler.ts';
import { ChangeDescriptionActionHandler } from '../lib/actions/changeDescription.handler.ts';
import { type ICatalogSyncRepository } from './catalogSync.repo.ts';
import { ActionsRunner, type ActionHandlersList } from '@ecomm/actions-runner';
import patch from 'mongo-update';
import { type Queues } from '@ecomm/queues';

// SERVICE INTERFACE
export interface ICatalogSyncService {
  createCatalogSync: (payload: CreateCatalogSyncBody) => Promise<Result<CatalogSync, AppError>>;
  updateCatalogSync: (id: string, version: number, actions: any) => Promise<Result<CatalogSync, AppError>>;
  findCatalogSyncById: (id: string) => Promise<Result<CatalogSync, AppError>>;
  saveCatalogSync: (category: CatalogSync) => Promise<Result<CatalogSync, AppError>>;
  syncCatalogs: (payload: SyncCatalogBody) => Promise<Result<boolean, AppError>>;
}

const toEntity = ({ _id, ...remainder }: CatalogSyncDAO): CatalogSync => ({
  id: _id,
  ...remainder
});

const mongoPatch = function (patch: any) {
  const query: any = {};
  const set: any = {};

  if ('object' === typeof patch) {
    for (const key in patch) {
      const entry = patch[key];

      if (entry['@op'] == 'SwapValue') {
        query[key] = entry['@before'];
        set[key] = entry['@after'];
      } else if (key === '_id') {
        query[key] = entry;
      } else {
        const [sub_query, sub_set] = mongoPatch(entry);
        query[key] = sub_query;
        if (!sub_set === null) {
          set[key] = sub_set;
        }
      }
    }
    return [query, set];
  } else {
    return [patch, null];
  }
};

// SERVICE IMPLEMENTATION
export class CatalogSyncService implements ICatalogSyncService {
  private ENTITY = 'catalogSync';
  private static instance: ICatalogSyncService;
  private repo: ICatalogSyncRepository;
  private cols;
  private actionHandlers: ActionHandlersList;
  private actionsRunner: ActionsRunner<CatalogSyncDAO, ICatalogSyncRepository>;
  private queues: Queues;
  private log;
  private batchSize = 1000;

  private constructor(server: any) {
    this.repo = server.db.repo.catalogSyncRepository as ICatalogSyncRepository;
    this.cols = server.db.col.product;
    this.actionHandlers = {
      changeName: new ChangeNameActionHandler(server),
      changeDescription: new ChangeDescriptionActionHandler(server)
    };
    this.actionsRunner = new ActionsRunner<CatalogSyncDAO, ICatalogSyncRepository>();
    this.queues = server.queues;
    this.log = server.log;
  }

  public static getInstance(server: any): ICatalogSyncService {
    if (!CatalogSyncService.instance) {
      CatalogSyncService.instance = new CatalogSyncService(server);
    }
    return CatalogSyncService.instance;
  }

  // CREATE CATALOGSYNC
  public async createCatalogSync(payload: CreateCatalogSyncBody): Promise<Result<CatalogSync, AppError>> {
    // Save the entity
    const result = await this.repo.create({
      id: nanoid(),
      ...payload
    });
    if (result.isErr()) return result;
    return new Ok(toEntity(result.value));
  }

  // UPDATE CATALOGSYNC
  public async updateCatalogSync(
    id: string,
    version: number,
    actions: UpdateCatalogSyncAction[]
  ): Promise<Result<CatalogSync, AppError>> {
    // Find the Entity
    const result = await this.repo.findOne(id, version);
    if (result.isErr()) return result;
    const entity: CatalogSyncDAO = result.value;
    const toUpdateEntity = Value.Clone(entity);
    // Execute actions
    const actionRunnerResults = await this.actionsRunner.run(
      entity,
      toUpdateEntity,
      this.repo,
      this.actionHandlers,
      actions
    );
    if (actionRunnerResults.isErr()) return actionRunnerResults;
    // Compute difference, and save if needed
    const difference = Value.Diff(entity, toUpdateEntity);
    if (difference.length > 0) {
      // Save the entity
      const saveResult = await this.repo.updateOne(id, version, actionRunnerResults.value.update);
      if (saveResult.isErr()) return saveResult;
      toUpdateEntity.version = version + 1;
      // Send side effects via messagging
      actionRunnerResults.value.sideEffects?.forEach((sideEffect: any) => {
        this.queues.publish(sideEffect.action, {
          ...sideEffect.data,
          metadata: {
            type: sideEffect.action,
            entity: this.ENTITY
          }
        });
      });
    }
    // Return udated entity
    return Ok(toEntity(toUpdateEntity));
  }

  // FIND CATALOGSYNC
  public async findCatalogSyncById(id: string): Promise<Result<CatalogSync, AppError>> {
    const result = await this.repo.findOne(id);
    if (result.isErr()) return result;
    return new Ok(toEntity(result.value));
  }

  // SAVE CATALOGSYNC
  public async saveCatalogSync(category: CatalogSync): Promise<Result<CatalogSync, AppError>> {
    const result = await this.repo.save(category);
    if (result.isErr()) return result;
    return new Ok(toEntity(result.value));
  }

  // SYNC CATALOGSYNC
  public async syncCatalogs(payload: SyncCatalogBody): Promise<Result<boolean, AppError>> {
    // Find the Sync
    const catalogSyncResult = await this.repo.findOne(payload.id);
    if (catalogSyncResult.isErr()) return catalogSyncResult;
    // Sync configuration
    const createNewItems = catalogSyncResult.value.createNewItems;
    const removeNonExistent = catalogSyncResult.value.removeNonExistent;
    // Hold the source and target catalogs
    const sourceCatalog = catalogSyncResult.value.sourceCatalog;
    const targetCatalog = catalogSyncResult.value.targetCatalog;
    const sourceCol = this.cols[sourceCatalog];
    const targetCol = this.cols[targetCatalog];
    // Loop the source catalog products and sync them to the target catalog
    this.log.info(
      `Syncing catalog [${sourceCatalog}] to catalog [${targetCatalog}], start`,
      catalogSyncResult.value.lastSync
    );
    const productsToUpdate = await sourceCol.find({
      $or: [
        { createdAt: { $gte: catalogSyncResult.value.lastSync } },
        { lastModifiedAt: { $gte: catalogSyncResult.value.lastSync } }
      ]
    });
    let count = 0;
    let start = new Date().getTime();
    let updates = [];
    for await (const product of productsToUpdate) {
      const productId = product._id;
      const targetProductResult = await targetCol.find({ _id: productId }).toArray();
      if (targetProductResult.length === 1) {
        // Product exists, update
        const update = patch(targetProductResult[0], product, {
          version: 0,
          createdAt: 0,
          lastModifiedAt: 0,
          catalogId: 0
        });
        if (update.$set) {
          const u = {
            updateOne: {
              filter: {
                _id: productId,
                version: targetProductResult[0].version
              },
              update: update
            }
          };
          updates.push(u as never);
          count = count + 1;
        }
      } else if (targetProductResult.length === 0 && createNewItems === true) {
        // Product desn't exist, insert if configured to do so in the sync
        product.catalog = targetCatalog;
        delete product.version;
        delete product.createdAt;
        delete product.lastModifiedAt;
        const u = {
          insertOne: {
            document: product
          }
        };
        updates.push(u as never);
        count = count + 1;
      }
      if (count % this.batchSize === 0 && count > 0) {
        const result = await targetCol.bulkWrite(updates);
        const end = new Date().getTime();
        this.log.info(
          `Syncing catalog [${sourceCatalog}] to catalog [${targetCatalog}], updated ${count} products at ${(
            (this.batchSize * 1000) /
            (end - start)
          ).toFixed()} products/second`
        );
        start = new Date().getTime();
        updates = [];
      }
    }
    if (updates.length > 0) {
      const result = await targetCol.bulkWrite(updates);
      const end = new Date().getTime();
      this.log.info(
        `Syncing catalog [${sourceCatalog}] to catalog [${targetCatalog}], updated ${count} products at ${(
          (this.batchSize * 1000) /
          (end - start)
        ).toFixed()} products/second`
      );
    }

    // TODO: Remove non existent products in target if configured to do so in the sync
    if (removeNonExistent === true) {
    }

    this.log.info(`Syncing catalog [${sourceCatalog}] to catalog [${targetCatalog}], end`);

    // Update the last sync time
    const result = await this.repo.updateOne(catalogSyncResult.value._id, catalogSyncResult.value.version!, {
      $set: { lastSync: new Date().toISOString() }
    });
    if (result.isErr()) return result;
    return new Ok(true);
  }
}
