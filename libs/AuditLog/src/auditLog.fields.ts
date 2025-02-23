import { Type } from '@sinclair/typebox';

export const AuditFields = {
  version: Type.Optional(Type.Number({ default: 0 })),
  createdAt: Type.Optional(Type.String({ format: 'date-time' })),
  lastModifiedAt: Type.Optional(Type.String({ format: 'date-time' }))
};
