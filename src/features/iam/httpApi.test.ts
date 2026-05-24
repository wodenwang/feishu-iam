import { afterEach, describe, expect, it, vi } from 'vitest';

const httpRequestMock = vi.hoisted(() => vi.fn());

vi.mock('./httpClient', () => ({
  httpRequest: httpRequestMock,
}));

describe('httpApi', () => {
  afterEach(() => {
    httpRequestMock.mockReset();
  });

  it('posts logout to the runtime auth API', async () => {
    httpRequestMock.mockResolvedValue({ ok: true });
    const { logout } = await import('./httpApi');

    await logout();

    expect(httpRequestMock).toHaveBeenCalledWith('/api/auth/logout', { method: 'POST' });
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

  it('passes role list filters and maps application id to appKey', async () => {
    httpRequestMock
      .mockResolvedValueOnce({
        items: [
          {
            id: 'app-id',
            app_key: 'app_key_1',
            name: 'Demo CRM',
            status: 'active',
            created_at: '2026-05-24T00:00:00.000Z',
          },
        ],
        page: 1,
        pageSize: 100,
        total: 1,
      })
      .mockResolvedValueOnce({ items: [], page: 1, pageSize: 20, total: 0 });
    const { listRoles } = await import('./httpApi');

    await listRoles({ applicationId: 'app-id', keyword: 'viewer', status: 'active', page: 1, pageSize: 20 });

    expect(httpRequestMock).toHaveBeenNthCalledWith(2, '/api/roles', {
      query: {
        page: 1,
        pageSize: 20,
        appKey: 'app_key_1',
        keyword: 'viewer',
        status: 'active',
        createdAtFrom: undefined,
        createdAtTo: undefined,
      },
    });
  });

  it('creates roles with runtime appKey payload', async () => {
    httpRequestMock
      .mockResolvedValueOnce({
        items: [
          {
            id: 'app-id',
            app_key: 'app_key_1',
            name: 'Demo CRM',
            status: 'active',
            created_at: '2026-05-24T00:00:00.000Z',
          },
        ],
        page: 1,
        pageSize: 100,
        total: 1,
      })
      .mockResolvedValueOnce({
        id: 'role-id',
        code: 'crm_viewer',
        name: '客户查看员',
        status: 'active',
        created_at: '2026-05-24T00:00:00.000Z',
      });
    const { createRole } = await import('./httpApi');

    const role = await createRole({ applicationId: 'app-id', code: 'crm_viewer', name: '客户查看员', status: 'active' });

    expect(httpRequestMock).toHaveBeenNthCalledWith(2, '/api/roles', {
      method: 'POST',
      body: {
        appKey: 'app_key_1',
        code: 'crm_viewer',
        name: '客户查看员',
        description: undefined,
        status: 'active',
      },
    });
    expect(role).toMatchObject({ id: 'role-id', applicationId: 'app-id', applicationName: 'Demo CRM' });
  });

  it('updates roles without sending immutable code', async () => {
    httpRequestMock
      .mockResolvedValueOnce({
        items: [
          {
            id: 'app-id',
            app_key: 'app_key_1',
            name: 'Demo CRM',
            status: 'active',
            created_at: '2026-05-24T00:00:00.000Z',
          },
        ],
        page: 1,
        pageSize: 100,
        total: 1,
      })
      .mockResolvedValueOnce({ id: 'role-id', code: 'crm_viewer', name: '客户查看员更新', status: 'disabled' });
    const { updateRole } = await import('./httpApi');

    await updateRole('role-id', { applicationId: 'app-id', code: 'ignored_code', name: '客户查看员更新', status: 'disabled' });

    expect(httpRequestMock).toHaveBeenNthCalledWith(2, '/api/roles/role-id', {
      method: 'PATCH',
      body: { name: '客户查看员更新', description: undefined, status: 'disabled' },
    });
  });

  it('saves role authorization with runtime payload names', async () => {
    httpRequestMock
      .mockResolvedValueOnce({
        roleId: 'role-id',
        permissionPointCodes: ['crm.customer:view'],
        departmentIds: ['dept_sales'],
        feishuUserIds: ['ou_sales_001'],
      })
      .mockResolvedValueOnce({ items: [{ id: 'role-id', code: 'crm_viewer', name: '客户查看员' }], page: 1, pageSize: 100, total: 1 });
    const { updateRoleAuthorization } = await import('./httpApi');

    await updateRoleAuthorization({
      roleId: 'role-id',
      permissionKeys: ['crm.customer:view'],
      departmentIds: ['dept_sales'],
      userIds: ['ou_sales_001'],
    });

    expect(httpRequestMock).toHaveBeenNthCalledWith(1, '/api/roles/role-id/authorization', {
      method: 'PUT',
      body: {
        permissionPointCodes: ['crm.customer:view'],
        departmentIds: ['dept_sales'],
        feishuUserIds: ['ou_sales_001'],
      },
    });
  });

  it('loads runtime permission tree', async () => {
    httpRequestMock.mockResolvedValue({ items: [{ key: 'crm.customer', title: '客户管理', children: [] }] });
    const { listIamPermissionTree } = await import('./httpApi');

    await expect(listIamPermissionTree()).resolves.toEqual([{ key: 'crm.customer', title: '客户管理', children: [] }]);
    expect(httpRequestMock).toHaveBeenCalledWith('/api/roles/permission-tree');
  });
});
