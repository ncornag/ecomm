import { Product, UpdateProductAction } from './product';
import { Event, Command } from '@ecomm/EventStore';
import { CreateProductBody } from './product.schemas';

export const ENTITY_NAME = 'product';

///////////
// Commands
///////////

export const enum ProductCommandTypes {
  CREATE = `${ENTITY_NAME}-create`,
  UPDATE = `${ENTITY_NAME}-update`,
}

export type CreateProduct = Command<
  ProductCommandTypes.CREATE,
  { product: CreateProductBody },
  {
    projectId: string;
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
    projectId: string;
    catalogId: Product['catalogId'];
    expectedVersion: number;
  }
>;

/////////
// Events
/////////

export const enum ProductEventTypes {
  CREATED = `${ENTITY_NAME}-created`,
  UPDATED = `${ENTITY_NAME}-upated`,
}

export type ProductCreated = Event<
  ProductEventTypes.CREATED,
  {
    product: Product;
  },
  { projectId: string; entity: string; catalogId: string; [key: string]: any }
>;

export type ProductUpdated = Event<
  ProductEventTypes.UPDATED,
  {
    productId: Product['id'];
    actions: UpdateProductAction[];
  },
  { projectId: string; entity: string; catalogId: string; [key: string]: any }
>;

export type ProductEvent = ProductCreated | ProductUpdated;

/////////
// Stream
/////////

export const toStreamName = (id: string) => `${ENTITY_NAME}-${id}`;
