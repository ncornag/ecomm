# Promotions

This project is a scalable promotion management system that includes an engine for evaluating and applying promotions to customer carts.

## Main Features

- **Promotion Management**: Create, update, and manage promotions with actions like discounts and tagging products.
- **Promotion Evaluation Engine**: Rules based evaluation of promotions.
- **Cart Management**: Integrate with commercetools to manage customer carts and apply promotions.
- **Audit Logging**: Track changes to promotions and other entities with an extensive audit logging system.

## Data

The project comes with a preconfigured set of promotions (take a look at this [TestData](src/migrations/development/mig_promotion_00_TestData)), nevertheless you can create more promotions with random data running a script.

- **To create promotions**:

  ```bash
  nx run createPromotions:run --args="-p=3"
  ```

  Use `nx run createPromotions:run` for help

## Running the Application(s)

```bash
nx run promotions:serve
```

## Example Promotion

```json
{
  "name": "Spend more than €100 in shoes and get 10% off in one shirt",
  "when": {
    "shoesTotal": "$sum(products['shoes' in categories].(centAmount*quantity))>10000",
    "shirt": "products['shirts' in categories]^(centAmount)[0]"
  },
  "then": [
    {
      "action": "createLineDiscount",
      "sku": "$shirt.sku",
      "discount": "$shirt.centAmount * 0.1"
    },
    {
      "action": "tagAsUsed",
      "products": [{ "productId": "$shirt.id", "quantity": "1" }]
    }
  ],
  "times": 1
}
```
