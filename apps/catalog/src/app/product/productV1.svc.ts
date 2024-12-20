import { type Result, Ok } from 'ts-results';
import { AppError } from '@ecomm/AppError';
import { type IProductRepository } from './product.repo';
import { CT } from '@ecomm/CT';

// SERVICE INTERFACE
export interface IProductServiceV1 {
  findProductById: (id: string) => Promise<Result<any, AppError>>;
}

// SERVICE IMPLEMENTATION
export class ProductServiceV1 implements IProductServiceV1 {
  private static instance: IProductServiceV1;
  private repo: IProductRepository;
  private cols;
  private ct: CT;
  private Catalog = {
    STAGE: 'stage',
    ONLINE: 'online',
  };

  private constructor(server: any) {
    this.repo = server.db.repo.productRepository as IProductRepository;
    this.cols = { product: server.db.col.product, price: server.db.col.price };
    this.ct = new CT(server);
  }

  public static getInstance(server: any): IProductServiceV1 {
    if (!ProductServiceV1.instance) {
      ProductServiceV1.instance = new ProductServiceV1(server);
    }
    return ProductServiceV1.instance;
  }

  // FIND PRODUCT BY ID
  public async findProductById(id: string): Promise<Result<any, AppError>> {
    // Return the product+prices from the staged catalog
    const productResultStaged = await this.getProductFromCatalog(
      this.Catalog.STAGE,
      id,
    );
    if (productResultStaged.err) return productResultStaged;
    // Return the product+prices from the current catalog
    const productResultOnline = await this.getProductFromCatalog(
      this.Catalog.ONLINE,
      id,
    );
    if (productResultOnline.err) return productResultOnline;
    // Return the converted Product
    const productV1 = this.ct.toCTProduct(
      productResultStaged.val[0],
      productResultOnline.val[0],
    );
    return new Ok(productV1);
  }

  private async getProductFromCatalog(catalogId: string, id: string) {
    return await this.repo.aggregate(catalogId, [
      { $match: { _id: id } },
      {
        $lookup: {
          from: this.cols.product[catalogId].collectionName,
          localField: '_id',
          foreignField: 'parent',
          as: 'variants',
        },
      },
      {
        $lookup: {
          from: this.cols.price[catalogId].collectionName,
          localField: 'variants.sku',
          foreignField: 'sku',
          as: 'prices',
        },
      },
      {
        $project: {
          'variants.parent': 0,
          'variants.catalogId': 0,
          'variants.projectId': 0,
          'variants.createdAt': 0,
          'variants.lastModifiedAt': 0,
          'variants.version': 0,
          'prices.catalogId': 0,
          'prices.projectId': 0,
          'prices.createdAt': 0,
          'prices.lastModifiedAt': 0,
          'prices.version': 0,
          'prices.prices.predicate': 0,
        },
      },
    ]);
  }
}
