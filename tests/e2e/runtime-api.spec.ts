import { expect, test } from '@playwright/test';

test.describe('v0.1.1 runtime API smoke', () => {
  test('mock Feishu login, bind admin, create app, and read audit logs', async ({ request }, testInfo) => {
    const runtimeBaseUrl = process.env.RUNTIME_API_BASE_URL ?? 'http://127.0.0.1:4100';
    const suffix = `${testInfo.project.name}_${Date.now()}`;
    const login = await request.post(`${runtimeBaseUrl}/api/dev/feishu/mock-login`, {
      data: {
        feishuUserId: 'ou_v012_verify_admin',
        name: '运行时管理员',
        email: 'runtime-admin@example.com',
      },
    });
    expect(login.ok()).toBe(true);

    const cookie = login.headers()['set-cookie'];
    expect(cookie).toContain('iam_session=');

    const bind = await request.post(`${runtimeBaseUrl}/api/initialization/bind-platform-admin`, {
      headers: { cookie },
    });
    expect(bind.ok()).toBe(true);

    const app = await request.post(`${runtimeBaseUrl}/api/applications`, {
      headers: { cookie },
      data: { name: `v0.1.1 Runtime Demo ${suffix}` },
    });
    expect(app.ok()).toBe(true);
    const appJson = await app.json();
    expect(appJson.appSecret).toMatch(/^sec_/);

    const audit = await request.get(`${runtimeBaseUrl}/api/audit-logs`, {
      headers: { cookie },
    });
    expect(audit.ok()).toBe(true);
    const auditJson = await audit.json();
    expect(auditJson.items.map((item: { action: string }) => item.action)).toContain('application.create');
  });
});
