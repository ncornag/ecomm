import { CatalogSchema } from '../entities/catalog';
import { type Static, Type } from '@sinclair/typebox';

// DAO
export const CatalogDAOSchema = Type.Composite([
  Type.Omit(CatalogSchema, ['id']),
  Type.Object({ _id: Type.String() }),
]);
export type CatalogDAO = Static<typeof CatalogDAOSchema>;
