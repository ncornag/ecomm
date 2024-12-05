import { type Result, Ok, Err } from 'ts-results';
import { AppError } from '@ecomm/AppError';
import { type UpdatePromotionChangeName } from '../../entities/promotion';
import { type ActionHandlerResult } from './index';

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
    action: UpdatePromotionChangeName,
    repo: Repository,
  ): Promise<Result<ActionHandlerResult, AppError>> {
    if (entity.name === action.name) return new Ok({ update: {} });
    toUpdateEntity.name = action.name;
    return new Ok({ update: { $set: { name: action.name } } });
  }
}
