import { MongoClient } from 'mongodb';

let catCounter = 1;
let promCounter = 1;

function createRandomPromotion(projectId: string): any {
  const cat1 = 'category-' + catCounter++;
  const cat2 = 'category-' + catCounter++;
  let result: any = {
    _id: `prom${promCounter++}`,
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
      secondProduct: `$lowestPricedProductInCategory(items, '${cat2}')`
    },
    then: [
      {
        action: 'createLineDiscount',
        sku: '$secondProduct.sku',
        discount: '$secondProduct.value.centAmount * 0.1'
      },
      {
        action: 'tagAsUsed',
        items: [
          { productId: '$baseProduct.id', quantity: '1' },
          { productId: '$secondProduct.id', quantity: '1' }
        ]
      }
    ]
  };
  return result;
}

async function writeAndLog(
  count: number,
  logCount: number,
  start: number,
  collection: any,
  promotions: any[],
  force: boolean = false
) {
  if (count % logCount === 0 || force) {
    await collection.insertMany(promotions);
    promotions.splice(0, promotions.length);
    let end = new Date().getTime();
    console.log(`Inserted ${count} promotions at ${((count * 1000) / (end - start)).toFixed()} items/s`);
  }
}

const url = 'mongodb://localhost:27017';
const client = new MongoClient(url);
const dbName = 'ecomm';
const colName = 'Promotion';
const promotionsToInsert = parseInt(process.argv[2]) || 1;
const logCount = 1000;

async function main() {
  await client.connect();
  console.log('Connected successfully to server');

  const db = client.db(dbName);
  const collection = db.collection(colName);
  try {
    await collection.drop();
  } catch {}

  let count = 0;
  let start = new Date().getTime();

  let promotions: any = [];
  for (let i = 0; i < promotionsToInsert; i++) {
    const p = createRandomPromotion('TestProject');
    promotions.push(p);
    count++;
    await writeAndLog(count, logCount, start, collection, promotions);
  }
  if (promotions.length > 0) {
    await writeAndLog(count, logCount, start, collection, promotions, true);
  }
  console.log('Database seeded! :)');
}

await main()
  .then(console.log)
  .catch(console.error)
  .finally(() => client.close());
