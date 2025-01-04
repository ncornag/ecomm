import fp from 'fastify-plugin';
import { type PublishOptions, JSONCodec, connect } from 'nats';
import { type FastifyPluginAsync } from 'fastify';
import { requestContext } from '@fastify/request-context';
import { requestId, projectId } from '@ecomm/request-context';
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

type Options = {
  NATS_URL?: string;
  LOG_LEVEL_NATS?: string;
  LOG_LEVEL?: string;
};

const natsPlugin: FastifyPluginAsync<Options> = async (server, options) => {
  const natsOptions: any = {
    connection_name: 'catalog',
    drainOnClose: true
  };
  const msgOut = bold(yellow('→')) + yellow('MSG');

  if (!options.NATS_URL) {
    server.decorate('queues', {
      subscribe: () => {
        return;
      },
      publish: () => {
        return;
      }
    });
    return;
  }
  const logger = server.log.child({}, { level: options.LOG_LEVEL_NATS ?? options.LOG_LEVEL }) as pino.Logger;
  const connectParams = { name: natsOptions.connection_name, servers: options.NATS_URL };

  try {
    const nc = await connect(connectParams);
    server.addHook('onClose', async (instance) => {
      if (natsOptions.drainOnClose === true) {
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
          }
        });
      },
      publish: (subject, payload, options?) => {
        const metadata = payload.metadata || {};
        if (!payload.projectId) metadata.projectId = metadata.projectId || projectId();
        if (!payload.requestId) metadata.requestId = metadata.requestId || requestId();
        if (logger.isLevelEnabled('debug'))
          logger.debug(
            `${magenta('#' + requestId())} ${msgOut} ${green('publishing to')} [${subject}] ${green(
              JSON.stringify(payload)
            )}`
          );
        nc.publish(subject, JSONCodec().encode(payload), options);
      }
    });
    server.log.info(`${yellow('Queues')} ${green('starting in')} [${options.NATS_URL}]`);
  } catch (err) {
    server.log.warn(`${yellow('Queues')} error connecting to ${JSON.stringify(connectParams)}`);
    server.decorate('queues', {
      subscribe: () => {
        return;
      },
      publish: () => {
        return;
      }
    });
  }
};

export default fp(natsPlugin, {
  fastify: '5.x',
  name: 'queues-plugin'
});
