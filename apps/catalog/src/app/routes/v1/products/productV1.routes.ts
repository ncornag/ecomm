import { type Result, Ok, Err } from 'ts-results-es';
import { type FastifyInstance, type FastifyPluginOptions, type FastifyReply, type FastifyRequest } from 'fastify';
import { AppError } from '@ecomm/app-error';
import {
  type FindProductParms,
  FindProductParmsSchema,
  FindProductQueryStringSchema
} from '../../../product/product.schemas.ts';
import { ProductServiceV1 } from '../../../product/productV1.svc.ts';
import { type Product } from '../../../product/product.ts';

export default async function (server: FastifyInstance, opts: FastifyPluginOptions) {
  let service = ProductServiceV1.getInstance(server);

  // GET
  server.route({
    method: 'GET',
    url: '/:id',
    schema: {
      params: FindProductParmsSchema
    },
    handler: async (request: FastifyRequest<{ Params: FindProductParms }>, reply: FastifyReply) => {
      const result: Result<Product, AppError> = await service.findProductById(request.params.id);
      if (result.isErr()) return reply.sendAppError(result.error);
      return reply.send(result.value);
    }
  });
}
