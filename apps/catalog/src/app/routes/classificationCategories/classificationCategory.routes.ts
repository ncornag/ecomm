import { type Result, Ok, Err } from 'ts-results-es';
import { type FastifyRequest, type FastifyReply, type FastifyInstance, type FastifyPluginOptions } from 'fastify';
import { AppError } from '@ecomm/app-error';
import {
  type ClassificationCategoryPayload,
  type UpdateClassificationCategoryBody,
  type UpdateClassificationCategoryParms,
  postClassificationCategorySchema,
  updateClassificationCategorySchema
} from '../../classificationCategory/classificationCategory.schemas.ts';
import {
  type ClassificationAttributePayload,
  postClassificationAttributeSchema
} from '../../classificationCategory/classificationAttribute.schemas.ts';
import { ClassificationCategoryService } from '../../classificationCategory/classificationCategory.svc.ts';
import { type ClassificationCategory } from '../../classificationCategory/classificationCategory.ts';
import { type ClassificationAttribute } from '../../classificationCategory/classificationAttribute.ts';

export default async function (server: FastifyInstance, opts: FastifyPluginOptions) {
  const service = ClassificationCategoryService.getInstance(server);

  // CREATE
  server.route({
    method: 'POST',
    url: '/',
    schema: postClassificationCategorySchema,
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const result: Result<ClassificationCategory, AppError> = await service.createClassificationCategory(
        request.body as ClassificationCategoryPayload
      );

      if (result.isErr()) return reply.sendAppError(result.error);
      return reply.code(201).send(result.value);
    }
  });

  // UPDATE
  server.route({
    method: 'PATCH',
    url: '/:id',
    schema: updateClassificationCategorySchema,
    handler: async (
      request: FastifyRequest<{
        Params: UpdateClassificationCategoryParms;
        Body: UpdateClassificationCategoryBody;
      }>,
      reply: FastifyReply
    ) => {
      const { id } = request.params;
      const { version, actions } = request.body;
      const result: Result<ClassificationCategory, AppError> = await service.updateClassificationCategory(
        id,
        version,
        actions
      );

      if (result.isErr()) return reply.sendAppError(result.error);
      return reply.send(result.value);
    }
  });

  // GET
  server.route({
    method: 'GET',
    url: '/:id',
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const result: Result<ClassificationCategory, AppError> = await service.findClassificationCategoryById(
        (request.params as any).id
      );
      if (result.isErr()) return reply.sendAppError(result.error);
      return reply.send(result.value);
    }
  });

  // VALIDATE
  server.route({
    method: 'POST',
    url: '/:id/validate',
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const result: Result<Boolean, AppError> = await service.valueidate(
        (request.params as any).id,
        request.body as any
      );
      if (result.isErr()) return reply.sendAppError(result.error);
      return reply.send(result.value);
    }
  });

  // CREATE ATTRIBUTE
  server.route({
    method: 'POST',
    url: '/:id/attributes',
    schema: postClassificationAttributeSchema,
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const result: Result<ClassificationAttribute, AppError> = await service.createClassificationAttribute(
        (request.params as any).id,
        (request.params as any).version,
        request.body as ClassificationAttributePayload
      );
      if (result.isErr()) return reply.sendAppError(result.error);
      return reply.code(201).send(result.value);
    }
  });

  // GET ATTRIBUTE
  server.route({
    method: 'GET',
    url: '/:id/attributes/:attributeId',
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const result: Result<ClassificationAttribute, AppError> = await service.findClassificationAttributeById(
        (request.params as any).id,
        (request.params as any).attributeId
      );

      if (result.isErr()) return reply.sendAppError(result.error);
      return reply.send(result.value);
    }
  });
}
