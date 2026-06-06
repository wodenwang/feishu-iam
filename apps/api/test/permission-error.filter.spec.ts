import type { ArgumentsHost } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { PermissionErrorFilter } from '../src/permission/permission-error.filter';
import { PermissionDomainError } from '../src/permission/permission.types';

type JsonBody = unknown;

function makeHost(requestId?: string) {
  const status = vi.fn<(statusCode: number) => { json: (body: JsonBody) => void }>();
  const json = vi.fn<(body: JsonBody) => void>();
  status.mockReturnValue({ json });

  const host = {
    switchToHttp: () => ({
      getRequest: () => ({
        header: (name: string) => (name === 'x-request-id' ? requestId : undefined)
      }),
      getResponse: () => ({
        status
      })
    })
  };

  return { host: host as ArgumentsHost, status, json };
}

describe('PermissionErrorFilter', () => {
  it('默认返回 400 和稳定错误体且不泄漏 stack', () => {
    const filter = new PermissionErrorFilter();
    const { host, status, json } = makeHost();

    filter.catch(new PermissionDomainError('APPLICATION_KEY_INVALID', '应用 key 不符合规则'), host);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      error: {
        code: 'APPLICATION_KEY_INVALID',
        message: '应用 key 不符合规则'
      }
    });
    expect(JSON.stringify(json.mock.calls[0]?.[0])).not.toContain('stack');
  });

  it('透传 request_id', () => {
    const filter = new PermissionErrorFilter();
    const { host, json } = makeHost('req-123');

    filter.catch(new PermissionDomainError('PERMISSION_POINT_KEY_INVALID', '权限点 key 不符合规则'), host);

    expect(json).toHaveBeenCalledWith({
      error: {
        code: 'PERMISSION_POINT_KEY_INVALID',
        message: '权限点 key 不符合规则',
        request_id: 'req-123'
      }
    });
  });

  it('拒绝非法 HTTP status', () => {
    expect(() => {
      new PermissionDomainError('BAD_STATUS', '非法状态', 200);
    }).toThrow('PermissionDomainError status must be an error HTTP status');
  });
});
