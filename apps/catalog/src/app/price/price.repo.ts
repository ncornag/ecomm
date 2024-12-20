import { type Result, Ok, Err } from 'ts-results';
import { Db, Collection } from 'mongodb';
import { ErrorCode, AppError } from '@ecomm/AppError';
import { type Price } from '../price/price';
import { type PriceDAO } from './price.dao.schema';

export const getPriceCollection = async (
  db: Db,
): Promise<Collection<PriceDAO> | Record<string, Collection<PriceDAO>>> => {
  const catalogDb = db.collection('Catalog');
  const catalogs = await catalogDb.find({}).toArray();
  return catalogs.reduce((acc: any, catalog: any) => {
    acc[catalog._id] = db.collection<PriceDAO>(`Prices${catalog.name}`);
    return acc;
  }, {});
};

export interface IPriceRepository {
  create: (
    catalogId: string,
    price: Price,
  ) => Promise<Result<PriceDAO, AppError>>;
  findOne: (
    catalogId: string,
    id: string,
    version?: number,
  ) => Promise<Result<PriceDAO, AppError>>;
  find: (
    catalogId: string,
    query: any,
    options?: any,
  ) => Promise<Result<PriceDAO[], AppError>>;
  aggregate: (
    catalogId: string,
    pipeline: any[],
    options?: any,
  ) => Promise<Result<any[], AppError>>;
}

export class PriceRepository implements IPriceRepository {
  private col: Record<string, Collection<PriceDAO>>;

  constructor(server: any) {
    this.col = server.db.col.price;
  }

  // CREATE
  async create(
    catalogId: string,
    price: Price,
  ): Promise<Result<PriceDAO, AppError>> {
    const { id: _id, ...data } = price;
    const priceDAO = { _id, ...data, catalogId };
    const catAwareCol = this.col[catalogId];
    const result = await catAwareCol.insertOne(priceDAO);
    if (!result || result.insertedId == '') {
      // TODO: Check if this is the correct way to check for succesul inserts
      return new Err(
        new AppError(ErrorCode.BAD_REQUEST, `Can't save price [${_id}]`),
      );
    }
    return new Ok(priceDAO);
  }

  // FIND ONE
  async findOne(
    catalogId: string,
    id: string,
    version?: number,
  ): Promise<Result<PriceDAO, AppError>> {
    const filter: any = { _id: id };
    if (version !== undefined) filter.version = version;
    const catAwareCol = this.col[catalogId];
    const entity = await catAwareCol.findOne(filter);
    if (!entity) {
      return new Err(
        new AppError(ErrorCode.BAD_REQUEST, `Can't find price with id [${id}]`),
      );
    }
    return new Ok(entity);
  }

  // FIND MANY
  async find(
    catalogId: string,
    query: any,
    options: any = {},
  ): Promise<Result<PriceDAO[], AppError>> {
    // TODO: Add query limit
    const catAwareCol = this.col[catalogId];
    const entities = await catAwareCol.find(query, options).toArray();
    return new Ok(entities);
  }

  // AGGREGATE
  async aggregate(
    catalogId: string,
    pipeline: any[],
    options: any,
  ): Promise<Result<any, AppError>> {
    const result: any[] = [];
    const catAwareCol = this.col[catalogId];
    const cursor = catAwareCol.aggregate(pipeline, options);
    for await (const doc of cursor) {
      result.push(doc);
    }

    return Ok(result);
  }
}
