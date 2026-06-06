import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App as SupertestApp } from 'supertest/types';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../src/app.module';
import { FEISHU_CLIENT, type FeishuClient } from '../src/feishu/feishu-client';
import { FeishuClientError } from '../src/feishu/feishu.types';
import { hashOauthSecret } from '../src/oauth/oauth-crypto';
import { OauthConfigService } from '../src/oauth/oauth-config.service';
import { OauthService } from '../src/oauth/oauth.service';
import { OauthDomainError } from '../src/oauth/oauth.types';
import { SecurityEventService } from '../src/oauth/security-event.service';
import { ApplicationService } from '../src/permission/application.service';
import { AuditLogService } from '../src/permission/audit-log.service';
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

const auditContext = expect.objectContaining({
  requestId: expect.any(String) as unknown,
  ip: expect.any(String) as unknown
}) as unknown;

type NoEnvApplicationRow = {
  id: string;
  appKey: string;
  name: string;
  status: string;
};

type NoEnvClientRow = {
  id: string;
  applicationId: string;
  environmentId: string | null;
  clientId: string;
  clientSecretHash: string;
  name: string;
  status: string;
  isPrimary: boolean;
  lastUsedAt?: Date | null;
  application?: NoEnvApplicationRow;
};

type NoEnvRedirectUriRow = {
  id: string;
  applicationId: string;
  environmentId: string | null;
  redirectUri: string;
  status: string;
};

type NoEnvLoginStateRow = {
  id: string;
  stateHash: string;
  clientId: string;
  redirectUri: string;
  requestedScope: string;
  externalState: string;
  expiresAt: Date;
  consumedAt?: Date | null;
};

type NoEnvAuthorizationCodeRow = {
  id: string;
  codeHash: string;
  applicationId: string;
  environmentId: string | null;
  clientId: string;
  redirectUri: string;
  feishuUserId: string;
  scope: string;
  state: string;
  expiresAt: Date;
  usedAt?: Date | null;
};

function createNoEnvOauthPrismaStub() {
  const applications = new Map<string, NoEnvApplicationRow>();
  const clients = new Map<string, NoEnvClientRow>();
  const redirectUris: NoEnvRedirectUriRow[] = [];
  const loginStates = new Map<string, NoEnvLoginStateRow>();
  const authorizationCodes = new Map<string, NoEnvAuthorizationCodeRow>();
  const accessTokens: unknown[] = [];
  const feishuUsers = new Map([
    [
      'u-no-env',
      {
        userId: 'u-no-env',
        openId: 'ou-no-env',
        unionId: 'on-no-env',
        name: '无环境用户',
        avatar: null,
        email: 'noenv@example.com',
        employeeNo: '10086',
        jobTitle: '测试工程师',
        isActive: true,
        isDeleted: false
      }
    ]
  ]);

  const withApplication = (client: NoEnvClientRow | undefined) => {
    if (!client) {
      return null;
    }
    return {
      ...client,
      application: applications.get(client.applicationId) ?? null
    };
  };

  const delegates = {
    applicationClient: {
      findUnique: vi.fn(({ where }: { where: { clientId: string } }) => Promise.resolve(withApplication(clients.get(where.clientId)))),
      update: vi.fn(({ where, data }: { where: { clientId: string }; data: Partial<NoEnvClientRow> }) => {
        const client = clients.get(where.clientId);
        if (client) {
          Object.assign(client, data);
        }
        return Promise.resolve(client ?? null);
      })
    },
    applicationRedirectUri: {
      findFirst: vi.fn(({ where }: { where: { applicationId: string; redirectUri: string; status: string } }) =>
        Promise.resolve(
          redirectUris.find(
            (item) =>
              item.applicationId === where.applicationId &&
              item.redirectUri === where.redirectUri &&
              item.status === where.status
          ) ?? null
        )
      )
    },
    oauthLoginState: {
      create: vi.fn(({ data }: { data: NoEnvLoginStateRow }) => {
        loginStates.set(data.stateHash, { ...data, consumedAt: null });
        return Promise.resolve(data);
      }),
      updateMany: vi.fn(({ where, data }: { where: { stateHash: string; consumedAt: null; expiresAt: { gt: Date } }; data: { consumedAt: Date } }) => {
        const row = loginStates.get(where.stateHash);
        if (!row || row.consumedAt || row.expiresAt <= where.expiresAt.gt) {
          return Promise.resolve({ count: 0 });
        }
        row.consumedAt = data.consumedAt;
        return Promise.resolve({ count: 1 });
      }),
      findUnique: vi.fn(({ where }: { where: { stateHash: string } }) => {
        const row = loginStates.get(where.stateHash);
        if (!row) {
          return Promise.resolve(null);
        }
        return Promise.resolve({
          ...row,
          client: withApplication(clients.get(row.clientId))
        });
      })
    },
    oauthAuthorizationCode: {
      create: vi.fn(({ data }: { data: NoEnvAuthorizationCodeRow }) => {
        authorizationCodes.set(data.codeHash, { ...data, usedAt: null });
        return Promise.resolve(data);
      }),
      findUnique: vi.fn(({ where }: { where: { codeHash: string } }) =>
        Promise.resolve(authorizationCodes.get(where.codeHash) ?? null)
      ),
      updateMany: vi.fn(
        ({
          where,
          data
        }: {
          where: { codeHash: string; clientId: string; redirectUri: string; usedAt: null; expiresAt: { gt: Date } };
          data: { usedAt: Date };
        }) => {
          const row = authorizationCodes.get(where.codeHash);
          if (
            !row ||
            row.clientId !== where.clientId ||
            row.redirectUri !== where.redirectUri ||
            row.usedAt ||
            row.expiresAt <= where.expiresAt.gt
          ) {
            return Promise.resolve({ count: 0 });
          }
          row.usedAt = data.usedAt;
          return Promise.resolve({ count: 1 });
        }
      )
    },
    oauthAccessToken: {
      create: vi.fn(({ data }: { data: unknown }) => {
        accessTokens.push(data);
        return Promise.resolve(data);
      })
    },
    feishuUser: {
      findUnique: vi.fn(({ where }: { where: { userId?: string; openId?: string; unionId?: string } }) => {
        if (where.userId) {
          return Promise.resolve(feishuUsers.get(where.userId) ?? null);
        }
        return Promise.resolve(
          [...feishuUsers.values()].find(
            (item) => item.openId === where.openId || item.unionId === where.unionId
          ) ?? null
        );
      })
    },
    isReady: vi.fn().mockResolvedValue(true),
    $connect: vi.fn(),
    $disconnect: vi.fn()
  };

  return {
    ...delegates,
    $transaction: vi.fn((callback: (tx: typeof delegates) => Promise<unknown>) => callback(delegates)),
    seedApplication(application: NoEnvApplicationRow) {
      applications.set(application.id, application);
    },
    seedApplicationClient(client: NoEnvClientRow) {
      clients.set(client.clientId, client);
    },
    seedRedirectUri(redirectUri: NoEnvRedirectUriRow) {
      redirectUris.push(redirectUri);
    }
  };
}

function extractLoginState(location: string): string {
  return new URL(location).searchParams.get('state') ?? '';
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

describe('OAuth 平台配置 API', () => {
  let app: INestApplication;
  let originalPlatformAdminToken: string | undefined;

  const oauthConfigService = {
    createEnvironment: vi.fn<OauthConfigService['createEnvironment']>(),
    listEnvironments: vi.fn<OauthConfigService['listEnvironments']>(),
    setEnvironmentStatus: vi.fn<OauthConfigService['setEnvironmentStatus']>(),
    createRedirectUri: vi.fn<OauthConfigService['createRedirectUri']>(),
    listRedirectUris: vi.fn<OauthConfigService['listRedirectUris']>(),
    disableRedirectUri: vi.fn<OauthConfigService['disableRedirectUri']>(),
    createClient: vi.fn<OauthConfigService['createClient']>(),
    listClients: vi.fn<OauthConfigService['listClients']>(),
    rotateClientSecret: vi.fn<OauthConfigService['rotateClientSecret']>(),
    setClientStatus: vi.fn<OauthConfigService['setClientStatus']>()
  };
  const applicationService = {
    getApplicationByKey: vi.fn<ApplicationService['getApplicationByKey']>()
  };
  const auditService = {
    record: vi.fn<AuditLogService['record']>()
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
      .overrideProvider(OauthConfigService)
      .useValue(oauthConfigService)
      .overrideProvider(ApplicationService)
      .useValue(applicationService)
      .overrideProvider(AuditLogService)
      .useValue(auditService)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.PLATFORM_ADMIN_TOKEN = 'test-token';
    applicationService.getApplicationByKey.mockResolvedValue({
      id: 'app-finance',
      appKey: 'finance',
      name: '财务系统'
    } as never);
    auditService.record.mockResolvedValue(undefined);
  });

  afterAll(async () => {
    await app.close();
    if (originalPlatformAdminToken === undefined) {
      delete process.env.PLATFORM_ADMIN_TOKEN;
    } else {
      process.env.PLATFORM_ADMIN_TOKEN = originalPlatformAdminToken;
    }
  });

  it('新端点拒绝未携带或错误平台 token 的请求', async () => {
    const httpServer = app.getHttpServer() as SupertestApp;

    await request(httpServer)
      .get('/api/v1/platform/applications/finance/environments')
      .expect(401)
      .expect((response) => {
        expect(getErrorCode(response.body as unknown)).toBe('PLATFORM_TOKEN_INVALID');
      });

    await request(httpServer)
      .get('/api/v1/platform/applications/finance/environments')
      .set('Authorization', 'Bearer wrong-token')
      .expect(401)
      .expect((response) => {
        expect(getErrorCode(response.body as unknown)).toBe('PLATFORM_TOKEN_INVALID');
      });
  });

  it('创建环境端点调用服务并返回数据', async () => {
    oauthConfigService.createEnvironment.mockResolvedValue({
      id: 'env-dev',
      applicationId: 'app-finance',
      environmentKey: 'dev',
      name: '开发环境',
      status: 'active'
    } as never);
    const body = {
      environmentKey: 'dev',
      name: '开发环境'
    };

    const httpServer = app.getHttpServer() as SupertestApp;
    await request(httpServer)
      .post('/api/v1/platform/applications/finance/environments')
      .set('Authorization', 'Bearer test-token')
      .send(body)
      .expect(201)
      .expect((response) => {
        expect(getField(response.body as unknown, 'environmentKey')).toBe('dev');
      });

    expect(oauthConfigService.createEnvironment).toHaveBeenCalledWith('finance', body, auditContext);
  });

  it('创建 client 端点只返回本次明文 clientSecret', async () => {
    oauthConfigService.createClient.mockResolvedValue({
      id: 'client-row-1',
      applicationId: 'app-finance',
      environmentId: 'env-dev',
      clientId: 'bic_test',
      clientSecretHash: 'hash-value',
      clientSecretCiphertext: 'cipher-value',
      clientSecretIv: 'iv-value',
      clientSecretAuthTag: 'tag-value',
      clientSecretAlgorithm: 'aes-256-gcm',
      name: 'Web Client',
      status: 'active',
      clientSecret: 'bics_once'
    } as never);

    const httpServer = app.getHttpServer() as SupertestApp;
    await request(httpServer)
      .post('/api/v1/platform/applications/finance/environments/env-dev/clients')
      .set('Authorization', 'Bearer test-token')
      .send({ name: 'Web Client' })
      .expect(201)
      .expect((response) => {
        expect(getField(response.body as unknown, 'clientSecret')).toBe('bics_once');
        expect(response.body).not.toHaveProperty('clientSecretHash');
        expect(response.body).not.toHaveProperty('clientSecretCiphertext');
        expect(response.body).not.toHaveProperty('clientSecretIv');
        expect(response.body).not.toHaveProperty('clientSecretAuthTag');
        expect(response.body).not.toHaveProperty('clientSecretAlgorithm');
      });

    expect(oauthConfigService.createClient).toHaveBeenCalledWith('finance', 'env-dev', { name: 'Web Client' }, auditContext);
  });

  it('OauthErrorFilter 返回带 request_id 的稳定错误体', async () => {
    oauthConfigService.createRedirectUri.mockRejectedValue(
      new OauthDomainError('OAUTH_REDIRECT_URI_INVALID', '回调地址不允许使用通配符域名', 422)
    );

    const httpServer = app.getHttpServer() as SupertestApp;
    await request(httpServer)
      .post('/api/v1/platform/applications/finance/environments/env-dev/redirect-uris')
      .set('Authorization', 'Bearer test-token')
      .set('x-request-id', 'req-invalid-redirect')
      .send({ redirectUri: 'https://*.example.com/callback' })
      .expect(422)
      .expect((response) => {
        expect(getErrorCode(response.body as unknown)).toBe('OAUTH_REDIRECT_URI_INVALID');
        expect(getErrorRequestId(response.body as unknown)).toBe('req-invalid-redirect');
      });
  });

  it('写端点失败时记录失败审计且不泄露 secret 或 hash', async () => {
    oauthConfigService.createClient.mockRejectedValue(
      new OauthDomainError('OAUTH_CLIENT_NAME_CONFLICT', 'client 名称已存在', 409)
    );

    const httpServer = app.getHttpServer() as SupertestApp;
    await request(httpServer)
      .post('/api/v1/platform/applications/finance/environments/env-dev/clients')
      .set('Authorization', 'Bearer test-token')
      .set('x-request-id', 'req-client-conflict')
      .send({
        name: 'Web Client',
        clientSecret: 'bics_plaintext_from_bad_request',
        clientSecretHash: 'hash-from-bad-request'
      })
      .expect(409)
      .expect((response) => {
        expect(getErrorCode(response.body as unknown)).toBe('OAUTH_CLIENT_NAME_CONFLICT');
        expect(getErrorRequestId(response.body as unknown)).toBe('req-client-conflict');
      });

    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        actorType: 'platform_token',
        actorId: 'platform-admin-token',
        source: 'platform_api',
        applicationId: 'app-finance',
        resourceType: 'application_client',
        resourceId: 'Web Client',
        action: 'create',
        result: 'failed',
        requestId: 'req-client-conflict',
        after: {
          error: {
            code: 'OAUTH_CLIENT_NAME_CONFLICT',
            message: 'client 名称已存在',
            status: 409
          }
        }
      }) as unknown
    );
    const auditPayload = JSON.stringify(auditService.record.mock.calls);
    expect(auditPayload).not.toContain('bics_plaintext_from_bad_request');
    expect(auditPayload).not.toContain('clientSecretHash');
    expect(auditPayload).not.toContain('hash-from-bad-request');
  });
});

describe('OAuth 浏览器授权端点', () => {
  let app: INestApplication;
  const oauthService = {
    startAuthorization: vi.fn<OauthService['startAuthorization']>(),
    handleFeishuCallback: vi.fn<OauthService['handleFeishuCallback']>()
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule]
    })
      .overrideProvider(PrismaService)
      .useValue({
        isReady: vi.fn().mockResolvedValue(true),
        $connect: vi.fn(),
        $disconnect: vi.fn()
      })
      .overrideProvider(OauthService)
      .useValue(oauthService)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  it('authorize 校验后 302 跳转到飞书授权页', async () => {
    oauthService.startAuthorization.mockResolvedValue({
      redirectTo: 'https://accounts.feishu.cn/open-apis/authen/v1/authorize?state=bils_mock'
    });

    const httpServer = app.getHttpServer() as SupertestApp;
    await request(httpServer)
      .get('/oauth/authorize')
      .query({
        response_type: 'code',
        client_id: 'bic_finance_dev',
        redirect_uri: 'https://finance.example.com/callback',
        state: 'third-party-state'
      })
      .expect(302)
      .expect('Location', 'https://accounts.feishu.cn/open-apis/authen/v1/authorize?state=bils_mock');

    expect(oauthService.startAuthorization).toHaveBeenCalledWith(
      {
        responseType: 'code',
        clientId: 'bic_finance_dev',
        redirectUri: 'https://finance.example.com/callback',
        state: 'third-party-state',
        scope: undefined
      },
      expect.objectContaining({
        requestId: expect.any(String) as unknown
      }) as unknown
    );
  });

  it('authorize 回调地址不可信时渲染 SSO HTML 错误页且不泄露 client_secret', async () => {
    oauthService.startAuthorization.mockRejectedValue(
      new OauthDomainError('OAUTH_REDIRECT_URI_UNTRUSTED', 'redirect_uri 未登记或已禁用', 400)
    );

    const httpServer = app.getHttpServer() as SupertestApp;
    await request(httpServer)
      .get('/oauth/authorize')
      .set('x-request-id', 'req-browser-error')
      .query({
        response_type: 'code',
        client_id: 'bic_finance_dev',
        client_secret: 'bics_should_not_leak',
        redirect_uri: 'https://evil.example.com/callback',
        state: 'third-party-state'
      })
      .expect(400)
      .expect('Content-Type', /html/)
      .expect((response) => {
        expect(response.text).toContain('无法完成登录');
        expect(response.text).toContain('redirect_uri 未登记或已禁用');
        expect(response.text).toContain('req-browser-error');
        expect(response.text).not.toContain('bics_should_not_leak');
        expect(response.text).not.toContain('client_secret');
      });
  });

  it('authorize 遇到飞书客户端错误时渲染统一错误页并生成 request_id', async () => {
    oauthService.startAuthorization.mockRejectedValue(
      new FeishuClientError('FEISHU_CONFIG_MISSING', '飞书应用配置缺失')
    );

    const httpServer = app.getHttpServer() as SupertestApp;
    await request(httpServer)
      .get('/oauth/authorize')
      .query({
        response_type: 'code',
        client_id: 'bic_finance_dev',
        redirect_uri: 'https://finance.example.com/callback',
        state: 'third-party-state'
      })
      .expect(500)
      .expect('Content-Type', /html/)
      .expect((response) => {
        expect(response.text).toContain('无法完成登录');
        expect(response.text).toContain('飞书登录服务暂时不可用，请稍后重试');
        expect(response.text).toMatch(/<dt>request id<\/dt><dd>[0-9a-f-]{36}<\/dd>/);
        expect(response.text).not.toContain('unknown');
        const renderedRequestId = response.text.match(/<dt>request id<\/dt><dd>([0-9a-f-]{36})<\/dd>/)?.[1];
        const serviceContext = oauthService.startAuthorization.mock.calls[0]?.[1];
        expect(renderedRequestId).toBe(serviceContext?.requestId);
      });
  });

  it('feishu callback 成功后 302 携带 code/state 回跳第三方', async () => {
    oauthService.handleFeishuCallback.mockResolvedValue({
      redirectTo: 'https://finance.example.com/callback?code=biac_mock&state=third-party-state'
    });

    const httpServer = app.getHttpServer() as SupertestApp;
    await request(httpServer)
      .get('/oauth/feishu/callback')
      .query({
        code: 'feishu-code',
        state: 'bils_mock'
      })
      .expect(302)
      .expect('Location', 'https://finance.example.com/callback?code=biac_mock&state=third-party-state');

    expect(oauthService.handleFeishuCallback).toHaveBeenCalledWith(
      {
        code: 'feishu-code',
        state: 'bils_mock'
      },
      expect.objectContaining({
        requestId: expect.any(String) as unknown
      }) as unknown
    );
  });
});

describe('OAuth 无环境运行时端到端流程', () => {
  let app: INestApplication;
  let originalFeishuRedirectUri: string | undefined;
  const prisma = createNoEnvOauthPrismaStub();
  const feishuClient: FeishuClient = {
    getTenantAccessToken: vi.fn().mockResolvedValue('tenant-token'),
    listDepartmentChildren: vi.fn().mockResolvedValue({ items: [], hasMore: false }),
    listDepartmentUsers: vi.fn().mockResolvedValue({ items: [], hasMore: false }),
    buildOAuthAuthorizeUrl: vi
      .fn()
      .mockImplementation(({ state, redirectUri }: { state: string; redirectUri: string }) => {
        const url = new URL('https://accounts.feishu.cn/open-apis/authen/v1/authorize');
        url.searchParams.set('state', state);
        url.searchParams.set('redirect_uri', redirectUri);
        return url.toString();
      }),
    exchangeOAuthCode: vi.fn().mockResolvedValue({
      user_id: 'u-no-env',
      open_id: 'ou-no-env',
      union_id: 'on-no-env',
      name: '无环境用户'
    })
  };
  const securityEvents = {
    record: vi.fn<SecurityEventService['record']>().mockResolvedValue(undefined)
  };
  const auditService = {
    record: vi.fn<AuditLogService['record']>().mockResolvedValue(undefined)
  };

  beforeAll(async () => {
    originalFeishuRedirectUri = process.env.FEISHU_OAUTH_REDIRECT_URI;
    process.env.FEISHU_OAUTH_REDIRECT_URI = 'https://iam.example.com/oauth/feishu/callback';

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule]
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(FEISHU_CLIENT)
      .useValue(feishuClient)
      .overrideProvider(OauthService)
      .useValue(
        new OauthService(
          prisma as never,
          feishuClient,
          securityEvents as unknown as SecurityEventService,
          auditService as unknown as AuditLogService
        )
      )
      .overrideProvider(SecurityEventService)
      .useValue(securityEvents)
      .overrideProvider(AuditLogService)
      .useValue(auditService)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    prisma.seedApplication({
      id: 'app-no-env',
      appKey: 'noenv',
      name: 'No Env App',
      status: 'active'
    });
    prisma.seedApplicationClient({
      id: 'client-no-env',
      applicationId: 'app-no-env',
      environmentId: null,
      clientId: 'bic_noenv',
      clientSecretHash: hashOauthSecret('secret-noenv'),
      name: '默认登录凭证',
      status: 'active',
      isPrimary: true
    });
    prisma.seedRedirectUri({
      id: 'redirect-no-env',
      applicationId: 'app-no-env',
      environmentId: null,
      redirectUri: 'http://localhost:5173/auth/callback',
      status: 'active'
    });
  });

  afterAll(async () => {
    await app.close();
    if (originalFeishuRedirectUri === undefined) {
      delete process.env.FEISHU_OAUTH_REDIRECT_URI;
    } else {
      process.env.FEISHU_OAUTH_REDIRECT_URI = originalFeishuRedirectUri;
    }
  });

  it('completes authorize and token exchange without application environment', async () => {
    const httpServer = app.getHttpServer() as SupertestApp;
    const authorize = await request(httpServer)
      .get('/oauth/authorize')
      .query({
        response_type: 'code',
        client_id: 'bic_noenv',
        redirect_uri: 'http://localhost:5173/auth/callback',
        state: 'state-no-env',
        scope: 'openid profile permissions'
      })
      .expect(302);

    expect(authorize.headers.location).toContain('accounts.feishu');
    const authorizeLocation = authorize.headers.location;
    expect(typeof authorizeLocation).toBe('string');

    const callback = await request(httpServer)
      .get('/oauth/feishu/callback')
      .query({ code: 'feishu-code-no-env', state: extractLoginState(authorizeLocation as string) })
      .expect(302);

    const callbackLocation = callback.headers.location;
    expect(typeof callbackLocation).toBe('string');
    const callbackUrl = new URL(callbackLocation as string);
    const code = callbackUrl.searchParams.get('code');
    expect(code).toBeTruthy();
    expect(callbackUrl.searchParams.get('state')).toBe('state-no-env');

    const token = await request(httpServer)
      .post('/oauth/token')
      .type('form')
      .send({
        grant_type: 'authorization_code',
        code,
        redirect_uri: 'http://localhost:5173/auth/callback',
        client_id: 'bic_noenv',
        client_secret: 'secret-noenv'
      })
      .expect(200);

    const tokenBody = token.body as Record<string, unknown>;
    expect(tokenBody.token_type).toBe('Bearer');
    expect(typeof tokenBody.expires_in).toBe('number');
    expect(tokenBody.scope).toBe('openid profile permissions');
    expect(prisma.oauthAccessToken.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        applicationId: 'app-no-env',
        environmentId: null,
        clientId: 'bic_noenv',
        feishuUserId: 'u-no-env',
        scope: 'openid profile permissions'
      }) as unknown
    });
  });
});

describe('OAuth token、userinfo 和 revoke 端点', () => {
  let app: INestApplication;
  const oauthService = {
    exchangeCode: vi.fn<OauthService['exchangeCode']>(),
    getUserinfo: vi.fn<OauthService['getUserinfo']>(),
    revokeToken: vi.fn<OauthService['revokeToken']>()
  };
  const appTokenContext = {
    applicationId: 'app-finance',
    appKey: 'finance',
    environmentId: 'env-dev',
    clientId: 'bic_finance_dev',
    feishuUserId: 'u-active',
    scope: 'openid profile permissions'
  };
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
  const securityEvents = {
    record: vi.fn<SecurityEventService['record']>().mockResolvedValue(undefined)
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule]
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(OauthService)
      .useValue(oauthService)
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
    securityEvents.record.mockReset();
    securityEvents.record.mockResolvedValue(undefined);
  });

  afterAll(async () => {
    await app.close();
  });

  it('token 端点支持 form 请求并返回 bearer token', async () => {
    oauthService.exchangeCode.mockResolvedValue({
      access_token: 'biat_once',
      token_type: 'Bearer',
      expires_in: 7200,
      scope: 'openid profile permissions'
    });

    const httpServer = app.getHttpServer() as SupertestApp;
    await request(httpServer)
      .post('/oauth/token')
      .type('form')
      .send({
        grant_type: 'authorization_code',
        code: 'biac_valid',
        redirect_uri: 'https://finance.example.com/callback',
        client_id: 'bic_finance_dev',
        client_secret: 'bics_valid'
      })
      .expect(200)
      .expect((response) => {
        expect(getField(response.body as unknown, 'access_token')).toBe('biat_once');
        expect(getField(response.body as unknown, 'token_type')).toBe('Bearer');
        expect(getField(response.body as unknown, 'expires_in')).toBe(7200);
      });

    expect(oauthService.exchangeCode).toHaveBeenCalledWith(
      {
        grantType: 'authorization_code',
        code: 'biac_valid',
        redirectUri: 'https://finance.example.com/callback',
        clientId: 'bic_finance_dev',
        clientSecret: 'bics_valid'
      },
      expect.objectContaining({
        requestId: expect.any(String) as unknown
      }) as unknown
    );
  });

  it('token 端点遇到重复 form 字段时返回稳定 OAuth 错误而不是 500', async () => {
    const realOauthService = new OauthService(
      {} as never,
      {} as never,
      securityEvents as unknown as SecurityEventService,
      { record: vi.fn() } as never
    );
    oauthService.exchangeCode.mockImplementationOnce((input, context) => realOauthService.exchangeCode(input, context));

    const httpServer = app.getHttpServer() as SupertestApp;
    await request(httpServer)
      .post('/oauth/token')
      .type('form')
      .set('x-request-id', 'req-token-array-field')
      .send({
        grant_type: 'authorization_code',
        code: ['biac_one', 'biac_two'],
        redirect_uri: 'https://finance.example.com/callback',
        client_id: 'bic_finance_dev',
        client_secret: 'bics_valid'
      })
      .expect(400)
      .expect((response) => {
        expect(getErrorCode(response.body as unknown)).toBe('OAUTH_CODE_REQUIRED');
        expect(getErrorRequestId(response.body as unknown)).toBe('req-token-array-field');
      });
  });

  it('userinfo 端点使用 AppTokenGuard 上下文且不返回 mobile', async () => {
    prisma.oauthAccessToken.findUnique.mockResolvedValue({
      applicationId: 'app-finance',
      environmentId: 'env-dev',
      clientId: 'bic_finance_dev',
      feishuUserId: 'u-active',
      scope: 'openid profile permissions',
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
      application: {
        id: 'app-finance',
        appKey: 'finance',
        status: 'active'
      },
      feishuUser: {
        userId: 'u-active',
        isActive: true,
        isDeleted: false
      }
    });
    oauthService.getUserinfo.mockResolvedValue({
      sub: 'u-active',
      user_id: 'u-active',
      open_id: 'ou-active',
      union_id: 'on-active',
      name: '张三',
      avatar: { avatar_72: 'https://example.com/avatar.png' },
      email: 'zhangsan@example.com',
      employee_no: '10001',
      job_title: '工程师'
    });

    const httpServer = app.getHttpServer() as SupertestApp;
    await request(httpServer)
      .get('/oauth/userinfo')
      .set('Authorization', 'Bearer biat_valid')
      .expect(200)
      .expect((response) => {
        expect(getField(response.body as unknown, 'sub')).toBe('u-active');
        expect(response.body).not.toHaveProperty('mobile');
      });

    expect(oauthService.getUserinfo).toHaveBeenCalledWith(
      appTokenContext,
      expect.objectContaining({
        requestId: expect.any(String) as unknown
      }) as unknown
    );
    expectAccessTokenLookupByHashOnly(prisma.oauthAccessToken.findUnique, 'biat_valid');
  });

  it('userinfo 缺少 Bearer token 时返回稳定认证错误', async () => {
    const httpServer = app.getHttpServer() as SupertestApp;
    await request(httpServer)
      .get('/oauth/userinfo')
      .set('x-request-id', 'req-missing-token')
      .expect(401)
      .expect((response) => {
        expect(getErrorCode(response.body as unknown)).toBe('OAUTH_TOKEN_MISSING');
        expect(getErrorRequestId(response.body as unknown)).toBe('req-missing-token');
      });

    expect(oauthService.getUserinfo).not.toHaveBeenCalled();
  });

  it('userinfo token 无效时 AppTokenGuard 写 security event 且不记录明文 token', async () => {
    prisma.oauthAccessToken.findUnique.mockResolvedValue(null);

    const httpServer = app.getHttpServer() as SupertestApp;
    await request(httpServer)
      .get('/oauth/userinfo')
      .set('Authorization', 'Bearer biat_invalid')
      .set('x-request-id', 'req-invalid-token')
      .expect(401)
      .expect((response) => {
        expect(getErrorCode(response.body as unknown)).toBe('OAUTH_TOKEN_INVALID');
        expect(getErrorRequestId(response.body as unknown)).toBe('req-invalid-token');
      });

    expect(securityEvents.record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'oauth_app_token_auth',
        result: 'failed',
        reasonCode: 'OAUTH_TOKEN_INVALID',
        requestId: 'req-invalid-token'
      }) as unknown
    );
    expect(JSON.stringify(securityEvents.record.mock.calls)).not.toContain('biat_invalid');
    expectAccessTokenLookupByHashOnly(prisma.oauthAccessToken.findUnique, 'biat_invalid');
    expect(oauthService.getUserinfo).not.toHaveBeenCalled();
  });

  it('userinfo token 已撤销时 security event 写失败仍返回原始 OAuth 错误', async () => {
    prisma.oauthAccessToken.findUnique.mockResolvedValue({
      applicationId: 'app-finance',
      environmentId: 'env-dev',
      clientId: 'bic_finance_dev',
      feishuUserId: 'u-active',
      scope: 'openid profile permissions',
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: new Date(),
      application: {
        id: 'app-finance',
        appKey: 'finance',
        status: 'active'
      },
      feishuUser: {
        userId: 'u-active',
        isActive: true,
        isDeleted: false
      }
    });
    securityEvents.record.mockRejectedValue(new Error('security unavailable'));

    const httpServer = app.getHttpServer() as SupertestApp;
    await request(httpServer)
      .get('/oauth/userinfo')
      .set('Authorization', 'Bearer biat_revoked')
      .set('x-request-id', 'req-revoked-token')
      .expect(401)
      .expect((response) => {
        expect(getErrorCode(response.body as unknown)).toBe('OAUTH_TOKEN_REVOKED');
        expect(getErrorRequestId(response.body as unknown)).toBe('req-revoked-token');
      });

    expect(securityEvents.record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'oauth_app_token_auth',
        applicationId: 'app-finance',
        clientId: 'bic_finance_dev',
        feishuUserId: 'u-active',
        result: 'failed',
        reasonCode: 'OAUTH_TOKEN_REVOKED'
      }) as unknown
    );
    expect(JSON.stringify(securityEvents.record.mock.calls)).not.toContain('biat_revoked');
    expectAccessTokenLookupByHashOnly(prisma.oauthAccessToken.findUnique, 'biat_revoked');
    expect(oauthService.getUserinfo).not.toHaveBeenCalled();
  });

  it('revoke 端点校验 client 后撤销 token，未知 token 也返回成功', async () => {
    oauthService.revokeToken.mockResolvedValue({ revoked: true });

    const httpServer = app.getHttpServer() as SupertestApp;
    await request(httpServer)
      .post('/oauth/revoke')
      .send({
        token: 'biat_unknown',
        client_id: 'bic_finance_dev',
        client_secret: 'bics_valid'
      })
      .expect(200)
      .expect((response) => {
        expect(response.body).toEqual({ revoked: true });
      });

    expect(oauthService.revokeToken).toHaveBeenCalledWith(
      {
        token: 'biat_unknown',
        clientId: 'bic_finance_dev',
        clientSecret: 'bics_valid'
      },
      expect.objectContaining({
        requestId: expect.any(String) as unknown
      }) as unknown
    );
  });

  it('revoke 端点遇到嵌套 form 字段时返回稳定 OAuth 错误而不是 500', async () => {
    const realOauthService = new OauthService(
      {} as never,
      {} as never,
      securityEvents as unknown as SecurityEventService,
      { record: vi.fn() } as never
    );
    oauthService.revokeToken.mockImplementationOnce((input, context) => realOauthService.revokeToken(input, context));

    const httpServer = app.getHttpServer() as SupertestApp;
    await request(httpServer)
      .post('/oauth/revoke')
      .type('form')
      .set('x-request-id', 'req-revoke-object-field')
      .send({
        token: { value: 'biat_nested' },
        client_id: 'bic_finance_dev',
        client_secret: 'bics_valid'
      })
      .expect(400)
      .expect((response) => {
        expect(getErrorCode(response.body as unknown)).toBe('OAUTH_TOKEN_REQUIRED');
        expect(getErrorRequestId(response.body as unknown)).toBe('req-revoke-object-field');
      });
  });
});
