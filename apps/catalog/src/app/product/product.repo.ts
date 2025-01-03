import { type Result, Ok, Err } from 'ts-results-es';
import { Db, Collection } from 'mongodb';
import { ErrorCode, AppError } from '@ecomm/app-error';
import { type Product, ProductType } from './product.ts';
import { type ProductDAO } from './product.dao.schema.ts';
import { type FastifyInstance } from 'fastify';
import { projectId } from '@ecomm/request-context';

export interface IProductRepository {
  create: (catalogId: string, category: Product) => Promise<Result<ProductDAO, AppError>>;
  save: (catalogId: string, category: Product) => Promise<Result<ProductDAO, AppError>>;
  updateOne: (catalogId: string, id: string, categoryVersion: number, update: any) => Promise<Result<any, AppError>>;
  update: (catalogId: string, filter: any, update: any) => Promise<Result<any, AppError>>;
  findOne: (catalogId: string, id: string, version?: number) => Promise<Result<ProductDAO, AppError>>;
  find: (catalogId: string, query: any, options?: any) => Promise<Result<ProductDAO[], AppError>>;
  aggregate: (catalogId: string, pipeline: any[], options?: any) => Promise<Result<any[], AppError>>;
}

export class ProductRepository implements IProductRepository {
  private ENTITY = 'product';
  private server: FastifyInstance;
  private col: Record<string, Collection<ProductDAO>>;

  constructor(server: any) {
    this.server = server;
    this.col = server.db.col.product;
  }

  // CREATE
  async create(catalogId: string, product: Product): Promise<Result<ProductDAO, AppError>> {
    const { id: _id, ...data } = product;
    const productDAO = { _id, ...data, catalogId };
    if (productDAO.parent) productDAO.type = ProductType.VARIANT;
    const catAwareCol = this.col[catalogId];
    const result = await catAwareCol.insertOne(productDAO);
    if (!result || result.insertedId == '') {
      // TODO: Check if this is the correct way to check for succesul inserts
      return new Err(new AppError(ErrorCode.BAD_REQUEST, `Can't save product [${_id}]`));
    }
    return new Ok(productDAO);
  }

  // SAVE
  async save(catalogId: string, product: Product): Promise<Result<ProductDAO, AppError>> {
    const { id: _id, ...data } = product;
    const productDAO = { _id, ...data };
    const catAwareCol = this.col[catalogId];
    product.catalogId = catalogId;
    const version = productDAO.version!;
    const result = await catAwareCol.updateOne({ _id }, { $set: productDAO });
    if (!result || result.modifiedCount != 1)
      return new Err(new AppError(ErrorCode.BAD_REQUEST, `Can't save product [${_id}]`));
    productDAO.version = version + 1;
    return new Ok(productDAO);
  }

  // UPDATE ONE
  async updateOne(catalogId: string, id: string, productVersion: number, update: any): Promise<Result<any, AppError>> {
    const catAwareCol = this.col[catalogId];
    const result = await catAwareCol.updateOne(
      {
        _id: id,
        version: productVersion
      },
      update
    );
    if (result.modifiedCount != 1) return new Err(new AppError(ErrorCode.BAD_REQUEST, `Can't update product.`));
    return new Ok({});
  }

  // UPDATE MANY
  async update(catalogId: string, filter: any, update: any): Promise<Result<any, AppError>> {
    const catAwareCol = this.col[catalogId];
    const result = await catAwareCol.updateMany(filter, update);
    // TODO Handle errors
    //if (result.ok != 1) return new Err(new AppError(ErrorCode.BAD_REQUEST, `Can't update categories.`));
    return new Ok({});
  }

  // FIND ONE
  async findOne(catalogId: string, productId: string, version?: number): Promise<Result<ProductDAO, AppError>> {
    const col = this.server.db.getCol(projectId(), this.ENTITY, catalogId);
    const filter: any = { _id: productId };
    if (version !== undefined) filter.version = version;
    const entity = await col.findOne<ProductDAO>(filter);
    if (!entity) {
      return new Err(new AppError(ErrorCode.BAD_REQUEST, `Can't find product with id [${productId}]`));
    }
    return new Ok(entity);
  }

  // FIND MANY
  async find(catalogId: string, query: any, options: any): Promise<Result<ProductDAO[], AppError>> {
    // TODO: Add query limit
    const col = this.server.db.getCol(projectId(), this.ENTITY, catalogId);
    const entities = await col.find<ProductDAO>(query, options).toArray();
    return new Ok(entities);
  }

  // AGGREGATE
  async aggregate(catalogId: string, pipeline: any[], options: any): Promise<Result<any, AppError>> {
    const col = this.server.db.getCol(projectId(), this.ENTITY, catalogId);
    const result: any[] = [];
    const cursor = col.aggregate(pipeline, options);
    for await (const doc of cursor) {
      result.push(doc);
    }
    return new Ok(result);
  }
}
