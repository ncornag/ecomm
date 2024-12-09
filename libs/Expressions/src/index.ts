import fp from 'fastify-plugin';
import { FastifyInstance } from 'fastify';
import jsonata, { type Expression } from 'jsonata';
import NodeCache from 'node-cache';

type ExpressionsOptions = {
  functions: { name: string; fn: any }[];
};
export class Expressions {
  private server: FastifyInstance;
  private cache = new NodeCache({
    useClones: false,
    stdTTL: 60 * 60 * 24,
    checkperiod: 60 * 60,
  });
  private functions: any;

  constructor(
    server: FastifyInstance,
    options: ExpressionsOptions = {
      functions: [],
    },
  ) {
    this.server = server;
    this.functions = options.functions;
  }

  public getExpression(expression: string): Expression {
    let compiled: Expression | undefined = this.cache.get(expression);
    if (!compiled) {
      compiled = jsonata(expression);
      this.functions.forEach((value) => {
        compiled!.registerFunction(value.name, value.fn, '<as:o>');
      });
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
