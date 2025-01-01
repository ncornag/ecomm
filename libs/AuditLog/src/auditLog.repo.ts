import { type Result, Ok, Err } from 'ts-results-es';
import { Db, Collection } from 'mongodb';
import { ErrorCode, AppError } from '@ecomm/app-error';
import { type AuditLog } from './auditLog.entity.ts';
import { type AuditLogDAO } from './auditLog.dao.schema.ts';

export const getAuditLogCollection = (db: Db): Collection<AuditLogDAO> => {
  return db.collection<AuditLogDAO>('AuditLog');
};

export interface IAuditLogRepository {
  create: (category: AuditLog) => Promise<Result<AuditLogDAO, AppError>>;
  findOne: (id: string, version?: number) => Promise<Result<AuditLogDAO, AppError>>;
  find: (query: any, options?: any) => Promise<Result<AuditLogDAO[], AppError>>;
}

// TODO: Use a different collection per ProjectId
export class AuditLogRepository implements IAuditLogRepository {
  private col: Collection<AuditLogDAO>;

  constructor(server: any) {
    this.col = server.db.col.auditLog;
  }

  // CREATE AUDITLOG
  async create(auditLog: AuditLog): Promise<Result<AuditLogDAO, AppError>> {
    const { id: _id, ...data } = auditLog;
    const auditLogDAO = { _id, ...data };
    const result = await this.col.insertOne(auditLogDAO);
    // TODO Check error
    return new Ok(auditLogDAO);
  }

  // FIND ONE AUDITLOG
  async findOne(id: string, version?: number): Promise<Result<AuditLogDAO, AppError>> {
    const filter: any = { _id: id };
    if (version !== undefined) filter.version = version;
    const entity = await this.col.findOne(filter);
    if (!entity) {
      return new Err(new AppError(ErrorCode.BAD_REQUEST, `Can't find auditLog with id [${id}]`));
    }
    return new Ok(entity);
  }

  // FIND MANY AUDITLOGS
  async find(query: any, options: any): Promise<Result<AuditLogDAO[], AppError>> {
    const entities = await this.col.find(query, options).toArray();
    return new Ok(entities);
  }
}
