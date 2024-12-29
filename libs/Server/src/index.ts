import fastify, { FastifyInstance, type FastifyServerOptions } from 'fastify';
import pino from 'pino';
import ajvFormats from 'ajv-formats';
import fastifyRequestLogger from '@mgcrea/fastify-request-logger';
import { fastifyRequestContext } from '@fastify/request-context';
import { type TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { AppError, ErrorCode, default as sendAppError } from '@ecomm/AppError';
import { errorName } from '@ecomm/MongoErrors';
import { yellow } from 'kolorist';
import config from '@ecomm/Config';
import docs from '@ecomm/Docs';
import {
  default as requestContextProvider,
  getRequestIdFastifyAppConfig,
} from '@ecomm/RequestContext';
import authorization from './authorization';

declare module 'fastify' {
  interface FastifyInstance {
    logger: pino.Logger;
  }
  interface FastifyContextConfig {
    scopes: string[];
  }
}

// Patch Bigint.toJSON
// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface BigInt {
  toJSON: () => string;
}
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

export default async (app, envConfig): Promise<FastifyInstance> => {
  // Server
  const serverOptions: FastifyServerOptions = {
    ajv: {
      customOptions: {
        removeAdditional: false,
        coerceTypes: 'array',
        useDefaults: true,
        //keywords: ['kind', 'modifier']
      },
      plugins: [ajvFormats],
    },
    logger: {
      level: process.env.LOG_LEVEL,
      transport: {
        target: '@mgcrea/pino-pretty-compact',
        options: {
          translateTime: 'yyyy-mm-dd HH:MM:ss.l',
          colorize: true,
          ignore: 'pid,hostname,plugin',
        },
      },
    },
    disableRequestLogging: true,
    ...getRequestIdFastifyAppConfig(),
  };
  const server = fastify(serverOptions).withTypeProvider<TypeBoxTypeProvider>();
  server.logger = server.log as pino.Logger;
  if (!server.logger.isLevelEnabled) {
    server.logger.isLevelEnabled = () => false;
  }

  server.logger.info(
    `${yellow('APP:')} [${process.env.APP_NAME}] ${yellow('ENV:')} [${process.env.NODE_ENV}] ${yellow('PRJ:')} [${process.env.PROJECT_ID}] `,
  );
  // Global Error handler
  server.setErrorHandler(function (error, request, reply) {
    //console.log(JSON.stringify(error, null, 2));
    if (error.validation) {
      const additionalProperty = error.validation[0]?.params?.additionalProperty
        ? ' [' + error.validation[0]?.params?.additionalProperty + ']'
        : '';
      const instancePath = error.validation[0]?.instancePath
        ? ' [' + error.validation[0]?.instancePath + ']'
        : '';
      const message = error.validation[0]
        ? error.validation[0].message + instancePath + additionalProperty
        : error.message;
      reply.send(new AppError(ErrorCode.UNPROCESSABLE_ENTITY, message));
    } else if (error.name == 'MongoServerError') {
      reply.send(
        new AppError(ErrorCode.BAD_REQUEST, errorName(error.code as any)),
      );
    } else {
      reply.send(error);
    }
  });

  // Register Plugins
  await server.register(config, {
    envType: envConfig,
  });
  await server.register(fastifyRequestLogger); //, { logBody: true }
  await server.register(docs);
  await server.register(sendAppError);
  await server.register(fastifyRequestContext);
  await server.register(requestContextProvider, {
    projectId: server.config.PROJECT_ID,
  });

  // Initialize Authorization
  await authorization(server);

  // Print Routes
  if (server.config.PRINT_ROUTES === true) {
    const importDynamic = new Function(
      'modulePath',
      'return import(modulePath)',
    );
    const fastifyPrintRoutes = await importDynamic('fastify-print-routes');
    await server.register(fastifyPrintRoutes);
  }

  // Register your application as a normal plugin.
  await server.register(app);

  // Start listening.
  await server.listen({
    host: server.config.API_HOST,
    port: server.config.API_PORT,
  });

  process.on('unhandledRejection', (err) => {
    console.error(err);
    process.exit(1);
  });

  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => {
      console.log(`closing application on ${signal}`);
      server
        .close()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
    });
  }

  return server;
};
