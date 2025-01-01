import fp from 'fastify-plugin';
import { type FastifyPluginAsync } from 'fastify';
import { Client } from 'typesense';
import { green, yellow } from 'kolorist';

declare module 'fastify' {
  export interface FastifyInstance {
    index: Client | undefined;
  }
}

const searchPlugin: FastifyPluginAsync = async (server) => {
  const { TYPESENSE_HOST: ts_host, TYPESENSE_PORT: ts_port, TYPESENSE_API_KEY: ts_key } = server.config;

  if (ts_host === '') {
    return;
  }

  const client = new Client({
    nodes: [
      {
        host: ts_host!,
        port: Number(ts_port!),
        protocol: 'http'
      }
    ],
    apiKey: ts_key!,
    connectionTimeoutSeconds: 2,
    logLevel: 'error'
  });

  try {
    await client.collections().retrieve();
    server.decorate('index', client);
    server.log.info(`${yellow('TyseSense')} ${green('starting in')} [${ts_host}:${ts_port}]`);
  } catch (e) {
    server.decorate('index', undefined);
    server.log.warn(`${yellow('TyseSense')} error connecting to [${ts_host}:${ts_port}]`);
  }
};

export default fp(searchPlugin, {
  fastify: '5.x',
  name: 'search-plugin'
});
