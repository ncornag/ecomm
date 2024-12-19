import { Product } from './product';
import { Event, Command } from '@ecomm/EventStore';

///////////
// Commands
///////////

export const enum ProductCommandTypes {
  CREATE = 'product-create',
  UPDATE_NAME = 'product-update-name',
  UPDATE_DESCRIPTION = 'product-update-description',
}

export type CreateProduct = Command<
  ProductCommandTypes.CREATE,
  { product: any }, // TODO: rename CreateProductBody schema and reuse
  { catalog: string }
>;
export type UpdateProductName = Command<
  ProductCommandTypes.UPDATE_NAME,
  { productId: Product['id']; name: Product['name'] },
  { catalog: Product['catalog'] } //version: number
>;

/////////
// Events
/////////

export const enum ProductEventTypes {
  PRODUCT_CREATED = 'product-created',
  PRODUCT_NAME_UPDATED = 'product-name-updated',
  PRODUCT_DESCRIPTION_UPDATED = 'product-description-updated',
}

export type ProductCreated = Event<
  'product-created',
  { product: Product },
  any
>;

export type ProductNameUpdated = Event<
  'product-name-updated',
  { productId: Product['id']; name: Product['name'] },
  any
>;

export const toProductStreamName = (productId: string) =>
  `product-${productId}`;

// // Events

// export const StreamType = 'product';
//
// export type ProductCreated = Event<
//   'ProductCreated',
//   { product: Product; addedAt: Date }
// >;
//
// export type ProductNameUpdated = Event<
//   'ProductNameUpdated',
//   {
//     productId: string;
//     name: Product['name'];
//     updatedAt: Date;
//   }
// >;

// export type ProductDescriptionUpdated = Event<
//   'ProductDescriptionUpdated',
//   {
//     productId: string;
//     description: Product['description'];
//     updatedAt: Date;
//   }
// >;

// export type ProductEvent =
//   | ProductCreated
//   | ProductNameUpdated
//   | ProductDescriptionUpdated;

// // Commands

// export type CreateProduct = Command<
//   'CreateProduct',
//   { product: Product; catalog: string }
// >;

// export type UpdateProductName = Command<
//   'UpdateProductName',
//   { productId: string; name: Product['name'] }
// >;

// export type UpdateProductDescription = Command<
//   'UpdateProductDescription',
//   {
//     productId: string;
//     description: Product['description'];
//   }
// >;

// export type ProductCommand =
//   | CreateProduct
//   | UpdateProductName
//   | UpdateProductDescription;

// // Building State

// export const initialState = (): Product => {
//   return {} as unknown as Product;
// };

// export const evolve = (state: Product, event: ProductEvent): Product => {
//   const { type, data } = event;
//   switch (type) {
//     case 'ProductCreated': {
//       console.log('evolve.ProductCreated');
//       return data.product;
//     }
//     case 'ProductNameUpdated': {
//       console.log('evolve.ProductNameUpdated', data);
//       return {
//         ...state,
//         name: data.name,
//       };
//     }
//     case 'ProductDescriptionUpdated': {
//       return {
//         ...state,
//         description: data.description,
//       };
//     }
//     default:
//       return state;
//   }
// };

// // Business Logic

// export const createProduct = (
//   command: CreateProduct,
//   state: Product,
// ): ProductCreated => {
//   console.log('bl.createProduct');
//   const {
//     data: { product, catalog },
//     metadata,
//   } = command;

//   return {
//     type: 'ProductCreated',
//     data: {
//       product: { ...product, catalog, id: nanoid() },
//       addedAt: metadata?.now ?? new Date(),
//     },
//   };
// };

// export const updateProductName = (
//   command: UpdateProductName,
//   state: Product,
// ): ProductNameUpdated => {
//   console.log('bl.ProductNameUpdated');
//   // if (!state.name.en)
//   //   throw new IllegalStateError('Name must contain english translation');

//   const {
//     data: { productId, name },
//     metadata,
//   } = command;

//   return {
//     type: 'ProductNameUpdated',
//     data: {
//       productId,
//       name,
//       updatedAt: metadata?.now ?? new Date(),
//     },
//   };
// };

// export const updateProductDescription = (
//   command: UpdateProductDescription,
//   state: Product,
// ): ProductDescriptionUpdated => {
//   const {
//     data: { productId, description },
//     metadata,
//   } = command;

//   return {
//     type: 'ProductDescriptionUpdated',
//     data: {
//       productId,
//       description,
//       updatedAt: metadata?.now ?? new Date(),
//     },
//   };
// };

// export const decide = (command: ProductCommand, state: Product) => {
//   const { type } = command;

//   switch (type) {
//     case 'CreateProduct': {
//       console.log('decide.CreateProduct');
//       return createProduct(command, state);
//     }
//     case 'UpdateProductName': {
//       console.log('decide.UpdateProductName');
//       return updateProductName(command, state);
//     }
//     case 'UpdateProductDescription':
//       return updateProductDescription(command, state);
//     default: {
//       const _notExistingCommandType: never = type;
//       throw new EmmettError(`Unknown command type ${_notExistingCommandType}`);
//     }
//   }
// };

// export const decider: Decider<Product, ProductCommand, ProductEvent> = {
//   decide,
//   evolve,
//   initialState,
// };
