import fp from 'fastify-plugin';
import { type PublishOptions, JSONCodec, connect } from 'nats';
import { FastifyPluginAsync, type FastifyInstance } from 'fastify';
import { requestContext } from '@fastify/request-context';
import {
  REQUEST_ID_STORE_KEY,
  PROJECT_ID_STORE_KEY,
} from '@ecomm/RequestContext';
import { green, red, yellow, magenta, bold } from 'kolorist';
import pino from 'pino';

declare module 'fastify' {
  export interface FastifyInstance {
    messages: {
      publish: Function;
      subscribe: Function;
    };
  }
}

const natsPlugin: FastifyPluginAsync = async (server) => {
  const options: any = {
    connection_name: 'catalog',
    drainOnClose: true,
  };
  const msgOut = bold(yellow('→')) + yellow('MSG:');
  const { NATS_URL: nats_url } = server.config;

  if (!nats_url) {
    server.decorate('messages', {
      subscribe: (subject: string, handler: Function) => {},
      publish: (subject: string, payload: any, options?: PublishOptions) => {},
    });
    return;
  }
  const logger = server.log.child(
    {},
    { level: server.config.LOG_LEVEL_NATS ?? server.config.LOG_LEVEL },
  ) as pino.Logger;
  const connectParams = { name: options.connection_name, servers: nats_url };

  try {
    const nc = await connect(connectParams);
    server.addHook('onClose', async (instance) => {
      if (options.drainOnClose === true) {
        await nc.drain();
      } else {
        await nc.flush();
        await nc.close();
      }
    });
    server.decorate('messages', {
      subscribe: (subject: string, handler: Function) => {
        nc.subscribe(subject, {
          callback: (err, msg) => {
            if (err) {
              server.log.error(err);
              return;
            }
            const data = JSONCodec().decode(msg.data);
            handler(data);
          },
        });
      },
      publish: (subject: string, payload: any, options?: PublishOptions) => {
        const metadata = payload.metadata || {};
        metadata.projectId =
          metadata.projectId || requestContext.get(PROJECT_ID_STORE_KEY);
        metadata.requestId =
          metadata.requestId || requestContext.get(REQUEST_ID_STORE_KEY);
        if (logger.isLevelEnabled('debug'))
          logger.debug(
            `${magenta('#' + metadata.requestId || '')} ${msgOut} ${green('publishing to')} [${subject}] ${green(JSON.stringify(payload))}`,
          );
        nc.publish(subject, JSONCodec().encode(payload), options);
      },
    });
    server.log.info(
      `${yellow('Search')} ${green('starting in')} [${nats_url}]`,
    );
  } catch (err) {
    server.log.warn(
      `${yellow('Search')} error connecting to ${JSON.stringify(connectParams)}`,
    );
    server.decorate('messages', {
      subscribe: (subject: string, handler: Function) => {},
      publish: (subject: string, payload: any, options?: PublishOptions) => {},
    });
  }
};

export default fp(natsPlugin, {
  fastify: '5.x',
  name: 'queues-plugin',
});
