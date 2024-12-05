import { ClassificationAttributeSchema } from '../entities/classificationAttribute';
import { type Static } from '@sinclair/typebox';

// ATTRIBUTE DAO
export const ClassificationAttributeDAOSchema = ClassificationAttributeSchema;
export type ClassificationAttributeDAO = Static<
  typeof ClassificationAttributeDAOSchema
>;
