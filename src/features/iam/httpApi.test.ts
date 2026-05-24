import { afterEach, describe, expect, it, vi } from 'vitest';

const httpRequestMock = vi.hoisted(() => vi.fn());

vi.mock('./httpClient', () => ({
  httpRequest: httpRequestMock,
}));

describe('httpApi', () => {
  afterEach(() => {
    httpRequestMock.mockReset();
  });

  it('passes application list filters to the runtime API', async () => {
    httpRequestMock.mockResolvedValue({ items: [], page: 2, pageSize: 10, total: 0 });
    const { listApplications } = await import('./httpApi');

    await listApplications({
      page: 2,
      pageSize: 10,
      keyword: 'crm',
      status: 'active',
      createdAtFrom: '2026-05-01T00:00:00.000Z',
      createdAtTo: '2026-05-24T23:59:59.999Z',
    });

    expect(httpRequestMock).toHaveBeenCalledWith('/api/applications', {
      query: {
        page: 2,
        pageSize: 10,
        keyword: 'crm',
        status: 'active',
        createdAtFrom: '2026-05-01T00:00:00.000Z',
        createdAtTo: '2026-05-24T23:59:59.999Z',
      },
    });
  });
});
