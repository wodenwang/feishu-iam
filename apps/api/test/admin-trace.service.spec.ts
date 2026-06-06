import { describe, expect, it, vi } from 'vitest';
import { AdminTraceService } from '../src/admin/admin-trace.service';
import { AdminDomainError, type AdminContext } from '../src/admin/admin.types';

type FindManyArgs = {
  where?: unknown;
  orderBy?: unknown;
  take?: number;
  select?: unknown;
};

function context(roles: AdminContext['roles'], applicationIds: string[] = []): AdminContext {
  return {
    adminUserId: 'admin-1',
    feishuUserId: 'ou_admin',
    displayName: '管理员',
    roles,
    applicationIds
  };
}

function makePrisma() {
  return {
    application: {
      findFirst: vi.fn().mockResolvedValue({ id: 'app-finance', appKey: 'finance', name: '财务系统' })
    },
    auditLog: {
      findMany: vi.fn<(args: FindManyArgs) => Promise<unknown[]>>().mockResolvedValue([
        {
          id: 'audit-1',
          requestId: 'req-1',
          applicationId: 'app-finance',
          action: 'update',
          resourceType: 'application_client',
          resourceId: 'client-finance',
          result: 'success',
          createdAt: new Date('2026-05-29T01:00:00.000Z'),
          before: null,
          after: { clientSecret: 'hidden', nested: { rawPayload: { token: 'raw-token' } } },
          actorType: 'admin_user',
          actorId: 'admin-1',
          source: 'admin_web',
          ip: '127.0.0.1',
          userAgent: 'vitest'
        }
      ])
    },
    securityEvent: {
      findMany: vi.fn<(args: FindManyArgs) => Promise<unknown[]>>().mockResolvedValue([
        {
          id: 'sec-1',
          requestId: 'req-1',
          applicationId: 'app-finance',
          clientId: 'client-finance',
          feishuUserId: 'ou_user',
          eventType: 'oauth_token_exchange',
          result: 'success',
          reasonCode: null,
          summary: '授权码换取 access token 成功',
          createdAt: new Date('2026-05-29T01:01:00.000Z'),
          ip: '127.0.0.1',
          userAgent: 'vitest',
          details: {
            accessToken: 'at-1',
            authorization: 'Bearer should-not-leak',
            authorizationCode: 'biac_should_not_leak',
            stateHash: 'state-hash-1',
            tokenHash: 'token-hash-1'
          }
        }
      ])
    },
    feishuSyncRun: {
      findMany: vi.fn<(args: FindManyArgs) => Promise<unknown[]>>().mockResolvedValue([
        {
          id: 'sync-1',
          requestId: 'req-1',
          status: 'success',
          triggerSource: 'admin_web',
          triggeredBy: 'admin-1',
          startedAt: new Date('2026-05-29T00:59:00.000Z'),
          finishedAt: new Date('2026-05-29T01:00:30.000Z'),
          errorCode: null,
          errorMessage: null,
          errorDetail: { cookie: 'cookie-1' }
        }
      ])
    },
    oauthAccessToken: {
      findMany: vi.fn<(args: FindManyArgs) => Promise<unknown[]>>().mockResolvedValue([])
    }
  };
}

function lastWhere(mock: { mock: { calls: Array<[FindManyArgs]> } }): unknown {
  return mock.mock.calls.at(-1)?.[0].where;
}

describe('AdminTraceService', () => {
  it('按 request id 聚合审计、安全事件和同步 run，并按时间排序', async () => {
    const service = new AdminTraceService(makePrisma() as never);

    const result = await service.getTrace(context(['platform_admin']), { requestId: 'req-1' });

    expect(result.summary.status).toBe('complete');
    expect(result.context.requestId).toBe('req-1');
    expect(result.timeline.map((item) => item.source)).toEqual(['feishu_sync_run', 'audit_log', 'security_event']);
    expect(result.coverage).toEqual({ auditLogs: 1, securityEvents: 1, feishuSyncRuns: 1, oauthContexts: 0 });
    expect(JSON.stringify(result)).not.toContain('hidden');
    expect(JSON.stringify(result)).not.toContain('raw-token');
    expect(JSON.stringify(result)).not.toContain('state-hash-1');
    expect(JSON.stringify(result)).not.toContain('Bearer should-not-leak');
    expect(JSON.stringify(result)).not.toContain('biac_should_not_leak');
    expect(JSON.stringify(result)).not.toContain('token-hash-1');
    expect(JSON.stringify(result)).toContain('[REDACTED]');
  });

  it('带 request id 时不裁剪时间窗口，且缺少后续 OAuth 阶段时返回 partial', async () => {
    const prisma = makePrisma();
    prisma.auditLog.findMany.mockResolvedValue([]);
    prisma.feishuSyncRun.findMany.mockResolvedValue([]);
    prisma.oauthAccessToken.findMany.mockResolvedValue([]);
    prisma.securityEvent.findMany.mockResolvedValue([
      {
        id: 'sec-authorize',
        requestId: 'req-old',
        applicationId: 'app-finance',
        clientId: 'client-finance',
        feishuUserId: 'ou_user',
        eventType: 'oauth_authorize',
        result: 'success',
        reasonCode: null,
        summary: 'authorize 成功',
        createdAt: new Date('2026-05-29T01:00:00.000Z'),
        ip: '127.0.0.1',
        userAgent: 'vitest'
      }
    ]);
    const service = new AdminTraceService(prisma as never);

    const result = await service.getTrace(context(['platform_admin']), {
      requestId: 'req-old',
      from: '2026-01-01T00:00:00.000Z',
      to: '2026-05-29T00:00:00.000Z'
    });

    expect(result.context.timeWindow.from).toBe('2026-01-01T00:00:00.000Z');
    expect(result.summary.status).toBe('partial');
    expect(result.summary.missingStages).toEqual(['token_exchange', 'userinfo', 'permission_query']);
    expect(result.coverage).toEqual({ auditLogs: 0, securityEvents: 1, feishuSyncRuns: 0, oauthContexts: 0 });
  });

  it('把后台认证失败安全事件映射为 admin_auth 阶段', async () => {
    const prisma = makePrisma();
    prisma.auditLog.findMany.mockResolvedValue([]);
    prisma.feishuSyncRun.findMany.mockResolvedValue([]);
    prisma.oauthAccessToken.findMany.mockResolvedValue([]);
    prisma.securityEvent.findMany.mockResolvedValue([
      {
        id: 'sec-admin-auth-1',
        eventType: 'admin_auth_failure',
        result: 'failed',
        reasonCode: 'ADMIN_SESSION_REQUIRED',
        summary: '后台访问缺少有效登录态',
        requestId: 'req-admin-401',
        applicationId: null,
        clientId: null,
        feishuUserId: null,
        ip: '127.0.0.1',
        userAgent: 'vitest',
        createdAt: new Date('2026-05-29T08:00:00.000Z'),
        details: {
          cookie: 'should-not-leak',
          authorization: 'Bearer should-not-leak',
          rawPayload: { token: 'should-not-leak' },
          secret: 'should-not-leak'
        }
      }
    ]);
    const service = new AdminTraceService(prisma as never);

    const result = await service.getTrace(context(['platform_admin']), { requestId: 'req-admin-401' });

    expect(result.summary.status).toBe('complete');
    expect(result.summary.missingStages).toEqual([]);
    expect(result.summary.diagnosis).toContain('reasonCode=ADMIN_SESSION_REQUIRED');
    expect(result.summary.nextActions).toContain('让用户重新登录 Feishu IAM 管理后台');
    expect(result.timeline[0]).toMatchObject({
      source: 'security_event',
      stage: 'admin_auth',
      title: '后台认证/授权失败',
      requestId: 'req-admin-401'
    });
    expect(JSON.stringify(result.timeline[0]?.details)).not.toMatch(
      /cookie|authorization|token|rawPayload|secret|should-not-leak/i
    );
  });

  it('没有命中时返回 empty 摘要和默认 24 小时时间窗口', async () => {
    const prisma = makePrisma();
    prisma.application.findFirst.mockResolvedValue(null);
    prisma.auditLog.findMany.mockResolvedValue([]);
    prisma.securityEvent.findMany.mockResolvedValue([]);
    prisma.feishuSyncRun.findMany.mockResolvedValue([]);
    prisma.oauthAccessToken.findMany.mockResolvedValue([]);
    const service = new AdminTraceService(prisma as never);

    const result = await service.getTrace(context(['audit_viewer']), {
      clientId: 'client-missing',
      to: '2026-05-29T12:00:00.000Z'
    });

    expect(result.summary.status).toBe('empty');
    expect(result.timeline).toEqual([]);
    expect(result.context.timeWindow).toEqual({
      from: '2026-05-28T12:00:00.000Z',
      to: '2026-05-29T12:00:00.000Z'
    });
  });

  it('显式时间窗口最多裁剪为 30 天', async () => {
    const prisma = makePrisma();
    prisma.auditLog.findMany.mockResolvedValue([]);
    prisma.securityEvent.findMany.mockResolvedValue([]);
    prisma.feishuSyncRun.findMany.mockResolvedValue([]);
    prisma.oauthAccessToken.findMany.mockResolvedValue([]);
    const service = new AdminTraceService(prisma as never);

    const result = await service.getTrace(context(['platform_admin']), {
      from: '2026-04-01T00:00:00.000Z',
      to: '2026-05-29T00:00:00.000Z'
    });

    expect(result.context.timeWindow.from).toBe('2026-04-29T00:00:00.000Z');
  });

  it('application_admin 只能看到授权应用事件，未授权应用不泄露存在性', async () => {
    const prisma = makePrisma();
    prisma.application.findFirst.mockResolvedValue({ id: 'app-hr', appKey: 'hr', name: '人事系统' });
    const service = new AdminTraceService(prisma as never);

    const result = await service.getTrace(context(['application_admin'], ['app-finance']), { applicationId: 'app-hr' });

    expect(result.context.application).toBeNull();
    expect(lastWhere(prisma.securityEvent.findMany)).toMatchObject({ applicationId: { in: [] } });
    expect(lastWhere(prisma.auditLog.findMany)).toMatchObject({ applicationId: { in: [] } });
    expect(lastWhere(prisma.oauthAccessToken.findMany)).toMatchObject({ applicationId: { in: [] } });
  });

  it('sync_admin 只读取同步类来源，不读取应用 OAuth 上下文', async () => {
    const prisma = makePrisma();
    const service = new AdminTraceService(prisma as never);

    await service.getTrace(context(['sync_admin']), { requestId: 'req-sync' });

    expect(lastWhere(prisma.auditLog.findMany)).toMatchObject({
      requestId: 'req-sync',
      resourceType: { in: ['feishu_sync', 'feishu_sync_run', 'feishu_department', 'feishu_user', 'feishu_user_department'] }
    });
    expect(lastWhere(prisma.securityEvent.findMany)).toMatchObject({ applicationId: { in: [] } });
    expect(lastWhere(prisma.feishuSyncRun.findMany)).toMatchObject({ requestId: 'req-sync' });
    expect(prisma.oauthAccessToken.findMany).not.toHaveBeenCalled();
  });

  it('无审计权限时抛出 403', async () => {
    const service = new AdminTraceService(makePrisma() as never);

    await expect(service.getTrace(context([]), { requestId: 'req-1' })).rejects.toMatchObject(
      new AdminDomainError('ADMIN_PERMISSION_DENIED', '当前管理员无权查看追踪数据', 403)
    );
  });

  it('同时支持 appKey 解析并按应用过滤查询', async () => {
    const prisma = makePrisma();
    const service = new AdminTraceService(prisma as never);

    await service.getTrace(context(['platform_admin']), { appKey: 'finance', result: 'failed' });

    expect(prisma.application.findFirst).toHaveBeenCalledWith({
      where: { appKey: 'finance' },
      select: { id: true, appKey: true, name: true }
    });
    expect(lastWhere(prisma.securityEvent.findMany)).toMatchObject({
      applicationId: 'app-finance',
      result: 'failed'
    });
  });
});
