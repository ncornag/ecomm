import fp from 'fastify-plugin';
import { FastifyPluginAsync } from 'fastify';
import mongo from '@fastify/mongodb';
import { green, red, magenta, yellow, bold } from 'kolorist';
import { Collection } from 'mongodb';
import { Umzug, MongoDBStorage } from 'umzug';
import { requestContext } from '@fastify/request-context';
import { Type } from '@fastify/type-provider-typebox';
import {
  REQUEST_ID_STORE_KEY,
  PROJECT_ID_STORE_KEY,
} from '@ecomm/RequestContext';
import pino from 'pino';

interface Database {
  mongo: typeof mongo;
  col: { [key: string]: Collection<any> | { [key: string]: Collection<any> } };
  repo: { [key: string]: any };
}

declare module 'fastify' {
  export interface FastifyInstance {
    db: Database;
  }
}

const mongoPlugin: FastifyPluginAsync = async (server) => {
  server.decorate('db', { mongo, col: {}, repo: {} });

  // Register
  const { MONGO_URL: mongoUrl } = server.config;
  await server.register(mongo, {
    forceClose: true,
    url: mongoUrl,
    monitorCommands: true,
  });

  server.log.info(`${yellow('MongoDB')} ${green('starting in')} [${mongoUrl}]`);

  // Log
  const dbOut = bold(yellow('→')) + yellow('DB:');
  const dbIn = bold(yellow('←')) + yellow('DB:');
  const ignoredCommandsForLogging = [
    'createIndexes',
    'listCollections',
    'currentOp',
    'drop',
  ];
  const logger = server.log.child(
    {},
    { level: server.config.LOG_LEVEL_DB ?? server.config.LOG_LEVEL },
  ) as pino.Logger;

  server.mongo.client.on('commandStarted', (event) => {
    if (ignoredCommandsForLogging.includes(event.commandName)) return;
    if (logger.isLevelEnabled('debug'))
      logger.debug(
        `${magenta('#' + (requestContext.get(REQUEST_ID_STORE_KEY) || ''))} ${dbOut} ${event.requestId} ${green(
          JSON.stringify(event.command),
        )}`,
      );
  });
  server.mongo.client.on('commandSucceeded', (event) => {
    if (ignoredCommandsForLogging.includes(event.commandName)) return;
    if (logger.isLevelEnabled('debug'))
      logger.debug(
        `${magenta('#' + (requestContext.get(REQUEST_ID_STORE_KEY) || ''))} ${dbIn} ${event.requestId} ${green(
          JSON.stringify(event.reply),
        )}`,
      );
  });
  server.mongo.client.on('commandFailed', (event) =>
    logger.warn(
      `${magenta('#' + (requestContext.get(REQUEST_ID_STORE_KEY) || ''))} ${dbIn} ${event.requestId} ${red(
        JSON.stringify(event, null, 2),
      )}`,
    ),
  );

  // Iterceptor targets
  const projectIdTargets: string[] = [
    'find',
    'insertOne',
    'updateOne',
    'updateMany',
    'bulkWrite',
  ];
  const createTargets: string[] = ['insertOne'];
  const updateTargets: string[] = ['updateOne', 'updateMany', 'bulkWrite'];

  // ProjectId Interceptor -- Force projectId in find & updates
  const projectIdOne = function (data: any) {
    // Add projectId
    const projectId = requestContext.get(PROJECT_ID_STORE_KEY) || 'TestProject';
    data.projectId = projectId;
    return data;
  };
  const projectIdInterceptor = function (obj: any, replace, name: string) {
    obj.prototype[name] = function (...args: any[]) {
      if (Array.isArray(args[0])) {
        args[0] = args[0].map((a) => {
          if (a.updateOne) {
            return {
              updateOne: {
                filter: projectIdOne(a.updateOne.filter),
                update: a.updateOne.update,
              },
            };
          } else if (a.insertOne) {
            return {
              insertOne: { document: projectIdOne(a.insertOne.document) },
            };
          }
          return a;
        });
      } else {
        projectIdOne(args[0]);
      }
      // console.log(name, 'pidInterceptor');
      // console.log(JSON.stringify(args, null, 2));
      return replace.apply(this, args as any);
    };
  };

  // Create Interceptor -- Create timestamp / version
  const createOne = function (data: any) {
    // Add timestamp
    data.createdAt = new Date().toISOString();
    // Add version
    data.version = 0;
    return data;
  };
  const createInterceptor = function (obj: any, replace, name: string) {
    obj.prototype[name] = function (...args: any[]) {
      createOne(args[0]);
      // console.log(name, 'insertInterceptor');
      // console.log(JSON.stringify(args[0], null, 2));
      return replace.apply(this, args as any);
    };
  };

  // Update Interceptor -- Update timestamp / version
  const updateOne = function (filter: any, update: any) {
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
      // console.log(name, 'updateInterceptor, before');
      // console.log(JSON.stringify(args, null, 2));
      if (Array.isArray(args[0])) {
        args[0] = args[0].map((a) => {
          if (a.updateOne) {
            return {
              updateOne: updateOne(a.updateOne.filter, a.updateOne.update),
            };
          } else if (a.insertOne) {
            return { insertOne: { document: createOne(a.insertOne.document) } };
          }
          return a;
        });
      } else {
        updateOne(args[0], args[1]);
      }
      // console.log(name, 'updateInterceptor');
      // console.log(JSON.stringify(args, null, 2));
      return replace.apply(this, args as any);
    };
  };

  // Intercept
  projectIdTargets.forEach((m: string) =>
    projectIdInterceptor(Collection, (Collection.prototype as any)[m], m),
  );
  createTargets.forEach((m: string) =>
    createInterceptor(Collection, (Collection.prototype as any)[m], m),
  );
  updateTargets.forEach((m: string) =>
    updateInterceptor(Collection, (Collection.prototype as any)[m], m),
  );

  // Migrations
  const path = `**/migrations/${server.config.NODE_ENV}/mig_${server.config.APP_NAME}*.ts`;
  const migrator = new Umzug({
    migrations: {
      glob: path,
    },
    storage: new MongoDBStorage({
      collection: server.mongo.db!.collection('migrations'),
    }),
    logger: server.log,
    context: {
      server,
    },
  });
  // migrator.on('migrating', (params) => {
  //   console.log(params);
  // });
  await migrator.up();
};

export const AuditFields = {
  version: Type.Optional(Type.Number({ default: 0 })),
  createdAt: Type.Optional(Type.String({ format: 'date-time' })),
  lastModifiedAt: Type.Optional(Type.String({ format: 'date-time' })),
};

export default fp(mongoPlugin, {
  fastify: '5.x',
  name: 'mongo-plugin',
});
