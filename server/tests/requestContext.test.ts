import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DbPool } from '../src/db/pool';
import { buildTestApp } from './helpers/testApp';
import { createTestPool } from './helpers/testDb';

describe('request context', () => {
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

  it('treats requests without a session cookie as anonymous', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/session/current' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ authenticated: false });
  });

  it('resolves a valid session cookie to the current Feishu actor', async () => {
    const login = await mockLogin(app, 'ou_request_context_001', '请求上下文用户');
    const response = await app.inject({
      method: 'GET',
      url: '/api/session/current',
      headers: { cookie: login.cookie },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      authenticated: true,
      user: {
        feishuUserId: 'ou_request_context_001',
        displayName: '请求上下文用户',
        departmentPath: '-',
        status: 'active',
      },
      roles: [],
      permissions: [],
      applicationIds: [],
    });
  });

  it('ignores expired or unknown session cookies', async () => {
    const login = await mockLogin(app, 'ou_request_context_002', '过期会话用户');
    await pool.query('update iam_sessions set expires_at = now() - interval \'1 minute\'');

    const expired = await app.inject({
      method: 'GET',
      url: '/api/session/current',
      headers: { cookie: login.cookie },
    });
    const unknown = await app.inject({
      method: 'GET',
      url: '/api/session/current',
      headers: { cookie: 'iam_session=missing-token' },
    });

    expect(expired.json()).toEqual({ authenticated: false });
    expect(unknown.json()).toEqual({ authenticated: false });
  });
});

async function mockLogin(app: Awaited<ReturnType<typeof buildTestApp>>, feishuUserId: string, name: string) {
  const response = await app.inject({
    method: 'POST',
    url: '/api/dev/feishu/mock-login',
    payload: { feishuUserId, name },
  });
  const cookie = response.headers['set-cookie'];
  return { response, cookie: Array.isArray(cookie) ? cookie[0] : String(cookie) };
}
