import fetch from 'node-fetch';
import { createApiBuilderFromCtpClient, ByProjectKeyRequestBuilder } from '@commercetools/platform-sdk';
import { Value } from '@sinclair/typebox/value';
import {
  ClientBuilder,
  // Import middlewares
  type AuthMiddlewareOptions, // Required for auth
  type HttpMiddlewareOptions // Required for sending HTTP requests
} from '@commercetools/sdk-client-v2';

export class CT {
  private server: any;
  public api: ByProjectKeyRequestBuilder;

  public PriceMode = {
    STANDALONE: 'Standalone',
    EMBEDDED: 'Embedded'
  };

  public Catalog = {
    STAGED: 'staged',
    CURRENT: 'current'
  };

  public constructor(server: any) {
    this.server = server;
    this.api = this.apiBuilder();
  }

  private apiBuilder = (): ByProjectKeyRequestBuilder => {
    const {
      CT_AUTHHOST: authHost,
      CT_HTTPHOST: httpHost,
      CT_PROJECTKEY: projectKey,
      CT_SCOPE: scopes,
      CT_CLIENTID: clientId,
      CT_CLIENTSECRET: clientSecret
    } = this.server.config;

    // Configure authMiddlewareOptions
    const authMiddlewareOptions: AuthMiddlewareOptions = {
      host: `https://${authHost}`,
      projectKey,
      credentials: {
        clientId,
        clientSecret
      },
      scopes,
      fetch
    };

    // Configure httpMiddlewareOptions
    const httpMiddlewareOptions: HttpMiddlewareOptions = {
      host: `https://${httpHost}`,
      fetch
    };

    // Return the ClientBuilder
    const ctpClient = new ClientBuilder()
      //.withProjectKey(projectKey)
      .withClientCredentialsFlow(authMiddlewareOptions)
      .withHttpMiddleware(httpMiddlewareOptions)
      .build();

    return createApiBuilderFromCtpClient(ctpClient).withProjectKey({ projectKey });
  };

  public toCTProduct(stagedProduct: any, onlineProduct: any): any {
    const sp: any = this.toCTProductVersion(stagedProduct);
    const op: any = onlineProduct ? this.toCTProductVersion(onlineProduct) : {};
    const hasStagedChanges = Value.Diff(sp, op).length > 0;
    return Object.assign(
      {
        id: stagedProduct._id,
        version: stagedProduct.version,
        createdAt: stagedProduct.createdAt,
        lastModifiedAt: stagedProduct.lastModifiedAt,
        // TODO: Get the first Classification Category of the first Product Category
        productType: {
          typeId: 'product-type',
          id: 'xxx-yyy-zzz'
        },
        masterData: {
          current: op,
          staged: sp,
          published: op.name ? true : false,
          hasStagedChanges
        }
      },
      stagedProduct.key && { key: stagedProduct.key },
      {
        // Unsupported right now, faking data
        taxCategory: {
          typeId: 'tax-category',
          id: stagedProduct.taxCategory
        },
        priceMode: stagedProduct.priceMode
      }
    );
  }

  private toCTProductVersion(productVersion: any) {
    let masterVariantIndex = productVersion.variants.findIndex((v: any) => v.attributes.isMasterVariant === true);
    if (masterVariantIndex == -1) masterVariantIndex = 0;
    return Object.assign({
      name: productVersion.name,
      description: productVersion.description,
      categories: productVersion.categories.map((c: any) => {
        return { typeId: 'category', id: c };
      }),
      categoryOrderHints: {}, // Unsupported right now, faking data
      slug: productVersion.slug,
      masterVariant: this.toCTVariant(
        productVersion.variants[masterVariantIndex],
        productVersion.priceMode === this.PriceMode.EMBEDDED
          ? productVersion.prices.filter((p: any) => p.sku === productVersion.variants[masterVariantIndex].sku)
          : []
      ),
      variants: productVersion.variants
        .toSpliced(masterVariantIndex, 1)
        .map((v: any) =>
          this.toCTVariant(
            v,
            productVersion.priceMode === this.PriceMode.EMBEDDED
              ? productVersion.prices.filter((p: any) => p.sku === v.sku)
              : []
          )
        ),
      searchKeywords: productVersion.searchKeywords
    });
  }

  private toCTVariant(variant: any, prices: any) {
    return Object.assign(
      {
        id: variant._id.split('#')[1] ? parseInt(variant._id.split('#')[1]) : variant._id,
        sku: variant.sku
      },
      variant.key && { key: variant.key },
      {
        prices: this.toCTPrices(prices),
        // Unsupported right now, faking data
        images: [],
        // TODO: Mix with Base Attributes
        attributes: Object.entries(variant.attributes).map((a: any) => {
          return { name: a[0], value: a[1] };
        }),
        // Unsupported right now, faking data
        assets: [],
        // Unsupported right now, faking data
        availability: {}
      }
    );
  }

  private toCTPrices(pricesSource: any) {
    return pricesSource.map((price: any) => {
      const basePrice = price.predicates.find((p: any) => p.constraints.minimumQuantity === undefined);
      const tiers =
        price.predicates.length > 1
          ? price.predicates
            .filter((p: any) => p.constraints.minimumQuantity !== undefined)
            .sort((a: any, b: any) => a.constraints.minimumQuantity > b.constraints.minimumQuantity)
            .map((p: any) => {
              return {
                minimumQuantity: p.constraints.minimumQuantity,
                value: p.value
              };
            })
          : undefined;
      return Object.assign(
        {
          id: price._id,
          value: basePrice.value
        },
        price.key && { key: price.key },
        basePrice.constraints.country && { country: basePrice.constraints.country[0] },
        basePrice.constraints.customerGroup && {
          customerGroup: {
            typeId: 'customer-group',
            id: basePrice.constraints.customerGroup[0]
          }
        },
        basePrice.constraints.channel && {
          channel: {
            typeId: 'channel',
            id: basePrice.constraints.channel[0]
          }
        },
        basePrice.constraints.validFrom && { validFrom: basePrice.constraints.validFrom },
        basePrice.constraints.validUntil && { validUntil: basePrice.constraints.validUntil },
        tiers && { tiers }
      );
    });
  }
}
