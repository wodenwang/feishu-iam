import { describe, expect, it } from 'vitest';
import {
  mapAuditLog,
  mapCreateApplicationResult,
  mapCurrentSessionResponse,
  mapPageResult,
  mapRuntimeDepartment,
  mapRuntimeApplication,
  mapRuntimeApplicationAdmin,
  mapRuntimeDirectoryUser,
  mapRuntimePermissionTree,
  mapRuntimeRedirectUri,
  mapRuntimeRole,
} from './dtoMappers';

describe('dtoMappers', () => {
  it('maps authenticated session response', () => {
    expect(
      mapCurrentSessionResponse({
        authenticated: true,
        user: { feishuUserId: 'ou_1', displayName: '管理员', departmentPath: '-', status: 'active' },
        roles: ['platform_admin'],
        permissions: ['dashboard:view'],
        applicationIds: [],
      }),
    ).toMatchObject({
      user: { feishuUserId: 'ou_1', displayName: '管理员' },
      roles: ['platform_admin'],
      permissions: ['dashboard:view'],
    });
  });

  it('rejects unauthenticated session response', () => {
    expect(() => mapCurrentSessionResponse({ authenticated: false })).toThrow('UNAUTHENTICATED_SESSION');
  });

  it('maps runtime application list item without secrets', () => {
    expect(
      mapRuntimeApplication({
        id: 'app-id',
        app_key: 'app_key_1',
        name: 'Demo',
        status: 'active',
        created_at: '2026-05-24T00:00:00.000Z',
        permission_group_count: 2,
        permission_point_count: 3,
        redirect_uri_count: 4,
        active_redirect_uri_count: 3,
        admin_count: 2,
        app_secret_rotated_at: '2026-05-24T01:00:00.000Z',
        api_secret_rotated_at: '2026-05-24T02:00:00.000Z',
      }),
    ).toMatchObject({
      id: 'app-id',
      appKey: 'app_key_1',
      name: 'Demo',
      code: 'app_key_1',
      permissionGroupCount: 2,
      permissionPointCount: 3,
      redirectUriCount: 4,
      activeRedirectUriCount: 3,
      adminCount: 2,
      appSecretRotatedAt: '2026-05-24T01:00:00.000Z',
      apiSecretRotatedAt: '2026-05-24T02:00:00.000Z',
    });
  });

  it('maps runtime redirect URI and application admin records', () => {
    expect(
      mapRuntimeRedirectUri({
        application_id: 'app-id',
        redirect_uri: 'https://demo.example.com/auth/callback',
        environment: 'production',
        status: 'disabled',
        note: null,
        created_by_feishu_user_id: 'ou_admin',
        created_by_name: null,
        created_at: '2026-05-24T00:00:00.000Z',
        updated_at: '2026-05-24T01:00:00.000Z',
        disabled_at: '2026-05-24T01:00:00.000Z',
      }),
    ).toEqual({
      applicationId: 'app-id',
      redirectUri: 'https://demo.example.com/auth/callback',
      environment: 'production',
      status: 'disabled',
      note: '',
      createdByFeishuUserId: 'ou_admin',
      createdByName: 'ou_admin',
      createdAt: '2026-05-24T00:00:00.000Z',
      updatedAt: '2026-05-24T01:00:00.000Z',
      disabledAt: '2026-05-24T01:00:00.000Z',
    });

    expect(
      mapRuntimeApplicationAdmin({
        application_id: 'app-id',
        feishu_user_id: 'ou_admin',
        name: '管理员',
        email: null,
        status: null,
        role: null,
        created_by_feishu_user_id: 'ou_creator',
        created_by_name: '创建人',
        created_at: '2026-05-24T00:00:00.000Z',
      }),
    ).toEqual({
      applicationId: 'app-id',
      feishuUserId: 'ou_admin',
      name: '管理员',
      email: undefined,
      status: 'active',
      role: 'application_admin',
      createdByFeishuUserId: 'ou_creator',
      createdByName: '创建人',
      createdAt: '2026-05-24T00:00:00.000Z',
    });
  });

  it('maps create application envelope', () => {
    expect(
      mapCreateApplicationResult({
        application: {
          id: 'app-id',
          app_key: 'app_key_1',
          name: 'Demo',
          status: 'active',
          created_at: '2026-05-24T00:00:00.000Z',
        },
        appSecret: 'sec_x',
        apiSecret: 'api_sec_x',
      }),
    ).toMatchObject({
      application: { id: 'app-id', appKey: 'app_key_1' },
      appSecret: 'sec_x',
      apiSecret: 'api_sec_x',
    });
  });

  it('maps audit log fields and failure result', () => {
    expect(
      mapAuditLog({
        id: 1,
        request_id: 'req_1',
        actor_feishu_user_id: 'ou_1',
        action: 'application.create',
        target_type: 'application',
        target_id: 'app-id',
        result: 'failure',
        metadata: {},
        created_at: '2026-05-24T00:00:00.000Z',
      }),
    ).toMatchObject({
      id: '1',
      requestId: 'req_1',
      actorFeishuUserId: 'ou_1',
      applicationId: 'app-id',
      result: 'failed',
    });
  });

  it('maps page results', () => {
    expect(
      mapPageResult(
        {
          items: [{ id: 'app-id', app_key: 'app_key_1', name: 'Demo', status: 'active', created_at: '2026-05-24T00:00:00.000Z' }],
          page: 1,
          pageSize: 20,
          total: 1,
        },
        mapRuntimeApplication,
      ),
    ).toMatchObject({ page: 1, pageSize: 20, total: 1, items: [{ id: 'app-id' }] });
  });

  it('maps runtime department fields', () => {
    expect(
      mapRuntimeDepartment({
        id: 'dept_sales',
        name: '销售部',
        parent_id: 'dept_root',
        path: '飞书 IAM 演示组织 / 销售部',
        user_count: 3,
        updated_at: '2026-05-24T00:00:00.000Z',
      }),
    ).toEqual({
      id: 'dept_sales',
      name: '销售部',
      parentId: 'dept_root',
      path: '飞书 IAM 演示组织 / 销售部',
      userCount: 3,
      updatedAt: '2026-05-24T00:00:00.000Z',
    });
  });

  it('maps runtime directory user fields with stable fallbacks', () => {
    expect(
      mapRuntimeDirectoryUser({
        feishu_user_id: 'ou_sales_001',
        name: '销售一号',
        email: null,
        department_id: 'dept_sales',
        department_name: '销售部',
        department_path: '飞书 IAM 演示组织 / 销售部',
        status: 'active',
        synced_at: '2026-05-24T00:00:00.000Z',
        local_role_summary: null,
        last_login_at: null,
        last_permission_queried_at: null,
      }),
    ).toMatchObject({
      feishuUserId: 'ou_sales_001',
      displayName: '销售一号',
      departmentId: 'dept_sales',
      departmentName: '销售部',
      departmentPath: '飞书 IAM 演示组织 / 销售部',
      status: 'active',
      email: undefined,
      syncedAt: '2026-05-24T00:00:00.000Z',
      localRoleSummary: '-',
      lastLoginAt: undefined,
      lastPermissionQueriedAt: undefined,
    });
  });

  it('maps runtime role projection fields', () => {
    expect(
      mapRuntimeRole({
        id: 'role-id',
        application_id: 'app-id',
        application_name: 'Demo CRM',
        app_key: 'app_key_1',
        code: 'crm_viewer',
        name: '客户查看员',
        description: null,
        status: 'active',
        permission_group_count: 1,
        permission_point_count: 2,
        department_binding_count: 1,
        user_binding_count: 1,
        permission_keys: ['crm.customer:view'],
        department_ids: ['dept_sales'],
        user_ids: ['ou_sales_001'],
        created_at: '2026-05-24T00:00:00.000Z',
        updated_at: '2026-05-24T00:01:00.000Z',
      }),
    ).toEqual({
      id: 'role-id',
      applicationId: 'app-id',
      applicationName: 'Demo CRM',
      name: '客户查看员',
      code: 'crm_viewer',
      description: undefined,
      status: 'active',
      permissionGroupCount: 1,
      permissionPointCount: 2,
      departmentBindingCount: 1,
      userBindingCount: 1,
      permissionKeys: ['crm.customer:view'],
      departmentIds: ['dept_sales'],
      userIds: ['ou_sales_001'],
      createdAt: '2026-05-24T00:00:00.000Z',
      updatedAt: '2026-05-24T00:01:00.000Z',
    });
  });

  it('maps runtime permission tree recursively', () => {
    expect(
      mapRuntimePermissionTree([
        {
          key: 'crm.customer',
          title: '客户管理',
          children: [{ key: 'crm.customer:view', title: '查看客户' }],
        },
      ]),
    ).toEqual([
      {
        key: 'crm.customer',
        title: '客户管理',
        children: [{ key: 'crm.customer:view', title: '查看客户' }],
      },
    ]);
  });
});
