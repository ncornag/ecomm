import { type Result, Ok, Err } from 'ts-results-es';
import { Db, Collection } from 'mongodb';
import { ErrorCode, AppError } from '@ecomm/app-error';
import { type Promotion } from './promotion';
import { type PromotionDAO } from './promotion.dao.schema.ts';

export const getPromotionCollection = (db: Db): Collection<PromotionDAO> => {
  return db.collection<PromotionDAO>('Promotion');
};

export interface IPromotionRepository {
  create: (category: Promotion) => Promise<Result<PromotionDAO, AppError>>;
  save: (category: Promotion) => Promise<Result<PromotionDAO, AppError>>;
  updateOne: (id: string, categoryVersion: number, update: any) => Promise<Result<any, AppError>>;
  update: (filter: any, update: any) => Promise<Result<any, AppError>>;
  findOne: (id: string, version?: number) => Promise<Result<PromotionDAO, AppError>>;
  find: (query: any, options?: any) => Promise<Result<PromotionDAO[], AppError>>;
  aggregate: (pipeline: any[], options?: any) => Promise<Result<any[], AppError>>;
}

export class PromotionRepository implements IPromotionRepository {
  private col: Collection<PromotionDAO>;

  constructor(server: any) {
    this.col = server.db.col.promotion;
  }

  // CREATE PROMOTION
  async create(promotion: Promotion): Promise<Result<PromotionDAO, AppError>> {
    const { id: _id, ...data } = promotion;
    const promotionDAO = { _id, ...data };
    const result = await this.col.insertOne(promotionDAO);
    if (!result || result.insertedId == '')
      // TODO: Check if this is the correct way to check for succesul inserts
      return new Err(new AppError(ErrorCode.BAD_REQUEST, `Can't save promotion [${_id}]`));
    return new Ok(promotionDAO);
  }

  // SAVE PROMOTION
  async save(promotion: Promotion): Promise<Result<PromotionDAO, AppError>> {
    const { id: _id, ...data } = promotion;
    const promotionDAO = { _id, ...data };
    const version = promotionDAO.version!;
    const result = await this.col.updateOne({ _id }, { $set: promotionDAO });
    if (!result || result.modifiedCount != 1)
      return new Err(new AppError(ErrorCode.BAD_REQUEST, `Can't save promotion [${_id}]`));
    promotionDAO.version = version + 1;
    return new Ok(promotionDAO);
  }

  // UPDATE ONE PROMOTION
  async updateOne(id: string, promotionVersion: number, update: any): Promise<Result<any, AppError>> {
    const result = await this.col.updateOne(
      {
        _id: id,
        version: promotionVersion
      },
      update
    );
    if (result.modifiedCount != 1) return new Err(new AppError(ErrorCode.BAD_REQUEST, `Can't update promotion.`));
    return new Ok({});
  }

  // UPDATE MANY PROMOTIONS
  async update(filter: any, update: any): Promise<Result<any, AppError>> {
    const result = await this.col.updateMany(filter, update);
    // TODO Handle errors
    //if (result.ok != 1) return new Err(new AppError(ErrorCode.BAD_REQUEST, `Can't update promotions.`));
    return new Ok({});
  }

  // FIND ONE PROMOTION
  async findOne(id: string, version?: number): Promise<Result<PromotionDAO, AppError>> {
    const filter: any = { _id: id };
    if (version !== undefined) filter.version = version;
    const entity = await this.col.findOne(filter);
    if (!entity) {
      return new Err(new AppError(ErrorCode.BAD_REQUEST, `Can't find promotion with id [${id}]`));
    }
    return new Ok(entity);
  }

  // FIND MANY PROMOTIONS
  async find(query: any, options: any): Promise<Result<PromotionDAO[], AppError>> {
    // TODO: Add query limit
    const entities = await this.col.find(query, options).toArray();
    return new Ok(entities);
  }

  // AGGREGATE PROMOTIONS
  async aggregate(pipeline: any[], options: any): Promise<Result<any, AppError>> {
    const result: any[] = [];
    const cursor = this.col.aggregate(pipeline, options);
    for await (const doc of cursor) {
      result.push(doc);
    }
    return new Ok(result);
  }
}
