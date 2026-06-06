import { Body, Controller, Get, Inject, Param, Patch, Post, Req, UseFilters, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AdminErrorFilter } from './admin-error.filter';
import { AdminPermissionService } from './admin-permission.service';
import { getAdminRequestId, readAdminContext } from './admin-request-context';
import { AdminSessionGuard } from './admin-session.guard';
import {
  AdminUserService,
  type CreateAdminUserInput,
  type UpdateAdminUserAuthorizationInput
} from './admin-user.service';
import { AdminDomainError, type AdminAuditContext, type AdminContext } from './admin.types';

type CreateAdminUserBody = Partial<CreateAdminUserInput>;
type ReplaceApplicationScopesBody = {
  applicationIds?: string[];
};
type UpdateAdminUserAuthorizationBody = Partial<UpdateAdminUserAuthorizationInput>;

@Controller('/api/v1/admin/admin-users')
@UseGuards(AdminSessionGuard)
@UseFilters(AdminErrorFilter)
export class AdminUserController {
  constructor(
    @Inject(AdminPermissionService) private readonly permission: AdminPermissionService,
    @Inject(AdminUserService) private readonly adminUsers: AdminUserService
  ) {}

  @Post()
  async create(@Body() body: unknown, @Req() request: Request): Promise<unknown> {
    const context = readRequiredAdminContext(request);
    this.permission.assertCanManageAdmins(context);
    const input = readCreateAdminUserBody(body, request);

    return this.adminUsers.createAdminUser(
      ({
        feishuUserId: input.feishuUserId,
        roleKeys: input.roleKeys,
        applicationIds: input.applicationIds ?? []
      } as CreateAdminUserInput),
      buildAdminUserAuditContext(request, context)
    );
  }

  @Get()
  async list(@Req() request: Request): Promise<{
    items: Awaited<ReturnType<AdminUserService['listAdminUsers']>>;
    total: number;
    page: 1;
    pageSize: number;
  }> {
    const context = readRequiredAdminContext(request);
    this.permission.assertCanManageAdmins(context);
    const items = await this.adminUsers.listAdminUsers();

    return {
      items,
      total: items.length,
      page: 1,
      pageSize: items.length
    };
  }

  @Patch('/:adminUserId/scopes')
  async replaceApplicationScopes(
    @Param('adminUserId') adminUserId: string,
    @Body() body: unknown,
    @Req() request: Request
  ): Promise<Awaited<ReturnType<AdminUserService['replaceApplicationScopes']>>> {
    const context = readRequiredAdminContext(request);
    this.permission.assertCanManageAdmins(context);
    const input = readReplaceApplicationScopesBody(body, request);
    return this.adminUsers.replaceApplicationScopes(
      adminUserId,
      input.applicationIds ?? [],
      buildAdminUserAuditContext(request, context)
    );
  }

  @Patch('/:adminUserId/authorization')
  async replaceAuthorization(
    @Param('adminUserId') adminUserId: string,
    @Body() body: unknown,
    @Req() request: Request
  ): Promise<Awaited<ReturnType<AdminUserService['replaceAuthorization']>>> {
    const context = readRequiredAdminContext(request);
    this.permission.assertCanManageAdmins(context);
    const input = readUpdateAdminUserAuthorizationBody(body, request);
    return this.adminUsers.replaceAuthorization(
      adminUserId,
      {
        roleKeys: input.roleKeys ?? [],
        applicationIds: input.applicationIds ?? []
      },
      buildAdminUserAuditContext(request, context)
    );
  }

  @Post('/:adminUserId/enable')
  async enableAdminUser(
    @Param('adminUserId') adminUserId: string,
    @Req() request: Request
  ): Promise<Awaited<ReturnType<AdminUserService['setAdminUserStatus']>>> {
    return this.setAdminUserStatus(adminUserId, 'active', request);
  }

  @Post('/:adminUserId/disable')
  async disableAdminUser(
    @Param('adminUserId') adminUserId: string,
    @Req() request: Request
  ): Promise<Awaited<ReturnType<AdminUserService['setAdminUserStatus']>>> {
    return this.setAdminUserStatus(adminUserId, 'disabled', request);
  }

  private setAdminUserStatus(
    adminUserId: string,
    status: 'active' | 'disabled',
    request: Request
  ): Promise<Awaited<ReturnType<AdminUserService['setAdminUserStatus']>>> {
    const context = readRequiredAdminContext(request);
    this.permission.assertCanManageAdmins(context);
    return this.adminUsers.setAdminUserStatus(adminUserId, status, buildAdminUserAuditContext(request, context));
  }
}

function readRequiredAdminContext(request: Request): AdminContext {
  const context = readAdminContext(request);

  if (!context) {
    throw new AdminDomainError('ADMIN_SESSION_REQUIRED', '需要登录 Feishu IAM 管理后台', 401);
  }

  return context;
}

function buildAdminUserAuditContext(request: Request, context: AdminContext): AdminAuditContext {
  return {
    actorType: 'admin_user',
    actorId: context.adminUserId,
    source: 'admin_web',
    requestId: getAdminRequestId(request),
    ip: request.ip ?? null,
    userAgent: request.header('user-agent') ?? null
  };
}

function readCreateAdminUserBody(body: unknown, request: Request): CreateAdminUserBody {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new AdminDomainError('ADMIN_REQUEST_INVALID', '管理员请求体不合法', 422);
  }

  if (Object.keys(body).length === 0 && !request.is('application/json')) {
    throw new AdminDomainError('ADMIN_REQUEST_INVALID', '管理员请求体不合法', 422);
  }

  return body;
}

function readReplaceApplicationScopesBody(body: unknown, request: Request): ReplaceApplicationScopesBody {
  const input = readCreateAdminUserBody(body, request);

  if (input.applicationIds !== undefined && !Array.isArray(input.applicationIds)) {
    throw new AdminDomainError('ADMIN_APPLICATION_SCOPE_INVALID', '应用授权范围不合法', 422);
  }

  return input;
}

function readUpdateAdminUserAuthorizationBody(body: unknown, request: Request): UpdateAdminUserAuthorizationBody {
  const input = readCreateAdminUserBody(body, request);

  if (input.roleKeys !== undefined && !Array.isArray(input.roleKeys)) {
    throw new AdminDomainError('ADMIN_ROLE_INVALID', '管理员角色不合法', 422);
  }
  if (input.applicationIds !== undefined && !Array.isArray(input.applicationIds)) {
    throw new AdminDomainError('ADMIN_APPLICATION_SCOPE_INVALID', '应用授权范围不合法', 422);
  }

  return input;
}
