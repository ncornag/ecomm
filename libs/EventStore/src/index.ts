import { type Result, Ok } from 'ts-results';
import { AppErrorResult, AppError, ErrorCode } from '@ecomm/AppError';
import fp from 'fastify-plugin';
import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { green, yellow } from 'kolorist';
import { Collection } from 'mongodb';
import { Queues } from '@ecomm/Queues';
import { requestId, projectId } from '@ecomm/RequestContext';

const NEW = 'new';
type ExpectedRevision = typeof NEW | number;

export type JSONType = Record<string | number, any>;
export type MetadataType = JSONType;

export type Command<
  Type extends string = string,
  Data extends JSONType = JSONType,
  Metadata extends MetadataType = MetadataType,
> = {
  type: Type;
  data: Data;
  metadata: Metadata;
};

export type Event<
  Type extends string = string,
  Data extends JSONType = JSONType,
  Metadata extends MetadataType = MetadataType,
> = {
  type: Type;
  data: Data;
  metadata: Metadata;
};

export type RecordedEvent<E extends Event = Event> = {
  id: string;
  streamName: string;
  version: number;
  projectId: string;
  isLastEvent: boolean;
  requestId: string;
  type: E['type'];
  data: E['data'];
  metadata: E['metadata'] & { version: number };
  createdAt: Date;
  lastModifiedAt?: Date;
};

export const toRecordedEvent = (type, entity, command) =>
  Object.assign(
    {
      id: '',
      streamName: '',
      version: 0,
      projectId: '',
      isLastEvent: false,
      requestId: '',
      createdAt: new Date(),
      lastModifiedAt: new Date(),
    },
    {
      type,
      entity,
      data: command.data,
      metadata: {
        version: command.metadata.expectedVersion,
        ...command.metadata,
      },
    },
  );

export type ApplyEvent<Entity, E extends Event> = (
  currentState: Entity,
  event: RecordedEvent<E>,
) => Promise<Result<{ entity: Entity; update?: any }, AppError>>;

///////////////////////////////////////////////////////////////////////////////

class EventStore {
  private server: FastifyInstance;
  private col: Collection<RecordedEvent>;
  private queues: Queues;

  constructor(server: FastifyInstance) {
    this.server = server;
    this.col = server.mongo!.db!.collection('Events');
    this.queues = server.queues;
  }

  public start() {
    this.server.log.info(
      `${yellow('EventStore')} ${green('listening to')} [${this.server.config.MONGO_URL}]`,
    );
    return this;
  }

  public aggregateStream = async <Entity, StreamEvents extends Event>(
    projectId: string,
    streamName: string,
    when: ApplyEvent<Entity, StreamEvents>,
  ): Promise<Result<Entity, AppError>> => {
    let currentState: Entity = undefined as any;
    const cursor = this.col.find(
      { 'metadata.projectId': projectId, streamName },
      { sort: { version: -1 } },
    );
    for await (const event of cursor) {
      if (!event) continue;

      const aggregateResult = await when(currentState, event);
      if (aggregateResult.err) return aggregateResult;
      currentState = aggregateResult.val.entity;
    }
    return new Ok(currentState);
  };

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
          streamName,
          'metadata.version': options.expectedRevision,
        },
        {
          $set: { isLastEvent: false },
        },
      );
      if (result.modifiedCount === 0) {
        return new AppErrorResult(
          ErrorCode.CONFLICT,
          `Event with version ${options.expectedRevision} doesn't exist`,
        );
      }
      event.metadata.version = options.expectedRevision + 1;
    }

    // Save the event
    const { expected, ...metadata } = event.metadata;
    const recordedEvent = {
      //_id: nanoid(),
      streamName,
      isLastEvent: true,
      requestId: requestId(),
      type: event.type,
      data: event.data,
      metadata,
    } as RecordedEvent;
    const result = await this.col.insertOne(recordedEvent);
    if (result.acknowledged === false)
      return new AppErrorResult(ErrorCode.SERVER_ERROR, 'Error saving event');

    // Publish global event
    this.queues.publish(
      `es.${event.metadata.projectId}.${event.metadata.entity}`,
      recordedEvent,
    );

    return new Ok(event);
  };

  public create = async <CommandType extends Command>(
    handle: (command: CommandType) => Promise<Result<Event, AppError>>,
    streamName: string,
    command: CommandType,
  ): Promise<Result<Event, AppError>> => {
    const handleResult = await handle(command);
    if (handleResult.err) return handleResult;
    return await this.appendToStream(streamName, handleResult.val, {
      expectedRevision: NEW,
    });
  };

  public update = async <CommandType extends Command>(
    handle: (command: CommandType) => Promise<Result<Event, AppError>>,
    streamName: string,
    expectedRevision: number,
    command: CommandType,
  ): Promise<Result<Event, AppError>> => {
    const handleResult = await handle(command);
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
  dependencies: ['mongo-plugin'],
});
