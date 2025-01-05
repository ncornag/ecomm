import type { ClassificationCategory, UpdateClassificationCategoryAction } from './classificationCategory.ts';
import type { Event, Command } from '@ecomm/event-store';
import type { CreateClassificationCategoryBody } from './classificationCategory.schemas.ts';
import type { ClassificationAttribute } from './classificationAttribute.ts';

export const ENTITY_NAME = 'classificationCategory';

///////////
// Commands
///////////

export const ClassificationCategoryCommandTypes = {
  CREATE: `${ENTITY_NAME}-create`,
  UPDATE: `${ENTITY_NAME}-update`,
  CREATE_ATTRIBUTE: `${ENTITY_NAME}-create-attribute`
} as const;

export type CreateClassificationCategory = Command<
  typeof ClassificationCategoryCommandTypes.CREATE,
  { classificationCategory: CreateClassificationCategoryBody },
  {
    projectId: string;
    id: ClassificationCategory['id'];
  }
>;

export type UpdateClassificationCategory = Command<
  typeof ClassificationCategoryCommandTypes.UPDATE,
  {
    classificationCategoryId: ClassificationCategory['id'];
    actions: UpdateClassificationCategoryAction[];
  },
  {
    projectId: string;
    expectedVersion: number;
  }
>;

export type CreateClassificationAttribute = Command<
  typeof ClassificationCategoryCommandTypes.CREATE_ATTRIBUTE,
  {
    classificationCategoryId: ClassificationCategory['id'];
    classificationAttribute: ClassificationAttribute;
  },
  {
    projectId: string;
    expectedVersion: number;
  }
>;

/////////
// Events
/////////

export const ClassificationCategoryEventTypes = {
  CREATED: `${ENTITY_NAME}-created`,
  UPDATED: `${ENTITY_NAME}-updated`,
  ATTRIBUTE_CREATED: `${ENTITY_NAME}-attribute-created`
} as const;

export type ClassificationCategoryCreated = Event<
  typeof ClassificationCategoryEventTypes.CREATED,
  {
    classificationCategory: ClassificationCategory;
  },
  { projectId: string; entity: string; [key: string]: any }
>;

export type ClassificationCategoryUpdated = Event<
  typeof ClassificationCategoryEventTypes.UPDATED,
  {
    classificationCategoryId: ClassificationCategory['id'];
    actions: UpdateClassificationCategoryAction[];
  },
  { projectId: string; entity: string; [key: string]: any }
>;
export type ClassificationAttributeCreated = Event<
  typeof ClassificationCategoryEventTypes.ATTRIBUTE_CREATED,
  {
    classificationCategoryId: ClassificationCategory['id'];
    classificationAttribute: ClassificationAttribute;
  },
  { projectId: string; entity: string; [key: string]: any }
>;

export type ClassificationCategoryEvent =
  | ClassificationCategoryCreated
  | ClassificationCategoryUpdated
  | ClassificationAttributeCreated;

/////////
// Stream
/////////

export const toStreamName = (id: string) => `${ENTITY_NAME}-${id}`;
