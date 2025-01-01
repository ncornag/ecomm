import { type Result, Ok, Err } from 'ts-results-es';
import { type FastifyInstance, type FastifyPluginOptions, type FastifyReply, type FastifyRequest } from 'fastify';
import { AppError } from '@ecomm/app-error';
import { PriceService as CartService } from '../../price/price.svc.ts';
import { type Cart } from '../../cart/cart.ts';

export default async function (server: FastifyInstance, opts: FastifyPluginOptions) {
  let service = CartService.getInstance(server);

  // GET
  server.route({
    method: 'POST',
    url: '/',
    //schema: postCartSchema,
    handler: async (
      //request: FastifyRequest<{ Body: CreateCartBody; Querystring: FindCartQueryString }>,
      request: FastifyRequest,
      reply: FastifyReply
    ) => {
      const result: Result<Cart, AppError> = await service.createCart(request.body);
      if (result.isErr()) return reply.sendAppError(result.error);
      return reply.code(201).send(result.value);
    }
  });
}
