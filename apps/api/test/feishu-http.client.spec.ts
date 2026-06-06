import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FeishuHttpClient } from '../src/feishu/feishu-http.client';
import type { FeishuClientError } from '../src/feishu/feishu.types';

describe('FeishuHttpClient', () => {
  const originalAppId = process.env.FEISHU_APP_ID;
  const originalAppSecret = process.env.FEISHU_APP_SECRET;
  const originalOauthRedirectUri = process.env.FEISHU_OAUTH_REDIRECT_URI;

  beforeEach(() => {
    process.env.FEISHU_APP_ID = 'cli_test';
    process.env.FEISHU_APP_SECRET = 'test-secret';
    process.env.FEISHU_OAUTH_REDIRECT_URI = 'https://iam.example.com/oauth/feishu/callback';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (originalAppId === undefined) {
      delete process.env.FEISHU_APP_ID;
    } else {
      process.env.FEISHU_APP_ID = originalAppId;
    }
    if (originalAppSecret === undefined) {
      delete process.env.FEISHU_APP_SECRET;
    } else {
      process.env.FEISHU_APP_SECRET = originalAppSecret;
    }
    if (originalOauthRedirectUri === undefined) {
      delete process.env.FEISHU_OAUTH_REDIRECT_URI;
    } else {
      process.env.FEISHU_OAUTH_REDIRECT_URI = originalOauthRedirectUri;
    }
  });

  it('构造当前飞书 OAuth 授权地址时使用 accounts 域名和 client_id', () => {
    const url = new URL(
      new FeishuHttpClient().buildOAuthAuthorizeUrl({
        state: 'state-1',
        redirectUri: 'https://iam.example.com/oauth/feishu/callback'
      })
    );

    expect(url.origin + url.pathname).toBe('https://accounts.feishu.cn/open-apis/authen/v1/authorize');
    expect(url.searchParams.get('client_id')).toBe('cli_test');
    expect(url.searchParams.get('app_id')).toBeNull();
    expect(url.searchParams.get('redirect_uri')).toBe('https://iam.example.com/oauth/feishu/callback');
    expect(url.searchParams.get('state')).toBe('state-1');
    expect(url.searchParams.get('response_type')).toBe('code');
  });

  it('使用当前飞书 OAuth v2 token 接口换取 user access token 并读取用户信息', async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    vi.stubGlobal(
      'fetch',
      vi.fn((input: string | URL | Request, init?: RequestInit) => {
        const url = requestUrl(input);
        requests.push({ url, init });

        if (url === 'https://open.feishu.cn/open-apis/authen/v2/oauth/token') {
          return Promise.resolve(
            jsonResponse({
              code: 0,
              msg: 'success',
              access_token: 'user-access-token',
              expires_in: 7200,
              token_type: 'Bearer'
            })
          );
        }

        if (url === 'https://open.feishu.cn/open-apis/authen/v1/user_info') {
          return Promise.resolve(
            jsonResponse({
              code: 0,
              msg: 'success',
              data: {
                user_id: 'ou-user-1',
                open_id: 'ou-open-1',
                union_id: 'on-union-1',
                name: '张三',
                avatar_url: 'https://example.com/avatar.png'
              }
            })
          );
        }

        return Promise.resolve(jsonResponse({ code: 999, msg: 'unexpected' }, { status: 404 }));
      })
    );

    await expect(new FeishuHttpClient().exchangeOAuthCode('feishu-code')).resolves.toEqual({
      user_id: 'ou-user-1',
      open_id: 'ou-open-1',
      union_id: 'on-union-1',
      name: '张三',
      avatar_url: 'https://example.com/avatar.png'
    });

    expect(requests).toHaveLength(2);
    const tokenRequest = requests[0] as { url: string; init?: RequestInit };
    expect(tokenRequest.url).toBe('https://open.feishu.cn/open-apis/authen/v2/oauth/token');
    expect(tokenRequest.init?.method).toBe('POST');
    expect(readJsonRequestBody(tokenRequest.init?.body)).toEqual({
      grant_type: 'authorization_code',
      code: 'feishu-code',
      client_id: 'cli_test',
      client_secret: 'test-secret',
      redirect_uri: 'https://iam.example.com/oauth/feishu/callback'
    });
    expect(tokenRequest.init?.headers).not.toHaveProperty('Authorization');

    const userInfoRequest = requests[1] as { url: string; init?: RequestInit };
    expect(userInfoRequest.url).toBe('https://open.feishu.cn/open-apis/authen/v1/user_info');
    expect(new Headers(userInfoRequest.init?.headers).get('Authorization')).toBe('Bearer user-access-token');
  });

  it('兼容旧版 data 包装中的 user access token', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: string | URL | Request) => {
        const url = requestUrl(input);
        if (url === 'https://open.feishu.cn/open-apis/authen/v2/oauth/token') {
          return Promise.resolve(
            jsonResponse({
              code: 0,
              msg: 'success',
              data: {
                access_token: 'legacy-user-access-token'
              }
            })
          );
        }

        if (url === 'https://open.feishu.cn/open-apis/authen/v1/user_info') {
          return Promise.resolve(
            jsonResponse({
              code: 0,
              msg: 'success',
              data: {
                sub: 'ou-open-legacy'
              }
            })
          );
        }

        return Promise.resolve(jsonResponse({ code: 999, msg: 'unexpected' }, { status: 404 }));
      })
    );

    await expect(new FeishuHttpClient().exchangeOAuthCode('feishu-code')).resolves.toEqual({
      sub: 'ou-open-legacy',
      user_id: undefined,
      open_id: undefined,
      union_id: undefined,
      name: undefined,
      avatar_url: undefined
    });
  });

  it('token 响应成功但缺少 access_token 时只记录安全诊断字段名', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: string | URL | Request) => {
        const url = requestUrl(input);
        if (url === 'https://open.feishu.cn/open-apis/authen/v2/oauth/token') {
          return Promise.resolve(
            jsonResponse({
              code: 0,
              msg: 'success',
              data: {
                expires_in: 7200
              }
            })
          );
        }

        return Promise.resolve(jsonResponse({ code: 999, msg: 'unexpected' }, { status: 404 }));
      })
    );

    await expect(new FeishuHttpClient().exchangeOAuthCode('feishu-code')).rejects.toMatchObject({
      code: 'FEISHU_API_ERROR',
      message: '飞书 token 响应缺少 access_token',
      detail: {
        feishu_code: 0,
        path: '/authen/v2/oauth/token',
        response_keys: ['code', 'data', 'msg'],
        data_keys: ['expires_in']
      }
    } satisfies Partial<FeishuClientError>);
  });

  it('使用自定义 department_id 查询用户时传递 department_id_type=department_id', async () => {
    const requestedUrls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn((input: string | URL | Request) => {
        const url = requestUrl(input);
        requestedUrls.push(url);

        if (url.includes('/auth/v3/tenant_access_token/internal')) {
          return Promise.resolve(
            jsonResponse({ code: 0, msg: 'success', tenant_access_token: 'tenant-token', expire: 7200 })
          );
        }

        return Promise.resolve(jsonResponse({ code: 0, msg: 'success', data: { items: [], has_more: false } }));
      })
    );

    await new FeishuHttpClient().listDepartmentUsers({ departmentId: 'e1ec7bdbe8gdcb68' });

    const contactUrl = new URL(
      requestedUrls.find((url) => url.includes('/contact/v3/users/find_by_department')) ?? ''
    );
    expect(contactUrl.searchParams.get('department_id_type')).toBe('department_id');
  });
});

function requestUrl(input: string | URL | Request): string {
  if (typeof input === 'string') {
    return input;
  }
  if (input instanceof URL) {
    return input.toString();
  }
  return input.url;
}

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    status: init?.status ?? 200,
    headers: {
      ...Object.fromEntries(new Headers(init?.headers)),
      'Content-Type': 'application/json; charset=utf-8'
    }
  });
}

function readJsonRequestBody(body: BodyInit | null | undefined): unknown {
  if (typeof body !== 'string') {
    throw new Error('Expected JSON string request body');
  }
  return JSON.parse(body) as unknown;
}
