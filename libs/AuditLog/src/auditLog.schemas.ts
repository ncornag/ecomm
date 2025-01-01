import { type FastifySchema } from 'fastify';
import { Type, type Static } from '@sinclair/typebox';
import { AuditLogSchema } from './auditLog.entity.ts';

// FIXME: This is a hack to get the example to work, cleanup the schemas

const defaultExample = {
  name: 'Root Category',
  key: 'root'
};

const AuditLogResponse = Type.Composite([AuditLogSchema], {
  examples: [
    {
      id: '63cd0e4be59031edffa39f5c',
      version: 0,
      ...defaultExample,
      createdAt: '2021-01-01T00:00:00.000Z'
    }
  ]
});

// CREATE
export const CreateAuditLogBodySchema = Type.Omit(AuditLogSchema, ['id', 'createdAt', 'lastModifiedAt', 'version'], {
  examples: [defaultExample],
  additionalProperties: false
});
export type CreateAuditLogBody = Static<typeof CreateAuditLogBodySchema>;

export const FindAuditLogParmsSchema = Type.Object({ id: Type.String() });
export type FindAuditLogParms = Static<typeof FindAuditLogParmsSchema>;

export const FindAuditLogsQueryStringSchema = Type.Object({
  catalog: Type.String()
});
export type FindAuditLogsQueryString = Static<typeof FindAuditLogsQueryStringSchema>;

// ROUTE SCHEMAS

export const postAuditLogSchema: FastifySchema = {
  description: 'Create a new auditLog',
  tags: ['auditLog'],
  summary: 'Creates new auditLog with given values',
  body: CreateAuditLogBodySchema,
  response: {
    201: { ...AuditLogResponse, description: 'Success' }
  }
};
