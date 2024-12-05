import { FastifyInstance } from 'fastify';
import serverBuilder from '@ecomm/Server';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoDBStorage, Umzug } from 'umzug';
import assert from 'node:assert';
import { default as request } from 'supertest';
import { Value } from '@sinclair/typebox/value';
import { type ProductDAO } from './repositories/product.dao.schema';
import { type Product } from './entities/product';
import { toEntity as toProductEntity } from './services/product.svc';
import { envConfig } from './lib/env';
import { app } from './app';
const productShoes = [
  {
    _id: 'adizeroPrimeX2-base',
    version: 0,
    projectId: 'TestProject',
    catalog: 'stage',
    name: {
      en: 'ADIZERO PRIME X 2 STRUNG RUNNING SHOES',
    },
    description: {
      en: 'Built with innovative technology and designed without ...',
    },
    slug: {
      en: 'adizero-prime-x-2-strung-running-shoes',
    },
    searchKeywords: {
      en: [
        {
          text: 'adizero',
        },
        {
          text: 'prime',
        },
        {
          text: 'x',
        },
        {
          text: 'running',
        },
        {
          text: 'shoes',
        },
      ],
    },
    categories: ['shoes'],
    type: 'base',
    assets: [
      {
        url: 'https://commercetools.com/cli/data/253245821_1.jpg',
        tags: ['image', 'main', '800x500'],
      },
      {
        label: 'User Manual',
        url: 'https://commercetools.com/cli/data/manual.pdf',
        tags: ['pdf'],
      },
    ],
  },
];

let server: FastifyInstance;
let listeningApp: any;
const catalogParam = 'stage';

describe('Product', () => {
  beforeAll(async () => {
    // Memory Mongo up
    const memoryMongo = await MongoMemoryServer.create();
    const uri = memoryMongo.getUri();
    process.env.MONGO_URL = `${uri}test`;
    (global as any).__MONGOINSTANCE = memoryMongo;
    // App up (& Migrations up)
    server = await serverBuilder(app, envConfig);
    listeningApp = server.server;
  }, 20000);

  afterAll(async () => {
    // Migrations down
    const path = `**/migrations/${server.config.NODE_ENV}/mig_*.ts`;
    const migrator = new Umzug({
      migrations: { glob: path },
      storage: new MongoDBStorage({
        collection: server.mongo.db!.collection('migrations'),
      }),
      logger: server.logger,
      context: {
        server,
      },
    });
    await migrator.down();
    // App down
    await server.close();
    // Memory Mongo down
    const memoryMongo: MongoMemoryServer = (global as any).__MONGOINSTANCE;
    await memoryMongo.stop();
  });

  test('findOneProduct', async () => {
    const pId = 'adizeroPrimeX2-base';
    const expected: Product = toProductEntity(
      productShoes.find((p) => p._id == pId) as unknown as ProductDAO,
    );
    // const expected = p1;
    const response = await request(listeningApp)
      .get(`/products/${pId}?catalog=${catalogParam}`)
      .expect(200)
      .expect('Content-Type', 'application/json; charset=utf-8');
    assert.strictEqual(response.body.id, pId);
    assert.deepEqual(
      response.body,
      expected,
      `Differences: ${Value.Diff(response.body, expected)}`,
    );
  });

  test('createProduct [BASE]', async () => {
    const requestData = {
      name: { en: 'English Base text' },
      description: { en: 'English Description ...' },
      slug: { en: 'slug1' },
      searchKeywords: { en: [{ text: 'keyword1' }] },
      categories: ['shoes'],
      type: 'base',
    };
    const response = await request(listeningApp)
      .post(`/products?catalog=${catalogParam}`)
      .send(requestData)
      .set('Accept', 'application/json')
      .expect(201)
      .expect('Content-Type', 'application/json; charset=utf-8');

    const expected = Object.assign(
      {
        attributes: {},
        categories: [],
        version: 0,
        id: response.body.id,
        createdAt: response.body.createdAt,
      },
      requestData,
    );
    assert.deepEqual(
      response.body,
      expected,
      `Differences: ${JSON.stringify(Value.Diff(response.body, expected), null, 2)}`,
    );
  });

  test('createProduct [VARIANT]', async () => {
    const parentId = 'adizeroPrimeX2-base';
    const parentResponse = await request(listeningApp)
      .get(`/products/${parentId}?catalog=${catalogParam}`)
      .expect(200);
    const requestData = {
      name: { en: 'English Variant text' },
      sku: 'HP9708_570',
      searchKeywords: { en: [{ text: 'keyword2' }] },
      parent: parentResponse.body.id,
      attributes: {
        color: 'Cloud White',
        size: 'M 6/W 7',
      },
      type: 'variant',
    };
    const response = await request(listeningApp)
      .post(`/products?catalog=${catalogParam}`)
      .send(requestData)
      .set('Accept', 'application/json')
      .expect(201)
      .expect('Content-Type', 'application/json; charset=utf-8');

    const expected = Object.assign(
      {
        attributes: {},
        categories: [],
        version: 0,
        id: response.body.id,
        createdAt: response.body.createdAt,
      },
      requestData,
    );
    assert.deepEqual(
      response.body,
      expected,
      `Differences: ${JSON.stringify(Value.Diff(response.body, expected), null, 2)}`,
    );
  });

  test('updateProduct [changeName]', async () => {
    const pId = 'adizeroPrimeX2-base';
    const newName = 'TestName';
    const before = await request(listeningApp)
      .get(`/products/${pId}?catalog=${catalogParam}`)
      .expect(200);
    const requestData = {
      version: before.body.version,
      actions: [{ action: 'changeName', name: { en: newName } }],
    };
    const expected = Object.assign(before.body, {
      name: { en: newName },
      version: before.body.version + 1,
    });
    const response = await request(listeningApp)
      .patch(`/products/${pId}?catalog=${catalogParam}`)
      .send(requestData)
      .set('Accept', 'application/json')
      .expect(200)
      .expect('Content-Type', 'application/json; charset=utf-8');

    assert.deepEqual(
      response.body,
      expected,
      `Differences: ${JSON.stringify(Value.Diff(response.body, expected), null, 2)}`,
    );
  });
});
