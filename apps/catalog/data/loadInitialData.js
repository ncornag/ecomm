const d = require('./data.js')

db.migrations.deleteMany({});

db.ClassificationCategory.deleteMany({});
db.ProductCategory.deleteMany({});
db.Catalog.deleteMany({});
db.CatalogSync.deleteMany({});
db.ProductStage.deleteMany({});
db.ProductOnline.deleteMany({});

db.ClassificationCategory.insertMany(classificationCategoriesA);
db.ClassificationCategory.insertMany(classificationCategoriesB);
db.ClassificationCategory.insertMany(classificationCategoriesShoes);
db.ProductCategory.insertMany(productCategories);
db.ProductCategory.insertMany(productCategoriesShoes);
db.Catalog.insertMany(catalog);
db.CatalogSync.insertMany(catalogSync);
db.ProductStage.insertMany(productShoes);
db.ProductStage.insertMany(compositeProducts);