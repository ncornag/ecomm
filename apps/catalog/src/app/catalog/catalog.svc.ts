import { type Result, Ok, Err } from 'ts-results-es';
import { AppError, ErrorCode } from '@ecomm/app-error';
import { Value } from '@sinclair/typebox/value';
import { nanoid } from 'nanoid';
import { type Catalog, UpdateCatalogAction } from './catalog.ts';
import { type CreateCatalogBody } from './catalog.schemas.ts';
import { type CatalogDAO } from './catalog.dao.schema.ts';
import { ChangeNameActionHandler } from '../lib/actions/changeName.handler.ts';
import { ChangeDescriptionActionHandler } from '../lib/actions/changeDescription.handler.ts';
import { type ICatalogRepository } from './catalog.repo.ts';
import { ActionsRunner, type ActionHandlersList } from '@ecomm/actions-runner';
import { type Config } from '@ecomm/config';
import { type Queues } from '@ecomm/queues';

// SERVICE INTERFACE
export interface ICatalogService {
  createCatalog: (payload: CreateCatalogBody) => Promise<Result<Catalog, AppError>>;
  updateCatalog: (id: string, version: number, actions: any) => Promise<Result<Catalog, AppError>>;
  findCatalogById: (id: string) => Promise<Result<Catalog, AppError>>;
  saveCatalog: (category: Catalog) => Promise<Result<Catalog, AppError>>;
}

const toEntity = ({ _id, ...remainder }: CatalogDAO): Catalog => ({
  id: _id,
  ...remainder
});

// SERVICE IMPLEMENTATION
export class CatalogService implements ICatalogService {
  private ENTITY = 'catalog';
  private TOPIC_CREATE: string;
  private TOPIC_UPDATE: string;
  private static instance: ICatalogService;
  private repo: ICatalogRepository;
  private actionHandlers: ActionHandlersList;
  private actionsRunner: ActionsRunner<CatalogDAO, ICatalogRepository>;
  private config: Config;
  private queues: Queues;

  private constructor(server: any) {
    this.repo = server.db.repo.catalogRepository as ICatalogRepository;
    this.actionHandlers = {
      changeName: new ChangeNameActionHandler(server),
      changeDescription: new ChangeDescriptionActionHandler(server)
    };
    this.actionsRunner = new ActionsRunner<CatalogDAO, ICatalogRepository>();
    this.config = server.config;
    this.queues = server.queues;
    this.TOPIC_CREATE = `global.${this.ENTITY}.${server.config.TOPIC_CREATE_SUFIX}`;
    this.TOPIC_UPDATE = `global.${this.ENTITY}.${server.config.TOPIC_UPDATE_SUFIX}`;
  }

  public static getInstance(server: any): ICatalogService {
    if (!CatalogService.instance) {
      CatalogService.instance = new CatalogService(server);
    }
    return CatalogService.instance;
  }

  // CREATE CATALOG
  public async createCatalog(payload: CreateCatalogBody): Promise<Result<Catalog, AppError>> {
    // Save the entity
    const result = await this.repo.create({
      id: nanoid(),
      ...payload
    });
    if (result.isErr()) return result;
    // Send new entity via messagging
    this.queues.publish(this.TOPIC_CREATE, {
      source: toEntity(result.value),
      metadata: {
        type: 'entityCreated',
        entity: this.ENTITY
      }
    });
    return new Ok(toEntity(result.value));
  }

  // UPDATE CATALOG
  public async updateCatalog(
    id: string,
    version: number,
    actions: UpdateCatalogAction[]
  ): Promise<Result<Catalog, AppError>> {
    // Find the Entity
    const result = await this.repo.findOne(id, version);
    if (result.isErr()) return result;
    const entity: CatalogDAO = result.value;
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
      // Send differences via messagging
      this.queues.publish(this.TOPIC_UPDATE, {
        source: { id: result.value._id },
        difference,
        metadata: {
          type: 'entityUpdated',
          entity: this.ENTITY
        }
      });
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

  // FIND CATALOG
  public async findCatalogById(id: string): Promise<Result<Catalog, AppError>> {
    const result = await this.repo.findOne(id);
    if (result.isErr()) return result;
    return new Ok(toEntity(result.value));
  }

  // SAVE CATALOG
  public async saveCatalog(category: Catalog): Promise<Result<Catalog, AppError>> {
    const result = await this.repo.save(category);
    if (result.isErr()) return result;
    return new Ok(toEntity(result.value));
  }
}
