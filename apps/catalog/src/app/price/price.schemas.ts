import { type FastifySchema } from 'fastify';
import { Type, type Static } from '@sinclair/typebox';
import { PriceSchema } from './price.ts';

const defaultExample = {
  name: 'Root Category',
  key: 'root'
};

const PriceResponse = Type.Omit(PriceSchema, ['catalogId'], {
  examples: [
    {
      id: '63cd0e4be59031edffa39f5c',
      version: 0,
      ...defaultExample,
      createdAt: '2021-01-01T00:00:00.000Z'
    }
  ],
  additionalProperties: false
});

// CREATE
export const CreatePriceBodySchema = Type.Omit(
  PriceSchema,
  ['id', 'catalogId', 'createdAt', 'lastModifiedAt', 'version'],
  {
    examples: [defaultExample],
    additionalProperties: false
  }
);
export type CreatePriceBody = Static<typeof CreatePriceBodySchema>;

export const FindPriceParmsSchema = Type.Object({ id: Type.String() });
export const FindPriceQueryStringSchema = Type.Object({
  catalogId: Type.String(),
  materialized: Type.Boolean({ default: false })
});
export type FindPriceParms = Static<typeof FindPriceParmsSchema>;
export type FindPriceQueryString = Static<typeof FindPriceQueryStringSchema>;

// ROUTE SCHEMAS

export const postPriceSchema: FastifySchema = {
  description: 'Create a new price',
  tags: ['price'],
  summary: 'Creates new price with given values',
  body: CreatePriceBodySchema,
  response: {
    201: { ...PriceResponse, description: 'Success' }
  }
};
