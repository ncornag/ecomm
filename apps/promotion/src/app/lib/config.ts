import { type Static, Type } from '@sinclair/typebox';
import { Ajv } from 'ajv';
import { Value } from '@sinclair/typebox/value';

const NodeEnvSchema: Record<string, string> = {
  development: 'development',
  test: 'test',
  production: 'production'
};

export const ConfigSchema = Type.Object({
  NODE_ENV: Type.Enum(NodeEnvSchema),
  APP_NAME: Type.String(),
  LOG_LEVEL: Type.String(),
  LOG_LEVEL_DB: Type.Optional(Type.String()),
  LOG_LEVEL_NATS: Type.Optional(Type.String()),
  LOG_LEVEL_AUDITLOG: Type.Optional(Type.String()),
  LOG_LEVEL_PROJECTOR: Type.Optional(Type.String()),
  API_HOST: Type.String(),
  API_PORT: Type.Number(),
  MONGO_URL: Type.String(),
  PROJECT_ID: Type.String(),
  NATS_URL: Type.Optional(Type.String()),
  CACHE_JSON_SCHEMAS: Type.Boolean({ default: true }),
  PRINT_ROUTES: Type.Boolean({ default: false }),
  CT_SCOPE: Type.Optional(Type.String()),
  CT_AUTHHOST: Type.Optional(Type.String()),
  CT_HTTPHOST: Type.Optional(Type.String()),
  CT_PROJECTKEY: Type.Optional(Type.String()),
  CT_CLIENTID: Type.Optional(Type.String()),
  CT_CLIENTSECRET: Type.Optional(Type.String()),
  // Internal
  TOPIC_CREATE_SUFIX: Type.Optional(Type.String({ default: 'create' })),
  TOPIC_UPDATE_SUFIX: Type.Optional(Type.String({ default: 'update' })),
  TOPIC_DELETE_SUFIX: Type.Optional(Type.String({ default: 'delete' }))
});
export type Config = Static<typeof ConfigSchema>;

const ajv = new Ajv({
  allErrors: true,
  removeAdditional: true,
  useDefaults: true,
  coerceTypes: true,
  allowUnionTypes: true
});

const validate = ajv.compile(ConfigSchema);
const valid = validate(process.env);
if (!valid) {
  throw new Error('.env file validation failed - ' + JSON.stringify(validate.errors, null, 2));
}

export const config: Config = Value.Parse(ConfigSchema, process.env);

declare module 'fastify' {
  export interface FastifyInstance {
    config: Config;
  }
}
