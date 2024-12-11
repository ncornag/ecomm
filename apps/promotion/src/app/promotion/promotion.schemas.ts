import { type FastifySchema } from 'fastify';
import { Type, type Static } from '@sinclair/typebox';
import { UpdatePromotionAction, PromotionSchema } from '../promotion/promotion';

const defaultExample = {
  name: 'Buy 1 from "shoes" and get €50 off 1 "trainers"',
  when: {
    baseProduct: 'products["shirts" in categories][0]',
    secondProduct: 'products["trainers" in categories][0]',
  },
  then: {
    lineDiscount: {
      productId: 'secondProduct.id',
      discount: '50',
      remove: [
        { productId: 'baseProduct.id', quantity: 1 },
        { productId: 'secondProduct.id', quantity: 1 },
      ],
    },
  },
};

const PromotionResponse = Type.Composite([PromotionSchema], {
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
export const CreatePromotionBodySchema = Type.Omit(
  PromotionSchema,
  ['id', 'createdAt', 'lastModifiedAt', 'version'],
  {
    examples: [defaultExample],
    additionalProperties: false,
  },
);
export type CreatePromotionBody = Static<typeof CreatePromotionBodySchema>;

// UPDATE
export const UpdatePromotionBodySchema = Type.Object(
  {
    version: Type.Number(),
    actions: Type.Array(UpdatePromotionAction),
  },
  { additionalProperties: false },
);
export type UpdatePromotionBody = Static<typeof UpdatePromotionBodySchema>;

export const FindPromotionParmsSchema = Type.Object({ id: Type.String() });
export type FindPromotionParms = Static<typeof FindPromotionParmsSchema>;

// CALCULATE PROMOTIONS
export const CalculatePromotionQueryStringSchema = Type.Optional(
  Type.Object({ cartId: Type.String(), promotionId: Type.String() }),
);
export type CalculatePromotionQueryString = Static<
  typeof CalculatePromotionQueryStringSchema
>;

// ROUTE SCHEMAS

export const postPromotionSchema: FastifySchema = {
  description: 'Create a new promotion',
  tags: ['promotion'],
  summary: 'Creates new promotion with given values',
  body: CreatePromotionBodySchema,
  response: {
    201: { ...PromotionResponse, description: 'Success' },
  },
};

export const updatePromotionSchema: FastifySchema = {
  description: 'Update a promotion',
  tags: ['promotion'],
  summary: 'Updates a promotion with given values',
  body: UpdatePromotionBodySchema,
  params: FindPromotionParmsSchema,
  response: {
    201: { ...PromotionResponse, description: 'Success' },
  },
};
