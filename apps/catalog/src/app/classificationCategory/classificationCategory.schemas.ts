import { type FastifySchema } from 'fastify';
import { Type, type Static } from '@sinclair/typebox';
import { UpdateClassificationCategoryAction, ClassificationCategorySchema } from './classificationCategory.ts';
import { ProjectBasedParamsSchema } from '../base.schemas.ts';

const defaultExample = {
  name: 'Root Category',
  key: 'root'
};

export const ClassificationCategoryResponse = Type.Composite([ClassificationCategorySchema], {
  examples: [
    {
      id: '63cd0e4be59031edffa39f5c',
      version: 0,
      ...defaultExample,
      createdAt: '2021-01-01T00:00:00.000Z'
    }
  ]
});

// CREATE
export const CreateClassificationCategoryBodySchema = Type.Omit(
  ClassificationCategorySchema,
  ['id', 'ancestors', 'createdAt', 'lastModifiedAt', 'version'],
  {
    examples: [defaultExample],
    additionalProperties: false
  }
);
export type CreateClassificationCategoryBody = Static<typeof CreateClassificationCategoryBodySchema>;

// UPDATE
export const UpdateClassificationCategoryBodySchema = Type.Object(
  {
    version: Type.Number(),
    actions: Type.Array(UpdateClassificationCategoryAction)
  },
  { additionalProperties: false }
);
export type UpdateClassificationCategoryBody = Static<typeof UpdateClassificationCategoryBodySchema>;
export const UpdateClassificationCategoryParmsSchema = Type.Composite([
  ProjectBasedParamsSchema,
  Type.Object({ id: Type.String() })
]);
export type UpdateClassificationCategoryParms = Static<typeof UpdateClassificationCategoryParmsSchema>;

// FIND
export const FindClassificationCategoryParmsSchema = Type.Composite([
  ProjectBasedParamsSchema,
  Type.Object({
    id: Type.String()
  })
]);
export type FindClassificationCategoryParms = Static<typeof FindClassificationCategoryParmsSchema>;

// ROUTE SCHEMAS

export const postClassificationCategorySchema: FastifySchema = {
  description: 'Create a new classificationCategory',
  tags: ['classificationCategory'],
  summary: 'Creates new classificationCategory with given values',
  body: CreateClassificationCategoryBodySchema,
  params: ProjectBasedParamsSchema,
  response: {
    201: { ...ClassificationCategoryResponse, description: 'Success' }
  }
};

export const updateClassificationCategorySchema: FastifySchema = {
  description: 'Update a classificationCategory',
  tags: ['classificationCategory'],
  summary: 'Updates a classificationCategory with given values',
  body: UpdateClassificationCategoryBodySchema,
  params: UpdateClassificationCategoryParmsSchema,
  response: {
    201: { ...ClassificationCategoryResponse, description: 'Success' }
  }
};
