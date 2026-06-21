import { Module } from '@nestjs/common';
import { FeishuModule } from '../feishu/feishu.module';
import { OauthModule } from '../oauth/oauth.module';
import { PermissionModule } from '../permission/permission.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminAuditController } from './admin-audit.controller';
import { AdminAuthFailureRecorder } from './admin-auth-failure-recorder';
import { AdminAuthController } from './admin-auth.controller';
import { AdminAuthService } from './admin-auth.service';
import { AdminErrorFilter } from './admin-error.filter';
import { AdminFeishuController } from './admin-feishu.controller';
import { AdminOauthConfigController } from './admin-oauth-config.controller';
import { AdminPermissionMatrixController } from './admin-permission-matrix.controller';
import { AdminPermissionMatrixService } from './admin-permission-matrix.service';
import { AdminPermissionController } from './admin-permission.controller';
import { AdminPermissionService } from './admin-permission.service';
import { AdminQueryService } from './admin-query.service';
import { AdminSessionGuard } from './admin-session.guard';
import { AdminTraceService } from './admin-trace.service';
import { AdminUserController } from './admin-user.controller';
import { AdminUserService } from './admin-user.service';

@Module({
  imports: [PrismaModule, PermissionModule, OauthModule, FeishuModule],
  controllers: [
    AdminAuthController,
    AdminUserController,
    AdminPermissionController,
    AdminPermissionMatrixController,
    AdminOauthConfigController,
    AdminFeishuController,
    AdminAuditController
  ],
  providers: [
    AdminPermissionService,
    AdminPermissionMatrixService,
    AdminUserService,
    AdminAuthService,
    AdminAuthFailureRecorder,
    AdminErrorFilter,
    AdminQueryService,
    AdminTraceService,
    AdminSessionGuard
  ],
  exports: [
    AdminPermissionService,
    AdminUserService,
    AdminAuthService,
    AdminAuthFailureRecorder,
    AdminErrorFilter,
    AdminQueryService,
    AdminTraceService,
    AdminSessionGuard
  ]
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- NestJS module marker class.
export class AdminModule {}
