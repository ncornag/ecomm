import {
  ProductCategory,
  UpdateProductCategoryAction,
} from './productCategory';
import { Event, Command } from '@ecomm/EventStore';
import { CreateProductCategoryBody } from './productCategory.schemas';

export const ENTITY_NAME = 'productCategory';

///////////
// Commands
///////////

export const enum ProductCategoryCommandTypes {
  CREATE = `${ENTITY_NAME}-create`,
  UPDATE = `${ENTITY_NAME}-update`,
}

export type CreateProductCategory = Command<
  ProductCategoryCommandTypes.CREATE,
  { productCategory: CreateProductCategoryBody },
  {
    projectId: string;
    id: ProductCategory['id'];
  }
>;

export type UpdateProductCategory = Command<
  ProductCategoryCommandTypes.UPDATE,
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

export const enum ProductCategoryEventTypes {
  CREATED = `${ENTITY_NAME}-created`,
  UPDATED = `${ENTITY_NAME}-updated`,
}

export type ProductCategoryCreated = Event<
  ProductCategoryEventTypes.CREATED,
  {
    productCategory: ProductCategory;
  },
  { projectId: string; entity: string; [key: string]: any }
>;

export type ProductCategoryUpdated = Event<
  ProductCategoryEventTypes.UPDATED,
  {
    productCategoryId: ProductCategory['id'];
    actions: UpdateProductCategoryAction[];
  },
  { projectId: string; entity: string; [key: string]: any }
>;

export type ProductCategoryEvent =
  | ProductCategoryCreated
  | ProductCategoryUpdated;

/////////
// Stream
/////////

export const toStreamName = (id: string) => `${ENTITY_NAME}-${id}`;
