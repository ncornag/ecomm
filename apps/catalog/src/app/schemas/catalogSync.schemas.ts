import { type FastifySchema } from 'fastify';
import { Type, type Static } from '@sinclair/typebox';
import {
  UpdateCatalogSyncAction,
  CatalogSyncSchema,
} from '../entities/catalogSync';

const defaultExample = {
  name: 'Root Category',
  key: 'root',
};

const CatalogSyncResponse = Type.Composite([CatalogSyncSchema], {
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
export const CreateCatalogSyncBodySchema = Type.Omit(
  CatalogSyncSchema,
  ['id', 'createdAt', 'lastModifiedAt', 'version'],
  {
    examples: [defaultExample],
    additionalProperties: false,
  },
);
export type CreateCatalogSyncBody = Static<typeof CreateCatalogSyncBodySchema>;

// UPDATE
export const UpdateCatalogSyncBodySchema = Type.Object(
  {
    version: Type.Number(),
    actions: Type.Array(UpdateCatalogSyncAction),
  },
  { additionalProperties: false },
);
export type UpdateCatalogSyncBody = Static<typeof UpdateCatalogSyncBodySchema>;

export const FindCatalogSyncParmsSchema = Type.Object({ id: Type.String() });
export type FindCatalogSyncParms = Static<typeof FindCatalogSyncParmsSchema>;

// SYNC
export const SyncCatalogBodySchema = Type.Object(
  {
    id: Type.String(),
  },
  {
    additionalProperties: false,
  },
);
export type SyncCatalogBody = Static<typeof SyncCatalogBodySchema>;

// ROUTE SCHEMAS

export const postCatalogSyncSchema: FastifySchema = {
  description: 'Create a new catalogSync',
  tags: ['catalogSync'],
  summary: 'Creates new catalogSync with given values',
  body: CreateCatalogSyncBodySchema,
  response: {
    201: { ...CatalogSyncResponse, description: 'Success' },
  },
};

export const updateCatalogSyncSchema: FastifySchema = {
  description: 'Update a catalogSync',
  tags: ['catalogSync'],
  summary: 'Updates a catalogSync with given values',
  body: UpdateCatalogSyncBodySchema,
  params: FindCatalogSyncParmsSchema,
  response: {
    201: { ...CatalogSyncResponse, description: 'Success' },
  },
};

export const syncCatalogSchema: FastifySchema = {
  description: 'Synchronize two Catalogs',
  tags: ['catalogSync'],
  summary:
    'Synchronize two catalogs using the rules in the CatalogSync collection',
  body: SyncCatalogBodySchema,
};
