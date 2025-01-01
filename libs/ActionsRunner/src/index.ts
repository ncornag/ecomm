import { type Result, Ok } from 'ts-results-es';
import { AppError } from '@ecomm/app-error';

// eslint-disable-next-line @typescript-eslint/no-empty-object-type, @typescript-eslint/no-empty-interface
export interface ActionData {}
// eslint-disable-next-line @typescript-eslint/no-empty-object-type, @typescript-eslint/no-empty-interface
export interface ActionHandlerRepository {}

export interface ActionHandler {
  run(
    entity: ActionHandlerEntity,
    toUpdateEntity: ActionHandlerEntity,
    action: ActionData,
    classificationCategoryRepository: ActionHandlerRepository
  ): Promise<Result<ActionHandlerResult, AppError>>;
}

export type ActionHandlerResult = { update: any; sideEffects?: any[] };

export interface ActionHandlersList {
  [key: string]: ActionHandler;
}

export interface ActionHandlerEntity {
  [key: string]: any;
}

export class ActionsRunner<Entity extends ActionHandlerEntity, REPO extends ActionHandlerRepository> {
  async run(
    entity: Entity,
    toUpdateEntity: Entity,
    repo: REPO,
    actionHandlers: ActionHandlersList,
    actions: any[]
  ): Promise<Result<ActionHandlerResult, AppError>> {
    const update: any = {};
    const sideEffects: any[] = [];
    for (const action of actions) {
      // Execute action
      const actionHandler = actionHandlers[action.action];
      const actionResult = await actionHandler.run(entity, toUpdateEntity, action, repo);
      if (actionResult.isErr()) return actionResult;
      const actionHandlerResult = actionResult.value;
      // Compute Updates
      Object.keys(actionHandlerResult.update).forEach((updateKey: string) => {
        if (update[updateKey]) {
          Object.assign(update[updateKey], actionHandlerResult.update[updateKey]);
        } else {
          update[updateKey] = actionHandlerResult.update[updateKey];
        }
      });
      // Compute SideEffects
      sideEffects.push(...(actionHandlerResult.sideEffects || []));
    }
    return new Ok({ update, sideEffects });
  }
}

export class ActionsRunner2<Entity extends ActionHandlerEntity, REPO extends ActionHandlerRepository> {
  async run(
    entity: Entity,
    toUpdateEntity: Entity,
    repo: REPO,
    actionHandlers: ActionHandlersList,
    actions: any[]
  ): Promise<Result<ActionHandlerResult, AppError>> {
    const update: any = {};
    const sideEffects: any[] = [];
    for (const action of actions) {
      // Execute action
      const actionHandler = actionHandlers[action.action];
      const actionResult = await actionHandler.run(entity, toUpdateEntity, action, repo);
      if (actionResult.isErr()) return actionResult;
      const actionHandlerResult = actionResult.value;
      // Compute Updates
      Object.keys(actionHandlerResult.update).forEach((updateKey: string) => {
        if (update[updateKey]) {
          Object.assign(update[updateKey], actionHandlerResult.update[updateKey]);
        } else {
          update[updateKey] = actionHandlerResult.update[updateKey];
        }
      });
      // Compute SideEffects
      sideEffects.push(...(actionHandlerResult.sideEffects || []));
    }
    return new Ok({ update, sideEffects });
  }
}
