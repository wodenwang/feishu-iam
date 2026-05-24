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

  it('loads runtime departments', async () => {
    httpRequestMock.mockResolvedValue({
      items: [
        {
          id: 'dept_sales',
          name: '销售部',
          parent_id: null,
          path: '销售部',
          user_count: 1,
          updated_at: '2026-05-24T00:00:00.000Z',
        },
      ],
      page: 1,
      pageSize: 20,
      total: 1,
    });
    const { listFeishuDepartments } = await import('./httpApi');

    const departments = await listFeishuDepartments();

    expect(httpRequestMock).toHaveBeenCalledWith('/api/directory/departments', { query: { page: 1, pageSize: 100 } });
    expect(departments).toEqual([
      {
        id: 'dept_sales',
        name: '销售部',
        parentId: undefined,
        path: '销售部',
        userCount: 1,
        updatedAt: '2026-05-24T00:00:00.000Z',
      },
    ]);
  });

  it('passes directory user filters to the runtime API', async () => {
    httpRequestMock.mockResolvedValue({ items: [], page: 2, pageSize: 20, total: 0 });
    const { listDirectoryUsers } = await import('./httpApi');

    await listDirectoryUsers({ departmentId: 'dept_sales', page: 2, pageSize: 20 });

    expect(httpRequestMock).toHaveBeenCalledWith('/api/directory/users', {
      query: { departmentId: 'dept_sales', page: 2, pageSize: 20 },
    });
  });
});
