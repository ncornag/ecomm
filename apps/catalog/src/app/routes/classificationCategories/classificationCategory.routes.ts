import { type Result, Ok, Err } from 'ts-results-es';
import { type FastifyRequest, type FastifyReply, type FastifyInstance, type FastifyPluginOptions } from 'fastify';
import { AppError } from '@ecomm/app-error';
import {
  type CreateClassificationCategoryBody,
  type FindClassificationCategoryParms,
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
import { type ProjectBasedParams } from '../../base.schemas.ts';
import { nanoid } from 'nanoid';
import {
  ClassificationCategoryCommandTypes,
  type ClassificationCategoryEvent,
  toStreamName
} from '../../classificationCategory/classificationCategory.events.ts';
import { projectId } from '@ecomm/request-context';

export default async function (server: FastifyInstance, opts: FastifyPluginOptions) {
  const service = ClassificationCategoryService.getInstance(server);

  // CREATE
  server.route({
    method: 'POST',
    url: '/',
    config: { scopes: ['catalog:write'] },
    schema: postClassificationCategorySchema,
    handler: async (
      request: FastifyRequest<{
        Params: ProjectBasedParams;
        Body: CreateClassificationCategoryBody;
      }>,
      reply: FastifyReply
    ) => {
      const id = nanoid();
      const eventStoreResult = await server.es.create(service.create, toStreamName(id), {
        type: ClassificationCategoryCommandTypes.CREATE,
        data: {
          classificationCategory: request.body
        },
        metadata: {
          projectId: projectId(),
          id
        }
      });
      if (eventStoreResult.isErr()) return reply.sendAppError(eventStoreResult.error);
      return reply.code(201).send({
        ...eventStoreResult.value.data.classificationCategory,
        version: eventStoreResult.value.metadata.version
      });
    }
  });

  // UPDATE
  server.route({
    method: 'PATCH',
    url: '/:id',
    config: { scopes: ['catalog:write'] },
    schema: updateClassificationCategorySchema,
    handler: async (
      request: FastifyRequest<{
        Params: UpdateClassificationCategoryParms;
        Body: UpdateClassificationCategoryBody;
      }>,
      reply: FastifyReply
    ) => {
      const eventStoreResult = await server.es.update(
        service.update,
        toStreamName(request.params.id),
        request.body.version,
        {
          type: ClassificationCategoryCommandTypes.UPDATE,
          data: {
            classificationCategoryId: request.params.id,
            actions: request.body.actions
          },
          metadata: {
            projectId: projectId(),
            expectedVersion: request.body.version
          }
        }
      );
      if (eventStoreResult.isErr()) return reply.sendAppError(eventStoreResult.error);
      return reply.send({
        ...eventStoreResult.value.metadata.expected,
        version: eventStoreResult.value.metadata.version
      });
    }
  });

  // GET the entity from the ReadModel
  server.route({
    method: 'GET',
    url: '/:id',
    config: { scopes: ['catalog:read'] },
    handler: async (request: FastifyRequest<{ Params: FindClassificationCategoryParms }>, reply: FastifyReply) => {
      const result: Result<ClassificationCategory, AppError> = await service.findClassificationCategoryById(
        request.params.id
      );
      if (result.isErr()) return reply.sendAppError(result.error);
      return reply.send(result.value);
    }
  });

  // GET the entity from the Stream
  server.route({
    method: 'GET',
    url: '/:id/es',
    config: { scopes: ['catalog:read'] },
    handler: async (request: FastifyRequest<{ Params: FindClassificationCategoryParms }>, reply: FastifyReply) => {
      const result = await server.es.aggregateStream<ClassificationCategory, ClassificationCategoryEvent>(
        projectId(),
        toStreamName(request.params.id),
        service.aggregate
      );
      if (result.isErr()) return reply.sendAppError(result.error);
      return reply.send(result.value);
    }
  });

  // VALIDATE
  server.route({
    method: 'POST',
    url: '/:id/validate',
    config: { scopes: ['catalog:read'] },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const result: Result<Boolean, AppError> = await service.validate((request.params as any).id, request.body as any);
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
