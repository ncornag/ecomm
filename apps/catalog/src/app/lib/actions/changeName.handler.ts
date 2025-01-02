import { type Result, Ok, Err } from 'ts-results-es';
import { AppError } from '@ecomm/app-error';
import { Value } from '@sinclair/typebox/value';
import { type ActionHandlerResult } from '@ecomm/actions-runner';
import { type UpdateClassificationCategoryChangeName } from '../../classificationCategory/classificationCategory.ts';

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
    repo: Repository
  ): Promise<Result<ActionHandlerResult, AppError>> {
    if (Value.Equal(entity.name, action.name)) return new Ok({ update: {} });
    toUpdateEntity.name = action.name;
    return new Ok({ update: { $set: { name: action.name } } });
  }
}
