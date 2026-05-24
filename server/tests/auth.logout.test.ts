import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DbPool } from '../src/db/pool';
import { buildTestApp } from './helpers/testApp';
import { createTestPool } from './helpers/testDb';

describe('auth logout', () => {
  let pool: DbPool;
  let app: Awaited<ReturnType<typeof buildTestApp>>;

  beforeEach(async () => {
    pool = await createTestPool();
    app = await buildTestApp(pool);
  });

  afterEach(async () => {
    await app?.close();
    await pool?.end();
  });

  it('clears the session cookie and invalidates the current session', async () => {
    const login = await app.inject({
      method: 'POST',
      url: '/api/dev/feishu/mock-login',
      payload: { feishuUserId: 'ou_logout_001', name: '退出用户' },
    });
    const cookie = String(login.headers['set-cookie']);

    const logout = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      headers: { cookie },
    });

    expect(logout.statusCode).toBe(200);
    expect(logout.json()).toEqual({ ok: true });
    expect(logout.headers['set-cookie']).toContain('iam_session=;');
    expect(logout.headers['set-cookie']).toContain('Max-Age=0');

    const current = await app.inject({
      method: 'GET',
      url: '/api/session/current',
      headers: { cookie },
    });
    expect(current.json()).toEqual({ authenticated: false });
  });

  it('returns the same safe response when no session cookie exists', async () => {
    const logout = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
    });

    expect(logout.statusCode).toBe(200);
    expect(logout.json()).toEqual({ ok: true });
    expect(logout.headers['set-cookie']).toContain('iam_session=;');
    expect(logout.headers['set-cookie']).toContain('Max-Age=0');
  });
});
