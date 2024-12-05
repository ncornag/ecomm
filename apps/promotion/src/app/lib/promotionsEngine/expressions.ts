import jsonata, { type Expression } from 'jsonata';
import NodeCache from 'node-cache';

export class Expressions {
  private server: any;
  private cache = new NodeCache({ useClones: false, stdTTL: 60 * 60 * 24, checkperiod: 60 * 60 });

  constructor(server: any) {
    this.server = server;
  }

  productWithSku(items: any, sku: string) {
    // const e = expression(`products["products[sku='${sku}']`);
    return items.find((p: any) => p.sku === sku);
  }

  productInCategory(items: any, category: string) {
    // const e = expression(`products["${category}" in categories][0]`);
    return items.find((p: any) => p.categories.find((c: any) => c === category) != undefined);
  }

  lowestPricedProductInCategory(products: any, category: string) {
    // const e = expression(`products['${category}' in categories]^(centAmount)[0]`);
    let min: number = Number.MAX_SAFE_INTEGER;
    let result: any;
    for (const product of products) {
      if (product.categories.find((c: any) => c === category) != undefined && product.value.centAmount < min) {
        min = product.value.centAmount;
        result = product;
      }
    }
    return result;
  }

  public getExpression(expression: string): Expression {
    let compiled: Expression | undefined = this.cache.get(expression);
    if (!compiled) {
      compiled = jsonata(expression);
      compiled.registerFunction('productInCategory', this.productInCategory, '<as:o>');
      compiled.registerFunction('lowestPricedProductInCategory', this.lowestPricedProductInCategory, '<as:o>');
      compiled.registerFunction('productWithSku', this.productWithSku, '<as:o>');
      this.cache.set(expression, compiled);
      return compiled;
    }
    return compiled;
  }

  public evaluate(expression: string, facts: any, bindings: any) {
    const compiled = this.getExpression(expression);
    return compiled.evaluate(facts, bindings);
  }
}
