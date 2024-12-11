import { type Result, Ok, Err } from 'ts-results';
import { AppError } from '@ecomm/AppError';
import { type ActionHandlerResult } from '@ecomm/ActionsRunner';
import { type UpdateProductChangeKeywords } from '../../entities/product';

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
    //if (entity.searchKeywords === action.searchKeywords) return new Ok({ update: {} });
    toUpdateEntity.searchKeywords = action.searchKeywords;
    return new Ok({
      update: { $set: { searchKeywords: action.searchKeywords } },
    });
  }
}
