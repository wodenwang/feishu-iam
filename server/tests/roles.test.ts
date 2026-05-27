import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DbPool } from '../src/db/pool';
import { buildTestApp } from './helpers/testApp';
import { createTestPool } from './helpers/testDb';
import { signApplicationApiRequest } from './helpers/accessLoop';

describe('role routes', () => {
  let pool: DbPool;
  let app: Awaited<ReturnType<typeof buildTestApp>>;

  beforeEach(async () => {
    pool = await createTestPool();
    app = await buildTestApp(pool);
  });

  afterEach(async () => {
    await app?.close();
    await pool?.end();
  });

  it('requires a platform admin to manage roles and read permission tree', async () => {
    const unauthenticatedRoles = await app.inject({ method: 'GET', url: '/api/roles' });
    expect(unauthenticatedRoles.statusCode).toBe(401);
    expect(unauthenticatedRoles.json()).toMatchObject({ code: 'UNAUTHORIZED', requestId: expect.any(String) });

    const userCookie = await loginCookie(app, 'ou_role_user', '角色普通用户');
    const forbiddenTree = await app.inject({
      method: 'GET',
      url: '/api/roles/permission-tree',
      headers: { cookie: userCookie },
    });
    expect(forbiddenTree.statusCode).toBe(403);
    expect(forbiddenTree.json()).toMatchObject({ code: 'FORBIDDEN', requestId: expect.any(String) });
  });

  it('creates, lists, authorizes, updates and disables runtime roles', async () => {
    const adminCookie = await loginAndBindAdmin(app, 'ou_role_admin', '角色管理员');
    const assigneeCookie = await loginCookie(app, 'ou_role_assignee', '角色授权用户');
    const application = await createApplication(app, adminCookie, 'v0.1.5 Roles Demo');
    await seedDepartment(pool, { id: 'dept_roles_root', name: '角色演示组织', parentId: null });
    await seedDepartment(pool, { id: 'dept_roles_sales', name: '销售部', parentId: 'dept_roles_root' });
    await registerPermissions(app, application, [
      { groupCode: 'crm.customer', groupName: '客户管理', code: 'crm.customer:view', name: '查看客户' },
      { groupCode: 'crm.customer', groupName: '客户管理', code: 'crm.customer:edit', name: '编辑客户' },
    ]);

    const created = await app.inject({
      method: 'POST',
      url: '/api/roles',
      headers: { cookie: adminCookie },
      payload: { appKey: application.app_key, code: 'crm_viewer', name: '客户查看员', description: '查看客户资料' },
    });
    expect(created.statusCode).toBe(200);
    expect(created.json()).toMatchObject({ appKey: application.app_key, code: 'crm_viewer', name: '客户查看员' });

    const duplicate = await app.inject({
      method: 'POST',
      url: '/api/roles',
      headers: { cookie: adminCookie },
      payload: { appKey: application.app_key, code: 'crm_viewer', name: '重复角色' },
    });
    expect(duplicate.statusCode).toBe(409);
    expect(duplicate.json()).toMatchObject({ code: 'ROLE_CODE_EXISTS', requestId: expect.any(String) });

    const authorization = await app.inject({
      method: 'PUT',
      url: `/api/roles/${created.json().id}/authorization`,
      headers: { cookie: adminCookie },
      payload: {
        permissionPointCodes: ['crm.customer:view'],
        feishuUserIds: ['ou_role_assignee'],
        departmentIds: ['dept_roles_sales'],
      },
    });
    expect(authorization.statusCode).toBe(200);

    const roles = await app.inject({
      method: 'GET',
      url: `/api/roles?appKey=${application.app_key}&keyword=viewer&page=1&pageSize=20`,
      headers: { cookie: adminCookie },
    });
    expect(roles.statusCode).toBe(200);
    expect(roles.json()).toMatchObject({ page: 1, pageSize: 20, total: 1 });
    expect(roles.json().items).toEqual([
      expect.objectContaining({
        id: created.json().id,
        application_id: application.id,
        application_name: 'v0.1.5 Roles Demo',
        app_key: application.app_key,
        code: 'crm_viewer',
        name: '客户查看员',
        permission_group_count: 1,
        permission_point_count: 1,
        department_binding_count: 1,
        user_binding_count: 1,
        permission_keys: ['crm.customer:view'],
        department_ids: ['dept_roles_sales'],
        user_ids: ['ou_role_assignee'],
      }),
    ]);

    const tree = await app.inject({ method: 'GET', url: '/api/roles/permission-tree', headers: { cookie: adminCookie } });
    expect(tree.statusCode).toBe(200);
    expect(tree.json().items).toEqual([
      expect.objectContaining({
        key: 'crm.customer',
        title: '客户管理',
        children: expect.arrayContaining([
          expect.objectContaining({ key: 'crm.customer:view', title: '查看客户' }),
          expect.objectContaining({ key: 'crm.customer:edit', title: '编辑客户' }),
        ]),
      }),
    ]);

    const updated = await app.inject({
      method: 'PATCH',
      url: `/api/roles/${created.json().id}`,
      headers: { cookie: adminCookie },
      payload: { name: '客户查看员更新', status: 'disabled' },
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json()).toMatchObject({ name: '客户查看员更新', status: 'disabled' });

    const permissionQuery = await queryPermissions(app, application, assigneeCookie);
    expect(permissionQuery.statusCode).toBe(200);
    expect(permissionQuery.json().permissionCodes).toEqual([]);
  });

  it('authorizes roles by permission group and expands active points during permission query', async () => {
    const adminCookie = await loginAndBindAdmin(app, 'ou_role_group_admin', '权限组管理员');
    const assigneeCookie = await loginCookie(app, 'ou_role_group_assignee', '权限组授权用户');
    const application = await createApplication(app, adminCookie, 'v0.2.1 Role Group Demo');
    await registerPermissions(app, application, [
      { groupCode: 'crm.customer', groupName: '客户管理', code: 'crm.customer:view', name: '查看客户' },
      { groupCode: 'crm.customer', groupName: '客户管理', code: 'crm.customer:update', name: '更新客户' },
      { groupCode: 'crm.contract', groupName: '合同管理', code: 'crm.contract:read', name: '查看合同' },
    ]);

    const created = await app.inject({
      method: 'POST',
      url: '/api/roles',
      headers: { cookie: adminCookie },
      payload: { appKey: application.app_key, code: 'crm_group_viewer', name: '客户组授权' },
    });
    expect(created.statusCode).toBe(200);

    const authorization = await app.inject({
      method: 'PUT',
      url: `/api/roles/${created.json().id}/authorization`,
      headers: { cookie: adminCookie },
      payload: {
        permissionGroupCodes: ['crm.customer'],
        permissionPointCodes: ['crm.contract:read'],
        feishuUserIds: ['ou_role_group_assignee'],
        departmentIds: [],
      },
    });
    expect(authorization.statusCode).toBe(200);
    expect(authorization.json()).toMatchObject({
      permissionGroupCodes: ['crm.customer'],
      permissionPointCodes: ['crm.contract:read'],
    });

    const roles = await app.inject({
      method: 'GET',
      url: `/api/roles?appKey=${application.app_key}&keyword=group&page=1&pageSize=20`,
      headers: { cookie: adminCookie },
    });
    expect(roles.statusCode).toBe(200);
    expect(roles.json().items[0]).toMatchObject({
      permission_group_count: 2,
      permission_point_count: 3,
      permission_keys: ['crm.customer', 'crm.contract:read', 'crm.customer:update', 'crm.customer:view'],
    });

    const permissionQuery = await queryPermissions(app, application, assigneeCookie);
    expect(permissionQuery.statusCode).toBe(200);
    expect(permissionQuery.json().permissionCodes).toEqual(['crm.contract:read', 'crm.customer:update', 'crm.customer:view']);

    await pool.query("update permission_groups set status = 'disabled' where application_id = $1 and code = 'crm.customer'", [
      application.id,
    ]);
    const afterDisable = await queryPermissions(app, application, assigneeCookie);
    expect(afterDisable.statusCode).toBe(200);
    expect(afterDisable.json().permissionCodes).toEqual(['crm.contract:read']);

    const audit = await pool.query(
      "select metadata::jsonb as metadata from audit_logs where action = 'role.authorization.update' order by id desc limit 1",
    );
    expect(audit.rows[0].metadata).toMatchObject({
      permissionGroupCount: 1,
      permissionPointCount: 1,
    });
  });
});

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
  const body = response.json() as { application: { id: string; app_key: string }; apiSecret: string };
  expect(body.apiSecret).toMatch(/^api_sec_/);
  return { ...body.application, apiSecret: body.apiSecret };
}

async function registerPermissions(
  app: Awaited<ReturnType<typeof buildTestApp>>,
  application: { app_key: string; apiSecret: string },
  points: Array<{ groupCode: string; groupName: string; code: string; name: string }>,
) {
  const groups = [...new Map(points.map((point) => [point.groupCode, { code: point.groupCode, name: point.groupName }])).values()];
  const groupBody = JSON.stringify({ groups });
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

async function seedDepartment(pool: DbPool, input: { id: string; name: string; parentId: string | null }) {
  await pool.query(
    `
      insert into directory_departments(id, name, parent_id, status)
      values ($1, $2, $3, 'active')
      on conflict (id) do update set name = excluded.name, parent_id = excluded.parent_id
    `,
    [input.id, input.name, input.parentId],
  );
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
