import { type Result, Ok, Err } from 'ts-results';
import { ErrorCode, AppError } from '@ecomm/AppError';
import { type ITreeRepo } from '../lib/tree';
import { Db, Collection } from 'mongodb';
import { type ProductCategory } from '../entities/productCategory';
import { type ProductCategoryDAO } from './productCategory.dao.schema';

export interface IProductCategoryRepository {
  create: (
    category: ProductCategory,
  ) => Promise<Result<ProductCategoryDAO, AppError>>;
  save: (
    category: ProductCategory,
  ) => Promise<Result<ProductCategoryDAO, AppError>>;
  updateOne: (
    id: string,
    categoryVersion: number,
    update: any,
  ) => Promise<Result<any, AppError>>;
  update: (filter: any, update: any) => Promise<Result<any, AppError>>;
  findOne: (
    id: string,
    version?: number,
  ) => Promise<Result<ProductCategoryDAO, AppError>>;
  find: (
    query: any,
    options?: any,
  ) => Promise<Result<ProductCategoryDAO[], AppError>>;
  aggregate: (
    pipeline: any[],
    options?: any,
  ) => Promise<Result<any[], AppError>>;
}

export const getProductCategoryCollection = (
  db: Db,
): Collection<ProductCategoryDAO> => {
  return db.collection<ProductCategoryDAO>('ProductCategory');
};

export class ProductCategoryRepository
  implements IProductCategoryRepository, ITreeRepo<ProductCategoryDAO>
{
  private col: Collection<ProductCategoryDAO>;

  constructor(server: any) {
    this.col = server.db.col.productCategory;
  }

  // CREATE CATEGORY
  async create(
    category: ProductCategory,
  ): Promise<Result<ProductCategoryDAO, AppError>> {
    const { id: _id, ...data } = category;
    const categoryDAO = { _id, ...data };
    const result = await this.col.insertOne(categoryDAO);
    if (!result || result.insertedId == '')
      // TODO: Check if this is the correct way to check for succesul inserts
      return new Err(
        new AppError(ErrorCode.BAD_REQUEST, `Can't save category [${_id}]`),
      );
    return new Ok(categoryDAO);
  }

  // SAVE CATEGORY
  async save(
    category: ProductCategory,
  ): Promise<Result<ProductCategoryDAO, AppError>> {
    const { id: _id, ...data } = category;
    const categoryDAO = { _id, ...data };
    const version = categoryDAO.version!;
    const result = await this.col.updateOne({ _id }, { $set: categoryDAO });
    if (!result || result.modifiedCount != 1)
      return new Err(
        new AppError(ErrorCode.BAD_REQUEST, `Can't save category [${_id}]`),
      );
    categoryDAO.version = version + 1;
    return new Ok(categoryDAO);
  }

  // UPDATE ONE CATEGORY
  async updateOne(
    id: string,
    categoryVersion: number,
    update: any,
  ): Promise<Result<any, AppError>> {
    const result = await this.col.updateOne(
      {
        _id: id,
        version: categoryVersion,
      },
      update,
    );
    if (result.modifiedCount != 1)
      return new Err(
        new AppError(ErrorCode.BAD_REQUEST, `Can't update category.`),
      );
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
  async findOne(
    id: string,
    version?: number,
  ): Promise<Result<ProductCategoryDAO, AppError>> {
    const filter: any = { _id: id };
    if (version !== undefined) filter.version = version;
    const entity = await this.col.findOne(filter);
    if (!entity) {
      return new Err(
        new AppError(
          ErrorCode.BAD_REQUEST,
          `Can't find category with id [${id}]`,
        ),
      );
    }
    return new Ok(entity);
  }

  // FIND MANY CATEGORIES
  async find(
    query: any,
    options: any,
  ): Promise<Result<ProductCategoryDAO[], AppError>> {
    // TODO: Add query limit
    const entities = await this.col.find(query, options).toArray();
    return new Ok(entities);
  }

  // AGGREGATE CATEGORIES
  async aggregate(
    pipeline: any[],
    options: any,
  ): Promise<Result<any, AppError>> {
    const result: any[] = [];
    const cursor = this.col.aggregate(pipeline, options);
    for await (const doc of cursor) {
      result.push(doc);
    }
    return new Ok(result);
  }
}
