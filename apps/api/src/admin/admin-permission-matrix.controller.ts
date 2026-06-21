import { Controller, Get, Inject, Query, Req, UseFilters, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { PermissionErrorFilter } from '../permission/permission-error.filter';
import { PermissionDomainError } from '../permission/permission.types';
import { AdminErrorFilter } from './admin-error.filter';
import { AdminPermissionMatrixService, type PermissionMatrixSubjectType } from './admin-permission-matrix.service';
import { AdminPermissionService } from './admin-permission.service';
import { readAdminContext } from './admin-request-context';
import { AdminSessionGuard } from './admin-session.guard';
import { AdminDomainError } from './admin.types';

@Controller('/api/v1/admin/permission-matrix')
@UseGuards(AdminSessionGuard)
@UseFilters(AdminErrorFilter, PermissionErrorFilter)
export class AdminPermissionMatrixController {
  constructor(
    @Inject(AdminPermissionMatrixService)
    private readonly matrix: AdminPermissionMatrixService,
    @Inject(AdminPermissionService)
    private readonly permission: AdminPermissionService
  ) {}

  @Get()
  async query(
    @Query('subjectType') subjectType: unknown,
    @Query('subjectId') subjectId: unknown,
    @Req() request: Request
  ) {
    const context = readAdminContext(request);
    if (!context) {
      throw new AdminDomainError('ADMIN_SESSION_REQUIRED', '需要登录 Feishu IAM 管理后台', 401);
    }
    this.permission.assertCanManageGlobalIamRoles(context);
    return this.matrix.query(readSubjectType(subjectType), readSubjectId(subjectId));
  }
}

function readSubjectType(value: unknown): PermissionMatrixSubjectType {
  if (value === 'user' || value === 'department') {
    return value;
  }
  throw new PermissionDomainError('PERMISSION_MATRIX_QUERY_INVALID', '权限矩阵查询参数不合法', 400);
}

function readSubjectId(value: unknown): string {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }
  throw new PermissionDomainError('PERMISSION_MATRIX_QUERY_INVALID', '权限矩阵查询参数不合法', 400);
}
