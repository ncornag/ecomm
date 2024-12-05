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

type ConfigOptions = {
  projectId: string;
};

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
    genReqId: () => nanoid(5),
    requestIdHeader: 'x-request-id',
  };
}

const plugin: FastifyPluginAsync<ConfigOptions> = async (
  fastify: FastifyInstance,
  opts: ConfigOptions,
) => {
  fastify.addHook(
    'onRequest',
    (req: FastifyRequest, res: FastifyReply, next: HookHandlerDoneFunction) => {
      requestContext.set(REQUEST_ID_STORE_KEY, req.id);
      requestContext.set(PROJECT_ID_STORE_KEY, opts.projectId);
      next();
    },
  );

  fastify.addHook(
    'onSend',
    (
      req: FastifyRequest,
      res: FastifyReply,
      payload,
      next: HookHandlerDoneFunction,
    ) => {
      void res.header('x-request-id', req.id);
      next();
    },
  );
};

export default fp(plugin, {
  fastify: '5.x',
  name: 'request-context-provider-plugin',
});
