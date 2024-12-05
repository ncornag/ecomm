import { AuditLogSchema } from './auditLog.entity';
import { type Static, Type } from '@sinclair/typebox';

// DAO
export const AuditLogDAOSchema = Type.Composite([
  Type.Omit(AuditLogSchema, ['id']),
  Type.Object({ _id: Type.String() }),
]);
export type AuditLogDAO = Static<typeof AuditLogDAOSchema>;
