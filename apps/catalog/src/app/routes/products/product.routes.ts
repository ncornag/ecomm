import { type Result } from 'ts-results';
import {
  type FastifyInstance,
  type FastifyPluginOptions,
  type FastifyReply,
  type FastifyRequest,
} from 'fastify';
import { AppError } from '@ecomm/AppError';
import {
  type CreateProductBody,
  type UpdateProductBody,
  type FindProductParms,
  postProductSchema,
  updateProductSchema,
  type FindProductQueryString,
  FindProductQueryStringSchema,
} from '../../product/product.schemas';
import { ProductService } from '../../product/product.svc';
import { type Product } from '../../product/product';
import {
  ProductCommandTypes,
  ProductEvent,
  toProductStreamName,
} from '../../product/product.events';
import { nanoid } from 'nanoid';

export type StreamType = string;
export type StreamName<T extends StreamType = StreamType> = `${T}:${string}`;
export function toStreamName<T extends StreamType>(
  streamType: T,
  streamId: string,
): StreamName<T> {
  return `${streamType}:${streamId}`;
}

export default async function (
  server: FastifyInstance,
  opts: FastifyPluginOptions,
) {
  const service = ProductService.getInstance(server);

  // CREATE
  server.route({
    method: 'POST',
    url: '/',
    schema: postProductSchema,
    handler: async (
      request: FastifyRequest<{
        Body: CreateProductBody;
        Querystring: FindProductQueryString;
      }>,
      reply: FastifyReply,
    ) => {
      const id = nanoid();
      const eventStoreResult = await server.es.create(
        service.create,
        toProductStreamName(id),
        {
          type: ProductCommandTypes.CREATE,
          data: {
            product: request.body,
          },
          metadata: {
            id,
            catalogId: request.query.catalogId,
          },
        },
      );
      if (!eventStoreResult.ok) return reply.sendAppError(eventStoreResult.val);

      return reply.code(201).send({ id });
    },
  });

  // UPDATE
  server.route({
    method: 'PATCH',
    url: '/:id',
    schema: updateProductSchema,
    handler: async (
      request: FastifyRequest<{
        Params: FindProductParms;
        Body: UpdateProductBody;
        Querystring: FindProductQueryString;
      }>,
      reply: FastifyReply,
    ) => {
      const eventStoreResult = await server.es.update(
        service.update,
        toProductStreamName(request.params.id),
        request.body.version,
        {
          type: ProductCommandTypes.UPDATE,
          data: {
            productId: request.params.id,
            actions: request.body.actions,
          },
          metadata: {
            catalogId: request.query.catalogId,
            expectedVersion: request.body.version,
          },
        },
      );
      if (!eventStoreResult.ok) return reply.sendAppError(eventStoreResult.val);

      return reply.send({});
    },
  });

  // GET the entity from the ReadModel
  server.route({
    method: 'GET',
    url: '/:id',
    config: { scopes: ['catalog:read'] },
    schema: {
      querystring: FindProductQueryStringSchema,
    },
    handler: async (
      request: FastifyRequest<{
        Params: FindProductParms;
        Querystring: FindProductQueryString;
      }>,
      reply: FastifyReply,
    ) => {
      const result: Result<Product, AppError> = await service.findProductById(
        request.query.catalogId,
        request.params.id,
        request.query.materialized,
      );
      if (!result.ok) return reply.sendAppError(result.val);

      return reply.send(result.val);
    },
  });

  // GET the entity from the Stream
  server.route({
    method: 'GET',
    url: '/:id/es',
    schema: {
      querystring: FindProductQueryStringSchema,
    },
    handler: async (
      request: FastifyRequest<{
        Params: FindProductParms;
        Querystring: FindProductQueryString;
      }>,
      reply: FastifyReply,
    ) => {
      // FIXME handle request.query.catalog,
      const result = await server.es.aggregateStream<Product, ProductEvent>(
        toProductStreamName(request.params.id),
        service.aggregate,
      );
      if (!result.ok) return reply.sendAppError(result.val);
      return reply.send(result.val);
    },
  });
}
