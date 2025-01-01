import { type Result, Ok, Err } from 'ts-results-es';
import { AppError, ErrorCode } from '@ecomm/app-error';
import { PromotionService } from '../promotion.svc.ts';
import { type Promotion, type Then, type When } from '../promotion';
import { green, magenta, yellow, gray, reset } from 'kolorist';
import { EngineActions } from './actions';
import { Expressions } from '@ecomm/expressions';

const functions = [
  {
    name: 'productInCategory',
    fn: (items: any, category: string) => {
      // const e = expression(`products["${category}" in categories][0]`);
      return items.find((p: any) => p.categories.find((c: any) => c === category) != undefined);
    }
  },
  {
    name: 'lowestPricedProductInCategory',
    fn: (products: any, category: string) => {
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
  },
  {
    name: 'productWithSku',
    fn: (items: any, sku: string) => {
      // const e = expression(`products["products[sku='${sku}']`);
      return items.find((p: any) => p.sku === sku);
    }
  }
];
export class PromotionsEngine {
  private server: any;
  private actions: EngineActions;
  private expressions: Expressions;

  constructor(server: any) {
    this.server = server;
    this.expressions = new Expressions(this.server, { functions });
    this.actions = new EngineActions(this.server, this.expressions);
  }

  async evaluateWhen(when: When, facts: any, bindings: any) {
    // const start = process.hrtime.bigint();
    let result = true;
    for (const [key, value] of Object.entries(when)) {
      const expressionResult = await this.expressions.evaluate(value, facts, bindings);
      if (expressionResult == undefined || (typeof expressionResult === 'boolean' && expressionResult !== true)) {
        if (this.server.logger.isLevelEnabled('debug'))
          this.server.log.debug(
            gray(`    ${key}: ${value} = ${expressionResult?.sku ? expressionResult.sku : expressionResult}`)
          );
      } else {
        if (this.server.logger.isLevelEnabled('debug'))
          this.server.log.debug(
            green(`    ${key}: ${reset(value)} = ${expressionResult?.sku ? expressionResult.sku : expressionResult}`)
          );
      }
      if (expressionResult == undefined || (typeof expressionResult === 'boolean' && expressionResult !== true)) {
        result = false;
        break;
      }
      bindings[key] = expressionResult;
    }
    // const end = process.hrtime.bigint();
    //this.server.log.debug(`${green('  evaluateWhen')} in ${magenta(Number(end - start))}ns`);
    return result;
  }

  async evaluateThen(promotionId: any, then: Then, facts: any, bindings: any) {
    for await (const action of then) {
      const actionName = action.action as keyof typeof this.actions.Actions;
      if (!this.actions.Actions[actionName]) {
        throw new AppError(ErrorCode.BAD_REQUEST, `Action ${action.action} not found`);
      }
      // const start = process.hrtime.bigint();
      await this.actions[actionName](facts, bindings, promotionId, action);
      // const end = process.hrtime.bigint();
      // this.server.log.debug(`${green('    evaluateThen')} in ${magenta(Number(end - start))}ns`);
    }
  }

  async run(facts: any, promotionId?: string): Promise<Result<any, AppError>> {
    //const p = await this.firstProductInCategory(facts, 'shoes');
    const bindings = { discounts: [] };
    const promotionsFilter: any = {
      active: {
        $ne: false
      }
    };
    if (promotionId) {
      promotionsFilter._id = promotionId;
    }
    const result = await PromotionService.getInstance(this.server).find(promotionsFilter); // Fetch them everytime for now
    if (result.isErr()) throw result.err;
    const promotions: Promotion[] = result.value;
    const securityStopExecutionTimes = 999;
    const start = process.hrtime.bigint();
    const linesInCart = facts.items.length;
    const productsInCart = facts.items.reduce((acc: number, item: any) => acc + item.quantity, 0);
    // Run each promotion in order
    for await (const promotion of promotions) {
      if (this.server.logger.isLevelEnabled('debug')) this.server.log.debug(magenta(promotion.name));
      let rulesResult = false;
      let executions = 0;
      const maxExecutions = promotion.times || securityStopExecutionTimes;
      do {
        if (this.server.logger.isLevelEnabled('debug'))
          this.server.log.debug(yellow(`  Pass ${executions + 1}/${promotion.times ? promotion.times : '∞'}`));
        rulesResult = await this.evaluateWhen(promotion.when, facts, bindings);
        if (rulesResult === true) {
          // Actions
          facts.discounts = facts.discounts || [];
          await this.evaluateThen(promotion.id, promotion.then, facts, bindings);
        }
        executions++;
      } while (rulesResult === true && executions < maxExecutions);
    }
    const end = process.hrtime.bigint();
    const diff = (Number(end - start) / 1000000).toFixed(3);
    const perMs = ((1000000 * promotions.length) / Number(end - start)).toFixed(2);
    this.server.log.info(
      `${green('  PromotionsEngine ran in')} ${magenta(diff)}ms. ${yellow(
        promotions.length
      )} promotions checked at ${magenta(perMs)} promotions/ms. in a cart with ${magenta(
        linesInCart
      )} lines and ${magenta(productsInCart)} products. ${yellow(bindings.discounts.length)} discounts created.`
    );
    return new Ok(bindings.discounts);
  }
}
