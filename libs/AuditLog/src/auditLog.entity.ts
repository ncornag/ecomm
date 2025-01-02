import { AuditFields } from './auditLog.fields.ts';
import { Type, type Static } from '@sinclair/typebox';

// ENTITY
export const AuditLogSchema = Type.Object(
  {
    id: Type.String(),
    entity: Type.String(),
    entityId: Type.String(),
    catalogId: Type.String(),
    updateType: Type.String(),
    source: Type.Any(),
    edits: Type.Any(),
    ...AuditFields
  },
  { additionalProperties: false }
);
export type AuditLog = Static<typeof AuditLogSchema>;
