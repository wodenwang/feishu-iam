import { Controller, Get, Inject, Query, Req, UseFilters, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AdminErrorFilter } from './admin-error.filter';
import {
  AdminQueryService,
  type AdminAuditLogQueryInput,
  type AdminSecurityEventQueryInput
} from './admin-query.service';
import { readAdminContext } from './admin-request-context';
import { AdminSessionGuard } from './admin-session.guard';
import { AdminTraceService, type AdminTraceQueryInput } from './admin-trace.service';
import { AdminDomainError, type AdminContext } from './admin.types';

@Controller('/api/v1/admin')
@UseGuards(AdminSessionGuard)
@UseFilters(AdminErrorFilter)
export class AdminAuditController {
  constructor(
    @Inject(AdminQueryService) private readonly queries: AdminQueryService,
    @Inject(AdminTraceService) private readonly traces: AdminTraceService
  ) {}

  @Get('/audit-logs')
  async listAuditLogs(@Req() request: Request, @Query() query: Record<string, unknown>): Promise<unknown> {
    return this.queries.listAuditLogs(readRequiredAdminContext(request), {
      page: parseIntegerQuery(query.page),
      pageSize: parseIntegerQuery(query.pageSize),
      requestId: parseStringQueryAlias(query, 'request_id', 'requestId'),
      result: parseStringQuery(query.result),
      action: parseStringQuery(query.action),
      resourceType: parseStringQueryAlias(query, 'resource_type', 'resourceType'),
      applicationId: parseStringQueryAlias(query, 'application_id', 'applicationId')
    } satisfies AdminAuditLogQueryInput);
  }

  @Get('/security-events')
  async listSecurityEvents(@Req() request: Request, @Query() query: Record<string, unknown>): Promise<unknown> {
    return this.queries.listSecurityEvents(readRequiredAdminContext(request), {
      page: parseIntegerQuery(query.page),
      pageSize: parseIntegerQuery(query.pageSize),
      requestId: parseStringQueryAlias(query, 'request_id', 'requestId'),
      result: parseStringQuery(query.result),
      eventType: parseStringQueryAlias(query, 'event_type', 'eventType'),
      eventTypes: parseStringArrayQueryAlias(query, 'event_types', 'eventTypes'),
      reasonCode: parseStringQueryAlias(query, 'reason_code', 'reasonCode'),
      applicationId: parseStringQueryAlias(query, 'application_id', 'applicationId'),
      clientId: parseStringQueryAlias(query, 'client_id', 'clientId'),
      feishuUserId: parseStringQueryAlias(query, 'feishu_user_id', 'feishuUserId')
    } satisfies AdminSecurityEventQueryInput);
  }

  @Get('/traces')
  async getTrace(@Req() request: Request, @Query() query: Record<string, unknown>): Promise<unknown> {
    return this.traces.getTrace(readRequiredAdminContext(request), {
      requestId: parseStringQueryAlias(query, 'request_id', 'requestId'),
      applicationId: parseStringQueryAlias(query, 'application_id', 'applicationId'),
      appKey: parseStringQueryAlias(query, 'app_key', 'appKey'),
      clientId: parseStringQueryAlias(query, 'client_id', 'clientId'),
      feishuUserId: parseStringQueryAlias(query, 'feishu_user_id', 'feishuUserId'),
      from: parseStringQuery(query.from),
      to: parseStringQuery(query.to),
      result: parseStringQuery(query.result)
    } satisfies AdminTraceQueryInput);
  }
}

function readRequiredAdminContext(request: Request): AdminContext {
  const context = readAdminContext(request);

  if (!context) {
    throw new AdminDomainError('ADMIN_SESSION_REQUIRED', '需要登录 Feishu IAM 管理后台', 401);
  }

  return context;
}

function parseStringQuery(value: unknown): string | undefined {
  const raw = Array.isArray(value) ? (value as readonly unknown[])[0] : value;
  if (typeof raw !== 'string') {
    return undefined;
  }
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function parseStringQueryAlias(query: Record<string, unknown>, snakeKey: string, camelKey: string): string | undefined {
  return parseStringQuery(query[snakeKey]) ?? parseStringQuery(query[camelKey]);
}

function parseStringArrayQueryAlias(query: Record<string, unknown>, snakeKey: string, camelKey: string): string[] | undefined {
  const snakeValues = parseStringArrayQuery(query[snakeKey]);
  if (snakeValues.length > 0) {
    return snakeValues;
  }

  const camelValues = parseStringArrayQuery(query[camelKey]);
  return camelValues.length > 0 ? camelValues : undefined;
}

function parseStringArrayQuery(value: unknown): string[] {
  const rawValues = Array.isArray(value) ? value : [value];
  return rawValues.flatMap((item) => {
    if (typeof item !== 'string') {
      return [];
    }
    return item
      .split(',')
      .map((part) => part.trim())
      .filter((part) => part.length > 0);
  });
}

function parseIntegerQuery(value: unknown): number | undefined {
  const raw = parseStringQuery(value);
  if (!raw) {
    return undefined;
  }
  const parsed = Number(raw);
  return Number.isInteger(parsed) ? parsed : undefined;
}
