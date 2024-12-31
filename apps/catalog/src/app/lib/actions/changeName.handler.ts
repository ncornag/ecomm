import { type Result, Ok, Err } from 'ts-results';
import { AppError } from '@ecomm/AppError';
import { Value } from '@sinclair/typebox/value';
import { type ActionHandlerResult } from '@ecomm/ActionsRunner';
import { type UpdateClassificationCategoryChangeName } from '../../classificationCategory/classificationCategory';

interface DAOwithName {
  [key: string]: any;
  key: string;
}

export class ChangeNameActionHandler<Repository> {
  private server: any;
  constructor(server: any) {
    this.server = server;
  }
  async run(
    entity: DAOwithName,
    toUpdateEntity: DAOwithName,
    action: UpdateClassificationCategoryChangeName,
    repo: Repository,
  ): Promise<Result<ActionHandlerResult, AppError>> {
    const difference = Value.Diff(entity.name, action.name);
    if (difference.length === 0) return new Ok({ update: {} });
    toUpdateEntity.name = action.name;
    return new Ok({ update: { $set: { name: action.name } } });
  }
}
