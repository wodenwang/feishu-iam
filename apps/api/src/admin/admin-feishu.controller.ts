import {
  Controller,
  Body,
  Get,
  Inject,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  UseFilters,
  UseGuards
} from '@nestjs/common';
import type { Request } from 'express';
import { FeishuDiagnosticsService } from '../feishu/feishu-diagnostics.service';
import { FeishuErrorFilter } from '../feishu/feishu-error.filter';
import { FeishuMirrorQueryService } from '../feishu/feishu-mirror-query.service';
import { FeishuStatusService, sanitizeFeishuStatus, sanitizeFeishuSyncRun } from '../feishu/feishu-status.service';
import { FeishuSyncService, type SyncResult } from '../feishu/feishu-sync.service';
import { AuditLogService } from '../permission/audit-log.service';
import { AdminErrorFilter } from './admin-error.filter';
import { AdminPermissionService } from './admin-permission.service';
import { getAdminRequestId, readAdminContext } from './admin-request-context';
import { AdminSessionGuard } from './admin-session.guard';
import { AdminDomainError, type AdminContext } from './admin.types';

@Controller('/api/v1/admin/feishu')
@UseGuards(AdminSessionGuard)
@UseFilters(AdminErrorFilter, FeishuErrorFilter)
export class AdminFeishuController {
  constructor(
    @Inject(FeishuSyncService)
    private readonly syncService: FeishuSyncService,
    @Inject(FeishuStatusService)
    private readonly statusService: FeishuStatusService,
    @Inject(FeishuDiagnosticsService)
    private readonly diagnosticsService: FeishuDiagnosticsService,
    @Inject(AdminPermissionService)
    private readonly permission: AdminPermissionService,
    @Inject(FeishuMirrorQueryService)
    private readonly mirrorQuery: FeishuMirrorQueryService,
    @Inject(AuditLogService)
    private readonly audit: AuditLogService
  ) {}

  @Get('/overview')
  async getOverview(@Req() request: Request): Promise<Awaited<ReturnType<FeishuStatusService['getStatus']>>> {
    const context = readRequiredAdminContext(request);
    this.permission.assertCanViewFeishuSync(context);
    return sanitizeFeishuStatus(await this.statusService.getStatus());
  }

  @Get('/status')
  async getStatus(@Req() request: Request): Promise<Awaited<ReturnType<FeishuStatusService['getStatus']>>> {
    const context = readRequiredAdminContext(request);
    this.permission.assertCanViewFeishuSync(context);
    return sanitizeFeishuStatus(await this.statusService.getStatus());
  }

  @Get('/sync-runs')
  async listSyncRuns(
    @Req() request: Request
  ): Promise<{ items: Awaited<ReturnType<FeishuStatusService['listRuns']>> }> {
    const context = readRequiredAdminContext(request);
    this.permission.assertCanViewFeishuSync(context);
    const runs = await this.statusService.listRuns();
    return { items: runs.map(sanitizeFeishuSyncRun) };
  }

  @Get('/sync-runs/:id')
  async getSyncRun(
    @Param('id') id: string,
    @Req() request: Request
  ): Promise<NonNullable<Awaited<ReturnType<FeishuStatusService['getRun']>>>> {
    const context = readRequiredAdminContext(request);
    this.permission.assertCanViewFeishuSync(context);
    const run = await this.statusService.getRun(id);
    if (!run) {
      throw new NotFoundException({
        error: {
          code: 'FEISHU_SYNC_RUN_NOT_FOUND',
          message: '飞书同步记录不存在'
        }
      });
    }
    return sanitizeFeishuSyncRun(run);
  }

  @Get('/field-diagnostics')
  async getFieldDiagnostics(
    @Req() request: Request
  ): Promise<Awaited<ReturnType<FeishuDiagnosticsService['getFieldDiagnostics']>>> {
    const context = readRequiredAdminContext(request);
    this.permission.assertCanViewFeishuSync(context);
    return this.diagnosticsService.getFieldDiagnostics();
  }

  @Get('/users')
  async searchUsers(
    @Query('keyword') keyword: string | undefined,
    @Query('department_id') departmentId: string | undefined,
    @Query('page') page: string | undefined,
    @Query('page_size') pageSize: string | undefined,
    @Req() request: Request
  ): ReturnType<FeishuMirrorQueryService['listUsers']> {
    const context = readRequiredAdminContext(request);
    this.permission.assertCanQueryFeishuMirror(context);
    return this.mirrorQuery.listUsers({
      keyword,
      departmentId,
      page: readNumberQuery(page),
      pageSize: readNumberQuery(pageSize)
    });
  }

  @Get('/users/:userId')
  async getUser(
    @Param('userId') userId: string,
    @Req() request: Request
  ): ReturnType<FeishuMirrorQueryService['getUser']> {
    const context = readRequiredAdminContext(request);
    this.permission.assertCanQueryFeishuMirror(context);
    return this.mirrorQuery.getUser(userId);
  }

  @Post('/users/:userId/sync')
  async syncUser(
    @Param('userId') userId: string,
    @Req() request: Request
  ): Promise<SyncResult> {
    const context = readRequiredAdminContext(request);
    this.permission.assertCanTriggerFeishuLightSync(context);
    await this.mirrorQuery.getUser(userId);
    return this.writeWithAudit(request, context, {
      resourceType: 'feishu_user',
      resourceId: userId,
      action: 'sync_light_user'
    }, () =>
      this.syncService.runUserLightSync({
        triggeredBy: context.adminUserId,
        triggerSource: 'admin_web_user_light',
        userId
      })
    );
  }

  @Get('/departments')
  async searchDepartments(
    @Query('keyword') keyword: string | undefined,
    @Query('parent_department_id') parentDepartmentId: string | undefined,
    @Query('page') page: string | undefined,
    @Query('page_size') pageSize: string | undefined,
    @Req() request: Request
  ): ReturnType<FeishuMirrorQueryService['listDepartments']> {
    const context = readRequiredAdminContext(request);
    this.permission.assertCanQueryFeishuMirror(context);
    return this.mirrorQuery.listDepartments({
      keyword,
      parentDepartmentId: normalizeParentDepartmentId(parentDepartmentId),
      page: readNumberQuery(page),
      pageSize: readNumberQuery(pageSize)
    });
  }

  @Get('/departments/:departmentId')
  async getDepartment(
    @Param('departmentId') departmentId: string,
    @Req() request: Request
  ): ReturnType<FeishuMirrorQueryService['getDepartment']> {
    const context = readRequiredAdminContext(request);
    this.permission.assertCanQueryFeishuMirror(context);
    return this.mirrorQuery.getDepartment(departmentId);
  }

  @Post('/departments/:departmentId/sync')
  async syncDepartment(
    @Param('departmentId') departmentId: string,
    @Req() request: Request
  ): Promise<SyncResult> {
    const context = readRequiredAdminContext(request);
    this.permission.assertCanTriggerFeishuLightSync(context);
    await this.mirrorQuery.getDepartment(departmentId);
    return this.writeWithAudit(request, context, {
      resourceType: 'feishu_department',
      resourceId: departmentId,
      action: 'sync_light_department'
    }, () =>
      this.syncService.runDepartmentLightSync({
        triggeredBy: context.adminUserId,
        triggerSource: 'admin_web_department_light',
        departmentId
      })
    );
  }

  @Post('/sync-runs')
  async createSyncRun(
    @Body() body: { confirmLatestRunId?: string } | undefined,
    @Req() request: Request
  ): Promise<SyncResult> {
    const context = readRequiredAdminContext(request);
    this.permission.assertCanTriggerFeishuFullSync(context);
    const status = await this.statusService.getStatus();
    const requiredLatestRunId = status.latestRun?.id ?? 'NO_SYNC_RUN';
    if (!body?.confirmLatestRunId) {
      throw new AdminDomainError('FEISHU_FULL_SYNC_CONFIRMATION_REQUIRED', '触发飞书全量同步前必须输入当前最新 run id', 400);
    }
    if (body.confirmLatestRunId !== requiredLatestRunId) {
      throw new AdminDomainError('FEISHU_FULL_SYNC_CONFIRMATION_MISMATCH', '飞书全量同步确认信息已过期，请刷新后重新确认', 400);
    }
    return this.writeWithAudit(request, context, {
      resourceType: 'feishu_sync',
      resourceId: 'full',
      action: 'sync_full'
    }, () =>
      this.syncService.runFullSync({
        triggeredBy: context.adminUserId,
        triggerSource: 'admin_web'
      })
    );
  }

  @Post('/sync-runs/preflight')
  async preflightFullSync(@Req() request: Request) {
    const context = readRequiredAdminContext(request);
    this.permission.assertCanTriggerFeishuFullSync(context);
    const status = await this.statusService.getStatus();
    return {
      running: status.running,
      latestRun: status.latestRun,
      counts: status.counts,
      requiredLatestRunId: status.latestRun?.id ?? 'NO_SYNC_RUN'
    };
  }

  private async writeWithAudit<T>(
    request: Request,
    context: AdminContext,
    target: { resourceType: string; resourceId: string; action: string },
    operation: () => Promise<T>
  ): Promise<T> {
    try {
      const result = await operation();
      await this.recordAudit(request, context, target, 'success', result);
      return result;
    } catch (error) {
      await this.recordAudit(request, context, target, 'failed', safeAuditError(error));
      throw error;
    }
  }

  private async recordAudit(
    request: Request,
    context: AdminContext,
    target: { resourceType: string; resourceId: string; action: string },
    result: 'success' | 'failed',
    after: unknown
  ): Promise<void> {
    await this.audit.record({
      actorType: 'admin_user',
      actorId: context.adminUserId,
      source: 'admin_web',
      applicationId: null,
      resourceType: target.resourceType,
      resourceId: target.resourceId,
      action: target.action,
      after,
      result,
      requestId: getAdminRequestId(request),
      ip: request.ip ?? null,
      userAgent: request.header('user-agent') ?? null
    });
  }
}

function readRequiredAdminContext(request: Request): AdminContext {
  const context = readAdminContext(request);

  if (!context) {
    throw new AdminDomainError('ADMIN_SESSION_REQUIRED', '需要登录 Feishu IAM 管理后台', 401);
  }

  return context;
}

function readNumberQuery(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeParentDepartmentId(value: string | undefined): string | null | undefined {
  return value === '__root__' ? null : value;
}

function safeAuditError(error: unknown): Record<string, string> {
  if (error instanceof AdminDomainError) {
    return { code: error.code, message: error.message };
  }
  if (error instanceof Error) {
    const code = 'code' in error && typeof error.code === 'string' ? error.code : error.name;
    return { code, message: error.message };
  }
  return { code: 'UNKNOWN_ERROR', message: '飞书同步请求失败' };
}
