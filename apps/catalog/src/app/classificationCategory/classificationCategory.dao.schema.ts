import { ClassificationCategorySchema } from './classificationCategory.ts';
import { type ITree } from '../lib/tree.ts';
import { type Static, Type } from '@sinclair/typebox';

// DAO
export const ClassificationCategoryDAOSchema = Type.Composite([
  Type.Omit(ClassificationCategorySchema, ['id']),
  Type.Object({ _id: Type.String() })
]);
export type ClassificationCategoryDAO = Static<typeof ClassificationCategoryDAOSchema, [ITree<string>]>;
