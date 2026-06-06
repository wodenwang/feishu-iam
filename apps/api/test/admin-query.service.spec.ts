import { describe, expect, it, vi } from 'vitest';
import { AdminQueryService, redactSensitive } from '../src/admin/admin-query.service';
import type { AdminContext } from '../src/admin/admin.types';

type FindManyArgs = {
  where?: unknown;
  orderBy?: unknown;
  skip?: number;
  take?: number;
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
    auditLog: {
      findMany: vi.fn<(args: FindManyArgs) => Promise<unknown[]>>().mockResolvedValue([]),
      count: vi.fn<(args: { where?: unknown }) => Promise<number>>().mockResolvedValue(0)
    },
    securityEvent: {
      findMany: vi.fn<(args: FindManyArgs) => Promise<unknown[]>>().mockResolvedValue([]),
      count: vi.fn<(args: { where?: unknown }) => Promise<number>>().mockResolvedValue(0)
    }
  };
}

function lastFindManyWhere(mock: ReturnType<typeof makePrisma>['auditLog']['findMany']): unknown {
  return mock.mock.calls.at(-1)?.[0].where;
}

function lastSecurityEventWhere(mock: ReturnType<typeof makePrisma>['securityEvent']['findMany']): unknown {
  return mock.mock.calls.at(-1)?.[0].where;
}

function lastSecurityEventCountWhere(mock: ReturnType<typeof makePrisma>['securityEvent']['count']): unknown {
  return mock.mock.calls.at(-1)?.[0].where;
}

describe('AdminQueryService', () => {
  it('application_admin 查询 audit logs 时强制限制在授权应用范围', async () => {
    const prisma = makePrisma();
    const service = new AdminQueryService(prisma as never);

    await service.listAuditLogs(context(['application_admin'], ['app-finance']), {
      applicationId: 'app-hr',
      action: 'update'
    });

    expect(lastFindManyWhere(prisma.auditLog.findMany)).toMatchObject({
      applicationId: { in: [] },
      action: 'update'
    });
  });

  it('application_admin 查询 security events 时强制限制在授权应用范围', async () => {
    const prisma = makePrisma();
    const service = new AdminQueryService(prisma as never);

    await service.listSecurityEvents(context(['application_admin'], ['app-finance', 'app-hr']), {
      applicationId: 'app-hr',
      eventType: 'oauth_token',
      reasonCode: 'TOKEN_INVALID'
    });

    expect(lastSecurityEventWhere(prisma.securityEvent.findMany)).toMatchObject({
      applicationId: { in: ['app-hr'] },
      eventType: 'oauth_token',
      reasonCode: 'TOKEN_INVALID'
    });
  });

  it('security events 支持批量 eventTypes 数据库过滤并保持分页参数', async () => {
    const prisma = makePrisma();
    const service = new AdminQueryService(prisma as never);

    await service.listSecurityEvents(context(['audit_viewer']), {
      page: 3,
      pageSize: 10,
      eventType: 'ignored_single_type',
      eventTypes: ['oauth_token_invalid', 'admin_login_failed'],
      result: 'failed'
    });

    expect(lastSecurityEventWhere(prisma.securityEvent.findMany)).toMatchObject({
      eventType: { in: ['oauth_token_invalid', 'admin_login_failed'] },
      result: 'failed'
    });
    expect(prisma.securityEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 20,
        take: 10
      })
    );
    expect(lastSecurityEventCountWhere(prisma.securityEvent.count)).toMatchObject({
      eventType: { in: ['oauth_token_invalid', 'admin_login_failed'] }
    });
  });

  it('application_admin 查询未授权 applicationId 时返回空应用范围', async () => {
    const prisma = makePrisma();
    const service = new AdminQueryService(prisma as never);

    await service.listSecurityEvents(context(['application_admin'], ['app-finance']), {
      applicationId: 'app-hr'
    });

    expect(lastSecurityEventWhere(prisma.securityEvent.findMany)).toMatchObject({
      applicationId: { in: [] }
    });
  });

  it('platform_admin 和 audit_viewer 可查全局范围', async () => {
    const prisma = makePrisma();
    const service = new AdminQueryService(prisma as never);

    await service.listAuditLogs(context(['platform_admin']), { requestId: 'req-1' });
    await service.listSecurityEvents(context(['audit_viewer']), { result: 'failed' });

    expect(lastFindManyWhere(prisma.auditLog.findMany)).toEqual({ requestId: 'req-1' });
    expect(lastSecurityEventWhere(prisma.securityEvent.findMany)).toEqual({ result: 'failed' });
  });

  it('sync_admin 查询 audit logs 只允许飞书同步相关 resourceType', async () => {
    const prisma = makePrisma();
    const service = new AdminQueryService(prisma as never);

    await service.listAuditLogs(context(['sync_admin']), { resourceType: 'application' });

    expect(lastFindManyWhere(prisma.auditLog.findMany)).toMatchObject({
      resourceType: { in: [] }
    });
  });

  it('sync_admin 查询 security events 不能越权查看应用事件', async () => {
    const prisma = makePrisma();
    const service = new AdminQueryService(prisma as never);

    await service.listSecurityEvents(context(['sync_admin']), { eventType: 'oauth_token' });

    expect(lastSecurityEventWhere(prisma.securityEvent.findMany)).toMatchObject({
      applicationId: { in: [] }
    });
  });

  it('redactSensitive 递归脱敏敏感字段并兼容大小写、snake 和 camel', () => {
    expect(
      redactSensitive({
        secret: 's1',
        Token: 't1',
        cookie: 'c1',
        authorization: 'Bearer x',
        password: 'p1',
        client_secret: 'cs1',
        accessToken: 'at1',
        refresh_token: 'rt1',
        clientSecretHash: 'hash1',
        apiKey: 'api-key-1',
        private_key: 'private-key-1',
        credential: 'credential-1',
        credentials: 'credential-2',
        safe: 'visible',
        nested: [{ API_TOKEN: 'nested-token', name: '保留' }]
      })
    ).toEqual({
      secret: '[REDACTED]',
      Token: '[REDACTED]',
      cookie: '[REDACTED]',
      authorization: '[REDACTED]',
      password: '[REDACTED]',
      client_secret: '[REDACTED]',
      accessToken: '[REDACTED]',
      refresh_token: '[REDACTED]',
      clientSecretHash: '[REDACTED]',
      apiKey: '[REDACTED]',
      private_key: '[REDACTED]',
      credential: '[REDACTED]',
      credentials: '[REDACTED]',
      safe: 'visible',
      nested: [{ API_TOKEN: '[REDACTED]', name: '保留' }]
    });
  });

  it('redactSensitive 保留 Date 原值', () => {
    const createdAt = new Date('2026-05-17T01:02:03.000Z');

    expect(redactSensitive({ createdAt })).toEqual({ createdAt });
  });

  it('page/pageSize 稳定归一化', async () => {
    const prisma = makePrisma();
    const service = new AdminQueryService(prisma as never);

    const result = await service.listAuditLogs(context(['platform_admin']), {
      page: -10,
      pageSize: 999
    });

    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(100);
    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 0,
        take: 100
      })
    );
  });
});
