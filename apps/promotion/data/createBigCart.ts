import { nanoid } from 'nanoid';

const itemsToInsert = parseInt(process.argv[2]) || 1;
let prodCount = 1;
let catCount = itemsToInsert + 1;

async function main() {
  let cart = {
    customer: {
      customerGroup: 'VIP',
      stores: ['store1', 'store2']
    },
    products: Array.from(new Array(itemsToInsert), () => ({
      id: nanoid(),
      sku: `SKU${prodCount++}`,
      centAmount: 5000 + Math.floor(Math.random() * 10) * 100,
      quantity: 5 + Math.floor(Math.random() * 10),
      categories: [`cat${catCount--}`]
    }))
  };
  console.log(JSON.stringify(cart, null, 2));
}

await main().then(console.log).catch(console.error).finally();
