import fp from 'fastify-plugin';
import { type FastifyPluginAsync } from 'fastify';
import { Client } from 'typesense';
import { green, yellow } from 'kolorist';

declare module 'fastify' {
  export interface FastifyInstance {
    index: Client | undefined;
  }
}

type Options = {
  TYPESENSE_HOST?: string;
  TYPESENSE_PORT?: string;
  TYPESENSE_API_KEY?: string;
};

const searchPlugin: FastifyPluginAsync<Options> = async (server, options) => {
  if (options.TYPESENSE_HOST === undefined) return;

  const client = new Client({
    nodes: [
      {
        host: options.TYPESENSE_HOST!,
        port: Number(options.TYPESENSE_PORT!),
        protocol: 'http'
      }
    ],
    apiKey: options.TYPESENSE_API_KEY!,
    connectionTimeoutSeconds: 2,
    logLevel: 'error'
  });

  try {
    await client.collections().retrieve();
    server.decorate('index', client);
    server.log.info(
      `${yellow('TyseSense')} ${green('starting in')} [${options.TYPESENSE_HOST}:${options.TYPESENSE_PORT}]`
    );
  } catch (e) {
    server.decorate('index', undefined);
    server.log.warn(`${yellow('TyseSense')} error connecting to [${options.TYPESENSE_HOST}:${options.TYPESENSE_PORT}]`);
  }
};

export default fp(searchPlugin, {
  fastify: '5.x',
  name: 'search-plugin'
});
