import { type Result, Ok, Err } from 'ts-results';
import {
  type FastifyInstance,
  type FastifyPluginOptions,
  type FastifyReply,
  type FastifyRequest,
} from 'fastify';
import { AppError } from '@ecomm/AppError';
import {
  type FindProductParms,
  FindProductParmsSchema,
  FindProductQueryStringSchema,
} from '../../../schemas/product.schemas';
import { ProductServiceV1 } from '../../../services/productV1.svc';
import { type Product } from '../../../entities/product';

export default async function (
  server: FastifyInstance,
  opts: FastifyPluginOptions,
) {
  let service = ProductServiceV1.getInstance(server);

  // GET
  server.route({
    method: 'GET',
    url: '/:id',
    schema: {
      params: FindProductParmsSchema,
    },
    handler: async (
      request: FastifyRequest<{ Params: FindProductParms }>,
      reply: FastifyReply,
    ) => {
      const result: Result<Product, AppError> = await service.findProductById(
        request.params.id,
      );
      if (!result.ok) return reply.sendAppError(result.val);
      return reply.send(result.val);
    },
  });
}
