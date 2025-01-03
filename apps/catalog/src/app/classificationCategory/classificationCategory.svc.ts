import { type Result, Ok, Err } from 'ts-results-es';
import { AppError, AppErrorResult, ErrorCode } from '@ecomm/app-error';
import { Value } from '@sinclair/typebox/value';
import { type ClassificationCategory } from './classificationCategory.ts';
import { type ClassificationCategoryDAO } from './classificationCategory.dao.schema.ts';
import { ChangeNameActionHandler } from '../lib/actions/changeName.handler.ts';
import { SetKeyActionHandler } from '../lib/actions/setKey.handler.ts';
import { ChangeParentActionHandler } from '../lib/tree.ts';
import { ActionsRunner2, type ActionHandlersList } from '@ecomm/actions-runner';
import {
  ClassificationCategoryRepository,
  type IClassificationCategoryRepository
} from './classificationCategory.repo.ts';
import { Validator } from '../lib/validator.ts';
import {
  ClassificationCategoryEventTypes,
  type CreateClassificationCategory,
  type ClassificationCategoryCreated,
  type UpdateClassificationCategory,
  type ClassificationCategoryUpdated,
  type ClassificationCategoryEvent,
  ENTITY_NAME,
  toStreamName
} from './classificationCategory.events.ts';
import { type RecordedEvent, toRecordedEvent } from '@ecomm/event-store';
import { type FastifyInstance } from 'fastify';
import { type ClassificationAttribute, ClassificationAttributeSchema } from './classificationAttribute.ts';
import { type ClassificationAttributePayload } from './classificationAttribute.schemas.ts';

// SERVICE INTERFACE
export interface IClassificationCategoryService {
  create: (command: CreateClassificationCategory) => Promise<Result<ClassificationCategoryCreated, AppError>>;
  update: (command: UpdateClassificationCategory) => Promise<Result<ClassificationCategoryUpdated, AppError>>;
  aggregate: (
    currentState: ClassificationCategory,
    event: RecordedEvent<ClassificationCategoryEvent>
  ) => Promise<Result<{ entity: ClassificationCategory; update?: any }, AppError>>;

  findClassificationCategoryById: (id: string) => Promise<Result<ClassificationCategory, AppError>>;
  validate: (id: string, data: any) => Promise<Result<any, AppError>>;
  createClassificationAttribute: (
    id: string,
    categoryVersion: number,
    payload: ClassificationAttributePayload
  ) => Promise<Result<ClassificationAttribute, AppError>>;
  findClassificationAttributeById: (
    id: string,
    attributeId: string
  ) => Promise<Result<ClassificationAttribute, AppError>>;
}

const toEntity = ({ _id, ...remainder }: ClassificationCategoryDAO): ClassificationCategory => ({
  id: _id,
  ...remainder
});

// SERVICE IMPLEMENTATION
export class ClassificationCategoryService implements IClassificationCategoryService {
  private server: FastifyInstance;
  private static instance: IClassificationCategoryService;
  private repo: IClassificationCategoryRepository;
  private actionHandlers: ActionHandlersList;
  private actionsRunner2: ActionsRunner2<ClassificationCategory, IClassificationCategoryRepository>;
  private validator: Validator;

  private constructor(server: any) {
    this.server = server;
    this.repo = new ClassificationCategoryRepository(server);
    this.actionHandlers = {
      setKey: new SetKeyActionHandler(server),
      changeName: new ChangeNameActionHandler(server),
      changeParent: new ChangeParentActionHandler(server)
    };
    this.actionsRunner2 = new ActionsRunner2<ClassificationCategory, IClassificationCategoryRepository>();
    this.validator = new Validator(server);
  }

  public static getInstance(server: any): IClassificationCategoryService {
    if (!ClassificationCategoryService.instance) {
      ClassificationCategoryService.instance = new ClassificationCategoryService(server);
    }
    return ClassificationCategoryService.instance;
  }

  // CREATE
  public create = async (
    command: CreateClassificationCategory
  ): Promise<Result<ClassificationCategoryCreated, AppError>> => {
    const { id, ...remainder } = command.metadata;
    if (command.data.classificationCategory.parent) {
      // const actionResult = await this.actionHandlers['changeParent'].run(
      //   {},
      //   payload,
      //   { action: 'changeParent', parent: payload.parent },
      //   this.repo
      // );
      // if (actionResult.isErr()) return actionResult;
    }
    return new Ok({
      type: ClassificationCategoryEventTypes.CREATED,
      data: { classificationCategory: { id, ...command.data.classificationCategory } },
      metadata: { entity: ENTITY_NAME, ...remainder }
    } as ClassificationCategoryCreated);
  };

  // UPDATE
  public update = async (
    command: UpdateClassificationCategory
  ): Promise<Result<ClassificationCategoryUpdated, AppError>> => {
    const aggregateResult = await this.server.es.aggregateStream<ClassificationCategory, ClassificationCategoryEvent>(
      command.metadata.projectId,
      toStreamName(command.data.classificationCategoryId),
      this.aggregate
    );
    if (aggregateResult.isErr()) return aggregateResult;

    const expectedResult = await this.aggregate(
      aggregateResult.value,
      toRecordedEvent(ClassificationCategoryEventTypes.UPDATED, ENTITY_NAME, command)
    );
    if (expectedResult.isErr()) return expectedResult;

    if (!Object.keys(expectedResult.value.update).length) {
      return new AppErrorResult(ErrorCode.NOT_MODIFIED);
    }

    return new Ok({
      type: ClassificationCategoryEventTypes.UPDATED,
      data: command.data,
      metadata: {
        entity: ENTITY_NAME,
        expected: expectedResult.value.entity,
        ...command.metadata
      }
    } as ClassificationCategoryUpdated);
  };

  // AGGREGATE
  public aggregate = async (
    currentState: ClassificationCategory,
    event: RecordedEvent<ClassificationCategoryEvent>
  ): Promise<Result<{ entity: ClassificationCategory; update?: any }, AppError>> => {
    const e = event as ClassificationCategoryEvent;
    switch (e.type) {
      case ClassificationCategoryEventTypes.CREATED: {
        if (currentState) return new AppErrorResult(ErrorCode.UNPROCESSABLE_ENTITY, 'Entity already exists');
        return new Ok({
          entity: Object.assign(e.data.classificationCategory, {
            version: e.metadata.version,
            createdAt: event.createdAt
          })
        });
      }

      case ClassificationCategoryEventTypes.UPDATED: {
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
  public async findClassificationCategoryById(id: string): Promise<Result<ClassificationCategory, AppError>> {
    const result = await this.repo.findOne(id);
    if (result.isErr()) return result;
    return new Ok(toEntity(result.value));
  }

  // VALIDATE
  public async validate(id: string, data: any): Promise<Result<any, AppError>> {
    const schemaResult: Result<any, AppError> = await this.validator.getClassificationCategorySchema(id);
    if (schemaResult.isErr()) return schemaResult;
    const validation: Result<any, AppError> = this.validator.validate(schemaResult.value.jsonSchema, data);
    if (validation.isErr()) return validation;
    return new Ok({ ok: true });
  }

  // CREATE ATTRIBUTE
  public async createClassificationAttribute(
    id: string,
    categoryVersion: number,
    payload: ClassificationAttributePayload
  ): Promise<Result<ClassificationAttribute, AppError>> {
    // Find the Category
    const result = await this.repo.createClassificationAttribute(id, categoryVersion, payload);
    if (result.isErr()) return result;
    const entity = Value.Convert(ClassificationAttributeSchema, {
      ...result.value
    }) as ClassificationAttribute;
    return new Ok(entity);
  }

  // FIND ATTRIBUTE
  public async findClassificationAttributeById(
    id: string,
    attributeId: string
  ): Promise<Result<ClassificationAttribute, AppError>> {
    const criteria: any = { _id: id, 'attributes._id': attributeId }; // Should the '_id' implementation detail be hidden in the repository class?
    const options: any = { projections: { 'attributes.$': 1 } };
    const result = await this.repo.find(criteria, options);
    if (result.isErr()) return result;
    if (result.value.length != 1) return new Err(new AppError(ErrorCode.NOT_FOUND));
    const entity = Value.Convert(ClassificationAttributeSchema, {
      ...result.value[0].attributes![0]
    }) as ClassificationAttribute;
    return new Ok(entity);
  }
}
