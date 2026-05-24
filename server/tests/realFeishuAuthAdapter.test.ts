import { afterEach, describe, expect, it, vi } from 'vitest';
import { RealFeishuAuthAdapter } from '../src/modules/auth/realFeishuAuthAdapter';
import { HttpError } from '../src/modules/errors/httpError';

describe('RealFeishuAuthAdapter', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('builds a Feishu authorization URL with app id, redirect URI, and state', () => {
    const adapter = new RealFeishuAuthAdapter({ appId: 'cli_test', appSecret: 'secret' });

    const url = new URL(adapter.buildAuthorizationUrl({ state: 'state-1', redirectUri: 'https://iam.example.com/callback' }));

    expect(url.origin).toBe('https://accounts.feishu.cn');
    expect(url.pathname).toBe('/open-apis/authen/v1/authorize');
    expect(url.searchParams.get('client_id')).toBe('cli_test');
    expect(url.searchParams.get('redirect_uri')).toBe('https://iam.example.com/callback');
    expect(url.searchParams.get('state')).toBe('state-1');
  });

  it('exchanges an auth code and maps Feishu user info', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ code: 0, data: { access_token: 'u-token' } }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ code: 0, data: { user_id: 'ou_real_001', name: '真实用户', email: 'real@example.com' } }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );
    vi.stubGlobal('fetch', fetchMock);

    const adapter = new RealFeishuAuthAdapter({ appId: 'cli_test', appSecret: 'secret' });

    await expect(adapter.exchangeCodeForUser({ code: 'code-1', redirectUri: 'https://iam.example.com/callback' })).resolves.toEqual({
      feishuUserId: 'ou_real_001',
      name: '真实用户',
      email: 'real@example.com',
      status: 'active',
    });
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://open.feishu.cn/open-apis/authen/v2/oauth/token',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://open.feishu.cn/open-apis/authen/v1/user_info',
      expect.objectContaining({ headers: { authorization: 'Bearer u-token' } }),
    );
  });

  it('surfaces Feishu token exchange failures as IAM errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce(
        new Response(JSON.stringify({ code: 20001, msg: 'invalid code' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    );
    const adapter = new RealFeishuAuthAdapter({ appId: 'cli_test', appSecret: 'secret' });

    await expect(adapter.exchangeCodeForUser({ code: 'bad-code', redirectUri: 'https://iam.example.com/callback' })).rejects.toMatchObject({
      statusCode: 502,
      code: 'FEISHU_TOKEN_EXCHANGE_FAILED',
    } satisfies Partial<HttpError>);
  });
});
