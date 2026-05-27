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

  it('loads runtime application detail', async () => {
    httpRequestMock.mockResolvedValue({
      id: 'app-id',
      app_key: 'app_key_1',
      name: 'Demo CRM',
      status: 'active',
      created_by_feishu_user_id: 'ou_admin',
      created_by_name: '平台管理员',
      created_at: '2026-05-25T00:00:00.000Z',
      permission_group_count: 1,
      permission_point_count: 2,
      last_api_called_at: '2026-05-25T00:10:00.000Z',
    });
    const { getApplication } = await import('./httpApi');

    const application = await getApplication('app-id');

    expect(httpRequestMock).toHaveBeenCalledWith('/api/applications/app-id');
    expect(application).toMatchObject({
      id: 'app-id',
      appKey: 'app_key_1',
      ownerName: '平台管理员',
      permissionGroupCount: 1,
      permissionPointCount: 2,
      lastApiCalledAt: '2026-05-25T00:10:00.000Z',
      appSecretPreview: 'sec_****',
      apiSecretPreview: 'api_****',
    });
  });

  it('loads runtime application permission registrations', async () => {
    httpRequestMock.mockResolvedValue({
      items: [
        {
          id: 'registration-id',
          application_id: 'app-id',
          group_code: 'crm.customer',
          group_name: '客户管理',
          permission_code: 'crm.customer:view',
          permission_name: '查看客户',
          permission_status: 'active',
          updated_at: '2026-05-25T00:00:00.000Z',
        },
      ],
    });
    const { listApplicationPermissionRegistrations } = await import('./httpApi');

    const registrations = await listApplicationPermissionRegistrations('app-id');

    expect(httpRequestMock).toHaveBeenCalledWith('/api/applications/app-id/permission-registrations');
    expect(registrations).toEqual([
      {
        id: 'registration-id',
        applicationId: 'app-id',
        groupCode: 'crm.customer',
        groupName: '客户管理',
        permissionCode: 'crm.customer:view',
        permissionName: '查看客户',
        status: 'active',
        updatedAt: '2026-05-25T00:00:00.000Z',
      },
    ]);
  });

  it('manages runtime redirect URI endpoints without rewriting URI fields', async () => {
    httpRequestMock
      .mockResolvedValueOnce({
        items: [
          {
            application_id: 'app-id',
            redirect_uri: 'https://demo.example.com/auth/callback',
            environment: 'production',
            status: 'active',
            note: '生产',
            created_at: '2026-05-25T00:00:00.000Z',
            updated_at: '2026-05-25T00:00:00.000Z',
          },
        ],
      })
      .mockResolvedValueOnce({
        application_id: 'app-id',
        redirect_uri: 'https://staging.example.com/auth/callback',
        environment: 'staging',
        status: 'active',
        note: '预发',
        created_at: '2026-05-25T01:00:00.000Z',
        updated_at: '2026-05-25T01:00:00.000Z',
      })
      .mockResolvedValueOnce({
        application_id: 'app-id',
        redirect_uri: 'https://demo.example.com/auth/callback',
        environment: 'production',
        status: 'disabled',
        note: '生产',
        created_at: '2026-05-25T00:00:00.000Z',
        updated_at: '2026-05-25T02:00:00.000Z',
        disabled_at: '2026-05-25T02:00:00.000Z',
      });
    const { createApplicationRedirectUri, listApplicationRedirectUris, updateApplicationRedirectUriStatus } = await import('./httpApi');

    await listApplicationRedirectUris('app-id');
    await createApplicationRedirectUri('app-id', {
      redirectUri: 'https://staging.example.com/auth/callback',
      environment: 'staging',
      note: '预发',
    });
    await updateApplicationRedirectUriStatus('app-id', {
      redirectUri: 'https://demo.example.com/auth/callback',
      status: 'disabled',
    });

    expect(httpRequestMock).toHaveBeenNthCalledWith(1, '/api/applications/app-id/redirect-uris');
    expect(httpRequestMock).toHaveBeenNthCalledWith(2, '/api/applications/app-id/redirect-uris', {
      method: 'POST',
      body: {
        redirectUri: 'https://staging.example.com/auth/callback',
        environment: 'staging',
        note: '预发',
      },
    });
    expect(httpRequestMock).toHaveBeenNthCalledWith(3, '/api/applications/app-id/redirect-uris/status', {
      method: 'PATCH',
      body: {
        redirectUri: 'https://demo.example.com/auth/callback',
        status: 'disabled',
      },
    });
  });

  it('rotates runtime secrets through one-time result endpoints', async () => {
    httpRequestMock.mockResolvedValue({
      kind: 'app_secret',
      secret: 'sec_demo_only_not_real_000000000000',
      rotatedAt: '2026-05-25T00:00:00.000Z',
    });
    const { rotateApplicationSecret } = await import('./httpApi');

    const result = await rotateApplicationSecret('app-id', 'app_secret');

    expect(result.secret).toBe('sec_demo_only_not_real_000000000000');
    expect(httpRequestMock).toHaveBeenCalledWith('/api/applications/app-id/secrets/rotate', {
      method: 'POST',
      body: { kind: 'app_secret' },
    });
  });

  it('manages runtime application admin endpoints with encoded Feishu user ids', async () => {
    httpRequestMock
      .mockResolvedValueOnce({
        items: [
          {
            application_id: 'app-id',
            feishu_user_id: 'ou_admin',
            name: '管理员',
            email: 'admin@example.com',
            status: 'active',
            role: 'primary',
            created_at: '2026-05-25T00:00:00.000Z',
          },
        ],
      })
      .mockResolvedValueOnce({
        application_id: 'app-id',
        feishu_user_id: 'ou_new/admin',
        name: '新管理员',
        status: 'active',
        role: 'application_admin',
        created_at: '2026-05-25T01:00:00.000Z',
      })
      .mockResolvedValueOnce({ ok: true });
    const { addApplicationAdmin, listApplicationAdmins, removeApplicationAdmin } = await import('./httpApi');

    await listApplicationAdmins('app-id');
    await addApplicationAdmin('app-id', { feishuUserId: 'ou_new/admin' });
    await removeApplicationAdmin('app-id', 'ou_new/admin');

    expect(httpRequestMock).toHaveBeenNthCalledWith(1, '/api/applications/app-id/admins');
    expect(httpRequestMock).toHaveBeenNthCalledWith(2, '/api/applications/app-id/admins', {
      method: 'POST',
      body: { feishuUserId: 'ou_new/admin' },
    });
    expect(httpRequestMock).toHaveBeenNthCalledWith(3, '/api/applications/app-id/admins/ou_new%2Fadmin', {
      method: 'DELETE',
    });
  });

  it('records runtime secret copy events without sending secret values', async () => {
    httpRequestMock.mockResolvedValue({ ok: true });
    const { recordRuntimeSecretCopy } = await import('./httpApi');

    await recordRuntimeSecretCopy('app-id', 'agent_prompt');

    expect(httpRequestMock).toHaveBeenCalledWith('/api/applications/app-id/secret-copy-events', {
      method: 'POST',
      body: { kind: 'agent_prompt' },
    });
    expect(JSON.stringify(httpRequestMock.mock.calls[0])).not.toContain('sec_');
    expect(JSON.stringify(httpRequestMock.mock.calls[0])).not.toContain('api_sec_');
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

  it('passes application audit filters to the runtime API', async () => {
    httpRequestMock.mockResolvedValue({ items: [], page: 1, pageSize: 20, total: 0 });
    const { listAuditLogs } = await import('./httpApi');

    await listAuditLogs({ applicationId: 'app-id', page: 1, pageSize: 20 });

    expect(httpRequestMock).toHaveBeenCalledWith('/api/audit-logs', {
      query: {
        page: 1,
        pageSize: 20,
        action: undefined,
        result: undefined,
        keyword: undefined,
        targetId: 'app-id',
        targetType: 'application',
      },
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
        permissionGroupCodes: [],
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
