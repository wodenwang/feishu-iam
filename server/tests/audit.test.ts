import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DbPool } from '../src/db/pool';
import { buildTestApp } from './helpers/testApp';
import { createTestPool } from './helpers/testDb';

describe('audit API', () => {
  let pool: DbPool;
  let app: Awaited<ReturnType<typeof buildTestApp>>;

  beforeEach(async () => {
    pool = await createTestPool();
    app = await buildTestApp(pool);
  });

  afterEach(async () => {
    await app.close();
    await pool.end();
  });

  it('allows platform admins to list audit logs', async () => {
    const cookie = await loginAndBindAdmin(app, 'ou_audit_admin_001', '审计管理员');
    const response = await app.inject({ method: 'GET', url: '/api/audit-logs', headers: { cookie } });

    expect(response.statusCode).toBe(200);
    expect(response.json().items.map((item: { action: string }) => item.action)).toContain('platform_admin.bind');
  });

  it('rejects non-admin global audit reads', async () => {
    const cookie = await loginCookie(app, 'ou_audit_user_001', '审计普通用户');
    const response = await app.inject({ method: 'GET', url: '/api/audit-logs', headers: { cookie } });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ code: 'FORBIDDEN' });
  });

  it('returns requestId in audit-related errors', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/audit-logs' });

    expect(response.statusCode).toBe(401);
    expect(response.json().requestId).toEqual(expect.any(String));
  });

  it('lists audit logs with pagination and action/result/keyword filters', async () => {
    const cookie = await loginAndBindAdmin(app, 'ou_audit_admin_filter_001', '审计筛选管理员');

    await app.inject({
      method: 'POST',
      url: '/api/applications',
      headers: { cookie },
      payload: { name: '审计筛选应用' },
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/audit-logs?page=1&pageSize=10&action=application.create&result=success&keyword=application.create',
      headers: { cookie },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      page: 1,
      pageSize: 10,
      total: 1,
    });
    expect(response.json().items).toHaveLength(1);
    expect(response.json().items[0]).toMatchObject({
      action: 'application.create',
      result: 'success',
      request_id: expect.any(String),
    });
  });
});

async function loginAndBindAdmin(app: Awaited<ReturnType<typeof buildTestApp>>, feishuUserId: string, name: string) {
  const cookie = await loginCookie(app, feishuUserId, name);
  await app.inject({ method: 'POST', url: '/api/initialization/bind-platform-admin', headers: { cookie } });
  return cookie;
}

async function loginCookie(app: Awaited<ReturnType<typeof buildTestApp>>, feishuUserId: string, name: string) {
  const login = await app.inject({
    method: 'POST',
    url: '/api/dev/feishu/mock-login',
    payload: { feishuUserId, name },
  });
  return String(login.headers['set-cookie']);
}
