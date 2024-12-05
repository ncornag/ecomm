import tsresult, { type Result } from 'ts-results';
const { Ok, Err } = tsresult;
import { AppError, ErrorCode } from '../src/core/lib/appError';
import { fakerEN, fakerES, Randomizer } from '@faker-js/faker';
import { Db, MongoClient } from 'mongodb';
import { CT } from '../src/core/lib/ct';
import { createPredicateExpression } from '../src/core/services/price.svc';
import fetch from 'node-fetch';
import { Sema } from 'async-sema';

fakerEN.seed(7);
fakerES.seed(7);

function randomIntFromInterval(min: number, max: number) {
  // min and max included
  return Math.floor(Math.random() * (max - min + 1) + min);
}

const server = {
  config: process.env
};

const CatalogNames: Record<string, string> = {
  STAGE: 'Stage',
  ONLINE: 'Online',
}

class ProductCreator {
  private server: any;
  private ct: CT;
  private mongoClient: MongoClient;
  private db: Db;
  private productCollectionName = 'Product';
  private pricesCollectionName = 'Prices';
  private col: any = {};
  private logCount = 100;
  private projectId = 'TestProject';
  private categories = Array.from({ length: 100 }, (_, i) => fakerEN.commerce.department());
  private countries = ['DE', 'ES', 'US', 'FR', 'IT', 'NL', 'PL', 'PT', 'RU', 'JP'];
  private channels = Array.from({ length: 20 }, (_, i) => `channel-${i}`);
  private customerGroups = Array.from({ length: 20 }, (_, i) => `cg-${i}`);
  private brands = Array.from({ length: 1000 }, (_, i) => fakerEN.company.name());
  private predicateValues = {
    country: this.countries,
    channel: this.channels,
    customerGroup: this.customerGroups
  };
  private predicatesOrder = [['country'], ['channel'], ['customerGroup']];

  constructor(server: any, stageSufix: string, currentSufix: string) {
    this.server = server;
    this.ct = new CT(this.server);
    this.mongoClient = new MongoClient(this.server.config.MONGO_URL);
    this.db = this.mongoClient.db();
    this.col.products = {
      staged: this.db.collection(`${this.productCollectionName}${stageSufix}`),
      current: this.db.collection(`${this.productCollectionName}${currentSufix}`)
    };
    this.col.prices = {
      staged: this.db.collection(`${this.pricesCollectionName}${stageSufix}`),
      current: this.db.collection(`${this.pricesCollectionName}${currentSufix}`)
    };
  }

  private async writeAndLogAPI(params: any): Promise<Result<any, AppError>> {
    if ((params.base && params.productsCount % this.logCount === 0) || params.force === true) {
      let end = new Date().getTime();
      console.log(
        `Inserted ${params.productsCount} products at ${(
          (params.productsCount * 1000) /
          (end - params.start)
        ).toFixed()} items/s`
      );
      params.start = new Date().getTime();
    }
    let result: Result<any, AppError>;
    if (params.base || params.variant) {
      result = await fetch('http://127.0.0.1:3000/products?catalog=stage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(params.base || params.variant)
      })
        .then((response) => response.json())
        .then((response) => new Ok(response))
        .catch((error) => {
          return new Err(new AppError(ErrorCode.BAD_REQUEST, error.message));
        });
    } else if (params.price) {
      result = await fetch('http://127.0.0.1:3000/prices?catalog=stage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(params.price)
      })
        .then((response) => response.json())
        .then((response) => new Ok(response))
        .catch((error) => {
          return new Err(new AppError(ErrorCode.BAD_REQUEST, error.message));
        });
    } else {
      return new Ok({});
    }
    if (result.err) {
      console.log(result);
      process.exit(0);
    }
    return result;
  }

  public searchKeywords(min: number, max: number): any {
    const keywordsEN: any[] = [];
    const keywordsES: any[] = [];
    const m = randomIntFromInterval(min, max);
    for (let i = 0; i < m; i++) {
      keywordsEN.push({ text: fakerEN.commerce.productAdjective() });
      keywordsES.push({ text: fakerES.commerce.productAdjective() });
    }
    return { en: keywordsEN, es: keywordsES };
  }

  public createProduct(projectId: string, catalog: string): any {
    return {
      type: 'base',
      name: { en: fakerEN.commerce.productName(), es: fakerES.commerce.productName() },
      description: {
        en: fakerEN.lorem.paragraphs({ min: 1, max: 3 }),
        es: fakerES.lorem.paragraphs({ min: 1, max: 3 })
      },
      searchKeywords: this.searchKeywords(1, 3),
      slug: {
        en: fakerEN.lorem.slug(),
        es: fakerES.lorem.slug()
      },
      categories: [this.categories[randomIntFromInterval(1, this.categories.length - 1)]]
      //priceMoes: this.ct.PriceMode.EMBEDDED
    };
  }

  public createVariant(projectId: string, parent: any, pricesPerVariant: number): any {
    let sku = fakerEN.commerce.isbn(13);
    let order = 1;
    let prices = Array.from({ length: pricesPerVariant }, (_, i) =>
      this.createPrice(projectId, parent.catalog, sku, order++, this.predicatesOrder)
    );
    prices.push(this.createPrice(projectId, parent.catalog, sku, order++, [[]]));
    return [
      {
        type: 'variant',
        parent: parent.id,
        name: {
          en: `${parent.name.en} - ${fakerEN.commerce.productName()}`,
          es: `${parent.name.es} - ${fakerES.commerce.productName()}`
        },
        sku,
        attributes: {
          color: fakerEN.color.human(),
          size: fakerEN.string.numeric({ length: 1 }),
          brand:
            this.brands[
            randomIntFromInterval(
              0,
              productsToInsert / 5 > this.brands.length ? this.brands.length - 1 : productsToInsert / 5
            )
            ],
          popularity: randomIntFromInterval(1000, 5000),
          free_shipping: Math.random() < 0.1,
          rating: randomIntFromInterval(1, 5)
        }
      },
      prices
    ];
  }

  public createPrice(projectId: string, catalog: string, sku: string, order: number, predicatesOrder: any): any {
    const centAmount = randomIntFromInterval(1000, 10000);
    let constraintsAcc = {};
    return {
      order,
      sku,
      active: true,
      predicates: Array.from({ length: predicatesOrder.length }, (_, i) => {
        let predicates = predicatesOrder[i].reduce((acc: any, curr: any) => {
          acc[curr] = [this.predicateValues[curr][randomIntFromInterval(0, this.predicateValues[curr].length - 1)]];
          constraintsAcc[curr] = acc[curr];
          return acc;
        }, Object.assign({}, constraintsAcc));
        let expression = createPredicateExpression(predicates);
        return Object.assign(
          {
            order: predicatesOrder.length - i,
            value: {
              type: 'centPrecision',
              currencyCode: 'EUR',
              centAmount: centAmount - i * 10,
              fractionDigits: 2
            },
            constraints: predicates
          },
          expression && { expression }
        );
      }).sort((a, b) => a.order - b.order)
    };
  }

  public async createProducts(productsToInsert: number = 1, variantsPerProduct: number = 1, pricesPerVariant = 1) {
    let productsCount = 0;
    let variantsCount = 0;
    let pricesCount = 0;
    const s = new Sema(1, { capacity: productsToInsert });

    try {
      await this.col.products.staged.drop();
    } catch (e) { }
    try {
      await this.col.prices.staged.drop();
    } catch (e) { }
    console.log('Staged collections dropped successfully');

    let start = new Date().getTime();
    const arr: any[] = [];
    for (let i = 0; i < productsToInsert; i++) arr.push(i + 1);
    await Promise.all(
      arr.map(async (elem) => {
        await s.acquire();
        const base = this.createProduct(this.projectId, CatalogNames.STAGE.toLowerCase());
        productsCount++;
        const baseResult = await this.writeAndLogAPI({ productsCount, start, base });
        for (let j = 0; j < variantsPerProduct; j++) {
          const [variant, prices] = this.createVariant(this.projectId, baseResult.val, pricesPerVariant);
          variantsCount++;
          const variantsResult = await this.writeAndLogAPI({ productsCount, start, variant });
          for (let k = 0; k < prices.length - 1; k++) {
            prices[k].sku = variantsResult.val.sku;
            const priceResult = await this.writeAndLogAPI({ productsCount, start, price: prices[k] });
            pricesCount++;
          }
        }
        s.release();
      })
    ).catch((e) => console.log(e));

    await this.writeAndLogAPI({ productsCount, start, force: true });
    console.log(`Database seeded with ${productsCount} products + ${variantsCount} variants and ${pricesCount} prices`);
  }
}

const productsToInsert = parseInt(process.argv[2]) || 1;
const variantsPerProduct = parseInt(process.argv[3]) || 1;
const pricesPerVariant = parseInt(process.argv[4]) || 1;
const stageSufix = process.argv[5] || CatalogNames.STAGE;
const currentSufix = process.argv[6] || CatalogNames.ONLINE;

const productImporter = new ProductCreator(server, stageSufix, currentSufix);

await productImporter.createProducts(productsToInsert, variantsPerProduct, pricesPerVariant);

console.log('Done!');
process.exit(0);
