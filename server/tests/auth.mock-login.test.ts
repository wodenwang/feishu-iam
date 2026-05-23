import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app';
import type { DbPool } from '../src/db/pool';
import { buildTestApp } from './helpers/testApp';
import { createTestPool } from './helpers/testDb';

describe('mock Feishu login', () => {
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

  it('returns a session cookie and writes a login audit row', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/dev/feishu/mock-login',
      payload: {
        feishuUserId: 'ou_auth_001',
        name: '登录用户',
        email: 'auth@example.com',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['set-cookie']).toContain('iam_session=');
    expect(response.json()).toMatchObject({ feishuUserId: 'ou_auth_001', name: '登录用户' });

    const audit = await pool.query('select action, actor_feishu_user_id from audit_logs');
    expect(audit.rows).toContainEqual({ action: 'auth.mock_login', actor_feishu_user_id: 'ou_auth_001' });
  });

  it('uses the session cookie for current session lookup', async () => {
    const login = await app.inject({
      method: 'POST',
      url: '/api/dev/feishu/mock-login',
      payload: { feishuUserId: 'ou_auth_002', name: '当前会话用户' },
    });
    const cookie = String(login.headers['set-cookie']);

    const current = await app.inject({
      method: 'GET',
      url: '/api/session/current',
      headers: { cookie },
    });

    expect(current.json()).toMatchObject({
      authenticated: true,
      actor: { feishuUserId: 'ou_auth_002', name: '当前会话用户' },
    });
  });

  it('returns 400 with requestId for invalid mock users', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/dev/feishu/mock-login',
      payload: { feishuUserId: 'ou_invalid_only' },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      code: 'INVALID_MOCK_FEISHU_USER',
      message: 'mock 飞书用户必须包含 feishuUserId 和 name',
    });
    expect(response.json().requestId).toEqual(expect.any(String));
  });

  it('returns 400 for non-object mock users and invalid statuses', async () => {
    const nullPayload = await app.inject({
      method: 'POST',
      url: '/api/dev/feishu/mock-login',
      payload: null,
    });
    const invalidStatus = await app.inject({
      method: 'POST',
      url: '/api/dev/feishu/mock-login',
      payload: { feishuUserId: 'ou_auth_invalid_status', name: '非法状态用户', status: 'blocked' },
    });

    expect(nullPayload.statusCode).toBe(400);
    expect(nullPayload.json()).toMatchObject({ code: 'INVALID_MOCK_FEISHU_USER' });
    expect(invalidStatus.statusCode).toBe(400);
    expect(invalidStatus.json()).toMatchObject({ code: 'INVALID_MOCK_FEISHU_USER', message: 'mock 飞书用户状态无效' });
  });

  it('does not expose mock login when mock mode is disabled', async () => {
    await app.close();
    app = await buildApp({ pool, sessionCookieName: 'iam_session', allowMockLogin: false });

    const response = await app.inject({
      method: 'POST',
      url: '/api/dev/feishu/mock-login',
      payload: { feishuUserId: 'ou_auth_003', name: '被拒绝用户' },
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ code: 'NOT_FOUND' });
  });
});
