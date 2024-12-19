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
import { ActionsRunner, type ActionHandlersList } from '@ecomm/ActionsRunner';
import { type IProductRepository } from './product.repo';
import { type Config } from '@ecomm/Config';
import NodeCache from 'node-cache';
import { Queues } from '@ecomm/Queues';
import { type IAuditLogService, AuditLogService } from '@ecomm/AuditLog';
import { FastifyInstance } from 'fastify';
import { Event, Command } from '@ecomm/EventStore';
import {
  CreateProduct,
  ProductCommandTypes,
  ProductCreated,
  ProductEventTypes,
  ProductNameUpdated,
  UpdateProductName,
} from './product.events';

// SERVICE INTERFACE
export interface IProductService {
  create: (command: CreateProduct) => Promise<Result<ProductCreated, AppError>>;
  update: (
    command: UpdateProductName,
  ) => Promise<Result<ProductNameUpdated, AppError>>;
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
  findProductByIdEventStore: (
    catalogId: string,
    id: string,
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
  private ENTITY = 'product';
  private TOPIC_CREATE: string;
  private TOPIC_UPDATE: string;
  private server: FastifyInstance;
  private static instance: IProductService;
  private repo: IProductRepository;
  private cols;
  private actionHandlers: ActionHandlersList;
  private actionsRunner: ActionsRunner<ProductDAO, IProductRepository>;
  private config: Config;
  private queues: Queues;
  private cartProductsCache;
  private cacheCartProducts;
  private auditLogService: IAuditLogService;
  private handle;

  private constructor(server: FastifyInstance) {
    this.server = server;
    this.repo = server.db.repo.productRepository as IProductRepository;
    this.cols = server.db.col.product;
    this.actionHandlers = {
      changeName: new ChangeNameActionHandler(server),
      changeDescription: new ChangeDescriptionActionHandler(server),
      changeKeywords: new ChangeKeywordsActionHandler(server),
    };
    this.auditLogService = AuditLogService.getInstance(server);
    this.actionsRunner = new ActionsRunner<ProductDAO, IProductRepository>();
    this.config = server.config;
    this.queues = server.queues;
    this.cacheCartProducts = server.config.CACHE_CART_PRODUCTS;
    this.cartProductsCache = new NodeCache({
      useClones: false,
      stdTTL: 60 * 60,
      checkperiod: 60,
    });
    this.TOPIC_CREATE = `global.${this.ENTITY}.${server.config.TOPIC_CREATE_SUFIX}`;
    this.TOPIC_UPDATE = `global.${this.ENTITY}.${server.config.TOPIC_UPDATE_SUFIX}`;
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
    console.log('p.create');
    console.dir(command, { depth: 15 });
    return new Ok({
      type: ProductEventTypes.PRODUCT_CREATED,
      data: command.data,
      metadata: command.metadata,
    } as ProductCreated);
  };

  public update = async (
    command: UpdateProductName,
  ): Promise<Result<ProductNameUpdated, AppError>> => {
    console.log('p.updateName');
    console.dir(command, { depth: 15 });
    // TODO: Validate Name
    return new Ok({
      type: ProductEventTypes.PRODUCT_NAME_UPDATED,
      data: command.data,
      metadata: command.metadata,
    } as ProductNameUpdated);
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
        entity: this.ENTITY,
      },
    });
    // Publish to Event Sourcing
    // this.queues.publish('es.create', {
    //   source: { id, catalogId, ...payload },
    //   metadata: {
    //     catalogId,
    //     type: 'entityCreated',
    //     entity: this.ENTITY,
    //   },
    // });

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
    const update = Value.Clone(actionRunnerResults.val.update);
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
          entity: this.ENTITY,
        },
      });
      // Publish to Event Sourcing
      // this.queues.publish('es.update', {
      //   source: { id: entity._id, catalogId, version: entity.version },
      //   update,
      //   metadata: {
      //     catalogId,
      //     type: 'entityUpdated',
      //     entity: this.ENTITY,
      //   },
      // });
      // Send side effects via messagging
      actionRunnerResults.val.sideEffects?.forEach((sideEffect: any) => {
        this.queues.publish(sideEffect.action, {
          ...sideEffect.data,
          metadata: {
            catalogId,
            type: sideEffect.action,
            entity: this.ENTITY,
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
    id: string,
    materialized = false,
  ): Promise<Result<Product, AppError>> {
    if (!!materialized === false) {
      const result = await this.repo.findOne(catalogId, id);
      if (result.err) return result;
      return new Ok(toEntity(result.val));
    } else {
      const result = await this.repo.aggregate(catalogId, [
        { $match: { _id: id } },
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
            'variants.catalog': 0,
            'variants.projectId': 0,
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

  public async findProductByIdEventStore(
    catalogId: string,
    id: string,
  ): Promise<Result<Product, AppError>> {
    const result = await this.auditLogService.findAuditLogs({
      catalogId,
      entityId: id,
    });
    if (result.err) return result;
    if (result.val.length === 0)
      return new Err(new AppError(ErrorCode.NOT_FOUND));
    if (!result.val[0].source)
      return new Err(new AppError(ErrorCode.UNPROCESSABLE_ENTITY, 'No source'));
    const entity = result.val.slice(1).reduce((acc: any, event: any) => {
      return Value.Patch(acc, event.edits);
    }, result.val[0].source);
    return new Ok(entity);
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
