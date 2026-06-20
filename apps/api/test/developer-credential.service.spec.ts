import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DeveloperCredentialService } from '../src/oauth/developer-credential.service';
import { hashOauthSecret } from '../src/oauth/oauth-crypto';

type CreateCredentialArgs = {
  data: {
    applicationId: string;
    tokenHash: string;
    name: string;
    status: string;
  };
};

type UpdateCredentialArgs = {
  where: {
    id: string;
  };
  data: {
    lastUsedAt?: Date;
    tokenHash?: string;
    status?: string;
    rotatedAt?: Date;
  };
};

type AuditEntry = {
  actorType?: string;
  actorId?: string;
  source?: string;
  applicationId?: string;
  resourceType?: string;
  action?: string;
  after?: {
    id?: string;
    tokenShownOnce?: boolean;
  };
};

describe('DeveloperCredentialService', () => {
  const application = {
    id: 'app-finance',
    appKey: 'finance',
    name: '财务系统',
    status: 'active'
  };
  const createdCredential = {
    id: 'developer-credential-1',
    applicationId: 'app-finance',
    tokenHash: 'stored-hash',
    name: '默认开发者 API 凭证',
    status: 'active',
    lastUsedAt: null,
    rotatedAt: null,
    createdAt: new Date('2026-05-22T01:00:00.000Z'),
    updatedAt: new Date('2026-05-22T01:00:00.000Z')
  };
  const tx = {
    applicationDeveloperCredential: {
      create: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn()
    },
    auditLog: {
      create: vi.fn()
    }
  };
  const prisma = {
    $transaction: vi.fn((callback: (client: typeof tx) => unknown) => Promise.resolve(callback(tx))),
    applicationDeveloperCredential: {
      findUnique: vi.fn(),
      update: vi.fn()
    }
  };
  const applications = {
    getApplicationByKey: vi.fn()
  };
  const audit = {
    record: vi.fn()
  };
  const securityEvents = {
    record: vi.fn()
  };
  const auditContext = {
    actorType: 'admin_user' as const,
    actorId: 'admin-platform',
    source: 'admin_web' as const,
    requestId: 'req-developer-credential',
    ip: '127.0.0.1',
    userAgent: 'vitest'
  };

  beforeEach(() => {
    vi.clearAllMocks();
    applications.getApplicationByKey.mockResolvedValue(application);
    prisma.applicationDeveloperCredential.findUnique.mockResolvedValue(null);
    prisma.applicationDeveloperCredential.update.mockResolvedValue(undefined);
    securityEvents.record.mockResolvedValue(undefined);
    tx.applicationDeveloperCredential.create.mockImplementation((args: CreateCredentialArgs) => Promise.resolve({
      ...createdCredential,
      tokenHash: args.data.tokenHash,
      name: args.data.name
    }));
    tx.applicationDeveloperCredential.findMany.mockResolvedValue([createdCredential]);
    tx.applicationDeveloperCredential.update.mockImplementation((args: UpdateCredentialArgs) => Promise.resolve({
      ...createdCredential,
      tokenHash: args.data.tokenHash ?? createdCredential.tokenHash,
      status: args.data.status ?? createdCredential.status,
      rotatedAt: args.data.rotatedAt ?? createdCredential.rotatedAt
    }));
  });

  it('creates a developer credential with hashed token and never returns tokenHash', async () => {
    const service = new DeveloperCredentialService(prisma as never, applications as never, audit as never, securityEvents as never);

    const result = await service.createCredential('finance', '默认开发者 API 凭证', auditContext);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(applications.getApplicationByKey).toHaveBeenCalledWith('finance', tx);
    expect(result.token).toMatch(/^biad_/);
    expect(result.credential).not.toHaveProperty('tokenHash');
    const createCalls = tx.applicationDeveloperCredential.create.mock.calls as Array<[CreateCredentialArgs]>;
    const createData = createCalls[0]?.[0].data;
    expect(typeof createData?.tokenHash).toBe('string');
    expect(createData).toMatchObject({
      applicationId: 'app-finance',
      tokenHash: hashOauthSecret(result.token),
      name: '默认开发者 API 凭证',
      status: 'active'
    });

    const auditCalls = audit.record.mock.calls as Array<[unknown, unknown]>;
    const auditPayload = JSON.stringify(auditCalls[0]);
    expect(auditPayload).not.toContain(result.token);
    expect(auditPayload).not.toContain(hashOauthSecret(result.token));
    expect(auditPayload).not.toContain('tokenHash');
    const auditEntry = auditCalls[0]?.[0] as AuditEntry;
    expect(auditEntry).toMatchObject({
      actorType: 'admin_user',
      actorId: 'admin-platform',
      source: 'admin_web',
      applicationId: 'app-finance',
      resourceType: 'application_developer_credential',
      action: 'create',
      after: {
        id: 'developer-credential-1',
        tokenShownOnce: true
      }
    });
    expect(auditCalls[0]?.[1]).toBe(tx);
  });

  it('helper uses caller transaction without opening a nested transaction', async () => {
    const service = new DeveloperCredentialService(prisma as never, applications as never, audit as never, securityEvents as never);

    await service.createCredentialInTransaction('finance', '默认开发者 API 凭证', tx as never, auditContext);

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(applications.getApplicationByKey).toHaveBeenCalledWith('finance', tx);
  });

  it('rotates the primary developer credential without leaking plaintext token or token hash to audit', async () => {
    const service = new DeveloperCredentialService(prisma as never, applications as never, audit as never, securityEvents as never);

    const result = await service.rotatePrimaryCredential('finance', auditContext);

    expect(result.token).toMatch(/^biad_/);
    expect(result.credential).not.toHaveProperty('tokenHash');
    expect(tx.applicationDeveloperCredential.findMany).toHaveBeenCalledWith({
      where: { applicationId: 'app-finance' },
      orderBy: [{ status: 'asc' }, { createdAt: 'asc' }]
    });
    const updateCalls = tx.applicationDeveloperCredential.update.mock.calls as Array<[UpdateCredentialArgs]>;
    expect(updateCalls[0]?.[0].where).toEqual({ id: 'developer-credential-1' });
    expect(updateCalls[0]?.[0].data).toMatchObject({
      tokenHash: hashOauthSecret(result.token),
      status: 'active'
    });
    expect(updateCalls[0]?.[0].data.rotatedAt).toBeInstanceOf(Date);

    const auditPayload = JSON.stringify(audit.record.mock.calls);
    expect(auditPayload).not.toContain(result.token);
    expect(auditPayload).not.toContain(hashOauthSecret(result.token));
    expect(auditPayload).not.toContain('tokenHash');
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({
      applicationId: 'app-finance',
      resourceType: 'application_developer_credential',
      resourceId: 'developer-credential-1',
      action: 'rotate_secret',
      after: expect.objectContaining({
        id: 'developer-credential-1',
        tokenShownOnce: true
      }) as unknown
    }), tx);
  });

  it('rotation helper uses caller transaction without opening a nested transaction', async () => {
    const service = new DeveloperCredentialService(prisma as never, applications as never, audit as never, securityEvents as never);

    const result = await service.rotatePrimaryCredentialInTransaction('finance', tx as never, auditContext);

    expect(result.token).toMatch(/^biad_/);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(applications.getApplicationByKey).toHaveBeenCalledWith('finance', tx);
    expect(tx.applicationDeveloperCredential.update).toHaveBeenCalled();
  });

  it('creates a default developer credential when refresh has no existing credential', async () => {
    tx.applicationDeveloperCredential.findMany.mockResolvedValue([]);
    const service = new DeveloperCredentialService(prisma as never, applications as never, audit as never, securityEvents as never);

    const result = await service.rotatePrimaryCredential('finance', auditContext);

    expect(result.token).toMatch(/^biad_/);
    expect(tx.applicationDeveloperCredential.create).toHaveBeenCalled();
    expect(tx.applicationDeveloperCredential.update).not.toHaveBeenCalled();
  });

  it('maps duplicate token hash to a stable domain error', async () => {
    tx.applicationDeveloperCredential.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test'
      })
    );
    const service = new DeveloperCredentialService(prisma as never, applications as never, audit as never, securityEvents as never);

    await expect(
      service.createCredentialInTransaction('finance', '默认开发者 API 凭证', tx as never, auditContext)
    ).rejects.toMatchObject({
      code: 'DEVELOPER_CREDENTIAL_CONFLICT',
      message: '开发者 API 凭证已存在',
      status: 409
    });

    expect(audit.record).not.toHaveBeenCalled();
  });

  it('verifies active developer token and records usage', async () => {
    const token = 'biad_test_token';
    prisma.applicationDeveloperCredential.findUnique.mockResolvedValue({
      ...createdCredential,
      tokenHash: hashOauthSecret(token),
      application
    });
    const service = new DeveloperCredentialService(prisma as never, applications as never, audit as never, securityEvents as never);

    const context = await service.verifyBearerToken(token, {
      requestId: 'req-verify',
      ip: '127.0.0.1',
      userAgent: 'vitest'
    });

    expect(context).toEqual({
      credentialId: 'developer-credential-1',
      applicationId: 'app-finance',
      appKey: 'finance'
    });
    expect(prisma.applicationDeveloperCredential.findUnique).toHaveBeenCalledWith({
      where: { tokenHash: hashOauthSecret(token) },
      include: { application: true }
    });
    const updateCalls = prisma.applicationDeveloperCredential.update.mock.calls as Array<[UpdateCredentialArgs]>;
    expect(updateCalls[0]?.[0].where).toEqual({ id: 'developer-credential-1' });
    expect(updateCalls[0]?.[0].data.lastUsedAt).toBeInstanceOf(Date);
    expect(securityEvents.record).not.toHaveBeenCalled();
  });

  it('rejects invalid developer token and records security event without plaintext token', async () => {
    const token = 'biad_invalid_plaintext';
    prisma.applicationDeveloperCredential.findUnique.mockResolvedValue(null);
    const service = new DeveloperCredentialService(prisma as never, applications as never, audit as never, securityEvents as never);

    await expect(service.verifyBearerToken(token, {
      requestId: 'req-invalid',
      ip: '127.0.0.1',
      userAgent: 'vitest'
    })).rejects.toMatchObject({
      code: 'DEVELOPER_CREDENTIAL_INVALID',
      message: '开发者 API 凭证无效',
      status: 401
    });

    expect(prisma.applicationDeveloperCredential.update).not.toHaveBeenCalled();
    expect(prisma.applicationDeveloperCredential.findUnique).toHaveBeenCalledWith({
      where: { tokenHash: hashOauthSecret(token) },
      include: { application: true }
    });
    expect(securityEvents.record).toHaveBeenCalledWith(expect.objectContaining({
      eventType: 'developer_api_credential_invalid',
      result: 'failed',
      reasonCode: 'DEVELOPER_CREDENTIAL_INVALID',
      summary: '开发者 API 凭证无效',
      requestId: 'req-invalid'
    }));
    expect(JSON.stringify(securityEvents.record.mock.calls)).not.toContain(token);
  });

  it('rejects disabled developer credential and records security event without plaintext token', async () => {
    const token = 'biad_inactive_credential';
    prisma.applicationDeveloperCredential.findUnique.mockResolvedValue({
      ...createdCredential,
      status: 'disabled',
      tokenHash: hashOauthSecret(token),
      application
    });
    const service = new DeveloperCredentialService(prisma as never, applications as never, audit as never, securityEvents as never);

    await expect(service.verifyBearerToken(token, {
      requestId: 'req-inactive',
      ip: '127.0.0.1',
      userAgent: 'vitest'
    })).rejects.toMatchObject({
      code: 'DEVELOPER_CREDENTIAL_DISABLED',
      message: '开发者 API 凭证已停用',
      status: 403
    });

    expect(prisma.applicationDeveloperCredential.update).not.toHaveBeenCalled();
    expect(securityEvents.record).toHaveBeenCalledWith(expect.objectContaining({
      applicationId: 'app-finance',
      eventType: 'developer_api_credential_invalid',
      result: 'failed',
      reasonCode: 'DEVELOPER_CREDENTIAL_DISABLED',
      requestId: 'req-inactive'
    }));
    expect(JSON.stringify(securityEvents.record.mock.calls)).not.toContain(token);
  });

  it('rejects credentials for disabled application and records security event without plaintext token', async () => {
    const token = 'biad_disabled_application';
    prisma.applicationDeveloperCredential.findUnique.mockResolvedValue({
      ...createdCredential,
      tokenHash: hashOauthSecret(token),
      application: {
        ...application,
        status: 'disabled'
      }
    });
    const service = new DeveloperCredentialService(prisma as never, applications as never, audit as never, securityEvents as never);

    await expect(service.verifyBearerToken(token, {
      requestId: 'req-disabled',
      ip: '127.0.0.1',
      userAgent: 'vitest'
    })).rejects.toMatchObject({
      code: 'DEVELOPER_APPLICATION_DISABLED',
      message: '开发者 API 所属应用已停用',
      status: 403
    });

    expect(prisma.applicationDeveloperCredential.update).not.toHaveBeenCalled();
    expect(securityEvents.record).toHaveBeenCalledWith(expect.objectContaining({
      applicationId: 'app-finance',
      eventType: 'developer_api_credential_invalid',
      result: 'failed',
      reasonCode: 'DEVELOPER_APPLICATION_DISABLED',
      requestId: 'req-disabled'
    }));
    expect(JSON.stringify(securityEvents.record.mock.calls)).not.toContain(token);
  });

  it('returns stable invalid credential error when security event write fails', async () => {
    const token = 'biad_security_event_unavailable';
    const writeError = new Error('security event unavailable');
    prisma.applicationDeveloperCredential.findUnique.mockResolvedValue(null);
    securityEvents.record.mockRejectedValue(writeError);
    const service = new DeveloperCredentialService(prisma as never, applications as never, audit as never, securityEvents as never);

    await expect(service.verifyBearerToken(token, {
      requestId: 'req-security-event-failed',
      ip: '127.0.0.1',
      userAgent: 'vitest'
    })).rejects.toMatchObject({
      code: 'DEVELOPER_CREDENTIAL_INVALID',
      message: '开发者 API 凭证无效',
      status: 401
    });

    expect(prisma.applicationDeveloperCredential.update).not.toHaveBeenCalled();
    expect(securityEvents.record).toHaveBeenCalledWith(expect.objectContaining({
      eventType: 'developer_api_credential_invalid',
      result: 'failed',
      reasonCode: 'DEVELOPER_CREDENTIAL_INVALID',
      requestId: 'req-security-event-failed'
    }));
    expect(JSON.stringify(securityEvents.record.mock.calls)).not.toContain(token);
  });
});
