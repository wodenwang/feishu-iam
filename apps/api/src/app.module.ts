import { Module } from '@nestjs/common';
import { AcceptanceModule } from './acceptance/acceptance.module';
import { AdminModule } from './admin/admin.module';
import { AdminWebModule } from './admin-web/admin-web.module';
import { FeishuModule } from './feishu/feishu.module';
import { HealthController } from './health/health.controller';
import { OauthModule } from './oauth/oauth.module';
import { PermissionModule } from './permission/permission.module';
import { PrismaModule } from './prisma/prisma.module';
import { VersionController } from './version/version.controller';

@Module({
  imports: [PrismaModule, FeishuModule, PermissionModule, OauthModule, AdminModule, AdminWebModule, AcceptanceModule],
  controllers: [HealthController, VersionController]
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- NestJS module marker class.
export class AppModule {}
