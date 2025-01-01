import { type Result, Ok, Err } from 'ts-results-es';
import { AppError } from '@ecomm/app-error';
import { Value } from '@sinclair/typebox/value';
import { type ActionHandlerResult } from '@ecomm/actions-runner';
import { type UpdateProductChangeKeywords } from '../../product/product.ts';

interface DAOwithKeywords {
  [key: string]: any;
  key: string;
}

export class ChangeKeywordsActionHandler<Repository> {
  private server: any;
  constructor(server: any) {
    this.server = server;
  }
  async run(
    entity: DAOwithKeywords,
    toUpdateEntity: DAOwithKeywords,
    action: UpdateProductChangeKeywords,
    repository: Repository,
  ): Promise<Result<ActionHandlerResult, AppError>> {
    const difference = Value.Diff(entity.searchKeywords, action.searchKeywords);
    if (difference.length === 0) return new Ok({ update: {} });
    toUpdateEntity.searchKeywords = action.searchKeywords;
    return new Ok({
      update: { $set: { searchKeywords: action.searchKeywords } },
    });
  }
}
