import { AuditFields } from '@ecomm/audit-log';
import { Type, type Static } from '@sinclair/typebox';

// Action Types
export const ProductUpdateActionType: Record<string, string> = {
  CHANGENAME: 'changeName',
  CHANGEDESCRIPTION: 'changeDescription',
  CHANGEKEYWORDS: 'changeKeywords'
};

// Localized Strings/Arrays
// TODO: Refactor
const i18nKeyType = Type.Record(Type.String({ pattern: '^[a-z]{2}([_])?([A-Za-z]{2})?$' }), Type.String(), {
  additionalProperties: false,
  minProperties: 1
});
const i18nArrayKeyType = Type.Record(
  Type.String({ pattern: '^[a-z]{2}([_])?([A-Za-z]{2})?$' }),
  Type.Array(
    Type.Object({
      text: Type.String(),
      suggestTokenizer: Type.Optional(Type.Object({ type: Type.String() }))
    })
  ),
  {
    additionalProperties: false,
    minProperties: 1
  }
);

// ACTIONS

// changeName action
export const UpdateProductChangeNameSchema = Type.Object(
  {
    action: Type.Literal(ProductUpdateActionType.CHANGENAME),
    name: i18nKeyType
  },
  { additionalProperties: false }
);
export type UpdateProductChangeName = Static<typeof UpdateProductChangeNameSchema>;

// ChangeDescription action
export const UpdateProductChangeDescriptionSchema = Type.Object(
  {
    action: Type.Literal(ProductUpdateActionType.CHANGEDESCRIPTION),
    description: i18nKeyType
  },
  { additionalProperties: false }
);
export type UpdateProductChangeDescription = Static<typeof UpdateProductChangeDescriptionSchema>;

// changeKeywords action
export const UpdateProductChangeKeywordsSchema = Type.Object(
  {
    action: Type.Literal(ProductUpdateActionType.CHANGEKEYWORDS),
    searchKeywords: i18nArrayKeyType
  },
  { additionalProperties: false }
);
export type UpdateProductChangeKeywords = Static<typeof UpdateProductChangeKeywordsSchema>;

// ACTION
export const UpdateProductAction = Type.Union([
  UpdateProductChangeDescriptionSchema,
  UpdateProductChangeNameSchema,
  UpdateProductChangeKeywordsSchema
]);
export type UpdateProductAction = Static<typeof UpdateProductAction>;

// PRODUCT TYPES
export const ProductType: Record<string, string> = {
  BASE: 'base',
  VARIANT: 'variant',
  COMPOSITE: 'composite'
};

// ENTITY
export const ProductSchema = Type.Object(
  {
    id: Type.String(),
    catalogId: Type.String(),
    name: i18nKeyType,
    description: Type.Optional(i18nKeyType),
    sku: Type.Optional(Type.String()), // Optional in the base product
    slug: Type.Optional(i18nKeyType), // Optional in the variants
    searchKeywords: Type.Optional(i18nArrayKeyType), // TODO: Refactor
    categories: Type.Array(Type.String(), { default: [] }),
    attributes: Type.Any({ default: {} }),
    type: Type.Enum(ProductType), // BASE, VARIANT, COMPOSITE...
    parent: Type.Optional(Type.String()), // If this is a variant, the parent product id
    taxCategory: Type.Optional(Type.String()), // TODO: implement taxes
    //status: Type.Optional(Type.String()), // TODO: implement workflow: Active, Inactive... Approved, Pending, Rejected
    //images: Type.Optional(Type.Array(Type.String())),
    //productType: Type.Optional(Type.String()),
    //? versionModifiedAt: '2024-12-09T22:55:12.970Z',
    //? lastMessageSequenceNumber: 1,
    //? lastModifiedBy: { isPlatformClient: true},
    //? createdBy: {isPlatformClient: true},
    //? availability
    ...AuditFields
  },
  { additionalProperties: false }
);
export type Product = Static<typeof ProductSchema>;
