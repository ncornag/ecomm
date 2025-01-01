import { type Result, Ok, Err } from 'ts-results-es';
import { AppError } from '@ecomm/app-error';
import { Value } from '@sinclair/typebox/value';
import { type ActionHandlerResult } from '@ecomm/actions-runner';
import { type UpdateProductChangeDescription } from '../../product/product.ts';

interface DAOwithDescription {
  [key: string]: any;
  key: string;
}

export class ChangeDescriptionActionHandler<Repository> {
  private server: any;
  constructor(server: any) {
    this.server = server;
  }
  async run(
    entity: DAOwithDescription,
    toUpdateEntity: DAOwithDescription,
    action: UpdateProductChangeDescription,
    classificationCategoryRepository: Repository,
  ): Promise<Result<ActionHandlerResult, AppError>> {
    const difference = Value.Diff(entity.description, action.description);
    if (difference.length === 0) return new Ok({ update: {} });
    toUpdateEntity.description = action.description;
    return new Ok({ update: { $set: { description: action.description } } });
  }
}
