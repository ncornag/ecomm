import { type Result, Ok, Err } from 'ts-results';
import { AppError } from '@ecomm/AppError';
import { Value } from '@sinclair/typebox/value';
import { nanoid } from 'nanoid';
import {
  type ProductCategory,
  UpdateProductCategoryAction,
} from '../entities/productCategory';
import { type CreateProductCategoryBody } from '../schemas/productCategory.schemas';
import { type ProductCategoryDAO } from '../repositories/productCategory.dao.schema';
import {
  ActionHandlerResult,
  type ActionHandlersList,
  ChangeNameActionHandler,
  SetKeyActionHandler,
} from '../services/actions';
import { type IProductCategoryRepository } from '../repositories/productCategory.repo';
import { ChangeParentActionHandler } from '../lib/tree';
import { UpdateEntityActionsRunner } from '../lib/updateEntityActionsRunner';
import { type Config } from '@ecomm/Config';
import { Validator } from '../lib/validator';
import { Queues } from '@ecomm/Queues';

// SERVICE INTERFACE
interface IProductCategoryService {
  createProductCategory: (
    payload: CreateProductCategoryBody,
  ) => Promise<Result<ProductCategory, AppError>>;
  updateProductCategory: (
    id: string,
    version: number,
    actions: any,
  ) => Promise<Result<ProductCategory, AppError>>;
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
  private static instance: IProductCategoryService;
  private repo: IProductCategoryRepository;
  private actionHandlers: ActionHandlersList;
  private actionsRunner: UpdateEntityActionsRunner<
    ProductCategoryDAO,
    IProductCategoryRepository
  >;
  private config: Config;
  private queues: Queues;
  private validator: Validator;

  private constructor(server: any) {
    this.repo = server.db.repo
      .productCategoryRepository as IProductCategoryRepository;
    this.actionHandlers = {
      setKey: new SetKeyActionHandler(server),
      changeName: new ChangeNameActionHandler(server),
      changeParent: new ChangeParentActionHandler(server),
    };
    this.actionsRunner = new UpdateEntityActionsRunner<
      ProductCategoryDAO,
      IProductCategoryRepository
    >();
    this.config = server.config;
    this.queues = server.queues;
    this.validator = new Validator(server);
  }

  public static getInstance(server: any): IProductCategoryService {
    if (!ProductCategoryService.instance) {
      ProductCategoryService.instance = new ProductCategoryService(server);
    }
    return ProductCategoryService.instance;
  }

  // CREATE CATEGORY
  public async createProductCategory(
    payload: CreateProductCategoryBody,
  ): Promise<Result<ProductCategory, AppError>> {
    // Add ancestors
    if (payload.parent) {
      const actionResult = await this.actionHandlers['changeParent'].run(
        {} as ProductCategoryDAO,
        payload as ProductCategoryDAO,
        { action: 'changeParent', parent: payload.parent },
        this.repo,
      );
      if (actionResult.err) return actionResult;
    }
    // Save the entity
    const result = await this.repo.create({
      id: nanoid(),
      ...payload,
    });
    if (result.err) return result;
    this.queues.publish('global.productCategory.insert', {
      source: toEntity(result.val),
      metadata: {
        type: 'entityInsert',
        entity: 'productCategory',
      },
    });
    return new Ok(toEntity(result.val));
  }

  // UPDATE CATEGORY
  public async updateProductCategory(
    id: string,
    version: number,
    actions: UpdateProductCategoryAction[],
  ): Promise<Result<ProductCategory, AppError>> {
    // Find the Entity
    const result = await this.repo.findOne(id, version);
    if (result.err) return result;
    const entity = result.val;
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
      this.queues.publish('global.productCategory.update', {
        entity: 'productCategory',
        source: entity,
        difference,
        metadata: { type: 'entityUpdate' },
      });
      // Send side effects via messagging
      actionRunnerResults.val.sideEffects?.forEach((sideEffect: any) => {
        this.queues.publish(sideEffect.action, {
          ...sideEffect.data,
          entity: 'productCategory',
          metadata: { type: sideEffect.action },
        });
      });
    }
    // Return udated entity
    return Ok(toEntity(toUpdateEntity));
  }

  // FIND CATEGORY
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
    if (!schemaResult.ok) return new Err(schemaResult.val);
    const validation: Result<any, AppError> = this.validator.validate(
      schemaResult.val.jsonSchema,
      data,
    );
    if (!validation.ok) return new Err(validation.val);
    return new Ok({ ok: true });
  }
}
