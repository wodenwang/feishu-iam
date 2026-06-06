import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PermissionDomainError } from '../src/permission/permission.types';
import { ApplicationOnboardingService } from '../src/oauth/application-onboarding.service';

describe('ApplicationOnboardingService', () => {
  const tx = {
    id: 'tx-onboarding'
  };
  const prisma = {
    $transaction: vi.fn((callback: (client: typeof tx) => unknown) => Promise.resolve(callback(tx)))
  };
  const applications = {
    createApplication: vi.fn(),
    createApplicationInTransaction: vi.fn()
  };
  const oauthConfig = {
    createRedirectUri: vi.fn(),
    createRedirectUriInTransaction: vi.fn(),
    createPrimaryOauthCredential: vi.fn(),
    createPrimaryOauthCredentialInTransaction: vi.fn()
  };
  const developerCredentials = {
    createCredential: vi.fn(),
    createCredentialInTransaction: vi.fn()
  };
  const prompts = {
    generateFullPrompt: vi.fn()
  };
  const auditContext = {
    actorType: 'admin_user' as const,
    actorId: 'admin-platform',
    source: 'admin_web' as const,
    requestId: 'req-onboarding',
    ip: '127.0.0.1',
    userAgent: 'vitest'
  };

  beforeEach(() => {
    vi.clearAllMocks();
    applications.createApplicationInTransaction.mockResolvedValue({
      id: 'app-finance',
      appKey: 'finance',
      name: '财务系统',
      status: 'active'
    });
    oauthConfig.createRedirectUriInTransaction.mockResolvedValue({
      id: 'redirect-1',
      redirectUri: 'http://localhost:5173/auth/callback',
      status: 'active'
    });
    oauthConfig.createPrimaryOauthCredentialInTransaction.mockResolvedValue({
      id: 'credential-1',
      clientId: 'bic_finance',
      clientSecret: 'bics_secret',
      name: '默认登录凭证',
      status: 'active',
      isPrimary: true,
      clientSecretHash: 'must-not-leak',
      createdAt: new Date('2026-05-22T01:00:00.000Z'),
      updatedAt: new Date('2026-05-22T01:00:00.000Z')
    });
    developerCredentials.createCredentialInTransaction.mockResolvedValue({
      credential: {
        id: 'developer-credential-1',
        applicationId: 'app-finance',
        name: '默认开发者 API 凭证',
        status: 'active',
        createdAt: new Date('2026-05-22T01:00:00.000Z'),
        updatedAt: new Date('2026-05-22T01:00:00.000Z')
      },
      token: 'biad_secret'
    });
    prompts.generateFullPrompt.mockReturnValue('full prompt');
  });

  it('creates application, redirect URI, OAuth credential, developer credential, and full prompt', async () => {
    const service = new ApplicationOnboardingService(
      prisma as never,
      applications as never,
      oauthConfig as never,
      developerCredentials as never,
      prompts as never
    );

    const result = await service.createOnboardingPackage({
      appKey: 'finance',
      name: '财务系统',
      description: '内部财务系统',
      ownerUserId: 'ou_owner',
      redirectUris: ['http://localhost:5173/auth/callback']
    }, auditContext);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(applications.createApplicationInTransaction).toHaveBeenCalledWith(
      {
        appKey: 'finance',
        name: '财务系统',
        description: '内部财务系统',
        ownerUserId: 'ou_owner'
      },
      tx,
      auditContext
    );
    expect(oauthConfig.createRedirectUriInTransaction).toHaveBeenCalledWith(
      'finance',
      { redirectUri: 'http://localhost:5173/auth/callback' },
      tx,
      auditContext
    );
    expect(oauthConfig.createPrimaryOauthCredentialInTransaction).toHaveBeenCalledWith(
      'finance',
      { name: '默认登录凭证' },
      tx,
      auditContext
    );
    expect(developerCredentials.createCredentialInTransaction).toHaveBeenCalledWith(
      'finance',
      '默认开发者 API 凭证',
      tx,
      auditContext
    );
    expect(prompts.generateFullPrompt).toHaveBeenCalledWith(expect.objectContaining({
      appKey: 'finance',
      applicationName: '财务系统',
      redirectUris: ['http://localhost:5173/auth/callback'],
      clientId: 'bic_finance',
      clientSecret: 'bics_secret',
      developerApiToken: 'biad_secret'
    }));
    expect(result.clientSecret).toBe('bics_secret');
    expect(result.developerApiToken).toBe('biad_secret');
    expect(result.integrationPrompt).toBe('full prompt');
    expect(JSON.stringify(result)).not.toContain('must-not-leak');
    expect(JSON.stringify(result)).not.toContain('tokenHash');
    expect(applications.createApplication).not.toHaveBeenCalled();
    expect(oauthConfig.createRedirectUri).not.toHaveBeenCalled();
    expect(oauthConfig.createPrimaryOauthCredential).not.toHaveBeenCalled();
    expect(developerCredentials.createCredential).not.toHaveBeenCalled();
  });

  it('rejects empty redirect URIs before creating anything', async () => {
    const service = new ApplicationOnboardingService(
      prisma as never,
      applications as never,
      oauthConfig as never,
      developerCredentials as never,
      prompts as never
    );

    await expect(service.createOnboardingPackage({
      appKey: 'finance',
      name: '财务系统',
      redirectUris: []
    }, auditContext)).rejects.toMatchObject({
      code: 'APPLICATION_REDIRECT_URI_REQUIRED',
      message: '至少需要一个回调地址',
      status: 400
    } satisfies Partial<PermissionDomainError>);

    expect(applications.createApplication).not.toHaveBeenCalled();
    expect(applications.createApplicationInTransaction).not.toHaveBeenCalled();
    expect(oauthConfig.createRedirectUriInTransaction).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rolls back the single transaction when developer credential creation fails', async () => {
    developerCredentials.createCredentialInTransaction.mockRejectedValue(new Error('developer credential failed'));
    const service = new ApplicationOnboardingService(
      prisma as never,
      applications as never,
      oauthConfig as never,
      developerCredentials as never,
      prompts as never
    );

    await expect(service.createOnboardingPackage({
      appKey: 'finance',
      name: '财务系统',
      redirectUris: ['http://localhost:5173/auth/callback']
    }, auditContext)).rejects.toThrow('developer credential failed');

    expect(applications.createApplicationInTransaction).toHaveBeenCalledWith(expect.any(Object), tx, auditContext);
    expect(oauthConfig.createRedirectUriInTransaction).toHaveBeenCalledWith(
      'finance',
      { redirectUri: 'http://localhost:5173/auth/callback' },
      tx,
      auditContext
    );
    expect(oauthConfig.createPrimaryOauthCredentialInTransaction).toHaveBeenCalledWith(
      'finance',
      { name: '默认登录凭证' },
      tx,
      auditContext
    );
    expect(developerCredentials.createCredentialInTransaction).toHaveBeenCalledWith(
      'finance',
      '默认开发者 API 凭证',
      tx,
      auditContext
    );
    expect(prompts.generateFullPrompt).not.toHaveBeenCalled();
    expect(applications.createApplication).not.toHaveBeenCalled();
    expect(oauthConfig.createRedirectUri).not.toHaveBeenCalled();
    expect(oauthConfig.createPrimaryOauthCredential).not.toHaveBeenCalled();
    expect(developerCredentials.createCredential).not.toHaveBeenCalled();
  });

  it('rolls back the single transaction when prompt generation fails', async () => {
    prompts.generateFullPrompt.mockImplementation(() => {
      throw new Error('prompt failed');
    });
    const service = new ApplicationOnboardingService(
      prisma as never,
      applications as never,
      oauthConfig as never,
      developerCredentials as never,
      prompts as never
    );

    await expect(service.createOnboardingPackage({
      appKey: 'finance',
      name: '财务系统',
      redirectUris: ['http://localhost:5173/auth/callback']
    }, auditContext)).rejects.toThrow('prompt failed');

    expect(developerCredentials.createCredentialInTransaction).toHaveBeenCalledWith(
      'finance',
      '默认开发者 API 凭证',
      tx,
      auditContext
    );
    expect(prompts.generateFullPrompt).toHaveBeenCalled();
    expect(applications.createApplication).not.toHaveBeenCalled();
    expect(oauthConfig.createRedirectUri).not.toHaveBeenCalled();
    expect(oauthConfig.createPrimaryOauthCredential).not.toHaveBeenCalled();
    expect(developerCredentials.createCredential).not.toHaveBeenCalled();
  });
});
