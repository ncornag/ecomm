import { green, magenta, yellow, bold } from 'kolorist';
import pino from 'pino';
import type { RecordedEvent } from '@ecomm/event-store';
import { type IProductService, ProductService } from '../product/product.svc.ts';
import { type ProductEvent, ProductEventTypes, type ProductUpdated } from './product.events.ts';

export class ProjectorListener {
  private server: any;
  private msgIn = bold(yellow('←')) + yellow('AGR');
  private logger: pino.Logger;
  private productService: IProductService;

  constructor(server: any) {
    this.server = server;
    this.productService = ProductService.getInstance(server);
    this.logger = server.log.child(
      {},
      { level: server.config.LOG_LEVEL_AGGREGATOR ?? server.config.LOG_LEVEL }
    ) as pino.Logger;
  }

  public start() {
    const TOPIC = 'es.*.product';
    this.server.queues.subscribe(TOPIC, this.handler.bind(this));
    this.server.log.info(`${yellow('AggregatorService')} ${green('listening to')} [${TOPIC}]`);
  }

  private toDAO = ({ id, ...remainder }) => ({
    _id: id,
    ...remainder
  });

  private handler = async (event: RecordedEvent<ProductEvent>) => {
    if (this.logger.isLevelEnabled('debug')) {
      const txt = `${event.metadata.projectId}:${event.metadata.catalogId}:${event.metadata.entity}:${event.streamName}`;
      this.logger.debug(`${magenta('#' + (event.requestId || ''))} ${this.msgIn} aggregatting entity ${green(txt)}`);
    }

    const db = await this.server.db.getDb(event.metadata.projectId);

    const col = this.server.db.getCol(event.metadata.projectId, event.metadata.entity, event.metadata.catalogId);

    if (event.type === ProductEventTypes.CREATED) {
      const entity = await this.productService.aggregate(undefined as any, event);
      if (entity.isErr()) {
        this.logger.error(entity.isErr());
        return;
      }
      const result = await col.insertOne(this.toDAO(entity.value.entity));
      if (result.acknowledged === false) {
        this.logger.error(
          `${magenta('#' + (event.requestId || ''))} ${this.msgIn} ${green('Error saving event')} [${event.id}]`
        );
        return;
      }
    } else if (event.type === ProductEventTypes.UPDATED) {
      const e = event as ProductUpdated;
      const entity = await col.findOne({
        _id: e.data.productId,
        version: event.metadata.expectedVersion
      });
      if (entity === null) {
        this.logger.error(
          `${magenta('#' + (event.requestId || ''))} ${this.msgIn} ${green('Error getting entity')} [${e.data.productId}:${event.metadata.expectedVersion}]`
        );
        return;
      }
      const aggregateResult = await this.productService.aggregate(entity, event);
      if (aggregateResult.isErr()) {
        this.logger.error(aggregateResult.isErr());
        return;
      }
      const updateResult = await col.updateOne(
        {
          _id: e.data.productId,
          version: event.metadata.expectedVersion
        },
        aggregateResult.value.update
      );
      if (updateResult.acknowledged === false) {
        this.logger.error(
          `${magenta('#' + (event.requestId || ''))} ${this.msgIn} ${green('Error updating entity')} [${e.data.productId}:${event.metadata.expectedVersion}]`
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
