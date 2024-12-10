import { CT } from '@ecomm/CT';
import { CartPagedQueryResponse } from '@commercetools/platform-sdk';

const server = {
  config: process.env,
};

class CartTools {
  private server: any;
  private ct: CT;
  private logCount = 1000;

  constructor(server: any) {
    this.server = server;
    this.ct = new CT(this.server);
  }

  public async writeAndLog(
    count: number,
    logCount: number,
    start: number,
    carts: any[],
    force = false,
  ) {
    if (count % logCount === 0 || force) {
      carts.splice(0, carts.length);
      const end = new Date().getTime();
      console.log(
        `Found ${count} carts at ${((count * 1000) / (end - start)).toFixed()} items/s`,
      );
    }
  }

  public async findBigCarts(
    firstCartToCheck = 0,
    cartsToFind = 1,
    numberOfLines = 0,
  ) {
    const carts: any = [];
    const pageSize = 10;
    let limit = cartsToFind > pageSize ? pageSize : cartsToFind;
    let offset = firstCartToCheck;
    let body: CartPagedQueryResponse;
    let cartsCount = 0;
    let cartsFound = 0;
    let lastId: any = null;

    const start = new Date().getTime();
    const queryArgs: any = { limit, offset, withTotal: false, sort: 'id asc' };
    do {
      if (lastId != null) {
        queryArgs.where = `id > "${lastId}"`;
        delete queryArgs.offset;
      }
      body = (await this.ct.api.carts().get({ queryArgs }).execute()).body;
      console.log(
        `offset: ${body.offset} limit: ${body.limit} count: ${body.count} query: ${JSON.stringify(queryArgs)}`,
      );
      for (let c = 0; c < body.results.length; c++) {
        const cart = body.results[c];
        if (cart.lineItems.length >= numberOfLines) {
          carts.push(cart);
          console.log(
            `Found cart ${cart.id} with ${cart.lineItems.length} line items`,
          );
          cartsFound++;
        }
        cartsCount++;
        await this.writeAndLog(cartsCount, this.logCount, start, carts);
      }
      if (body.results.length != 0)
        lastId = body.results[body.results.length - 1].id;
      limit =
        cartsToFind - cartsCount > pageSize
          ? pageSize
          : cartsToFind - cartsCount;
      offset = body.offset + body.count;
    } while (body.count > 0 && cartsFound < cartsToFind);
    if (carts.length > 0) {
      await this.writeAndLog(cartsCount, this.logCount, start, carts, true);
    }
    console.log(`Carts checked! ${cartsCount} carts.`);
  }
}

const firstCartToCheck = parseInt(process.argv[2]) || 0;
const cartsToFind = parseInt(process.argv[3]) || 1;
const numberOfLines = parseInt(process.argv[4]) || 1;

const cartTools = new CartTools(server);

cartTools
  .findBigCarts(firstCartToCheck, cartsToFind, numberOfLines)
  .then(() => console.log('Done!'));
