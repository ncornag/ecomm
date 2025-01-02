import { CT } from '@ecomm/ct';
import { Db, MongoClient } from 'mongodb';
import {
  Product,
  ProductPagedQueryResponse,
  ProductVariant,
  StandalonePricePagedQueryResponse
} from '@commercetools/platform-sdk';
import args from 'args';

const server = {
  config: process.env
};

const CatalogNames = {
  STAGE: 'Stage',
  ONLINE: 'Online'
} as const;

class ProductImporter {
  private server: any;
  private ct: CT;
  private mongoClient: MongoClient;
  private db: Db;
  private productCollectionName = 'Product';
  private pricesCollectionName = 'Prices';
  private col: any = {};
  private logCount = 100;
  private projectId = 'TestProject';
  private FieldPredicateOperators: any = {
    country: { operator: 'in', field: 'country', type: 'array' },
    customerGroup: {
      operator: 'in',
      field: 'customerGroup',
      type: 'array',
      typeId: 'customer-group'
    },
    channel: {
      operator: 'in',
      field: 'channel',
      type: 'array',
      typeId: 'channel'
    },
    validFrom: { operator: '>=', field: 'date', type: 'date' },
    validUntil: { operator: '<=', field: 'date', type: 'date' },
    minimumQuantity: { operator: '>=', field: 'quantity', type: 'number' }
  };

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

  private createPredicateExpression(data: any) {
    const surroundByQuotes = (value: any) => (typeof value === 'string' ? `'${value}'` : value);
    const predicate = Object.entries(data).reduce((acc, [key, value]) => {
      if (acc) acc += ' and ';
      const op = this.FieldPredicateOperators[key] ? this.FieldPredicateOperators[key].operator : '=';
      const field = this.FieldPredicateOperators[key] ? this.FieldPredicateOperators[key].field : key;
      let val: any = value;
      if (op === 'in') {
        if (!Array.isArray(val)) val = [val];
        if (val.length > 1) acc += '(';
        for (let i = 0; i < val.length; i++) {
          if (i > 0) acc += ' or ';
          acc += `${surroundByQuotes(val[i])} in ${field}`;
        }
        if (val.length > 1) acc += ')';
      } else {
        acc += `${field}${op}${surroundByQuotes(val)}`;
      }
      return acc;
    }, '');
    return predicate === '' ? undefined : predicate;
  }

  private async writeAndLog(params: any) {
    if (params.count % this.logCount === 0 || params.force === true) {
      await this.col.products.staged.insertMany(params.stagedProducts);
      if (params.stagedPrices.length > 0) await this.col.prices.staged.insertMany(params.stagedPrices);
      if (params.currentProducts.length > 0) await this.col.products.current.insertMany(params.currentProducts);
      if (params.currentPrices.length > 0) await this.col.prices.current.insertMany(params.currentPrices);
      params.stagedProducts.splice(0, params.stagedProducts.length);
      params.stagedPrices.splice(0, params.stagedPrices.length);
      params.currentProducts.splice(0, params.currentProducts.length);
      params.currentPrices.splice(0, params.currentPrices.length);
      const end = new Date().getTime();
      console.log(
        `Inserted ${params.productsCount} products at ${(
          (params.productsCount * 1000) /
          (end - params.start)
        ).toFixed()} items/s`
      );
    }
  }

  private createProduct(p: Product, projectId: string, catalog: string): any {
    const c = p.masterData[catalog];
    return Object.assign(
      {
        _id: p.id,
        version: p.version,
        projectId,
        catalogId: catalog === this.ct.Catalog.STAGED ? CatalogNames.STAGE : CatalogNames.ONLINE,
        type: 'base',
        createdAt: p.createdAt,
        name: c.name,
        slug: c.slug,
        categories: c.categories.map((c) => {
          return c.id;
        }),
        searchKeywords: c.searchKeywords,
        priceMode: p.priceMode || this.ct.PriceMode.EMBEDDED
      },
      p.taxCategory && { taxCategory: p.taxCategory.id },
      c.description && { description: c.description },
      p.key && { key: p.key },
      p.lastModifiedAt && { lastModifiedAt: p.lastModifiedAt }
    );
  }

  private createVariant(v: ProductVariant, p: Product, projectId: string, catalog: string, parent: string): any {
    return Object.assign(
      {
        _id: p.id + '#' + v.id,
        version: p.version,
        projectId,
        catalogId:
          catalog === this.ct.Catalog.STAGED ? CatalogNames.STAGE.toLowerCase() : CatalogNames.ONLINE.toLowerCase(),
        createdAt: p.createdAt,
        type: 'variant',
        parent: parent,
        attributes: v.attributes?.reduce((acc: any, a: any) => {
          acc[a.name] = a.value;
          return acc;
        }, {})
      },
      v.sku && { sku: v.sku },
      v.key && { key: v.key },
      p.lastModifiedAt && { lastModifiedAt: p.lastModifiedAt }
    );
  }

  private createConstraints(data: any, tier: any, price: any) {
    return Object.entries(data).reduce((acc: any, [key, value]: [string, any]) => {
      const dataValue = price[key] || tier[key];
      if (!dataValue) return acc;
      if (value.type === 'array' && value.typeId) {
        acc[key] = [dataValue.id];
      } else if (value.type === 'array') {
        acc[key] = [dataValue];
      } else if (value.type === 'number') {
        acc[key] = +dataValue;
      } else {
        acc[key] = dataValue;
      }
      return acc;
    }, {});
  }

  private createPrice(
    price: any,
    order: number,
    v: ProductVariant,
    p: Product,
    projectId: string,
    catalog: string
  ): any {
    const tiers: any = [{ value: price.value }].concat(price.tiers ?? []);
    return Object.assign(
      {
        _id: price.id,
        version: p.version,
        projectId,
        catalogId: catalog === this.ct.Catalog.STAGED ? CatalogNames.STAGE : CatalogNames.ONLINE,
        createdAt: p.createdAt,
        sku: v.sku,
        active: true,
        predicates: tiers
          .sort((a: any, b: any) => {
            return a.minimumQuantity < b.minimumQuantity;
          })
          .map((tier: any) => {
            const constraints = this.createConstraints(this.FieldPredicateOperators, tier, price);
            const expression = this.createPredicateExpression(constraints);
            return Object.assign(
              {
                order: order++,
                value: tier.value,
                constraints
              },
              expression && { expression }
            );
          })
      },
      price.key && { key: price.key },
      p.lastModifiedAt && { lastModifiedAt: p.lastModifiedAt }
    );
  }

  private createPrices(v: ProductVariant, p: Product, projectId: string, catalog: string): any {
    const order = 1;
    return v.prices?.map((price: any) => {
      return this.createPrice(price, order, v, p, projectId, catalog);
    });
  }

  private async createStandalonePrices(variant: ProductVariant, product: Product, projectId: string, catalog: string) {
    const prices: any[] = [];
    const pageSize = 100;
    let limit = pageSize;
    let offset = 0;
    const body: StandalonePricePagedQueryResponse = {
      limit: 0,
      offset: 0,
      count: 0,
      results: []
    };
    const pricesCount = 0;
    let lastId: any = null;

    const queryArgs: any = {
      limit,
      offset,
      withTotal: false,
      sort: 'id asc',
      where: `sku = "${variant.sku}"`
    };
    do {
      if (lastId != null) {
        queryArgs.where = `id > "${lastId}'`;
        delete queryArgs.offset;
      }
      const body = (await this.ct.api.standalonePrices().get({ queryArgs }).execute()).body;
      // console.log(
      //   `${green('Prices')}: ${body.offset} limit: ${body.limit} count: ${body.count} query: ${JSON.stringify(
      //     queryArgs
      //   )}`
      // );
      const order = 1;
      for (let p = 0; p < body.results.length; p++) {
        prices.push(this.createPrice(body.results[p], order, variant, product, projectId, catalog));
      }
      if (body.results.length != 0) lastId = body.results[body.results.length - 1].id;
      limit = pricesCount > pageSize ? pageSize : pricesCount;
      offset = body.offset + body.count;
    } while (body.count > 0);
    return prices;
  }

  private async importCatalogProduct(catalog: string, projectId: string, product, products, prices) {
    // Import Base
    const base = this.createProduct(product, projectId, catalog);
    products.push(base);
    // Add a new attribute to the masterVariant to flag it as masterVariant (for compatibility with the old API)
    product.masterData[catalog].masterVariant.attributes = product.masterData[catalog].masterVariant.attributes || [];
    product.masterData[catalog].masterVariant.attributes.push({
      name: 'isMasterVariant',
      value: true
    });
    // Import Variants
    product.masterData[catalog].variants.push(product.masterData[catalog].masterVariant);
    for (let v = 0; v < product.masterData[catalog].variants.length; v++) {
      const variant = product.masterData[catalog].variants[v];
      products.push(this.createVariant(variant, product, projectId, catalog, base._id));
      // Import Prices
      if (!product.priceMode || product.priceMode === this.ct.PriceMode.EMBEDDED) {
        prices.push(...this.createPrices(variant, product, projectId, catalog));
      } else if (product.priceMode === this.ct.PriceMode.STANDALONE) {
        const standAlonePrices = await this.createStandalonePrices(variant, product, projectId, catalog);
        prices.push(...standAlonePrices);
      }
    }
  }

  public async importProducts(firstProductToImport = 0, productsToImport = 1) {
    const stagedProducts: any[] = [];
    const stagedPrices: any[] = [];
    const currentProducts: any[] = [];
    const currentPrices: any[] = [];
    const pageSize = 100;
    let limit = productsToImport > pageSize ? pageSize : productsToImport;
    let offset = firstProductToImport;
    let body: ProductPagedQueryResponse;
    let productsCount = 0;
    let lastId: any = null;

    try {
      await this.col.products.staged.drop();
    } catch (e) {
      return;
    }
    try {
      await this.col.products.current.drop();
    } catch (e) {
      return;
    }
    try {
      await this.col.prices.staged.drop();
    } catch (e) {
      return;
    }
    try {
      await this.col.prices.current.drop();
    } catch (e) {
      return;
    }

    const start = new Date().getTime();
    const queryArgs: any = {
      limit,
      offset,
      withTotal: false,
      sort: 'id asc'
      //where: 'id = "57d89fc3-2034-4c3d-b2e1-5617a32bdb45" or id = "6a3736e4-eaba-416c-87f0-77612f9bb265"'
      //where: 'id="fff9dfc4-5b4e-470a-b88f-adc402c4ee72"'
      //where: 'id="57d89fc3-2034-4c3d-b2e1-5617a32bdb45"'
    };
    do {
      if (lastId != null) {
        queryArgs.where = `id > "${lastId}"`;
        delete queryArgs.offset;
      }
      body = (await this.ct.api.products().get({ queryArgs }).execute()).body;
      // console.log(
      //   `${green('Products')}: offset: ${body.offset} limit: ${body.limit} count: ${body.count} query: ${JSON.stringify(
      //     queryArgs
      //   )}`
      // );
      for (let p = 0; p < body.results.length; p++) {
        await this.importCatalogProduct(
          this.ct.Catalog.STAGED,
          this.projectId,
          body.results[p],
          stagedProducts,
          stagedPrices
        );
        await this.importCatalogProduct(
          this.ct.Catalog.CURRENT,
          this.projectId,
          body.results[p],
          currentProducts,
          currentPrices
        );
        productsCount++;
        await this.writeAndLog({
          productsCount,
          start,
          stagedProducts,
          stagedPrices,
          currentProducts,
          currentPrices
        });
      }
      if (body.results.length != 0) lastId = body.results[body.results.length - 1].id;
      limit = productsToImport - productsCount > pageSize ? pageSize : productsToImport - productsCount;
      offset = body.offset + body.count;
    } while (body.count > 0 && productsCount < productsToImport);
    if (stagedProducts.length > 0) {
      await this.writeAndLog({
        productsCount,
        start,
        stagedProducts,
        stagedPrices,
        currentProducts,
        currentPrices,
        force: true
      });
    }
    console.log(`Products imported! ${productsCount} products`);
  }
}

args
  .option('first', 'The first product to import', 0)
  .option('products', 'The quantity of products to import', 1)
  .option('stage', 'The stage suffix for the Products collection', CatalogNames.STAGE)
  .option('current', 'The current suffix for the Products collection', CatalogNames.ONLINE);

const argv = [process.argv[0], 'nx run importProducts:run --args="', ...(process.argv[2] || '').split(' ')];

const flags = args.parse(argv, {
  value: args.printMainColor.reset.yellow('"')
});

console.log(
  `Importing ${flags.products} products starting at ${flags.first} in ${flags.stage} and ${flags.current} collections`
);

const productImporter = new ProductImporter(server, flags.stage, flags.current);

async function main() {
  try {
    await productImporter.importProducts(flags.first, flags.products);
    console.log('Done!');
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}
void main();
