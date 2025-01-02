import { AuditFields } from '@ecomm/audit-log';
import { Type, type Static } from '@sinclair/typebox';

// Action Types
export const CatalogSyncUpdateActionType: Record<string, string> = {
  CHANGENAME: 'changeName'
};

// ACTIONS

// changeName action
export const UpdateCatalogSyncChangeNameSchema = Type.Object(
  {
    action: Type.Literal(CatalogSyncUpdateActionType.CHANGENAME),
    name: Type.String()
  },
  { additionalProperties: false }
);
export type UpdateCatalogSyncChangeName = Static<typeof UpdateCatalogSyncChangeNameSchema>;

// ACTION
export const UpdateCatalogSyncAction = Type.Union([UpdateCatalogSyncChangeNameSchema]);
export type UpdateCatalogSyncAction = Static<typeof UpdateCatalogSyncAction>;

// ENTITY
export const CatalogSyncSchema = Type.Object(
  {
    id: Type.String(),
    sourceCatalog: Type.String(),
    targetCatalog: Type.String(),
    removeNonExistent: Type.Boolean(),
    createNewItems: Type.Boolean(),
    propertiesToSync: Type.Array(Type.String()),
    runAt: Type.String(),
    lastSync: Type.String({ format: 'date-time' }),
    ...AuditFields
  },
  { additionalProperties: false }
);
export type CatalogSync = Static<typeof CatalogSyncSchema>;
