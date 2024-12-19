import { type Result, Ok } from 'ts-results';
import { Err, AppError, ErrorCode } from '@ecomm/AppError';
import fp from 'fastify-plugin';
import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { green, yellow } from 'kolorist';
import { Collection } from 'mongodb';
import { nanoid } from 'nanoid';

export type JSONType = Record<string | number, any>;

export type Command<
  Type extends string = string,
  Data extends JSONType = JSONType,
  Metadata extends JSONType = JSONType,
> = {
  type: Type;
  data: Data;
  metadata: Metadata;
};

export type Event<
  Type extends string = string,
  Data extends JSONType = JSONType,
  Metadata extends JSONType = JSONType,
> = {
  type: Type;
  data: Data;
  metadata: Metadata;
};

const NEW = 'new';
type ExpectedRevision = typeof NEW | bigint;

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

  public appendToStream = async (
    streamName: string,
    event: Event,
    options: { expectedRevision: ExpectedRevision } = {
      expectedRevision: NEW,
    },
  ): Promise<Result<Event, AppError>> => {
    // Verify expected version and update it
    if (options.expectedRevision === NEW) {
      event.metadata.version = 0n;
    } else {
      const result = await this.col.updateOne(
        {
          stream: streamName,
          'metadata.version': options.expectedRevision,
        },
        {
          $set: { isLastEvent: false },
        },
      );
      console.log('update event', result);
      if (result.modifiedCount === 0) {
        console.log('version error');
        return new Err(
          ErrorCode.CONFLICT,
          `Event with version ${options.expectedRevision} doesn't exist`,
        );
      }
      event.metadata.version = options.expectedRevision + 1n;
    }

    // Save the event
    const result = await this.col.insertOne({
      //_id: nanoid(),
      stream: streamName,
      isLastEvent: true,
      ...event,
    });
    console.log(result);
    if (result.acknowledged === false)
      return new Err(ErrorCode.SERVER_ERROR, 'Error saving event');
    // TODO: Emmit event
    return new Ok(event);
  };

  public create = async <CommandType extends Command>(
    handle: (command: CommandType) => Promise<Result<Event, AppError>>,
    streamName: string,
    command: CommandType,
  ): Promise<Result<Event, AppError>> => {
    const handleResult = await handle(command);
    console.log('es.create');
    console.dir(handleResult);
    if (handleResult.err) return handleResult;
    return await this.appendToStream(streamName, handleResult.val, {
      expectedRevision: NEW,
    });
  };

  public update = async <CommandType extends Command>(
    handle: (command: CommandType) => Promise<Result<Event, AppError>>,
    streamName: string,
    expectedRevision: bigint,
    command: CommandType,
  ): Promise<Result<Event, AppError>> => {
    const handleResult = await handle(command);
    console.log('es.update');
    console.dir(handleResult);
    if (handleResult.err) return handleResult;
    return await this.appendToStream(streamName, handleResult.val, {
      expectedRevision,
    });
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
