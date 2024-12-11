import { PromotionSchema } from '../promotion/promotion';
import { type Static, Type } from '@sinclair/typebox';

// DAO
export const PromotionDAOSchema = Type.Composite([
  Type.Omit(PromotionSchema, ['id']),
  Type.Object({ _id: Type.String() }),
]);
export type PromotionDAO = Static<typeof PromotionDAOSchema>;
