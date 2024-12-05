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
} from '../../schemas/product.schemas';
import { ProductService } from '../../services/product.svc';
import { type Product } from '../../entities/product';

export default async function (
  server: FastifyInstance,
  opts: FastifyPluginOptions,
) {
  let service = ProductService.getInstance(server);

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
      const result: Result<Product, AppError> = await service.findProductById(
        request.query.catalog,
        request.params.id,
        request.query.materialized,
      );
      if (!result.ok) return reply.sendAppError(result.val);
      return reply.send(result.val);
    },
  });
}
