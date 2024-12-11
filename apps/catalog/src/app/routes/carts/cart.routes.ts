import { type Result, Ok, Err } from 'ts-results';
import {
  type FastifyInstance,
  type FastifyPluginOptions,
  type FastifyReply,
  type FastifyRequest,
} from 'fastify';
import { AppError } from '@ecomm/AppError';
import { PriceService as CartService } from '../../price/price.svc';
import { type Cart } from '../../cart/cart';

export default async function (
  server: FastifyInstance,
  opts: FastifyPluginOptions,
) {
  let service = CartService.getInstance(server);

  // GET
  server.route({
    method: 'POST',
    url: '/',
    //schema: postCartSchema,
    handler: async (
      //request: FastifyRequest<{ Body: CreateCartBody; Querystring: FindCartQueryString }>,
      request: FastifyRequest,
      reply: FastifyReply,
    ) => {
      const result: Result<Cart, AppError> = await service.createCart(
        request.body,
      );
      if (!result.ok) return reply.sendAppError(result.val);
      return reply.code(201).send(result.val);
    },
  });
}
