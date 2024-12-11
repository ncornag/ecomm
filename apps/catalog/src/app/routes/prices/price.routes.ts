import { type Result, Ok, Err } from 'ts-results';
import {
  type FastifyInstance,
  type FastifyPluginOptions,
  type FastifyReply,
  type FastifyRequest,
} from 'fastify';
import { AppError } from '@ecomm/AppError';
import { PriceService as PriceService } from '../../price/price.svc';
import { type Price } from '../../price/price';
import {
  type CreatePriceBody,
  type FindPriceQueryString,
  postPriceSchema,
} from '../../price/price.schemas';

export default async function (
  server: FastifyInstance,
  opts: FastifyPluginOptions,
) {
  let service = PriceService.getInstance(server);

  // CREATE
  server.route({
    method: 'POST',
    url: '/',
    schema: postPriceSchema,
    handler: async (
      request: FastifyRequest<{
        Body: CreatePriceBody;
        Querystring: FindPriceQueryString;
      }>,
      reply: FastifyReply,
    ) => {
      const result: Result<Price, AppError> = await service.createPrice(
        request.query.catalog,
        request.body,
      );

      if (!result.ok) return reply.sendAppError(result.val);
      return reply.code(201).send(result.val);
    },
  });

  // GET
  server.route({
    method: 'GET',
    url: '/:id',
    //schema: postPriceSchema,
    handler: async (request, reply) => {
      const result: Result<Price, AppError> = await service.findPriceById(
        '',
        '',
      );
      if (!result.ok) return reply.sendAppError(result.val);
      return reply.code(201).send(result.val);
    },
  });
}
