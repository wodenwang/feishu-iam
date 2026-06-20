import type { ArgumentsHost } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { FeishuClientError } from '../src/feishu/feishu.types';
import { OauthErrorFilter } from '../src/oauth/oauth-error.filter';
import { OauthDomainError } from '../src/oauth/oauth.types';

type JsonBody = unknown;

type MockResponse = {
  json: ReturnType<typeof vi.fn<(body: JsonBody) => void>>;
  setHeader: ReturnType<typeof vi.fn<(name: string, value: string) => void>>;
  send: ReturnType<typeof vi.fn<(body: string) => void>>;
  type: ReturnType<typeof vi.fn<(contentType: string) => MockResponse>>;
  status: ReturnType<typeof vi.fn<(statusCode: number) => MockResponse>>;
};

function makeHost(requestId?: string, path = '/api/v1/platform/applications/finance/environments') {
  const response: MockResponse = {
    json: vi.fn<(body: JsonBody) => void>(),
    setHeader: vi.fn<(name: string, value: string) => void>(),
    send: vi.fn<(body: string) => void>(),
    type: vi.fn<(contentType: string) => MockResponse>(),
    status: vi.fn<(statusCode: number) => MockResponse>()
  };
  response.status.mockReturnValue(response);
  response.type.mockReturnValue(response);

  const request = {
    path,
    header: (name: string) => (name === 'x-request-id' ? requestId : undefined)
  };
  const host = {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response
    })
  };

  return {
    host: host as ArgumentsHost,
    response,
    status: response.status,
    json: response.json,
    send: response.send
  };
}

describe('OauthErrorFilter', () => {
  it('returns stable error body with request_id and does not leak stack', () => {
    const filter = new OauthErrorFilter();
    const { host, status, json } = makeHost('req-123');

    filter.catch(new OauthDomainError('OAUTH_REDIRECT_URI_INVALID', '回调地址必须是完整 URL', 422), host);

    expect(status).toHaveBeenCalledWith(422);
    expect(json).toHaveBeenCalledWith({
      error: {
        code: 'OAUTH_REDIRECT_URI_INVALID',
        message: '回调地址必须是完整 URL',
        request_id: 'req-123'
      }
    });
    expect(JSON.stringify(json.mock.calls[0]?.[0])).not.toContain('stack');
  });

  it('generates request_id when request header is absent', () => {
    const filter = new OauthErrorFilter();
    const { host, json } = makeHost();

    filter.catch(new OauthDomainError('OAUTH_CLIENT_DISABLED', 'client 已禁用', 403), host);

    expect(json).toHaveBeenCalledWith({
      error: {
        code: 'OAUTH_CLIENT_DISABLED',
        message: 'client 已禁用',
        request_id: expect.stringMatching(/[0-9a-f-]{36}/) as unknown
      }
    });
  });

  it('reuses the request-scoped generated request_id', () => {
    const filter = new OauthErrorFilter();
    const { host, json } = makeHost();

    filter.catch(new OauthDomainError('OAUTH_CLIENT_DISABLED', 'client 已禁用', 403), host);
    filter.catch(new OauthDomainError('OAUTH_CLIENT_DISABLED', 'client 已禁用', 403), host);

    const firstBody = json.mock.calls[0]?.[0] as { error: { request_id: string } };
    const secondBody = json.mock.calls[1]?.[0] as { error: { request_id: string } };
    expect(secondBody.error.request_id).toBe(firstBody.error.request_id);
  });

  it('returns stable JSON for FeishuClientError on API paths', () => {
    const filter = new OauthErrorFilter();
    const { host, status, json } = makeHost(undefined, '/oauth/token');

    filter.catch(new FeishuClientError('FEISHU_NETWORK_ERROR', '飞书 token 请求失败'), host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      error: {
        code: 'OAUTH_FEISHU_CLIENT_ERROR',
        message: '飞书登录服务暂时不可用，请稍后重试',
        request_id: expect.stringMatching(/[0-9a-f-]{36}/) as unknown
      }
    });
  });

  it('returns stable HTML for FeishuClientError on browser paths', () => {
    const filter = new OauthErrorFilter();
    const { host, status, response, send } = makeHost(undefined, '/oauth/authorize');

    filter.catch(new FeishuClientError('FEISHU_CONFIG_MISSING', '飞书应用配置缺失'), host);

    expect(status).toHaveBeenCalledWith(500);
    expect(response.type).toHaveBeenCalledWith('html');
    const html = send.mock.calls[0]?.[0] ?? '';
    expect(html).toContain('Feishu IAM 问题提示');
    expect(html).toContain('无法完成登录');
    expect(html).toContain('飞书登录服务暂时不可用，请稍后重试');
    expect(html).toContain('复制 request id');
    expect(html).not.toContain('复制问题信息');
    expect(html).not.toContain('data-feedback');
    expect(html).toMatch(/[0-9a-f-]{36}/);
    expect(html).not.toContain('unknown');
    expect(html).not.toMatch(/client_secret|Authorization|access_token/i);
  });

  it('returns stable HTML for legacy Feishu callback browser path', () => {
    const filter = new OauthErrorFilter();
    const { host, status, response, send } = makeHost('req-legacy-callback', '/api/auth/feishu/callback');

    filter.catch(new OauthDomainError('OAUTH_LOGIN_STATE_INVALID', '登录状态已失效，请重新发起登录', 400), host);

    expect(status).toHaveBeenCalledWith(400);
    expect(response.type).toHaveBeenCalledWith('html');
    const html = send.mock.calls[0]?.[0] ?? '';
    expect(html).toContain('Feishu IAM 问题提示');
    expect(html).toContain('无法完成登录');
    expect(html).toContain('登录状态已失效，请重新发起登录');
    expect(html).toContain('req-legacy-callback');
    expect(html).toContain('复制 request id');
    expect(html).not.toContain('复制问题信息');
    expect(html).not.toContain('data-feedback');
  });

  it('rejects invalid non-error HTTP status', () => {
    expect(() => {
      new OauthDomainError('BAD_STATUS', '非法状态', 200);
    }).toThrow('OauthDomainError status must be an error HTTP status');
  });
});
