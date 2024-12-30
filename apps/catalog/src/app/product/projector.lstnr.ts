import { green, magenta, yellow, bold } from 'kolorist';
import pino from 'pino';
import { RecordedEvent } from '@ecomm/EventStore';
import { type IProductService, ProductService } from '../product/product.svc';
import { ProductEvent, ProductUpdated } from './product.events';

export const collectionName = (
  projectId: string,
  entity: string,
  catalogId?: string,
) => {
  return `${projectId}_${entity}${catalogId ? `_${catalogId}` : ''}`;
};

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
      { level: server.config.LOG_LEVEL_AGGREGATOR ?? server.config.LOG_LEVEL },
    ) as pino.Logger;
  }

  public start() {
    const TOPIC = 'es.*.product';
    this.server.queues.subscribe(TOPIC, this.handler.bind(this));
    this.server.log.info(
      `${yellow('AggregatorService')} ${green('listening to')} [${TOPIC}]`,
    );
  }

  private toDAO = ({ id, ...remainder }) => ({
    _id: id,
    ...remainder,
  });

  private handler = async (event: RecordedEvent<ProductEvent>) => {
    if (this.logger.isLevelEnabled('debug')) {
      const txt = `${event.metadata.projectId}:${event.metadata.catalogId}:${event.metadata.entity}:${event.streamName}`;
      this.logger.debug(
        `${magenta('#' + (event.requestId || ''))} ${this.msgIn} aggregatting entity ${green(txt)}`,
      );
    }

    const colName = collectionName(
      event.metadata.projectId,
      event.metadata.entity,
      event.metadata.catalogId,
    );
    const col = this.server.mongo.db!.collection(colName);

    if (event.type === 'product-created') {
      const entity = await this.productService.aggregate(
        undefined as any,
        event,
      );
      if (entity.err) {
        this.logger.error(entity.err);
        return;
      }
      const result = await col.insertOne(this.toDAO(entity.val.entity));
      if (result.acknowledged === false) {
        this.logger.error(
          `${magenta('#' + (event.requestId || ''))} ${this.msgIn} ${green('Error saving event')} [${event.id}]`,
        );
        return;
      }
    } else if (event.type === 'product-updated') {
      const e = event as ProductUpdated;
      const entity = await col.findOne({
        _id: e.data.productId,
        version: event.metadata.expectedVersion,
      });
      if (entity === null) {
        this.logger.error(
          `${magenta('#' + (event.requestId || ''))} ${this.msgIn} ${green('Error getting entity')} [${e.data.productId}:${event.metadata.expectedVersion}]`,
        );
        return;
      }
      const aggregateResult = await this.productService.aggregate(
        entity,
        event,
      );
      if (aggregateResult.err) {
        this.logger.error(aggregateResult.err);
        return;
      }
      const updateResult = await col.updateOne(
        {
          _id: e.data.productId,
          version: event.metadata.expectedVersion,
        },
        aggregateResult.val.update,
      );
      if (updateResult.acknowledged === false) {
        this.logger.error(
          `${magenta('#' + (event.requestId || ''))} ${this.msgIn} ${green('Error updating entity')} [${e.data.productId}:${event.metadata.expectedVersion}]`,
        );
        return;
      }
    } else {
      this.logger.error(
        `${magenta('#' + (event.requestId || ''))} ${this.msgIn} ${green('Type not implemented:')} [${event.type}]`,
      );
    }
  };
}

export const projectorListener = (server: any) => {
  return new ProjectorListener(server).start();
};
