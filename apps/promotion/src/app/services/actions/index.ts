import { type Result, Ok, Err } from 'ts-results';
import { ChangeNameActionHandler } from './changeName.handler';
import { AppError } from '@ecomm/AppError';

export interface ActionHandlerDAO {
  [key: string]: any;
}
export interface ActionData {}
export interface ActionHandlerRepository {}

export interface ActionHandler {
  run(
    entity: ActionHandlerDAO,
    toUpdateEntity: ActionHandlerDAO,
    action: ActionData,
    classificationCategoryRepository: ActionHandlerRepository,
  ): Promise<Result<ActionHandlerResult, AppError>>;
}

export interface ActionHandlersList {
  [key: string]: ActionHandler;
}

export const actionHandlersList = (server: any): ActionHandlersList => ({
  changeName: new ChangeNameActionHandler(server),
});

export type ActionHandlerResult = { update: any; sideEffects?: any[] };

export * from './changeName.handler';
