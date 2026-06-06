import { Module } from '@nestjs/common';
import { PlatformTokenGuard } from '../platform/platform-token.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { ApplicationService } from './application.service';
import { AuditLogService } from './audit-log.service';
import { IamRoleService } from './iam-role.service';
import { PermissionCalculationService } from './permission-calculation.service';
import { PermissionCatalogService } from './permission-catalog.service';
import { PermissionController } from './permission.controller';

@Module({
  imports: [PrismaModule],
  controllers: [PermissionController],
  providers: [
    PlatformTokenGuard,
    AuditLogService,
    ApplicationService,
    PermissionCatalogService,
    IamRoleService,
    PermissionCalculationService
  ],
  exports: [ApplicationService, PermissionCatalogService, IamRoleService, PermissionCalculationService, AuditLogService]
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- NestJS module marker class.
export class PermissionModule {}
