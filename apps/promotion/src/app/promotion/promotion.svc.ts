import { type Result, Ok } from 'ts-results';
import { AppError } from '@ecomm/AppError';
import { Value } from '@sinclair/typebox/value';
import { nanoid } from 'nanoid';
import { type Promotion, UpdatePromotionAction } from './promotion';
import { type CreatePromotionBody } from './promotion.schemas';
import { type PromotionDAO } from './promotion.dao.schema';
import { type IPromotionRepository } from './promotion.repo';
import { ActionsRunner, type ActionHandlersList } from '@ecomm/ActionsRunner';
import { ChangeNameActionHandler } from '../lib/actions/changeName.handler';
import { type Config } from '@ecomm/Config';
import { green, magenta } from 'kolorist';
import { CT } from '@ecomm/CT';
import { Queues } from '@ecomm/Queues';
import { PromotionsEngine } from './promotionsEngine/engine';
import { FastifyInstance } from 'fastify';

class CTAdapter {
  private server;
  private ct: CT;
  private Customer = { customerGroup: 'VIP' };
  private Categories = new Map<string, string>([
    ['SKU1', 'shoes'],
    ['SKU2', 'trainers'],
    ['SKU3', 'shirts'],
    ['SKU4', 'shirts'],
  ]);

  constructor(server: any) {
    this.server = server;
    // Create apiRoot from the imported ClientBuilder and include your Project key
    this.ct = new CT(this.server);
  }

  convertCart(cart: any) {
    const products = cart.lineItems.map((lineItem: any) => ({
      id: lineItem.productId,
      sku: lineItem.variant.sku,
      centAmount: lineItem.price.value.centAmount,
      quantity: lineItem.quantity,
      categories: [this.Categories.get(lineItem.variant.sku)],
    }));
    return {
      customer: this.Customer,
      products,
      total: cart.totalPrice.centAmount,
    };
  }

  // Fetch a commercetools Cart by ID
  async getCart(cartId: string) {
    const start = process.hrtime.bigint();

    const query = `query Cart {
                      cart(id: "${cartId}") {
                          id
                          lineItems {
                            id
                            productId,
                            variant { sku }
                            price{ value { centAmount } }
                            quantity
                          }
                          totalPrice {centAmount}
                      }
                  }`;

    const cart = await this.ct.api
      .graphql()
      .post({ body: { query } })
      .execute()
      .then((response: any) => response.body.data.cart);

    // const cart = await this.ct
    //   .carts()
    //   .withId({ ID: cartId })
    //   .get()
    //   .execute()
    //   .then((response: any) => response.body);

    const end = process.hrtime.bigint();
    const diff = (Number(end - start) / 1000000).toFixed(3);
    console.log(`${green('Get cart took')} ${magenta(diff)}ms`);
    return cart;
  }

  // Add a customline for each type=lineDiscount
  async addDiscounts(cart: any, discounts: any[]) {
    let count = 1;
    return await this.ct.api
      .carts()
      .withId({ ID: cart.id })
      .post({
        body: {
          version: cart.version,
          actions: cart.customLineItems
            .map((customLineItem: any) => ({
              action: 'removeCustomLineItem',
              customLineItemId: customLineItem.id,
            }))
            .concat(
              discounts.map((discount: any) => ({
                action: 'addCustomLineItem',
                name: {
                  en: `Discount [${discount.promotionId}] for ${discount.sku ? discount.sku : 'order'}`,
                },
                quantity: 1,
                money: {
                  currencyCode: 'EUR',
                  centAmount: discount.centAmount,
                },
                slug: `discount-${discount.sku ? discount.sku : 'order'}-${count++}`,
                taxCategory: {
                  typeId: 'tax-category',
                  id: '42e4dd43-da43-4c7a-b0df-e660eb527c05',
                },
                priceMode: 'External',
              })),
            ),
        },
      })
      .execute()
      .then((r) => r.body)
      .catch((e) => e.body);
  }
}

// SERVICE INTERFACE
export interface IPromotionService {
  createPromotion: (
    payload: CreatePromotionBody,
  ) => Promise<Result<Promotion, AppError>>;
  updatePromotion: (
    id: string,
    version: number,
    actions: any,
  ) => Promise<Result<Promotion, AppError>>;
  findPromotionById: (id: string) => Promise<Result<Promotion, AppError>>;
  find: (query: any, options?: any) => Promise<Result<Promotion[], AppError>>;
  savePromotion: (category: Promotion) => Promise<Result<Promotion, AppError>>;
  calculate: (
    cartId: string,
    facts: any,
    promotionId: string,
  ) => Promise<Result<any, AppError>>;
}

const toEntity = ({ _id, ...remainder }: PromotionDAO): Promotion => ({
  id: _id,
  ...remainder,
});

// SERVICE IMPLEMENTATION
export class PromotionService implements IPromotionService {
  private ENTITY = 'promotion';
  private TOPIC_CREATE: string;
  private TOPIC_UPDATE: string;
  private static instance: IPromotionService;
  private repo: IPromotionRepository;
  private actionHandlers: ActionHandlersList;
  private actionsRunner: ActionsRunner<PromotionDAO, IPromotionRepository>;
  private config: Config;
  private queues: Queues;
  private server: FastifyInstance;
  private ctAdapter: CTAdapter;
  private promotionsEngine: PromotionsEngine;

  private constructor(server: any) {
    this.server = server;
    this.repo = server.db.repo.promotionRepository as IPromotionRepository;
    this.actionHandlers = {
      changeName: new ChangeNameActionHandler(server),
    };
    this.actionsRunner = new ActionsRunner<
      PromotionDAO,
      IPromotionRepository
    >();
    this.config = server.config;
    this.queues = server.queues;
    this.ctAdapter = new CTAdapter(server);
    this.promotionsEngine = new PromotionsEngine(server);
    this.TOPIC_CREATE = `global.${this.ENTITY}.${server.config.TOPIC_CREATE_SUFIX}`;
    this.TOPIC_UPDATE = `global.${this.ENTITY}.${server.config.TOPIC_UPDATE_SUFIX}`;
  }

  public static getInstance(server: any): IPromotionService {
    if (!PromotionService.instance) {
      PromotionService.instance = new PromotionService(server);
    }
    return PromotionService.instance;
  }

  // CREATE PROMOTION
  public async createPromotion(
    payload: CreatePromotionBody,
  ): Promise<Result<Promotion, AppError>> {
    // Save the entity
    const result = await this.repo.create({
      id: nanoid(),
      ...payload,
    });
    if (result.err) return result;
    // Send new entity via messagging
    this.queues.publish(this.TOPIC_CREATE, {
      source: toEntity(result.val),
      metadata: {
        type: 'entityCreated',
        entity: this.ENTITY,
      },
    });
    return new Ok(toEntity(result.val));
  }

  // UPDATE PROMOTION
  public async updatePromotion(
    id: string,
    version: number,
    actions: UpdatePromotionAction[],
  ): Promise<Result<Promotion, AppError>> {
    // Find the Entity
    const result = await this.repo.findOne(id, version);
    if (result.err) return result;
    const entity: PromotionDAO = result.val;
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
    // Compute difference, and save if needed
    const difference = Value.Diff(entity, toUpdateEntity);
    if (difference.length > 0) {
      // Save the entity
      const saveResult = await this.repo.updateOne(
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
          type: 'entityUpdated',
          entity: this.ENTITY,
        },
      });
      // Send side effects via messagging
      actionRunnerResults.val.sideEffects?.forEach((sideEffect: any) => {
        this.queues.publish(sideEffect.action, {
          ...sideEffect.data,
          metadata: {
            type: sideEffect.action,
            entity: this.ENTITY,
          },
        });
      });
    }
    // Return udated entity
    return Ok(toEntity(toUpdateEntity));
  }

  // FIND PROMOTION
  public async findPromotionById(
    id: string,
  ): Promise<Result<Promotion, AppError>> {
    const result = await this.repo.findOne(id);
    if (result.err) return result;
    return new Ok(toEntity(result.val));
  }

  // FIND MANY PROMOTIONS
  async find(query: any, options: any): Promise<Result<Promotion[], AppError>> {
    const result = await this.repo.find(query, options);
    if (result.err) return result;
    return new Ok(result.val.map((e: PromotionDAO) => toEntity(e)));
  }

  // SAVE PROMOTION
  public async savePromotion(
    category: Promotion,
  ): Promise<Result<Promotion, AppError>> {
    const result = await this.repo.save(category);
    if (result.err) return result;
    return new Ok(toEntity(result.val));
  }

  // CALCULATE PROMOTIONS
  public async calculate(
    cartId: string,
    facts: any,
    promotionId: string,
  ): Promise<Result<any, AppError>> {
    //console.log('Calculating promotions for', cartId ? cartId : '[body data]');
    let cart: any;
    if (cartId) {
      cart = await this.ctAdapter.getCart(cartId);
      facts = this.ctAdapter.convertCart(cart);
      //console.log(facts);
    } else {
      facts.total = facts.items.reduce(
        (acc: number, item: any) => acc + item.centAmount * item.quantity,
        0,
      ); // Added for quick testing
    }
    const result = await this.promotionsEngine.run(facts, promotionId);
    if (result.err) return result;
    // console.log(result.val);
    // if (cartId) {
    //   const discountsResult = await this.ctAdapter.addDiscounts(cart, result.val);
    //   if (discountsResult.errors)
    //     return new Err(new AppError(ErrorCode.BAD_REQUEST, discountsResult.errors[0].message));
    // }
    return Ok(result.val);
  }
}
