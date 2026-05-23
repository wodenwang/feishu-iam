import { beforeEach, describe, expect, it } from 'vitest';
import {
  batchDisableApplications,
  createApplication,
  getCurrentSession,
  listApplications,
  listAuditLogs,
  resetMockIamStore,
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

  it('records auditable secret copy events', async () => {
    const logs = await listAuditLogs({ action: 'secret.copy', page: 1, pageSize: 20 });

    expect(logs.items[0]).toMatchObject({
      action: 'secret.copy',
      actorFeishuUserId: 'ou_feishu_admin_001',
      requestId: expect.stringMatching(/^req_/),
    });
  });
});
