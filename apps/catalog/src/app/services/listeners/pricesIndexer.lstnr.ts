import { Value } from '@sinclair/typebox/value';
import { green, red, magenta, yellow, bold } from 'kolorist';
import { type IProductService, ProductService } from '../product.svc';
import { RateLimit } from 'async-sema';
import pino from 'pino';

export class PricesIndexerListener {
  private server: any;
  private productService: IProductService;
  private catalogs: string[];
  private msgIn = bold(yellow('←')) + yellow('MSG:');
  private lim = RateLimit(10); // rps
  private TOPIC = `*.price.*`;

  constructor(server: any) {
    this.server = server;
    this.catalogs = server.config.CATALOGS_TO_INDEX?.split(',');
    this.productService = ProductService.getInstance(server);
  }

  public start() {
    if (!this.server.index) {
      this.server.log.warn(
        `${yellow('PricesIndexingService not active because the indexing service is not available')}`,
      );
      return;
    }
    this.server.log.info(
      `${yellow('PricesIndexingService')} ${green('listening to')} [${this.TOPIC}] ${green('for')} [${this.catalogs}] ${green('catalogs')}`,
    );
    this.server.queues.subscribe(this.TOPIC, this.handler.bind(this));
  }

  private async handler(data: any) {
    if (!this.server.index) return;
    if (data.metadata.entity !== 'price') return;
    if (!this.catalogs.includes(data.metadata.catalogId)) return;
    await this.lim();
    if (this.server.logger.isLevelEnabled('debug'))
      this.server.log.debug(
        `${magenta('#' + data.metadata.requestId || '')} ${this.msgIn} indexing ${green(data.source.id)}`,
      );
    if (data.metadata.type === 'entityUpdate') {
      // TODO: update Product on Price Update
      // const updates = Value.Patch({}, data.difference);
      // updates.id = data.source.id;
      // this.server.index.collections('products').documents().update(updates);
    } else if (data.metadata.type === 'entityInsert') {
      const productResult = await this.productService.findProducts(
        data.metadata.catalogId,
        { sku: data.source.sku },
        { project: { _id: 1 } },
      );
      if (productResult.err || productResult.val.length === 0) {
        this.server.log.error(
          `Error indexing price ${data.source.id}`,
          productResult.err,
        );
        return;
      }
      // await this.server.index
      //   .collections('products')
      //   .documents(productResult.val[0].id)
      //   .update({ prices: data.source });
      await this.retryWithDelay(async () => {
        await this.server.index
          .collections('products')
          .documents(productResult.val[0].id)
          .update({
            prices: data.source,
            price: data.source.predicates[0].value.centAmount / 100,
          });
      }).catch((err: any) => {
        console.log(
          'Error indexing price for product',
          productResult.val[0].id,
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

export const pricesIndexerListener = (server: any) => {
  return new PricesIndexerListener(server).start();
};
