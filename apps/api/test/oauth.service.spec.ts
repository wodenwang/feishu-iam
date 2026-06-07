import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FeishuClient } from '../src/feishu/feishu-client';
import { FeishuClientError } from '../src/feishu/feishu.types';
import { OauthService } from '../src/oauth/oauth.service';
import { hashOauthSecret } from '../src/oauth/oauth-crypto';
import type { OauthAuditContext } from '../src/oauth/oauth.types';
import type { SecurityEventService } from '../src/oauth/security-event.service';
import type { AuditLogService } from '../src/permission/audit-log.service';

type PrismaMock = ReturnType<typeof makePrisma>;
type SecurityEventsMock = {
  record: ReturnType<typeof vi.fn<SecurityEventService['record']>>;
};
type AuditLogMock = {
  record: ReturnType<typeof vi.fn<AuditLogService['record']>>;
};

const auditContext: OauthAuditContext = {
  requestId: 'req-oauth',
  ip: '127.0.0.1',
  userAgent: 'vitest'
};

function makePrismaDelegates() {
  return {
    applicationClient: {
      findUnique: vi.fn(),
      update: vi.fn()
    },
    applicationRedirectUri: {
      findFirst: vi.fn()
    },
    oauthLoginState: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn()
    },
    feishuUser: {
      findUnique: vi.fn()
    },
    oauthAuthorizationCode: {
      create: vi.fn(),
      findUnique: vi.fn(),
      updateMany: vi.fn()
    },
    oauthAccessToken: {
      create: vi.fn(),
      findUnique: vi.fn(),
      updateMany: vi.fn()
    },
    auditLog: {
      create: vi.fn()
    }
  };
}

function makePrisma() {
  const tx = makePrismaDelegates();
  const prisma = {
    ...makePrismaDelegates(),
    tx,
    $transaction: vi.fn()
  };
  prisma.$transaction.mockImplementation(async (callback: (txClient: typeof tx) => Promise<unknown>) => callback(tx));
  return prisma;
}

function mockActiveClientWithSecret(prisma: Pick<PrismaMock, 'applicationClient'>) {
  prisma.applicationClient.findUnique.mockResolvedValue({
    id: 'client-row-1',
    applicationId: 'app-finance',
    environmentId: 'env-dev',
    clientId: 'bic_finance_dev',
    clientSecretHash: hashOauthSecret('bics_valid'),
    status: 'active',
    application: {
      id: 'app-finance',
      appKey: 'finance',
      status: 'active'
    },
    environment: {
      id: 'env-dev',
      environmentKey: 'dev',
      status: 'active'
    }
  });
}

function makeFeishuClient(): FeishuClient {
  return {
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
      user_id: 'u-active',
      open_id: 'ou-active',
      union_id: 'on-active',
      name: '张三'
    })
  };
}

function makeSecurityEvents(): SecurityEventsMock {
  return {
    record: vi.fn<SecurityEventService['record']>().mockResolvedValue(undefined)
  };
}

function makeAuditLog(): AuditLogMock {
  return {
    record: vi.fn<AuditLogService['record']>().mockResolvedValue(undefined)
  };
}

function makeService(
  prisma: PrismaMock = makePrisma(),
  feishuClient: FeishuClient = makeFeishuClient(),
  securityEvents = makeSecurityEvents(),
  auditLog = makeAuditLog()
) {
  return new OauthService(
    prisma as never,
    feishuClient,
    securityEvents as unknown as SecurityEventService,
    auditLog as unknown as AuditLogService
  );
}

function mockActiveClient(prisma: PrismaMock) {
  prisma.applicationClient.findUnique.mockResolvedValue({
    id: 'client-row-1',
    applicationId: 'app-finance',
    environmentId: 'env-dev',
    clientId: 'bic_finance_dev',
    status: 'active',
    application: {
      id: 'app-finance',
      appKey: 'finance',
      status: 'active'
    },
    environment: {
      id: 'env-dev',
      environmentKey: 'dev',
      status: 'active'
    }
  });
  prisma.applicationRedirectUri.findFirst.mockResolvedValue({
    id: 'redirect-1',
    status: 'active',
    redirectUri: 'https://finance.example.com/callback'
  });
}

describe('OauthService', () => {
  let originalFeishuRedirectUri: string | undefined;

  beforeEach(() => {
    originalFeishuRedirectUri = process.env.FEISHU_OAUTH_REDIRECT_URI;
    process.env.FEISHU_OAUTH_REDIRECT_URI = 'https://iam.example.com/oauth/feishu/callback';
  });

  afterEach(() => {
    if (originalFeishuRedirectUri === undefined) {
      delete process.env.FEISHU_OAUTH_REDIRECT_URI;
    } else {
      process.env.FEISHU_OAUTH_REDIRECT_URI = originalFeishuRedirectUri;
    }
  });

  it('startAuthorization 校验 client 和 redirect_uri 后创建哈希登录 state 并跳转飞书', async () => {
    const originalRedirectUri = process.env.FEISHU_OAUTH_REDIRECT_URI;
    process.env.FEISHU_OAUTH_REDIRECT_URI = 'https://iam.example.com/oauth/feishu/callback';
    const prisma = makePrisma();
    mockActiveClient(prisma);
    let storedStateHash = '';
    prisma.oauthLoginState.create.mockImplementation((args: { data: { stateHash: string } }) => {
      storedStateHash = args.data.stateHash;
      return Promise.resolve(args.data);
    });

    const result = await makeService(prisma).startAuthorization(
      {
        responseType: 'code',
        clientId: 'bic_finance_dev',
        redirectUri: 'https://finance.example.com/callback',
        state: 'third-party-state'
      },
      auditContext
    );

    const redirectUrl = new URL(result.redirectTo);
    const internalState = redirectUrl.searchParams.get('state') ?? '';
    expect(result.redirectTo).toContain('accounts.feishu.cn');
    expect(internalState).toMatch(/^bils_/);
    expect(prisma.oauthLoginState.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        clientId: 'bic_finance_dev',
        redirectUri: 'https://finance.example.com/callback',
        requestedScope: 'openid profile permissions',
        externalState: 'third-party-state',
        stateHash: storedStateHash
      }) as unknown
    });
    expect(storedStateHash).toBe(hashOauthSecret(internalState));
    expect(storedStateHash).not.toContain(internalState);

    if (originalRedirectUri === undefined) {
      delete process.env.FEISHU_OAUTH_REDIRECT_URI;
    } else {
      process.env.FEISHU_OAUTH_REDIRECT_URI = originalRedirectUri;
    }
  });

  it('startAuthorization 兼容旧飞书回调路径配置但仍使用内部回调地址跳转飞书', async () => {
    process.env.FEISHU_OAUTH_REDIRECT_URI = 'https://iam.example.com/api/auth/feishu/callback';
    const prisma = makePrisma();
    mockActiveClient(prisma);
    prisma.oauthLoginState.create.mockResolvedValue({});

    const result = await makeService(prisma).startAuthorization(
      {
        responseType: 'code',
        clientId: 'bic_finance_dev',
        redirectUri: 'https://finance.example.com/callback',
        state: 'third-party-state'
      },
      auditContext
    );

    const redirectUrl = new URL(result.redirectTo);
    expect(redirectUrl.searchParams.get('redirect_uri')).toBe('https://iam.example.com/api/auth/feishu/callback');
    expect(prisma.oauthLoginState.create).toHaveBeenCalled();
  });

  it('startAuthorization 拒绝不受支持的内部飞书回调路径并写入稳定失败事件', async () => {
    process.env.FEISHU_OAUTH_REDIRECT_URI = 'https://iam.example.com/api/auth/feishu/callback-old';
    const prisma = makePrisma();
    const securityEvents = makeSecurityEvents();
    mockActiveClient(prisma);

    await expect(
      makeService(prisma, makeFeishuClient(), securityEvents).startAuthorization(
        {
          responseType: 'code',
          clientId: 'bic_finance_dev',
          redirectUri: 'https://finance.example.com/callback',
          state: 'third-party-state'
        },
        auditContext
      )
    ).rejects.toMatchObject({
      code: 'OAUTH_FEISHU_REDIRECT_URI_UNSUPPORTED',
      status: 500
    });
    expect(prisma.oauthLoginState.create).not.toHaveBeenCalled();
    expect(securityEvents.record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'oauth_authorize',
        result: 'failed',
        reasonCode: 'OAUTH_FEISHU_REDIRECT_URI_UNSUPPORTED',
        requestId: 'req-oauth'
      }) as unknown
    );
  });

  it('startAuthorization 使用应用级 active redirect_uri，不要求匹配 client 环境', async () => {
    const originalRedirectUri = process.env.FEISHU_OAUTH_REDIRECT_URI;
    process.env.FEISHU_OAUTH_REDIRECT_URI = 'https://iam.example.com/oauth/feishu/callback';
    const prisma = makePrisma();
    mockActiveClient(prisma);
    prisma.applicationRedirectUri.findFirst.mockResolvedValue({
      id: 'redirect-merged',
      applicationId: 'app-finance',
      environmentId: null,
      sourceEnvironmentId: 'env-test',
      status: 'active',
      redirectUri: 'https://finance.example.com/callback'
    });
    prisma.oauthLoginState.create.mockResolvedValue({});

    await makeService(prisma).startAuthorization(
      {
        responseType: 'code',
        clientId: 'bic_finance_dev',
        redirectUri: 'https://finance.example.com/callback',
        state: 'third-party-state'
      },
      auditContext
    );

    expect(prisma.applicationRedirectUri.findFirst).toHaveBeenCalledWith({
      where: {
        applicationId: 'app-finance',
        redirectUri: 'https://finance.example.com/callback',
        status: 'active'
      }
    });

    if (originalRedirectUri === undefined) {
      delete process.env.FEISHU_OAUTH_REDIRECT_URI;
    } else {
      process.env.FEISHU_OAUTH_REDIRECT_URI = originalRedirectUri;
    }
  });

  it('startAuthorization 仍拒绝未登记的 redirect_uri', async () => {
    const originalRedirectUri = process.env.FEISHU_OAUTH_REDIRECT_URI;
    process.env.FEISHU_OAUTH_REDIRECT_URI = 'https://iam.example.com/oauth/feishu/callback';
    const prisma = makePrisma();
    mockActiveClient(prisma);
    prisma.applicationRedirectUri.findFirst.mockResolvedValue(null);

    await expect(
      makeService(prisma).startAuthorization(
        {
          responseType: 'code',
          clientId: 'bic_finance_dev',
          redirectUri: 'https://finance.example.com/unregistered',
          state: 'third-party-state'
        },
        auditContext
      )
    ).rejects.toMatchObject({
      code: 'OAUTH_REDIRECT_URI_UNTRUSTED',
      status: 400
    });
    expect(prisma.oauthLoginState.create).not.toHaveBeenCalled();

    if (originalRedirectUri === undefined) {
      delete process.env.FEISHU_OAUTH_REDIRECT_URI;
    } else {
      process.env.FEISHU_OAUTH_REDIRECT_URI = originalRedirectUri;
    }
  });

  it('startAuthorization 在飞书回调未配置时仍先拒绝未登记 redirect_uri', async () => {
    const originalRedirectUri = process.env.FEISHU_OAUTH_REDIRECT_URI;
    delete process.env.FEISHU_OAUTH_REDIRECT_URI;
    const prisma = makePrisma();
    mockActiveClient(prisma);
    prisma.applicationRedirectUri.findFirst.mockResolvedValue(null);
    const service = makeService(prisma);

    try {
      await expect(
        service.startAuthorization(
          {
            responseType: 'code',
            clientId: 'bic_finance_dev',
            redirectUri: 'https://evil.example.com/callback',
            state: 'third-party-state'
          },
          auditContext
        )
      ).rejects.toMatchObject({
        code: 'OAUTH_REDIRECT_URI_UNTRUSTED',
        status: 400
      });
      expect(prisma.applicationClient.findUnique).toHaveBeenCalled();
      expect(prisma.applicationRedirectUri.findFirst).toHaveBeenCalledWith({
        where: {
          applicationId: 'app-finance',
          redirectUri: 'https://evil.example.com/callback',
          status: 'active'
        }
      });
      expect(prisma.oauthLoginState.create).not.toHaveBeenCalled();
    } finally {
      if (originalRedirectUri === undefined) {
        delete process.env.FEISHU_OAUTH_REDIRECT_URI;
      } else {
        process.env.FEISHU_OAUTH_REDIRECT_URI = originalRedirectUri;
      }
    }
  });

  it('startAuthorization 规范化并去重允许的 scope 子集', async () => {
    const originalRedirectUri = process.env.FEISHU_OAUTH_REDIRECT_URI;
    process.env.FEISHU_OAUTH_REDIRECT_URI = 'https://iam.example.com/oauth/feishu/callback';
    const prisma = makePrisma();
    mockActiveClient(prisma);
    prisma.oauthLoginState.create.mockResolvedValue({});

    await makeService(prisma).startAuthorization(
      {
        responseType: 'code',
        clientId: 'bic_finance_dev',
        redirectUri: 'https://finance.example.com/callback',
        state: 'third-party-state',
        scope: 'permissions openid openid profile'
      },
      auditContext
    );

    expect(prisma.oauthLoginState.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        requestedScope: 'openid profile permissions'
      }) as unknown
    });

    if (originalRedirectUri === undefined) {
      delete process.env.FEISHU_OAUTH_REDIRECT_URI;
    } else {
      process.env.FEISHU_OAUTH_REDIRECT_URI = originalRedirectUri;
    }
  });

  it('startAuthorization 拒绝未知 scope', async () => {
    const originalRedirectUri = process.env.FEISHU_OAUTH_REDIRECT_URI;
    process.env.FEISHU_OAUTH_REDIRECT_URI = 'https://iam.example.com/oauth/feishu/callback';
    const prisma = makePrisma();
    mockActiveClient(prisma);

    await expect(
      makeService(prisma).startAuthorization(
        {
          responseType: 'code',
          clientId: 'bic_finance_dev',
          redirectUri: 'https://finance.example.com/callback',
          state: 'third-party-state',
          scope: 'openid admin'
        },
        auditContext
      )
    ).rejects.toMatchObject({
      code: 'OAUTH_SCOPE_INVALID',
      status: 400
    });

    expect(prisma.oauthLoginState.create).not.toHaveBeenCalled();

    if (originalRedirectUri === undefined) {
      delete process.env.FEISHU_OAUTH_REDIRECT_URI;
    } else {
      process.env.FEISHU_OAUTH_REDIRECT_URI = originalRedirectUri;
    }
  });

  it('startAuthorization 支持无环境 client 和应用级 redirect_uri', async () => {
    const originalRedirectUri = process.env.FEISHU_OAUTH_REDIRECT_URI;
    process.env.FEISHU_OAUTH_REDIRECT_URI = 'https://iam.example.com/oauth/feishu/callback';
    const prisma = makePrisma();
    prisma.applicationClient.findUnique.mockResolvedValue({
      id: 'client-row-1',
      applicationId: 'app-finance',
      environmentId: null,
      clientId: 'bic_finance',
      status: 'active',
      application: {
        id: 'app-finance',
        appKey: 'finance',
        status: 'active'
      },
      environment: null
    });
    prisma.applicationRedirectUri.findFirst.mockResolvedValue({
      id: 'redirect-no-env',
      applicationId: 'app-finance',
      environmentId: null,
      status: 'active',
      redirectUri: 'https://finance.example.com/callback'
    });
    prisma.oauthLoginState.create.mockResolvedValue({});

    const result = await makeService(prisma).startAuthorization(
      {
        responseType: 'code',
        clientId: 'bic_finance',
        redirectUri: 'https://finance.example.com/callback',
        state: 'third-party-state'
      },
      auditContext
    );

    expect(result.redirectTo).toContain('accounts.feishu.cn');
    expect(prisma.applicationRedirectUri.findFirst).toHaveBeenCalledWith({
      where: {
        applicationId: 'app-finance',
        redirectUri: 'https://finance.example.com/callback',
        status: 'active'
      }
    });

    if (originalRedirectUri === undefined) {
      delete process.env.FEISHU_OAUTH_REDIRECT_URI;
    } else {
      process.env.FEISHU_OAUTH_REDIRECT_URI = originalRedirectUri;
    }
  });

  it('startAuthorization 失败事件写入失败时保留原始 OAuth 错误', async () => {
    const securityEvents = makeSecurityEvents();
    securityEvents.record.mockRejectedValue(new Error('security event unavailable'));

    await expect(
      makeService(makePrisma(), makeFeishuClient(), securityEvents).startAuthorization(
        {
          responseType: 'token',
          clientId: 'bic_finance_dev',
          redirectUri: 'https://finance.example.com/callback',
          state: 'third-party-state'
        },
        auditContext
      )
    ).rejects.toMatchObject({
      code: 'OAUTH_RESPONSE_TYPE_UNSUPPORTED',
      status: 400
    });
  });

  it('handleFeishuCallback 消费 state、创建哈希授权码并带原始 state 回跳第三方', async () => {
    const prisma = makePrisma();
    const feishuClient = makeFeishuClient();
    const internalState = 'bils_internal_state';
    let storedCodeHash = '';
    prisma.oauthLoginState.findUnique.mockResolvedValue({
      id: 'login-state-1',
      stateHash: hashOauthSecret(internalState),
      clientId: 'bic_finance_dev',
      redirectUri: 'https://finance.example.com/callback',
      requestedScope: 'openid profile permissions',
      externalState: 'third-party-state',
      expiresAt: new Date(Date.now() + 60_000),
      consumedAt: null,
      client: {
        applicationId: 'app-finance',
        environmentId: 'env-dev',
        status: 'active',
        application: {
          id: 'app-finance',
          status: 'active'
        },
        environment: {
          id: 'env-dev',
          status: 'active'
        }
      }
    });
    prisma.feishuUser.findUnique.mockResolvedValue({
      userId: 'u-active',
      isActive: true,
      isDeleted: false
    });
    prisma.oauthAuthorizationCode.create.mockImplementation((args: { data: { codeHash: string } }) => {
      storedCodeHash = args.data.codeHash;
      return Promise.resolve(args.data);
    });
    prisma.oauthLoginState.updateMany.mockResolvedValue({ count: 1 });

    const result = await makeService(prisma, feishuClient).handleFeishuCallback(
      {
        code: 'feishu-code',
        state: internalState
      },
      auditContext
    );

    const callbackUrl = new URL(result.redirectTo);
    const authorizationCode = callbackUrl.searchParams.get('code') ?? '';
    expect(callbackUrl.origin + callbackUrl.pathname).toBe('https://finance.example.com/callback');
    expect(authorizationCode).toMatch(/^biac_/);
    expect(callbackUrl.searchParams.get('state')).toBe('third-party-state');
    expect(storedCodeHash).toBe(hashOauthSecret(authorizationCode));
    expect(storedCodeHash).not.toContain(authorizationCode);
    const exchangeOAuthCodeCalls = (feishuClient.exchangeOAuthCode as unknown as { mock: { calls: unknown[][] } }).mock.calls;
    expect(exchangeOAuthCodeCalls).toContainEqual([
      'feishu-code',
      'https://iam.example.com/oauth/feishu/callback'
    ]);
    expect(prisma.oauthLoginState.updateMany).toHaveBeenCalledWith({
      where: {
        stateHash: hashOauthSecret(internalState),
        consumedAt: null,
        expiresAt: {
          gt: expect.any(Date) as unknown
        }
      },
      data: { consumedAt: expect.any(Date) as unknown }
    });
  });

  it('handleFeishuCallback 支持仅返回 open_id 的飞书身份', async () => {
    const prisma = makePrisma();
    const feishuClient = makeFeishuClient();
    const internalState = 'bils_internal_state';
    prisma.oauthLoginState.findUnique.mockResolvedValue({
      id: 'login-state-1',
      stateHash: hashOauthSecret(internalState),
      clientId: 'bic_finance_dev',
      redirectUri: 'https://finance.example.com/callback',
      requestedScope: 'openid profile permissions',
      externalState: 'third-party-state',
      expiresAt: new Date(Date.now() + 60_000),
      consumedAt: null,
      client: {
        applicationId: 'app-finance',
        environmentId: 'env-dev',
        status: 'active',
        application: {
          id: 'app-finance',
          status: 'active'
        },
        environment: {
          id: 'env-dev',
          status: 'active'
        }
      }
    });
    prisma.feishuUser.findUnique.mockResolvedValue({
      userId: 'u-active',
      isActive: true,
      isDeleted: false
    });
    prisma.oauthAuthorizationCode.create.mockResolvedValue({});
    prisma.oauthLoginState.updateMany.mockResolvedValue({ count: 1 });
    feishuClient.exchangeOAuthCode = vi.fn<FeishuClient['exchangeOAuthCode']>().mockResolvedValue({
      open_id: 'ou-active',
      union_id: 'on-active',
      name: '张三'
    });

    const result = await makeService(prisma, feishuClient).handleFeishuCallback(
      {
        code: 'feishu-code',
        state: internalState
      },
      auditContext
    );

    expect(new URL(result.redirectTo).searchParams.get('code')).toMatch(/^biac_/);
    expect(prisma.feishuUser.findUnique).toHaveBeenCalledWith({
      where: {
        openId: 'ou-active'
      }
    });
    expect(prisma.oauthAuthorizationCode.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          feishuUserId: 'u-active'
        }) as unknown
      }) as unknown
    );
  });

  it('handleFeishuCallback 支持仅返回 sub 的飞书身份', async () => {
    const prisma = makePrisma();
    const feishuClient = makeFeishuClient();
    const internalState = 'bils_internal_state';
    prisma.oauthLoginState.findUnique.mockResolvedValue({
      id: 'login-state-1',
      stateHash: hashOauthSecret(internalState),
      clientId: 'bic_finance_dev',
      redirectUri: 'https://finance.example.com/callback',
      requestedScope: 'openid profile permissions',
      externalState: 'third-party-state',
      expiresAt: new Date(Date.now() + 60_000),
      consumedAt: null,
      client: {
        applicationId: 'app-finance',
        environmentId: 'env-dev',
        status: 'active',
        application: {
          id: 'app-finance',
          status: 'active'
        },
        environment: {
          id: 'env-dev',
          status: 'active'
        }
      }
    });
    prisma.feishuUser.findUnique.mockResolvedValue({
      userId: 'u-active',
      isActive: true,
      isDeleted: false
    });
    prisma.oauthAuthorizationCode.create.mockResolvedValue({});
    prisma.oauthLoginState.updateMany.mockResolvedValue({ count: 1 });
    feishuClient.exchangeOAuthCode = vi.fn<FeishuClient['exchangeOAuthCode']>().mockResolvedValue({
      sub: 'ou-active',
      name: '张三'
    });

    const result = await makeService(prisma, feishuClient).handleFeishuCallback(
      {
        code: 'feishu-code',
        state: internalState
      },
      auditContext
    );

    expect(new URL(result.redirectTo).searchParams.get('code')).toMatch(/^biac_/);
    expect(prisma.feishuUser.findUnique).toHaveBeenCalledWith({
      where: {
        openId: 'ou-active'
      }
    });
  });

  it('handleFeishuCallback 对重复 state 不换取飞书 code 且不签发授权码', async () => {
    const prisma = makePrisma();
    prisma.oauthLoginState.updateMany.mockResolvedValue({ count: 0 });
    const feishuClient = makeFeishuClient();
    const exchangeOAuthCode = vi.fn<FeishuClient['exchangeOAuthCode']>();
    feishuClient.exchangeOAuthCode = exchangeOAuthCode;

    await expect(
      makeService(prisma, feishuClient).handleFeishuCallback(
        {
          code: 'feishu-code',
          state: 'bils_replayed_state'
        },
        auditContext
      )
    ).rejects.toMatchObject({
      code: 'OAUTH_LOGIN_STATE_INVALID',
      status: 400
    });

    expect(exchangeOAuthCode).not.toHaveBeenCalled();
    expect(prisma.oauthAuthorizationCode.create).not.toHaveBeenCalled();
  });

  it('handleFeishuCallback 失败事件写入失败时保留原始 OAuth 错误', async () => {
    const prisma = makePrisma();
    prisma.oauthLoginState.updateMany.mockResolvedValue({ count: 0 });
    const securityEvents = makeSecurityEvents();
    securityEvents.record.mockRejectedValue(new Error('security event unavailable'));

    await expect(
      makeService(prisma, makeFeishuClient(), securityEvents).handleFeishuCallback(
        {
          code: 'feishu-code',
          state: 'bils_replayed_state'
        },
        auditContext
      )
    ).rejects.toMatchObject({
      code: 'OAUTH_LOGIN_STATE_INVALID',
      status: 400
    });
  });

  it('handleFeishuCallback 将飞书客户端错误记录为稳定失败码', async () => {
    const prisma = makePrisma();
    const securityEvents = makeSecurityEvents();
    prisma.oauthLoginState.updateMany.mockResolvedValue({ count: 1 });
    prisma.oauthLoginState.findUnique.mockResolvedValue({
      id: 'login-state-1',
      stateHash: hashOauthSecret('bils_internal_state'),
      clientId: 'bic_finance_dev',
      redirectUri: 'https://finance.example.com/callback',
      requestedScope: 'openid profile permissions',
      externalState: 'third-party-state',
      expiresAt: new Date(Date.now() + 60_000),
      consumedAt: null,
      client: {
        applicationId: 'app-finance',
        environmentId: 'env-dev',
        status: 'active',
        application: {
          id: 'app-finance',
          status: 'active'
        },
        environment: {
          id: 'env-dev',
          status: 'active'
        }
      }
    });
    const feishuClient = makeFeishuClient();
    feishuClient.exchangeOAuthCode = vi.fn<FeishuClient['exchangeOAuthCode']>().mockRejectedValue(
      new FeishuClientError('FEISHU_API_ERROR', 'invalid code', {
        feishu_code: 20003,
        path: '/authen/v2/oauth/token',
        request_id: 'feishu-request-id'
      })
    );

    await expect(
      makeService(prisma, feishuClient, securityEvents).handleFeishuCallback(
        {
          code: 'feishu-code',
          state: 'bils_internal_state'
        },
        auditContext
      )
    ).rejects.toBeInstanceOf(FeishuClientError);

    expect(securityEvents.record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'oauth_login',
        result: 'failed',
        reasonCode: 'OAUTH_FEISHU_CLIENT_ERROR',
        summary: expect.not.stringContaining('feishu-code') as unknown
      }) as unknown
    );
  });

  it('handleFeishuCallback 拒绝未激活飞书用户并记录失败事件', async () => {
    const prisma = makePrisma();
    const securityEvents = makeSecurityEvents();
    prisma.oauthLoginState.findUnique.mockResolvedValue({
      id: 'login-state-1',
      stateHash: hashOauthSecret('bils_internal_state'),
      clientId: 'bic_finance_dev',
      redirectUri: 'https://finance.example.com/callback',
      requestedScope: 'openid profile permissions',
      externalState: 'third-party-state',
      expiresAt: new Date(Date.now() + 60_000),
      consumedAt: null,
      client: {
        applicationId: 'app-finance',
        environmentId: 'env-dev',
        status: 'active',
        application: {
          id: 'app-finance',
          status: 'active'
        },
        environment: {
          id: 'env-dev',
          status: 'active'
        }
      }
    });
    prisma.feishuUser.findUnique.mockResolvedValue({
      userId: 'u-disabled',
      isActive: false,
      isDeleted: false
    });
    prisma.oauthLoginState.updateMany.mockResolvedValue({ count: 1 });
    const feishuClient = makeFeishuClient();
    const exchangeOAuthCode = vi.fn<FeishuClient['exchangeOAuthCode']>().mockResolvedValue({
      user_id: 'u-disabled'
    });
    feishuClient.exchangeOAuthCode = exchangeOAuthCode;

    await expect(
      makeService(prisma, feishuClient, securityEvents).handleFeishuCallback(
        {
          code: 'feishu-code',
          state: 'bils_internal_state'
        },
        auditContext
      )
    ).rejects.toMatchObject({
      code: 'OAUTH_USER_NOT_ACTIVE',
      status: 403
    });

    expect(prisma.oauthAuthorizationCode.create).not.toHaveBeenCalled();
    expect(securityEvents.record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'oauth_login',
        result: 'failed',
        reasonCode: 'OAUTH_USER_NOT_ACTIVE',
        summary: expect.not.stringContaining('feishu-code') as unknown
      }) as unknown
    );
  });

  it('handleFeishuCallback 成功事件写入失败时仍回跳第三方', async () => {
    const prisma = makePrisma();
    const securityEvents = makeSecurityEvents();
    const internalState = 'bils_internal_state';
    prisma.oauthLoginState.updateMany.mockResolvedValue({ count: 1 });
    prisma.oauthLoginState.findUnique.mockResolvedValue({
      id: 'login-state-1',
      stateHash: hashOauthSecret(internalState),
      clientId: 'bic_finance_dev',
      redirectUri: 'https://finance.example.com/callback',
      requestedScope: 'openid profile permissions',
      externalState: 'third-party-state',
      expiresAt: new Date(Date.now() + 60_000),
      consumedAt: null,
      client: {
        applicationId: 'app-finance',
        environmentId: 'env-dev',
        status: 'active',
        application: {
          id: 'app-finance',
          status: 'active'
        },
        environment: {
          id: 'env-dev',
          status: 'active'
        }
      }
    });
    prisma.feishuUser.findUnique.mockResolvedValue({
      userId: 'u-active',
      isActive: true,
      isDeleted: false
    });
    prisma.oauthAuthorizationCode.create.mockResolvedValue({});
    securityEvents.record.mockRejectedValue(new Error('security event unavailable'));

    const result = await makeService(prisma, makeFeishuClient(), securityEvents).handleFeishuCallback(
      {
        code: 'feishu-code',
        state: internalState
      },
      auditContext
    );

    const callbackUrl = new URL(result.redirectTo);
    expect(callbackUrl.origin + callbackUrl.pathname).toBe('https://finance.example.com/callback');
    expect(callbackUrl.searchParams.get('code')).toMatch(/^biac_/);
    expect(callbackUrl.searchParams.get('state')).toBe('third-party-state');
    expect(prisma.oauthAuthorizationCode.create).toHaveBeenCalledTimes(1);
  });

  it('code 和 state 明文不会写入 hash 字段', async () => {
    const originalRedirectUri = process.env.FEISHU_OAUTH_REDIRECT_URI;
    process.env.FEISHU_OAUTH_REDIRECT_URI = 'https://iam.example.com/oauth/feishu/callback';
    const prisma = makePrisma();
    mockActiveClient(prisma);
    prisma.oauthLoginState.create.mockResolvedValue({});
    const service = makeService(prisma);

    const started = await service.startAuthorization(
      {
        responseType: 'code',
        clientId: 'bic_finance_dev',
        redirectUri: 'https://finance.example.com/callback',
        state: 'external-state'
      },
      auditContext
    );
    const internalState = new URL(started.redirectTo).searchParams.get('state') ?? '';

    prisma.oauthLoginState.findUnique.mockResolvedValue({
      id: 'login-state-1',
      stateHash: hashOauthSecret(internalState),
      clientId: 'bic_finance_dev',
      redirectUri: 'https://finance.example.com/callback',
      requestedScope: 'openid profile permissions',
      externalState: 'external-state',
      expiresAt: new Date(Date.now() + 60_000),
      consumedAt: null,
      client: {
        applicationId: 'app-finance',
        environmentId: 'env-dev',
        status: 'active',
        application: {
          id: 'app-finance',
          status: 'active'
        },
        environment: {
          id: 'env-dev',
          status: 'active'
        }
      }
    });
    prisma.feishuUser.findUnique.mockResolvedValue({
      userId: 'u-active',
      isActive: true,
      isDeleted: false
    });
    prisma.oauthLoginState.updateMany.mockResolvedValue({ count: 1 });
    prisma.oauthAuthorizationCode.create.mockResolvedValue({});

    const handled = await service.handleFeishuCallback(
      {
        code: 'feishu-code-plaintext',
        state: internalState
      },
      auditContext
    );
    const authorizationCode = new URL(handled.redirectTo).searchParams.get('code') ?? '';
    const persisted = JSON.stringify({
      loginState: prisma.oauthLoginState.create.mock.calls,
      authorizationCode: prisma.oauthAuthorizationCode.create.mock.calls
    });
    expect(persisted).not.toContain(internalState);
    expect(persisted).not.toContain(authorizationCode);
    expect(persisted).not.toContain('feishu-code-plaintext');

    if (originalRedirectUri === undefined) {
      delete process.env.FEISHU_OAUTH_REDIRECT_URI;
    } else {
      process.env.FEISHU_OAUTH_REDIRECT_URI = originalRedirectUri;
    }
  });

  it('exchangeCode 用未使用授权码换取 bearer token 并原子标记 code 已使用', async () => {
    const prisma = makePrisma();
    const securityEvents = makeSecurityEvents();
    mockActiveClientWithSecret(prisma);
    prisma.tx.oauthAuthorizationCode.findUnique.mockResolvedValue({
      id: 'code-row-1',
      codeHash: hashOauthSecret('biac_valid'),
      applicationId: 'app-finance',
      environmentId: 'env-dev',
      clientId: 'bic_finance_dev',
      redirectUri: 'https://finance.example.com/callback',
      feishuUserId: 'u-active',
      scope: 'openid profile permissions',
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: null
    });
    prisma.tx.oauthAuthorizationCode.updateMany.mockResolvedValue({ count: 1 });
    prisma.tx.oauthAccessToken.create.mockResolvedValue({});
    prisma.tx.applicationClient.update.mockResolvedValue({});

    const result = await makeService(prisma, makeFeishuClient(), securityEvents).exchangeCode(
      {
        grantType: 'authorization_code',
        code: 'biac_valid',
        redirectUri: 'https://finance.example.com/callback',
        clientId: 'bic_finance_dev',
        clientSecret: 'bics_valid'
      },
      auditContext
    );

    expect(result.access_token).toMatch(/^biat_/);
    expect(result.token_type).toBe('Bearer');
    expect(result.expires_in).toBe(7200);
    expect(result.scope).toBe('openid profile permissions');
    expect(prisma.tx.oauthAuthorizationCode.updateMany).toHaveBeenCalledWith({
      where: {
        codeHash: hashOauthSecret('biac_valid'),
        clientId: 'bic_finance_dev',
        redirectUri: 'https://finance.example.com/callback',
        usedAt: null,
        expiresAt: {
          gt: expect.any(Date) as unknown
        }
      },
      data: { usedAt: expect.any(Date) as unknown }
    });
    const persistedToken = JSON.stringify(prisma.tx.oauthAccessToken.create.mock.calls);
    expect(persistedToken).not.toContain(result.access_token);
    expect(persistedToken).toContain(hashOauthSecret(result.access_token));
    expect(securityEvents.record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'oauth_token_exchange',
        applicationId: 'app-finance',
        clientId: 'bic_finance_dev',
        feishuUserId: 'u-active',
        result: 'success',
        requestId: 'req-oauth'
      }) as unknown
    );
  });

  it('exchangeCode 拒绝已使用授权码', async () => {
    const prisma = makePrisma();
    mockActiveClientWithSecret(prisma);
    prisma.tx.oauthAuthorizationCode.findUnique.mockResolvedValue({
      id: 'code-row-1',
      clientId: 'bic_finance_dev',
      redirectUri: 'https://finance.example.com/callback',
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: new Date()
    });

    await expect(
      makeService(prisma).exchangeCode(
        {
          grantType: 'authorization_code',
          code: 'biac_reused',
          redirectUri: 'https://finance.example.com/callback',
          clientId: 'bic_finance_dev',
          clientSecret: 'bics_valid'
        },
        auditContext
      )
    ).rejects.toMatchObject({
      code: 'OAUTH_CODE_USED',
      status: 400
    });

    expect(prisma.tx.oauthAccessToken.create).not.toHaveBeenCalled();
  });

  it('exchangeCode client_secret 错误只写一次安全事件且不创建 token', async () => {
    const prisma = makePrisma();
    const securityEvents = makeSecurityEvents();
    mockActiveClientWithSecret(prisma);

    await expect(
      makeService(prisma, makeFeishuClient(), securityEvents).exchangeCode(
        {
          grantType: 'authorization_code',
          code: 'biac_valid',
          redirectUri: 'https://finance.example.com/callback',
          clientId: 'bic_finance_dev',
          clientSecret: 'bics_wrong'
        },
        auditContext
      )
    ).rejects.toMatchObject({
      code: 'OAUTH_CLIENT_CREDENTIALS_INVALID',
      status: 401
    });

    expect(securityEvents.record).toHaveBeenCalledTimes(1);
    expect(securityEvents.record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'oauth_token_exchange',
        applicationId: 'app-finance',
        clientId: 'bic_finance_dev',
        result: 'failed',
        reasonCode: 'OAUTH_CLIENT_CREDENTIALS_INVALID'
      }) as unknown
    );
    expect(JSON.stringify(securityEvents.record.mock.calls)).not.toContain('bics_wrong');
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.tx.oauthAccessToken.create).not.toHaveBeenCalled();
  });

  it('revokeToken 命中 token 时写审计日志且不泄露明文或 hash', async () => {
    const prisma = makePrisma();
    const auditLog = makeAuditLog();
    mockActiveClientWithSecret(prisma);
    prisma.tx.oauthAccessToken.updateMany.mockResolvedValue({ count: 1 });

    const result = await makeService(prisma, makeFeishuClient(), makeSecurityEvents(), auditLog).revokeToken(
      {
        token: 'biat_known',
        clientId: 'bic_finance_dev',
        clientSecret: 'bics_valid'
      },
      auditContext
    );

    expect(result).toEqual({ revoked: true });
    expect(prisma.tx.oauthAccessToken.updateMany).toHaveBeenCalledWith({
      where: {
        tokenHash: hashOauthSecret('biat_known'),
        clientId: 'bic_finance_dev',
        revokedAt: null
      },
      data: { revokedAt: expect.any(Date) as unknown }
    });
    expect(auditLog.record).toHaveBeenCalledWith(
      expect.objectContaining({
        actorType: 'application_client',
        actorId: 'bic_finance_dev',
        source: 'oauth_api',
        applicationId: 'app-finance',
        resourceType: 'oauth_access_token',
        resourceId: 'bic_finance_dev',
        action: 'revoke',
        result: 'success',
        ip: '127.0.0.1',
        userAgent: 'vitest',
        requestId: 'req-oauth',
        after: { status: 'revoked' }
      }) as unknown,
      prisma.tx
    );
    const auditPayload = JSON.stringify(auditLog.record.mock.calls);
    expect(auditPayload).not.toContain('biat_known');
    expect(auditPayload).not.toContain('bics_valid');
    expect(auditPayload).not.toContain(hashOauthSecret('biat_known'));
  });

  it('revokeToken 对未知 token 仍返回成功并审计 unknown 但响应不泄露存在性', async () => {
    const prisma = makePrisma();
    const auditLog = makeAuditLog();
    mockActiveClientWithSecret(prisma);
    prisma.tx.oauthAccessToken.updateMany.mockResolvedValue({ count: 0 });

    const result = await makeService(prisma, makeFeishuClient(), makeSecurityEvents(), auditLog).revokeToken(
      {
        token: 'biat_unknown',
        clientId: 'bic_finance_dev',
        clientSecret: 'bics_valid'
      },
      auditContext
    );

    expect(result).toEqual({ revoked: true });
    expect(auditLog.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'revoke',
        after: { status: 'unknown' }
      }) as unknown,
      prisma.tx
    );
    expect(JSON.stringify(result)).not.toContain('unknown');
    expect(JSON.stringify(result)).not.toContain('biat_unknown');
    expect(JSON.stringify(auditLog.record.mock.calls)).not.toContain('biat_unknown');
  });

  it('revokeToken client_secret 错误只写一次安全事件且不更新 revoke', async () => {
    const prisma = makePrisma();
    const securityEvents = makeSecurityEvents();
    mockActiveClientWithSecret(prisma);

    await expect(
      makeService(prisma, makeFeishuClient(), securityEvents).revokeToken(
        {
          token: 'biat_valid',
          clientId: 'bic_finance_dev',
          clientSecret: 'bics_wrong'
        },
        auditContext
      )
    ).rejects.toMatchObject({
      code: 'OAUTH_CLIENT_CREDENTIALS_INVALID',
      status: 401
    });

    expect(securityEvents.record).toHaveBeenCalledTimes(1);
    expect(securityEvents.record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'oauth_token_revoke',
        applicationId: 'app-finance',
        clientId: 'bic_finance_dev',
        result: 'failed',
        reasonCode: 'OAUTH_CLIENT_CREDENTIALS_INVALID'
      }) as unknown
    );
    expect(JSON.stringify(securityEvents.record.mock.calls)).not.toContain('bics_wrong');
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.tx.oauthAccessToken.updateMany).not.toHaveBeenCalled();
  });

  it('revokeToken 审计写入失败时不返回成功且不写成功安全事件', async () => {
    const prisma = makePrisma();
    const auditLog = makeAuditLog();
    const securityEvents = makeSecurityEvents();
    mockActiveClientWithSecret(prisma);
    prisma.tx.oauthAccessToken.updateMany.mockResolvedValue({ count: 1 });
    auditLog.record.mockRejectedValue(new Error('audit unavailable'));

    await expect(
      makeService(prisma, makeFeishuClient(), securityEvents, auditLog).revokeToken(
        {
          token: 'biat_valid',
          clientId: 'bic_finance_dev',
          clientSecret: 'bics_valid'
        },
        auditContext
      )
    ).rejects.toThrow('audit unavailable');

    expect(securityEvents.record).toHaveBeenCalledTimes(1);
    expect(securityEvents.record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'oauth_token_revoke',
        result: 'failed',
        reasonCode: 'OAUTH_INTERNAL_ERROR'
      }) as unknown
    );
    expect(securityEvents.record).not.toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'oauth_token_revoke',
        result: 'success'
      }) as unknown
    );
  });

  it('getUserinfo 返回用户资料但不返回 mobile', async () => {
    const prisma = makePrisma();
    prisma.feishuUser.findUnique.mockResolvedValue({
      userId: 'u-active',
      openId: 'ou-active',
      unionId: 'on-active',
      name: '张三',
      avatar: { avatar_72: 'https://example.com/avatar.png' },
      email: 'zhangsan@example.com',
      employeeNo: '10001',
      jobTitle: '工程师',
      mobile: '13800000000',
      isActive: true,
      isDeleted: false
    });

    const securityEvents = makeSecurityEvents();
    const result = await makeService(prisma, makeFeishuClient(), securityEvents).getUserinfo(
      {
        applicationId: 'app-finance',
        appKey: 'finance',
        environmentId: 'env-dev',
        clientId: 'bic_finance_dev',
        feishuUserId: 'u-active',
        scope: 'openid profile permissions'
      },
      auditContext
    );

    expect(result).toEqual({
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
    expect(result).not.toHaveProperty('mobile');
    expect(securityEvents.record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'oauth_userinfo',
        applicationId: 'app-finance',
        clientId: 'bic_finance_dev',
        feishuUserId: 'u-active',
        result: 'success',
        requestId: 'req-oauth'
      }) as unknown
    );
  });

  it('getUserinfo 业务失败时写 oauth_userinfo 安全事件', async () => {
    const prisma = makePrisma();
    const securityEvents = makeSecurityEvents();
    prisma.feishuUser.findUnique.mockResolvedValue({
      userId: 'u-active',
      isActive: false,
      isDeleted: false
    });

    await expect(
      makeService(prisma, makeFeishuClient(), securityEvents).getUserinfo(
        {
          applicationId: 'app-finance',
          appKey: 'finance',
          environmentId: 'env-dev',
          clientId: 'bic_finance_dev',
          feishuUserId: 'u-active',
          scope: 'openid profile permissions'
        },
        auditContext
      )
    ).rejects.toMatchObject({ code: 'OAUTH_TOKEN_USER_UNAVAILABLE' });

    expect(securityEvents.record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'oauth_userinfo',
        applicationId: 'app-finance',
        clientId: 'bic_finance_dev',
        feishuUserId: 'u-active',
        result: 'failed',
        reasonCode: 'OAUTH_TOKEN_USER_UNAVAILABLE',
        requestId: 'req-oauth'
      }) as unknown
    );
  });
});
