import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Request } from 'express';
import { SecurityEventService } from '../oauth/security-event.service';
import { getAdminRequestId, readAdminContext } from './admin-request-context';

export const ADMIN_AUTH_FAILURE_CODES = new Set([
  'ADMIN_SESSION_REQUIRED',
  'ADMIN_SESSION_INVALID',
  'ADMIN_SESSION_EXPIRED',
  'ADMIN_USER_UNAVAILABLE',
  'ADMIN_PERMISSION_DENIED'
]);

export type AdminAuthFailureInput = {
  code: string;
  status: number;
  message: string;
  request: Request;
};

@Injectable()
export class AdminAuthFailureRecorder {
  private readonly logger = new Logger(AdminAuthFailureRecorder.name);

  constructor(
    @Inject(SecurityEventService)
    private readonly securityEvents: SecurityEventService
  ) {}

  async recordBestEffort(input: AdminAuthFailureInput): Promise<void> {
    if (!ADMIN_AUTH_FAILURE_CODES.has(input.code)) {
      return;
    }

    const requestId = getAdminRequestId(input.request);
    const context = readAdminContext(input.request);

    try {
      await this.securityEvents.record({
        eventType: 'admin_auth_failure',
        applicationId: null,
        clientId: null,
        feishuUserId: context?.feishuUserId ?? null,
        result: 'failed',
        reasonCode: input.code,
        summary: buildAdminAuthFailureSummary(input.code, input.status),
        ip: readIp(input.request),
        userAgent: readUserAgent(input.request),
        requestId
      });
    } catch (error) {
      this.logger.error(
        `Admin auth failure security event write failed: ${input.code} / request id: ${requestId} / error: ${error instanceof Error ? error.name : 'unknown'}`
      );
    }
  }
}

function buildAdminAuthFailureSummary(code: string, status: number): string {
  if (code === 'ADMIN_SESSION_REQUIRED') return '后台访问缺少有效登录态';
  if (code === 'ADMIN_SESSION_INVALID') return '后台访问登录态无效';
  if (code === 'ADMIN_SESSION_EXPIRED') return '后台访问登录态已过期';
  if (code === 'ADMIN_USER_UNAVAILABLE') return '后台管理员或关联飞书用户不可用';
  if (code === 'ADMIN_PERMISSION_DENIED') return '后台管理员权限不足';
  return `后台认证或授权失败，HTTP ${String(status)}`;
}

function readIp(request: Request): string | null {
  return request.ip ?? null;
}

function readUserAgent(request: Request): string | null {
  return request.header('user-agent') ?? null;
}
