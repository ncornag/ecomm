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
      const result: Result<Product, AppError> = await service.createProduct(
        request.query.catalogId,
        request.body,
      );
      if (!result.ok) return reply.sendAppError(result.val);

      ///////////////////////////////////////////////////////////////////////////////
      const eventStoreResult = await server.es.create(
        service.create,
        toProductStreamName(result.val.id),
        {
          type: ProductCommandTypes.CREATE,
          data: {
            product: request.body,
          },
          metadata: {
            id: result.val.id,
            catalogId: request.query.catalogId,
          },
        },
      );
      if (!eventStoreResult.ok) return reply.sendAppError(eventStoreResult.val);
      ///////////////////////////////////////////////////////////////////////////////

      return reply.code(201).send(result.val);
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
      const result: Result<Product, AppError> = await service.updateProduct(
        request.query.catalogId,
        request.params.id,
        request.body.version,
        request.body.actions,
      );
      if (!result.ok) return reply.sendAppError(result.val);

      ///////////////////////////////////////////////////////////////////////////////
      const eventStoreResult = await server.es.update(
        service.update,
        toProductStreamName(result.val.id),
        BigInt(request.body.version),
        {
          type: ProductCommandTypes.UPDATE,
          data: {
            productId: request.params.id,
            actions: request.body.actions,
          },
          metadata: {
            catalogId: request.query.catalogId,
          },
        },
      );
      if (!eventStoreResult.ok) return reply.sendAppError(eventStoreResult.val);
      ///////////////////////////////////////////////////////////////////////////////

      return reply.send(result.val);
    },
  });

  // GET
  server.route({
    method: 'GET',
    url: '/:id',
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

      ///////////////////////////////////////////////////////////////////////////////
      const streamResult = await server.es.aggregateStream<
        Product,
        ProductEvent
      >(toProductStreamName(request.params.id), service.aggregate);
      console.dir(streamResult.val, { depth: 15 });
      ///////////////////////////////////////////////////////////////////////////////

      return reply.send(result.val);
    },
  });

  // GET
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
