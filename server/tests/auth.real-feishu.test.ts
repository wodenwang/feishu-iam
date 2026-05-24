import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DbPool } from '../src/db/pool';
import type { FeishuAuthAdapter, FeishuUserIdentity } from '../src/modules/auth/feishuAuthAdapter';
import { HttpError } from '../src/modules/errors/httpError';
import { buildTestApp } from './helpers/testApp';
import { createTestPool } from './helpers/testDb';

class FakeRealFeishuAuthAdapter implements FeishuAuthAdapter {
  public readonly exchangeCodeForUser = vi.fn<[input: { code: string; redirectUri: string }], Promise<FeishuUserIdentity>>();

  constructor(private readonly user: FeishuUserIdentity = { feishuUserId: 'ou_real_001', name: '真实飞书用户', email: 'real@example.com', status: 'active' }) {
    this.exchangeCodeForUser.mockResolvedValue(user);
  }

  async resolveMockUser(): Promise<FeishuUserIdentity> {
    throw new Error('mock disabled');
  }

  buildAuthorizationUrl(input: { state: string; redirectUri: string }): string {
    return `https://accounts.feishu.cn/open-apis/authen/v1/authorize?client_id=cli_test&redirect_uri=${encodeURIComponent(input.redirectUri)}&state=${input.state}`;
  }
}

describe('real Feishu OAuth login', () => {
  let pool: DbPool;
  let app: Awaited<ReturnType<typeof buildTestApp>>;
  let adapter: FakeRealFeishuAuthAdapter;

  beforeEach(async () => {
    pool = await createTestPool();
    adapter = new FakeRealFeishuAuthAdapter();
    app = await buildTestApp(pool, {
      allowMockLogin: false,
      feishuRedirectUri: 'https://iam.example.com/api/auth/feishu/callback',
      feishuAuthAdapter: adapter,
    });
  });

  afterEach(async () => {
    await app.close();
    await pool.end();
  });

  it('redirects to Feishu authorize URL and sets a short-lived state cookie', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/auth/feishu/start' });

    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toContain('https://accounts.feishu.cn/open-apis/authen/v1/authorize');
    expect(response.headers.location).toContain('client_id=cli_test');
    expect(response.headers.location).toContain('redirect_uri=https%3A%2F%2Fiam.example.com%2Fapi%2Fauth%2Ffeishu%2Fcallback');
    expect(response.headers['set-cookie']).toContain('iam_oauth_state=');
    expect(response.headers['set-cookie']).toContain('Max-Age=300');
    expect(response.headers['set-cookie']).toContain('HttpOnly');
  });

  it('marks OAuth cookies as Secure when production cookie mode is enabled', async () => {
    await app.close();
    app = await buildTestApp(pool, {
      allowMockLogin: false,
      secureCookies: true,
      feishuRedirectUri: 'https://iam.example.com/api/auth/feishu/callback',
      feishuAuthAdapter: adapter,
    });

    const response = await app.inject({ method: 'GET', url: '/api/auth/feishu/start' });

    expect(response.headers['set-cookie']).toContain('Secure');
  });

  it('rejects callback when state is missing or does not match', async () => {
    const missingState = await app.inject({ method: 'GET', url: '/api/auth/feishu/callback?code=abc' });
    const mismatch = await app.inject({
      method: 'GET',
      url: '/api/auth/feishu/callback?code=abc&state=bad',
      headers: { cookie: 'iam_oauth_state=good' },
    });

    expect(missingState.statusCode).toBe(302);
    expect(missingState.headers.location).toBe('/login?status=authFailed');
    expect(mismatch.statusCode).toBe(302);
    expect(mismatch.headers.location).toBe('/login?status=authFailed');
    expect(adapter.exchangeCodeForUser).not.toHaveBeenCalled();

    const audit = await pool.query("select action, result, metadata from audit_logs where action = 'auth.feishu_login'");
    expect(audit.rows).toHaveLength(2);
    expect(audit.rows.every((row) => row.result === 'failure')).toBe(true);
  });

  it('creates a session, user projection, and login audit row on callback success', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/auth/feishu/callback?code=valid-code&state=state-1',
      headers: { cookie: 'iam_oauth_state=state-1' },
    });

    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe('/initialize');
    const setCookie = response.headers['set-cookie'];
    expect(setCookie).toEqual(expect.arrayContaining([expect.stringContaining('iam_oauth_state=;'), expect.stringContaining('iam_session=')]));
    expect(adapter.exchangeCodeForUser).toHaveBeenCalledWith({
      code: 'valid-code',
      redirectUri: 'https://iam.example.com/api/auth/feishu/callback',
    });

    const users = await pool.query('select feishu_user_id, name, email from feishu_users');
    expect(users.rows).toContainEqual({ feishu_user_id: 'ou_real_001', name: '真实飞书用户', email: 'real@example.com' });

    const directoryUsers = await pool.query('select feishu_user_id, name, email from directory_users');
    expect(directoryUsers.rows).toContainEqual({ feishu_user_id: 'ou_real_001', name: '真实飞书用户', email: 'real@example.com' });

    const sessions = await pool.query('select feishu_user_id from iam_sessions');
    expect(sessions.rows).toContainEqual({ feishu_user_id: 'ou_real_001' });

    const audit = await pool.query('select action, actor_feishu_user_id, result from audit_logs');
    expect(audit.rows).toContainEqual({ action: 'auth.feishu_login', actor_feishu_user_id: 'ou_real_001', result: 'success' });
  });

  it('redirects existing platform admins to the runtime console after login', async () => {
    await pool.query(
      "insert into feishu_users(feishu_user_id, name, status) values ('ou_real_001', '真实飞书用户', 'active') on conflict do nothing",
    );
    await pool.query("insert into platform_admins(feishu_user_id) values ('ou_real_001') on conflict do nothing");

    const response = await app.inject({
      method: 'GET',
      url: '/api/auth/feishu/callback?code=valid-code&state=state-1',
      headers: { cookie: 'iam_oauth_state=state-1' },
    });

    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe('/applications');
  });

  it('redirects to login failure when Feishu token or user info exchange fails', async () => {
    adapter.exchangeCodeForUser.mockRejectedValueOnce(new HttpError(502, 'FEISHU_TOKEN_EXCHANGE_FAILED', '飞书授权码换取访问令牌失败'));

    const response = await app.inject({
      method: 'GET',
      url: '/api/auth/feishu/callback?code=bad-code&state=state-1',
      headers: { cookie: 'iam_oauth_state=state-1' },
    });

    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe('/login?status=authFailed');

    const sessions = await pool.query('select count(*)::int as count from iam_sessions');
    expect(sessions.rows[0].count).toBe(0);
    const audit = await pool.query("select action, result from audit_logs where action = 'auth.feishu_login'");
    expect(audit.rows).toContainEqual({ action: 'auth.feishu_login', result: 'failure' });
  });
});
