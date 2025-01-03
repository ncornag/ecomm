import { type Result, Ok } from 'ts-results-es';
import { AppError, AppErrorResult, ErrorCode } from '@ecomm/app-error';
import { Value } from '@sinclair/typebox/value';
import { type Product, ProductType } from './product.ts';
import { type ProductDAO } from './product.dao.schema.ts';
import { ChangeNameActionHandler } from '../lib/actions/changeName.handler.ts';
import { ChangeDescriptionActionHandler } from '../lib/actions/changeDescription.handler.ts';
import { ChangeKeywordsActionHandler } from '../lib/actions/changeKeywords.handler.ts';
import { ActionsRunner2, type ActionHandlersList } from '@ecomm/actions-runner';
import { ProductRepository, type IProductRepository } from './product.repo.ts';
import {
  ProductEventTypes,
  type CreateProduct,
  type ProductCreated,
  type UpdateProduct,
  type ProductUpdated,
  type ProductEvent,
  ENTITY_NAME,
  toStreamName
} from './product.events.ts';
import { type RecordedEvent, toRecordedEvent } from '@ecomm/event-store';
import { type FastifyInstance } from 'fastify';
import { projectId } from '@ecomm/request-context';
import { type CartProduct } from '../cart/cart.ts';
import NodeCache from 'node-cache';

// SERVICE INTERFACE
export interface IProductService {
  create: (command: CreateProduct) => Promise<Result<ProductCreated, AppError>>;
  update: (command: UpdateProduct) => Promise<Result<ProductUpdated, AppError>>;
  aggregate: (
    currentState: Product,
    event: RecordedEvent<ProductEvent>
  ) => Promise<Result<{ entity: Product; update?: any }, AppError>>;
  findProductById: (catalogId: string, id: string, materialized: boolean) => Promise<Result<Product, AppError>>;
  findProducts: (catalogId: string, query: any, options: any) => Promise<Result<Product[], AppError>>;
  cartProducById: (catalogId: string, ids: string[], locale: string) => Promise<Result<CartProduct[], AppError>>;
}

export const toEntity = ({ _id, ...remainder }: ProductDAO): Product => ({
  id: _id,
  ...remainder
});

// FIXME use ActionsRunner, not ActionsRunner2
// FIXME implement sideEffects

// SERVICE IMPLEMENTATION
export class ProductService implements IProductService {
  private server: FastifyInstance;
  private static instance: IProductService;
  private repo: IProductRepository;
  private actionHandlers: ActionHandlersList;
  private actionsRunner2: ActionsRunner2<Product, IProductRepository>;
  private cartProductsCache;
  private cacheCartProducts;

  private constructor(server: FastifyInstance) {
    this.server = server;
    this.repo = new ProductRepository(server);
    this.actionHandlers = {
      changeName: new ChangeNameActionHandler(server),
      changeDescription: new ChangeDescriptionActionHandler(server),
      changeKeywords: new ChangeKeywordsActionHandler(server)
    };
    this.actionsRunner2 = new ActionsRunner2<Product, IProductRepository>();
    this.cacheCartProducts = server.config.CACHE_CART_PRODUCTS;
    this.cartProductsCache = new NodeCache({
      useClones: false,
      stdTTL: 60 * 60,
      checkperiod: 60
    });
  }

  public static getInstance(server: any): IProductService {
    if (!ProductService.instance) {
      ProductService.instance = new ProductService(server);
    }
    return ProductService.instance;
  }

  // CREATE
  public create = async (command: CreateProduct): Promise<Result<ProductCreated, AppError>> => {
    const { id, ...remainder } = command.metadata;
    if (command.data.product.parent) command.data.product.type = ProductType.VARIANT;

    return new Ok({
      type: ProductEventTypes.CREATED,
      data: { product: { id, ...command.data.product } },
      metadata: { entity: ENTITY_NAME, ...remainder }
    } as ProductCreated);
  };

  // UPDATE
  public update = async (command: UpdateProduct): Promise<Result<ProductUpdated, AppError>> => {
    const aggregateResult = await this.server.es.aggregateStream<Product, ProductEvent>(
      command.metadata.projectId,
      toStreamName(command.data.productId),
      this.aggregate
    );
    if (aggregateResult.isErr()) return aggregateResult;

    const expectedResult = await this.aggregate(
      aggregateResult.value,
      toRecordedEvent(ProductEventTypes.UPDATED, ENTITY_NAME, command)
    );
    if (expectedResult.isErr()) return expectedResult;

    if (!Object.keys(expectedResult.value.update).length) {
      return new AppErrorResult(ErrorCode.NOT_MODIFIED);
    }

    return new Ok({
      type: ProductEventTypes.UPDATED,
      data: command.data,
      metadata: {
        entity: ENTITY_NAME,
        expected: expectedResult.value.entity,
        ...command.metadata
      }
    } as ProductUpdated);
  };

  // AGGREGATE
  public aggregate = async (
    currentState: Product,
    event: RecordedEvent<ProductEvent>
  ): Promise<Result<{ entity: Product; update?: any }, AppError>> => {
    const e = event as ProductEvent;
    switch (e.type) {
      case ProductEventTypes.CREATED: {
        if (currentState) return new AppErrorResult(ErrorCode.UNPROCESSABLE_ENTITY, 'Entity already exists');
        return new Ok({
          entity: Object.assign(e.data.product, {
            catalogId: e.metadata.catalogId,
            version: e.metadata.version,
            createdAt: event.createdAt
          })
        });
      }

      case ProductEventTypes.UPDATED: {
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
  public async findProductById(
    catalogId: string,
    productId: string,
    materialized = false
  ): Promise<Result<Product, AppError>> {
    if (!!materialized === false) {
      const result = await this.repo.findOne(catalogId, productId);
      if (result.isErr()) return result;
      return new Ok(toEntity(result.value));
    } else {
      const collectionName = this.server.db.getCol(projectId(), ENTITY_NAME, catalogId).collectionName;
      // FIXME use right col names

      const result = await this.repo.aggregate(catalogId, [
        { $match: { _id: productId } },
        {
          $lookup: {
            from: collectionName,
            localField: '_id',
            foreignField: 'parent',
            as: 'variants'
          }
        },
        {
          $lookup: {
            from: collectionName,
            localField: 'parent',
            foreignField: '_id',
            as: 'base'
          }
        },
        {
          $project: {
            'variants.parent': 0,
            'variants.type': 0,
            'variants.catalogId': 0,
            'variants.createdAt': 0,
            'variants.lastModifiedAt': 0,
            'variants.version': 0
          }
        }
      ]);
      if (result.isErr()) return result;
      if (result.value.length === 0) return new AppErrorResult(ErrorCode.NOT_FOUND, 'Product not found');
      const entity = result.value[0];
      if (entity.type === ProductType.BASE) {
        delete entity.base;
      } else if (entity.type === ProductType.VARIANT) {
        entity.inheritedFields = [];
        this.inheritFields(entity, undefined);
        delete entity.base;
        delete entity.variants;
      }
      return new Ok(toEntity(entity));
    }
  }

  public async findProducts(catalogId: string, query: any, options: any): Promise<Result<Product[], AppError>> {
    const result = await this.repo.find(catalogId, query, options);
    if (result.isErr()) return result;
    return new Ok(result.value.map((entity) => toEntity(entity)));
  }

  private inheritFields(entity: any, locale?: string) {
    entity.inheritedFields = [];
    if (!entity.name) {
      entity.name = locale ? entity.base[0].name[locale] : entity.base[0].name;
      entity.inheritedFields.push('name');
    }
    if (!entity.description) {
      entity.description = locale ? entity.base[0].description[locale] : entity.base[0].description;
      entity.inheritedFields.push('description');
    }
    if (entity.base[0].searchKeywords) {
      entity.searchKeywords = entity.searchKeywords ?? {};
      Object.entries(entity.base[0].searchKeywords).forEach(([key, value]: [string, any]) => {
        entity.searchKeywords[key] = (entity.searchKeywords[key] ?? []).concat(...value);
      });
      entity.searchKeywords = locale ? entity.searchKeywords[locale] : entity.searchKeywords;
      entity.inheritedFields.push('searchKeywords');
    }
    if (entity.base[0].categories.length > 0) {
      entity.categories = (entity.categories ?? []).concat(...entity.base[0].categories);
      entity.inheritedFields.push('categories');
    }
  }

  // CART PRODUCTS BY ID
  public async cartProducById(
    catalogId: string,
    ids: string[],
    locale: string
  ): Promise<Result<CartProduct[], AppError>> {
    const cachedProducts = this.cartProductsCache.mget(ids);
    ids = ids.filter((id) => !cachedProducts[id]);
    if (ids.length !== 0) {
      const collectionName = this.server.db.getCol(projectId(), ENTITY_NAME, catalogId).collectionName;
      const result = await this.repo.aggregate(catalogId, [
        {
          $match: {
            _id: { $in: ids }
          }
        },
        {
          $lookup: {
            from: collectionName,
            localField: 'parent',
            foreignField: '_id',
            as: 'base'
          }
        },
        {
          $project: {
            parent: 1,
            sku: 1,
            attributes: 1,
            'base.name': 1,
            'base.description': 1,
            'base.searchKeywords': 1,
            'base.categories': 1
          }
        }
      ]);
      if (result.isErr()) return result;
      if (result.value.length === 0) return new AppErrorResult(ErrorCode.NOT_FOUND, 'Product not found');
      result.value.forEach((entity) => {
        entity.inheritedFields = [];
        this.inheritFields(entity, locale);
        delete entity.base;
        cachedProducts[entity._id] = entity;
        if (this.cacheCartProducts === true) this.cartProductsCache.set(entity._id, entity);
      });
    }
    return new Ok(
      Object.entries(cachedProducts).map(([key, value]: [string, any]) => {
        return {
          productId: value._id,
          sku: value.sku,
          name: value.name,
          categories: value.categories
        };
      })
    );
  }
}
