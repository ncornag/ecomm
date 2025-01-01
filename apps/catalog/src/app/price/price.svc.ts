import { type Result, Ok, Err } from 'ts-results-es';
import { nanoid } from 'nanoid';
import { AppError, ErrorCode } from '@ecomm/app-error';
import { type Value, type Price } from './price.ts';
import { type PriceDAO } from './price.dao.schema.ts';
import { type IPriceRepository } from './price.repo.ts';
import { type Cart, type CartProduct } from '../cart/cart.ts';
import { type IProductService, ProductService } from '../product/product.svc.ts';
import { green, magenta } from 'kolorist';
import fetch from 'node-fetch';
import NodeCache from 'node-cache';
import { type CreatePriceBody } from './price.schemas.ts';
import { type Config } from '@ecomm/config';
import { type Queues } from '@ecomm/queues';
import { Expressions } from '@ecomm/expressions';
import { type FastifyInstance } from 'fastify';

// SERVICE INTERFACE
export interface IPriceService {
  createPrice: (catalogId: string, payload: CreatePriceBody) => Promise<Result<Price, AppError>>;
  getPricesForSKU: (catalogId: string, skus: [string]) => Promise<Result<Price[], AppError>>;
  findPriceById: (catalogId: string, id: string) => Promise<Result<Price, AppError>>;
  createCart: (data: any) => Promise<Result<any, AppError>>;
}

const toEntity = ({ _id, ...remainder }: PriceDAO): Price => ({
  id: _id,
  ...remainder
});

export const FieldPredicateOperators: any = {
  country: { operator: 'in', field: 'country', type: 'array' },
  customerGroup: {
    operator: 'in',
    field: 'customerGroup',
    type: 'array',
    typeId: 'customer-group'
  },
  channel: {
    operator: 'in',
    field: 'channel',
    type: 'array',
    typeId: 'channel'
  },
  validFrom: { operator: '>=', field: 'date', type: 'date' },
  validUntil: { operator: '<=', field: 'date', type: 'date' },
  minimumQuantity: { operator: '>=', field: 'quantity', type: 'number' }
};

export function createPredicateExpression(data: any) {
  const surroundByQuotes = (value: any) => (typeof value === 'string' ? `'${value}'` : value);
  const predicate = Object.entries(data).reduce((acc, [key, value]) => {
    if (acc) acc += ' and ';
    const op = FieldPredicateOperators[key] ? FieldPredicateOperators[key].operator : '=';
    const field = FieldPredicateOperators[key] ? FieldPredicateOperators[key].field : key;
    let val: any = value;
    if (op === 'in') {
      if (!Array.isArray(val)) val = [val];
      if (val.length > 1) acc += '(';
      for (let i = 0; i < val.length; i++) {
        if (i > 0) acc += ' or ';
        acc += `${surroundByQuotes(val[i])} in ${field}`;
      }
      if (val.length > 1) acc += ')';
    } else {
      acc += `${field}${op}${surroundByQuotes(val)}`;
    }
    return acc;
  }, '');
  return predicate === '' ? undefined : predicate;
}

// SERVICE IMPLEMENTATION
export class PriceService implements IPriceService {
  private ENTITY = 'price';
  private TOPIC_CREATE: string;
  private TOPIC_UPDATE: string;
  private static instance: IPriceService;
  private repo: IPriceRepository;
  private productService: IProductService;
  private server: FastifyInstance;
  private config: Config;
  private queues: Queues;
  private expressions: Expressions;
  private promotionsUrl: string;
  private cacheCartPrices;
  private cartPricesCache;

  private constructor(server: any) {
    this.server = server;
    this.repo = server.db.repo.priceRepository as IPriceRepository;
    this.productService = ProductService.getInstance(server);
    this.config = server.config;
    this.queues = server.queues;
    this.expressions = new Expressions(server);

    this.promotionsUrl = server.config.PROMOTIONS_URL;
    this.cacheCartPrices = server.config.CACHE_CART_PRICES;
    this.cartPricesCache = new NodeCache({
      useClones: false,
      stdTTL: 60 * 60,
      checkperiod: 60
    });
    this.warmupPricesExpressions(server);
    this.TOPIC_CREATE = `global.${this.ENTITY}.${server.config.TOPIC_CREATE_SUFIX}`;
    this.TOPIC_UPDATE = `global.${this.ENTITY}.${server.config.TOPIC_UPDATE_SUFIX}`;
  }

  public static getInstance(server: any): IPriceService {
    if (!PriceService.instance) {
      PriceService.instance = new PriceService(server);
    }
    return PriceService.instance;
  }

  // PRICES WARMUP
  private async warmupPricesExpressions(server: any) {
    // Get all price expressions and compile them
    const start = process.hrtime.bigint();
    const result = await this.repo.aggregate('stage', [
      { $match: { 'predicates.expression': { $exists: true } } },
      { $unwind: '$predicates' },
      { $project: { expression: '$predicates.expression', _id: 0 } }
    ]);
    if (result.isErr()) return result;
    const expressions = result.value;
    expressions.forEach((e: any) => {
      this.expressions.getExpression(e.expression);
    });
    const end = process.hrtime.bigint();
    server.log.info(`Warmup ${expressions.length} price expressions in ${magenta(Number(end - start) / 1000000)}ms`);
  }

  // CREATE PRICE
  public async createPrice(catalogId: string, payload: CreatePriceBody): Promise<Result<Price, AppError>> {
    // Save the entity
    const result = await this.repo.create(catalogId, {
      id: nanoid(),
      ...payload
    } as Price);
    if (result.isErr()) return result;
    // Send new entity via messagging
    this.queues.publish(this.TOPIC_CREATE, {
      source: toEntity(result.value),
      metadata: {
        catalogId,
        type: 'entityCreated',
        entity: this.ENTITY
      }
    });
    // Return new entity
    return new Ok(toEntity(result.value));
  }

  public async getPricesForSKU(catalogId: string, skus: string[]): Promise<Result<Price[], AppError>> {
    const result = await this.repo.find(catalogId, { sku: { $in: skus } });
    if (result.isErr()) return result;
    return new Ok(result.value.map((e: PriceDAO) => toEntity(e)));
  }

  // FIND PRICE BY ID
  public async findPriceById(catalogId: string, id: string): Promise<Result<Price, AppError>> {
    const result = await this.repo.findOne(catalogId, id);
    if (result.isErr()) return result;
    return new Ok(toEntity(result.value));
  }

  // CART ENDPOINTS
  private carts = new Map<string, Cart>();

  public async getCart(cartId: string): Promise<Result<Cart, AppError>> {
    const cart = this.carts.get(cartId);
    if (!cart) return new Err(new AppError(ErrorCode.NOT_FOUND, `Cart ${cartId} not found`));
    return new Ok(cart);
  }

  public async addProductToCart(cartId: string, data: any): Promise<Result<Cart, AppError>> {
    const cartResult = await this.getCart(cartId);
    if (cartResult.isErr()) return cartResult;
    const cart = cartResult.value;
    cart.items.push(data);
    return new Ok(cart);
  }

  public async createCart(data: any): Promise<Result<any, AppError>> {
    // TODO Refactor cartData (Locale + Country/CustomerGroup/Channel)
    const cart: Cart = Object.assign(
      { id: nanoid() },
      data.country && { country: data.country },
      data.customerGroup && { customerGroup: data.customerGroup },
      data.channel && { channel: data.channel },
      data.locale && { locale: data.locale },
      { items: [] }
    );

    const facts = Object.assign(
      data.country && { country: data.country },
      data.customerGroup && { customerGroup: data.customerGroup },
      data.channel && { channel: data.channel },
      data.locale && { locale: data.locale }
    );

    // Find Products
    let start = process.hrtime.bigint();
    const cartProductsResult = await this.productService.cartProducById(
      'stage',
      data.items.map((item: CartProduct) => item.productId),
      data.locale
    );
    if (cartProductsResult.isErr()) return cartProductsResult;
    const cartProducts = cartProductsResult.value;
    let end = process.hrtime.bigint();
    this.server.log.info(
      `${green('  Find Products')} ${cartProducts.length} in ${magenta(Number(end - start) / 1000000)}ms`
    );

    // Find Prices
    start = process.hrtime.bigint();
    const pricesResult = await this.getCartPricesForSKU(
      'stage',
      cartProducts.map((cp: CartProduct) => cp.sku)
    );
    if (pricesResult.isErr()) return pricesResult;
    const cartProductPrices = pricesResult.value;
    end = process.hrtime.bigint();
    this.server.log.info(
      `${green('  Find Prices')} ${cartProductPrices.length} in ${magenta(Number(end - start) / 1000000)}ms`
    );

    // Add Products to Cart
    start = process.hrtime.bigint();
    for (let index = 0; index < data.items.length; index++) {
      //data.items.length
      const cartProduct = cartProducts.find((cp: CartProduct) => cp.productId === data.items[index].productId)!;
      const prices = cartProductPrices
        .filter((p: Price) => p.sku === cartProduct.sku)
        .map((p: Price) => {
          return [
            ...p.predicates.map((pr) => {
              return { porder: p.order, ...pr };
            })
          ];
        })
        .flat()
        .sort((p1: any, p2: any) => (p1.porder - p2.porder === 0 ? p1.order - p2.order : p1.porder - p2.porder));

      // Get Price
      const priceResult = await this.getMatchedPrice(cartProduct.sku, facts, prices);
      if (priceResult.isErr()) return priceResult;

      // Add CartProduct
      cart.items.push({
        id: cartProduct.productId,
        sku: cartProduct.sku,
        name: cartProduct.name,
        categories: cartProduct.categories,
        quantity: data.items[index].quantity,
        value: priceResult.value
      });
    }
    this.carts.set(cart.id, cart);

    end = process.hrtime.bigint();
    this.server.log.info(`${green('  Calculate Prices')} in ${magenta(Number(end - start) / 1000000)}ms`);

    start = process.hrtime.bigint();
    const promotionsResult: Result<any, AppError> = await fetch(this.promotionsUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(cart)
    })
      .then((response) => response.json())
      .then((response) => new Ok(response))
      .catch((error) => {
        return new Err(new AppError(ErrorCode.BAD_REQUEST, error.message));
      });
    if (promotionsResult.isErr()) return promotionsResult;
    cart.promotions = promotionsResult.value;

    end = process.hrtime.bigint();
    this.server.log.info(
      `${green('  Calculate Promotions')} ${promotionsResult.value.length} in ${magenta(Number(end - start) / 1000000)}ms`
    );

    return new Ok(cart);
  }

  private async getMatchedPrice(sku: string, facts: any, prices: any[]): Promise<Result<Value, AppError>> {
    let matchedPrice: number | undefined;
    for (let i = 0; i < prices.length; i++) {
      const price = prices[i];
      if (price.expression) {
        const expressionResult = await this.expressions.evaluate(price.expression, facts, {});
        if (expressionResult !== undefined && typeof expressionResult === 'boolean' && expressionResult === true) {
          matchedPrice = i;
          break;
        }
      } else {
        matchedPrice = i;
        break;
      }
    }
    if (matchedPrice === undefined) return new Err(new AppError(ErrorCode.NOT_FOUND, `Price not found for ${sku}`));
    return new Ok(prices[matchedPrice].value);
  }

  public async getCartPricesForSKU(catalogId: string, skus: string[]): Promise<Result<Price[], AppError>> {
    const cachedPrices = this.cartPricesCache.mget(skus);
    skus = skus.filter((sku) => !cachedPrices[sku]);
    if (skus.length !== 0) {
      const result = await this.repo.find(
        catalogId,
        {
          sku: { $in: skus },
          active: true
          //,$or: [{ 'predicates.constraints.country': 'IT' }, { 'predicates.constraints.country': { $exists: false } }]
        },
        {
          projection: {
            order: 1,
            sku: 1,
            'predicates.order': 1,
            'predicates.value': 1,
            'predicates.expression': 1
          }
        }
      );
      if (result.isErr()) return result;
      if (result.value.length === 0) return new Err(new AppError(ErrorCode.NOT_FOUND, 'Product not found'));
      result.value.forEach((price) => {
        if (!cachedPrices[price.sku]) cachedPrices[price.sku] = [];
        (cachedPrices[price.sku] as [any]).push(price);
        if (this.cacheCartPrices === true) this.cartPricesCache.set(price.sku, cachedPrices[price.sku]);
      });
    }
    return new Ok(
      Object.entries(cachedPrices)
        .map(([key, value]: [string, any]) => {
          return value.map((p: any) => toEntity(p));
        })
        .flat()
    );
  }
}
