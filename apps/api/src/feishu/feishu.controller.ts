import {
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  Post,
  UseFilters,
  UseGuards
} from '@nestjs/common';
import { PlatformTokenGuard } from '../platform/platform-token.guard';
import { FeishuDiagnosticsService } from './feishu-diagnostics.service';
import { FeishuErrorFilter } from './feishu-error.filter';
import { FeishuStatusService, sanitizeFeishuStatus, sanitizeFeishuSyncRun } from './feishu-status.service';
import { FeishuSyncService, type SyncResult } from './feishu-sync.service';

@Controller('/api/v1/platform/feishu')
@UseGuards(PlatformTokenGuard)
@UseFilters(FeishuErrorFilter)
export class FeishuController {
  constructor(
    @Inject(FeishuSyncService)
    private readonly syncService: FeishuSyncService,
    @Inject(FeishuStatusService)
    private readonly statusService: FeishuStatusService,
    @Inject(FeishuDiagnosticsService)
    private readonly diagnosticsService: FeishuDiagnosticsService
  ) {}

  @Post('/sync-runs')
  async createSyncRun(): Promise<SyncResult> {
    return this.syncService.runFullSync({
      triggeredBy: 'platform-admin-token',
      triggerSource: 'platform_api'
    });
  }

  @Get('/sync-runs')
  async listSyncRuns(): Promise<{ items: Awaited<ReturnType<FeishuStatusService['listRuns']>> }> {
    const runs = await this.statusService.listRuns();
    return { items: runs.map(sanitizeFeishuSyncRun) };
  }

  @Get('/sync-runs/:id')
  async getSyncRun(
    @Param('id') id: string
  ): Promise<NonNullable<Awaited<ReturnType<FeishuStatusService['getRun']>>>> {
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

  @Get('/status')
  async getStatus(): Promise<Awaited<ReturnType<FeishuStatusService['getStatus']>>> {
    return sanitizeFeishuStatus(await this.statusService.getStatus());
  }

  @Get('/field-diagnostics')
  async getFieldDiagnostics(): Promise<
    Awaited<ReturnType<FeishuDiagnosticsService['getFieldDiagnostics']>>
  > {
    return this.diagnosticsService.getFieldDiagnostics();
  }
}
