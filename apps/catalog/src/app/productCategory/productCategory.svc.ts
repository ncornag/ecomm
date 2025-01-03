import { type Result, Ok, Err } from 'ts-results-es';
import { AppErrorResult, AppError, ErrorCode } from '@ecomm/app-error';
import { Value } from '@sinclair/typebox/value';
import { type ProductCategory } from './productCategory.ts';
import { type ProductCategoryDAO } from './productCategory.dao.schema.ts';
import { ChangeNameActionHandler } from '../lib/actions/changeName.handler.ts';
import { SetKeyActionHandler } from '../lib/actions/setKey.handler.ts';
import { ChangeParentActionHandler } from '../lib/tree.ts';
import { ActionsRunner2, type ActionHandlersList } from '@ecomm/actions-runner';
import { ProductCategoryRepository, type IProductCategoryRepository } from './productCategory.repo.ts';
import { Validator } from '../lib/validator.ts';
import {
  ProductCategoryEventTypes,
  type CreateProductCategory,
  type ProductCategoryCreated,
  type UpdateProductCategory,
  type ProductCategoryUpdated,
  type ProductCategoryEvent,
  ENTITY_NAME,
  toStreamName
} from './productCategory.events.ts';
import { type RecordedEvent, toRecordedEvent } from '@ecomm/event-store';
import { type FastifyInstance } from 'fastify';

// SERVICE INTERFACE
interface IProductCategoryService {
  create: (command: CreateProductCategory) => Promise<Result<ProductCategoryCreated, AppError>>;
  update: (command: UpdateProductCategory) => Promise<Result<ProductCategoryUpdated, AppError>>;
  aggregate: (
    currentState: ProductCategory,
    event: RecordedEvent<ProductCategoryEvent>
  ) => Promise<Result<{ entity: ProductCategory; update?: any }, AppError>>;
  findProductCategoryById: (id: string) => Promise<Result<ProductCategory, AppError>>;
  validate: (id: string, data: any) => Promise<Result<any, AppError>>;
}

const toEntity = ({ _id, ...remainder }: ProductCategoryDAO): ProductCategory => ({
  id: _id,
  ...remainder
});

// SERVICE IMPLEMENTATION
export class ProductCategoryService implements IProductCategoryService {
  private server: FastifyInstance;
  private static instance: IProductCategoryService;
  private repo: IProductCategoryRepository;
  private actionHandlers: ActionHandlersList;
  private actionsRunner2: ActionsRunner2<ProductCategory, IProductCategoryRepository>;
  private validator: Validator;

  private constructor(server: any) {
    this.server = server;
    this.repo = new ProductCategoryRepository(server);
    this.actionHandlers = {
      setKey: new SetKeyActionHandler(server),
      changeName: new ChangeNameActionHandler(server),
      changeParent: new ChangeParentActionHandler(server)
    };
    this.actionsRunner2 = new ActionsRunner2<ProductCategory, IProductCategoryRepository>();
    this.validator = new Validator(server);
  }

  public static getInstance(server: any): IProductCategoryService {
    if (!ProductCategoryService.instance) {
      ProductCategoryService.instance = new ProductCategoryService(server);
    }
    return ProductCategoryService.instance;
  }

  // CREATE
  public create = async (command: CreateProductCategory): Promise<Result<ProductCategoryCreated, AppError>> => {
    const { id, ...remainder } = command.metadata;
    if (command.data.productCategory.parent) {
      // const actionResult = await this.actionHandlers['changeParent'].run(
      //   {} as ProductCategoryDAO,
      //   payload as ProductCategoryDAO,
      //   { action: 'changeParent', parent: payload.parent },
      //   this.repo,
      // );
      // if (actionResult.isErr()) return actionResult;
    }
    return new Ok({
      type: ProductCategoryEventTypes.CREATED,
      data: { productCategory: { id, ...command.data.productCategory } },
      metadata: { entity: ENTITY_NAME, ...remainder }
    } as ProductCategoryCreated);
  };

  // UPDATE
  public update = async (command: UpdateProductCategory): Promise<Result<ProductCategoryUpdated, AppError>> => {
    const aggregateResult = await this.server.es.aggregateStream<ProductCategory, ProductCategoryEvent>(
      command.metadata.projectId,
      toStreamName(command.data.productCategoryId),
      this.aggregate
    );
    if (aggregateResult.isErr()) return aggregateResult;

    const expectedResult = await this.aggregate(
      aggregateResult.value,
      toRecordedEvent(ProductCategoryEventTypes.UPDATED, ENTITY_NAME, command)
    );
    if (expectedResult.isErr()) return expectedResult;

    if (!Object.keys(expectedResult.value.update).length) {
      return new AppErrorResult(ErrorCode.NOT_MODIFIED);
    }

    return new Ok({
      type: ProductCategoryEventTypes.UPDATED,
      data: command.data,
      metadata: {
        entity: ENTITY_NAME,
        expected: expectedResult.value.entity,
        ...command.metadata
      }
    } as ProductCategoryUpdated);
  };

  // AGGREGATE
  public aggregate = async (
    currentState: ProductCategory,
    event: RecordedEvent<ProductCategoryEvent>
  ): Promise<Result<{ entity: ProductCategory; update?: any }, AppError>> => {
    const e = event as ProductCategoryEvent;
    switch (e.type) {
      case ProductCategoryEventTypes.CREATED: {
        if (currentState) return new AppErrorResult(ErrorCode.UNPROCESSABLE_ENTITY, 'Entity already exists');
        return new Ok({
          entity: Object.assign(e.data.productCategory, {
            version: e.metadata.version,
            createdAt: event.createdAt
          })
        });
      }

      case ProductCategoryEventTypes.UPDATED: {
        if (!currentState) return new AppErrorResult(ErrorCode.UNPROCESSABLE_ENTITY, 'Empty entity');
        // Execute actions
        const toUpdateEntity = Value.Clone(currentState);
        const actionRunnerResults = await this.actionsRunner2.run(
          currentState,
          toUpdateEntity,
          this.repo,
          this.actionHandlers,
          e.data.actions
        );
        if (actionRunnerResults.isErr()) return actionRunnerResults;

        return new Ok({
          entity: Object.assign(toUpdateEntity, {
            catalogId: e.metadata.catalogId,
            version: e.metadata.version,
            lastModifiedAt: event.createdAt
          }),
          update: actionRunnerResults.value.update
        });
      }

      default: {
        return new AppErrorResult(ErrorCode.UNPROCESSABLE_ENTITY, `Unknown event type: ${(e as any).type}`);
      }
    }
  };

  // FIND IN THE READ MODEL
  public async findProductCategoryById(id: string): Promise<Result<ProductCategory, AppError>> {
    const result = await this.repo.findOne(id);
    if (result.isErr()) return result;
    return new Ok(toEntity(result.value));
  }

  // VALIDATE
  public async validate(id: string, data: any): Promise<Result<any, AppError>> {
    const schemaResult: Result<any, AppError> = await this.validator.getProductCategorySchema(id);
    if (schemaResult.isErr()) return schemaResult;
    const validation: Result<any, AppError> = this.validator.validate(schemaResult.value.jsonSchema, data);
    if (validation.isErr()) return validation;
    return new Ok({ ok: true });
  }
}
