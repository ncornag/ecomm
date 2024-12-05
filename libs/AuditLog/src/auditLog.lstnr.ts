import { green, red, magenta, yellow, bold } from 'kolorist';
import { type IAuditLogService, AuditLogService } from './auditLog.svc';
import pino from 'pino';

export class AuditLogListener {
  private server: any;
  private service: IAuditLogService;
  private msgIn = bold(yellow('←')) + yellow('AUDITLOG:');
  private TOPIC = '*.*.update';
  private logger: pino.Logger;

  constructor(server: any) {
    this.server = server;
    this.service = AuditLogService.getInstance(server);
    this.logger = server.log.child(
      {},
      { level: server.config.LOG_LEVEL_AUDITLOG ?? server.config.LOG_LEVEL },
    ) as pino.Logger;
  }

  public start() {
    this.server.log.info(
      `${yellow('AuditLogService')} ${green('listening to')} [${this.TOPIC}]`,
    );
    this.server.messages.subscribe(this.TOPIC, this.handler.bind(this));
  }

  private handler = async (data: any, server: any) => {
    if (!data.metadata.entity) return;
    if (this.logger.isLevelEnabled('debug')) {
      const txt = `${data.metadata.projectId}:${data.metadata.catalogId}:${data.metadata.entity}:${data.source.id} ${JSON.stringify(data.difference)}`;
      this.logger.debug(
        `${magenta('#' + data.metadata.requestId || '')} ${this.msgIn} logging ${green(txt)}`,
      );
    }

    this.service.createAuditLog({
      entity: data.metadata.entity,
      entityId: data.source.id,
      catalogId: data.metadata.catalogId,
      updateType: data.metadata.type,
      source: data.source,
      edits: data.difference,
    });
  };
}

export const auditLogListener = (server: any) => {
  return new AuditLogListener(server).start();
};
