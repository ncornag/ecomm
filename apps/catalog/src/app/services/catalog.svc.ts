import { type Result, Ok, Err } from 'ts-results';
import { AppError, ErrorCode } from '@ecomm/AppError';
import { Value } from '@sinclair/typebox/value';
import { nanoid } from 'nanoid';
import { type Catalog, UpdateCatalogAction } from '../entities/catalog';
import { type CreateCatalogBody } from '../schemas/catalog.schemas';
import { type CatalogDAO } from '../repositories/catalog.dao.schema';
import {
  type ActionHandlersList,
  ChangeNameActionHandler,
  ChangeDescriptionActionHandler,
} from './actions';
import { type ICatalogRepository } from '../repositories/catalog.repo';
import { UpdateEntityActionsRunner } from '../lib/updateEntityActionsRunner';
import { type Config } from '@ecomm/Config';
import { Queues } from '@ecomm/Queues';

// SERVICE INTERFACE
export interface ICatalogService {
  createCatalog: (
    payload: CreateCatalogBody,
  ) => Promise<Result<Catalog, AppError>>;
  updateCatalog: (
    id: string,
    version: number,
    actions: any,
  ) => Promise<Result<Catalog, AppError>>;
  findCatalogById: (id: string) => Promise<Result<Catalog, AppError>>;
  saveCatalog: (category: Catalog) => Promise<Result<Catalog, AppError>>;
}

const toEntity = ({ _id, ...remainder }: CatalogDAO): Catalog => ({
  id: _id,
  ...remainder,
});

// SERVICE IMPLEMENTATION
export class CatalogService implements ICatalogService {
  private static instance: ICatalogService;
  private repo: ICatalogRepository;
  private actionHandlers: ActionHandlersList;
  private actionsRunner: UpdateEntityActionsRunner<
    CatalogDAO,
    ICatalogRepository
  >;
  private config: Config;
  private queues: Queues;

  private constructor(server: any) {
    this.repo = server.db.repo.catalogRepository as ICatalogRepository;
    this.actionHandlers = {
      changeName: new ChangeNameActionHandler(server),
      changeDescription: new ChangeDescriptionActionHandler(server),
    };
    this.actionsRunner = new UpdateEntityActionsRunner<
      CatalogDAO,
      ICatalogRepository
    >();
    this.config = server.config;
    this.queues = server.queues;
  }

  public static getInstance(server: any): ICatalogService {
    if (!CatalogService.instance) {
      CatalogService.instance = new CatalogService(server);
    }
    return CatalogService.instance;
  }

  // CREATE CATALOG
  public async createCatalog(
    payload: CreateCatalogBody,
  ): Promise<Result<Catalog, AppError>> {
    // Save the entity
    const result = await this.repo.create({
      id: nanoid(),
      ...payload,
    });
    if (result.err) return result;
    this.queues.publish(`global.catalog.insert`, {
      source: toEntity(result.val),
      metadata: {
        type: 'entityInsert',
        entity: 'catalog',
      },
    });
    return new Ok(toEntity(result.val));
  }

  // UPDATE CATALOG
  public async updateCatalog(
    id: string,
    version: number,
    actions: UpdateCatalogAction[],
  ): Promise<Result<Catalog, AppError>> {
    // Find the Entity
    const result = await this.repo.findOne(id, version);
    if (result.err) return result;
    const entity: CatalogDAO = result.val;
    const toUpdateEntity = Value.Clone(entity);
    // Execute actions
    const actionRunnerResults = await this.actionsRunner.run(
      entity,
      toUpdateEntity,
      this.repo,
      this.actionHandlers,
      actions,
    );
    if (actionRunnerResults.err) return actionRunnerResults;
    // Compute difference, and save if needed
    const difference = Value.Diff(entity, toUpdateEntity);
    if (difference.length > 0) {
      // Save the entity
      const saveResult = await this.repo.updateOne(
        id,
        version,
        actionRunnerResults.val.update,
      );
      if (saveResult.err) return saveResult;
      toUpdateEntity.version = version + 1;
      // Send differences via messagging
      this.queues.publish(`global.catalog.update`, {
        entity: 'catalog',
        source: entity,
        difference,
        metadata: { type: 'entityUpdate' },
      });
      // Send side effects via messagging
      actionRunnerResults.val.sideEffects?.forEach((sideEffect: any) => {
        this.queues.publish('global.catalog.update.sideEffect', {
          ...sideEffect.data,
          metadata: { type: sideEffect.action },
        });
      });
    }
    // Return udated entity
    return Ok(toEntity(toUpdateEntity));
  }

  // FIND CATALOG
  public async findCatalogById(id: string): Promise<Result<Catalog, AppError>> {
    const result = await this.repo.findOne(id);
    if (result.err) return result;
    return new Ok(toEntity(result.val));
  }

  // SAVE CATALOG
  public async saveCatalog(
    category: Catalog,
  ): Promise<Result<Catalog, AppError>> {
    const result = await this.repo.save(category);
    if (result.err) return result;
    return new Ok(toEntity(result.val));
  }
}
