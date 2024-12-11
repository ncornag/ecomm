# Migration TODOS:

FIXME: ! Refactor as components instead of layers
FIXME: ! Rewrite the Readme

# Catalog

This project is a product management system that handles catalog imports, updates, and synchronization, using MongoDB for data storage. It includes tools for managing products, categories, classifications, and catalog synchronization with an emphasis on dynamic data manipulation and validation.

## Overview

The project provides an API-driven system to manage product catalogs, classifications, and their synchronization between staged and online environments. It includes features for importing, creating, updating, and validating products and their associated data structures.

## Main Features

- **Product Importing:** Import products from external sources into a MongoDB database, supporting staged and online catalogs.
- **Product Creation:** Create products with multiple attributes, variants, and prices, including standalone pricing.
- **Product Updating:** Update product data dynamically using scripts and bulk operations.
- **Classification Management:** Create and manage classification attributes for products, with support for various data types.
- **Catalog Synchronization:** Sync product data between stage and online catalogs.
- **API Documentation:** A comprehensive Postman collection for API requests to manage products, categories, and classifications.

## Project Structure

The codebase is organized into the following directories:

- **data/**: Scripts for importing, creating, and updating product data.
- **doc/**: Documentation and Postman collection for API requests.
- **src/**: Core application code, organized into `core`, `infrastructure`, and `repositories`:
  - **core/**: Core services, entities, and business logic.
  - **infrastructure/**: MongoDB and HTTP configurations.
  - **repositories/**: Data access layers for product and category management.
- **tests/**: Test specifications for the product management system.

# Promotions

This project is a scalable promotion management system that includes audit logging and cart management capabilities. It leverages MongoDB for data storage and integrates with commercetools for handling cart data.

## Overview

The project provides a robust system for managing promotions, including creation, updates, and synchronization with external services. It also includes audit logging for tracking changes to promotions and an engine for evaluating and applying promotions to customer carts.

## Main Features

- **Promotion Management**: Create, update, and manage promotions with actions like discounts and tagging products.
- **Audit Logging**: Track changes to promotions and other entities with an extensive audit logging system.
- **Cart Management**: Integrate with commercetools to manage customer carts and apply promotions.
- **Promotion Evaluation Engine**: Evaluate promotions based on cart items, applying discounts and tracking promotions.
- **API Documentation**: Fully documented API for managing promotions, audit logs, and carts.

## Project Structure

- **data/**: Contains scripts for creating and managing large datasets (e.g., promotions and carts).
- **src/**: Core application logic.
  - **core/entities/**: Entity definitions for audit logs, promotions, etc.
  - **core/lib/**: Core libraries, including the promotion engine, expressions evaluator, and custom error handling.
  - **core/repositories/**: Data access layer for MongoDB.
  - **core/services/**: Services for managing promotions and audit logs.
  - **infrastructure/**: Database and HTTP configurations, and plugins.
  - **queues/**: Integration with message queues for asynchronous operations.
- **tests/**: Contains test specifications for various functionalities.
- **doc/**: Documentation, including API details.

# Stack

- Fastify
- Typebox
- Mongodb
- NATS
- TypeSense

# Setup Instructions

## Prerequisites

- **Node.js** (v22 or higher)
- **MongoDB** (v4.4 or higher)
- **NATS**
- **TypeSense**

## Installation

1. **Clone the repository**:

   ```bash
   git clone <repository_url>
   cd <repository_directory>
   ```

2. **Install dependencies**:

   ```bash
   npm install
   ```

3. **Set up MongoDB**:
   Ensure MongoDB is running and configured with the necessary databases as specified in the `.env` file.

## Configuration

- Rename `.env.template` to `.env` and set the values for:
  - `MONGO_URL`: MongoDB connection string.
  - Other environment variables as needed for your setup.

## Running the Application

### Catalog

- **To import products**:

  ```bash
  node data/ct/importProducts.ts <firstProductToImport> <productsToImport> <stageSuffix> <currentSuffix>
  ```

- **To create products**:

  ```bash
  node data/createProducts.ts <productsToInsert> <variantsPerProduct> <pricesPerVariant> <stageSuffix> <currentSuffix>
  ```

- **To update products**:

  ```bash
  node data/updateProducts.ts <productsToModify>
  ```

- **To start the server**:
  ```bash
  npm start
  ```

### Promotions

- **To create promotions**:

  ```bash
  node data/createPromotions.ts <number_of_promotions>
  ```

- **To evaluate promotions on a cart**:

  ```bash
  node src/core/lib/promotionsEngine/engine.ts <cart_id>
  ```

- **To run the server**:
  ```bash
  npm start
  # or
  yarn start
  ```

## Usage Examples

### Catalog

- **Creating a New Product**:
  Example usage with the Postman collection in `doc/ecomm.postman_collection.json` for creating a product with classifications and categories.

- **Synchronizing Catalogs**:
  Use the API to synchronize products between the `stage` and `online` catalogs, ensuring data consistency across environments.

### Promotions

- **API Endpoints**:

  - **Create Promotion**: `POST /promotions`
  - **Get Promotion by ID**: `GET /promotions/:id`
  - **Update Promotion**: `PUT /promotions/:id`
  - **Fetch Audit Logs**: `GET /audit-logs`

- **Promotions Management**:

  - Refer to `doc/ecomm.postman_collection.json` for a detailed list of API endpoints and usage examples.

- **Cart Management with commercetools**:
  - Fetch a cart by ID and apply promotions using `CartTools` and the `PromotionService`.

#### Example Promotion

```
{
  _id: "10%OffIn1ShirtFor100SpendOnShoes",
  projectId: "TestProject",
  name: "Spend more than €100 in shoes and get 10% off in one shirt",
  when: {
    shoesTotal: "$sum(products['shoes' in categories].(centAmount*quantity))>10000",
    shirt: "products['shirts' in categories]^(centAmount)[0]",
  },
  then: [{
      action: "createLineDiscount",
      sku: "$shirt.sku",
      discount: "$shirt.centAmount * 0.1"
  },{
      action: "tagAsUsed",
      products: [{ productId: "$shirt.id", quantity: "1" }]
  }],
  times: 1,
  version: 0,
  createdAt: "2023-01-15T00:00:00.000+00:00"
}
```

## Performance

### Promotions

environment:
project:
cart:

- 1000 lines
- 11 MB REST, 170KB GraphQL
  promotions:
- 500
- all false
  results (GraphQL fetch):
- PromotionsEngine.run in 77.500ms. 500 promotions checked at 6.45 promotions/ms. in a cart with 1000 lines and 5532 products. 0 discounts created.

  - Get cart took 979.828ms
  - 2023-12-18 09:40:47.029 info: #E0Z9l →POST:/promotions/calculate?cartId=21248cde-b22e-4000-b19a-ce6e014f1b4f response with a 200-status took 1096.659ms

- PromotionsEngine.run in 19.814ms. 500 promotions checked at 25.23 promotions/ms. in a cart with 1000 lines and 5532 products. 0 discounts created.
  - Get cart took 798.057ms
  - 2023-12-18 09:43:28.857 info: #UysY8 →POST:/promotions/calculate?cartId=21248cde-b22e-4000-b19a-ce6e014f1b4f response with a 200-status took 830.872ms

## Testing

Run tests using Jest:

```bash
npm test
```

## Documentation

Refer to the [Postman Collection](doc/ecomm.postman_collection.json) for detailed API documentation and usage examples for product management operations.

## Contributing

1. Fork the repository.
2. Create your feature branch (`git checkout -b feature/new-feature`).
3. Commit your changes (`git commit -am 'Add new feature'`).
4. Push to the branch (`git push origin feature/new-feature`).
5. Open a pull request.

## License

This project is UNLICENSED.

---

# Todos

- [x] Versions
- [x] Timestamps
- [x] Server wide Project field
- [x] Separate base/variants in their own documents
- [x] Separate stage/online (Catalogs)
- [x] Add Catalog sync
- [x] AuditLog
- [x] Catalog Sync
- [x] i18n Strings fields
- [x] Search
- [x] Prices
- [x] commercetools layer
  - [/] Import Products with Prices
  - [x] v1/getProduct endpoint
- [x] Create Random Products & Prices
- [x] Promotions
- [ ] Review Enum/List/Set attribute types
- [ ] Images/Assets fields
- [ ] Reference fields
- [ ] User defined Product relations (upsell, crossell..)
- [ ] Reference expansions

## Others

- Define attributes as mandatory for a given channel/store (without forcing it in the data model)
- Publish only some variants
- Product groups (labels?)
  - Variants groups (?)
- Attribute groups
- Composite products (Pizza, cars, presentation cards)
- Storing variants and products separately will make querying products more difficult (AQ problem will be back) (AQ problem?)
- Other ways of adding data to product than attributes (?)
- Store-based category trees and categorization of products
- Dynamic variants (?)
- Product bundles..
- Extra dimensions
  - Channels
  - Stores
- Show/Query Atributes per location (per store?)
- Show/Query only a specific group of variants (i.e.: from 500, i.e.: only in stock)
- Separate staged and current
- Contextualisation management

- Search full data model
  - Faceted search and filtering
- Import/export
- Sizes conversion
- Discounts

---

# Ecomm

<a alt="Nx logo" href="https://nx.dev" target="_blank" rel="noreferrer"><img src="https://raw.githubusercontent.com/nrwl/nx/master/images/nx-logo.png" width="45"></a>

✨ Your new, shiny [Nx workspace](https://nx.dev) is ready ✨.

[Learn more about this workspace setup and its capabilities](https://nx.dev/nx-api/node?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects) or run `npx nx graph` to visually explore what was created. Now, let's get you up to speed!

## Run tasks

To run the dev server for your app, use:

```sh
npx nx serve catalog
```

To create a production bundle:

```sh
npx nx build catalog
```

To see all available targets to run for a project, run:

```sh
npx nx show project catalog
```

These targets are either [inferred automatically](https://nx.dev/concepts/inferred-tasks?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects) or defined in the `project.json` or `package.json` files.

[More about running tasks in the docs &raquo;](https://nx.dev/features/run-tasks?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)

## Add new projects

While you could add new projects to your workspace manually, you might want to leverage [Nx plugins](https://nx.dev/concepts/nx-plugins?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects) and their [code generation](https://nx.dev/features/generate-code?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects) feature.

Use the plugin's generator to create new projects.

To generate a new application, use:

```sh
npx nx g @nx/node:app demo
```

To generate a new library, use:

```sh
npx nx g @nx/node:lib mylib
```

You can use `npx nx list` to get a list of installed plugins. Then, run `npx nx list <plugin-name>` to learn about more specific capabilities of a particular plugin. Alternatively, [install Nx Console](https://nx.dev/getting-started/editor-setup?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects) to browse plugins and generators in your IDE.

[Learn more about Nx plugins &raquo;](https://nx.dev/concepts/nx-plugins?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects) | [Browse the plugin registry &raquo;](https://nx.dev/plugin-registry?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)
