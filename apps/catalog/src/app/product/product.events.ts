import type { Product, UpdateProductAction } from './product.ts';
import type { Event, Command } from '@ecomm/event-store';
import type { CreateProductBody } from './product.schemas.ts';

export const ENTITY_NAME = 'product';

///////////
// Commands
///////////

export const ProductCommandTypes = {
  CREATE: `${ENTITY_NAME}-create`,
  UPDATE: `${ENTITY_NAME}-update`
} as const;

export type CreateProduct = Command<
  typeof ProductCommandTypes.CREATE,
  { product: CreateProductBody },
  {
    projectId: string;
    id: Product['id'];
    catalogId: Product['catalogId'];
  }
>;

export type UpdateProduct = Command<
  typeof ProductCommandTypes.UPDATE,
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

export const ProductEventTypes = {
  CREATED: `${ENTITY_NAME}-created`,
  UPDATED: `${ENTITY_NAME}-updated`
} as const;

export type ProductCreated = Event<
  typeof ProductEventTypes.CREATED,
  {
    product: Product;
  },
  { projectId: string; entity: string; catalogId: string; [key: string]: any }
>;

export type ProductUpdated = Event<
  typeof ProductEventTypes.UPDATED,
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
