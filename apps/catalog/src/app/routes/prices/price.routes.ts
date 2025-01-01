import { type Result, Ok, Err } from 'ts-results-es';
import { type FastifyInstance, type FastifyPluginOptions, type FastifyReply, type FastifyRequest } from 'fastify';
import { AppError } from '@ecomm/app-error';
import { PriceService as PriceService } from '../../price/price.svc.ts';
import { type Price } from '../../price/price.ts';
import { type CreatePriceBody, type FindPriceQueryString, postPriceSchema } from '../../price/price.schemas.ts';

export default async function (server: FastifyInstance, opts: FastifyPluginOptions) {
  const service = PriceService.getInstance(server);

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
      reply: FastifyReply
    ) => {
      const result: Result<Price, AppError> = await service.createPrice(request.query.catalogId, request.body);

      if (result.isErr()) return reply.sendAppError(result.error);
      return reply.code(201).send(result.value);
    }
  });

  // GET
  server.route({
    method: 'GET',
    url: '/:id',
    //schema: postPriceSchema,
    handler: async (request, reply) => {
      const result: Result<Price, AppError> = await service.findPriceById('', '');
      if (result.isErr()) return reply.sendAppError(result.error);
      return reply.code(201).send(result.value);
    }
  });
}
