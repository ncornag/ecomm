import { AuditFields } from '@ecomm/Mongo';
import { Type, type Static } from '@sinclair/typebox';

// Action Types
const PromotionUpdateActionType: Record<string, string> = {
  CHANGENAME: 'changeName',
};

// ACTIONS

// changeName action
export const UpdatePromotionChangeNameSchema = Type.Object(
  {
    action: Type.Literal(PromotionUpdateActionType.CHANGENAME),
    name: Type.String(),
  },
  { additionalProperties: false },
);
export type UpdatePromotionChangeName = Static<
  typeof UpdatePromotionChangeNameSchema
>;

// UPDATE ACTIONS
export const UpdatePromotionAction = Type.Union([
  UpdatePromotionChangeNameSchema,
]);
export type UpdatePromotionAction = Static<typeof UpdatePromotionAction>;

// THEN

// Action Types
const ThenActionType: Record<string, string> = {
  CREATELINEDISCOUNT: 'createLineDiscount',
  CREATEORDERDISCOUNT: 'createOrderDiscount',
  TAGASUSED: 'tagAsUsed',
};

// createLineDiscount action
export const CreateLineDiscountActionSchema = Type.Object(
  {
    action: Type.Literal(ThenActionType.CREATELINEDISCOUNT),
    productId: Type.String(),
    discount: Type.Number(),
  },
  { additionalProperties: false },
);
export type CreateLineDiscountAction = Static<
  typeof CreateLineDiscountActionSchema
>;
// createOrderDiscount action
export const CreateOrderDiscountActionSchema = Type.Object(
  {
    action: Type.Literal(ThenActionType.CREATEORDERDISCOUNT),
    discount: Type.Number(),
  },
  { additionalProperties: false },
);
export type CreateOrderDiscountAction = Static<
  typeof CreateOrderDiscountActionSchema
>;
// tagAsdUsed action
export const TagAsUsedActionSchema = Type.Object(
  {
    action: Type.Literal(ThenActionType.TAGASUSED),
    products: Type.Array(
      Type.Object({ productId: Type.String(), quantity: Type.Number() }),
    ),
  },
  { additionalProperties: false },
);
export type TagAsUsedAction = Static<typeof TagAsUsedActionSchema>;

export const ThenSchema = Type.Array(
  Type.Union([
    CreateLineDiscountActionSchema,
    CreateOrderDiscountActionSchema,
    TagAsUsedActionSchema,
  ]),
);
export type Then = Static<typeof ThenSchema>;

// WHEN
export const WhenSchema = Type.Record(
  Type.String({ pattern: '^[a-zA-Z0-9]{2,30}$' }),
  Type.String(),
);
export type When = Static<typeof WhenSchema>;

// ENTITY
export const PromotionSchema = Type.Object(
  {
    id: Type.String(),
    name: Type.String(),
    when: WhenSchema,
    then: ThenSchema,
    times: Type.Optional(Type.Number()),
    active: Type.Optional(Type.Boolean({ default: true })),
    ...AuditFields,
  },
  { additionalProperties: false },
);
export type Promotion = Static<typeof PromotionSchema>;
