import { green, magenta, yellow, bold } from 'kolorist';
import pino from 'pino';
import type { RecordedEvent } from '@ecomm/event-store';
import { type IProductService, ProductService } from '../product/product.svc.ts';
import { type ProductEvent, ProductEventTypes, type ProductUpdated } from '../product/product.events.ts';
import type { Event, Command } from '@ecomm/event-store';
import { type ProductCategoryEvent, ProductCategoryEventTypes } from '../productCategory/productCategory.events.ts';
import {
  type ClassificationCategoryEvent,
  ClassificationCategoryEventTypes
} from '../classificationCategory/classificationCategory.events.ts';
import { ProductCategoryService } from '../productCategory/productCategory.svc.ts';
import { ClassificationCategoryService } from '../classificationCategory/classificationCategory.svc.ts';

export class ProjectorListener {
  private server: any;
  private msgIn = bold(yellow('←')) + yellow('PRO');
  private logger: pino.Logger;

  constructor(server: any) {
    this.server = server;
    this.logger = server.log.child(
      {},
      { level: server.config.LOG_LEVEL_PROJECTOR ?? server.config.LOG_LEVEL }
    ) as pino.Logger;
  }

  public start() {
    const TOPIC = 'es.*.*';
    this.server.queues.subscribe(
      'es.*.product',
      this.createHandler<ProductEvent>(
        ProductEventTypes.CREATED,
        [ProductEventTypes.UPDATED],
        ProductService.getInstance(this.server),
        'productId'
      ).bind(this)
    );
    this.server.queues.subscribe(
      'es.*.productCategory',
      this.createHandler<ProductCategoryEvent>(
        ProductCategoryEventTypes.CREATED,
        [ProductCategoryEventTypes.UPDATED],
        ProductCategoryService.getInstance(this.server),
        'productCategoryId'
      ).bind(this)
    );
    this.server.queues.subscribe(
      'es.*.classificationCategory',
      this.createHandler<ClassificationCategoryEvent>(
        ClassificationCategoryEventTypes.CREATED,
        [ClassificationCategoryEventTypes.UPDATED, ClassificationCategoryEventTypes.ATTRIBUTE_CREATED],
        ClassificationCategoryService.getInstance(this.server),
        'classificationCategoryId'
      ).bind(this)
    );

    this.server.log.info(`${yellow('ProjectorService')} ${green('listening to')} [${TOPIC}]`);
  }
  classificationCategoryService<T>(CREATED: string, UPDATED: string, classificationCategoryService: any, arg3: string) {
    throw new Error('Method not implemented.');
  }
  productCategoryService<T>(CREATED: string, UPDATED: string, productCategoryService: any, arg3: string) {
    throw new Error('Method not implemented.');
  }

  private toDAO = ({ id, ...remainder }) => ({
    _id: id,
    ...remainder
  });

  private createHandler =
    <T extends Event>(createdType: string, updatedType: string[], service: any, idName: string) =>
    async (event: RecordedEvent<T>) => {
      if (this.logger.isLevelEnabled('debug')) {
        const txt = `${event.metadata.projectId}:${event.metadata.catalogId ? event.metadata.catalogId + ':' : ''}${event.metadata.entity}:${event.streamName}`;
        this.logger.debug(`${magenta('#' + (event.requestId || ''))} ${this.msgIn} aggregatting entity ${green(txt)}`);
      }

      const col = this.server.db.getCol(event.metadata.projectId, event.metadata.entity, event.metadata.catalogId);

      if (event.type === createdType) {
        // Verify the entity doesn't exists
        const entity = await service.aggregate(undefined as any, event);
        if (entity.isErr()) {
          this.logger.error(entity.isErr());
          return;
        }
        // Save the entity
        const result = await col.insertOne(this.toDAO(entity.value.entity));
        if (result.acknowledged === false) {
          this.logger.error(
            `${magenta('#' + (event.requestId || ''))} ${this.msgIn} ${green('Error saving event')} [${event.id}]`
          );
          return;
        }
      } else if (updatedType.includes(event.type)) {
        // Verify the entity exists
        const entity = await col.findOne({
          _id: event.data[idName],
          version: event.metadata.expectedVersion
        });
        if (entity === null) {
          this.logger.error(
            `${magenta('#' + (event.requestId || ''))} ${this.msgIn} ${green('Error getting entity')} [${event.data[idName]}:${event.metadata.expectedVersion}]`
          );
          return;
        }
        // Aggregate the last event
        const aggregateResult = await service.aggregate(entity, event);
        if (aggregateResult.isErr()) {
          this.logger.error(aggregateResult.isErr());
          return;
        }
        // Update the entity
        const updateResult = await col.updateOne(
          {
            _id: event.data[idName],
            version: event.metadata.expectedVersion
          },
          aggregateResult.value.update
        );
        if (updateResult.acknowledged === false) {
          this.logger.error(
            `${magenta('#' + (event.requestId || ''))} ${this.msgIn} ${green('Error updating entity')} [${event.data[idName]}:${event.metadata.expectedVersion}]`
          );
          return;
        }
      } else {
        this.logger.error(
          `${magenta('#' + (event.requestId || ''))} ${this.msgIn} ${green('Type not implemented:')} [${event.type}]`
        );
      }
    };
}

export const projectorListener = (server: any) => {
  return new ProjectorListener(server).start();
};
