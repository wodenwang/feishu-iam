import { describe, expect, it } from 'vitest';
import {
  mapAuditLog,
  mapCreateApplicationResult,
  mapCurrentSessionResponse,
  mapPageResult,
  mapRuntimeDepartment,
  mapRuntimeApplication,
  mapRuntimeDirectoryUser,
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
      }),
    ).toMatchObject({
      id: 'app-id',
      appKey: 'app_key_1',
      name: 'Demo',
      code: 'app_key_1',
      permissionGroupCount: 2,
      permissionPointCount: 3,
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
});
