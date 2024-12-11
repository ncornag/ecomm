import { type Result, Ok } from 'ts-results';
import { AppError } from '@ecomm/AppError';

// eslint-disable-next-line @typescript-eslint/no-empty-object-type, @typescript-eslint/no-empty-interface
export interface ActionData {}
// eslint-disable-next-line @typescript-eslint/no-empty-object-type, @typescript-eslint/no-empty-interface
export interface ActionHandlerRepository {}

export interface ActionHandler {
  run(
    entity: ActionHandlerDAO,
    toUpdateEntity: ActionHandlerDAO,
    action: ActionData,
    classificationCategoryRepository: ActionHandlerRepository,
  ): Promise<Result<ActionHandlerResult, AppError>>;
}

export type ActionHandlerResult = { update: any; sideEffects?: any[] };

export interface ActionHandlersList {
  [key: string]: ActionHandler;
}

export interface ActionHandlerDAO {
  [key: string]: any;
}

export class ActionsRunner<
  DAO extends ActionHandlerDAO,
  REPO extends ActionHandlerRepository,
> {
  async run(
    entity: DAO,
    toUpdateEntity: DAO,
    repo: REPO,
    actionHandlers: ActionHandlersList,
    actions: any[],
  ): Promise<Result<ActionHandlerResult, AppError>> {
    const update: any = {};
    const sideEffects: any[] = [];
    for (const action of actions) {
      // Execute action
      const actionHandler = actionHandlers[action.action];
      const actionResult = await actionHandler.run(
        entity,
        toUpdateEntity,
        action,
        repo,
      );
      if (actionResult.err) return actionResult;
      const actionHandlerResult = actionResult.val;
      // Compute Updates
      Object.keys(actionHandlerResult.update).forEach((updateKey: string) => {
        if (update[updateKey]) {
          Object.assign(
            update[updateKey],
            actionHandlerResult.update[updateKey],
          );
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
