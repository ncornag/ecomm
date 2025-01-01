import fastifyJwt from '@fastify/jwt';
import { type FastifyInstance } from 'fastify';
import fs from 'fs';

declare module 'fastify' {
  interface FastifyInstance {
    authenticate(request: any, reply: any): Promise<void>;
  }
}

export default async (server: FastifyInstance) => {
  // Read Public Key for decode JWT tokens
  const publicKey = fs.readFileSync(server.config.PUBLIC_KEY_FILE, 'ascii');

  // Register the fastify-jwt plugin
  await server.register(fastifyJwt, {
    secret: {
      public: publicKey
    },
    verify: {
      algorithms: ['RS256']
    }
  });

  server.decorate('authenticate', async (request, reply) => {
    // Verify the JWT
    await request.jwtVerify();
    // Check the audience (projectId)
    const requestProjectId = request.params.projectId;
    const [_audTag, audProjectId] = request.user.aud.split(':');
    if (!requestProjectId || requestProjectId !== audProjectId) reply.code(401).send(new Error('Invalid audience'));
    // Check the scopes
    const userScopes = request.user.scope.split(' ');
    const routeScopes = request.routeOptions.config.scopes;
    if (!routeScopes || !routeScopes.length) reply.code(401).send(new Error('Insufficient privileges'));
    if (routeScopes[0] === '*') return;
    if (!routeScopes.every((item: string) => userScopes.includes(item)))
      reply.code(401).send(new Error('Insufficient privileges'));
  });

  server.addHook('onRequest', async (request, reply) => server.authenticate(request, reply));
};
