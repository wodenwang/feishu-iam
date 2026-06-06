import { randomUUID } from 'node:crypto';
import { Body, Controller, Get, Inject, Param, Patch, Post, Put, Req, UseFilters, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { PlatformTokenGuard } from '../platform/platform-token.guard';
import { AuditLogService } from './audit-log.service';
import { ApplicationService } from './application.service';
import { IamRoleService } from './iam-role.service';
import { PermissionCalculationService } from './permission-calculation.service';
import { PermissionCatalogService } from './permission-catalog.service';
import { PermissionErrorFilter } from './permission-error.filter';
import { PermissionDomainError, type EntityStatus, type IamSubjectType, type PermissionAuditContext } from './permission.types';

type CreateApplicationBody = {
  appKey: string;
  name: string;
  description?: string;
  ownerUserId?: string;
};

type UpdateApplicationBody = {
  name?: string;
  description?: string | null;
  ownerUserId?: string | null;
};

type CreateCatalogBody = {
  key: string;
  name: string;
  description?: string;
};

type UpdateCatalogBody = {
  key?: string;
  name?: string;
  description?: string | null;
};

type CreateRoleBody = {
  key: string;
  name: string;
  description?: string;
};

type UpdateRoleBody = {
  name?: string;
  description?: string | null;
};

type ReplacePermissionGroupPointsBody = {
  pointIds?: string[];
};

type ReplaceRoleSubjectsBody = {
  subjects?: Array<{
    type: IamSubjectType;
    id: string;
  }>;
};

type ReplaceRolePermissionGroupsBody = {
  groupIds?: string[];
};

type ReplaceRolePermissionPointsBody = {
  pointIds?: string[];
};

type IamRoleResponse = Awaited<ReturnType<IamRoleService['createRole']>> & {
  app_key: string;
};

type PermissionPreviewResponse = {
  app_key: string;
  user_id: string;
  permission_groups: Array<{ key: string; name: string }>;
  permission_points: Array<{ key: string; name: string }>;
  matched_roles: Array<{ key: string; name: string }>;
  computed_at: string;
};

type OkResponse = {
  ok: true;
};

type FailedAuditTarget = {
  appKey?: string;
  resourceType: string;
  resourceId: string;
  action: string;
};

@Controller('/api/v1/platform')
@UseGuards(PlatformTokenGuard)
@UseFilters(PermissionErrorFilter)
export class PermissionController {
  constructor(
    @Inject(ApplicationService)
    private readonly applications: ApplicationService,
    @Inject(AuditLogService)
    private readonly audit: AuditLogService,
    @Inject(PermissionCatalogService)
    private readonly catalog: PermissionCatalogService,
    @Inject(IamRoleService)
    private readonly iamRoles: IamRoleService,
    @Inject(PermissionCalculationService)
    private readonly permissions: PermissionCalculationService
  ) {}

  @Post('/applications')
  async createApplication(
    @Body() body: CreateApplicationBody,
    @Req() request: Request
  ): Promise<Awaited<ReturnType<ApplicationService['createApplication']>>> {
    return this.writeWithAudit(
      request,
      { appKey: body.appKey, resourceType: 'application', resourceId: safeResourceId(body.appKey), action: 'create' },
      (auditContext) => this.applications.createApplication(body, auditContext)
    );
  }

  @Get('/applications')
  async listApplications(): Promise<{ items: Awaited<ReturnType<ApplicationService['listAllApplications']>> }> {
    return { items: await this.applications.listAllApplications() };
  }

  @Get('/applications/:appKey')
  async getApplication(
    @Param('appKey') appKey: string
  ): Promise<Awaited<ReturnType<ApplicationService['getApplicationByKey']>>> {
    return this.applications.getApplicationByKey(appKey);
  }

  @Patch('/applications/:appKey')
  async updateApplication(
    @Param('appKey') appKey: string,
    @Body() body: UpdateApplicationBody,
    @Req() request: Request
  ): Promise<Awaited<ReturnType<ApplicationService['updateApplication']>>> {
    return this.writeWithAudit(
      request,
      { appKey, resourceType: 'application', resourceId: appKey, action: 'update' },
      (auditContext) => this.applications.updateApplication(appKey, body, auditContext)
    );
  }

  @Post('/applications/:appKey/enable')
  async enableApplication(
    @Param('appKey') appKey: string,
    @Req() request: Request
  ): Promise<Awaited<ReturnType<ApplicationService['setApplicationStatus']>>> {
    return this.writeWithAudit(
      request,
      { appKey, resourceType: 'application', resourceId: appKey, action: 'set_status' },
      (auditContext) => this.applications.setApplicationStatus(appKey, 'active', auditContext)
    );
  }

  @Post('/applications/:appKey/disable')
  async disableApplication(
    @Param('appKey') appKey: string,
    @Req() request: Request
  ): Promise<Awaited<ReturnType<ApplicationService['setApplicationStatus']>>> {
    return this.writeWithAudit(
      request,
      { appKey, resourceType: 'application', resourceId: appKey, action: 'set_status' },
      (auditContext) => this.applications.setApplicationStatus(appKey, 'disabled', auditContext)
    );
  }

  @Post('/applications/:appKey/permission-groups')
  async createPermissionGroup(
    @Param('appKey') appKey: string,
    @Body() body: CreateCatalogBody,
    @Req() request: Request
  ): Promise<Awaited<ReturnType<PermissionCatalogService['createPermissionGroup']>>> {
    return this.writeWithAudit(
      request,
      { appKey, resourceType: 'permission_group', resourceId: safeResourceId(body.key), action: 'create' },
      (auditContext) => this.catalog.createPermissionGroup(appKey, body, auditContext)
    );
  }

  @Get('/applications/:appKey/permission-groups')
  async listPermissionGroups(
    @Param('appKey') appKey: string
  ): Promise<{ items: Awaited<ReturnType<PermissionCatalogService['listPermissionGroups']>> }> {
    return { items: await this.catalog.listPermissionGroups(appKey) };
  }

  @Patch('/applications/:appKey/permission-groups/:groupId')
  async updatePermissionGroup(
    @Param('appKey') appKey: string,
    @Param('groupId') groupId: string,
    @Body() body: UpdateCatalogBody,
    @Req() request: Request
  ): Promise<Awaited<ReturnType<PermissionCatalogService['updatePermissionGroup']>>> {
    return this.writeWithAudit(
      request,
      { appKey, resourceType: 'permission_group', resourceId: groupId, action: 'update' },
      (auditContext) => this.catalog.updatePermissionGroup(appKey, groupId, body, auditContext)
    );
  }

  @Post('/applications/:appKey/permission-groups/:groupId/enable')
  async enablePermissionGroup(
    @Param('appKey') appKey: string,
    @Param('groupId') groupId: string,
    @Req() request: Request
  ): Promise<Awaited<ReturnType<PermissionCatalogService['setPermissionGroupStatus']>>> {
    return this.writeWithAudit(
      request,
      { appKey, resourceType: 'permission_group', resourceId: groupId, action: 'set_status' },
      (auditContext) => this.catalog.setPermissionGroupStatus(appKey, groupId, activeStatus(), auditContext)
    );
  }

  @Post('/applications/:appKey/permission-groups/:groupId/disable')
  async disablePermissionGroup(
    @Param('appKey') appKey: string,
    @Param('groupId') groupId: string,
    @Req() request: Request
  ): Promise<Awaited<ReturnType<PermissionCatalogService['setPermissionGroupStatus']>>> {
    return this.writeWithAudit(
      request,
      { appKey, resourceType: 'permission_group', resourceId: groupId, action: 'set_status' },
      (auditContext) => this.catalog.setPermissionGroupStatus(appKey, groupId, disabledStatus(), auditContext)
    );
  }

  @Put('/applications/:appKey/permission-groups/:groupId/points')
  async replacePermissionGroupPoints(
    @Param('appKey') appKey: string,
    @Param('groupId') groupId: string,
    @Body() body: ReplacePermissionGroupPointsBody,
    @Req() request: Request
  ): Promise<OkResponse> {
    await this.writeWithAudit(
      request,
      { appKey, resourceType: 'permission_group', resourceId: groupId, action: 'replace_permission_points' },
      (auditContext) => this.catalog.replacePermissionGroupPoints(
        appKey,
        groupId,
        readStringArrayField(body, 'pointIds', 'PERMISSION_POINT_IDS_INVALID', '权限点列表必须是非空字符串数组'),
        auditContext
      )
    );
    return { ok: true };
  }

  @Post('/applications/:appKey/permission-points')
  async createPermissionPoint(
    @Param('appKey') appKey: string,
    @Body() body: CreateCatalogBody,
    @Req() request: Request
  ): Promise<Awaited<ReturnType<PermissionCatalogService['createPermissionPoint']>>> {
    return this.writeWithAudit(
      request,
      { appKey, resourceType: 'permission_point', resourceId: safeResourceId(body.key), action: 'create' },
      (auditContext) => this.catalog.createPermissionPoint(appKey, body, auditContext)
    );
  }

  @Get('/applications/:appKey/permission-points')
  async listPermissionPoints(
    @Param('appKey') appKey: string
  ): Promise<{ items: Awaited<ReturnType<PermissionCatalogService['listPermissionPoints']>> }> {
    return { items: await this.catalog.listPermissionPoints(appKey) };
  }

  @Patch('/applications/:appKey/permission-points/:pointId')
  async updatePermissionPoint(
    @Param('appKey') appKey: string,
    @Param('pointId') pointId: string,
    @Body() body: UpdateCatalogBody,
    @Req() request: Request
  ): Promise<Awaited<ReturnType<PermissionCatalogService['updatePermissionPoint']>>> {
    return this.writeWithAudit(
      request,
      { appKey, resourceType: 'permission_point', resourceId: pointId, action: 'update' },
      (auditContext) => this.catalog.updatePermissionPoint(appKey, pointId, body, auditContext)
    );
  }

  @Post('/applications/:appKey/permission-points/:pointId/enable')
  async enablePermissionPoint(
    @Param('appKey') appKey: string,
    @Param('pointId') pointId: string,
    @Req() request: Request
  ): Promise<Awaited<ReturnType<PermissionCatalogService['setPermissionPointStatus']>>> {
    return this.writeWithAudit(
      request,
      { appKey, resourceType: 'permission_point', resourceId: pointId, action: 'set_status' },
      (auditContext) => this.catalog.setPermissionPointStatus(appKey, pointId, activeStatus(), auditContext)
    );
  }

  @Post('/applications/:appKey/permission-points/:pointId/disable')
  async disablePermissionPoint(
    @Param('appKey') appKey: string,
    @Param('pointId') pointId: string,
    @Req() request: Request
  ): Promise<Awaited<ReturnType<PermissionCatalogService['setPermissionPointStatus']>>> {
    return this.writeWithAudit(
      request,
      { appKey, resourceType: 'permission_point', resourceId: pointId, action: 'set_status' },
      (auditContext) => this.catalog.setPermissionPointStatus(appKey, pointId, disabledStatus(), auditContext)
    );
  }

  @Post('/applications/:appKey/iam-roles')
  async createRole(
    @Param('appKey') appKey: string,
    @Body() body: CreateRoleBody,
    @Req() request: Request
  ): Promise<IamRoleResponse> {
    return this.writeWithAudit(
      request,
      { appKey, resourceType: 'iam_role', resourceId: safeResourceId(body.key), action: 'create' },
      async (auditContext) => withAppKey(await this.iamRoles.createRole(appKey, body, auditContext), appKey)
    );
  }

  @Get('/applications/:appKey/iam-roles')
  async listRoles(
    @Param('appKey') appKey: string
  ): Promise<{ items: IamRoleResponse[] }> {
    const roles = await this.iamRoles.listRoles(appKey);
    return { items: roles.map((role) => withAppKey(role, appKey)) };
  }

  @Patch('/applications/:appKey/iam-roles/:roleId')
  async updateRole(
    @Param('appKey') appKey: string,
    @Param('roleId') roleId: string,
    @Body() body: UpdateRoleBody,
    @Req() request: Request
  ): Promise<IamRoleResponse> {
    return this.writeWithAudit(
      request,
      { appKey, resourceType: 'iam_role', resourceId: roleId, action: 'update' },
      async (auditContext) => withAppKey(await this.iamRoles.updateRole(appKey, roleId, body, auditContext), appKey)
    );
  }

  @Post('/applications/:appKey/iam-roles/:roleId/enable')
  async enableRole(
    @Param('appKey') appKey: string,
    @Param('roleId') roleId: string,
    @Req() request: Request
  ): Promise<IamRoleResponse> {
    return this.writeWithAudit(
      request,
      { appKey, resourceType: 'iam_role', resourceId: roleId, action: 'set_status' },
      async (auditContext) => withAppKey(await this.iamRoles.setRoleStatus(appKey, roleId, activeStatus(), auditContext), appKey)
    );
  }

  @Post('/applications/:appKey/iam-roles/:roleId/disable')
  async disableRole(
    @Param('appKey') appKey: string,
    @Param('roleId') roleId: string,
    @Req() request: Request
  ): Promise<IamRoleResponse> {
    return this.writeWithAudit(
      request,
      { appKey, resourceType: 'iam_role', resourceId: roleId, action: 'set_status' },
      async (auditContext) => withAppKey(await this.iamRoles.setRoleStatus(appKey, roleId, disabledStatus(), auditContext), appKey)
    );
  }

  @Put('/applications/:appKey/iam-roles/:roleId/subjects')
  async replaceRoleSubjects(
    @Param('appKey') appKey: string,
    @Param('roleId') roleId: string,
    @Body() body: ReplaceRoleSubjectsBody,
    @Req() request: Request
  ): Promise<OkResponse> {
    await this.writeWithAudit(
      request,
      { appKey, resourceType: 'iam_role', resourceId: roleId, action: 'replace_subjects' },
      (auditContext) => this.iamRoles.replaceRoleSubjects(
        appKey,
        roleId,
        readRoleSubjectsBody(body, 'IAM_ROLE_SUBJECTS_INVALID', 'IAM 角色主体列表必须包含 type 和 id'),
        auditContext
      )
    );
    return { ok: true };
  }

  @Put('/applications/:appKey/iam-roles/:roleId/permission-groups')
  async replaceRolePermissionGroups(
    @Param('appKey') appKey: string,
    @Param('roleId') roleId: string,
    @Body() body: ReplaceRolePermissionGroupsBody,
    @Req() request: Request
  ): Promise<OkResponse> {
    await this.writeWithAudit(
      request,
      { appKey, resourceType: 'iam_role', resourceId: roleId, action: 'replace_permission_groups' },
      (auditContext) => this.iamRoles.replaceRolePermissionGroups(
        appKey,
        roleId,
        readStringArrayField(body, 'groupIds', 'PERMISSION_GROUP_IDS_INVALID', '权限组列表必须是非空字符串数组'),
        auditContext
      )
    );
    return { ok: true };
  }

  @Put('/applications/:appKey/iam-roles/:roleId/permission-points')
  async replaceRolePermissionPoints(
    @Param('appKey') appKey: string,
    @Param('roleId') roleId: string,
    @Body() body: ReplaceRolePermissionPointsBody,
    @Req() request: Request
  ): Promise<OkResponse> {
    await this.writeWithAudit(
      request,
      { appKey, resourceType: 'iam_role', resourceId: roleId, action: 'replace_permission_points' },
      (auditContext) => this.iamRoles.replaceRolePermissionPoints(
        appKey,
        roleId,
        readStringArrayField(body, 'pointIds', 'PERMISSION_POINT_IDS_INVALID', '权限点列表必须是非空字符串数组'),
        auditContext
      )
    );
    return { ok: true };
  }

  @Get('/applications/:appKey/users/:userId/permissions')
  async previewUserPermissions(
    @Param('appKey') appKey: string,
    @Param('userId') userId: string
  ): Promise<PermissionPreviewResponse> {
    const result = await this.permissions.calculate(appKey, userId);
    return {
      app_key: result.appKey,
      user_id: result.userId,
      permission_groups: result.permissionGroups,
      permission_points: result.permissionPoints,
      matched_roles: result.matchedRoles,
      computed_at: result.computedAt
    };
  }

  private async writeWithAudit<T>(
    request: Request,
    target: FailedAuditTarget,
    operation: (auditContext: PermissionAuditContext) => Promise<T>
  ): Promise<T> {
    const auditContext = buildAuditContext(request);
    try {
      return await operation(auditContext);
    } catch (error: unknown) {
      try {
        await this.recordFailedAudit(target, auditContext, error);
      } catch {
        // 失败审计是尽力记录，不能掩盖原始业务错误响应。
      }
      throw error;
    }
  }

  private async recordFailedAudit(
    target: FailedAuditTarget,
    auditContext: PermissionAuditContext,
    error: unknown
  ): Promise<void> {
    await this.audit.record({
      actorType: 'platform_token',
      actorId: 'platform-admin-token',
      source: 'platform_api',
      applicationId: await this.resolveApplicationId(target.appKey),
      resourceType: target.resourceType,
      resourceId: target.resourceId,
      action: target.action,
      after: {
        error: serializeAuditError(error)
      },
      result: 'failed',
      requestId: auditContext.requestId,
      ip: auditContext.ip,
      userAgent: auditContext.userAgent
    });
  }

  private async resolveApplicationId(appKey: string | undefined): Promise<string | null> {
    if (!appKey) {
      return null;
    }

    try {
      const application = await this.applications.getApplicationByKey(appKey);
      return application.id;
    } catch {
      return null;
    }
  }
}

function activeStatus(): EntityStatus {
  return 'active';
}

function disabledStatus(): EntityStatus {
  return 'disabled';
}

function buildAuditContext(request: Request): PermissionAuditContext {
  return {
    requestId: request.header('x-request-id') ?? randomUUID(),
    ip: request.ip ?? null,
    userAgent: request.header('user-agent') ?? null
  };
}

function serializeAuditError(error: unknown): Record<string, unknown> {
  if (error instanceof PermissionDomainError) {
    return {
      code: error.code,
      message: error.message,
      status: error.status
    };
  }

  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message
    };
  }

  return {
    message: 'Unknown error'
  };
}

function safeResourceId(value: unknown): string {
  return typeof value === 'string' && value.length > 0 ? value : 'unknown';
}

function withAppKey<T extends object>(role: T, appKey: string): T & { app_key: string } {
  return {
    ...role,
    app_key: appKey
  };
}

function readArrayField(
  body: unknown,
  field: string,
  code: string,
  message: string
): unknown[] {
  const value = isRecord(body) ? body[field] : undefined;
  if (!Array.isArray(value)) {
    throw new PermissionDomainError(code, message, 422);
  }
  return value;
}

function readStringArrayField(body: unknown, field: string, code: string, message: string): string[] {
  const values = readArrayField(body, field, code, message);
  if (!values.every(isNonEmptyString)) {
    throw new PermissionDomainError(code, message, 422);
  }
  return values;
}

function readOptionalStringArrayField(body: unknown, field: string, code: string, message: string): string[] {
  if (!isRecord(body) || !(field in body)) {
    return [];
  }
  return readStringArrayField(body, field, code, message);
}

function readRoleSubjectsBody(body: unknown, code: string, message: string): Array<{ type: IamSubjectType; id: string }> {
  if (isRecord(body) && 'subjects' in body) {
    return readRoleSubjects(body, 'subjects', code, message);
  }

  if (!isRecord(body) || (!('org_subjects' in body) && !('user_subjects' in body))) {
    throw new PermissionDomainError(code, message, 422);
  }

  const orgSubjects = readOptionalStringArrayField(body, 'org_subjects', code, message);
  const userSubjects = readOptionalStringArrayField(body, 'user_subjects', code, message);
  return [
    ...orgSubjects.map((id) => ({ type: 'feishu_department' as const, id })),
    ...userSubjects.map((id) => ({ type: 'feishu_user' as const, id }))
  ];
}

function readRoleSubjects(body: unknown, field: string, code: string, message: string): Array<{ type: IamSubjectType; id: string }> {
  const values = readArrayField(body, field, code, message);
  if (!values.every(isRoleSubjectInput)) {
    throw new PermissionDomainError(code, message, 422);
  }
  return values;
}

function isRoleSubjectInput(value: unknown): value is { type: IamSubjectType; id: string } {
  return (
    isRecord(value) &&
    (value.type === 'feishu_user' || value.type === 'feishu_department') &&
    typeof value.id === 'string' &&
    value.id.length > 0
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}
