import type { Request } from 'express';
import { describe, expect, it } from 'vitest';
import { getAdminRequestId, readAdminContext, setAdminContext } from '../src/admin/admin-request-context';
import type { AdminContext } from '../src/admin/admin.types';

function makeRequest(requestId?: string): Request {
  return {
    header: (name: string) => (name === 'x-request-id' ? requestId : undefined)
  } as Request;
}

describe('admin-request-context', () => {
  it('读取并 trim x-request-id', () => {
    expect(getAdminRequestId(makeRequest('  req-123  '))).toBe('req-123');
  });

  it('x-request-id 为空白时生成 request id 并在同一 request 复用', () => {
    const request = makeRequest('   ');
    const requestId = getAdminRequestId(request);

    expect(requestId).toMatch(/[0-9a-f-]{36}/);
    expect(getAdminRequestId(request)).toBe(requestId);
  });

  it('x-request-id 包含不可信字符或过长内容时生成安全 request id', () => {
    const unsafeValues = [
      'authorization: Bearer should-not-leak',
      'cookie=should-not-leak',
      'raw_payload.should-not-leak',
      `req-${'a'.repeat(130)}`
    ];

    for (const value of unsafeValues) {
      const requestId = getAdminRequestId(makeRequest(value));
      expect(requestId).toMatch(/[0-9a-f-]{36}/);
      expect(requestId).not.toContain('should-not-leak');
    }
  });

  it('可写入并读取 AdminContext', () => {
    const request = makeRequest();
    const context: AdminContext = {
      adminUserId: 'admin-1',
      feishuUserId: 'ou_admin',
      displayName: '管理员',
      roles: ['platform_admin'],
      applicationIds: []
    };

    setAdminContext(request, context);

    expect(readAdminContext(request)).toBe(context);
  });
});
