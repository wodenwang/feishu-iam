import { describe, expect, it, vi } from 'vitest';
import { AdminAuthService } from '../src/admin/admin-auth.service';
import { hashAdminSessionSecret } from '../src/admin/admin-session-crypto';
import { AdminDomainError } from '../src/admin/admin.types';
import type { FeishuClient } from '../src/feishu/feishu-client';

type PrismaMock = ReturnType<typeof makePrisma>;

function makePrisma() {
  return {
    adminUser: {
      findFirst: vi.fn(),
      update: vi.fn()
    },
    feishuUser: {
      findUnique: vi.fn()
    },
    adminSession: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn()
    }
  };
}

function makeService(prisma: PrismaMock): AdminAuthService {
  return new AdminAuthService(prisma as never, makeFeishuClient());
}

function makeFeishuClient(overrides?: Partial<FeishuClient>): FeishuClient {
  const client: FeishuClient = {
    getTenantAccessToken: vi.fn(),
    buildOAuthAuthorizeUrl: vi.fn().mockReturnValue('https://accounts.feishu.cn/open-apis/authen/v1/authorize?state=state-1'),
    exchangeOAuthCode: vi.fn().mockResolvedValue({
      user_id: 'ou_1',
      open_id: 'open_1',
      union_id: 'union_1',
      name: '张三'
    }),
    listDepartmentChildren: vi.fn(),
    listDepartmentUsers: vi.fn(),
    ...overrides
  };
  return client;
}

function activeAdmin() {
  return {
    id: 'admin-1',
    feishuUserId: 'ou_1',
    displayName: '张三',
    status: 'active',
    roles: [
      { adminRole: { roleKey: 'platform_admin' } },
      { adminRole: { roleKey: 'application_admin' } }
    ],
    applicationScopes: [{ applicationId: 'app-1' }]
  };
}

function validSession() {
  return {
    id: 'session-1',
    revokedAt: null,
    expiresAt: new Date(Date.now() + 60_000),
    adminUser: {
      ...activeAdmin(),
      feishuUser: {
        isActive: true,
        isDeleted: false
      }
    }
  };
}

async function expectAdminError(action: Promise<unknown>, code: string, status?: number): Promise<AdminDomainError> {
  try {
    await action;
  } catch (error) {
    expect(error).toBeInstanceOf(AdminDomainError);
    expect((error as AdminDomainError).code).toBe(code);
    if (status !== undefined) {
      expect((error as AdminDomainError).status).toBe(status);
    }
    return error as AdminDomainError;
  }

  throw new Error(`Expected AdminDomainError ${code}`);
}

describe('AdminAuthService', () => {
  it('发起管理员飞书登录时生成 state 并使用后台回调地址', () => {
    const originalRedirectUri = process.env.FEISHU_ADMIN_OAUTH_REDIRECT_URI;
    process.env.FEISHU_ADMIN_OAUTH_REDIRECT_URI = 'https://iam.example.com/admin/auth/feishu/callback';
    const prisma = makePrisma();
    const buildOAuthAuthorizeUrl = vi.fn<FeishuClient['buildOAuthAuthorizeUrl']>().mockReturnValue('https://accounts.feishu.cn/admin-login');
    const feishuClient = makeFeishuClient({
      buildOAuthAuthorizeUrl
    });
    const service = new AdminAuthService(prisma as never, feishuClient);

    try {
      const result = service.startFeishuLogin();

      expect(result.state).toMatch(/^bias_/);
      expect(result.redirectUri).toBe('https://iam.example.com/admin/auth/feishu/callback');
      expect(result.redirectTo).toBe('https://accounts.feishu.cn/admin-login');
      expect(buildOAuthAuthorizeUrl).toHaveBeenCalledWith({
        state: result.state,
        redirectUri: 'https://iam.example.com/admin/auth/feishu/callback'
      });
    } finally {
      if (originalRedirectUri === undefined) {
        delete process.env.FEISHU_ADMIN_OAUTH_REDIRECT_URI;
      } else {
        process.env.FEISHU_ADMIN_OAUTH_REDIRECT_URI = originalRedirectUri;
      }
    }
  });

  it('处理管理员飞书回调时校验 state、换取飞书身份并创建 session', async () => {
    const originalRedirectUri = process.env.FEISHU_ADMIN_OAUTH_REDIRECT_URI;
    process.env.FEISHU_ADMIN_OAUTH_REDIRECT_URI = 'https://iam.example.com/admin/auth/feishu/callback';
    const prisma = makePrisma();
    prisma.feishuUser.findUnique.mockResolvedValue({ userId: 'ou_1' });
    prisma.adminUser.findFirst.mockResolvedValue(activeAdmin());
    prisma.adminSession.create.mockResolvedValue({ id: 'session-1' });
    prisma.adminUser.update.mockResolvedValue({ id: 'admin-1' });
    const exchangeOAuthCode = vi.fn<FeishuClient['exchangeOAuthCode']>().mockResolvedValue({
      user_id: 'ou_1',
      open_id: 'open_1',
      union_id: 'union_1',
      name: '张三'
    });
    const service = new AdminAuthService(prisma as never, makeFeishuClient({ exchangeOAuthCode }));

    try {
      const result = await service.handleFeishuCallback(
        {
          code: 'feishu-code',
          state: 'state-1',
          expectedState: 'state-1'
        },
        {
          ip: '127.0.0.1',
          userAgent: 'vitest'
        }
      );

      expect(result.context.adminUserId).toBe('admin-1');
      expect(exchangeOAuthCode).toHaveBeenCalledWith('feishu-code', 'https://iam.example.com/admin/auth/feishu/callback');
      expect(prisma.feishuUser.findUnique).toHaveBeenCalledWith({
        where: { userId: 'ou_1' },
        select: { userId: true }
      });
      expect(prisma.adminSession.create).toHaveBeenCalled();
    } finally {
      if (originalRedirectUri === undefined) {
        delete process.env.FEISHU_ADMIN_OAUTH_REDIRECT_URI;
      } else {
        process.env.FEISHU_ADMIN_OAUTH_REDIRECT_URI = originalRedirectUri;
      }
    }
  });

  it('处理管理员飞书回调时支持仅返回 open_id 的飞书身份', async () => {
    const originalRedirectUri = process.env.FEISHU_ADMIN_OAUTH_REDIRECT_URI;
    process.env.FEISHU_ADMIN_OAUTH_REDIRECT_URI = 'https://iam.example.com/admin/auth/feishu/callback';
    const prisma = makePrisma();
    prisma.feishuUser.findUnique.mockResolvedValue({ userId: 'ou_1' });
    prisma.adminUser.findFirst.mockResolvedValue(activeAdmin());
    prisma.adminSession.create.mockResolvedValue({ id: 'session-1' });
    prisma.adminUser.update.mockResolvedValue({ id: 'admin-1' });
    const exchangeOAuthCode = vi.fn<FeishuClient['exchangeOAuthCode']>().mockResolvedValue({
      open_id: 'open_1',
      union_id: 'union_1',
      name: '张三'
    });
    const service = new AdminAuthService(prisma as never, makeFeishuClient({ exchangeOAuthCode }));

    try {
      const result = await service.handleFeishuCallback(
        {
          code: 'feishu-code',
          state: 'state-1',
          expectedState: 'state-1'
        },
        {}
      );

      expect(result.context.adminUserId).toBe('admin-1');
      expect(prisma.feishuUser.findUnique).toHaveBeenCalledWith({
        where: { openId: 'open_1' },
        select: { userId: true }
      });
    } finally {
      if (originalRedirectUri === undefined) {
        delete process.env.FEISHU_ADMIN_OAUTH_REDIRECT_URI;
      } else {
        process.env.FEISHU_ADMIN_OAUTH_REDIRECT_URI = originalRedirectUri;
      }
    }
  });

  it('处理管理员飞书回调时支持仅返回 sub 的飞书身份', async () => {
    const originalRedirectUri = process.env.FEISHU_ADMIN_OAUTH_REDIRECT_URI;
    process.env.FEISHU_ADMIN_OAUTH_REDIRECT_URI = 'https://iam.example.com/admin/auth/feishu/callback';
    const prisma = makePrisma();
    prisma.feishuUser.findUnique.mockResolvedValue({ userId: 'ou_1' });
    prisma.adminUser.findFirst.mockResolvedValue(activeAdmin());
    prisma.adminSession.create.mockResolvedValue({ id: 'session-1' });
    prisma.adminUser.update.mockResolvedValue({ id: 'admin-1' });
    const exchangeOAuthCode = vi.fn<FeishuClient['exchangeOAuthCode']>().mockResolvedValue({
      sub: 'open_1',
      name: '张三'
    });
    const service = new AdminAuthService(prisma as never, makeFeishuClient({ exchangeOAuthCode }));

    try {
      const result = await service.handleFeishuCallback(
        {
          code: 'feishu-code',
          state: 'state-1',
          expectedState: 'state-1'
        },
        {}
      );

      expect(result.context.adminUserId).toBe('admin-1');
      expect(prisma.feishuUser.findUnique).toHaveBeenCalledWith({
        where: { openId: 'open_1' },
        select: { userId: true }
      });
    } finally {
      if (originalRedirectUri === undefined) {
        delete process.env.FEISHU_ADMIN_OAUTH_REDIRECT_URI;
      } else {
        process.env.FEISHU_ADMIN_OAUTH_REDIRECT_URI = originalRedirectUri;
      }
    }
  });

  it('处理管理员飞书回调时拒绝缺失或不匹配的 state', async () => {
    const prisma = makePrisma();
    const exchangeOAuthCode = vi.fn<FeishuClient['exchangeOAuthCode']>();
    const service = new AdminAuthService(prisma as never, makeFeishuClient({ exchangeOAuthCode }));

    await expectAdminError(
      service.handleFeishuCallback(
        {
          code: 'feishu-code',
          state: 'state-1',
          expectedState: 'state-2'
        },
        {}
      ),
      'ADMIN_LOGIN_STATE_INVALID',
      400
    );

    expect(exchangeOAuthCode).not.toHaveBeenCalled();
    expect(prisma.adminSession.create).not.toHaveBeenCalled();
  });

  it('为 active 管理员创建后台 session，返回明文 secret 和上下文，DB 只保存 hash', async () => {
    const prisma = makePrisma();
    prisma.adminUser.findFirst.mockResolvedValue(activeAdmin());
    prisma.adminSession.create.mockResolvedValue({ id: 'session-1' });
    prisma.adminUser.update.mockResolvedValue({ id: 'admin-1' });
    const service = makeService(prisma);

    const result = await service.createSessionForFeishuUser('ou_1', {
      ip: '127.0.0.1',
      userAgent: 'vitest'
    });

    expect(result.sessionSecret).toMatch(/^bias_/);
    expect(result.context).toEqual({
      adminUserId: 'admin-1',
      feishuUserId: 'ou_1',
      displayName: '张三',
      roles: ['platform_admin', 'application_admin'],
      applicationIds: ['app-1']
    });
    expect(prisma.adminUser.findFirst).toHaveBeenCalledWith({
      where: {
        feishuUserId: 'ou_1',
        status: 'active',
        feishuUser: {
          isActive: true,
          isDeleted: false
        }
      },
      include: {
        roles: { include: { adminRole: true } },
        applicationScopes: true
      }
    });
    expect(prisma.adminSession.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id: expect.any(String) as unknown,
        sessionHash: hashAdminSessionSecret(result.sessionSecret),
        adminUserId: 'admin-1',
        expiresAt: expect.any(Date) as unknown,
        ip: '127.0.0.1',
        userAgent: 'vitest',
        lastUsedAt: expect.any(Date) as unknown
      }) as unknown
    });
    const createArg = prisma.adminSession.create.mock.calls[0]?.[0] as { data: { sessionHash: string; expiresAt: Date } };
    expect(createArg.data.sessionHash).not.toBe(result.sessionSecret);
    expect(createArg.data.expiresAt.getTime()).toBeGreaterThan(Date.now() + 7 * 60 * 60 * 1000);
    expect(createArg.data.expiresAt.getTime()).toBeLessThanOrEqual(Date.now() + 8 * 60 * 60 * 1000);
    expect(prisma.adminUser.update).toHaveBeenCalledWith({
      where: { id: 'admin-1' },
      data: { lastLoginAt: expect.any(Date) as unknown }
    });
  });

  it('创建 session 时拒绝未绑定、禁用或飞书用户不可用的管理员', async () => {
    const prisma = makePrisma();
    prisma.adminUser.findFirst.mockResolvedValue(null);
    const service = makeService(prisma);

    await expectAdminError(
      service.createSessionForFeishuUser('ou_disabled', {
        ip: null,
        userAgent: null
      }),
      'ADMIN_USER_NOT_BOUND',
      403
    );

    expect(prisma.adminSession.create).not.toHaveBeenCalled();
    expect(prisma.adminUser.update).not.toHaveBeenCalled();
  });

  it('读取有效 session 时返回上下文并更新 lastUsedAt', async () => {
    const prisma = makePrisma();
    prisma.adminSession.findUnique.mockResolvedValue(validSession());
    prisma.adminSession.update.mockResolvedValue({ id: 'session-1' });
    const service = makeService(prisma);

    const context = await service.getContextFromSessionSecret('bias_valid');

    expect(context).toEqual({
      adminUserId: 'admin-1',
      feishuUserId: 'ou_1',
      displayName: '张三',
      roles: ['platform_admin', 'application_admin'],
      applicationIds: ['app-1']
    });
    expect(prisma.adminSession.findUnique).toHaveBeenCalledWith({
      where: { sessionHash: hashAdminSessionSecret('bias_valid') },
      include: {
        adminUser: {
          include: {
            feishuUser: true,
            roles: { include: { adminRole: true } },
            applicationScopes: true
          }
        }
      }
    });
    expect(prisma.adminSession.update).toHaveBeenCalledWith({
      where: { id: 'session-1' },
      data: { lastUsedAt: expect.any(Date) as unknown }
    });
  });

  it('读取 session 时遇到未知管理员角色抛 ADMIN_ROLE_INVALID，不静默过滤', async () => {
    const prisma = makePrisma();
    prisma.adminSession.findUnique.mockResolvedValue({
      ...validSession(),
      adminUser: {
        ...validSession().adminUser,
        roles: [{ adminRole: { roleKey: 'platform_admin' } }, { adminRole: { roleKey: 'unknown_role' } }]
      }
    });
    const service = makeService(prisma);

    await expectAdminError(service.getContextFromSessionSecret('bias_unknown_role'), 'ADMIN_ROLE_INVALID', 500);

    expect(prisma.adminSession.update).not.toHaveBeenCalled();
  });

  it('拒绝 missing、revoked 和 expired session', async () => {
    const prisma = makePrisma();
    const service = makeService(prisma);

    prisma.adminSession.findUnique.mockResolvedValueOnce(null);
    await expectAdminError(service.getContextFromSessionSecret('bias_missing'), 'ADMIN_SESSION_INVALID', 401);

    prisma.adminSession.findUnique.mockResolvedValueOnce({
      ...validSession(),
      revokedAt: new Date()
    });
    await expectAdminError(service.getContextFromSessionSecret('bias_revoked'), 'ADMIN_SESSION_INVALID', 401);

    prisma.adminSession.findUnique.mockResolvedValueOnce({
      ...validSession(),
      expiresAt: new Date(Date.now() - 1)
    });
    await expectAdminError(service.getContextFromSessionSecret('bias_expired'), 'ADMIN_SESSION_EXPIRED', 401);

    expect(prisma.adminSession.update).not.toHaveBeenCalled();
  });

  it('读取 session 时拒绝非 active 管理员、inactive 或 deleted 飞书用户', async () => {
    const prisma = makePrisma();
    const service = makeService(prisma);

    prisma.adminSession.findUnique.mockResolvedValueOnce({
      ...validSession(),
      adminUser: {
        ...validSession().adminUser,
        status: 'disabled'
      }
    });
    await expectAdminError(service.getContextFromSessionSecret('bias_disabled_admin'), 'ADMIN_USER_UNAVAILABLE', 403);

    prisma.adminSession.findUnique.mockResolvedValueOnce({
      ...validSession(),
      adminUser: {
        ...validSession().adminUser,
        feishuUser: { isActive: false, isDeleted: false }
      }
    });
    await expectAdminError(service.getContextFromSessionSecret('bias_inactive_feishu'), 'ADMIN_USER_UNAVAILABLE', 403);

    prisma.adminSession.findUnique.mockResolvedValueOnce({
      ...validSession(),
      adminUser: {
        ...validSession().adminUser,
        feishuUser: { isActive: true, isDeleted: true }
      }
    });
    await expectAdminError(service.getContextFromSessionSecret('bias_deleted_feishu'), 'ADMIN_USER_UNAVAILABLE', 403);

    expect(prisma.adminSession.update).not.toHaveBeenCalled();
  });

  it('logout 使用 session hash 撤销 session', async () => {
    const prisma = makePrisma();
    prisma.adminSession.updateMany.mockResolvedValue({ count: 1 });
    const service = makeService(prisma);

    await service.logout('bias_logout');

    expect(prisma.adminSession.updateMany).toHaveBeenCalledWith({
      where: {
        sessionHash: hashAdminSessionSecret('bias_logout'),
        revokedAt: null
      },
      data: {
        revokedAt: expect.any(Date) as unknown
      }
    });
  });
});
