import { faker } from '@faker-js/faker';
import { Db, MongoClient } from 'mongodb';

const server = {
  config: process.env,
};

class ProductUpdater {
  private server: any;
  private mongoClient: MongoClient;
  private db: Db;
  private productCollectionName = 'ProductStage';
  productsToUpdate = parseInt(process.argv[2]) || 1;
  private logCount = 10000;

  constructor(server: any) {
    this.server = server;
    this.mongoClient = new MongoClient(this.server.config.MONGO_URL);
    this.db = this.mongoClient.db();
  }

  private randomIntFromInterval(min: number, max: number) {
    // min and max included
    return Math.floor(Math.random() * (max - min + 1) + min);
  }

  private updateProduct(product: any): any {
    return {
      updateOne: {
        filter: { _id: product._id },
        update: {
          $set: {
            'name.en': faker.commerce.productName(),
            lastModifiedAt: new Date().toISOString(),
          },
          $inc: { version: 1 },
        },
      },
    };
  }

  public async updateProducts(productsToUpdate = 1) {
    await this.mongoClient.connect();
    console.log('Connected successfully to server');

    const collection = this.db.collection(this.productCollectionName);

    let count = 0;
    const start = new Date().getTime();

    const products = await collection.find().limit(productsToUpdate);
    let updates: any[] = [];
    for await (const product of products) {
      const update = this.updateProduct(product);
      updates.push(update);
      count++;
      if (count % this.logCount === 0) {
        await collection.bulkWrite(updates);
        updates = [];
        const end = new Date().getTime();
        console.log(`Updated ${count} products in ${end - start} ms`);
      }
    }
    if (updates.length > 0) {
      await collection.bulkWrite(updates);
    }
    const end = new Date().getTime();
    console.log(`Updated ${count} products in ${end - start} ms`);

    this.mongoClient.close();
    console.log('Database seeded! :)');
  }
}

if (process.argv.length < 3 || process.argv.length > 3) {
  console.log('Usage: nx run updateProducts:run --args="[<productsToUpdate>]"');
  console.log('> nx run updateProducts:run --args="[5]"');
  process.exit(0);
}

const productsToUpdate = parseInt(process.argv[2]) || 1;

console.log(`Updateing ${productsToUpdate} products`);

const promotionsCreator = new ProductUpdater(server);

async function main() {
  try {
    await promotionsCreator.updateProducts(productsToUpdate);
    console.log('Done!');
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}
void main();
