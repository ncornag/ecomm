import { Db, MongoClient } from 'mongodb';
import args from 'args';

const server = {
  config: process.env,
};

class PromotionsCreator {
  private server: any;
  private mongoClient: MongoClient;
  private db: Db;
  private promotionCollectionName = 'Promotion';
  private catCounter = 1;
  private promCounter = 1;
  private logCount = 1000;

  constructor(server: any) {
    this.server = server;
    this.mongoClient = new MongoClient(this.server.config.MONGO_URL);
    this.db = this.mongoClient.db();
  }

  private createRandomPromotion(projectId: string): any {
    const cat1 = 'category-' + this.catCounter++;
    const cat2 = 'category-' + this.catCounter++;
    const result: any = {
      _id: `prom${this.promCounter++}`,
      projectId,
      version: 0,
      createdAt: new Date().toISOString(),
      //times: 1, // Default infinite
      //active: true, // Default true
      name: `Buy 1 ${cat1} and get 10% off in 1 ${cat2}`,
      when: {
        // baseProduct: `items['${cat1}' in categories][0]`,
        // minPrice: `$min(items['${cat2}' in categories].value.centAmount)`,
        // secondProduct: `items['${cat2}' in categories and value.centAmount=$minPrice][0]`
        baseProduct: `$productInCategory(items, '${cat1}')`,
        secondProduct: `$lowestPricedProductInCategory(items, '${cat2}')`,
      },
      then: [
        {
          action: 'createLineDiscount',
          sku: '$secondProduct.sku',
          discount: '$secondProduct.value.centAmount * 0.1',
        },
        {
          action: 'tagAsUsed',
          items: [
            { productId: '$baseProduct.id', quantity: '1' },
            { productId: '$secondProduct.id', quantity: '1' },
          ],
        },
      ],
    };
    return result;
  }

  private async writeAndLog(
    count: number,
    logCount: number,
    start: number,
    collection: any,
    promotions: any[],
    force = false,
  ) {
    if (count % logCount === 0 || force) {
      await collection.insertMany(promotions);
      promotions.splice(0, promotions.length);
      const end = new Date().getTime();
      console.log(
        `Inserted ${count} promotions at ${((count * 1000) / (end - start)).toFixed()} items/s`,
      );
    }
  }

  public async createPromotions(promotionsToInsert = 1) {
    await this.mongoClient.connect();
    console.log('Connected successfully to server');

    const collection = this.db.collection(this.promotionCollectionName);
    try {
      await collection.drop();
    } catch {
      return;
    }

    let count = 0;
    const start = new Date().getTime();

    const promotions: any = [];
    for (let i = 0; i < promotionsToInsert; i++) {
      const p = this.createRandomPromotion('TestProject');
      promotions.push(p);
      count++;
      await this.writeAndLog(
        count,
        this.logCount,
        start,
        collection,
        promotions,
      );
    }
    if (promotions.length > 0) {
      await this.writeAndLog(
        count,
        this.logCount,
        start,
        collection,
        promotions,
        true,
      );
    }
    console.log('Database seeded! :)');
  }
}

args.option('promotions', 'The quantity of promotions to create');

const argv = [
  process.argv[0],
  'nx run createPromotions:run --args="',
  ...(process.argv[2] || '').split(' '),
];

const flags = args.parse(argv, {
  value: args.printMainColor.reset.yellow('"'),
});

if (!flags.promotions) {
  args.showHelp();
  process.exit(0);
}

console.log(`Creating ${flags.promotions} promotions`);

const promotionsCreator = new PromotionsCreator(server);

async function main() {
  try {
    await promotionsCreator.createPromotions(flags.promotions);
    console.log('Done!');
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}
void main();
