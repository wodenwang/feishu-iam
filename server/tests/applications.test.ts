import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import crypto from 'node:crypto';
import type { DbPool } from '../src/db/pool';
import { buildTestApp } from './helpers/testApp';
import { createTestPool } from './helpers/testDb';

describe('applications API', () => {
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

  it('rejects unauthenticated application creation', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/applications',
      payload: { name: '未登录应用' },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('rejects non-admin application creation', async () => {
    const cookie = await loginCookie(app, 'ou_app_non_admin_001', '普通用户');
    const response = await app.inject({
      method: 'POST',
      url: '/api/applications',
      headers: { cookie },
      payload: { name: '普通用户应用' },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ code: 'FORBIDDEN' });
  });

  it('returns 400 for non-object application payloads', async () => {
    const cookie = await loginAndBindAdmin(app, 'ou_app_admin_invalid_payload', '应用管理员非法参数');
    const response = await app.inject({
      method: 'POST',
      url: '/api/applications',
      headers: { cookie },
      payload: null,
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ code: 'INVALID_APPLICATION_NAME' });
  });

  it('lets platform admins create applications with a one-time secret and audit log', async () => {
    const cookie = await loginAndBindAdmin(app, 'ou_app_admin_001', '应用管理员');
    const response = await app.inject({
      method: 'POST',
      url: '/api/applications',
      headers: { cookie },
      payload: { name: '运行时应用' },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body).toMatchObject({
      application: {
        name: '运行时应用',
        status: 'active',
      },
    });
    expect(body.application.app_key).toMatch(/^app_/);
    expect(body.appSecret).toMatch(/^sec_/);

    const secrets = await pool.query('select secret_hash from application_secrets where application_id = $1', [
      body.application.id,
    ]);
    const audit = await pool.query("select action, metadata::text as metadata from audit_logs where action = 'application.create'");
    expect(secrets.rows[0].secret_hash).not.toBe(body.appSecret);
    expect(audit.rows[0].action).toBe('application.create');
    expect(audit.rows[0].metadata).not.toContain(body.appSecret);
  });

  it('rejects duplicate application names', async () => {
    const cookie = await loginAndBindAdmin(app, 'ou_app_admin_002', '应用管理员二');

    await app.inject({ method: 'POST', url: '/api/applications', headers: { cookie }, payload: { name: '重复应用' } });
    const duplicate = await app.inject({
      method: 'POST',
      url: '/api/applications',
      headers: { cookie },
      payload: { name: '重复应用' },
    });

    expect(duplicate.statusCode).toBe(409);
    expect(duplicate.json()).toMatchObject({ code: 'APPLICATION_NAME_EXISTS' });
  });

  it('rejects duplicate application names regardless of case', async () => {
    const cookie = await loginAndBindAdmin(app, 'ou_app_admin_003', '应用管理员三');

    await app.inject({ method: 'POST', url: '/api/applications', headers: { cookie }, payload: { name: 'Case App' } });
    const duplicate = await app.inject({
      method: 'POST',
      url: '/api/applications',
      headers: { cookie },
      payload: { name: 'case app' },
    });

    expect(duplicate.statusCode).toBe(409);
    expect(duplicate.json()).toMatchObject({ code: 'APPLICATION_NAME_EXISTS' });
  });

  it('lists applications with pagination metadata and count fields', async () => {
    const cookie = await loginAndBindAdmin(app, 'ou_app_admin_list_001', '应用列表管理员');

    await app.inject({ method: 'POST', url: '/api/applications', headers: { cookie }, payload: { name: '列表应用 A' } });
    await app.inject({ method: 'POST', url: '/api/applications', headers: { cookie }, payload: { name: '列表应用 B' } });

    const response = await app.inject({
      method: 'GET',
      url: '/api/applications?page=1&pageSize=1',
      headers: { cookie },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      page: 1,
      pageSize: 1,
      total: 2,
    });
    expect(response.json().items).toHaveLength(1);
    expect(response.json().items[0]).toMatchObject({
      app_key: expect.stringMatching(/^app_/),
      status: 'active',
      permission_group_count: 0,
      permission_point_count: 0,
    });
    expect(response.json().items[0]).not.toHaveProperty('appSecret');
    expect(response.json().items[0]).not.toHaveProperty('apiSecret');
  });

  it('filters application list by keyword, status, and created time', async () => {
    const cookie = await loginAndBindAdmin(app, 'ou_app_admin_filter_001', '应用筛选管理员');

    const alpha = await app.inject({
      method: 'POST',
      url: '/api/applications',
      headers: { cookie },
      payload: { name: '筛选应用 Alpha' },
    });
    const beta = await app.inject({
      method: 'POST',
      url: '/api/applications',
      headers: { cookie },
      payload: { name: '筛选应用 Beta' },
    });
    await pool.query("update applications set status = 'disabled' where id = $1", [beta.json().application.id]);

    const active = await app.inject({
      method: 'GET',
      url: '/api/applications?keyword=Alpha&status=active&page=1&pageSize=20',
      headers: { cookie },
    });
    const disabled = await app.inject({
      method: 'GET',
      url: '/api/applications?status=disabled&page=1&pageSize=20',
      headers: { cookie },
    });
    const future = await app.inject({
      method: 'GET',
      url: '/api/applications?createdAtFrom=2999-01-01T00%3A00%3A00.000Z&page=1&pageSize=20',
      headers: { cookie },
    });

    expect(alpha.statusCode).toBe(200);
    expect(active.json()).toMatchObject({ total: 1, items: [{ name: '筛选应用 Alpha', status: 'active' }] });
    expect(disabled.json()).toMatchObject({ total: 1, items: [{ name: '筛选应用 Beta', status: 'disabled' }] });
    expect(future.json()).toMatchObject({ total: 0, items: [] });
  });

  it('returns create application as an application plus one-time secrets envelope', async () => {
    const cookie = await loginAndBindAdmin(app, 'ou_app_admin_envelope_001', '应用密钥管理员');

    const response = await app.inject({
      method: 'POST',
      url: '/api/applications',
      headers: { cookie },
      payload: { name: 'Envelope 应用' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      application: {
        name: 'Envelope 应用',
        status: 'active',
        app_key: expect.stringMatching(/^app_/),
      },
      appSecret: expect.stringMatching(/^sec_/),
      apiSecret: expect.stringMatching(/^api_sec_/),
    });
    expect(response.json().application).not.toHaveProperty('appSecret');
    expect(response.json().application).not.toHaveProperty('apiSecret');
  });

  it('returns runtime application detail without secret plaintext', async () => {
    const cookie = await loginAndBindAdmin(app, 'ou_app_admin_detail_001', '应用详情管理员');
    const created = await app.inject({
      method: 'POST',
      url: '/api/applications',
      headers: { cookie },
      payload: { name: '详情应用' },
    });
    const applicationId = created.json().application.id;

    const response = await app.inject({
      method: 'GET',
      url: `/api/applications/${applicationId}`,
      headers: { cookie },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      id: applicationId,
      name: '详情应用',
      created_by_feishu_user_id: 'ou_app_admin_detail_001',
      created_by_name: '应用详情管理员',
      permission_group_count: 0,
      permission_point_count: 0,
      secret_status: {
        app_secret: 'issued',
        api_secret: 'issued',
      },
    });
    expect(JSON.stringify(response.json())).not.toContain(created.json().appSecret);
    expect(JSON.stringify(response.json())).not.toContain(created.json().apiSecret);
  });

  it('rejects non-admin runtime application detail reads', async () => {
    const adminCookie = await loginAndBindAdmin(app, 'ou_app_admin_detail_002', '详情管理员二');
    const userCookie = await loginCookie(app, 'ou_app_non_admin_detail_002', '普通详情用户');
    const created = await app.inject({
      method: 'POST',
      url: '/api/applications',
      headers: { cookie: adminCookie },
      payload: { name: '禁止详情应用' },
    });

    const response = await app.inject({
      method: 'GET',
      url: `/api/applications/${created.json().application.id}`,
      headers: { cookie: userCookie },
    });

    expect(response.statusCode).toBe(403);
  });

  it('lists permission registrations for an application', async () => {
    const cookie = await loginAndBindAdmin(app, 'ou_app_admin_permission_001', '权限注册管理员');
    const created = await app.inject({
      method: 'POST',
      url: '/api/applications',
      headers: { cookie },
      payload: { name: '权限注册应用' },
    });
    const applicationId = created.json().application.id;
    const groupId = crypto.randomUUID();
    const pointId = crypto.randomUUID();
    await pool.query(
      'insert into permission_groups(id, application_id, code, name) values ($1, $2, $3, $4)',
      [groupId, applicationId, 'crm.customer', '客户管理'],
    );
    await pool.query(
      'insert into permission_points(id, application_id, group_id, code, name) values ($1, $2, $3, $4, $5)',
      [pointId, applicationId, groupId, 'crm.customer:view', '查看客户'],
    );

    const response = await app.inject({
      method: 'GET',
      url: `/api/applications/${applicationId}/permission-registrations`,
      headers: { cookie },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      items: [
        {
          application_id: applicationId,
          group_code: 'crm.customer',
          group_name: '客户管理',
          permission_code: 'crm.customer:view',
          permission_name: '查看客户',
          permission_status: 'active',
        },
      ],
    });
  });

  it('records secret copy audit without accepting secret plaintext', async () => {
    const cookie = await loginAndBindAdmin(app, 'ou_app_admin_secret_copy_001', '密钥复制管理员');
    const created = await app.inject({
      method: 'POST',
      url: '/api/applications',
      headers: { cookie },
      payload: { name: '密钥复制应用' },
    });
    const applicationId = created.json().application.id;

    const response = await app.inject({
      method: 'POST',
      url: `/api/applications/${applicationId}/secret-copy-events`,
      headers: { cookie },
      payload: { kind: 'runtime_env' },
    });

    expect(response.statusCode).toBe(200);
    const audit = await pool.query(
      "select action, target_id, metadata::text as metadata from audit_logs where action = 'secret.copy'",
    );
    expect(audit.rows[0]).toMatchObject({
      action: 'secret.copy',
      target_id: applicationId,
    });
    expect(audit.rows[0].metadata).toContain('runtime_env');
    expect(audit.rows[0].metadata).not.toContain(created.json().appSecret);
    expect(audit.rows[0].metadata).not.toContain(created.json().apiSecret);
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
