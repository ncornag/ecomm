import type { ProductCategory, UpdateProductCategoryAction } from './productCategory.ts';
import type { Event, Command } from '@ecomm/event-store';
import type { CreateProductCategoryBody } from './productCategory.schemas.ts';

export const ENTITY_NAME = 'productCategory';

///////////
// Commands
///////////

export const ProductCategoryCommandTypes = {
  CREATE: `${ENTITY_NAME}-create`,
  UPDATE: `${ENTITY_NAME}-update`
} as const;

export type CreateProductCategory = Command<
  typeof ProductCategoryCommandTypes.CREATE,
  { productCategory: CreateProductCategoryBody },
  {
    projectId: string;
    id: ProductCategory['id'];
  }
>;

export type UpdateProductCategory = Command<
  typeof ProductCategoryCommandTypes.UPDATE,
  {
    productCategoryId: ProductCategory['id'];
    actions: UpdateProductCategoryAction[];
  },
  {
    projectId: string;
    expectedVersion: number;
  }
>;

/////////
// Events
/////////

export const ProductCategoryEventTypes = {
  CREATED: `${ENTITY_NAME}-created`,
  UPDATED: `${ENTITY_NAME}-updated`
} as const;

export type ProductCategoryCreated = Event<
  typeof ProductCategoryEventTypes.CREATED,
  {
    productCategory: ProductCategory;
  },
  { projectId: string; entity: string; [key: string]: any }
>;

export type ProductCategoryUpdated = Event<
  typeof ProductCategoryEventTypes.UPDATED,
  {
    productCategoryId: ProductCategory['id'];
    actions: UpdateProductCategoryAction[];
  },
  { projectId: string; entity: string; [key: string]: any }
>;

export type ProductCategoryEvent = ProductCategoryCreated | ProductCategoryUpdated;

/////////
// Stream
/////////

export const toStreamName = (id: string) => `${ENTITY_NAME}-${id}`;
