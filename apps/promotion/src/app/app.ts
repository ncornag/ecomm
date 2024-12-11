import * as path from 'path';
import { FastifyInstance } from 'fastify';
import AutoLoad from '@fastify/autoload';
import queues from '@ecomm/Queues';
import {
  AuditLogRepository,
  getAuditLogCollection,
  auditLogListener,
} from '@ecomm/AuditLog';
import {
  getPromotionCollection,
  PromotionRepository,
} from './promotion/promotion.repo';

/* eslint-disable-next-line */
export interface AppOptions {}

export async function app(server: FastifyInstance, opts: AppOptions) {
  // Register plugins
  await server.register(queues);

  // Print Routes
  if (server.config.PRINT_ROUTES === true) {
    const importDynamic = new Function(
      'modulePath',
      'return import(modulePath)',
    );
    const fastifyPrintRoutes = await importDynamic('fastify-print-routes');
    await server.register(fastifyPrintRoutes);
  }

  // Register Collections
  server.db.col.promotion = getPromotionCollection(server.mongo.db!);
  server.db.col.auditLog = getAuditLogCollection(server.mongo.db!);

  // Register Repositories
  server.db.repo.promotionRepository = new PromotionRepository(server);
  server.db.repo.auditLogRepository = new AuditLogRepository(server);

  // Indexes
  const indexes: Promise<any>[] = [];
  indexes.push(
    server.db.col.auditLog.createIndex(
      { projectId: 1, catalogId: 1, entity: 1, entityId: 1 },
      { name: 'CCA_Key' },
    ),
  );
  await Promise.all(indexes);

  // Load Listeners
  auditLogListener(server);

  // // Register plugins
  // server.register(AutoLoad, {
  //   dir: path.join(__dirname, 'plugins'),
  //   options: { ...opts },
  // });

  // Register Routes
  server.register(AutoLoad, {
    dir: path.join(__dirname, 'routes'),
    options: { ...opts },
  });
}
