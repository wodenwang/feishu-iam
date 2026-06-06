import { Logger, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App as SupertestApp } from 'supertest/types';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../src/app.module';
import { hashOauthSecret } from '../src/oauth/oauth-crypto';
import { SecurityEventService } from '../src/oauth/security-event.service';
import { PermissionCalculationService } from '../src/permission/permission-calculation.service';
import { PermissionDomainError } from '../src/permission/permission.types';
import { PrismaService } from '../src/prisma/prisma.service';

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

function buildTokenRow(appKey = 'finance', environmentId: string | null = 'env-dev') {
  return {
    applicationId: `app-${appKey}`,
    environmentId,
    clientId: `bic_${appKey}_dev`,
    feishuUserId: 'u-active',
    scope: 'openid profile permissions',
    expiresAt: new Date(Date.now() + 60_000),
    revokedAt: null,
    application: {
      id: `app-${appKey}`,
      appKey,
      status: 'active'
    },
    feishuUser: {
      userId: 'u-active',
      isActive: true,
      isDeleted: false
    }
  };
}

function expectAccessTokenLookupByHashOnly(
  findUnique: ReturnType<typeof vi.fn>,
  bearerToken: string
): void {
  expect(findUnique).toHaveBeenCalledTimes(1);
  expect(findUnique.mock.calls[0]?.[0]).toEqual({
    where: {
      tokenHash: hashOauthSecret(bearerToken)
    },
    include: {
      application: true,
      feishuUser: true
    }
  });
}

describe('应用侧权限查询 API', () => {
  let app: INestApplication;
  const prisma = {
    isReady: vi.fn().mockResolvedValue(true),
    $connect: vi.fn(),
    $disconnect: vi.fn(),
    oauthAccessToken: {
      findUnique: vi.fn()
    },
    applicationClient: {
      findFirst: vi.fn()
    }
  };
  const calculationService = {
    calculate: vi.fn<PermissionCalculationService['calculate']>()
  };
  const securityEvents = {
    record: vi.fn<SecurityEventService['record']>().mockResolvedValue(undefined)
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule]
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(PermissionCalculationService)
      .useValue(calculationService)
      .overrideProvider(SecurityEventService)
      .useValue(securityEvents)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    prisma.oauthAccessToken.findUnique.mockReset();
    prisma.applicationClient.findFirst.mockReset();
    prisma.applicationClient.findFirst.mockResolvedValue({ status: 'active' });
    calculationService.calculate.mockReset();
    securityEvents.record.mockReset();
    securityEvents.record.mockResolvedValue(undefined);
  });

  afterAll(async () => {
    await app.close();
  });

  it('token app_key 匹配路径 appKey 时返回 snake_case 权限响应', async () => {
    prisma.oauthAccessToken.findUnique.mockResolvedValue(buildTokenRow('finance'));
    calculationService.calculate.mockResolvedValue({
      appKey: 'finance',
      userId: 'u-active',
      permissionGroups: [{ key: 'finance.invoice_manager', name: '发票管理员' }],
      permissionPoints: [{ key: 'finance.invoice.read', name: '查看发票' }],
      matchedRoles: [{ key: 'invoice_manager', name: '发票管理员' }],
      computedAt: '2026-05-16T00:00:00.000Z'
    });

    const httpServer = app.getHttpServer() as SupertestApp;
    await request(httpServer)
      .get('/api/v1/apps/finance/me/permissions')
      .set('Authorization', 'Bearer biat_valid')
      .expect(200)
      .expect((response) => {
        expect(response.body).toEqual({
          app_key: 'finance',
          user_id: 'u-active',
          permission_groups: [{ key: 'finance.invoice_manager', name: '发票管理员' }],
          permission_points: [{ key: 'finance.invoice.read', name: '查看发票' }],
          matched_roles: [{ key: 'invoice_manager', name: '发票管理员' }],
          computed_at: '2026-05-16T00:00:00.000Z'
        });
        expect(response.body).not.toHaveProperty('appKey');
        expect(response.body).not.toHaveProperty('userId');
        expect(response.body).not.toHaveProperty('permissionGroups');
        expect(response.body).not.toHaveProperty('permissionPoints');
        expect(response.body).not.toHaveProperty('matchedRoles');
        expect(response.body).not.toHaveProperty('computedAt');
      });

    expect(calculationService.calculate).toHaveBeenCalledWith('finance', 'u-active');
    expect(securityEvents.record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'oauth_permission_query',
        applicationId: 'app-finance',
        clientId: 'bic_finance_dev',
        feishuUserId: 'u-active',
        result: 'success',
        reasonCode: null,
        requestId: expect.any(String) as unknown
      }) as unknown
    );
    expect(JSON.stringify(securityEvents.record.mock.calls)).not.toContain('finance.invoice.read');
    expectAccessTokenLookupByHashOnly(prisma.oauthAccessToken.findUnique, 'biat_valid');
    expect(prisma.applicationClient.findFirst).toHaveBeenCalledWith({
      where: {
        applicationId: 'app-finance',
        clientId: 'bic_finance_dev'
      },
      select: {
        status: true
      }
    });
  });

  it('environmentId 为空的 access token 可以查询应用权限', async () => {
    prisma.oauthAccessToken.findUnique.mockResolvedValue(buildTokenRow('finance', null));
    calculationService.calculate.mockResolvedValue({
      appKey: 'finance',
      userId: 'u-active',
      permissionGroups: [],
      permissionPoints: [{ key: 'finance.dashboard.view', name: '查看仪表盘' }],
      matchedRoles: [],
      computedAt: '2026-05-22T00:00:00.000Z'
    });

    const httpServer = app.getHttpServer() as SupertestApp;
    await request(httpServer)
      .get('/api/v1/apps/finance/me/permissions')
      .set('Authorization', 'Bearer biat_noenv')
      .expect(200)
      .expect((response) => {
        expect(response.body).toEqual({
          app_key: 'finance',
          user_id: 'u-active',
          permission_groups: [],
          permission_points: [{ key: 'finance.dashboard.view', name: '查看仪表盘' }],
          matched_roles: [],
          computed_at: '2026-05-22T00:00:00.000Z'
        });
      });

    expect(calculationService.calculate).toHaveBeenCalledWith('finance', 'u-active');
    expectAccessTokenLookupByHashOnly(prisma.oauthAccessToken.findUnique, 'biat_noenv');
  });

  it('cross-application token 返回 OAUTH_APP_KEY_MISMATCH 且不计算权限', async () => {
    prisma.oauthAccessToken.findUnique.mockResolvedValue(buildTokenRow('finance'));

    const httpServer = app.getHttpServer() as SupertestApp;
    await request(httpServer)
      .get('/api/v1/apps/crm/me/permissions')
      .set('Authorization', 'Bearer biat_finance')
      .set('x-request-id', 'req-app-key-mismatch')
      .set('user-agent', 'app-permissions-e2e')
      .expect(403)
      .expect((response) => {
        expect(getErrorCode(response.body as unknown)).toBe('OAUTH_APP_KEY_MISMATCH');
        expect(getErrorRequestId(response.body as unknown)).toBe('req-app-key-mismatch');
      });

    expect(securityEvents.record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'oauth_app_token_auth',
        applicationId: 'app-finance',
        clientId: 'bic_finance_dev',
        feishuUserId: 'u-active',
        result: 'failed',
        reasonCode: 'OAUTH_APP_KEY_MISMATCH',
        requestId: 'req-app-key-mismatch',
        ip: expect.any(String) as unknown,
        userAgent: 'app-permissions-e2e'
      }) as unknown
    );
    expect(JSON.stringify(securityEvents.record.mock.calls)).not.toContain('biat_finance');
    expectAccessTokenLookupByHashOnly(prisma.oauthAccessToken.findUnique, 'biat_finance');
    expect(calculationService.calculate).not.toHaveBeenCalled();
  });

  it('cross-application security event 写入失败时仍返回 OAUTH_APP_KEY_MISMATCH', async () => {
    prisma.oauthAccessToken.findUnique.mockResolvedValue(buildTokenRow('finance'));
    securityEvents.record.mockRejectedValue(new Error('security event database unavailable'));
    const loggerErrorSpy = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    const httpServer = app.getHttpServer() as SupertestApp;
    await request(httpServer)
      .get('/api/v1/apps/crm/me/permissions')
      .set('Authorization', 'Bearer biat_finance')
      .set('x-request-id', 'req-app-key-mismatch-record-failed')
      .expect(403)
      .expect((response) => {
        expect(getErrorCode(response.body as unknown)).toBe('OAUTH_APP_KEY_MISMATCH');
        expect(getErrorRequestId(response.body as unknown)).toBe('req-app-key-mismatch-record-failed');
      });

    expect(securityEvents.record).toHaveBeenCalledWith(
      expect.objectContaining({
        reasonCode: 'OAUTH_APP_KEY_MISMATCH',
        requestId: 'req-app-key-mismatch-record-failed'
      }) as unknown
    );
    expect(JSON.stringify(securityEvents.record.mock.calls)).not.toContain('biat_finance');
    expectAccessTokenLookupByHashOnly(prisma.oauthAccessToken.findUnique, 'biat_finance');
    expect(calculationService.calculate).not.toHaveBeenCalled();
    expect(loggerErrorSpy).toHaveBeenCalledWith(
      'OAuth app token app key mismatch security event write failed',
      expect.any(String)
    );
    loggerErrorSpy.mockRestore();
  });

  it('缺少或无效 Bearer token 时返回稳定 OAuth 错误', async () => {
    const httpServer = app.getHttpServer() as SupertestApp;
    await request(httpServer)
      .get('/api/v1/apps/finance/me/permissions')
      .set('x-request-id', 'req-missing-token')
      .expect(401)
      .expect((response) => {
        expect(getErrorCode(response.body as unknown)).toBe('OAUTH_TOKEN_MISSING');
        expect(getErrorRequestId(response.body as unknown)).toBe('req-missing-token');
      });

    prisma.oauthAccessToken.findUnique.mockResolvedValue(null);
    await request(httpServer)
      .get('/api/v1/apps/finance/me/permissions')
      .set('Authorization', 'Bearer biat_invalid')
      .set('x-request-id', 'req-invalid-token')
      .expect(401)
      .expect((response) => {
        expect(getErrorCode(response.body as unknown)).toBe('OAUTH_TOKEN_INVALID');
        expect(getErrorRequestId(response.body as unknown)).toBe('req-invalid-token');
      });

    expect(calculationService.calculate).not.toHaveBeenCalled();
    expectAccessTokenLookupByHashOnly(prisma.oauthAccessToken.findUnique, 'biat_invalid');
  });

  it('过期 token 返回 OAUTH_TOKEN_EXPIRED 且不查询 client', async () => {
    prisma.oauthAccessToken.findUnique.mockResolvedValue({
      ...buildTokenRow('finance'),
      expiresAt: new Date(Date.now() - 60_000)
    });

    const httpServer = app.getHttpServer() as SupertestApp;
    await request(httpServer)
      .get('/api/v1/apps/finance/me/permissions')
      .set('Authorization', 'Bearer biat_expired')
      .set('x-request-id', 'req-expired-token')
      .expect(401)
      .expect((response) => {
        expect(getErrorCode(response.body as unknown)).toBe('OAUTH_TOKEN_EXPIRED');
        expect(getErrorRequestId(response.body as unknown)).toBe('req-expired-token');
      });

    expect(securityEvents.record).toHaveBeenCalledWith(
      expect.objectContaining({
        reasonCode: 'OAUTH_TOKEN_EXPIRED',
        requestId: 'req-expired-token'
      }) as unknown
    );
    expectAccessTokenLookupByHashOnly(prisma.oauthAccessToken.findUnique, 'biat_expired');
    expect(prisma.applicationClient.findFirst).not.toHaveBeenCalled();
    expect(calculationService.calculate).not.toHaveBeenCalled();
  });

  it('已撤销 token 返回 OAUTH_TOKEN_REVOKED 且不查询 client', async () => {
    prisma.oauthAccessToken.findUnique.mockResolvedValue({
      ...buildTokenRow('finance'),
      revokedAt: new Date()
    });

    const httpServer = app.getHttpServer() as SupertestApp;
    await request(httpServer)
      .get('/api/v1/apps/finance/me/permissions')
      .set('Authorization', 'Bearer biat_revoked')
      .set('x-request-id', 'req-revoked-token')
      .expect(401)
      .expect((response) => {
        expect(getErrorCode(response.body as unknown)).toBe('OAUTH_TOKEN_REVOKED');
        expect(getErrorRequestId(response.body as unknown)).toBe('req-revoked-token');
      });

    expect(securityEvents.record).toHaveBeenCalledWith(
      expect.objectContaining({
        reasonCode: 'OAUTH_TOKEN_REVOKED',
        requestId: 'req-revoked-token'
      }) as unknown
    );
    expectAccessTokenLookupByHashOnly(prisma.oauthAccessToken.findUnique, 'biat_revoked');
    expect(prisma.applicationClient.findFirst).not.toHaveBeenCalled();
    expect(calculationService.calculate).not.toHaveBeenCalled();
  });

  it('client 已禁用时返回 OAUTH_TOKEN_CONTEXT_DISABLED', async () => {
    prisma.oauthAccessToken.findUnique.mockResolvedValue(buildTokenRow('finance', null));
    prisma.applicationClient.findFirst.mockResolvedValue({ status: 'disabled' });

    const httpServer = app.getHttpServer() as SupertestApp;
    await request(httpServer)
      .get('/api/v1/apps/finance/me/permissions')
      .set('Authorization', 'Bearer biat_disabled_client')
      .set('x-request-id', 'req-disabled-client')
      .expect(403)
      .expect((response) => {
        expect(getErrorCode(response.body as unknown)).toBe('OAUTH_TOKEN_CONTEXT_DISABLED');
        expect(getErrorRequestId(response.body as unknown)).toBe('req-disabled-client');
      });

    expect(prisma.applicationClient.findFirst).toHaveBeenCalledWith({
      where: {
        applicationId: 'app-finance',
        clientId: 'bic_finance_dev'
      },
      select: {
        status: true
      }
    });
    expect(securityEvents.record).toHaveBeenCalledWith(
      expect.objectContaining({
        reasonCode: 'OAUTH_TOKEN_CONTEXT_DISABLED',
        requestId: 'req-disabled-client'
      }) as unknown
    );
    expectAccessTokenLookupByHashOnly(prisma.oauthAccessToken.findUnique, 'biat_disabled_client');
    expect(calculationService.calculate).not.toHaveBeenCalled();
  });

  it('权限计算抛 PermissionDomainError 时返回 PermissionErrorFilter 稳定错误体', async () => {
    prisma.oauthAccessToken.findUnique.mockResolvedValue(buildTokenRow('finance'));
    calculationService.calculate.mockRejectedValue(
      new PermissionDomainError('FEISHU_USER_NOT_ACTIVE', '飞书用户不可登录', 403)
    );

    const httpServer = app.getHttpServer() as SupertestApp;
    await request(httpServer)
      .get('/api/v1/apps/finance/me/permissions')
      .set('Authorization', 'Bearer biat_valid')
      .set('x-request-id', 'req-permission-error')
      .expect(403)
      .expect((response) => {
        expect(getErrorCode(response.body as unknown)).toBe('FEISHU_USER_NOT_ACTIVE');
        expect(getErrorRequestId(response.body as unknown)).toBe('req-permission-error');
      });

    expectAccessTokenLookupByHashOnly(prisma.oauthAccessToken.findUnique, 'biat_valid');
    expect(securityEvents.record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'oauth_permission_query',
        applicationId: 'app-finance',
        clientId: 'bic_finance_dev',
        feishuUserId: 'u-active',
        result: 'failed',
        reasonCode: 'FEISHU_USER_NOT_ACTIVE',
        requestId: 'req-permission-error'
      }) as unknown
    );
  });
});
