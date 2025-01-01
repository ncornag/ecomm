import { type Result, Ok, Err } from 'ts-results-es';
import { type FastifyInstance, FastifyPluginOptions, FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from '@ecomm/app-error';
import { PromotionService } from '../../promotion/promotion.svc.ts';
import {
  postPromotionSchema,
  updatePromotionSchema,
  type CreatePromotionBody,
  type FindPromotionParms,
  type UpdatePromotionBody,
  type CalculatePromotionQueryString
} from '../../promotion/promotion.schemas.ts';
import { type Promotion } from '../../promotion/promotion';

export default async function (server: FastifyInstance, opts: FastifyPluginOptions) {
  const service = PromotionService.getInstance(server);

  // CREATE
  server.route({
    method: 'POST',
    url: '/',
    schema: postPromotionSchema,
    handler: async (request: FastifyRequest<{ Body: CreatePromotionBody }>, reply: FastifyReply) => {
      const result: Result<Promotion, AppError> = await service.createPromotion(request.body);

      if (result.isErr()) return reply.sendAppError(result.error);
      return reply.code(201).send(result.value);
    }
  });

  // UPDATE
  server.route({
    method: 'PATCH',
    url: '/:id',
    schema: updatePromotionSchema,
    handler: async (
      request: FastifyRequest<{
        Params: FindPromotionParms;
        Body: UpdatePromotionBody;
      }>,
      reply: FastifyReply
    ) => {
      const result: Result<Promotion, AppError> = await service.updatePromotion(
        request.params.id,
        request.body.version,
        request.body.actions
      );

      if (result.isErr()) return reply.sendAppError(result.error);
      return reply.send(result.value);
    }
  });

  // GET
  server.route({
    method: 'GET',
    url: '/:id',
    handler: async (request: FastifyRequest<{ Params: FindPromotionParms }>, reply: FastifyReply) => {
      const result: Result<Promotion, AppError> = await service.findPromotionById(request.params.id);
      if (result.isErr()) return reply.sendAppError(result.error);
      return reply.send(result.value);
    }
  });

  // CALCULATE PROMOTIONS
  server.route({
    method: 'POST',
    url: '/calculate',
    handler: async (request: FastifyRequest<{ Querystring: CalculatePromotionQueryString }>, reply: FastifyReply) => {
      const result: Result<Promotion, AppError> = await service.calculate(
        request.query.cartId,
        request.body,
        request.query.promotionId
      );
      if (result.isErr()) return reply.sendAppError(result.error);
      return reply.send(result.value);
    }
  });
}
