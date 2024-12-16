import { type Result, Ok, Err } from 'ts-results';
import { AppError, ErrorCode } from '@ecomm/AppError';
import { nanoid } from 'nanoid';
import { type AuditLog } from './auditLog.entity';
import { type AuditLogDAO } from './auditLog.dao.schema';
import { type IAuditLogRepository } from './auditLog.repo';

// SERVICE INTERFACE
export interface IAuditLogService {
  createAuditLog: (payload: any) => Promise<Result<AuditLog, AppError>>;
  findAuditLogById: (id: string) => Promise<Result<AuditLog, AppError>>;
  findAuditLogs: (
    query: any,
    options?: any,
  ) => Promise<Result<AuditLog[], AppError>>;
}

const toEntity = ({ _id, ...remainder }: AuditLogDAO): AuditLog => ({
  id: _id,
  ...remainder,
});

// SERVICE IMPLEMENTATION
export class AuditLogService implements IAuditLogService {
  private static instance: IAuditLogService;
  private repo: IAuditLogRepository;

  private constructor(server: any) {
    this.repo = server.db.repo.auditLogRepository as IAuditLogRepository;
  }

  public static getInstance(server: any): IAuditLogService {
    if (!AuditLogService.instance) {
      AuditLogService.instance = new AuditLogService(server);
    }
    return AuditLogService.instance;
  }

  // CREATE AUDITLOG
  public async createAuditLog(
    payload: any,
  ): Promise<Result<AuditLog, AppError>> {
    // Save the entity
    const result = await this.repo.create({
      id: nanoid(),
      ...payload,
    });
    if (result.err) return result;
    return new Ok(toEntity(result.val));
  }

  // FIND AUDITLOG By ID
  public async findAuditLogById(
    id: string,
  ): Promise<Result<AuditLog, AppError>> {
    const result = await this.repo.findOne(id);
    if (result.err) return result;
    return new Ok(toEntity(result.val));
  }

  // FIND AUDITLOGS
  public async findAuditLogs(
    query: any,
    options?: any,
  ): Promise<Result<AuditLog[], AppError>> {
    const result = await this.repo.find(query, options);
    if (result.err) return result;
    return new Ok(result.val.map((entity) => toEntity(entity)));
  }
}
