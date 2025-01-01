import { type Result, Ok, Err } from 'ts-results-es';
import { type FastifyInstance, type FastifyPluginOptions, type FastifyReply, type FastifyRequest } from 'fastify';
import { AppError } from '@ecomm/app-error';
import { CatalogSyncService } from '../../catalogSync/catalogSync.svc.ts';
import {
  syncCatalogSchema,
  type SyncCatalogBody,
  postCatalogSyncSchema,
  type CreateCatalogSyncBody,
  type FindCatalogSyncParms,
  type UpdateCatalogSyncBody,
  updateCatalogSyncSchema
} from '../../catalogSync/catalogSync.schemas.ts';
import { type CatalogSync } from '../../catalogSync/catalogSync.ts';

export default async function (server: FastifyInstance, opts: FastifyPluginOptions) {
  let service = CatalogSyncService.getInstance(server);

  // SYNC
  server.route({
    method: 'POST',
    url: '/sync',
    schema: syncCatalogSchema,
    handler: async (request: FastifyRequest<{ Body: SyncCatalogBody }>, reply: FastifyReply) => {
      const result: Result<boolean, AppError> = await service.syncCatalogs(request.body);

      if (result.isErr()) return reply.sendAppError(result.error);
      return reply.send(result.value);
    }
  });

  // CREATE
  server.route({
    method: 'POST',
    url: '/',
    schema: postCatalogSyncSchema,
    handler: async (request: FastifyRequest<{ Body: CreateCatalogSyncBody }>, reply: FastifyReply) => {
      const result: Result<CatalogSync, AppError> = await service.createCatalogSync(request.body);

      if (result.isErr()) return reply.sendAppError(result.error);
      return reply.code(201).send(result.value);
    }
  });

  // UPDATE
  server.route({
    method: 'PATCH',
    url: '/:id',
    schema: updateCatalogSyncSchema,
    handler: async (
      request: FastifyRequest<{
        Params: FindCatalogSyncParms;
        Body: UpdateCatalogSyncBody;
      }>,
      reply: FastifyReply
    ) => {
      const result: Result<CatalogSync, AppError> = await service.updateCatalogSync(
        request.params.id,
        request.body.version,
        request.body.actions
      );

      if (result.isErr()) return reply.sendAppError(result.error);
      return reply.send(result.value);
    }
  });

  // GET
  server.route({
    method: 'GET',
    url: '/:id',
    handler: async (request: FastifyRequest<{ Params: FindCatalogSyncParms }>, reply: FastifyReply) => {
      const result: Result<CatalogSync, AppError> = await service.findCatalogSyncById(request.params.id);
      if (result.isErr()) return reply.sendAppError(result.error);
      return reply.send(result.value);
    }
  });
}
