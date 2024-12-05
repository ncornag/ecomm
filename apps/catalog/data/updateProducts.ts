import { faker } from '@faker-js/faker';
import { MongoClient } from 'mongodb';

function randomIntFromInterval(min: number, max: number) {
  // min and max included
  return Math.floor(Math.random() * (max - min + 1) + min);
}

function updateProduct(product: any): any {
  return {
    updateOne: {
      filter: { _id: product._id },
      update: {
        $set: { 'name.en': faker.commerce.productName(), lastModifiedAt: new Date().toISOString() },
        $inc: { version: 1 }
      }
    }
  };
}

const url = 'mongodb://localhost:27017';
const client = new MongoClient(url);
const dbName = 'ecomm';
const colName = 'ProductStage';
const productsToModify = parseInt(process.argv[2]) || 1;
const logCount = 10000;

async function main() {
  await client.connect();
  console.log('Connected successfully to server');

  const db = client.db(dbName);
  const collection = db.collection(colName);

  let count = 0;
  let start = new Date().getTime();

  let productsToUpdate = await collection.find().limit(productsToModify);
  let updates = [];
  for await (const product of productsToUpdate) {
    const update = updateProduct(product);
    updates.push(update);
    count++;
    if (count % logCount === 0) {
      await collection.bulkWrite(updates);
      updates = [];
      let end = new Date().getTime();
      console.log(`Updated ${count} products in ${end - start} ms`);
    }
  }
  if (updates.length > 0) {
    await collection.bulkWrite(updates);
  }
  let end = new Date().getTime();
  console.log(`Updated ${count} products in ${end - start} ms`);

  console.log('Database seeded! :)');
}

main()
  .then(console.log)
  .catch(console.error)
  .finally(() => client.close());
