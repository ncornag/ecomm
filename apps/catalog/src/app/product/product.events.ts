import { Product, UpdateProductAction } from './product';
import { Event, Command } from '@ecomm/EventStore';
import { CreateProductBody } from './product.schemas';

export const PRODUCT_ENTITY_NAME = 'product';

///////////
// Commands
///////////

export const enum ProductCommandTypes {
  CREATE = 'product-create',
  UPDATE = 'product-update',
}

export type CreateProduct = Command<
  ProductCommandTypes.CREATE,
  { product: CreateProductBody },
  {
    id: Product['id'];
    catalogId: Product['catalogId'];
  }
>;

export type UpdateProduct = Command<
  ProductCommandTypes.UPDATE,
  {
    productId: Product['id'];
    actions: UpdateProductAction[];
  },
  {
    catalogId: Product['catalogId'];
    expectedVersion: number;
  }
>;

/////////
// Events
/////////

export const enum ProductEventTypes {
  PRODUCT_CREATED = 'product-created',
  PRODUCT_UPDATED = 'product-updated',
}

export type ProductCreated = Event<
  ProductEventTypes.PRODUCT_CREATED,
  {
    product: Product;
  },
  { entity: string; catalogId: string; [key: string]: any }
>;

export type ProductUpdated = Event<
  ProductEventTypes.PRODUCT_UPDATED,
  {
    productId: Product['id'];
    actions: UpdateProductAction[];
  },
  { entity: string; catalogId: string; [key: string]: any }
>;

export type ProductEvent = ProductCreated | ProductUpdated;

/////////
// Stream
/////////

export const toProductStreamName = (productId: string) =>
  `product-${productId}`;
