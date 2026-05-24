import { afterEach, describe, expect, it, vi } from 'vitest';
import { httpRequest, isIamHttpError } from './httpClient';

describe('httpClient', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns JSON for successful responses and includes credentials', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    await expect(httpRequest('/api/health')).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith('/api/health', expect.objectContaining({ credentials: 'include' }));
  });

  it('appends query parameters', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ items: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    await httpRequest('/api/audit-logs', { query: { page: 1, pageSize: 20, keyword: 'req_1', empty: undefined } });

    expect(fetchMock).toHaveBeenCalledWith('/api/audit-logs?page=1&pageSize=20&keyword=req_1', expect.any(Object));
  });

  it('throws IamHttpError with requestId for server errors', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ requestId: 'req_error_001', code: 'APPLICATION_NAME_EXISTS', message: '应用名称已存在' }), {
        status: 409,
        headers: { 'content-type': 'application/json' },
      }),
    );

    await expect(httpRequest('/api/applications')).rejects.toMatchObject({
      name: 'IamHttpError',
      status: 409,
      code: 'APPLICATION_NAME_EXISTS',
      message: '应用名称已存在',
      requestId: 'req_error_001',
    });
  });

  it('identifies IamHttpError', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('fetch failed'));

    try {
      await httpRequest('/api/session/current');
      throw new Error('expected request to fail');
    } catch (error) {
      expect(isIamHttpError(error)).toBe(true);
      expect(error).toMatchObject({ status: 0, code: 'NETWORK_ERROR' });
    }
  });
});
