import { type Result, Ok, Err } from 'ts-results';
import {
  type FastifyRequest,
  type FastifyReply,
  type FastifyInstance,
  type FastifyPluginOptions,
} from 'fastify';
import { AppError } from '@ecomm/AppError';
import {
  type ClassificationCategoryPayload,
  type UpdateClassificationCategoryBody,
  type UpdateClassificationCategoryParms,
  postClassificationCategorySchema,
  updateClassificationCategorySchema,
} from '../../classificationCategory/classificationCategory.schemas';
import {
  type ClassificationAttributePayload,
  postClassificationAttributeSchema,
} from '../../classificationCategory/classificationAttribute.schemas';
import { ClassificationCategoryService } from '../../classificationCategory/classificationCategory.svc';
import { type ClassificationCategory } from '../../classificationCategory/classificationCategory';
import { type ClassificationAttribute } from '../../classificationCategory/classificationAttribute';

export default async function (
  server: FastifyInstance,
  opts: FastifyPluginOptions,
) {
  const service = ClassificationCategoryService.getInstance(server);

  // CREATE
  server.route({
    method: 'POST',
    url: '/',
    schema: postClassificationCategorySchema,
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const result: Result<ClassificationCategory, AppError> =
        await service.createClassificationCategory(
          request.body as ClassificationCategoryPayload,
        );

      if (!result.ok) return reply.sendAppError(result.val);
      return reply.code(201).send(result.val);
    },
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
      reply: FastifyReply,
    ) => {
      const { id } = request.params;
      const { version, actions } = request.body;
      const result: Result<ClassificationCategory, AppError> =
        await service.updateClassificationCategory(id, version, actions);

      if (!result.ok) return reply.sendAppError(result.val);
      return reply.send(result.val);
    },
  });

  // GET
  server.route({
    method: 'GET',
    url: '/:id',
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const result: Result<ClassificationCategory, AppError> =
        await service.findClassificationCategoryById(
          (request.params as any).id,
        );
      if (!result.ok) return reply.sendAppError(result.val);
      return reply.send(result.val);
    },
  });

  // VALIDATE
  server.route({
    method: 'POST',
    url: '/:id/validate',
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const result: Result<Boolean, AppError> = await service.validate(
        (request.params as any).id,
        request.body as any,
      );
      if (!result.ok) return reply.sendAppError(result.val);
      return reply.send(result.val);
    },
  });

  // CREATE ATTRIBUTE
  server.route({
    method: 'POST',
    url: '/:id/attributes',
    schema: postClassificationAttributeSchema,
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const result: Result<ClassificationAttribute, AppError> =
        await service.createClassificationAttribute(
          (request.params as any).id,
          (request.params as any).version,
          request.body as ClassificationAttributePayload,
        );
      if (!result.ok) return reply.sendAppError(result.val);
      return reply.code(201).send(result.val);
    },
  });

  // GET ATTRIBUTE
  server.route({
    method: 'GET',
    url: '/:id/attributes/:attributeId',
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const result: Result<ClassificationAttribute, AppError> =
        await service.findClassificationAttributeById(
          (request.params as any).id,
          (request.params as any).attributeId,
        );

      if (!result.ok) return reply.sendAppError(result.val);
      return reply.send(result.val);
    },
  });
}
