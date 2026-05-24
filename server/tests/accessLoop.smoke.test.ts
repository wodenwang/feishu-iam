import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DbPool } from '../src/db/pool';
import { buildTestApp } from './helpers/testApp';
import { createTestPool } from './helpers/testDb';
import { signApplicationApiRequest } from './helpers/accessLoop';

describe('v0.1.2 access loop smoke', () => {
  let pool: DbPool;
  let app: Awaited<ReturnType<typeof buildTestApp>>;

  beforeEach(async () => {
    pool = await createTestPool();
    app = await buildTestApp(pool);
  });

  afterEach(async () => {
    await app.close();
    await pool.end();
  });

  it('allows an authorized Feishu user and denies an unauthorized user through IAM session cookie permission query', async () => {
    const adminCookie = await loginAndBindAdmin(app, 'ou_v012_admin', 'v0.1.2 管理员');
    const allowedCookie = await loginCookie(app, 'ou_v012_allowed', '有客户权限用户');
    const deniedCookie = await loginCookie(app, 'ou_v012_denied', '无客户权限用户');
    const application = await createApplication(app, adminCookie, 'v0.1.2 Demo CRM');

    await registerPermissions(app, application, [
      { groupCode: 'demo.customer', code: 'demo.customer:view', name: '查看客户' },
      { groupCode: 'demo.customer', code: 'demo.customer:edit', name: '编辑客户' },
    ]);

    const role = await app.inject({
      method: 'POST',
      url: '/api/roles',
      headers: { cookie: adminCookie },
      payload: { appKey: application.app_key, code: 'crm_viewer', name: '客户查看员' },
    });
    expect(role.statusCode).toBe(200);
    const roleJson = role.json();

    const authorization = await app.inject({
      method: 'PUT',
      url: `/api/roles/${roleJson.id}/authorization`,
      headers: { cookie: adminCookie },
      payload: {
        permissionPointCodes: ['demo.customer:view'],
        feishuUserIds: ['ou_v012_allowed'],
        departmentIds: [],
      },
    });
    expect(authorization.statusCode).toBe(200);

    const roles = await app.inject({
      method: 'GET',
      url: `/api/roles?appKey=${application.app_key}`,
      headers: { cookie: adminCookie },
    });
    expect(roles.statusCode).toBe(200);
    expect(roles.json()).toMatchObject({ page: 1, pageSize: 20, total: 1 });

    const directoryForbidden = await app.inject({
      method: 'GET',
      url: '/api/directory/users',
      headers: { cookie: deniedCookie },
    });
    expect(directoryForbidden.statusCode).toBe(403);
    expect(directoryForbidden.json()).toMatchObject({ code: 'FORBIDDEN' });

    const directoryUsers = await app.inject({
      method: 'GET',
      url: '/api/directory/users',
      headers: { cookie: adminCookie },
    });
    expect(directoryUsers.statusCode).toBe(200);
    expect(directoryUsers.json().items.map((item: { feishu_user_id: string }) => item.feishu_user_id)).toContain(
      'ou_v012_allowed',
    );

    const allowed = await queryPermissions(app, application, allowedCookie);
    expect(allowed.statusCode).toBe(200);
    expect(allowed.json()).toMatchObject({
      appKey: application.app_key,
      feishuUserId: 'ou_v012_allowed',
      permissionCodes: ['demo.customer:view'],
    });

    const denied = await queryPermissions(app, application, deniedCookie);
    expect(denied.statusCode).toBe(200);
    expect(denied.json()).toMatchObject({
      appKey: application.app_key,
      feishuUserId: 'ou_v012_denied',
      permissionCodes: [],
    });

    const audit = await pool.query(
      `
        select action
        from audit_logs
        where action in (
          'application_api.permission_group.upsert',
          'application_api.permission_point.upsert',
          'role.create',
          'role.authorization.update',
          'application_api.permission.query'
        )
        order by id
      `,
    );
    expect(audit.rows.map((row) => row.action)).toEqual([
      'application_api.permission_group.upsert',
      'application_api.permission_point.upsert',
      'role.create',
      'role.authorization.update',
      'application_api.permission.query',
      'application_api.permission.query',
    ]);
  });

  it('omits permissions from disabled roles and disabled permission points', async () => {
    const adminCookie = await loginAndBindAdmin(app, 'ou_v012_disabled_admin', '禁用链路管理员');
    const userCookie = await loginCookie(app, 'ou_v012_disabled_user', '禁用链路用户');
    const application = await createApplication(app, adminCookie, 'v0.1.2 Disabled Demo');

    await registerPermissions(app, application, [{ groupCode: 'demo.disabled', code: 'demo.disabled:view', name: '禁用查看' }]);

    const role = await app.inject({
      method: 'POST',
      url: '/api/roles',
      headers: { cookie: adminCookie },
      payload: { appKey: application.app_key, code: 'disabled_viewer', name: '禁用查看员' },
    });
    expect(role.statusCode).toBe(200);
    const roleJson = role.json();

    await app.inject({
      method: 'PUT',
      url: `/api/roles/${roleJson.id}/authorization`,
      headers: { cookie: adminCookie },
      payload: { permissionPointCodes: ['demo.disabled:view'], feishuUserIds: ['ou_v012_disabled_user'], departmentIds: [] },
    });

    const beforeDisable = await queryPermissions(app, application, userCookie);
    expect(beforeDisable.json().permissionCodes).toEqual(['demo.disabled:view']);

    await app.inject({
      method: 'PATCH',
      url: `/api/roles/${roleJson.id}`,
      headers: { cookie: adminCookie },
      payload: { status: 'disabled' },
    });
    const roleDisabled = await queryPermissions(app, application, userCookie);
    expect(roleDisabled.json().permissionCodes).toEqual([]);

    await app.inject({
      method: 'PATCH',
      url: `/api/roles/${roleJson.id}`,
      headers: { cookie: adminCookie },
      payload: { status: 'active' },
    });
    await pool.query("update permission_points set status = 'disabled' where code = 'demo.disabled:view'");
    const pointDisabled = await queryPermissions(app, application, userCookie);
    expect(pointDisabled.json().permissionCodes).toEqual([]);
  });
});

async function registerPermissions(
  app: Awaited<ReturnType<typeof buildTestApp>>,
  application: { app_key: string; apiSecret: string },
  points: Array<{ groupCode: string; code: string; name: string }>,
) {
  const groupBody = JSON.stringify({
    groups: [...new Map(points.map((point) => [point.groupCode, { code: point.groupCode, name: '客户管理' }])).values()],
  });
  const group = await app.inject({
    method: 'PUT',
    url: '/api/application/permission-groups',
    headers: signApplicationApiRequest({
      method: 'PUT',
      path: '/api/application/permission-groups',
      appKey: application.app_key,
      apiSecret: application.apiSecret,
      body: groupBody,
    }),
    payload: groupBody,
  });
  expect(group.statusCode).toBe(200);

  const pointBody = JSON.stringify({ points });
  const point = await app.inject({
    method: 'PUT',
    url: '/api/application/permission-points',
    headers: signApplicationApiRequest({
      method: 'PUT',
      path: '/api/application/permission-points',
      appKey: application.app_key,
      apiSecret: application.apiSecret,
      body: pointBody,
    }),
    payload: pointBody,
  });
  expect(point.statusCode).toBe(200);
}

async function queryPermissions(
  app: Awaited<ReturnType<typeof buildTestApp>>,
  application: { app_key: string; apiSecret: string },
  cookie: string,
) {
  return app.inject({
    method: 'GET',
    url: '/api/application/me/permissions',
    headers: {
      cookie,
      ...signApplicationApiRequest({
        method: 'GET',
        path: '/api/application/me/permissions',
        appKey: application.app_key,
        apiSecret: application.apiSecret,
      }),
    },
  });
}

async function loginAndBindAdmin(app: Awaited<ReturnType<typeof buildTestApp>>, feishuUserId: string, name: string) {
  const cookie = await loginCookie(app, feishuUserId, name);
  await app.inject({ method: 'POST', url: '/api/initialization/bind-platform-admin', headers: { cookie } });
  return cookie;
}

async function loginCookie(app: Awaited<ReturnType<typeof buildTestApp>>, feishuUserId: string, name: string) {
  const login = await app.inject({
    method: 'POST',
    url: '/api/dev/feishu/mock-login',
    payload: { feishuUserId, name },
  });
  return String(login.headers['set-cookie']);
}

async function createApplication(app: Awaited<ReturnType<typeof buildTestApp>>, cookie: string, name: string) {
  const response = await app.inject({
    method: 'POST',
    url: '/api/applications',
    headers: { cookie },
    payload: { name },
  });
  expect(response.statusCode).toBe(200);
  return response.json() as { id: string; app_key: string; apiSecret: string };
}
