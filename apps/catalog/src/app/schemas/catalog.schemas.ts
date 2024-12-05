import { type FastifySchema } from 'fastify';
import { Type, type Static } from '@sinclair/typebox';
import { UpdateCatalogAction, CatalogSchema } from '../entities/catalog';

const defaultExample = {
  name: 'Root Category',
  key: 'root',
};

const CatalogResponse = Type.Composite([CatalogSchema], {
  examples: [
    {
      id: '63cd0e4be59031edffa39f5c',
      version: 0,
      ...defaultExample,
      createdAt: '2021-01-01T00:00:00.000Z',
    },
  ],
});

// CREATE
export const CreateCatalogBodySchema = Type.Omit(
  CatalogSchema,
  ['id', 'createdAt', 'lastModifiedAt', 'version'],
  {
    examples: [defaultExample],
    additionalProperties: false,
  },
);
export type CreateCatalogBody = Static<typeof CreateCatalogBodySchema>;

// UPDATE
export const UpdateCatalogBodySchema = Type.Object(
  {
    version: Type.Number(),
    actions: Type.Array(UpdateCatalogAction),
  },
  { additionalProperties: false },
);
export type UpdateCatalogBody = Static<typeof UpdateCatalogBodySchema>;

export const FindCatalogParmsSchema = Type.Object({ id: Type.String() });
export type FindCatalogParms = Static<typeof FindCatalogParmsSchema>;

// ROUTE SCHEMAS

export const postCatalogSchema: FastifySchema = {
  description: 'Create a new catalog',
  tags: ['catalog'],
  summary: 'Creates new catalog with given values',
  body: CreateCatalogBodySchema,
  response: {
    201: { ...CatalogResponse, description: 'Success' },
  },
};

export const updateCatalogSchema: FastifySchema = {
  description: 'Update a catalog',
  tags: ['catalog'],
  summary: 'Updates a catalog with given values',
  body: UpdateCatalogBodySchema,
  params: FindCatalogParmsSchema,
  response: {
    201: { ...CatalogResponse, description: 'Success' },
  },
};
