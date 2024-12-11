import { type FastifySchema } from 'fastify';
import { Type } from '@sinclair/typebox';
import { ClassificationAttributeSchema } from './classificationAttribute';
import { type Static } from '@fastify/type-provider-typebox';

const defaultExample = {
  name: 'title',
  label: 'Title',
  isRequired: true,
};

export const ClassificationAttributePayloadSchema = Type.Union(
  ClassificationAttributeSchema.anyOf,
  {
    examples: [defaultExample],
  },
);
export type ClassificationAttributePayload = Static<
  typeof ClassificationAttributePayloadSchema
>;

export const ClassificationAttributeResponse = Type.Union(
  ClassificationAttributeSchema.anyOf,
  {
    examples: [
      {
        id: '63cd0e4be59031edffa39f5c',
        ...defaultExample,
      },
    ],
  },
);

export const postClassificationAttributeSchema: FastifySchema = {
  description: 'Create a new classificationAttribute',
  tags: ['classificationAttributes'],
  summary: 'Creates new classificationAttribute with given values',
  body: ClassificationAttributePayloadSchema,
  response: {
    201: { ...ClassificationAttributeResponse, description: 'Success' },
  },
};
