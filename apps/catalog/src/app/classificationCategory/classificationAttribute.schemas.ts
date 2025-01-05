import { type FastifySchema } from 'fastify';
import { Type } from '@sinclair/typebox';
import { ClassificationAttributeSchema } from './classificationAttribute.ts';
import { type Static } from '@sinclair/typebox';
import { ProjectBasedParamsSchema } from '../base.schemas.ts';
import { ClassificationCategoryResponse } from './classificationCategory.schemas.ts';

const defaultExample = {
  name: 'title',
  label: 'Title',
  isRequired: true
};

export const ClassificationAttributeResponse = Type.Union(ClassificationAttributeSchema.anyOf, {
  examples: [
    {
      id: '63cd0e4be59031edffa39f5c',
      ...defaultExample
    }
  ]
});

// CREATE
export const CreateClassificationAttributeBodySchema = Type.Composite(
  [Type.Object({ version: Type.Number() }), Type.Object({ data: ClassificationAttributeSchema })],
  {
    examples: [defaultExample]
  }
);
export type CreateClassificationAttributeBody = Static<typeof CreateClassificationAttributeBodySchema>;
// const CreateClassificationAttributeDataSchema = Type.Pick(CreateClassificationAttributeBodySchema, ['data']);
// export type CreateClassificationAttributeData = Static<typeof CreateClassificationAttributeDataSchema>;

export const CreateClassificationAttributeParmsSchema = Type.Composite([
  ProjectBasedParamsSchema,
  Type.Object({ id: Type.String() })
]);
export type CreateClassificationAttributeParms = Static<typeof CreateClassificationAttributeParmsSchema>;

// ROUTE SCHEMAS

export const createClassificationAttributeSchema: FastifySchema = {
  description: 'Create a new classificationAttribute',
  tags: ['classificationAttributes'],
  summary: 'Creates new classificationAttribute with given values',
  body: CreateClassificationAttributeBodySchema,
  params: CreateClassificationAttributeParmsSchema,
  response: {
    201: { ...ClassificationCategoryResponse, description: 'Success' }
  }
};
