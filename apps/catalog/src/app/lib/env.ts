import { Type } from '@sinclair/typebox';

const NodeEnv: Record<string, string> = {
  development: 'development',
  test: 'test',
  production: 'production',
};

export const envConfig = Type.Object({
  NODE_ENV: Type.Enum(NodeEnv),
  APP_NAME: Type.String(),
  LOG_LEVEL: Type.String(),
  LOG_LEVEL_DB: Type.Optional(Type.String()),
  LOG_LEVEL_NATS: Type.Optional(Type.String()),
  LOG_LEVEL_AUDITLOG: Type.Optional(Type.String()),
  LOG_LEVEL_AGGREGATOR: Type.Optional(Type.String()),
  API_HOST: Type.String(),
  API_PORT: Type.Number(),
  MONGO_URL: Type.String(),
  PROJECT_ID: Type.String(),
  CC_TREE_ROUTE: Type.Optional(Type.String()),
  NATS_URL: Type.Optional(Type.String()),
  CACHE_JSON_SCHEMAS: Type.Boolean({ default: true }),
  PRINT_ROUTES: Type.Optional(Type.Boolean({ default: false })),
  CT_SCOPE: Type.Optional(Type.String()),
  CT_AUTHHOST: Type.Optional(Type.String()),
  CT_HTTPHOST: Type.Optional(Type.String()),
  CT_PROJECTKEY: Type.Optional(Type.String()),
  CT_CLIENTID: Type.Optional(Type.String()),
  CT_CLIENTSECRET: Type.Optional(Type.String()),
  CACHE_CART_PRODUCTS: Type.Optional(Type.Boolean({ default: true })),
  CACHE_CART_PRICES: Type.Optional(Type.Boolean({ default: true })),
  TYPESENSE_HOST: Type.Optional(Type.String()),
  TYPESENSE_PORT: Type.Optional(Type.String()),
  TYPESENSE_API_KEY: Type.Optional(Type.String()),
  CATALOGS_TO_INDEX: Type.Optional(Type.String()),
  PROMOTIONS_URL: Type.String(),
  // Internal
  TOPIC_CREATE_SUFIX: Type.Optional(Type.String({ default: 'create' })),
  TOPIC_UPDATE_SUFIX: Type.Optional(Type.String({ default: 'update' })),
  TOPIC_DELETE_SUFIX: Type.Optional(Type.String({ default: 'delete' })),
});
