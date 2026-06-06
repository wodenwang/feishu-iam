import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuditResult } from './permission.types';

type AuditLogRecordParams = {
  actorType: string;
  actorId: string;
  source: string;
  applicationId?: string | null;
  resourceType: string;
  resourceId: string;
  action: string;
  before?: unknown;
  after?: unknown;
  result: AuditResult;
  ip?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
};

type AuditLogClient = Pick<Prisma.TransactionClient, 'auditLog'>;

@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  async record(params: AuditLogRecordParams, client: AuditLogClient = this.prisma): Promise<void> {
    await client.auditLog.create({
      data: {
        id: randomUUID(),
        actorType: params.actorType,
        actorId: params.actorId,
        source: params.source,
        applicationId: params.applicationId ?? null,
        resourceType: params.resourceType,
        resourceId: params.resourceId,
        action: params.action,
        before: toOptionalJson(params.before),
        after: toOptionalJson(params.after),
        result: params.result,
        ip: params.ip ?? null,
        userAgent: params.userAgent ?? null,
        requestId: params.requestId ?? randomUUID()
      }
    });
  }
}

function toOptionalJson(
  value: unknown
): Prisma.NullableJsonNullValueInput | Prisma.InputJsonValue | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return Prisma.JsonNull;
  }
  return normalizeJsonValue(value, new WeakSet()) as Prisma.InputJsonValue;
}

function normalizeJsonValue(value: unknown, seen: WeakSet<object>): unknown {
  if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'bigint') {
    return value.toString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    if (seen.has(value)) {
      return '[Circular]';
    }

    seen.add(value);
    return value.map((item) => {
      if (item === undefined || typeof item === 'function' || typeof item === 'symbol') {
        return null;
      }
      return normalizeJsonValue(item, seen);
    });
  }

  if (typeof value === 'object') {
    if (seen.has(value)) {
      return '[Circular]';
    }

    seen.add(value);
    const normalized: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      if (item === undefined || typeof item === 'function' || typeof item === 'symbol') {
        continue;
      }
      normalized[key] = normalizeJsonValue(item, seen);
    }
    return normalized;
  }

  return null;
}
