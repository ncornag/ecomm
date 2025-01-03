import { type Result, Ok, Err } from 'ts-results-es';
import { ErrorCode, AppError } from '@ecomm/app-error';
import { type ITreeRepo } from '../lib/tree.ts';
import { Db, Collection } from 'mongodb';
import { type ClassificationCategory } from './classificationCategory.ts';
import { type ClassificationCategoryDAO } from './classificationCategory.dao.schema.ts';
import { type ClassificationAttributeDAO } from './classificationAttribute.dao.schema.ts';
import { type ClassificationAttributePayload } from './classificationAttribute.schemas.ts';
import { type FastifyInstance } from 'fastify';
import { projectId } from '@ecomm/request-context';

export interface IClassificationCategoryRepository {
  create: (category: ClassificationCategory) => Promise<Result<ClassificationCategoryDAO, AppError>>;
  save: (category: ClassificationCategory) => Promise<Result<ClassificationCategoryDAO, AppError>>;
  updateOne: (id: string, categoryVersion: number, update: any) => Promise<Result<any, AppError>>;
  update: (filter: any, update: any) => Promise<Result<any, AppError>>;
  findOne: (id: string, version?: number) => Promise<Result<ClassificationCategoryDAO, AppError>>;
  find: (query: any, options?: any) => Promise<Result<ClassificationCategoryDAO[], AppError>>;
  aggregate: (pipeline: any[], options?: any) => Promise<Result<any[], AppError>>;
  createClassificationAttribute: (
    id: string,
    categoryVersion: number,
    payload: ClassificationAttributePayload
  ) => Promise<Result<ClassificationAttributeDAO, AppError>>;
}

export class ClassificationCategoryRepository
  implements IClassificationCategoryRepository, ITreeRepo<ClassificationCategoryDAO>
{
  private ENTITY = 'classificationCategory';
  private server: FastifyInstance;
  private col: Collection<ClassificationCategoryDAO>;

  constructor(server: any) {
    this.server = server;
    this.col = server.db.col.classificationCategory;
  }

  // CREATE CATEGORY
  async create(category: ClassificationCategory): Promise<Result<ClassificationCategoryDAO, AppError>> {
    const { id: _id, ...data } = category;
    const categoryDAO = { _id, ...data };
    const result = await this.col.insertOne(categoryDAO);
    if (!result || result.insertedId == '')
      // TODO: Check if this is the correct way to check for succesul inserts
      return new Err(new AppError(ErrorCode.BAD_REQUEST, `Can't save category [${_id}]`));
    return new Ok(categoryDAO);
  }

  // SAVE CATEGORY
  async save(category: ClassificationCategory): Promise<Result<ClassificationCategoryDAO, AppError>> {
    const { id: _id, ...data } = category;
    const categoryDAO = { _id, ...data };
    const version = categoryDAO.version!;
    const result = await this.col.updateOne({ _id }, { $set: categoryDAO });
    if (!result || result.modifiedCount != 1)
      return new Err(new AppError(ErrorCode.BAD_REQUEST, `Can't save category [${_id}]`));
    categoryDAO.version = version + 1;
    return new Ok(categoryDAO);
  }

  // UPDATE ONE CATEGORY
  async updateOne(id: string, categoryVersion: number, update: any): Promise<Result<any, AppError>> {
    const result = await this.col.updateOne(
      {
        _id: id,
        version: categoryVersion
      },
      update
    );
    if (result.modifiedCount != 1) return new Err(new AppError(ErrorCode.BAD_REQUEST, `Can't update category.`));
    return new Ok({});
  }

  // UPDATE MANY CATEGORIES
  async update(filter: any, update: any): Promise<Result<any, AppError>> {
    const result = await this.col.updateMany(filter, update);
    //if (result.ok != 1) return new Err(new AppError(ErrorCode.BAD_REQUEST, `Can't update categories.`));
    return new Ok({});
  }

  // FIND ONE CATEGORY
  async findOne(id: string, version?: number): Promise<Result<ClassificationCategoryDAO, AppError>> {
    const col = this.server.db.getCol(projectId(), this.ENTITY);
    const filter: any = { _id: id };
    if (version !== undefined) filter.version = version;
    const entity = await col.findOne(filter);
    if (!entity) {
      return new Err(new AppError(ErrorCode.BAD_REQUEST, `Can't find category with id [${id}]`));
    }
    return new Ok(entity);
  }

  // FIND MANY CATEGORIES
  async find(query: any, options: any): Promise<Result<ClassificationCategoryDAO[], AppError>> {
    // TODO: Add query limit?
    const entities = await this.col.find(query, options).toArray();
    // if (entities.length === 0) {
    //   return new Err(new AppError(ErrorCode.BAD_REQUEST, `Can't find categories matching the criteria.`));
    // }
    return new Ok(entities);
  }

  // AGGREGATE CATEGORIES
  async aggregate(pipeline: any[], options: any): Promise<Result<any, AppError>> {
    const result: any[] = [];
    const cursor = this.col.aggregate(pipeline, options);
    for await (const doc of cursor) {
      result.push(doc);
    }
    return new Ok(result);
  }
  // CREATE ATTRIBUTE
  async createClassificationAttribute(
    id: string,
    categoryVersion: number,
    payload: ClassificationAttributePayload
  ): Promise<Result<ClassificationAttributeDAO, AppError>> {
    // TODO: Rewrite with validations and attribute uniqueness
    const result = await this.col.updateOne(
      {
        _id: id,
        version: categoryVersion,
        'attributes.key': {
          $ne: payload.key
        }
      },
      { $push: { attributes: payload } }
    );
    if (result.modifiedCount != 1) {
      return Err(new AppError(ErrorCode.BAD_REQUEST, `Can't create attribute [${payload.key}]`));
    }
    return new Ok(payload);
  }
}
