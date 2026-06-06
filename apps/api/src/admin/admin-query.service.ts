import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AdminDomainError, type AdminContext } from './admin.types';

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const REDACTED = '[REDACTED]';
const SENSITIVE_KEY_PARTS = [
  'secret',
  'token',
  'cookie',
  'authorization',
  'password',
  'clientsecret',
  'accesstoken',
  'refreshtoken',
  'clientsecrethash',
  'apikey',
  'privatekey',
  'credential'
];
const FEISHU_SYNC_AUDIT_RESOURCE_TYPES = [
  'feishu_sync',
  'feishu_sync_run',
  'feishu_department',
  'feishu_user',
  'feishu_user_department'
] as const;

export type AdminAuditLogQueryInput = {
  page?: number;
  pageSize?: number;
  requestId?: string;
  result?: string;
  action?: string;
  resourceType?: string;
  applicationId?: string;
};

export type AdminSecurityEventQueryInput = {
  page?: number;
  pageSize?: number;
  requestId?: string;
  result?: string;
  eventType?: string;
  eventTypes?: string[];
  reasonCode?: string;
  applicationId?: string;
  clientId?: string;
  feishuUserId?: string;
};

export type AdminPagedResult<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
};

type AuditLogListItem = Omit<Prisma.AuditLogGetPayload<Record<string, never>>, 'before' | 'after'> & {
  before: unknown;
  after: unknown;
};
type SecurityEventListItem = Prisma.SecurityEventGetPayload<Record<string, never>>;

@Injectable()
export class AdminQueryService {
  constructor(private readonly prisma: PrismaService) {}

  async listAuditLogs(
    context: AdminContext,
    input: AdminAuditLogQueryInput
  ): Promise<AdminPagedResult<AuditLogListItem>> {
    const { page, pageSize } = normalizePagination(input);
    const where = this.buildAuditLogWhere(context, input);
    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize
      }),
      this.prisma.auditLog.count({ where })
    ]);

    return {
      items: items.map((item) => ({
        ...item,
        before: redactSensitive(item.before),
        after: redactSensitive(item.after)
      })),
      total,
      page,
      pageSize
    };
  }

  async listSecurityEvents(
    context: AdminContext,
    input: AdminSecurityEventQueryInput
  ): Promise<AdminPagedResult<SecurityEventListItem>> {
    const { page, pageSize } = normalizePagination(input);
    const where = this.buildSecurityEventWhere(context, input);
    const [items, total] = await Promise.all([
      this.prisma.securityEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize
      }),
      this.prisma.securityEvent.count({ where })
    ]);

    return {
      items,
      total,
      page,
      pageSize
    };
  }

  private buildAuditLogWhere(context: AdminContext, input: AdminAuditLogQueryInput): Prisma.AuditLogWhereInput {
    const where: Prisma.AuditLogWhereInput = {
      ...pickStringFilters(input, ['requestId', 'result', 'action', 'resourceType'])
    };
    applyAuditScope(where, context, input.applicationId);
    return where;
  }

  private buildSecurityEventWhere(
    context: AdminContext,
    input: AdminSecurityEventQueryInput
  ): Prisma.SecurityEventWhereInput {
    const eventTypes = normalizeStringArray(input.eventTypes);
    const where: Prisma.SecurityEventWhereInput = {
      ...pickStringFilters(input, ['requestId', 'result', 'reasonCode', 'clientId', 'feishuUserId']),
      ...(eventTypes.length > 0
        ? { eventType: { in: eventTypes } }
        : pickStringFilters(input, ['eventType']))
    };
    applyApplicationScope(where, context, input.applicationId);
    return where;
  }
}

export function redactSensitive(value: unknown): unknown {
  return redactValue(value, new WeakSet());
}

function redactValue(value: unknown, seen: WeakSet<object>): unknown {
  if (value === null || typeof value !== 'object') {
    return value;
  }

  if (value instanceof Date) {
    return value;
  }

  if (Array.isArray(value)) {
    if (seen.has(value)) {
      return '[Circular]';
    }
    seen.add(value);
    return value.map((item) => redactValue(item, seen));
  }

  if (seen.has(value)) {
    return '[Circular]';
  }
  seen.add(value);

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      isSensitiveKey(key) ? REDACTED : redactValue(item, seen)
    ])
  );
}

function isSensitiveKey(key: string): boolean {
  const normalizedKey = key.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  return SENSITIVE_KEY_PARTS.some((part) => normalizedKey.includes(part));
}

function normalizePagination(input: { page?: number; pageSize?: number }): { page: number; pageSize: number } {
  const page = Number.isInteger(input.page) && input.page && input.page > 0 ? input.page : DEFAULT_PAGE;
  const rawPageSize =
    Number.isInteger(input.pageSize) && input.pageSize && input.pageSize > 0 ? input.pageSize : DEFAULT_PAGE_SIZE;
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, rawPageSize));
  return { page, pageSize };
}

function pickStringFilters<T extends string>(
  input: Record<string, unknown>,
  fields: readonly T[]
): Partial<Record<T, string>> {
  return Object.fromEntries(
    fields
      .map((field) => [field, normalizeString(input[field])] as const)
      .filter((entry): entry is readonly [T, string] => entry[1] !== undefined)
  ) as Partial<Record<T, string>>;
}

function applyAuditScope(
  where: Prisma.AuditLogWhereInput,
  context: AdminContext,
  requestedApplicationId: string | undefined
): void {
  if (canViewGlobal(context)) {
    applyGlobalApplicationFilter(where, requestedApplicationId);
    return;
  }

  if (context.roles.includes('application_admin')) {
    where.applicationId = { in: intersectRequestedApplicationIds(context.applicationIds, requestedApplicationId) };
    return;
  }

  if (context.roles.includes('sync_admin')) {
    where.resourceType = { in: intersectRequestedResourceTypes(where.resourceType) };
    return;
  }

  throw new AdminDomainError('ADMIN_PERMISSION_DENIED', '当前管理员无权查看审计日志', 403);
}

function applyApplicationScope(
  where: Prisma.SecurityEventWhereInput,
  context: AdminContext,
  requestedApplicationId: string | undefined
): void {
  if (canViewGlobal(context)) {
    applyGlobalApplicationFilter(where, requestedApplicationId);
    return;
  }

  if (context.roles.includes('application_admin')) {
    where.applicationId = { in: intersectRequestedApplicationIds(context.applicationIds, requestedApplicationId) };
    return;
  }

  if (context.roles.includes('sync_admin')) {
    where.applicationId = { in: [] };
    return;
  }

  throw new AdminDomainError('ADMIN_PERMISSION_DENIED', '当前管理员无权查看安全事件', 403);
}

function canViewGlobal(context: AdminContext): boolean {
  return context.roles.includes('platform_admin') || context.roles.includes('audit_viewer');
}

function applyGlobalApplicationFilter(
  where: { applicationId?: unknown },
  requestedApplicationId: string | undefined
): void {
  if (requestedApplicationId) {
    where.applicationId = requestedApplicationId;
  }
}

function intersectRequestedApplicationIds(applicationIds: string[], requestedApplicationId: string | undefined): string[] {
  if (!requestedApplicationId) {
    return applicationIds;
  }
  return applicationIds.includes(requestedApplicationId) ? [requestedApplicationId] : [];
}

function intersectRequestedResourceTypes(resourceType: unknown): string[] {
  if (typeof resourceType === 'string') {
    return FEISHU_SYNC_AUDIT_RESOURCE_TYPES.includes(resourceType as never) ? [resourceType] : [];
  }
  return [...FEISHU_SYNC_AUDIT_RESOURCE_TYPES];
}

function normalizeString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeStringArray(values: unknown): string[] {
  if (!Array.isArray(values)) {
    return [];
  }
  return values
    .map((value) => normalizeString(value))
    .filter((value): value is string => value !== undefined);
}
