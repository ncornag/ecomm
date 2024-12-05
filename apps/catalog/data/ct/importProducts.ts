import { CT } from '../../src/core/lib/ct';
import { FieldPredicateOperators, createPredicateExpression } from '../../src/core/services/price.svc';
import { Db, MongoClient } from 'mongodb';
import {
  Product,
  ProductPagedQueryResponse,
  ProductVariant,
  StandalonePricePagedQueryResponse
} from '@commercetools/platform-sdk';
import { green, magenta, yellow, gray, reset } from 'kolorist';

const server = {
  config: process.env
};

const CatalogNames: Record<string, string> = {
  STAGE: 'Stage',
  ONLINE: 'Online',
}

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
      let end = new Date().getTime();
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
        catalog: catalog === this.ct.Catalog.STAGED ? this.Catalog.STAGE : this.Catalog.ONLINE,
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
        catalog: catalog === this.ct.Catalog.STAGED ? CatalogNames.STAGE.toLowerCase() : CatalogNames.ONLINE.toLowerCase(),
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
      let dataValue = price[key] || tier[key];
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
        catalog: catalog === this.ct.Catalog.STAGED ? this.Catalog.STAGE : this.Catalog.ONLINE,
        createdAt: p.createdAt,
        sku: v.sku,
        active: true,
        predicates: tiers
          .sort((a: any, b: any) => {
            return a.minimumQuantity < b.minimumQuantity;
          })
          .map((tier: any) => {
            let constraints = this.createConstraints(FieldPredicateOperators, tier, price);
            let expression = createPredicateExpression(constraints);
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
    let order = 1;
    return v.prices?.map((price: any) => {
      return this.createPrice(price, order, v, p, projectId, catalog);
    });
  }

  private async createStandalonePrices(variant: ProductVariant, product: Product, projectId: string, catalog: string) {
    const prices: any[] = [];
    const pageSize = 100;
    let limit = pageSize;
    let offset = 0;
    let body: StandalonePricePagedQueryResponse = { limit: 0, offset: 0, count: 0, results: [] };
    let pricesCount = 0;
    let lastId: any = null;

    let queryArgs: any = {
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
      let body = (await this.ct.api.standalonePrices().get({ queryArgs }).execute()).body;
      // console.log(
      //   `${green('Prices')}: ${body.offset} limit: ${body.limit} count: ${body.count} query: ${JSON.stringify(
      //     queryArgs
      //   )}`
      // );
      let order = 1;
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
    product.masterData[catalog].masterVariant.attributes.push({ name: 'isMasterVariant', value: true });
    // Import Variants
    product.masterData[catalog].variants.push(product.masterData[catalog].masterVariant);
    for (let v = 0; v < product.masterData[catalog].variants.length; v++) {
      const variant = product.masterData[catalog].variants[v];
      products.push(this.createVariant(variant, product, projectId, catalog, base._id));
      // Import Prices
      if (product.priceMode === this.ct.PriceMode.EMBEDDED) {
        prices.push(...this.createPrices(variant, product, projectId, catalog));
      } else if (product.priceMode === this.ct.PriceMode.STANDALONE) {
        const standAlonePrices = await this.createStandalonePrices(variant, product, projectId, catalog);
        prices.push(...standAlonePrices);
      }
    }
  }

  public async importProducts(firstProductToImport: number = 0, productsToImport: number = 1) {
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
    } catch (e) {}
    try {
      await this.col.products.current.drop();
    } catch (e) {}
    try {
      await this.col.prices.staged.drop();
    } catch (e) {}
    try {
      await this.col.prices.current.drop();
    } catch (e) {}

    let start = new Date().getTime();
    let queryArgs: any = {
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

const firstPriceToImport = parseInt(process.argv[2]) || 0;
const productsToImport = parseInt(process.argv[3]) || 1;
const stageSufix = process.argv[4] || CatalogNames.STAGE;
const currentSufix = process.argv[5] || CatalogNames.ONLINE;

const productImporter = new ProductImporter(server, stageSufix, currentSufix);

await productImporter.importProducts(firstPriceToImport, productsToImport);

console.log('Done!');
process.exit(0);
