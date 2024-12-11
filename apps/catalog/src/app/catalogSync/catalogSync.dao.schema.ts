import { CatalogSyncSchema } from './catalogSync';
import { type Static, Type } from '@sinclair/typebox';

// DAO
export const CatalogSyncDAOSchema = Type.Composite([
  Type.Omit(CatalogSyncSchema, ['id']),
  Type.Object({ _id: Type.String() }),
]);
export type CatalogSyncDAO = Static<typeof CatalogSyncDAOSchema>;
