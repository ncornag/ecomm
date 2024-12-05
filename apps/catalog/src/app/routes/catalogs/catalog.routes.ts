import { type Result, Ok, Err } from 'ts-results';
import {
  type FastifyInstance,
  type FastifyPluginOptions,
  type FastifyReply,
  type FastifyRequest,
} from 'fastify';
import { AppError } from '@ecomm/AppError';
import { CatalogService } from '../../services/catalog.svc';
import {
  postCatalogSchema,
  type CreateCatalogBody,
  type FindCatalogParms,
  type UpdateCatalogBody,
  updateCatalogSchema,
} from '../../schemas/catalog.schemas';
import { type Catalog } from '../../entities/catalog';

export default async function (
  server: FastifyInstance,
  opts: FastifyPluginOptions,
) {
  let service = CatalogService.getInstance(server);

  // CREATE
  server.route({
    method: 'POST',
    url: '/',
    schema: postCatalogSchema,
    handler: async (
      request: FastifyRequest<{ Body: CreateCatalogBody }>,
      reply: FastifyReply,
    ) => {
      const result: Result<Catalog, AppError> = await service.createCatalog(
        request.body,
      );

      if (!result.ok) return reply.sendAppError(result.val);
      return reply.code(201).send(result.val);
    },
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
      reply: FastifyReply,
    ) => {
      const result: Result<Catalog, AppError> = await service.updateCatalog(
        request.params.id,
        request.body.version,
        request.body.actions,
      );

      if (!result.ok) return reply.sendAppError(result.val);
      return reply.send(result.val);
    },
  });

  // GET
  server.route({
    method: 'GET',
    url: '/:id',
    handler: async (
      request: FastifyRequest<{ Params: FindCatalogParms }>,
      reply: FastifyReply,
    ) => {
      const result: Result<Catalog, AppError> = await service.findCatalogById(
        request.params.id,
      );
      if (!result.ok) return reply.sendAppError(result.val);
      return reply.send(result.val);
    },
  });
}
