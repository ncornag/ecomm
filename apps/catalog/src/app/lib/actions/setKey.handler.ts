import { type Result, Ok, Err } from 'ts-results';
import { AppError } from '@ecomm/AppError';
import { Value } from '@sinclair/typebox/value';
import { type ActionHandlerResult } from '@ecomm/ActionsRunner';
import { type UpdateClassificationCategorySetKey } from '../../classificationCategory/classificationCategory';

interface DAOwithKey {
  [key: string]: any;
  key: string;
}

export class SetKeyActionHandler<Repository> {
  private server: any;
  constructor(server: any) {
    this.server = server;
  }
  async run(
    entity: DAOwithKey,
    toUpdateEntity: DAOwithKey,
    action: UpdateClassificationCategorySetKey,
    classificationCategoryRepository: Repository,
  ): Promise<Result<ActionHandlerResult, AppError>> {
    const difference = Value.Diff(entity.key, action.key);
    if (difference.length === 0) return new Ok({ update: {} });
    toUpdateEntity.key = action.key;
    return new Ok({ update: { $set: { key: action.key } } });
  }
}
