import { type Result, Ok, Err } from 'ts-results-es';
import { type FastifyInstance, type FastifyPluginOptions, type FastifyReply, type FastifyRequest } from 'fastify';
import { AppError } from '@ecomm/app-error';
import {
  type CreateProductCategoryBody,
  type UpdateProductCategoryBody,
  type FindProductCategoryParms,
  postProductCategorySchema,
  updateProductCategorySchema
} from '../../productCategory/productCategory.schemas.ts';
import { ProductCategoryService } from '../../productCategory/productCategory.svc.ts';
import { type ProductCategory } from '../../productCategory/productCategory.ts';
import { type ProjectBasedParams } from '../../base.schemas.ts';
import { nanoid } from 'nanoid';
import { projectId } from '@ecomm/request-context';
import {
  ProductCategoryCommandTypes,
  type ProductCategoryEvent,
  toStreamName
} from '../../productCategory/productCategory.events.ts';

export default async function (server: FastifyInstance, opts: FastifyPluginOptions) {
  const service = ProductCategoryService.getInstance(server);

  // CREATE
  server.route({
    method: 'POST',
    url: '/',
    config: { scopes: ['catalog:write'] },
    schema: postProductCategorySchema,
    handler: async (
      request: FastifyRequest<{
        Params: ProjectBasedParams;
        Body: CreateProductCategoryBody;
      }>,
      reply: FastifyReply
    ) => {
      const id = nanoid();
      const eventStoreResult = await server.es.create(service.create, toStreamName(id), {
        type: ProductCategoryCommandTypes.CREATE,
        data: {
          productCategory: request.body
        },
        metadata: {
          projectId: projectId(),
          id
        }
      });
      if (eventStoreResult.isErr()) return reply.sendAppError(eventStoreResult.error);
      return reply.code(201).send({
        ...eventStoreResult.value.data.productCategory,
        version: eventStoreResult.value.metadata.version
      });
    }
  });

  // UPDATE
  server.route({
    method: 'PATCH',
    url: '/:id',
    config: { scopes: ['catalog:write'] },
    schema: updateProductCategorySchema,
    handler: async (
      request: FastifyRequest<{
        Params: UpdateProductCategoryParms;
        Body: UpdateProductCategoryBody;
      }>,
      reply: FastifyReply
    ) => {
      const eventStoreResult = await server.es.update(
        service.update,
        toStreamName(request.params.id),
        request.body.version,
        {
          type: ProductCategoryCommandTypes.UPDATE,
          data: {
            productCategoryId: request.params.id,
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
    handler: async (request: FastifyRequest<{ Params: FindProductCategoryParms }>, reply: FastifyReply) => {
      const result: Result<ProductCategory, AppError> = await service.findProductCategoryById(request.params.id);
      if (result.isErr()) return reply.sendAppError(result.error);
      return reply.send(result.value);
    }
  });

  // GET the entity from the Stream
  server.route({
    method: 'GET',
    url: '/:id/es',
    config: { scopes: ['catalog:read'] },
    handler: async (request: FastifyRequest<{ Params: FindProductCategoryParms }>, reply: FastifyReply) => {
      const result = await server.es.aggregateStream<ProductCategory, ProductCategoryEvent>(
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
    handler: async (request: FastifyRequest<{ Params: FindProductCategoryParms }>, reply: FastifyReply) => {
      const result: Result<boolean, AppError> = await service.validate(request.params.id, request.body);
      if (result.isErr()) return reply.sendAppError(result.error);
      return reply.send(result.value);
    }
  });
}
