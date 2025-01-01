import { AuditFields } from '@ecomm/mongo';
import { Type, type Static } from '@sinclair/typebox';
import { ValueSchema } from '../price/price.ts';

const CartProductSchema = Type.Object({
  productId: Type.String(),
  sku: Type.String(),
  name: Type.String(),
  categories: Type.Array(Type.String())
});
export type CartProduct = Static<typeof CartProductSchema>;

const CartItemSchema = Type.Object({
  id: Type.String(),
  sku: Type.String(),
  name: Type.String(),
  categories: Type.Array(Type.String()),
  quantity: Type.Number(),
  value: ValueSchema
});
export type CartItem = Static<typeof CartItemSchema>;

const CartPromotionSchema = Type.Object({
  promotionId: Type.String(),
  type: Type.String(),
  sku: Type.String(),
  centAmount: ValueSchema
});
export type CartPromotion = Static<typeof CartPromotionSchema>;

// ENTITY
export const CartSchema = Type.Object(
  {
    id: Type.String(),
    items: Type.Array(CartItemSchema),
    promotions: Type.Array(CartPromotionSchema),
    ...AuditFields
  },
  { additionalProperties: false }
);
export type Cart = Static<typeof CartSchema>;
