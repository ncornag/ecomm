import { type Result, Ok, Err } from 'ts-results';
import { AppError } from '@ecomm/AppError';
import { green, red, magenta, yellow, bold } from 'kolorist';

export interface IRepo<DAO> {
  find(query: any, options: any): Promise<Result<DAO[], AppError>>;
  update: (filter: any, update: any) => Promise<Result<any, AppError>>;
}

class UpdateChildAncestorsForIdListener {
  private server: any;
  private msgIn = bold(yellow('←')) + yellow('MSG:');
  private TOPIC = 'updateChildAncestorsForId';

  constructor(server: any) {
    this.server = server;
  }

  public start() {
    this.server.log.info(
      `${yellow('UpdateChildAncestorsForIdService')} ${green('listening to')} [${this.TOPIC}]`,
    );
    this.server.messages.subscribe(this.TOPIC, this.handler.bind(this));
  }

  private handler = async (data: any) => {
    const repo = this.server.db.repo[data.entity + 'Repository'];
    if (this.server.logger.isLevelEnabled('debug'))
      this.server.log.debug(
        `${magenta('#' + data.metadata.requestId || '')} ${this.msgIn} updateChildAncestorsForId ${green(
          JSON.stringify(data),
        )}`,
      );
    //

    const entityResult = await repo.find(
      { projectId: data.metadata.projectId, _id: data.id },
      { projection: { _id: 1, ancestors: 1 } },
    );
    if (entityResult.err) {
      console.log('error: ' + entityResult.err);
      return;
    }

    // Can't do pull and push in the same update :(
    const updateResult1 = await repo.update(
      { projectId: data.metadata.projectId, ancestors: data.id },
      {
        $pull: { ancestors: { $in: data.oldAncestors } },
      },
    );
    if (updateResult1.err) {
      console.log('error: ' + updateResult1.err);
      return;
    }
    const updateResult2 = await repo.update(
      { projectId: data.metadata.projectId, ancestors: data.id },
      {
        $push: {
          ancestors: { $each: entityResult.val[0].ancestors, $position: 0 },
        },
      },
    );
    if (updateResult2.err) {
      console.log('error: ' + updateResult2.err);
      return;
    }
  };
}

export const updateChildAncestorsForIdListener = (server: any) => {
  return new UpdateChildAncestorsForIdListener(server).start();
};
