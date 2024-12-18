import { type Result, Ok, Err } from 'ts-results';
import { AppError, ErrorCode } from '@ecomm/AppError';
import fp from 'fastify-plugin';
import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { green, yellow } from 'kolorist';
import { Collection } from 'mongodb';
import { nanoid } from 'nanoid';

export type Command<
  CommandType extends string = string,
  CommandData = Record<string, unknown>,
  CommandMetaData = Record<string, unknown>,
> = {
  type: CommandType;
  data: CommandData;
  metadata?: CommandMetaData | undefined;
};

class EventStore {
  private server: FastifyInstance;
  private col: Collection;

  constructor(server: FastifyInstance) {
    this.server = server;
    this.col = server.mongo!.db!.collection('Events');
  }

  public start() {
    this.server.log.info(
      `${yellow('EventStore')} ${green('listening to')} [${this.server.config.MONGO_URL}]`,
    );
    return this;
  }

  public addEvent = async (
    stream: string,
    event,
  ): Promise<Result<unknown, AppError>> => {
    console.log('saveEvent', stream);
    console.dir(event, { depth: 15 });

    if (event.metadata && event.metadata.expectedVersion !== undefined) {
      const result = await this.col.updateOne(
        {
          stream,
          'metadata.version': event.metadata.expectedVersion,
        },
        {
          $set: { isLastEvent: false },
        },
      );
      console.log('update event', result);
      if (result.modifiedCount === 0) {
        console.log('version error');
        return new Err(
          new AppError(
            ErrorCode.CONFLICT,
            `Event with version ${event.metadata.expectedVersion} doesn't exist`,
          ),
        );
      }
      event.metadata.version = event.metadata.version + 1;
    }

    console.log('save event', event);
    const result = await this.col.insertOne({
      _id: nanoid(),
      stream,
      isLastEvent: true,
      ...event,
    });
    console.log(result);
    // TODO: Emmit event
    return new Ok({});
  };

  public getEvents = async () => {
    // TODO: Get events
  };
}

declare module 'fastify' {
  export interface FastifyInstance {
    es: EventStore;
  }
}

const eventStorePlugin: FastifyPluginAsync = async (server) => {
  server.decorate('es', new EventStore(server).start());
};

export default fp(eventStorePlugin, {
  fastify: '5.x',
  name: 'eventStore-plugin',
});
