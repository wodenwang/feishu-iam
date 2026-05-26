import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DbPool } from '../src/db/pool';
import { buildTestApp } from './helpers/testApp';
import { createTestPool } from './helpers/testDb';
import { signApplicationApiRequest } from './helpers/accessLoop';

describe('application admin runtime', () => {
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

  it('binds an application admin and projects scoped session permissions', async () => {
    const ownerCookie = await loginCookie(app, 'ou_app_owner_001', '应用负责人');
    const adminCookie = await loginAndBindAdmin(app, 'ou_platform_admin_001', '平台管理员');

    const created = await createApplication(app, adminCookie, '应用管理员应用', 'ou_app_owner_001');
    const session = await app.inject({ method: 'GET', url: '/api/session/current', headers: { cookie: ownerCookie } });

    expect(session.statusCode).toBe(200);
    expect(session.json()).toMatchObject({
      authenticated: true,
      roles: ['application_admin'],
      permissions: expect.arrayContaining(['application:view', 'application:secret', 'role:view', 'role:update', 'audit:view']),
      applicationIds: [created.id],
    });
    expect(session.json().permissions).not.toContain('application:create');
    expect(session.json().permissions).not.toContain('sync:run');

    const audit = await pool.query("select action, target_id, metadata from audit_logs where action = 'application.admin.bind'");
    expect(audit.rows[0]).toMatchObject({
      action: 'application.admin.bind',
      target_id: created.id,
    });
    expect(audit.rows[0].metadata).toMatchObject({ ownerFeishuUserId: 'ou_app_owner_001' });
  });

  it('rejects binding an application admin that is not a known Feishu user', async () => {
    const adminCookie = await loginAndBindAdmin(app, 'ou_platform_admin_missing_owner', '缺失负责人管理员');

    const response = await app.inject({
      method: 'POST',
      url: '/api/applications',
      headers: { cookie: adminCookie },
      payload: { name: '缺失负责人应用', ownerFeishuUserId: 'ou_missing_owner' },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ code: 'APPLICATION_ADMIN_USER_NOT_FOUND' });
  });

  it('limits application, role, permission registration and audit APIs to owned applications', async () => {
    const ownerCookie = await loginCookie(app, 'ou_app_owner_scope_001', '范围负责人');
    await loginCookie(app, 'ou_other_owner_scope_001', '其他负责人');
    const assigneeCookie = await loginCookie(app, 'ou_app_role_assignee_001', '应用授权用户');
    const adminCookie = await loginAndBindAdmin(app, 'ou_platform_admin_scope_001', '范围平台管理员');
    const owned = await createApplication(app, adminCookie, '负责人自有应用', 'ou_app_owner_scope_001');
    const other = await createApplication(app, adminCookie, '其他负责人应用', 'ou_other_owner_scope_001');
    await registerPermissions(app, owned, [
      { groupCode: 'crm.customer', groupName: '客户管理', code: 'crm.customer:view', name: '查看客户' },
    ]);
    await registerPermissions(app, other, [
      { groupCode: 'erp.order', groupName: '订单管理', code: 'erp.order:view', name: '查看订单' },
    ]);

    const list = await app.inject({ method: 'GET', url: '/api/applications?page=1&pageSize=20', headers: { cookie: ownerCookie } });
    expect(list.statusCode).toBe(200);
    expect(list.json()).toMatchObject({ total: 1, items: [expect.objectContaining({ id: owned.id })] });

    const ownedDetail = await app.inject({ method: 'GET', url: `/api/applications/${owned.id}`, headers: { cookie: ownerCookie } });
    const otherDetail = await app.inject({ method: 'GET', url: `/api/applications/${other.id}`, headers: { cookie: ownerCookie } });
    expect(ownedDetail.statusCode).toBe(200);
    expect(ownedDetail.json()).toMatchObject({ id: owned.id, owner_feishu_user_id: 'ou_app_owner_scope_001' });
    expect(otherDetail.statusCode).toBe(403);

    const permissionRegistrations = await app.inject({
      method: 'GET',
      url: `/api/applications/${owned.id}/permission-registrations`,
      headers: { cookie: ownerCookie },
    });
    expect(permissionRegistrations.statusCode).toBe(200);
    expect(permissionRegistrations.json().items).toEqual([
      expect.objectContaining({ application_id: owned.id, permission_code: 'crm.customer:view' }),
    ]);

    const otherSecretCopy = await app.inject({
      method: 'POST',
      url: `/api/applications/${other.id}/secret-copy-events`,
      headers: { cookie: ownerCookie },
      payload: { kind: 'runtime_env' },
    });
    expect(otherSecretCopy.statusCode).toBe(403);

    const createdRole = await app.inject({
      method: 'POST',
      url: '/api/roles',
      headers: { cookie: ownerCookie },
      payload: { appKey: owned.app_key, code: 'crm_viewer', name: '客户查看员' },
    });
    expect(createdRole.statusCode).toBe(200);

    const otherRole = await app.inject({
      method: 'POST',
      url: '/api/roles',
      headers: { cookie: ownerCookie },
      payload: { appKey: other.app_key, code: 'erp_viewer', name: '订单查看员' },
    });
    expect(otherRole.statusCode).toBe(403);

    const authorization = await app.inject({
      method: 'PUT',
      url: `/api/roles/${createdRole.json().id}/authorization`,
      headers: { cookie: ownerCookie },
      payload: {
        permissionPointCodes: ['crm.customer:view'],
        feishuUserIds: ['ou_app_role_assignee_001'],
        departmentIds: [],
      },
    });
    expect(authorization.statusCode).toBe(200);

    const permissionQuery = await queryPermissions(app, owned, assigneeCookie);
    expect(permissionQuery.statusCode).toBe(200);
    expect(permissionQuery.json().permissionCodes).toEqual(['crm.customer:view']);

    const globalAudit = await app.inject({ method: 'GET', url: '/api/audit-logs', headers: { cookie: ownerCookie } });
    const ownedAudit = await app.inject({
      method: 'GET',
      url: `/api/audit-logs?targetType=application&targetId=${owned.id}&page=1&pageSize=20`,
      headers: { cookie: ownerCookie },
    });
    const otherAudit = await app.inject({
      method: 'GET',
      url: `/api/audit-logs?targetType=application&targetId=${other.id}&page=1&pageSize=20`,
      headers: { cookie: ownerCookie },
    });
    expect(globalAudit.statusCode).toBe(403);
    expect(ownedAudit.statusCode).toBe(200);
    expect(ownedAudit.json().items.every((item: { target_id?: string }) => item.target_id === owned.id)).toBe(true);
    expect(otherAudit.statusCode).toBe(403);
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

async function createApplication(
  app: Awaited<ReturnType<typeof buildTestApp>>,
  cookie: string,
  name: string,
  ownerFeishuUserId: string,
) {
  const response = await app.inject({
    method: 'POST',
    url: '/api/applications',
    headers: { cookie },
    payload: { name, ownerFeishuUserId },
  });
  expect(response.statusCode).toBe(200);
  const body = response.json() as { application: { id: string; app_key: string }; apiSecret: string };
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
