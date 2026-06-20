import { describe, expect, it, vi } from 'vitest';
import { ClientSecretVault } from '../src/oauth/client-secret-vault';
import { OauthConfigService } from '../src/oauth/oauth-config.service';
import type { SecurityEventService } from '../src/oauth/security-event.service';
import { ApplicationService } from '../src/permission/application.service';

type PrismaMock = ReturnType<typeof makePrisma>;
type AuditMock = ReturnType<typeof makeAudit>;
type SecurityEventsMock = ReturnType<typeof makeSecurityEvents>;

function makePrisma() {
  const prisma = {
    application: {
      findUnique: vi.fn()
    },
    applicationEnvironment: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn()
    },
    applicationRedirectUri: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn()
    },
    applicationClient: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn()
    },
    auditLog: {
      create: vi.fn()
    },
    securityEvent: {
      create: vi.fn()
    },
    $transaction: vi.fn()
  };

  prisma.$transaction.mockImplementation((operation: unknown) => {
    if (typeof operation === 'function') {
      return (operation as (tx: typeof prisma) => Promise<unknown>)(prisma);
    }

    return Promise.resolve(operation);
  });

  return prisma;
}

function makeAudit() {
  return {
    record: vi.fn().mockResolvedValue(undefined)
  };
}

function makeSecurityEvents() {
  return {
    record: vi.fn<SecurityEventService['record']>().mockResolvedValue(undefined)
  };
}

function makeService(
  prisma: PrismaMock = makePrisma(),
  audit: AuditMock = makeAudit(),
  securityEvents: SecurityEventsMock = makeSecurityEvents()
) {
  const applicationService = new ApplicationService(prisma as never, audit as never);
  return new OauthConfigService(
    prisma as never,
    applicationService,
    audit as never,
    new ClientSecretVault('0123456789abcdef0123456789abcdef'),
    securityEvents as unknown as SecurityEventService
  );
}

function mockApplication(prisma: PrismaMock, applicationId = 'app-finance') {
  prisma.application.findUnique.mockResolvedValue({
    id: applicationId,
    appKey: 'finance',
    name: '财务系统'
  });
}

describe('OauthConfigService', () => {
  it('createEnvironment 使用 admin 审计上下文记录 actor/source', async () => {
    const prisma = makePrisma();
    const audit = makeAudit();
    mockApplication(prisma);
    prisma.applicationEnvironment.create.mockImplementation((args: { data: Record<string, unknown> }) => ({
      id: args.data.id,
      applicationId: args.data.applicationId,
      environmentKey: args.data.environmentKey,
      name: args.data.name,
      status: 'active'
    }));
    const service = makeService(prisma, audit);

    await service.createEnvironment(
      'finance',
      {
        environmentKey: 'dev',
        name: '开发环境'
      },
      {
        actorType: 'admin_user',
        actorId: 'admin-app',
        source: 'admin_web',
        requestId: 'req-admin-create-env',
        ip: '127.0.0.1',
        userAgent: 'vitest-admin-console'
      }
    );

    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        actorType: 'admin_user',
        actorId: 'admin-app',
        source: 'admin_web',
        applicationId: 'app-finance',
        resourceType: 'application_environment',
        action: 'create',
        requestId: 'req-admin-create-env',
        ip: '127.0.0.1',
        userAgent: 'vitest-admin-console'
      }) as unknown,
      prisma
    );
  });

  it('createEnvironment 无 actor 审计上下文时保持 platform 默认调用兼容', async () => {
    const prisma = makePrisma();
    const audit = makeAudit();
    mockApplication(prisma);
    prisma.applicationEnvironment.create.mockImplementation((args: { data: Record<string, unknown> }) => ({
      id: args.data.id,
      applicationId: args.data.applicationId,
      environmentKey: args.data.environmentKey,
      name: args.data.name,
      status: 'active'
    }));
    const service = makeService(prisma, audit);

    await service.createEnvironment('finance', { environmentKey: 'dev', name: '开发环境' }, {
      requestId: 'req-platform-create-env',
      ip: '127.0.0.1',
      userAgent: 'vitest-platform'
    });

    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        actorType: 'platform_token',
        actorId: 'platform-admin-token',
        source: 'platform_api',
        requestId: 'req-platform-create-env',
        ip: '127.0.0.1',
        userAgent: 'vitest-platform'
      }) as unknown,
      prisma
    );
  });

  it('createRedirectUri 创建应用级回调地址且兼容旧 controller 签名', async () => {
    const prisma = makePrisma();
    const audit = makeAudit();
    mockApplication(prisma);
    prisma.applicationRedirectUri.create.mockImplementation((args: { data: Record<string, unknown> }) => ({
      id: args.data.id,
      applicationId: args.data.applicationId,
      environmentId: args.data.environmentId,
      redirectUri: args.data.redirectUri,
      status: 'active'
    }));
    const service = makeService(prisma, audit);

    const created = await service.createRedirectUri('finance', 'env-dev', {
      redirectUri: 'http://localhost:5173/callback'
    }, {
      actorType: 'admin_user',
      actorId: 'admin-app',
      source: 'admin_web',
      requestId: 'req-create-redirect',
      ip: '127.0.0.1',
      userAgent: 'vitest-admin-console'
    });

    expect(created.environmentId).toBeNull();
    expect(prisma.applicationEnvironment.findFirst).not.toHaveBeenCalled();
    expect(prisma.applicationRedirectUri.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        applicationId: 'app-finance',
        environmentId: null,
        redirectUri: 'http://localhost:5173/callback'
      }) as unknown
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        applicationId: 'app-finance',
        resourceType: 'application_redirect_uri',
        action: 'create',
        requestId: 'req-create-redirect'
      }) as unknown,
      prisma
    );
  });

  it('listRedirectUris 按应用列出且兼容旧 controller 签名', async () => {
    const prisma = makePrisma();
    mockApplication(prisma);
    prisma.applicationRedirectUri.findMany.mockResolvedValue([
      {
        id: 'redirect-1',
        applicationId: 'app-finance',
        environmentId: null,
        redirectUri: 'http://localhost:5173/callback',
        status: 'active'
      }
    ]);
    const service = makeService(prisma);

    const items = await service.listRedirectUris('finance', 'env-dev');

    expect(items).toHaveLength(1);
    expect(prisma.applicationEnvironment.findFirst).not.toHaveBeenCalled();
    expect(prisma.applicationRedirectUri.findMany).toHaveBeenCalledWith({
      where: {
        applicationId: 'app-finance'
      },
      orderBy: {
        createdAt: 'asc'
      }
    });
  });

  it('disableRedirectUri 使用 applicationId 和 redirect row id 查找后禁用', async () => {
    const prisma = makePrisma();
    mockApplication(prisma);
    prisma.applicationRedirectUri.findFirst.mockResolvedValue({
      id: 'redirect-1',
      applicationId: 'app-finance',
      environmentId: null,
      redirectUri: 'http://localhost:5173/callback',
      status: 'active'
    });
    prisma.applicationRedirectUri.update.mockResolvedValue({
      id: 'redirect-1',
      applicationId: 'app-finance',
      environmentId: null,
      redirectUri: 'http://localhost:5173/callback',
      status: 'disabled'
    });
    const service = makeService(prisma);

    const updated = await service.disableRedirectUri('finance', 'redirect-1');

    expect(updated.status).toBe('disabled');
    expect(prisma.applicationRedirectUri.findFirst).toHaveBeenCalledWith({
      where: {
        applicationId: 'app-finance',
        id: 'redirect-1'
      }
    });
  });

  it('createPrimaryOauthCredential 创建应用级 primary 凭证并降级旧 primary', async () => {
    const prisma = makePrisma();
    const audit = makeAudit();
    mockApplication(prisma);
    prisma.applicationClient.create.mockImplementation((args: { data: Record<string, unknown> }) => ({
      id: args.data.id,
      applicationId: args.data.applicationId,
      environmentId: args.data.environmentId,
      sourceEnvironmentId: null,
      clientId: args.data.clientId,
      clientSecretHash: args.data.clientSecretHash,
      clientSecretCiphertext: args.data.clientSecretCiphertext,
      clientSecretIv: args.data.clientSecretIv,
      clientSecretAuthTag: args.data.clientSecretAuthTag,
      clientSecretAlgorithm: args.data.clientSecretAlgorithm,
      name: args.data.name,
      status: 'active',
      isPrimary: args.data.isPrimary,
      revokedAt: null
    }));
    const service = makeService(prisma, audit);

    const created = await service.createPrimaryOauthCredential('finance', { name: '应用登录凭证' });

    expect(created.clientSecret).toMatch(/^bics_/);
    expect(created.environmentId).toBeNull();
    expect(created.isPrimary).toBe(true);
    expect(prisma.applicationClient.updateMany).toHaveBeenCalledWith({
      where: {
        applicationId: 'app-finance',
        isPrimary: true,
        revokedAt: null
      },
      data: {
        isPrimary: false
      }
    });
    expect(prisma.applicationClient.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        applicationId: 'app-finance',
        environmentId: null,
        name: '应用登录凭证',
        isPrimary: true,
        clientSecretHash: expect.not.stringContaining(created.clientSecret) as unknown
      }) as unknown
    });
    expect(JSON.stringify(audit.record.mock.calls)).not.toContain(created.clientSecret);
  });

  it('createClient 作为兼容别名委托应用级 primary credential，viewClientSecret 可按 clientId 查看', async () => {
    const prisma = makePrisma();
    const audit = makeAudit();
    const securityEvents = makeSecurityEvents();
    mockApplication(prisma);
    prisma.applicationClient.create.mockImplementation((args: { data: Record<string, unknown> }) => ({
      id: args.data.id,
      applicationId: args.data.applicationId,
      environmentId: args.data.environmentId,
      sourceEnvironmentId: null,
      clientId: args.data.clientId,
      clientSecretHash: args.data.clientSecretHash,
      clientSecretCiphertext: args.data.clientSecretCiphertext,
      clientSecretIv: args.data.clientSecretIv,
      clientSecretAuthTag: args.data.clientSecretAuthTag,
      clientSecretAlgorithm: args.data.clientSecretAlgorithm,
      name: args.data.name,
      status: 'active',
      isPrimary: args.data.isPrimary,
      revokedAt: null
    }));
    const service = makeService(prisma, audit, securityEvents);
    const auditContext = {
      actorType: 'admin_user' as const,
      actorId: 'admin-app',
      source: 'admin_web' as const,
      requestId: 'req-view-secret',
      ip: '127.0.0.1',
      userAgent: 'vitest-admin-console'
    };

    const created = await service.createClient('finance', 'env-dev', { name: 'Web Client' });
    prisma.applicationClient.findFirst.mockResolvedValue(created);
    const viewed = await service.viewClientSecret('finance', created.clientId, auditContext);

    expect(prisma.applicationEnvironment.findFirst).not.toHaveBeenCalled();
    expect(created.clientSecret).toMatch(/^bics_/);
    expect(created.environmentId).toBeNull();
    expect(created.isPrimary).toBe(true);
    expect(created.clientSecretHash).not.toContain(created.clientSecret);
    expect(created.clientSecretCiphertext).toEqual(expect.any(String));
    expect(created.clientSecretIv).toEqual(expect.any(String));
    expect(created.clientSecretAuthTag).toEqual(expect.any(String));
    expect(created.clientSecretAlgorithm).toBe('aes-256-gcm');
    expect(created.clientSecretCiphertext).not.toContain(created.clientSecret);
    expect(viewed).toEqual({
      clientId: created.clientId,
      clientSecret: created.clientSecret
    });
    expect(prisma.applicationClient.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        applicationId: 'app-finance',
        environmentId: null,
        name: 'Web Client',
        isPrimary: true,
        clientSecretHash: expect.not.stringContaining(created.clientSecret) as unknown,
        clientSecretCiphertext: expect.not.stringContaining(created.clientSecret) as unknown,
        clientSecretIv: expect.any(String) as unknown,
        clientSecretAuthTag: expect.any(String) as unknown,
        clientSecretAlgorithm: 'aes-256-gcm'
      }) as unknown
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        resourceType: 'application_client',
        resourceId: created.id,
        action: 'view_secret',
        before: undefined,
        after: {
          clientId: created.clientId,
          secretViewed: true
        }
      }) as unknown,
      prisma
    );
    expect(securityEvents.record).toHaveBeenCalledWith({
      eventType: 'secret_viewed',
      applicationId: 'app-finance',
      clientId: created.clientId,
      result: 'success',
      reasonCode: 'CLIENT_SECRET_VIEWED',
      summary: '应用 client secret 被查看',
      ip: '127.0.0.1',
      userAgent: 'vitest-admin-console',
      requestId: 'req-view-secret'
    }, prisma);
    expect(JSON.stringify(audit.record.mock.calls)).not.toContain(created.clientSecret);
    expect(JSON.stringify(securityEvents.record.mock.calls)).not.toContain(created.clientSecret);
  });

  it('createRedirectUri 拒绝通配符回调地址并返回稳定错误码', async () => {
    const prisma = makePrisma();
    mockApplication(prisma);
    const service = makeService(prisma);

    await expect(
      service.createRedirectUri('finance', {
        redirectUri: 'https://*.example.com/callback'
      })
    ).rejects.toMatchObject({
      code: 'OAUTH_REDIRECT_URI_WILDCARD_UNSUPPORTED',
      status: 400
    });

    expect(prisma.applicationRedirectUri.create).not.toHaveBeenCalled();
  });

  it('listClients 不返回 clientSecretHash', async () => {
    const prisma = makePrisma();
    mockApplication(prisma);
    prisma.applicationClient.findMany.mockResolvedValue([
      {
        id: 'client-row-1',
        applicationId: 'app-finance',
        environmentId: null,
        clientId: 'bic_test',
        clientSecretHash: 'hash-value',
        clientSecretCiphertext: 'cipher-value',
        clientSecretIv: 'iv-value',
        clientSecretAuthTag: 'tag-value',
        clientSecretAlgorithm: 'aes-256-gcm',
        name: 'Web Client',
        status: 'active'
      }
    ]);
    const service = makeService(prisma);

    const clients = await service.listClients('finance');

    expect(clients).toEqual([
      {
        id: 'client-row-1',
        applicationId: 'app-finance',
        environmentId: null,
        clientId: 'bic_test',
        name: 'Web Client',
        status: 'active'
      }
    ]);
    expect(prisma.applicationClient.findMany).toHaveBeenCalledWith({
      where: {
        applicationId: 'app-finance'
      },
      orderBy: {
        createdAt: 'asc'
      }
    });
    expect(clients[0]).not.toHaveProperty('clientSecretHash');
    expect(clients[0]).not.toHaveProperty('clientSecretCiphertext');
    expect(clients[0]).not.toHaveProperty('clientSecretIv');
    expect(clients[0]).not.toHaveProperty('clientSecretAuthTag');
    expect(clients[0]).not.toHaveProperty('clientSecretAlgorithm');
  });

  it('rotateClientSecret 返回新 bics_ secret 且审计不包含明文', async () => {
    const prisma = makePrisma();
    const audit = makeAudit();
    const securityEvents = makeSecurityEvents();
    mockApplication(prisma);
    prisma.applicationClient.findFirst.mockResolvedValue({
      id: 'client-row-1',
      applicationId: 'app-finance',
      environmentId: 'env-dev',
      clientId: 'bic_test',
      clientSecretHash: 'old-hash',
      clientSecretCiphertext: 'old-cipher',
      clientSecretIv: 'old-iv',
      clientSecretAuthTag: 'old-tag',
      clientSecretAlgorithm: 'aes-256-gcm',
      name: 'Web Client',
      status: 'active'
    });
    prisma.applicationClient.update.mockImplementation((args: { data: Record<string, unknown> }) => ({
      id: 'client-row-1',
      applicationId: 'app-finance',
      environmentId: 'env-dev',
      clientId: 'bic_test',
      clientSecretHash: args.data.clientSecretHash,
      clientSecretCiphertext: args.data.clientSecretCiphertext,
      clientSecretIv: args.data.clientSecretIv,
      clientSecretAuthTag: args.data.clientSecretAuthTag,
      clientSecretAlgorithm: args.data.clientSecretAlgorithm,
      name: 'Web Client',
      status: 'active'
    }));
    const service = makeService(prisma, audit, securityEvents);

    const result = await service.rotateClientSecret('finance', 'bic_test', {
      actorType: 'admin_user',
      actorId: 'admin-app',
      source: 'admin_web',
      requestId: 'req-rotate-secret',
      ip: '127.0.0.1',
      userAgent: 'vitest-admin-console'
    });

    expect(result).toEqual({
      clientId: 'bic_test',
      clientSecret: expect.stringMatching(/^bics_/) as unknown
    });
    expect(prisma.applicationClient.update).toHaveBeenCalledWith({
      where: {
        applicationId_clientId: {
          applicationId: 'app-finance',
          clientId: 'bic_test'
        }
      },
      data: expect.objectContaining({
        clientSecretHash: expect.not.stringContaining(result.clientSecret) as unknown,
        clientSecretCiphertext: expect.not.stringContaining(result.clientSecret) as unknown,
        clientSecretIv: expect.any(String) as unknown,
        clientSecretAuthTag: expect.any(String) as unknown,
        clientSecretAlgorithm: 'aes-256-gcm'
      }) as unknown
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        resourceType: 'application_client',
        resourceId: 'client-row-1',
        action: 'rotate_secret',
        after: expect.objectContaining({
          secretShownOnce: true
        }) as unknown
      }) as unknown,
      prisma
    );
    expect(securityEvents.record).toHaveBeenCalledWith({
      eventType: 'secret_rotated',
      applicationId: 'app-finance',
      clientId: 'bic_test',
      result: 'success',
      reasonCode: 'CLIENT_SECRET_ROTATED',
      summary: '应用 client secret 已轮换',
      ip: '127.0.0.1',
      userAgent: 'vitest-admin-console',
      requestId: 'req-rotate-secret'
    }, prisma);
    const auditPayload = JSON.stringify(audit.record.mock.calls);
    expect(auditPayload).not.toContain(result.clientSecret);
    expect(auditPayload).not.toContain('clientSecretHash');
    expect(auditPayload).not.toContain('clientSecretCiphertext');
    expect(auditPayload).not.toContain('old-cipher');
    expect(auditPayload).not.toContain('rotated-cipher');
  });

  it('rotateClientSecretInTransaction 使用调用方事务且不嵌套开启事务', async () => {
    const prisma = makePrisma();
    const audit = makeAudit();
    const securityEvents = makeSecurityEvents();
    mockApplication(prisma);
    prisma.applicationClient.findFirst.mockResolvedValue({
      id: 'client-row-1',
      applicationId: 'app-finance',
      environmentId: 'env-dev',
      clientId: 'bic_test',
      clientSecretHash: 'old-hash',
      clientSecretCiphertext: 'old-cipher',
      clientSecretIv: 'old-iv',
      clientSecretAuthTag: 'old-tag',
      clientSecretAlgorithm: 'aes-256-gcm',
      name: 'Web Client',
      status: 'active'
    });
    prisma.applicationClient.update.mockImplementation((args: { data: Record<string, unknown> }) => ({
      id: 'client-row-1',
      applicationId: 'app-finance',
      environmentId: 'env-dev',
      clientId: 'bic_test',
      clientSecretHash: args.data.clientSecretHash,
      clientSecretCiphertext: args.data.clientSecretCiphertext,
      clientSecretIv: args.data.clientSecretIv,
      clientSecretAuthTag: args.data.clientSecretAuthTag,
      clientSecretAlgorithm: args.data.clientSecretAlgorithm,
      name: 'Web Client',
      status: 'active'
    }));
    const service = makeService(prisma, audit, securityEvents);

    const result = await service.rotateClientSecretInTransaction(
      'finance',
      'bic_test',
      prisma as never,
      {
        actorType: 'admin_user',
        actorId: 'admin-app',
        source: 'admin_web',
        requestId: 'req-rotate-secret-helper',
        ip: '127.0.0.1',
        userAgent: 'vitest-admin-console'
      }
    );

    expect(result.clientSecret).toMatch(/^bics_/);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'rotate_secret',
        requestId: 'req-rotate-secret-helper'
      }) as unknown,
      prisma
    );
    expect(securityEvents.record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'secret_rotated',
        requestId: 'req-rotate-secret-helper'
      }) as unknown,
      prisma
    );
  });

  it('setClientStatus 按 applicationId 和 clientId 禁用 client', async () => {
    const prisma = makePrisma();
    mockApplication(prisma);
    prisma.applicationClient.findFirst.mockResolvedValue({
      id: 'client-row-1',
      applicationId: 'app-finance',
      environmentId: null,
      clientId: 'bic_test',
      clientSecretHash: 'hash-value',
      clientSecretCiphertext: 'cipher-value',
      clientSecretIv: 'iv-value',
      clientSecretAuthTag: 'tag-value',
      clientSecretAlgorithm: 'aes-256-gcm',
      name: 'Web Client',
      status: 'active',
      isPrimary: true,
      revokedAt: null
    });
    prisma.applicationClient.update.mockResolvedValue({
      id: 'client-row-1',
      applicationId: 'app-finance',
      environmentId: null,
      clientId: 'bic_test',
      clientSecretHash: 'hash-value',
      clientSecretCiphertext: 'cipher-value',
      clientSecretIv: 'iv-value',
      clientSecretAuthTag: 'tag-value',
      clientSecretAlgorithm: 'aes-256-gcm',
      name: 'Web Client',
      status: 'disabled',
      isPrimary: true,
      revokedAt: null
    });
    const service = makeService(prisma);

    const updated = await service.setClientStatus('finance', 'bic_test', 'disabled');

    expect(updated).toMatchObject({
      applicationId: 'app-finance',
      clientId: 'bic_test',
      status: 'disabled'
    });
    expect(updated).not.toHaveProperty('clientSecretHash');
    expect(prisma.applicationClient.findFirst).toHaveBeenCalledWith({
      where: {
        applicationId: 'app-finance',
        OR: [
          { id: 'bic_test' },
          { clientId: 'bic_test' }
        ]
      }
    });
    expect(prisma.applicationClient.update).toHaveBeenCalledWith({
      where: {
        applicationId_clientId: {
          applicationId: 'app-finance',
          clientId: 'bic_test'
        }
      },
      data: {
        status: 'disabled'
      }
    });
  });

  it('client secret 操作兼容 OAuth 凭证行 id 引用', async () => {
    const prisma = makePrisma();
    const audit = makeAudit();
    const securityEvents = makeSecurityEvents();
    const vault = new ClientSecretVault('0123456789abcdef0123456789abcdef');
    const encrypted = vault.encrypt('bics_row_id_secret');
    mockApplication(prisma);
    prisma.applicationClient.findFirst.mockResolvedValue({
      id: 'client-row-1',
      applicationId: 'app-finance',
      environmentId: null,
      clientId: 'bic_public_client_id',
      clientSecretHash: 'hash-value',
      clientSecretCiphertext: encrypted.ciphertext,
      clientSecretIv: encrypted.iv,
      clientSecretAuthTag: encrypted.authTag,
      clientSecretAlgorithm: encrypted.algorithm,
      name: '应用登录凭证',
      status: 'active',
      isPrimary: true,
      revokedAt: null
    });
    prisma.applicationClient.update.mockImplementation((args: { data: Record<string, unknown> }) => ({
      id: 'client-row-1',
      applicationId: 'app-finance',
      environmentId: null,
      clientId: 'bic_public_client_id',
      clientSecretHash: args.data.clientSecretHash,
      clientSecretCiphertext: args.data.clientSecretCiphertext,
      clientSecretIv: args.data.clientSecretIv,
      clientSecretAuthTag: args.data.clientSecretAuthTag,
      clientSecretAlgorithm: args.data.clientSecretAlgorithm,
      name: '应用登录凭证',
      status: 'active',
      isPrimary: true,
      revokedAt: null
    }));
    const service = makeService(prisma, audit, securityEvents);

    const viewed = await service.viewClientSecret('finance', 'client-row-1');
    const rotated = await service.rotateClientSecret('finance', 'client-row-1');

    expect(viewed).toEqual({
      clientId: 'bic_public_client_id',
      clientSecret: 'bics_row_id_secret'
    });
    expect(rotated).toEqual({
      clientId: 'bic_public_client_id',
      clientSecret: expect.stringMatching(/^bics_/) as unknown
    });
    expect(prisma.applicationClient.findFirst).toHaveBeenCalledWith({
      where: {
        applicationId: 'app-finance',
        OR: [
          { id: 'client-row-1' },
          { clientId: 'client-row-1' }
        ]
      }
    });
    expect(prisma.applicationClient.update).toHaveBeenCalledWith({
      where: {
        applicationId_clientId: {
          applicationId: 'app-finance',
          clientId: 'bic_public_client_id'
        }
      },
      data: expect.objectContaining({
        clientSecretHash: expect.any(String) as unknown,
        clientSecretCiphertext: expect.any(String) as unknown,
        clientSecretIv: expect.any(String) as unknown,
        clientSecretAuthTag: expect.any(String) as unknown,
        clientSecretAlgorithm: 'aes-256-gcm'
      }) as unknown
    });
    expect(JSON.stringify([
      audit.record.mock.calls,
      securityEvents.record.mock.calls
    ])).not.toContain('bics_row_id_secret');
  });

  it('rotateClientSecret 写安全事件失败时事务回滚，不提交新 secret 或成功审计', async () => {
    const prisma = makePrisma();
    const audit = makeAudit();
    const securityEvents = makeSecurityEvents();
    const oldEncrypted = new ClientSecretVault('0123456789abcdef0123456789abcdef').encrypt('bics_old_secret');
    const committedClient = {
      id: 'client-row-1',
      applicationId: 'app-finance',
      environmentId: 'env-dev',
      clientId: 'bic_test',
      clientSecretHash: 'old-hash',
      clientSecretCiphertext: oldEncrypted.ciphertext,
      clientSecretIv: oldEncrypted.iv,
      clientSecretAuthTag: oldEncrypted.authTag,
      clientSecretAlgorithm: oldEncrypted.algorithm,
      name: 'Web Client',
      status: 'active'
    };
    const committedAudits: unknown[] = [];
    let pendingClient: typeof committedClient | null = null;
    let pendingAudits: unknown[] = [];

    mockApplication(prisma);
    prisma.applicationClient.findFirst.mockResolvedValue(committedClient);
    prisma.applicationClient.update.mockImplementation((args: { data: Partial<typeof committedClient> }) => {
      pendingClient = {
        ...committedClient,
        ...args.data
      };
      return pendingClient;
    });
    audit.record.mockImplementation((payload: unknown) => {
      pendingAudits.push(payload);
      return Promise.resolve();
    });
    securityEvents.record.mockRejectedValue(new Error('security event unavailable'));
    prisma.$transaction.mockImplementation(async (operation: unknown) => {
      if (typeof operation !== 'function') {
        return Promise.resolve(operation);
      }

      pendingClient = null;
      pendingAudits = [];
      try {
        const result = await (operation as (tx: typeof prisma) => Promise<unknown>)(prisma);
        committedAudits.push(...pendingAudits);
        return result;
      } catch (error) {
        pendingClient = null;
        pendingAudits = [];
        throw error;
      }
    });
    const service = makeService(prisma, audit, securityEvents);

    await expect(
      service.rotateClientSecret('finance', 'bic_test', {
        actorType: 'admin_user',
        actorId: 'admin-app',
        source: 'admin_web',
        requestId: 'req-rotate-secret-failed',
        ip: '127.0.0.1',
        userAgent: 'vitest-admin-console'
      })
    ).rejects.toThrow('security event unavailable');

    expect(committedClient.clientSecretHash).toBe('old-hash');
    expect(committedClient.clientSecretCiphertext).toBe(oldEncrypted.ciphertext);
    expect(committedClient.clientSecretIv).toBe(oldEncrypted.iv);
    expect(committedClient.clientSecretAuthTag).toBe(oldEncrypted.authTag);
    expect(committedClient.clientSecretAlgorithm).toBe('aes-256-gcm');
    expect(committedAudits).toEqual([]);
    expect(securityEvents.record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'secret_rotated',
        reasonCode: 'CLIENT_SECRET_ROTATED',
        requestId: 'req-rotate-secret-failed'
      }) as unknown,
      prisma
    );
    const failedPayload = JSON.stringify([
      audit.record.mock.calls,
      securityEvents.record.mock.calls
    ]);
    expect(failedPayload).not.toContain('bics_old_secret');
  });

  it('viewClientSecret 写安全事件失败时事务回滚，不提交成功审计', async () => {
    const prisma = makePrisma();
    const audit = makeAudit();
    const securityEvents = makeSecurityEvents();
    const vault = new ClientSecretVault('0123456789abcdef0123456789abcdef');
    const encrypted = vault.encrypt('bics_viewable_secret');
    const committedAudits: unknown[] = [];
    let pendingAudits: unknown[] = [];

    mockApplication(prisma);
    prisma.applicationClient.findFirst.mockResolvedValue({
      id: 'client-row-1',
      applicationId: 'app-finance',
      environmentId: 'env-dev',
      clientId: 'bic_test',
      clientSecretHash: 'hash-value',
      clientSecretCiphertext: encrypted.ciphertext,
      clientSecretIv: encrypted.iv,
      clientSecretAuthTag: encrypted.authTag,
      clientSecretAlgorithm: encrypted.algorithm,
      name: 'Web Client',
      status: 'active'
    });
    audit.record.mockImplementation((payload: unknown) => {
      pendingAudits.push(payload);
      return Promise.resolve();
    });
    securityEvents.record.mockRejectedValue(new Error('security event unavailable'));
    prisma.$transaction.mockImplementation(async (operation: unknown) => {
      if (typeof operation !== 'function') {
        return Promise.resolve(operation);
      }

      pendingAudits = [];
      try {
        const result = await (operation as (tx: typeof prisma) => Promise<unknown>)(prisma);
        committedAudits.push(...pendingAudits);
        return result;
      } catch (error) {
        pendingAudits = [];
        throw error;
      }
    });
    const service = makeService(prisma, audit, securityEvents);

    await expect(
      service.viewClientSecret('finance', 'bic_test', {
        actorType: 'admin_user',
        actorId: 'admin-app',
        source: 'admin_web',
        requestId: 'req-view-secret-failed',
        ip: '127.0.0.1',
        userAgent: 'vitest-admin-console'
      })
    ).rejects.toThrow('security event unavailable');

    expect(committedAudits).toEqual([]);
    expect(securityEvents.record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'secret_viewed',
        reasonCode: 'CLIENT_SECRET_VIEWED',
        requestId: 'req-view-secret-failed'
      }) as unknown,
      prisma
    );
    const failedPayload = JSON.stringify([
      audit.record.mock.calls,
      securityEvents.record.mock.calls
    ]);
    expect(failedPayload).not.toContain('bics_viewable_secret');
  });
});
