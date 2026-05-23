import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DbPool } from '../src/db/pool';
import { buildTestApp } from './helpers/testApp';
import { createTestPool } from './helpers/testDb';

describe('platform initialization', () => {
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

  it('reports initialization status', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/initialization/status' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ initialized: false });
  });

  it('rejects unauthenticated platform admin binding', async () => {
    const response = await app.inject({ method: 'POST', url: '/api/initialization/bind-platform-admin' });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('binds the current Feishu user as platform admin and writes audit', async () => {
    const cookie = await loginCookie(app, 'ou_init_001', '初始化管理员');
    const response = await app.inject({
      method: 'POST',
      url: '/api/initialization/bind-platform-admin',
      headers: { cookie },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ initialized: true, platformAdminFeishuUserId: 'ou_init_001' });

    const admins = await pool.query('select feishu_user_id from platform_admins');
    const audit = await pool.query('select action, target_id from audit_logs order by id desc limit 1');
    expect(admins.rows).toEqual([{ feishu_user_id: 'ou_init_001' }]);
    expect(audit.rows[0]).toMatchObject({ action: 'platform_admin.bind', target_id: 'ou_init_001' });
  });

  it('does not create duplicate platform admin rows for repeated binding', async () => {
    const cookie = await loginCookie(app, 'ou_init_002', '重复绑定管理员');

    await app.inject({ method: 'POST', url: '/api/initialization/bind-platform-admin', headers: { cookie } });
    await app.inject({ method: 'POST', url: '/api/initialization/bind-platform-admin', headers: { cookie } });

    const admins = await pool.query('select count(*)::int as count from platform_admins');
    expect(admins.rows[0].count).toBe(1);
  });
});

async function loginCookie(app: Awaited<ReturnType<typeof buildTestApp>>, feishuUserId: string, name: string) {
  const login = await app.inject({
    method: 'POST',
    url: '/api/dev/feishu/mock-login',
    payload: { feishuUserId, name },
  });
  return String(login.headers['set-cookie']);
}
