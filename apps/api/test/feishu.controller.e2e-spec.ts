import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App as SupertestApp } from 'supertest/types';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../src/app.module';
import { FeishuDiagnosticsService } from '../src/feishu/feishu-diagnostics.service';
import { FeishuStatusService } from '../src/feishu/feishu-status.service';
import { FeishuSyncService, type SyncResult } from '../src/feishu/feishu-sync.service';
import { FeishuClientError } from '../src/feishu/feishu.types';
import { PrismaService } from '../src/prisma/prisma.service';

type SyncRunFixture = {
  id: string;
  status: 'running' | 'success' | 'failed';
  startedAt: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getField(body: unknown, field: string): unknown {
  return isRecord(body) ? body[field] : undefined;
}

function getErrorCode(body: unknown): unknown {
  const error = getField(body, 'error');
  return isRecord(error) ? error.code : undefined;
}

function getErrorRequestId(body: unknown): unknown {
  const error = getField(body, 'error');
  return isRecord(error) ? error.request_id : undefined;
}

function getItems(body: unknown): unknown[] {
  const items = getField(body, 'items');
  return Array.isArray(items) ? items : [];
}

describe('飞书平台 API', () => {
  let app: INestApplication;
  let originalPlatformAdminToken: string | undefined;

  const syncService = {
    runFullSync: vi.fn<FeishuSyncService['runFullSync']>()
  };
  const statusService = {
    getStatus: vi.fn<FeishuStatusService['getStatus']>(),
    listRuns: vi.fn<FeishuStatusService['listRuns']>(),
    getRun: vi.fn<FeishuStatusService['getRun']>()
  };
  const diagnosticsService = {
    getFieldDiagnostics: vi.fn<FeishuDiagnosticsService['getFieldDiagnostics']>()
  };

  beforeAll(async () => {
    originalPlatformAdminToken = process.env.PLATFORM_ADMIN_TOKEN;
    process.env.PLATFORM_ADMIN_TOKEN = 'test-token';

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule]
    })
      .overrideProvider(PrismaService)
      .useValue({
        isReady: vi.fn().mockResolvedValue(true),
        $connect: vi.fn(),
        $disconnect: vi.fn()
      })
      .overrideProvider(FeishuSyncService)
      .useValue(syncService)
      .overrideProvider(FeishuStatusService)
      .useValue(statusService)
      .overrideProvider(FeishuDiagnosticsService)
      .useValue(diagnosticsService)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.PLATFORM_ADMIN_TOKEN = 'test-token';
  });

  afterAll(async () => {
    await app.close();
    if (originalPlatformAdminToken === undefined) {
      delete process.env.PLATFORM_ADMIN_TOKEN;
    } else {
      process.env.PLATFORM_ADMIN_TOKEN = originalPlatformAdminToken;
    }
  });

  it('拒绝未携带平台 token 的请求', async () => {
    const httpServer = app.getHttpServer() as SupertestApp;

    await request(httpServer)
      .get('/api/v1/platform/feishu/status')
      .expect(401)
      .expect((response) => {
        expect(getErrorCode(response.body as unknown)).toBe('PLATFORM_TOKEN_INVALID');
      });
  });

  it('拒绝错误平台 token', async () => {
    const httpServer = app.getHttpServer() as SupertestApp;

    await request(httpServer)
      .get('/api/v1/platform/feishu/status')
      .set('Authorization', 'Bearer wrong-token')
      .expect(401)
      .expect((response) => {
        expect(getErrorCode(response.body as unknown)).toBe('PLATFORM_TOKEN_INVALID');
      });
  });

  it('平台 token 未配置时返回稳定错误码', async () => {
    process.env.PLATFORM_ADMIN_TOKEN = '';
    const httpServer = app.getHttpServer() as SupertestApp;

    await request(httpServer)
      .get('/api/v1/platform/feishu/status')
      .set('Authorization', 'Bearer test-token')
      .expect(401)
      .expect((response) => {
        expect(getErrorCode(response.body as unknown)).toBe('PLATFORM_TOKEN_NOT_CONFIGURED');
      });
  });

  it('占位平台 token 视为未配置', async () => {
    process.env.PLATFORM_ADMIN_TOKEN = 'replace-with-local-admin-token';
    const httpServer = app.getHttpServer() as SupertestApp;

    await request(httpServer)
      .get('/api/v1/platform/feishu/status')
      .set('Authorization', 'Bearer replace-with-local-admin-token')
      .expect(401)
      .expect((response) => {
        expect(getErrorCode(response.body as unknown)).toBe('PLATFORM_TOKEN_NOT_CONFIGURED');
      });
  });

  it('返回飞书同步状态', async () => {
    statusService.getStatus.mockResolvedValue({
      configStatus: 'configured',
      running: false,
      latestRun: null,
      counts: {
        departments: 0,
        activeDepartments: 0,
        users: 0,
        activeUsers: 0,
        relations: 0
      }
    });

    const httpServer = app.getHttpServer() as SupertestApp;
    await request(httpServer)
      .get('/api/v1/platform/feishu/status')
      .set('Authorization', 'Bearer test-token')
      .expect(200)
      .expect((response) => {
        const body = response.body as unknown;
        expect(getField(body, 'configStatus')).toBe('configured');
        expect(getField(body, 'running')).toBe(false);
      });
  });

  it('返回飞书字段诊断结果', async () => {
    diagnosticsService.getFieldDiagnostics.mockResolvedValue({
      status: 'passed',
      loginReadiness: { ready: true, reason: '字段满足后续 SSO 准备要求' },
      sampleCounts: { departments: 1, users: 1, activeUsers: 1 },
      departmentFields: [],
      userFields: [],
      blockingIssues: [],
      warnings: [],
      nextActions: ['字段完整性满足 v0.2.x 身份镜像发布门槛，可以执行真实同步验收']
    });

    const httpServer = app.getHttpServer() as SupertestApp;
    await request(httpServer)
      .get('/api/v1/platform/feishu/field-diagnostics')
      .set('Authorization', 'Bearer test-token')
      .expect(200)
      .expect((response) => {
        const body = response.body as unknown;
        expect(getField(body, 'status')).toBe('passed');
        expect(getField(body, 'sampleCounts')).toEqual({
          departments: 1,
          users: 1,
          activeUsers: 1
        });
      });
  });

  it('触发手动同步', async () => {
    const syncResult: SyncResult = {
      id: 'run-1',
      status: 'success',
      departmentCreatedCount: 1,
      departmentUpdatedCount: 0,
      departmentDeletedCount: 0,
      userCreatedCount: 1,
      userUpdatedCount: 0,
      userDeletedCount: 0,
      relationCreatedCount: 1,
      relationUpdatedCount: 0,
      relationDeletedCount: 0
    };
    syncService.runFullSync.mockResolvedValue(syncResult);

    const httpServer = app.getHttpServer() as SupertestApp;
    await request(httpServer)
      .post('/api/v1/platform/feishu/sync-runs')
      .set('Authorization', 'Bearer test-token')
      .expect(201)
      .expect((response) => {
        expect(getField(response.body as unknown, 'id')).toBe('run-1');
      });

    expect(syncService.runFullSync).toHaveBeenCalledWith({
      triggeredBy: 'platform-admin-token',
      triggerSource: 'platform_api'
    });
  });

  it('列出同步记录', async () => {
    statusService.listRuns.mockResolvedValue([
      { id: 'run-1', status: 'success', startedAt: new Date('2026-05-15T08:00:00.000Z') }
    ] as never);

    const httpServer = app.getHttpServer() as SupertestApp;
    await request(httpServer)
      .get('/api/v1/platform/feishu/sync-runs')
      .set('Authorization', 'Bearer test-token')
      .expect(200)
      .expect((response) => {
        const items = getItems(response.body as unknown) as SyncRunFixture[];
        expect(items[0]?.id).toBe('run-1');
      });
  });

  it('返回单条同步记录', async () => {
    statusService.getRun.mockResolvedValue({
      id: 'run-1',
      status: 'success',
      startedAt: new Date('2026-05-15T08:00:00.000Z')
    } as never);

    const httpServer = app.getHttpServer() as SupertestApp;
    await request(httpServer)
      .get('/api/v1/platform/feishu/sync-runs/run-1')
      .set('Authorization', 'Bearer test-token')
      .expect(200)
      .expect((response) => {
        expect(getField(response.body as unknown, 'id')).toBe('run-1');
      });
  });

  it('同步记录不存在时返回稳定错误码', async () => {
    statusService.getRun.mockResolvedValue(null);

    const httpServer = app.getHttpServer() as SupertestApp;
    await request(httpServer)
      .get('/api/v1/platform/feishu/sync-runs/missing-run')
      .set('Authorization', 'Bearer test-token')
      .expect(404)
      .expect((response) => {
        expect(getErrorCode(response.body as unknown)).toBe('FEISHU_SYNC_RUN_NOT_FOUND');
      });
  });

  it('同步运行中时返回稳定错误码', async () => {
    syncService.runFullSync.mockRejectedValue(
      new FeishuClientError('FEISHU_API_ERROR', '已有飞书同步正在运行', {
        error_code: 'FEISHU_SYNC_ALREADY_RUNNING',
        request_id: 'req-1'
      })
    );

    const httpServer = app.getHttpServer() as SupertestApp;
    await request(httpServer)
      .post('/api/v1/platform/feishu/sync-runs')
      .set('Authorization', 'Bearer test-token')
      .expect(409)
      .expect((response) => {
        const body = response.body as unknown;
        expect(getErrorCode(body)).toBe('FEISHU_SYNC_ALREADY_RUNNING');
        expect(getErrorRequestId(body)).toBe('req-1');
      });
  });
});
