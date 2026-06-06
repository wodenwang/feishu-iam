import type { ArgumentsHost } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { AdminErrorFilter } from '../src/admin/admin-error.filter';
import { AdminDomainError } from '../src/admin/admin.types';

type JsonBody = unknown;

type MockResponse = {
  json: ReturnType<typeof vi.fn<(body: JsonBody) => void>>;
  status: ReturnType<typeof vi.fn<(statusCode: number) => MockResponse>>;
};

function makeHost(requestId?: string) {
  const response: MockResponse = {
    json: vi.fn<(body: JsonBody) => void>(),
    status: vi.fn<(statusCode: number) => MockResponse>()
  };
  response.status.mockReturnValue(response);

  const request = {
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
    status: response.status,
    json: response.json
  };
}

describe('AdminErrorFilter', () => {
  it('返回稳定 JSON、复用 request_id 且不泄漏 stack', async () => {
    const filter = new AdminErrorFilter();
    const { host, status, json } = makeHost('req-123');

    await filter.catch(new AdminDomainError('ADMIN_PERMISSION_DENIED', '当前管理员无权管理该应用', 403), host);

    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith({
      error: {
        code: 'ADMIN_PERMISSION_DENIED',
        message: '当前管理员无权管理该应用',
        request_id: 'req-123'
      }
    });
    expect(JSON.stringify(json.mock.calls[0]?.[0])).not.toContain('stack');
  });

  it.each([
    ['ADMIN_SESSION_REQUIRED', 401],
    ['ADMIN_SESSION_INVALID', 401],
    ['ADMIN_SESSION_EXPIRED', 401],
    ['ADMIN_USER_UNAVAILABLE', 403],
    ['ADMIN_PERMISSION_DENIED', 403]
  ] as const)('%s 返回前 best-effort 写入安全事件', async (code, statusCode) => {
    const recorder = {
      recordBestEffort: vi.fn().mockResolvedValue(undefined)
    };
    const filter = new AdminErrorFilter(recorder as never);
    const { host, status } = makeHost('req-admin-401');

    await filter.catch(new AdminDomainError(code, '后台认证或授权失败', statusCode), host);

    expect(recorder.recordBestEffort).toHaveBeenCalledWith(
      expect.objectContaining({
        code,
        status: statusCode,
        message: '后台认证或授权失败'
      })
    );
    expect(status).toHaveBeenCalledWith(statusCode);
    expect(JSON.stringify(recorder.recordBestEffort.mock.calls)).not.toMatch(
      /cookie|authorization|token|raw_payload|secret/i
    );
  });

  it('best-effort 写入失败时仍返回原始 401/403 稳定响应', async () => {
    const recorder = {
      recordBestEffort: vi.fn().mockRejectedValue(new Error('database unavailable'))
    };
    const filter = new AdminErrorFilter(recorder as never);
    const { host, status, json } = makeHost('req-admin-401');

    await filter.catch(new AdminDomainError('ADMIN_SESSION_REQUIRED', '需要登录 Feishu IAM 管理后台', 401), host);

    expect(recorder.recordBestEffort).toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(401);
    expect(json).toHaveBeenCalledWith({
      error: {
        code: 'ADMIN_SESSION_REQUIRED',
        message: '需要登录 Feishu IAM 管理后台',
        request_id: 'req-admin-401'
      }
    });
  });

  it('x-request-id 为空白时生成 request_id', async () => {
    const filter = new AdminErrorFilter();
    const { host, json } = makeHost('   ');

    await filter.catch(new AdminDomainError('ADMIN_SESSION_INVALID', '后台登录态无效', 401), host);

    expect(json).toHaveBeenCalledWith({
      error: {
        code: 'ADMIN_SESSION_INVALID',
        message: '后台登录态无效',
        request_id: expect.stringMatching(/[0-9a-f-]{36}/) as unknown
      }
    });
  });
});
