import { PriceSchema } from '../entities/price';
import { type Static, Type } from '@sinclair/typebox';

// DAO
export const PriceDAOSchema = Type.Composite([
  Type.Omit(PriceSchema, ['id']),
  Type.Object({ _id: Type.String() }),
]);
export type PriceDAO = Static<typeof PriceDAOSchema>;
