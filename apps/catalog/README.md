# Catalog

The project provides an API-driven system to manage product catalogs, classifications, and their synchronization between staged and online environments.
It includes features for importing, creating, updating, and validating products and their associated data structures.

## Main Features

- **Product Management:** Create products with multiple attributes, variants, and prices, including pricing.
- **Product Categories:** Assign the products to a tree based Category system.
- **Classification Management:** Create and manage classification attributes for the Categories, heavily based on [this](https://help.sap.com/docs/SAP_COMMERCE/d0224eca81e249cb821f2cdf45a82ace/8b7aa49c86691014ae51c3b0d38cd87b.html#%23).
- **Catalog Synchronization:** Sync product data between stage and online catalogs.
- **Pricing:** Rules based pricing.
- **Product Importing:** Import products from commercetools into a MongoDB database, supporting staged and online catalogs.
- **Audit Logging**: Track changes to promotions and other entities with an extensive audit logging system.

## Data

The project comes with a preconfigured set of products (take a look at this [TestData](src/migrations/development/mig_promotion_00_TestData)), nevertheless you can run a script to create products with variants and prices.

- **To create products**:

  ```bash
  nx run createProducts:run --args="-p=3"
  ```

  Use `nx run createProducts:run` for help

- **To import products**:

  To import products from commercetools, you can use this script:

  ```bash
  nx run importProducts:run
  ```

- **To update products**:

  To force a massive update on products and test the synchronization capabilities, you can use this script:

  ```bash
  nx run updateProducts:run
  ```

## Running the Application

```bash
nx run catalog:serve
```

## Example Price

```json
{
  "order": 5,
  "sku": "978-0-08-787953-9",
  "active": true,
  "predicates": [
    {
      "order": 1,
      "value": {
        "type": "centPrecision",
        "currencyCode": "EUR",
        "centAmount": 7687,
        "fractionDigits": 2
      },
      "constraints": {
        "country": ["PT"],
        "channel": ["channel-9"],
        "customerGroup": ["cg-19"]
      },
      "expression": "'PT' in country and 'channel-9' in channel and 'cg-19' in customerGroup"
    },
    {
      "order": 2,
      "value": {
        "type": "centPrecision",
        "currencyCode": "EUR",
        "centAmount": 7697,
        "fractionDigits": 2
      },
      "constraints": {
        "country": ["PT"],
        "channel": ["channel-9"]
      },
      "expression": "'PT' in country and 'channel-9' in channel"
    },
    {
      "order": 3,
      "value": {
        "type": "centPrecision",
        "currencyCode": "EUR",
        "centAmount": 7707,
        "fractionDigits": 2
      },
      "constraints": {
        "country": ["PT"]
      },
      "expression": "'PT' in country"
    }
  ]
}
```
