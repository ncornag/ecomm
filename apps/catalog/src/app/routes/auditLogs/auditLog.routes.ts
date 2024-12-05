import { type Result, Ok, Err } from 'ts-results';
import {
  type FastifyInstance,
  type FastifyPluginOptions,
  type FastifyReply,
  type FastifyRequest,
} from 'fastify';
import { AppError } from '@ecomm/AppError';
import { AuditLogService } from '@ecomm/AuditLog';
import {
  type AuditLog,
  type FindAuditLogParms,
  type FindAuditLogsQueryString,
} from '@ecomm/AuditLog';

export default async function (
  server: FastifyInstance,
  opts: FastifyPluginOptions,
) {
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
      reply: FastifyReply,
    ) => {
      const result: Result<AuditLog, AppError> = await service.findAuditLogById(
        request.params.id,
      );
      if (!result.ok) return reply.sendAppError(result.val);
      return reply.send(result.val);
    },
  });

  // FIND
  server.route({
    method: 'GET',
    url: '/',
    handler: async (
      request: FastifyRequest<{
        Querystring: FindAuditLogsQueryString;
      }>,
      reply: FastifyReply,
    ) => {
      const result: Result<AuditLog[], AppError> = await service.findAuditLogs(
        request.query.catalog,
      );
      if (!result.ok) return reply.sendAppError(result.val);
      return reply.send(result.val);
    },
  });
}
