import { type Result, Ok, Err } from 'ts-results-es';
import { type FastifyInstance, type FastifyPluginOptions, type FastifyReply, type FastifyRequest } from 'fastify';
import { AppError } from '@ecomm/app-error';
import { CatalogService } from '../../catalog/catalog.svc.ts';
import {
  postCatalogSchema,
  type CreateCatalogBody,
  type FindCatalogParms,
  type UpdateCatalogBody,
  updateCatalogSchema
} from '../../catalog/catalog.schemas.ts';
import { type Catalog } from '../../catalog/catalog.ts';

export default async function (server: FastifyInstance, opts: FastifyPluginOptions) {
  let service = CatalogService.getInstance(server);

  // CREATE
  server.route({
    method: 'POST',
    url: '/',
    schema: postCatalogSchema,
    handler: async (request: FastifyRequest<{ Body: CreateCatalogBody }>, reply: FastifyReply) => {
      const result: Result<Catalog, AppError> = await service.createCatalog(request.body);

      if (result.isErr()) return reply.sendAppError(result.error);
      return reply.code(201).send(result.value);
    }
  });

  // UPDATE
  server.route({
    method: 'PATCH',
    url: '/:id',
    schema: updateCatalogSchema,
    handler: async (
      request: FastifyRequest<{
        Params: FindCatalogParms;
        Body: UpdateCatalogBody;
      }>,
      reply: FastifyReply
    ) => {
      const result: Result<Catalog, AppError> = await service.updateCatalog(
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
    handler: async (request: FastifyRequest<{ Params: FindCatalogParms }>, reply: FastifyReply) => {
      const result: Result<Catalog, AppError> = await service.findCatalogById(request.params.id);
      if (result.isErr()) return reply.sendAppError(result.error);
      return reply.send(result.value);
    }
  });
}
