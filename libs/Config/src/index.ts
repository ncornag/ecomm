import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import type { Static, TObject } from '@sinclair/typebox';
import { Value } from '@sinclair/typebox/value';
import { Ajv } from 'ajv';

const ajv = new Ajv({
  allErrors: true,
  removeAdditional: true,
  useDefaults: true,
  coerceTypes: true,
  allowUnionTypes: true
});

type ConfigOptions = {
  envType: TObject;
};

let c;

const plugin: FastifyPluginAsync<ConfigOptions> = async (fastify: FastifyInstance, options: ConfigOptions) => {
  const validate = ajv.compile(options.envType);
  const valid = validate(process.env);
  if (!valid) {
    throw new Error('.env file validation failed - ' + JSON.stringify(validate.errors, null, 2));
  }
  const config = Value.Parse(options.envType, process.env);
  c = options.envType;
  fastify.decorate('config', config);
};

export type Config = Static<typeof c>;

declare module 'fastify' {
  export interface FastifyInstance {
    config: Config;
  }
}

export default fp(plugin, {
  fastify: '5.x',
  name: 'config-plugin'
});
