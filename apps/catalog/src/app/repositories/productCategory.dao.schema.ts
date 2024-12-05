import { ProductCategorySchema } from '../entities/productCategory';
import { type ITree } from '../lib/tree';
import { type Static, Type } from '@sinclair/typebox';

// DAO
export const ProductCategoryDAOSchema = Type.Composite([
  Type.Omit(ProductCategorySchema, ['id']),
  Type.Object({ _id: Type.String() }),
]);
export type ProductCategoryDAO = Static<
  typeof ProductCategoryDAOSchema,
  [ITree<string>]
>;
