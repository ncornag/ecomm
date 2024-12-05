import { type Result, Ok, Err } from 'ts-results';
import { SetKeyActionHandler } from './setKey.handler';
import { ChangeNameActionHandler } from './changeName.handler';
import { ChangeKeywordsActionHandler } from './changeKeywords.handler.js';
import { ChangeDescriptionActionHandler } from './changeDescription.handler';
import { ChangeParentActionHandler } from '../../lib/tree';
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
  setKey: new SetKeyActionHandler(server),
  changeName: new ChangeNameActionHandler(server),
  changeParent: new ChangeParentActionHandler(server),
  changeKeywords: new ChangeKeywordsActionHandler(server),
  changeDescription: new ChangeDescriptionActionHandler(server),
});

export type ActionHandlerResult = { update: any; sideEffects?: any[] };

export * from './setKey.handler';
export * from './changeName.handler';
export * from './changeKeywords.handler';
export * from './changeDescription.handler';
export { ChangeParentActionHandler } from '../../lib/tree';
