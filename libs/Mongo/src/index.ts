import fp from 'fastify-plugin';
import { type FastifyPluginAsync } from 'fastify';
import mongo from '@fastify/mongodb';
import { green, red, magenta, yellow, bold } from 'kolorist';
import { Collection, Db } from 'mongodb';
import { requestId } from '@ecomm/request-context';
import pino from 'pino';

interface Database {
  mongo: typeof mongo;
  col: { [key: string]: Collection<any> | { [key: string]: Collection<any> } };
  repo: { [key: string]: any };
  getDb: (projectId: string) => Db;
  getCol: (projectId: string, entity: string, catalogId?: string) => Collection;
  collectionName: (projectId: string, entity: string, catalogId?: string) => string;
}

declare module 'fastify' {
  export interface FastifyInstance {
    db: Database;
  }
}

const mongoPlugin: FastifyPluginAsync = async (server) => {
  const dbs = new Map<string, Db>();

  const getDb = (projectId: string): Db => {
    const db = dbs.get(projectId);
    if (db) return db;
    const newDb = server.mongo.client.db(projectId);
    dbs.set(projectId, newDb);
    return newDb;
  };

  const getCol = (projectId: string, entity: string, catalogId?: string): Collection => {
    const col: Collection = getDb(projectId).collection(collectionName(projectId, entity, catalogId));
    return col;
  };

  const collectionName = (projectId: string, entity: string, catalogId?: string) => {
    return `${entity}${catalogId ? `_${catalogId}` : ''}`;
  };

  server.decorate('db', {
    getDb,
    getCol,
    collectionName,
    mongo,
    col: {},
    repo: {}
  });

  // Register
  const { MONGO_URL: mongoUrl } = server.config;
  await server.register(mongo, {
    forceClose: true,
    url: mongoUrl,
    monitorCommands: true
  });

  server.log.info(`${yellow('MongoDB')} ${green('starting in')} [${mongoUrl}]`);

  // Log
  const dbOut = bold(yellow('→')) + yellow('DB ');
  const dbIn = bold(yellow('←')) + yellow('DB ');
  const ignoredCommandsForLogging = ['createIndexes', 'listCollections', 'currentOp', 'drop'];
  const logger = server.log.child({}, { level: server.config.LOG_LEVEL_DB ?? server.config.LOG_LEVEL }) as pino.Logger;

  server.mongo.client.on('commandStarted', (event) => {
    if (ignoredCommandsForLogging.includes(event.commandName)) return;
    if (logger.isLevelEnabled('debug'))
      logger.debug(`${magenta('#' + requestId())} ${dbOut} ${event.requestId} ${green(JSON.stringify(event.command))}`);
  });
  server.mongo.client.on('commandSucceeded', (event) => {
    if (ignoredCommandsForLogging.includes(event.commandName)) return;
    if (logger.isLevelEnabled('debug'))
      logger.debug(`${magenta('#' + requestId())} ${dbIn} ${event.requestId} ${green(JSON.stringify(event.reply))}`);
  });
  server.mongo.client.on('commandFailed', (event) =>
    logger.warn(`${magenta('#' + requestId())} ${dbIn} ${event.requestId} ${red(JSON.stringify(event, null, 2))}`)
  );

  // Iterceptor targets
  const createTargets: string[] = ['insertOne'];
  const updateTargets: string[] = ['updateOne', 'updateMany', 'bulkWrite'];

  // Interceptors NegativeFilter
  const negativeFilterInterceptor: Record<string, boolean> = { _Events: true };

  // Create Interceptor -- Create timestamp / version
  const createOne = function (collectionName: string, data: any) {
    if (negativeFilterInterceptor[collectionName]) return data;
    // Add timestamp
    data.createdAt = new Date().toISOString();
    // Add version
    data.version = 0;
    return data;
  };
  const createInterceptor = function (obj: any, replace, name: string) {
    obj.prototype[name] = function (...args: any[]) {
      createOne((this as Collection).collectionName, args[0]);
      return replace.apply(this, args as any);
    };
  };

  // Update Interceptor -- Update timestamp / version
  const updateOne = function (this: any, collectionName: string, filter: any, update: any) {
    if (negativeFilterInterceptor[collectionName]) return { filter, update };
    const set = update.$set || {};
    const inc = update.$inc || {};
    // Version management
    const setVersion = set.version || 0;
    if (filter.version === undefined) {
      filter.version = setVersion;
    }
    delete set.version;
    // Update Timestamp
    set.lastModifiedAt = new Date().toISOString(); // TODO use server date?
    update.$set = set;
    // Update Version
    inc.version = 1;
    update.$inc = inc;
    return { filter, update };
  };
  const updateInterceptor = function (obj: any, replace, name: string) {
    obj.prototype[name] = function (...args: any[]) {
      const collectionName = (this as Collection).collectionName;
      if (Array.isArray(args[0])) {
        args[0] = args[0].map((a) => {
          if (a.updateOne) {
            return {
              updateOne: updateOne(collectionName, a.updateOne.filter, a.updateOne.update)
            };
          } else if (a.insertOne) {
            return {
              insertOne: {
                document: createOne(collectionName, a.insertOne.document)
              }
            };
          }
          return a;
        });
      } else {
        updateOne(collectionName, args[0], args[1]);
      }
      return replace.apply(this, args as any);
    };
  };

  // Intercept
  createTargets.forEach((m: string) => createInterceptor(Collection, (Collection.prototype as any)[m], m));
  updateTargets.forEach((m: string) => updateInterceptor(Collection, (Collection.prototype as any)[m], m));
};

export default fp(mongoPlugin, {
  fastify: '5.x',
  name: 'mongo-plugin'
});
