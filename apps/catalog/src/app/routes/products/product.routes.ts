import { type Result, Ok, Err } from 'ts-results';
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
  CreateProduct,
  ProductCreated,
  ProductEvent,
  UpdateProductName,
  decider,
  evolve,
  initialState,
  streamType,
} from '../../product/product.events';
import { CommandHandler } from '@event-driven-io/emmett';

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

  const handle = CommandHandler({
    evolve,
    initialState,
  });
  server.es.bus.subscribe((event: ProductCreated) => {
    console.log('Product created: ' + JSON.stringify(event));
  }, 'ProductCreated');

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
        request.query.catalog,
        request.body,
      );

      if (!result.ok) return reply.sendAppError(result.val);

      const command: CreateProduct = {
        type: 'CreateProduct',
        data: {
          product: request.body as Product,
          catalog: request.query.catalog,
        },
        // metadata: {
        //   catalogId: request.query.catalog,
        // },
      };
      console.log('route.post');
      await handle(
        server.es.store,
        toStreamName(streamType, result.val.id),
        (state) => decider.decide(command, state),
      );

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
      const command: UpdateProductName = {
        type: 'UpdateProductName',
        data: {
          productId: request.params.id,
          name: (request.body.actions[0] as any).name,
        },
        // metadata: {
        //   catalogId,
        // },
      };

      await handle(
        server.es.store,
        toStreamName(streamType, request.params.id),
        (state) => decider.decide(command, state),
      );

      const result: Result<Product, AppError> = await service.updateProduct(
        request.query.catalog,
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
      const streamResult = await server.es.store.aggregateStream<
        Product,
        ProductEvent
      >(toStreamName(streamType, request.params.id), {
        evolve,
        initialState,
      });

      console.dir(streamResult);

      const result: Result<Product, AppError> = await service.findProductById(
        request.query.catalog,
        request.params.id,
        request.query.materialized,
      );
      if (!result.ok) return reply.sendAppError(result.val);
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
      const result: Result<Product, AppError> =
        await service.findProductByIdEventStore(
          request.query.catalog,
          request.params.id,
        );
      if (!result.ok) return reply.sendAppError(result.val);
      return reply.send(result.val);
    },
  });
}
