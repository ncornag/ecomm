import fp from 'fastify-plugin';
import { type PublishOptions, JSONCodec, connect } from 'nats';
import { FastifyPluginAsync } from 'fastify';
import { requestContext } from '@fastify/request-context';
import { requestId, projectId } from '@ecomm/RequestContext';
import { green, yellow, magenta, bold } from 'kolorist';
import pino from 'pino';

export type Queues = {
  publish: (subject: string, payload: any, options?: PublishOptions) => void;
  subscribe: (subject: string, handler: (data: any) => void) => void;
};

declare module 'fastify' {
  export interface FastifyInstance {
    queues: Queues;
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
    server.decorate('queues', {
      subscribe: () => {
        return;
      },
      publish: () => {
        return;
      },
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
    server.decorate('queues', {
      subscribe: (subject, handler) => {
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
      publish: (subject, payload, options?) => {
        const metadata = payload.metadata || {};
        if (!payload.projectId)
          metadata.projectId = metadata.projectId || projectId();
        if (!payload.requestId)
          metadata.requestId = metadata.requestId || requestId();
        if (logger.isLevelEnabled('debug'))
          logger.debug(
            `${magenta('#' + requestId())} ${msgOut} ${green('publishing to')} [${subject}] ${green(JSON.stringify(payload))}`,
          );
        nc.publish(subject, JSONCodec().encode(payload), options);
      },
    });
    server.log.info(
      `${yellow('Queues')} ${green('starting in')} [${nats_url}]`,
    );
  } catch (err) {
    server.log.warn(
      `${yellow('Queues')} error connecting to ${JSON.stringify(connectParams)}`,
    );
    server.decorate('queues', {
      subscribe: () => {
        return;
      },
      publish: () => {
        return;
      },
    });
  }
};

export default fp(natsPlugin, {
  fastify: '5.x',
  name: 'queues-plugin',
});
