import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PlatformTokenGuard } from '../platform/platform-token.guard';
import { FEISHU_CLIENT } from './feishu-client';
import { FeishuController } from './feishu.controller';
import { FeishuDiagnosticsService } from './feishu-diagnostics.service';
import { FeishuErrorFilter } from './feishu-error.filter';
import { FeishuHttpClient } from './feishu-http.client';
import { FeishuMirrorQueryService } from './feishu-mirror-query.service';
import { FeishuStatusService } from './feishu-status.service';
import { FeishuSyncService } from './feishu-sync.service';

@Module({
  imports: [PrismaModule],
  controllers: [FeishuController],
  providers: [
    PlatformTokenGuard,
    FeishuErrorFilter,
    FeishuDiagnosticsService,
    FeishuMirrorQueryService,
    FeishuSyncService,
    FeishuStatusService,
    {
      provide: FEISHU_CLIENT,
      useClass: FeishuHttpClient
    }
  ],
  exports: [FEISHU_CLIENT, FeishuSyncService, FeishuStatusService, FeishuDiagnosticsService, FeishuMirrorQueryService]
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- NestJS module marker class.
export class FeishuModule {}
