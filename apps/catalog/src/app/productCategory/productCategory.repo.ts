import { type Result, Ok, Err } from 'ts-results-es';
import { ErrorCode, AppError } from '@ecomm/app-error';
import { type ITreeRepo } from '../lib/tree.ts';
import { Db, Collection } from 'mongodb';
import { type ProductCategory } from './productCategory.ts';
import { type ProductCategoryDAO } from './productCategory.dao.schema.ts';
import { type FastifyInstance } from 'fastify';
import { projectId } from '@ecomm/request-context';

export interface IProductCategoryRepository {
  create: (category: ProductCategory) => Promise<Result<ProductCategoryDAO, AppError>>;
  save: (category: ProductCategory) => Promise<Result<ProductCategoryDAO, AppError>>;
  updateOne: (id: string, categoryVersion: number, update: any) => Promise<Result<any, AppError>>;
  update: (filter: any, update: any) => Promise<Result<any, AppError>>;
  findOne: (id: string, version?: number) => Promise<Result<ProductCategoryDAO, AppError>>;
  find: (query: any, options?: any) => Promise<Result<ProductCategoryDAO[], AppError>>;
  aggregate: (pipeline: any[], options?: any) => Promise<Result<any[], AppError>>;
}

// export const getProductCategoryCollection = (
//   db: Db,
// ): Collection<ProductCategoryDAO> => {
//   return db.collection<ProductCategoryDAO>('ProductCategory');
// };

export class ProductCategoryRepository implements IProductCategoryRepository, ITreeRepo<ProductCategoryDAO> {
  private ENTITY = 'productCategory.ts';
  private server: FastifyInstance;
  private col: Collection<ProductCategoryDAO>;

  constructor(server: any) {
    this.server = server;
    this.col = server.db.col.productCategory;
  }

  // CREATE CATEGORY
  async create(category: ProductCategory): Promise<Result<ProductCategoryDAO, AppError>> {
    const { id: _id, ...data } = category;
    const categoryDAO = { _id, ...data };
    const result = await this.col.insertOne(categoryDAO);
    if (!result || result.insertedId == '')
      // TODO: Check if this is the correct way to check for succesul inserts
      return new Err(new AppError(ErrorCode.BAD_REQUEST, `Can't save category [${_id}]`));
    return new Ok(categoryDAO);
  }

  // SAVE CATEGORY
  async save(category: ProductCategory): Promise<Result<ProductCategoryDAO, AppError>> {
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
    // TODO Handle errors
    //if (result.ok != 1) return new Err(new AppError(ErrorCode.BAD_REQUEST, `Can't update categories.`));
    return new Ok({});
  }

  // FIND ONE CATEGORY
  async findOne(productCategoryId: string, version?: number): Promise<Result<ProductCategoryDAO, AppError>> {
    const col = this.server.db.getCol(projectId(), this.ENTITY);
    const filter: any = { _id: productCategoryId };
    if (version !== undefined) filter.version = version;
    const entity = await col.findOne<ProductCategoryDAO>(filter);
    if (!entity) {
      return new Err(new AppError(ErrorCode.BAD_REQUEST, `Can't find category with id [${productCategoryId}]`));
    }
    return new Ok(entity);
  }

  // FIND MANY CATEGORIES
  async find(query: any, options: any): Promise<Result<ProductCategoryDAO[], AppError>> {
    // TODO: Add query limit
    const col = this.server.db.getCol(projectId(), this.ENTITY);
    const entities = await col.find<ProductCategoryDAO>(query, options).toArray();
    return new Ok(entities);
  }

  // AGGREGATE CATEGORIES
  async aggregate(pipeline: any[], options: any): Promise<Result<any, AppError>> {
    const col = this.server.db.getCol(projectId(), this.ENTITY);
    const result: any[] = [];
    const cursor = col.aggregate(pipeline, options);
    for await (const doc of cursor) {
      result.push(doc);
    }
    return new Ok(result);
  }
}
