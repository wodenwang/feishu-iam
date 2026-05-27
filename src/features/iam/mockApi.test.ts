import { beforeEach, describe, expect, it } from 'vitest';
import {
  batchDisableApplications,
  addApplicationAdmin,
  copyApplicationDiagnostics,
  createApplication,
  createApplicationRedirectUri,
  createRole,
  disableRoles,
  getApplicationDiagnostics,
  getCurrentSession,
  listApplicationAdmins,
  listApplicationRedirectUris,
  listApplications,
  listAuditLogs,
  listRoles,
  listSyncRuns,
  removeApplicationAdmin,
  resetMockIamStore,
  rotateApplicationSecret,
  updateApplicationRedirectUriStatus,
  updateRole,
  updateRoleAuthorization,
} from './mockApi';
import { applications as fixtureApplications } from './mockData';

describe('iam mock API', () => {
  beforeEach(() => {
    resetMockIamStore();
  });

  it('returns a Feishu-backed platform admin session', async () => {
    const session = await getCurrentSession();

    expect(session.user.feishuUserId).toBe('ou_feishu_admin_001');
    expect(session.user.displayName).toBe('王文哲');
    expect(session.roles).toContain('platform_admin');
    expect(session.permissions).toContain('application:create');
  });

  it('returns a session copy that callers cannot use to mutate fixtures', async () => {
    const session = await getCurrentSession();

    session.user.displayName = '被污染的用户';
    session.roles.push('application_admin');
    session.permissions.length = 0;
    session.applicationIds.push('app_mutated_by_test');

    const freshSession = await getCurrentSession();
    expect(freshSession.user.displayName).toBe('王文哲');
    expect(freshSession.roles).toEqual(['platform_admin']);
    expect(freshSession.permissions).toContain('application:create');
    expect(freshSession.applicationIds).toEqual(['app_demo_crm']);
  });

  it('creates an application without exposing real secrets in the agent prompt', async () => {
    const app = await createApplication({
      name: 'New CRM',
      code: 'new-crm',
      callbackUrls: ['https://demo.example.com/auth/callback'],
      allowedOrigins: ['https://demo.example.com'],
      ownerFeishuUserId: 'ou_feishu_admin_001',
    });

    expect(app.appKey).toMatch(/^app_/);
    expect(app.agentPrompt).toContain('IAM_APP_SECRET');
    expect(app.agentPrompt).toContain('IAM_API_SECRET');
    expect(app.agentPrompt).not.toContain(app.appSecretPreview);
    expect(app.agentPrompt).not.toContain(app.apiSecretPreview);
  });

  it('creates a unique id when code already exists and keeps fixture data unchanged', async () => {
    const fixtureLength = fixtureApplications.length;
    const existingIds = fixtureApplications.map((item) => item.id);

    const app = await createApplication({
      name: 'Demo CRM Copy',
      code: 'demo-crm',
      callbackUrls: ['https://copy.example.com/auth/callback'],
      allowedOrigins: ['https://copy.example.com'],
      ownerFeishuUserId: 'ou_feishu_admin_001',
    });
    const result = await listApplications({ page: 1, pageSize: 20 });
    const ids = result.items.map((item) => item.id);

    expect(app.id).not.toBe('app_demo_crm');
    expect(existingIds).toContain('app_demo_crm');
    expect(new Set(ids).size).toBe(ids.length);
    expect(fixtureApplications).toHaveLength(fixtureLength);
  });

  it('filters applications by keyword', async () => {
    const result = await listApplications({ keyword: 'CRM', page: 1, pageSize: 20 });

    expect(result.items.every((item) => item.name.includes('CRM') || item.code.includes('crm'))).toBe(true);
  });

  it('batch disables applications and reset restores active fixture state', async () => {
    const disabledApps = await batchDisableApplications(['app_demo_crm']);

    expect(disabledApps).toHaveLength(1);
    expect(disabledApps[0]).toMatchObject({ id: 'app_demo_crm', status: 'disabled' });

    const disabledResult = await listApplications({ page: 1, pageSize: 20 });
    expect(disabledResult.items.find((item) => item.id === 'app_demo_crm')?.status).toBe('disabled');

    resetMockIamStore();
    const resetResult = await listApplications({ page: 1, pageSize: 20 });
    expect(resetResult.items.find((item) => item.id === 'app_demo_crm')?.status).toBe('active');
  });

  it('persists role create, edit, authorization, and disable mutations', async () => {
    const createdRole = await createRole({
      applicationId: 'app_demo_crm',
      name: '客服主管',
      code: 'support-manager',
      description: '客服团队授权',
      status: 'active',
    });

    expect(createdRole).toMatchObject({
      applicationId: 'app_demo_crm',
      applicationName: 'Demo CRM',
      name: '客服主管',
      status: 'active',
    });

    await updateRole(createdRole.id, {
      applicationId: 'app_demo_crm',
      name: '客服经理',
      code: 'support-manager',
      description: '客服经理授权',
      status: 'active',
    });
    await updateRoleAuthorization({
      roleId: createdRole.id,
      permissionKeys: ['crm.customer', 'crm.customer:read', 'crm.contract:read'],
      departmentIds: ['dept_sales'],
      userIds: ['ou_sales_001'],
    });
    await disableRoles([createdRole.id]);

    const roles = await listRoles({ keyword: '客服经理', page: 1, pageSize: 20 });
    expect(roles.items[0]).toMatchObject({
      id: createdRole.id,
      name: '客服经理',
      status: 'disabled',
      permissionGroupCount: 1,
      permissionPointCount: 2,
      departmentBindingCount: 1,
      userBindingCount: 1,
      permissionKeys: ['crm.customer', 'crm.customer:read', 'crm.contract:read'],
    });

    const auditLogs = await listAuditLogs({ action: 'role.update', page: 1, pageSize: 20 });
    expect(auditLogs.items.length).toBeGreaterThanOrEqual(4);
  });

  it('records auditable secret copy events', async () => {
    const logs = await listAuditLogs({ action: 'secret.copy', page: 1, pageSize: 20 });

    expect(logs.items[0]).toMatchObject({
      action: 'secret.copy',
      actorFeishuUserId: 'ou_feishu_admin_001',
      requestId: expect.stringMatching(/^req_/),
    });
  });

  it('returns diagnostics and records copy events without secret plaintext', async () => {
    const diagnostics = await getApplicationDiagnostics('app_demo_crm');
    await copyApplicationDiagnostics('app_demo_crm');
    const logs = await listAuditLogs({ action: 'application.diagnostics.copy', page: 1, pageSize: 20 });

    expect(diagnostics).toMatchObject({
      applicationId: 'app_demo_crm',
      status: 'healthy',
      secrets: {
        appSecret: { status: 'issued' },
        apiSecret: { status: 'issued' },
      },
    });
    expect(diagnostics.findings).toHaveLength(0);
    expect(JSON.stringify(diagnostics)).not.toContain('sec_****_crm');
    expect(JSON.stringify(diagnostics)).not.toContain('api_****_crm');
    expect(logs.items[0]).toMatchObject({
      action: 'application.diagnostics.copy',
      applicationId: 'app_demo_crm',
      message: '复制接入诊断包',
    });
  });

  it('manages redirect URI lifecycle and keeps application summary counts current', async () => {
    const created = await createApplicationRedirectUri('app_demo_crm', {
      redirectUri: 'https://staging.example.com/auth/callback',
      environment: 'staging',
      note: '预发环境',
    });

    expect(created).toMatchObject({ status: 'active', environment: 'staging' });
    await updateApplicationRedirectUriStatus('app_demo_crm', {
      redirectUri: 'https://demo.example.com/auth/callback',
      status: 'disabled',
    });

    const redirectUris = await listApplicationRedirectUris('app_demo_crm');
    expect(redirectUris).toHaveLength(2);
    expect(redirectUris.find((item) => item.redirectUri === 'https://demo.example.com/auth/callback')).toMatchObject({
      status: 'disabled',
      disabledAt: expect.any(String),
    });

    const application = (await listApplications({ keyword: 'CRM', page: 1, pageSize: 20 })).items[0];
    expect(application).toMatchObject({ redirectUriCount: 2, activeRedirectUriCount: 1 });

    const auditLogs = await listAuditLogs({ applicationId: 'app_demo_crm', page: 1, pageSize: 20 });
    expect(auditLogs.items.map((item) => item.action)).toEqual(
      expect.arrayContaining(['oauth.redirect_uri.create', 'oauth.redirect_uri.disable']),
    );
  });

  it('rotates secrets with one-time values and audit trail only', async () => {
    const appSecretResult = await rotateApplicationSecret('app_demo_crm', 'app_secret');
    const apiSecretResult = await rotateApplicationSecret('app_demo_crm', 'api_secret');

    expect(appSecretResult).toMatchObject({ kind: 'app_secret', secret: expect.stringMatching(/^sec_mock_/) });
    expect(apiSecretResult).toMatchObject({ kind: 'api_secret', secret: expect.stringMatching(/^api_sec_mock_/) });

    const application = (await listApplications({ keyword: 'CRM', page: 1, pageSize: 20 })).items[0];
    expect(application.appSecretRotatedAt).toBeTruthy();
    expect(application.apiSecretRotatedAt).toBeTruthy();

    const auditLogs = await listAuditLogs({ action: 'secret.rotate', page: 1, pageSize: 20 });
    expect(auditLogs.items).toHaveLength(2);
    expect(JSON.stringify(auditLogs.items)).not.toContain(appSecretResult.secret);
    expect(JSON.stringify(auditLogs.items)).not.toContain(apiSecretResult.secret);
  });

  it('manages application admins and protects the last admin', async () => {
    await expect(removeApplicationAdmin('app_demo_crm', 'ou_feishu_admin_001')).rejects.toThrow('LAST_APPLICATION_ADMIN');

    const added = await addApplicationAdmin('app_demo_crm', { feishuUserId: 'ou_sales_001' });
    expect(added).toMatchObject({
      applicationId: 'app_demo_crm',
      feishuUserId: 'ou_sales_001',
      role: 'application_admin',
    });

    await removeApplicationAdmin('app_demo_crm', 'ou_sales_001');
    const admins = await listApplicationAdmins('app_demo_crm');
    expect(admins).toEqual([expect.objectContaining({ feishuUserId: 'ou_feishu_admin_001', role: 'primary' })]);

    const application = (await listApplications({ keyword: 'CRM', page: 1, pageSize: 20 })).items[0];
    expect(application.adminCount).toBe(1);

    const auditLogs = await listAuditLogs({ applicationId: 'app_demo_crm', page: 1, pageSize: 20 });
    expect(auditLogs.items.map((item) => item.action)).toEqual(
      expect.arrayContaining(['application.admin.add', 'application.admin.remove']),
    );
  });

  it('keeps sync run audit links consistent with run status', async () => {
    const syncRuns = await listSyncRuns({ page: 1, pageSize: 20 });
    const auditLogs = await listAuditLogs({ page: 1, pageSize: 20 });

    const successRun = syncRuns.items.find((item) => item.id === 'sync_run_202605230000');
    const successAudit = auditLogs.items.find((item) => item.id === successRun?.auditLogId);
    const failedRun = syncRuns.items.find((item) => item.id === 'sync_run_202605230035');
    const failedAudit = auditLogs.items.find((item) => item.id === failedRun?.auditLogId);

    expect(successRun).toMatchObject({ status: 'succeeded', requestId: 'req_sync_success_001' });
    expect(successAudit).toMatchObject({ action: 'sync.run', result: 'success', requestId: 'req_sync_success_001' });
    expect(failedRun).toMatchObject({ status: 'failed', requestId: 'req_sync_failed_001' });
    expect(failedAudit).toMatchObject({ action: 'sync.run', result: 'failed', requestId: 'req_sync_failed_001' });
  });
});
