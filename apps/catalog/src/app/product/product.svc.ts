import { type Result, Ok, Err } from 'ts-results';
import { AppError, ErrorCode } from '@ecomm/AppError';
import { Value } from '@sinclair/typebox/value';
import { nanoid } from 'nanoid';
import { type Product, UpdateProductAction, ProductType } from './product';
import { type CartProduct } from '../cart/cart';
import { type CreateProductBody } from './product.schemas';
import { type ProductDAO } from './product.dao.schema';
import { ChangeNameActionHandler } from '../lib/actions/changeName.handler';
import { ChangeDescriptionActionHandler } from '../lib/actions/changeDescription.handler';
import { ChangeKeywordsActionHandler } from '../lib/actions/changeKeywords.handler';
import {
  ActionsRunner,
  ActionsRunner2,
  type ActionHandlersList,
} from '@ecomm/ActionsRunner';
import { ProductRepository, type IProductRepository } from './product.repo';
import NodeCache from 'node-cache';
import { Queues } from '@ecomm/Queues';
import { FastifyInstance } from 'fastify';
import {
  ProductEventTypes,
  CreateProduct,
  ProductCreated,
  UpdateProduct,
  ProductUpdated,
  ProductEvent,
  PRODUCT_ENTITY_NAME,
  toProductStreamName,
} from './product.events';
import { RecordedEvent } from '@ecomm/EventStore';

// SERVICE INTERFACE
export interface IProductService {
  create: (command: CreateProduct) => Promise<Result<ProductCreated, AppError>>;
  update: (command: UpdateProduct) => Promise<Result<ProductUpdated, AppError>>;
  aggregate: (
    currentState: Product,
    event: RecordedEvent<ProductEvent>,
  ) => Promise<Result<{ entity: Product; update?: any }, AppError>>;
  createProduct: (
    catalogId: string,
    payload: CreateProductBody,
  ) => Promise<Result<Product, AppError>>;
  updateProduct: (
    catalogId: string,
    id: string,
    version: number,
    actions: any,
  ) => Promise<Result<Product, AppError>>;
  findProductById: (
    catalogId: string,
    id: string,
    materialized: boolean,
  ) => Promise<Result<Product, AppError>>;
  findProducts: (
    catalogId: string,
    query: any,
    options: any,
  ) => Promise<Result<Product[], AppError>>;
  cartProducById: (
    catalogId: string,
    ids: string[],
    locale: string,
  ) => Promise<Result<CartProduct[], AppError>>;
}

export const toEntity = ({ _id, ...remainder }: ProductDAO): Product => ({
  id: _id,
  ...remainder,
});

// SERVICE IMPLEMENTATION
export class ProductService implements IProductService {
  // private ENTITY = 'product';
  private TOPIC_CREATE: string;
  private TOPIC_UPDATE: string;
  private server: FastifyInstance;
  private static instance: IProductService;
  private repo: IProductRepository;
  private cols;
  private actionHandlers: ActionHandlersList;
  private actionsRunner: ActionsRunner<ProductDAO, IProductRepository>;
  private actionsRunner2: ActionsRunner2<Product, IProductRepository>;
  private queues: Queues;
  private cartProductsCache;
  private cacheCartProducts;

  private constructor(server: FastifyInstance) {
    this.server = server;
    this.repo = new ProductRepository(server);
    this.cols = server.db.col.product;
    this.actionHandlers = {
      changeName: new ChangeNameActionHandler(server),
      changeDescription: new ChangeDescriptionActionHandler(server),
      changeKeywords: new ChangeKeywordsActionHandler(server),
    };
    this.actionsRunner = new ActionsRunner<ProductDAO, IProductRepository>();
    this.actionsRunner2 = new ActionsRunner2<Product, IProductRepository>();
    this.queues = server.queues;
    this.cacheCartProducts = server.config.CACHE_CART_PRODUCTS;
    this.cartProductsCache = new NodeCache({
      useClones: false,
      stdTTL: 60 * 60,
      checkperiod: 60,
    });
    this.TOPIC_CREATE = `global.${PRODUCT_ENTITY_NAME}.${server.config.TOPIC_CREATE_SUFIX}`;
    this.TOPIC_UPDATE = `global.${PRODUCT_ENTITY_NAME}.${server.config.TOPIC_UPDATE_SUFIX}`;
  }

  public static getInstance(server: any): IProductService {
    if (!ProductService.instance) {
      ProductService.instance = new ProductService(server);
    }
    return ProductService.instance;
  }

  public create = async (
    command: CreateProduct,
  ): Promise<Result<ProductCreated, AppError>> => {
    const { id, ...remainder } = command.metadata;
    if (command.data.product.parent)
      command.data.product.type = ProductType.VARIANT;

    return new Ok({
      type: ProductEventTypes.PRODUCT_CREATED,
      data: { product: { id, ...command.data.product } },
      metadata: { entity: PRODUCT_ENTITY_NAME, ...remainder },
    } as ProductCreated);
  };

  public update = async (
    command: UpdateProduct,
  ): Promise<Result<ProductUpdated, AppError>> => {
    // TODO? Process Actions

    const aggregateResult = await this.server.es.aggregateStream<
      Product,
      ProductEvent
    >(toProductStreamName(command.data.productId), this.aggregate);
    if (!aggregateResult.ok) return aggregateResult;

    const expectedResult = await this.aggregate(aggregateResult.val, {
      id: '',
      streamName: '',
      version: 0,
      projectId: '',
      isLastEvent: false,
      requestId: '',
      type: ProductEventTypes.PRODUCT_UPDATED,
      data: command.data,
      metadata: {
        entity: PRODUCT_ENTITY_NAME,
        version: command.metadata.expectedVersion,
        ...command.metadata,
      },
      createdAt: new Date(),
      lastModifiedAt: new Date(),
    });
    if (!expectedResult.ok) return expectedResult;

    return new Ok({
      type: ProductEventTypes.PRODUCT_UPDATED,
      data: command.data,
      metadata: {
        entity: PRODUCT_ENTITY_NAME,
        expected: expectedResult.val.entity,
        ...command.metadata,
      },
    } as ProductUpdated);
  };

  // FIXME use ActionsRunner, not ActionsRunner2
  public aggregate = async (
    currentState: Product,
    event: RecordedEvent<ProductEvent>,
  ): Promise<Result<{ entity: Product; update?: any }, AppError>> => {
    const e = event as ProductEvent;
    switch (e.type) {
      case ProductEventTypes.PRODUCT_CREATED: {
        if (currentState)
          return new Err(
            new AppError(
              ErrorCode.UNPROCESSABLE_ENTITY,
              'Entity already exists',
            ),
          );
        return new Ok({
          entity: Object.assign(e.data.product, {
            catalogId: e.metadata.catalogId,
            version: e.metadata.version,
            createdAt: event.createdAt,
          }),
        });
      }

      case ProductEventTypes.PRODUCT_UPDATED: {
        if (!currentState)
          return new Err(
            new AppError(ErrorCode.UNPROCESSABLE_ENTITY, 'Empty entity'),
          );
        // Execute actions
        const toUpdateEntity = Value.Clone(currentState);
        const actionRunnerResults = await this.actionsRunner2.run(
          currentState,
          toUpdateEntity,
          this.repo,
          this.actionHandlers,
          e.data.actions,
        );
        if (actionRunnerResults.err) return actionRunnerResults;

        return new Ok({
          entity: Object.assign(toUpdateEntity, {
            catalogId: e.metadata.catalogId,
            version: e.metadata.version,
            lastModifiedAt: event.createdAt,
          }),
          update: actionRunnerResults.val.update,
        });
      }

      default: {
        return new Err(
          new AppError(
            ErrorCode.UNPROCESSABLE_ENTITY,
            `Unknown event type: ${(e as any).type}`,
          ),
        );
      }
    }
  };

  // CREATE PRODUCT
  public async createProduct(
    catalogId: string,
    payload: CreateProductBody,
  ): Promise<Result<Product, AppError>> {
    // Save the entity
    const id = nanoid();
    const result = await this.repo.create(catalogId, {
      id,
      ...payload,
    } as Product);
    if (result.err) return result;
    // Send new entity via messagging
    this.queues.publish(this.TOPIC_CREATE, {
      source: toEntity(result.val),
      metadata: {
        catalogId,
        type: 'entityCreated',
        entity: PRODUCT_ENTITY_NAME,
      },
    });
    // Return new entity
    return new Ok(toEntity(result.val));
  }

  // UPDATE PRODUCT
  public async updateProduct(
    catalogId: string,
    id: string,
    version: number,
    actions: UpdateProductAction[],
  ): Promise<Result<Product, AppError>> {
    // Find the Entity
    const result = await this.repo.findOne(catalogId, id, version);
    if (result.err) return result;
    const entity: ProductDAO = result.val;
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
    // const update = Value.Clone(actionRunnerResults.val.update);
    // Compute difference, and save if needed
    const difference = Value.Diff(entity, toUpdateEntity);
    if (difference.length > 0) {
      // Save the entity
      const saveResult = await this.repo.updateOne(
        catalogId,
        id,
        version,
        actionRunnerResults.val.update,
      );
      if (saveResult.err) return saveResult;
      toUpdateEntity.version = version + 1;
      // Send differences via messagging
      this.queues.publish(this.TOPIC_UPDATE, {
        source: { id: result.val._id },
        difference,
        metadata: {
          catalogId,
          type: 'entityUpdated',
          entity: PRODUCT_ENTITY_NAME,
        },
      });
      // Send side effects via messagging
      actionRunnerResults.val.sideEffects?.forEach((sideEffect: any) => {
        this.queues.publish(sideEffect.action, {
          ...sideEffect.data,
          metadata: {
            catalogId,
            type: sideEffect.action,
            entity: PRODUCT_ENTITY_NAME,
          },
        });
      });
    }
    // Return updated entity
    return Ok(toEntity(toUpdateEntity));
  }

  // FIND PRODUCT BY ID
  public async findProductById(
    catalogId: string,
    productId: string,
    materialized = false,
  ): Promise<Result<Product, AppError>> {
    if (!!materialized === false) {
      const result = await this.repo.findOne(catalogId, productId);
      if (result.err) return result;
      return new Ok(toEntity(result.val));
    } else {
      // FIXME use right col names
      const result = await this.repo.aggregate(catalogId, [
        { $match: { _id: productId } },
        {
          $lookup: {
            from: this.cols[catalogId].collectionName,
            localField: '_id',
            foreignField: 'parent',
            as: 'variants',
          },
        },
        {
          $lookup: {
            from: this.cols[catalogId].collectionName,
            localField: 'parent',
            foreignField: '_id',
            as: 'base',
          },
        },
        {
          $project: {
            'variants.parent': 0,
            'variants.type': 0,
            'variants.catalogId': 0,
            'variants.createdAt': 0,
            'variants.lastModifiedAt': 0,
            'variants.version': 0,
          },
        },
      ]);
      if (result.err) return result;
      if (result.val.length === 0)
        return new Err(new AppError(ErrorCode.NOT_FOUND, 'Product not found'));
      const entity = result.val[0];
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

  public async findProducts(
    catalogId: string,
    query: any,
    options: any,
  ): Promise<Result<Product[], AppError>> {
    const result = await this.repo.find(catalogId, query, options);
    if (result.err) return result;
    return new Ok(result.val.map((entity) => toEntity(entity)));
  }

  private inheritFields(entity: any, locale?: string) {
    entity.inheritedFields = [];
    if (!entity.name) {
      entity.name = locale ? entity.base[0].name[locale] : entity.base[0].name;
      entity.inheritedFields.push('name');
    }
    if (!entity.description) {
      entity.description = locale
        ? entity.base[0].description[locale]
        : entity.base[0].description;
      entity.inheritedFields.push('description');
    }
    if (entity.base[0].searchKeywords) {
      entity.searchKeywords = entity.searchKeywords ?? {};
      Object.entries(entity.base[0].searchKeywords).forEach(
        ([key, value]: [string, any]) => {
          entity.searchKeywords[key] = (
            entity.searchKeywords[key] ?? []
          ).concat(...value);
        },
      );
      entity.searchKeywords = locale
        ? entity.searchKeywords[locale]
        : entity.searchKeywords;
      entity.inheritedFields.push('searchKeywords');
    }
    if (entity.base[0].categories.length > 0) {
      entity.categories = (entity.categories ?? []).concat(
        ...entity.base[0].categories,
      );
      entity.inheritedFields.push('categories');
    }
  }

  // CART PRODUCTS BY ID
  public async cartProducById(
    catalogId: string,
    ids: string[],
    locale: string,
  ): Promise<Result<CartProduct[], AppError>> {
    const cachedProducts = this.cartProductsCache.mget(ids);
    ids = ids.filter((id) => !cachedProducts[id]);
    if (ids.length !== 0) {
      const result = await this.repo.aggregate(catalogId, [
        {
          $match: {
            _id: { $in: ids },
          },
        },
        {
          $lookup: {
            from: this.cols[catalogId].collectionName,
            localField: 'parent',
            foreignField: '_id',
            as: 'base',
          },
        },
        {
          $project: {
            parent: 1,
            sku: 1,
            attributes: 1,
            'base.name': 1,
            'base.description': 1,
            'base.searchKeywords': 1,
            'base.categories': 1,
          },
        },
      ]);
      if (result.err) return result;
      if (result.val.length === 0)
        return new Err(new AppError(ErrorCode.NOT_FOUND, 'Product not found'));
      result.val.forEach((entity) => {
        entity.inheritedFields = [];
        this.inheritFields(entity, locale);
        delete entity.base;
        cachedProducts[entity._id] = entity;
        if (this.cacheCartProducts === true)
          this.cartProductsCache.set(entity._id, entity);
      });
    }
    return new Ok(
      Object.entries(cachedProducts).map(([key, value]: [string, any]) => {
        return {
          productId: value._id,
          sku: value.sku,
          name: value.name,
          categories: value.categories,
        };
      }),
    );
  }
}
