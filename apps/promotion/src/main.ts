import * as path from 'path';
import { type FastifyInstance } from 'fastify';
import AutoLoad from '@fastify/autoload';
import queues from '@ecomm/queues';
import { AuditLogRepository, getAuditLogCollection, auditLogListener } from '@ecomm/audit-log';
import { getPromotionCollection, PromotionRepository } from './promotion/promotion.repo.ts';
import { config } from './app/lib/config.ts';

export async function app(server: FastifyInstance) {
  // Load Config
  server.decorate('config', config);

  // Register plugins
  await server.register(queues, {
    NATS_URL: server.config.NATS_URL,
    LOG_LEVEL_NATS: server.config.LOG_LEVEL_NATS,
    LOG_LEVEL: server.config.LOG_LEVEL
  });

  // Register Collections
  server.db.col.promotion = getPromotionCollection(server.mongo.db!);
  server.db.col.auditLog = getAuditLogCollection(server.mongo.db!);

  // Register Repositories
  server.db.repo.promotionRepository = new PromotionRepository(server);
  server.db.repo.auditLogRepository = new AuditLogRepository(server);

  // Indexes
  // TODO: Move to migrations
  const indexes: Promise<any>[] = [];
  indexes.push(
    server.db.col.auditLog.createIndex({ projectId: 1, catalogId: 1, entity: 1, entityId: 1 }, { name: 'CCA_Key' })
  );
  await Promise.all(indexes);

  // Load Listeners
  auditLogListener(server);

  // // Register plugins
  // server.register(AutoLoad, {
  //   dir: path.join(__dirname, 'plugins'),
  //   options: { ... },
  // });

  // Register Routes
  server.register(AutoLoad, {
    dir: path.join(import.meta.dirname, 'app/routes'),
    options: { prefix: ':projectId' }
  });
}
