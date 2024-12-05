import { type Result, Ok, Err } from 'ts-results';
import {
  type ActionHandlerResult,
  type ActionHandlersList,
  type ActionHandlerDAO,
  type ActionHandlerRepository,
} from '../services/actions/index';
import { AppError } from '@ecomm/AppError';

export class UpdateEntityActionsRunner<
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

export function updateEntityActionsRunner(server: any) {
  return {
    run: async (
      entity: ActionHandlerDAO,
      toUpdateEntity: ActionHandlerDAO,
      repo: ActionHandlerRepository,
      actionHandlers: ActionHandlersList,
      actions: any[],
    ): Promise<Result<ActionHandlerResult, AppError>> => {
      // Execute actions
      const update: any = {};
      const sideEffects: any[] = [];
      for (const action of actions) {
        const actionHandler = actionHandlers[action.action];
        const actionResult = await actionHandler.run(
          entity,
          toUpdateEntity,
          action as any,
          repo as any,
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
    },
  };
}
