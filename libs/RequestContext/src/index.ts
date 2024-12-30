//import fastifyJwt from '@fastify/jwt';
import { customAlphabet } from 'nanoid';
const nanoid = customAlphabet(
  'useandom-26T198340PX75pxJACKVERYMINDBUSHWOLFGQZbfghjklqvwyzrict',
  5,
);
import { requestContext } from '@fastify/request-context';
import type {
  FastifyReply,
  FastifyRequest,
  FastifyInstance,
  HookHandlerDoneFunction,
  FastifyServerOptions,
  FastifyPluginAsync,
} from 'fastify';
import fp from 'fastify-plugin';

export const PROJECT_ID_STORE_KEY = 'projectId';
export const REQUEST_ID_STORE_KEY = 'reqId';

declare module '@fastify/request-context' {
  interface RequestContextData {
    [REQUEST_ID_STORE_KEY]: string;
    [PROJECT_ID_STORE_KEY]: string;
  }
}

export function getRequestIdFastifyAppConfig(): Pick<
  FastifyServerOptions,
  'genReqId' | 'requestIdHeader'
> {
  return {
    genReqId: (req) => (req.headers['request-id'] as string) ?? nanoid(5),
    requestIdHeader: 'request-id',
  };
}

const plugin: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  fastify.addHook('onRequest', (req: any, res, next) => {
    requestContext.set(REQUEST_ID_STORE_KEY, req.id);
    const [_audTag, audProjectId] = req.user.aud.split(':');
    requestContext.set(PROJECT_ID_STORE_KEY, audProjectId);
    next();
  });

  fastify.addHook(
    'onSend',
    (
      req: FastifyRequest,
      res: FastifyReply,
      payload,
      next: HookHandlerDoneFunction,
    ) => {
      void res.header('request-id', req.id);
      next();
    },
  );
};

export function projectId(): string {
  return requestContext.get(PROJECT_ID_STORE_KEY) || '';
}
export function requestId(): string {
  return requestContext.get(REQUEST_ID_STORE_KEY) || '';
}

export default fp(plugin, {
  fastify: '5.x',
  name: 'request-context-provider-plugin',
});
