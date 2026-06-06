import { Controller, Get, Inject, Logger, Param, Req, UseFilters, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { PermissionCalculationService, type PermissionCalculationResult } from '../permission/permission-calculation.service';
import { PermissionErrorFilter } from '../permission/permission-error.filter';
import { AppTokenGuard, readAppTokenContext } from './app-token.guard';
import { OauthErrorFilter } from './oauth-error.filter';
import { getOauthRequestId } from './oauth-request-context';
import { OauthDomainError } from './oauth.types';
import { SecurityEventService } from './security-event.service';

type AppPermissionsResponse = {
  app_key: string;
  user_id: string;
  permission_groups: Array<{ key: string; name: string }>;
  permission_points: Array<{ key: string; name: string }>;
  matched_roles: Array<{ key: string; name: string }>;
  computed_at: string;
};

@Controller('/api/v1/apps/:appKey/me')
@UseGuards(AppTokenGuard)
@UseFilters(OauthErrorFilter, PermissionErrorFilter)
export class AppPermissionsController {
  private readonly logger = new Logger(AppPermissionsController.name);

  constructor(
    @Inject(PermissionCalculationService)
    private readonly permissions: PermissionCalculationService,
    @Inject(SecurityEventService)
    private readonly securityEvents: SecurityEventService
  ) {}

  @Get('permissions')
  async getPermissions(@Param('appKey') appKey: string, @Req() request: Request): Promise<AppPermissionsResponse> {
    const token = readAppTokenContext(request);
    if (token.appKey !== appKey) {
      await this.recordAppKeyMismatchBestEffort(request, token);
      throw new OauthDomainError('OAUTH_APP_KEY_MISMATCH', 'token 所属应用与路径应用不一致', 403);
    }

    try {
      const result = await this.permissions.calculate(appKey, token.feishuUserId);
      await this.recordPermissionQueryBestEffort(request, token, {
        result: 'success',
        reasonCode: null,
        summary: `权限查询成功：权限组 ${String(result.permissionGroups.length)} 个，权限点 ${String(result.permissionPoints.length)} 个`
      });
      return serializePermissions(result);
    } catch (error) {
      await this.recordPermissionQueryBestEffort(request, token, {
        result: 'failed',
        reasonCode: toPermissionFailureReasonCode(error),
        summary: '权限查询失败'
      });
      throw error;
    }
  }

  private async recordPermissionQueryBestEffort(
    request: Request,
    token: ReturnType<typeof readAppTokenContext>,
    event: { result: 'success' | 'failed'; reasonCode: string | null; summary: string }
  ): Promise<void> {
    try {
      await this.securityEvents.record({
        eventType: 'oauth_permission_query',
        applicationId: token.applicationId,
        clientId: token.clientId,
        feishuUserId: token.feishuUserId,
        result: event.result,
        reasonCode: event.reasonCode,
        summary: event.summary,
        ip: request.ip ?? null,
        userAgent: request.header('user-agent') ?? null,
        requestId: getOauthRequestId(request)
      });
    } catch (error) {
      this.logger.error('OAuth permission query security event write failed', error instanceof Error ? error.stack : undefined);
    }
  }

  private async recordAppKeyMismatchBestEffort(
    request: Request,
    token: ReturnType<typeof readAppTokenContext>
  ): Promise<void> {
    try {
      await this.securityEvents.record({
        eventType: 'oauth_app_token_auth',
        applicationId: token.applicationId,
        clientId: token.clientId,
        feishuUserId: token.feishuUserId,
        result: 'failed',
        reasonCode: 'OAUTH_APP_KEY_MISMATCH',
        summary: '应用 access token 跨应用使用被拒绝',
        ip: request.ip ?? null,
        userAgent: request.header('user-agent') ?? null,
        requestId: getOauthRequestId(request)
      });
    } catch (error) {
      this.logger.error(
        'OAuth app token app key mismatch security event write failed',
        error instanceof Error ? error.stack : undefined
      );
    }
  }
}

function serializePermissions(result: PermissionCalculationResult): AppPermissionsResponse {
  return {
    app_key: result.appKey,
    user_id: result.userId,
    permission_groups: result.permissionGroups,
    permission_points: result.permissionPoints,
    matched_roles: result.matchedRoles,
    computed_at: result.computedAt
  };
}

function toPermissionFailureReasonCode(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string') {
    return error.code;
  }

  return 'PERMISSION_CALCULATION_FAILED';
}
