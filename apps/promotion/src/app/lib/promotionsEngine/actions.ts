import { Expressions } from './expressions';
import { green, yellow } from 'kolorist';

export class EngineActions {
  private server: any;
  private expressions: Expressions;

  constructor(server: any, expressions: Expressions) {
    this.server = server;
    this.expressions = expressions;
  }

  async createLineDiscount(
    facts: any,
    bindings: any,
    promotionId: any,
    action: any,
  ) {
    if (this.server.logger.isLevelEnabled('debug'))
      this.server.log.debug(yellow('    ACTION: LineDiscount'));
    const skuExpressionResult = await this.expressions.evaluate(
      action.sku,
      facts,
      bindings,
    );
    const discountExpressionResult = await this.expressions.evaluate(
      action.discount,
      facts,
      bindings,
    );
    if (this.server.logger.isLevelEnabled('debug'))
      this.server.log.debug(
        `      ${green('sku')}: ${action.sku} = ${green(skuExpressionResult)}`,
      );
    if (this.server.logger.isLevelEnabled('debug'))
      this.server.log.debug(
        `      ${green('discount')}: ${action.discount} = ${green(discountExpressionResult)}`,
      );
    bindings.discounts.push({
      promotionId,
      type: 'lineDiscount',
      sku: skuExpressionResult,
      centAmount: -(discountExpressionResult * 100).toFixed(0) / 100,
    });
  }

  async createOrderDiscount(
    facts: any,
    bindings: any,
    promotionId: any,
    action: any,
  ) {
    if (this.server.logger.isLevelEnabled('debug'))
      this.server.log.debug(yellow('    ACTION: OrderDiscount'));
    const discountExpressionResult = await this.expressions.evaluate(
      action.discount,
      facts,
      bindings,
    );
    if (this.server.logger.isLevelEnabled('debug'))
      this.server.log.debug(
        `      ${green('discount')}: ${action.discount} = ${green(discountExpressionResult)}`,
      );
    bindings.discounts.push({
      promotionId,
      type: 'orderDiscount',
      centAmount: -(discountExpressionResult * 100).toFixed(0) / 100,
    });
  }

  async tagAsUsed(facts: any, bindings: any, promotionId: any, action: any) {
    if (this.server.logger.isLevelEnabled('debug'))
      this.server.log.debug(yellow('    ACTION: tagging as used'));
    for await (const item of action.items) {
      const productIdExpressionResult = await this.expressions.evaluate(
        item.productId,
        facts,
        bindings,
      );
      const productIndex = facts.items.findIndex(
        (p: any) => p.id === productIdExpressionResult,
      );
      if (productIndex != -1) {
        const quantityExpressionResult = await this.expressions.evaluate(
          item.quantity,
          facts,
          bindings,
        );
        if (this.server.logger.isLevelEnabled('debug'))
          this.server.log.debug(
            `      ${green('productId')}: ${item.productId} = ${green(productIdExpressionResult)} | ${green(
              'quantity',
            )}: ${item.quantity} = ${green(quantityExpressionResult)} | ${facts.items[productIndex].quantity} => ${
              facts.items[productIndex].quantity - quantityExpressionResult
            }`,
          );
        facts.items[productIndex].quantity -= quantityExpressionResult;
        if (facts.items[productIndex].quantity <= 0) {
          facts.items.splice(productIndex, 1);
        }
      } else {
        throw new Error(
          `Product ${item.productId} ${productIdExpressionResult} not found`,
        );
      }
    }
  }

  public Actions = {
    createLineDiscount: this.createLineDiscount,
    createOrderDiscount: this.createOrderDiscount,
    tagAsUsed: this.tagAsUsed,
  };
}
