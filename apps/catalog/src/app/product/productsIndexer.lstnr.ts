import { type Product, ProductType } from './product';
import { Value } from '@sinclair/typebox/value';
import { green, magenta, yellow, bold } from 'kolorist';
import { type IProductService, ProductService } from './product.svc';
import { RateLimit } from 'async-sema';
import { faker } from '@faker-js/faker';

export class ProductsIndexerListener {
  private server: any;
  private productService: IProductService;
  private catalogs: string[];
  private msgIn = bold(yellow('←')) + yellow('MSG:');
  private num = 0;
  private lim = RateLimit(100); // rps
  private TOPIC = '*.product.*';

  private lvl0Cats = ['Cell Phones'];
  private lvl1Cats = Array.from({ length: 10 }, (_, i) =>
    faker.commerce.department(),
  );

  constructor(server: any) {
    this.server = server;
    this.catalogs = server.config.CATALOGS_TO_INDEX?.split(',');
    this.productService = ProductService.getInstance(server);
  }

  public start() {
    if (!this.server.index) {
      this.server.log.warn(
        `${yellow('ProductIndexingService not active because the indexing service is not available')}`,
      );
      return;
    }
    this.server.log.info(
      `${yellow('ProductIndexingService')} ${green('listening to')} [${this.TOPIC}] ${green('for')} [${this.catalogs}] ${green('catalogs')}`,
    );
    this.server.queues.subscribe(this.TOPIC, this.handler.bind(this));
  }

  private randomIntFromInterval(min: number, max: number) {
    // min and max included
    return Math.floor(Math.random() * (max - min + 1) + min);
  }

  private toIndexDocument(variant: Product): any {
    const doc: any = {
      id: variant.id,
      sku: variant.sku,
      catalog: variant.catalog,
      name: variant.name!.en,
      description: variant.description!.en,
      searchKeywords: variant.searchKeywords!.en.map((e) => e.text),
      attributes: variant.attributes,
      popularity: variant.attributes.popularity,
      free_shipping: variant.attributes.free_shipping,
      rating: variant.attributes.rating,
      brand: variant.attributes.brand,
      categories: [
        this.lvl0Cats[this.randomIntFromInterval(0, this.lvl0Cats.length - 1)],
        this.lvl1Cats[this.randomIntFromInterval(0, this.lvl1Cats.length - 1)],
        ...variant.categories,
      ],
      image: `https://picsum.photos/id/${this.num++}/200`,
      vector: [],
    };
    if (this.num > 1084) this.num = 0;
    doc.categories.forEach((category: string, index: number) => {
      doc[`categories.lvl${index}`] = [
        doc.categories.slice(0, index + 1).join(' > '),
      ];
    });
    return doc;
  }

  private async handler(data: any) {
    if (!this.server.index) return;
    if (data.metadata.entity !== 'product') return;
    if (data.source.type !== ProductType.VARIANT) return;
    if (!this.catalogs.includes(data.metadata.catalogId)) return;
    await this.lim();
    if (this.server.logger.isLevelEnabled('debug'))
      this.server.log.debug(
        `${magenta('#' + data.metadata.requestId || '')} ${this.msgIn} indexing ${green(data.source.id)}`,
      );
    if (data.metadata.type === 'entityUpdated') {
      const updates = Value.Patch({}, data.difference);
      updates.id = data.source.id;
      this.server.index.collections('products').documents().update(updates);
    } else if (data.metadata.type === 'entityCreated') {
      // TODO: filter what to index, including fields and locales

      // Get the materialized Variant
      const productResult = await this.productService.findProductById(
        data.metadata.catalogId,
        data.source.id,
        true,
      );
      if (productResult.err) {
        this.server.log.error(
          `Error indexing product ${data.source.id}`,
          productResult.err,
        );
        return;
      }
      // Index the Variant as a serch document
      await this.server.index
        .collections('products')
        .documents()
        .upsert(this.toIndexDocument(productResult.val))
        .catch((err: any) => {
          console.log(
            'Error indexing product',
            productResult.val.id,
            err.message,
          );
        });
    }
  }

  private async retryWithDelay(
    fn: Function,
    retries = 3,
    interval = 500,
    finalErr = 'Retry failed',
  ): Promise<any> {
    try {
      await fn();
    } catch (err) {
      if (retries <= 0) {
        return Promise.reject(finalErr);
      }
      await this.wait(interval);
      return this.retryWithDelay(fn, retries - 1, interval, finalErr);
    }
  }

  private wait(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export const productsIndexerListener = (server: any) => {
  return new ProductsIndexerListener(server).start();
};
