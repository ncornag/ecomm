import { type Result, Ok, Err } from 'ts-results-es';
import type { FastifyInstance, FastifyPluginOptions, FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from '@ecomm/app-error';
import { AuditLogService } from './auditLog.svc.ts';
import type { FindAuditLogParms, FindAuditLogsQueryString } from './auditLog.schemas.ts';
import type { AuditLog } from './auditLog.entity.ts';

export default async function (server: FastifyInstance, opts: FastifyPluginOptions) {
  const service = AuditLogService.getInstance(server);

  // GET ONE
  server.route({
    method: 'GET',
    url: '/:id',
    handler: async (
      request: FastifyRequest<{
        Params: FindAuditLogParms;
        Querystring: FindAuditLogsQueryString;
      }>,
      reply: FastifyReply
    ) => {
      const result: Result<AuditLog, AppError> = await service.findAuditLogById(request.params.id);
      if (result.isErr()) return reply.sendAppError(result.error);
      return reply.send(result.value);
    }
  });

  // FIND
  server.route({
    method: 'GET',
    url: '/',
    handler: async (
      request: FastifyRequest<{
        Querystring: FindAuditLogsQueryString;
      }>,
      reply: FastifyReply
    ) => {
      const result: Result<AuditLog[], AppError> = await service.findAuditLogs({});
      if (result.isErr()) return reply.sendAppError(result.error);
      return reply.send(result.value);
    }
  });
}
