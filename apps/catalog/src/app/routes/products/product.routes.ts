import { type Result } from 'ts-results-es';
import { type FastifyInstance, type FastifyPluginOptions, type FastifyReply, type FastifyRequest } from 'fastify';
import { AppError } from '@ecomm/app-error';
import {
  type CreateProductBody,
  type UpdateProductBody,
  type FindProductParms,
  postProductSchema,
  updateProductSchema,
  type FindProductQueryString,
  FindProductQueryStringSchema
} from '../../product/product.schemas.ts';
import { ProductService } from '../../product/product.svc.ts';
import { type Product } from '../../product/product.ts';
import { ProductCommandTypes, type ProductEvent, toStreamName } from '../../product/product.events.ts';
import { nanoid } from 'nanoid';
import { projectId } from '@ecomm/request-context';
import { type ProjectBasedParams } from '../../base.schemas.ts';

export default async function (server: FastifyInstance, opts: FastifyPluginOptions) {
  const service = ProductService.getInstance(server);

  // CREATE
  server.route({
    method: 'POST',
    url: '/',
    config: { scopes: ['catalog:write'] },
    schema: postProductSchema,
    handler: async (
      request: FastifyRequest<{
        Params: ProjectBasedParams;
        Body: CreateProductBody;
        Querystring: FindProductQueryString;
      }>,
      reply: FastifyReply
    ) => {
      const id = nanoid();
      const eventStoreResult = await server.es.create(service.create, toStreamName(id), {
        type: ProductCommandTypes.CREATE,
        data: {
          product: request.body
        },
        metadata: {
          projectId: projectId(),
          id,
          catalogId: request.query.catalogId
        }
      });
      if (eventStoreResult.isErr()) return reply.sendAppError(eventStoreResult.error);
      return reply.code(201).send({
        ...eventStoreResult.value.data.product,
        version: eventStoreResult.value.metadata.version
      });
    }
  });

  // UPDATE
  server.route({
    method: 'PATCH',
    url: '/:id',
    config: { scopes: ['catalog:write'] },
    schema: updateProductSchema,
    handler: async (
      request: FastifyRequest<{
        Params: FindProductParms;
        Body: UpdateProductBody;
        Querystring: FindProductQueryString;
      }>,
      reply: FastifyReply
    ) => {
      const eventStoreResult = await server.es.update(
        service.update,
        toStreamName(request.params.id),
        request.body.version,
        {
          type: ProductCommandTypes.UPDATE,
          data: {
            productId: request.params.id,
            actions: request.body.actions
          },
          metadata: {
            projectId: projectId(),
            catalogId: request.query.catalogId,
            expectedVersion: request.body.version
          }
        }
      );
      if (eventStoreResult.isErr()) return reply.sendAppError(eventStoreResult.error);
      return reply.send({
        ...eventStoreResult.value.metadata.expected,
        version: eventStoreResult.value.metadata.version
      });
    }
  });

  // GET the entity from the ReadModel
  server.route({
    method: 'GET',
    url: '/:id',
    config: { scopes: ['catalog:read'] },
    schema: {
      querystring: FindProductQueryStringSchema
    },
    handler: async (
      request: FastifyRequest<{
        Params: FindProductParms;
        Querystring: FindProductQueryString;
      }>,
      reply: FastifyReply
    ) => {
      const result: Result<Product, AppError> = await service.findProductById(
        request.query.catalogId,
        request.params.id,
        request.query.materialized
      );
      if (result.isErr()) return reply.sendAppError(result.error);
      return reply.send(result.value);
    }
  });

  // GET the entity from the Stream
  server.route({
    method: 'GET',
    url: '/:id/es',
    config: { scopes: ['catalog:read'] },
    schema: {
      querystring: FindProductQueryStringSchema
    },
    handler: async (
      request: FastifyRequest<{
        Params: FindProductParms;
        Querystring: FindProductQueryString;
      }>,
      reply: FastifyReply
    ) => {
      // FIXME handle request.query.catalog,
      const result = await server.es.aggregateStream<Product, ProductEvent>(
        projectId(),
        toStreamName(request.params.id),
        service.aggregate
      );
      if (result.isErr()) return reply.sendAppError(result.error);
      return reply.send(result.value);
    }
  });
}
