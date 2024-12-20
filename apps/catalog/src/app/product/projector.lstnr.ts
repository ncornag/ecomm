import { green, magenta, yellow, bold } from 'kolorist';
import pino from 'pino';
import { RecordedEvent } from '@ecomm/EventStore';
import { type IProductService, ProductService } from '../product/product.svc';
import { ProductEvent } from './product.events';

export class ProjectorListener {
  private server: any;
  private msgIn = bold(yellow('←')) + yellow('AGGREGATOR:');
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
    // this.server.queues.subscribe(
    //   'es.create',
    //   this.createEntityHandler.bind(this),
    // );
    // this.server.queues.subscribe(
    //   'es.update',
    //   this.updateEntityHandler.bind(this),
    // );
    const TOPIC = `es.${this.server.config.PROJECTID}.product`;
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
      const txt = `${event.projectId}:${event.metadata.catalogId}:${event.metadata.entity}:${event.streamName}`;
      this.logger.debug(
        `${magenta('#' + event.requestId || '')} ${this.msgIn} logging ${green(txt)}`,
      );
    }
    const catalogName = event.metadata.catalogId
      ? `_${event.metadata.catalogId}`
      : '';
    const col = this.server.mongo.db.collection(
      `${event.projectId}_${event.metadata.entity}${catalogName}`,
    );
    if (event.type === 'product-created') {
      const entity = await this.productService.aggregate(
        undefined as any,
        event,
      );
      if (entity.err) {
        this.logger.error(entity.err);
        return;
      }
      const result = await col.insertOne(this.toDAO(entity.val));
      console.dir(entity.val, { depth: 15 });
    } else {
      console.log('not implemented yet');
    }
  };

  private createEntityHandler = async (data: any, server: any) => {
    console.log('createEntityHandler');
    if (
      !data.metadata.catalogId ||
      !data.metadata.entity ||
      data.metadata.type !== 'entityCreated'
    ) {
      this.logger.error(
        `Error indexing ${data.metadata.projectId}:${data.metadata.catalogId}:${data.metadata.entity}:${data.source.id}`,
      );
      return;
    }
    // if (this.logger.isLevelEnabled('debug')) {
    //   const txt = `${data.metadata.projectId}:${data.metadata.catalogId}:${data.metadata.entity}:${data.source.id}`;
    //   this.logger.debug(
    //     `${magenta('#' + data.metadata.requestId || '')} ${this.msgIn} logging ${green(txt)}`,
    //   );
    // }
    const catalogName = data.metadata.catalogId
      ? '_' + data.metadata.catalogId
      : '';
    const col = this.server.mongo.db.collection(
      `${data.metadata.projectId}_${data.metadata.entity}${catalogName}`,
    );
    await col.insertOne(this.toDAO(data.source));
    console.dir(data);
  };
  private updateEntityHandler = async (data: any, server: any) => {
    console.log('updateEntityHandler');
    if (
      !data.metadata.catalogId ||
      !data.metadata.entity ||
      !data.update ||
      data.metadata.type !== 'entityUpdated'
    ) {
      this.logger.error(
        `Error indexing ${data.metadata.projectId}:${data.metadata.catalogId}:${data.metadata.entity}:${data.source.id}`,
      );
      return;
    }
    // if (this.logger.isLevelEnabled('debug')) {
    //   const txt = `${data.metadata.projectId}:${data.metadata.catalogId}:${data.metadata.entity}:${data.source.id} ${JSON.stringify(data.difference)}`;
    //   this.logger.debug(
    //     `${magenta('#' + data.metadata.requestId || '')} ${this.msgIn} logging ${green(txt)}`,
    //   );
    // }
    const catalogName = data.metadata.catalogId
      ? '_' + data.metadata.catalogId
      : '';
    const col = this.server.mongo.db.collection(
      `${data.metadata.projectId}_${data.metadata.entity}${catalogName}`,
    );
    console.dir(data, { depth: 5 });
    await col.updateOne(
      {
        _id: data.source.id,
        version: data.source.version,
      },
      data.update,
    );
  };
}

export const projectorListener = (server: any) => {
  return new ProjectorListener(server).start();
};
