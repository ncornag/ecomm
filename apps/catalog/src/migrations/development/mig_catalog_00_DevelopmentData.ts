import {
  ProductCommandTypes,
  toProductStreamName,
} from '../../app/product/product.events';
import { ProductService } from '../../app/product/product.svc';
import { nanoid } from 'nanoid';

const catalogs = [
  {
    _id: 'stage',
    projectId: 'TestProject',
    name: 'Stage',
  },
  {
    _id: 'online',
    projectId: 'TestProject',
    name: 'Online',
  },
];
const catalogSyncs = [
  {
    _id: 'stage-2-online',
    projectId: 'TestProject',
    sourceCatalog: 'stage',
    targetCatalog: 'online',
    removeNonExistent: false,
    createNewItems: true,
    propertiesToSync: [],
    runAt: '00 01 * * *',
    lastSync: '2023-01-15T00:00:00.000+00:00',
    version: 0,
    createdAt: '2023-01-15T00:00:00.000+00:00',
  },
];
const classificationCategories = [
  {
    _id: 'machine-properties',
    projectId: 'TestProject',
    name: 'Machine Properties',
    key: 'machine-properties',
    parent: '',
    attributes: [
      {
        key: 'wheels',
        label: 'Wheels',
        isRequired: true,
        type: 'number',
        min: 1,
        max: 18,
      },
      {
        key: 'color',
        label: 'Color',
        isRequired: true,
        type: 'enum',
        options: [
          {
            key: 'Y',
            label: 'Yellow',
          },
          {
            key: 'O',
            label: 'Orange',
          },
          {
            key: 'G',
            label: 'Green',
          },
        ],
      },
      {
        key: 'options',
        label: 'Options',
        isRequired: false,
        type: 'list',
        elementType: 'text',
      },
    ],
    ancestors: [],
    version: 0,
    createdAt: '2023-01-15T00:00:00.000+00:00',
  },
  {
    _id: 'hardware',
    projectId: 'TestProject',
    name: 'Hardware',
    key: 'hardware',
    parent: '',
    attributes: [],
    ancestors: [],
    version: 0,
    createdAt: '2023-01-15T00:00:00.000+00:00',
  },
  {
    _id: 'cpu',
    projectId: 'TestProject',
    name: 'CPU',
    key: 'cpu',
    parent: 'hardware',
    attributes: [
      {
        key: 'speed',
        label: 'clockSpeed',
        isRequired: false,
        type: 'number',
      },
      {
        key: 'cache',
        label: 'Cache',
        isRequired: true,
        type: 'text',
      },
    ],
    ancestors: ['hardware'],
    version: 0,
    createdAt: '2023-01-15T00:00:00.000+00:00',
  },
  {
    _id: 'photography',
    projectId: 'TestProject',
    name: 'Photography',
    key: 'photography',
    attributes: [
      {
        key: 'sensor',
        label: 'Sensor',
        isRequired: true,
        type: 'text',
      },
      {
        key: 'res',
        label: 'Resolutions',
        isRequired: true,
        type: 'text',
      },
    ],
    parent: 'hardware',
    ancestors: ['hardware'],
    version: 0,
    createdAt: '2023-01-15T00:00:00.000+00:00',
  },
  {
    _id: 'electricity',
    projectId: 'TestProject',
    name: 'Electricity Things',
    key: 'electricity',
    parent: '',
    attributes: [
      {
        key: 'curr',
        label: 'current',
        isRequired: true,
        type: 'number',
      },
    ],
    ancestors: [],
    version: 0,
    createdAt: '2023-01-15T00:00:00.000+00:00',
  },
  {
    _id: 'machines',
    projectId: 'TestProject',
    name: 'Machines',
    key: 'machines',
    parent: 'electricity',
    attributes: [
      {
        key: 'size',
        label: 'size',
        isRequired: true,
        type: 'text',
      },
      {
        key: 'weight',
        label: 'weight',
        isRequired: true,
        type: 'number',
      },
      {
        key: 'characteristics',
        label: 'Characteristics',
        isRequired: true,
        type: 'object',
        ref: 'machine-properties',
      },
    ],
    ancestors: ['electricity'],
    version: 0,
    createdAt: '2023-01-15T00:00:00.000+00:00',
  },
  {
    _id: 'software',
    projectId: 'TestProject',
    name: 'Software',
    key: 'software',
    parent: 'electricity',
    attributes: [
      {
        key: 'req',
        label: 'requirements',
        isRequired: true,
        type: 'text',
      },
      {
        key: 'lan',
        label: 'language',
        isRequired: true,
        type: 'text',
      },
    ],
    ancestors: ['electricity'],
    version: 0,
    createdAt: '2023-01-15T00:00:00.000+00:00',
  },
];
const classificationCategoriesShoes = [
  {
    _id: 'shoes',
    projectId: 'TestProject',
    name: 'Shoes',
    key: 'shoes',
    parent: '',
    attributes: [
      {
        key: 'color',
        label: 'Color',
        isRequired: true,
        type: 'text',
      },
      {
        key: 'size',
        label: 'Size',
        isRequired: true,
        type: 'text',
      },
    ],
    ancestors: [],
    version: 0,
    createdAt: '2023-01-15T00:00:00.000+00:00',
  },
];
const productCategories = [
  {
    _id: 'mana',
    projectId: 'TestProject',
    name: 'Manufacturer A',
    key: 'manA',
    parent: '',
    classificationCategories: ['machines'],
    ancestors: [],
    version: 0,
    createdAt: '2023-01-15T00:00:00.000+00:00',
  },
  {
    _id: 'printers',
    projectId: 'TestProject',
    name: 'Printers',
    key: 'printers',
    parent: 'mana',
    classificationCategories: [],
    ancestors: ['mana'],
    version: 0,
    createdAt: '2023-01-15T00:00:00.000+00:00',
  },
  {
    _id: 'laptops',
    projectId: 'TestProject',
    name: 'Laptops',
    key: 'laptops',
    parent: 'mana',
    classificationCategories: ['cpu'],
    ancestors: ['mana'],
    version: 0,
    createdAt: '2023-01-15T00:00:00.000+00:00',
  },
];
const productCategoriesShoes = [
  {
    _id: 'home',
    projectId: 'TestProject',
    name: 'Home',
    key: 'home',
    parent: '',
    classificationCategories: [],
    ancestors: [],
    version: 0,
    createdAt: '2023-01-15T00:00:00.000+00:00',
  },
  {
    _id: 'running',
    projectId: 'TestProject',
    name: 'Running',
    key: 'running',
    parent: 'home',
    classificationCategories: [],
    ancestors: ['home'],
    version: 0,
    createdAt: '2023-01-15T00:00:00.000+00:00',
  },
  {
    _id: 'shoes',
    projectId: 'TestProject',
    name: 'shoes',
    key: 'shoes',
    parent: 'running',
    classificationCategories: ['shoes'],
    ancestors: ['running'],
    version: 0,
    createdAt: '2023-01-15T00:00:00.000+00:00',
  },
];
const productShoes = [
  {
    _id: 'adizeroPrimeX2-base',
    version: 0,
    projectId: 'TestProject',
    catalogId: 'stage',
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
  {
    _id: 'adizeroPrimeX2-White-001',
    version: 0,
    projectId: 'TestProject',
    catalogId: 'stage',
    name: {
      en: 'ADIZERO PRIME X 2 STRUNG RUNNING SHOES WHITE!!!',
    },
    sku: 'HP9708_570',
    searchKeywords: ['white'],
    type: 'variant',
    parent: 'adizeroPrimeX2-base',
    attributes: {
      color: 'Cloud White',
      size: 'M 6/W 7',
    },
  },
  {
    _id: 'adizeroPrimeX2-White-002',
    version: 0,
    projectId: 'TestProject',
    catalogId: 'stage',
    sku: 'HP9708_580',
    type: 'variant',
    parent: 'adizeroPrimeX2-base',
    attributes: {
      color: 'Cloud White',
      size: 'M 6.5/W 7.5',
    },
  },
  {
    _id: 'adizeroPrimeX2-Black-001',
    version: 0,
    projectId: 'TestProject',
    catalogId: 'stage',
    sku: 'HP9709_580',
    type: 'variant',
    parent: 'adizeroPrimeX2-base',
    attributes: {
      color: 'Core Black',
      size: 'M 6.5/W 7.5',
    },
  },
];
const productComposites = [
  {
    _id: 'full-frame-mirrorless-camera-kit',
    version: 0,
    projectId: 'TestProject',
    catalogId: 'stage',
    name: {
      en: 'Full Frame Mirrorless Camera Kit',
    },
    description: {
      en: 'Whatever you shoot, this kit lets you be creative ...',
    },
    slug: 'full-frame-mirrorless-camera-kit',
    searchKeywords: ['mirrorless', 'full-frame', 'kit'],
    categories: ['mirrorless'],
    type: 'composite',
    components: [
      {
        label: '1. Camera Body',
        key: 'camera-body',
        type: 'list',
        elementType: 'reference',
        referenceType: 'category',
        min: 1,
        max: 1,
        references: [
          {
            category: 'mirrorless',
            exceptions: ['canon-eos-r3'],
          },
          {
            product: 'canon-eos-r5',
          },
          {
            product: 'canon-eos6-mark-ii',
          },
        ],
      },
      {
        label: '2. Lens',
        key: 'lens',
        type: 'list',
        elementType: 'reference',
        referenceType: 'category',
        min: 1,
        max: 1,
        references: [
          {
            category: 'ef-lens',
          },
          {
            category: 'rf-lens',
          },
        ],
      },
      {
        label: '3. Memory Card',
        key: 'memory-card',
        type: 'list',
        elementType: 'reference',
        referenceType: 'category',
        min: 1,
        max: 1,
        references: [
          {
            category: 'sdxc-memory-cards',
          },
        ],
      },
      {
        label: '4. Accessories',
        key: 'accessories',
        type: 'list',
        elementType: 'reference',
        referenceType: 'category',
        min: 0,
        max: 5,
        references: [
          {
            category: 'accessories',
          },
        ],
      },
    ],
  },
  {
    _id: 'wood-business-card',
    version: 0,
    projectId: 'TestProject',
    catalogId: 'stage',
    name: {
      en: 'Modern wood business card',
    },
    description: {
      en: 'Modern wood grain look professional carpenter logo business card',
    },
    slug: 'modern-wood-business-card',
    searchKeywords: ['cards'],
    categories: ['cards'],
    type: 'composite',
    components: [
      {
        label: 'Design Theme',
        key: 'design-theme',
        type: 'enum',
        options: [
          {
            key: 'B',
            label: 'Black Theme',
          },
          {
            key: 'W',
            label: 'White Theme',
          },
        ],
      },
      {
        label: 'Size',
        key: 'size',
        type: 'enum',
        options: [
          {
            key: 'S',
            label: 'Standard, 3.5 x 2.0',
          },
          {
            key: 'M',
            label: 'Mini, 3.0 x 1.0',
          },
          {
            key: 'E',
            label: 'Euro, 3.346 x 2.165',
          },
        ],
      },
      {
        label: 'Paper',
        key: 'paper',
        type: 'enum',
        options: [
          {
            key: 'S1',
            label: 'Standard Matte',
          },
          {
            key: 'S2',
            label: 'Standard Semi-Gloss',
          },
          {
            key: 'SG',
            label: 'Signature UV Gloss',
          },
        ],
      },
      {
        label: 'First Line',
        key: 'first-line',
        type: 'text',
        minLength: 1,
        maxLength: 20,
      },
      {
        label: 'Second Line',
        key: 'second-line',
        type: 'text',
      },
    ],
  },
];

/*
Classification Categories

    machine-properties
    hardware
        cpu
        photography
    electricity
        machines
            (machine-properties)
    software

    Product Categories

    mana
        (machines)
        printers
        laptops
            (cpu)
*/

export async function up(params) {
  const db = params.context.server.mongo.db;
  await db.collection('Catalog').insertMany(catalogs);
  await db.collection('CatalogSync').insertMany(catalogSyncs);
  await db
    .collection('ClassificationCategory')
    .insertMany(classificationCategories);
  await db
    .collection('ClassificationCategory')
    .insertMany(classificationCategoriesShoes);
  await db.collection('ProductCategory').insertMany(productCategories);
  await db.collection('ProductCategory').insertMany(productCategoriesShoes);
  await db.collection('ProductStage').insertMany(productShoes);
  await db.collection('ProductStage').insertMany(productComposites);

  const service = ProductService.getInstance(params.context.server);

  for await (const record of productShoes) {
    const id = nanoid();
    const { _id, version, projectId, catalogId, ...product } = record;
    await params.context.server.es.create(
      service.create,
      toProductStreamName(id),
      {
        type: ProductCommandTypes.CREATE,
        data: {
          product,
        },
        metadata: {
          id,
          catalogId: 'stage',
        },
      },
    );
  }
}

export async function down(params) {
  const db = params.context.server.mongo.db;
  await db.collection('ClassificationCategory').deleteMany({});
  await db.collection('ClassificationCategory').deleteMany({});
  await db.collection('ProductCategory').deleteMany({});
  await db.collection('ProductCategory').deleteMany({});
  await db.collection('Catalog').deleteMany({});
  await db.collection('CatalogSync').deleteMany({});
  await db.collection('ProductStage').deleteMany({});
  await db.collection('ProductStage').deleteMany({});
}
