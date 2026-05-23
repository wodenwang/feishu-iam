import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DbPool } from '../src/db/pool';
import { buildTestApp } from './helpers/testApp';
import { createTestPool } from './helpers/testDb';

describe('applications API', () => {
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

  it('rejects unauthenticated application creation', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/applications',
      payload: { name: '未登录应用' },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('rejects non-admin application creation', async () => {
    const cookie = await loginCookie(app, 'ou_app_non_admin_001', '普通用户');
    const response = await app.inject({
      method: 'POST',
      url: '/api/applications',
      headers: { cookie },
      payload: { name: '普通用户应用' },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ code: 'FORBIDDEN' });
  });

  it('lets platform admins create applications with a one-time secret and audit log', async () => {
    const cookie = await loginAndBindAdmin(app, 'ou_app_admin_001', '应用管理员');
    const response = await app.inject({
      method: 'POST',
      url: '/api/applications',
      headers: { cookie },
      payload: { name: '运行时应用' },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body).toMatchObject({
      name: '运行时应用',
      status: 'active',
    });
    expect(body.app_key).toMatch(/^app_/);
    expect(body.appSecret).toMatch(/^sec_/);

    const secrets = await pool.query('select secret_hash from application_secrets where application_id = $1', [body.id]);
    const audit = await pool.query("select action, metadata::text as metadata from audit_logs where action = 'application.create'");
    expect(secrets.rows[0].secret_hash).not.toBe(body.appSecret);
    expect(audit.rows[0].action).toBe('application.create');
    expect(audit.rows[0].metadata).not.toContain(body.appSecret);
  });

  it('rejects duplicate application names', async () => {
    const cookie = await loginAndBindAdmin(app, 'ou_app_admin_002', '应用管理员二');

    await app.inject({ method: 'POST', url: '/api/applications', headers: { cookie }, payload: { name: '重复应用' } });
    const duplicate = await app.inject({
      method: 'POST',
      url: '/api/applications',
      headers: { cookie },
      payload: { name: '重复应用' },
    });

    expect(duplicate.statusCode).toBe(409);
    expect(duplicate.json()).toMatchObject({ code: 'APPLICATION_NAME_EXISTS' });
  });

  it('rejects duplicate application names regardless of case', async () => {
    const cookie = await loginAndBindAdmin(app, 'ou_app_admin_003', '应用管理员三');

    await app.inject({ method: 'POST', url: '/api/applications', headers: { cookie }, payload: { name: 'Case App' } });
    const duplicate = await app.inject({
      method: 'POST',
      url: '/api/applications',
      headers: { cookie },
      payload: { name: 'case app' },
    });

    expect(duplicate.statusCode).toBe(409);
    expect(duplicate.json()).toMatchObject({ code: 'APPLICATION_NAME_EXISTS' });
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
