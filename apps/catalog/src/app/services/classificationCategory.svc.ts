import { type Result, Ok, Err } from 'ts-results';
import { AppError, ErrorCode } from '@ecomm/AppError';
import { Value } from '@sinclair/typebox/value';
import { nanoid } from 'nanoid';
import {
  type ClassificationCategory,
  UpdateClassificationCategoryAction,
} from '../entities/classificationCategory';
import {
  type ClassificationAttribute,
  ClassificationAttributeSchema,
} from '../entities/classificationAttribute';
import { type ClassificationCategoryPayload } from '../schemas/classificationCategory.schemas';
import { type ClassificationAttributePayload } from '../schemas/classificationAttribute.schemas';
import { type ClassificationCategoryDAO } from '../repositories/classificationCategory.dao.schema';
import { type IClassificationCategoryRepository } from '../repositories/classificationCategory.repo';
import { SetKeyActionHandler } from './actions/setKey.handler';
import { ChangeNameActionHandler } from './actions/changeName.handler';
import { ChangeParentActionHandler } from '../lib/tree';
import { ActionsRunner, type ActionHandlersList } from '@ecomm/ActionsRunner';
import { type Config } from '@ecomm/Config';
import { Validator } from '../lib/validator';
import { Queues } from '@ecomm/Queues';

// SERVICE INTERFACE
export interface IClassificationCategoryService {
  createClassificationCategory: (
    payload: ClassificationCategoryPayload,
  ) => Promise<Result<ClassificationCategory, AppError>>;
  updateClassificationCategory: (
    id: string,
    version: number,
    actions: any,
  ) => Promise<Result<ClassificationCategory, AppError>>;
  findClassificationCategoryById: (
    id: string,
  ) => Promise<Result<ClassificationCategory, AppError>>;
  saveClassificationCategory: (
    category: ClassificationCategory,
  ) => Promise<Result<ClassificationCategory, AppError>>;
  validate: (id: string, data: any) => Promise<Result<any, AppError>>;
  createClassificationAttribute: (
    id: string,
    categoryVersion: number,
    payload: ClassificationAttributePayload,
  ) => Promise<Result<ClassificationAttribute, AppError>>;
  findClassificationAttributeById: (
    id: string,
    attributeId: string,
  ) => Promise<Result<ClassificationAttribute, AppError>>;
}

const toEntity = ({
  _id,
  ...remainder
}: ClassificationCategoryDAO): ClassificationCategory => ({
  id: _id,
  ...remainder,
});

// SERVICE IMPLEMENTATION
export class ClassificationCategoryService
  implements IClassificationCategoryService
{
  private static instance: IClassificationCategoryService;
  private repo: IClassificationCategoryRepository;
  private actionHandlers: ActionHandlersList;
  private actionsRunner: ActionsRunner<
    ClassificationCategoryDAO,
    IClassificationCategoryRepository
  >;
  private config: Config;
  private queues: Queues;
  private validator: Validator;

  private constructor(server: any) {
    this.repo = server.db.repo
      .classificationCategoryRepository as IClassificationCategoryRepository;
    this.actionHandlers = {
      setKey: new SetKeyActionHandler(server),
      changeName: new ChangeNameActionHandler(server),
      changeParent: new ChangeParentActionHandler(server),
    };
    this.actionsRunner = new ActionsRunner<
      ClassificationCategoryDAO,
      IClassificationCategoryRepository
    >();
    this.config = server.config;
    this.queues = server.queues;
    this.validator = new Validator(server);
  }

  public static getInstance(server: any): IClassificationCategoryService {
    if (!ClassificationCategoryService.instance) {
      ClassificationCategoryService.instance =
        new ClassificationCategoryService(server);
    }
    return ClassificationCategoryService.instance;
  }

  // CREATE CATEGORY
  public async createClassificationCategory(
    payload: ClassificationCategoryPayload,
  ): Promise<Result<ClassificationCategory, AppError>> {
    // Add ancestors
    if (payload.parent) {
      const actionResult = await this.actionHandlers['changeParent'].run(
        {},
        payload,
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
    this.queues.publish('global.classificationCategory.insert', {
      source: toEntity(result.val),
      metadata: {
        type: 'entityInsert',
        entity: 'classificationCategory',
      },
    });
    return new Ok(toEntity(result.val));
  }

  // UPDATE CATEGORY
  public async updateClassificationCategory(
    id: string,
    version: number,
    actions: UpdateClassificationCategoryAction[],
  ): Promise<Result<ClassificationCategory, AppError>> {
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
      this.queues.publish('global.classificationCategory.update', {
        entity: 'classificationCategory',
        source: entity,
        difference,
        metadata: { type: 'entityUpdate' },
      });
      // Send side effects via messagging
      actionRunnerResults.val.sideEffects?.forEach((sideEffect: any) => {
        this.queues.publish('global.classificationCategory.update.sideEffect', {
          ...sideEffect.data,
          entity: 'classificationCategory',
          metadata: { type: sideEffect.action },
        });
      });
    }
    // Return udated entity
    return Ok(toEntity(toUpdateEntity));
  }

  // FIND CATEGORY
  public async findClassificationCategoryById(
    id: string,
  ): Promise<Result<ClassificationCategory, AppError>> {
    const result = await this.repo.findOne(id);
    if (result.err) return result;
    return new Ok(toEntity(result.val));
  }

  // SAVE  CATEGORY
  public async saveClassificationCategory(
    category: ClassificationCategory,
  ): Promise<Result<ClassificationCategory, AppError>> {
    const result = await this.repo.save(category);
    if (result.err) return result;
    return new Ok(toEntity(result.val));
  }

  // VALIDATE
  public async validate(id: string, data: any): Promise<Result<any, AppError>> {
    const schemaResult: Result<any, AppError> =
      await this.validator.getClassificationCategorySchema(id);
    if (!schemaResult.ok) return new Err(schemaResult.val);
    const validation: Result<any, AppError> = this.validator.validate(
      schemaResult.val.jsonSchema,
      data,
    );
    if (!validation.ok) return new Err(validation.val);
    return new Ok({ ok: true });
  }

  // CREATE ATTRIBUTE
  public async createClassificationAttribute(
    id: string,
    categoryVersion: number,
    payload: ClassificationAttributePayload,
  ): Promise<Result<ClassificationAttribute, AppError>> {
    // Find the Category
    const result = await this.repo.createClassificationAttribute(
      id,
      categoryVersion,
      payload,
    );
    if (result.err) return result;
    const entity = Value.Convert(ClassificationAttributeSchema, {
      ...result.val,
    }) as ClassificationAttribute;
    return new Ok(entity);
  }

  // FIND ATTRIBUTE
  public async findClassificationAttributeById(
    id: string,
    attributeId: string,
  ): Promise<Result<ClassificationAttribute, AppError>> {
    const criteria: any = { _id: id, 'attributes._id': attributeId }; // Should the '_id' implementation detail be hidden in the repository class?
    const options: any = { projections: { 'attributes.$': 1 } };
    const result = await this.repo.find(criteria, options);
    if (result.err) return result;
    if (result.val.length != 1)
      return new Err(new AppError(ErrorCode.NOT_FOUND));
    const entity = Value.Convert(ClassificationAttributeSchema, {
      ...result.val[0].attributes![0],
    }) as ClassificationAttribute;
    return new Ok(entity);
  }
}
