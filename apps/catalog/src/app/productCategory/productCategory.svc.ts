import { type Result, Ok, Err } from 'ts-results';
import { AppErrorResult, AppError, ErrorCode } from '@ecomm/AppError';
import { Value } from '@sinclair/typebox/value';
import { type ProductCategory } from './productCategory';
import { type ProductCategoryDAO } from './productCategory.dao.schema';
import { ChangeNameActionHandler } from '../lib/actions/changeName.handler';
import { SetKeyActionHandler } from '../lib/actions/setKey.handler';
import { ChangeParentActionHandler } from '../lib/tree';
import {
  ActionsRunner,
  ActionsRunner2,
  type ActionHandlersList,
} from '@ecomm/ActionsRunner';
import { type IProductCategoryRepository } from './productCategory.repo';
import { Validator } from '../lib/validator';
import { Queues } from '@ecomm/Queues';
import {
  CreateProductCategory,
  ENTITY_NAME,
  ProductCategoryCreated,
  ProductCategoryEvent,
  ProductCategoryEventTypes,
  ProductCategoryUpdated,
  toStreamName,
  UpdateProductCategory,
} from './productCategory.events';
import { RecordedEvent, toRecordedEvent } from '@ecomm/EventStore';
import { FastifyInstance } from 'fastify';

// SERVICE INTERFACE
interface IProductCategoryService {
  create: (
    command: CreateProductCategory,
  ) => Promise<Result<ProductCategoryCreated, AppError>>;
  update: (
    command: UpdateProductCategory,
  ) => Promise<Result<ProductCategoryUpdated, AppError>>;
  aggregate: (
    currentState: ProductCategory,
    event: RecordedEvent<ProductCategoryEvent>,
  ) => Promise<Result<{ entity: ProductCategory; update?: any }, AppError>>;
  findProductCategoryById: (
    id: string,
  ) => Promise<Result<ProductCategory, AppError>>;
  validate: (id: string, data: any) => Promise<Result<any, AppError>>;
}

const toEntity = ({
  _id,
  ...remainder
}: ProductCategoryDAO): ProductCategory => ({
  id: _id,
  ...remainder,
});

// SERVICE IMPLEMENTATION
export class ProductCategoryService implements IProductCategoryService {
  private server: FastifyInstance;
  private static instance: IProductCategoryService;
  private repo: IProductCategoryRepository;
  private actionHandlers: ActionHandlersList;
  private actionsRunner: ActionsRunner<
    ProductCategoryDAO,
    IProductCategoryRepository
  >;
  private actionsRunner2: ActionsRunner2<
    ProductCategory,
    IProductCategoryRepository
  >;
  private queues: Queues;
  private validator: Validator;

  private constructor(server: any) {
    this.server = server;
    this.repo = server.db.repo
      .productCategoryRepository as IProductCategoryRepository;
    this.actionHandlers = {
      setKey: new SetKeyActionHandler(server),
      changeName: new ChangeNameActionHandler(server),
      changeParent: new ChangeParentActionHandler(server),
    };
    this.actionsRunner = new ActionsRunner<
      ProductCategoryDAO,
      IProductCategoryRepository
    >();
    this.actionsRunner2 = new ActionsRunner2<
      ProductCategory,
      IProductCategoryRepository
    >();
    this.queues = server.queues;
    this.validator = new Validator(server);
  }

  public static getInstance(server: any): IProductCategoryService {
    if (!ProductCategoryService.instance) {
      ProductCategoryService.instance = new ProductCategoryService(server);
    }
    return ProductCategoryService.instance;
  }

  // CREATE
  public create = async (
    command: CreateProductCategory,
  ): Promise<Result<ProductCategoryCreated, AppError>> => {
    const { id, ...remainder } = command.metadata;
    if (command.data.productCategory.parent) {
      // const actionResult = await this.actionHandlers['changeParent'].run(
      //   {} as ProductCategoryDAO,
      //   payload as ProductCategoryDAO,
      //   { action: 'changeParent', parent: payload.parent },
      //   this.repo,
      // );
      // if (actionResult.err) return actionResult;
    }
    return new Ok({
      type: ProductCategoryEventTypes.CREATED,
      data: { productCategory: { id, ...command.data.productCategory } },
      metadata: { entity: ENTITY_NAME, ...remainder },
    } as ProductCategoryCreated);
  };

  // UPDATE
  public update = async (
    command: UpdateProductCategory,
  ): Promise<Result<ProductCategoryUpdated, AppError>> => {
    const aggregateResult = await this.server.es.aggregateStream<
      ProductCategory,
      ProductCategoryEvent
    >(
      command.metadata.projectId,
      toStreamName(command.data.productCategoryId),
      this.aggregate,
    );
    if (!aggregateResult.ok) return aggregateResult;

    const expectedResult = await this.aggregate(
      aggregateResult.val,
      toRecordedEvent(ProductCategoryEventTypes.UPDATED, ENTITY_NAME, command),
    );
    if (!expectedResult.ok) return expectedResult;

    if (!expectedResult.val.update.length) {
      return new AppErrorResult(ErrorCode.NOT_MODIFIED);
    }

    return new Ok({
      type: ProductCategoryEventTypes.UPDATED,
      data: command.data,
      metadata: {
        entity: ENTITY_NAME,
        expected: expectedResult.val.entity,
        ...command.metadata,
      },
    } as ProductCategoryUpdated);
  };

  // AGGREGATE
  public aggregate = async (
    currentState: ProductCategory,
    event: RecordedEvent<ProductCategoryEvent>,
  ): Promise<Result<{ entity: ProductCategory; update?: any }, AppError>> => {
    const e = event as ProductCategoryEvent;
    switch (e.type) {
      case ProductCategoryEventTypes.CREATED: {
        if (currentState)
          return new AppErrorResult(
            ErrorCode.UNPROCESSABLE_ENTITY,
            'Entity already exists',
          );
        return new Ok({
          entity: Object.assign(e.data.productCategory, {
            version: e.metadata.version,
            createdAt: event.createdAt,
          }),
        });
      }

      case ProductCategoryEventTypes.UPDATED: {
        if (!currentState)
          return new AppErrorResult(
            ErrorCode.UNPROCESSABLE_ENTITY,
            'Empty entity',
          );
        // Execute actions
        const toUpdateEntity = Value.Clone(currentState);
        const actionRunnerResults = await this.actionsRunner2.run(
          currentState,
          toUpdateEntity,
          this.repo,
          this.actionHandlers,
          e.data.actions,
        );
        if (actionRunnerResults.err) return actionRunnerResults;

        return new Ok({
          entity: Object.assign(toUpdateEntity, {
            catalogId: e.metadata.catalogId,
            version: e.metadata.version,
            lastModifiedAt: event.createdAt,
          }),
          update: actionRunnerResults.val.update,
        });
      }

      default: {
        return new AppErrorResult(
          ErrorCode.UNPROCESSABLE_ENTITY,
          `Unknown event type: ${(e as any).type}`,
        );
      }
    }
  };

  // FIND CATEGORY IN THE READ MODEL
  public async findProductCategoryById(
    id: string,
  ): Promise<Result<ProductCategory, AppError>> {
    const result = await this.repo.findOne(id);
    if (result.err) return result;
    return new Ok(toEntity(result.val));
  }

  // VALIDATE
  public async validate(id: string, data: any): Promise<Result<any, AppError>> {
    const schemaResult: Result<any, AppError> =
      await this.validator.getProductCategorySchema(id);
    if (schemaResult.err) return new Err(schemaResult.val);
    const validation: Result<any, AppError> = this.validator.validate(
      schemaResult.val.jsonSchema,
      data,
    );
    if (validation.err) return new Err(validation.val);
    return new Ok({ ok: true });
  }
}
