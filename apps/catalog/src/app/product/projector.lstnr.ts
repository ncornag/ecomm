import { green, magenta, yellow, bold } from 'kolorist';
import { type IAuditLogService, AuditLogService } from '@ecomm/AuditLog';
import pino from 'pino';

export class ProjectorListener {
  private server: any;
  private service: IAuditLogService;
  private msgIn = bold(yellow('←')) + yellow('AUDITLOG:');
  private TOPIC = '*.*.events';
  private logger: pino.Logger;

  constructor(server: any) {
    this.server = server;
    this.service = AuditLogService.getInstance(server);
    this.logger = server.log.child(
      {},
      //{ level: server.config.LOG_LEVEL_AUDITLOG ?? server.config.LOG_LEVEL },
      { level: 'debug' },
    ) as pino.Logger;
  }

  public start() {
    this.server.log.info(
      `${yellow('AuditLogService')} ${green('listening to')} [${this.TOPIC}]`,
    );
    this.server.queues.subscribe(
      'es.create',
      this.createEntityHandler.bind(this),
    );
    this.server.queues.subscribe(
      'es.update',
      this.updateEntityHandler.bind(this),
    );
  }

  private toDAO = ({ id, ...remainder }) => ({
    _id: id,
    ...remainder,
  });

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
