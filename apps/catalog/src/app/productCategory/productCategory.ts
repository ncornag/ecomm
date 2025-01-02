import { TreeFieldsSchema, type UpdateChangeParent, UpdateChangeParentSchema } from '../lib/tree.ts';
import { AuditFields } from '@ecomm/audit-log';
import { Type, type Static } from '@sinclair/typebox';

const keyAttributes = {
  minLength: 2,
  maxLength: 256,
  pattern: '^[A-Za-z0-9_-]+$'
};

// Action Types
export const ProductCategoryUpdateActionType: Record<string, string> = {
  SETKEY: 'setKey',
  CHANGENAME: 'changeName',
  CHANGEPARENT: 'changeParent'
};

// ACTIONS

// setKey action
export const UpdateProductCategorySetKeySchema = Type.Object(
  {
    action: Type.Literal(ProductCategoryUpdateActionType.SETKEY),
    key: Type.String(keyAttributes)
  },
  { additionalProperties: false }
);
export type UpdateProductCategorySetKey = Static<typeof UpdateProductCategorySetKeySchema>;

// changeName action
export const UpdateProductCategoryChangeNameSchema = Type.Object(
  {
    action: Type.Literal(ProductCategoryUpdateActionType.CHANGENAME),
    name: Type.String()
  },
  { additionalProperties: false }
);
export type UpdateProductCategoryChangeName = Static<typeof UpdateProductCategoryChangeNameSchema>;

export const UpdateProductCategoryChangeParentSchema = UpdateChangeParentSchema;
export type UpdateProductCategoryChangeParent = UpdateChangeParent;

// ACTION
export const UpdateProductCategoryAction = Type.Union([
  UpdateProductCategorySetKeySchema,
  UpdateProductCategoryChangeNameSchema,
  UpdateProductCategoryChangeParentSchema
]);
export type UpdateProductCategoryAction = Static<typeof UpdateProductCategoryAction>;

// ENTITY
export const ProductCategorySchema = Type.Object(
  {
    id: Type.String(),
    name: Type.String(),
    key: Type.Optional(Type.String(keyAttributes)),
    ...TreeFieldsSchema,
    ...AuditFields
  },
  { additionalProperties: false }
);
export type ProductCategory = Static<typeof ProductCategorySchema>;
