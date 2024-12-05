import { type FastifySchema } from 'fastify';
import { Type, type Static } from '@sinclair/typebox';
import {
  UpdateClassificationCategoryAction,
  ClassificationCategorySchema,
} from '../entities/classificationCategory';
// import { notFoundSchema } from '#infrastructure/http/schemas/error.schemas'

const defaultExample = {
  name: 'Root Category',
  key: 'root',
};

export const CreateClassificationCategoryBodySchema = Type.Omit(
  ClassificationCategorySchema,
  ['id', 'ancestors', 'createdAt', 'lastModifiedAt', 'version'],
  {
    examples: [defaultExample],
    additionalProperties: false,
  },
);
export type ClassificationCategoryPayload = Static<
  typeof CreateClassificationCategoryBodySchema
>;

export const ClassificationCategoryResponse = Type.Composite(
  [ClassificationCategorySchema],
  {
    examples: [
      {
        id: '63cd0e4be59031edffa39f5c',
        version: 0,
        ...defaultExample,
        createdAt: '2021-01-01T00:00:00.000Z',
      },
    ],
  },
);

export const UpdateClassificationCategoryBodySchema = Type.Object(
  {
    version: Type.Number(),
    actions: Type.Array(UpdateClassificationCategoryAction),
  },
  { additionalProperties: false },
);
export type UpdateClassificationCategoryBody = Static<
  typeof UpdateClassificationCategoryBodySchema
>;

export const UpdateClassificationCategoryParmsSchema = Type.Object({
  id: Type.String(),
});
export type UpdateClassificationCategoryParms = Static<
  typeof UpdateClassificationCategoryParmsSchema
>;

// Routes schemas

export const postClassificationCategorySchema: FastifySchema = {
  description: 'Create a new classificationCategory',
  tags: ['classificationCategory'],
  summary: 'Creates new classificationCategory with given values',
  body: CreateClassificationCategoryBodySchema,
  response: {
    201: { ...ClassificationCategoryResponse, description: 'Success' },
  },
};

export const updateClassificationCategorySchema: FastifySchema = {
  description: 'Update a classificationCategory',
  tags: ['classificationCategory'],
  summary: 'Updates a classificationCategory with given values',
  body: UpdateClassificationCategoryBodySchema,
  params: UpdateClassificationCategoryParmsSchema,
  response: {
    201: { ...ClassificationCategoryResponse, description: 'Success' },
  },
};
