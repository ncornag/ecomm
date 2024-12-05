import jsonata, { type Expression } from 'jsonata';
import NodeCache from 'node-cache';

export class Expressions {
  private server: any;
  private cache = new NodeCache({ useClones: false, stdTTL: 60 * 60 * 24, checkperiod: 60 * 60 });

  constructor(server: any) {
    this.server = server;
  }

  public getExpression(expression: string): Expression {
    let compiled: Expression | undefined = this.cache.get(expression);
    if (!compiled) {
      compiled = jsonata(expression);
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
