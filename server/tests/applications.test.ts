import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import crypto from 'node:crypto';
import type { DbPool } from '../src/db/pool';
import { buildTestApp } from './helpers/testApp';
import { createTestPool } from './helpers/testDb';
import { signApplicationApiRequest } from './helpers/accessLoop';

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
      redirect_uri_count: 1,
      active_redirect_uri_count: 1,
      admin_count: 0,
      secret_status: {
        app_secret: 'issued',
        api_secret: 'issued',
      },
    });
    expect(response.json().app_secret_rotated_at).toBeTruthy();
    expect(response.json().api_secret_rotated_at).toBeTruthy();
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
    const promptCopy = await app.inject({
      method: 'POST',
      url: `/api/applications/${applicationId}/secret-copy-events`,
      headers: { cookie },
      payload: { kind: 'agent_prompt_placeholder' },
    });
    const oneTimePromptCopy = await app.inject({
      method: 'POST',
      url: `/api/applications/${applicationId}/secret-copy-events`,
      headers: { cookie },
      payload: { kind: 'agent_prompt_onetime_plaintext' },
    });

    expect(response.statusCode).toBe(200);
    expect(promptCopy.statusCode).toBe(200);
    expect(oneTimePromptCopy.statusCode).toBe(200);
    const audit = await pool.query(
      "select action, target_id, metadata from audit_logs where action = 'secret.copy' order by id",
    );
    expect(audit.rows).toHaveLength(3);
    expect(audit.rows[0]).toMatchObject({
      action: 'secret.copy',
      target_id: applicationId,
    });
    expect(audit.rows[0].metadata).toMatchObject({ kind: 'runtime_env', containsPlaintextSecret: false });
    expect(audit.rows[1].metadata).toMatchObject({ kind: 'agent_prompt_placeholder', containsPlaintextSecret: false });
    expect(audit.rows[2].metadata).toMatchObject({ kind: 'agent_prompt_onetime_plaintext', containsPlaintextSecret: true });
    const serializedAudit = JSON.stringify(audit.rows);
    expect(serializedAudit).not.toContain(created.json().appSecret);
    expect(serializedAudit).not.toContain(created.json().apiSecret);
    expect(serializedAudit).not.toContain('sec_should_not_be_logged_v040');
  });

  it('returns sanitized application diagnostics for a healthy access setup', async () => {
    const cookie = await loginAndBindAdmin(app, 'ou_app_admin_diag_001', '诊断平台管理员');
    await loginCookie(app, 'ou_app_diag_owner_001', '诊断应用管理员');
    await loginCookie(app, 'ou_app_diag_user_001', '诊断授权用户');
    const created = await app.inject({
      method: 'POST',
      url: '/api/applications',
      headers: { cookie },
      payload: { name: '健康诊断应用', ownerFeishuUserId: 'ou_app_diag_owner_001' },
    });
    const applicationId = created.json().application.id;
    const groupId = crypto.randomUUID();
    const pointId = crypto.randomUUID();
    const roleId = crypto.randomUUID();
    await pool.query('insert into permission_groups(id, application_id, code, name) values ($1, $2, $3, $4)', [
      groupId,
      applicationId,
      'diag.customer',
      '诊断客户',
    ]);
    await pool.query('insert into permission_points(id, application_id, group_id, code, name) values ($1, $2, $3, $4, $5)', [
      pointId,
      applicationId,
      groupId,
      'diag.customer:view',
      '查看诊断客户',
    ]);
    await pool.query('insert into roles(id, application_id, code, name) values ($1, $2, $3, $4)', [
      roleId,
      applicationId,
      'diag.viewer',
      '诊断查看员',
    ]);
    await pool.query('insert into role_permission_points(role_id, permission_point_id) values ($1, $2)', [roleId, pointId]);
    await pool.query('insert into role_user_bindings(role_id, feishu_user_id) values ($1, $2)', [roleId, 'ou_app_diag_user_001']);

    const response = await app.inject({
      method: 'GET',
      url: `/api/applications/${applicationId}/diagnostics`,
      headers: { cookie },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      applicationId,
      appKey: created.json().application.app_key,
      status: 'healthy',
      endpoints: {
        oauthAuthorize: '/api/oauth/authorize',
        oauthToken: '/api/oauth/token',
        applicationPermissions: '/api/application/me/permissions',
      },
      counts: {
        applicationAdmins: 1,
        permissionGroups: 1,
        permissionPoints: 1,
        roles: 1,
        roleBindings: 2,
      },
    });
    expect(response.json().redirectUris.active).toContain('http://127.0.0.1:4200/oauth/callback');
    expect(response.json().findings).toEqual([]);
    expect(JSON.stringify(response.json())).not.toContain(created.json().appSecret);
    expect(JSON.stringify(response.json())).not.toContain(created.json().apiSecret);
    expect(JSON.stringify(response.json())).not.toMatch(/authorization_code|bearer|signature|cookie/i);
  });

  it('returns failed diagnostics when no active redirect URI exists', async () => {
    const cookie = await loginAndBindAdmin(app, 'ou_app_admin_diag_002', '诊断平台管理员二');
    const created = await app.inject({
      method: 'POST',
      url: '/api/applications',
      headers: { cookie },
      payload: { name: '无回调诊断应用' },
    });
    const applicationId = created.json().application.id;
    await pool.query("update application_oauth_redirect_uris set status = 'disabled' where application_id = $1", [applicationId]);

    const response = await app.inject({
      method: 'GET',
      url: `/api/applications/${applicationId}/diagnostics`,
      headers: { cookie },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: 'failed' });
    expect(response.json().findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'NO_ACTIVE_REDIRECT_URI',
          severity: 'critical',
        }),
      ]),
    );
  });

  it('returns failed diagnostics for disabled applications', async () => {
    const cookie = await loginAndBindAdmin(app, 'ou_app_admin_diag_003', '诊断平台管理员三');
    const created = await app.inject({
      method: 'POST',
      url: '/api/applications',
      headers: { cookie },
      payload: { name: '停用诊断应用' },
    });
    const applicationId = created.json().application.id;
    await pool.query("update applications set status = 'disabled' where id = $1", [applicationId]);

    const response = await app.inject({
      method: 'GET',
      url: `/api/applications/${applicationId}/diagnostics`,
      headers: { cookie },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: 'failed' });
    expect(response.json().findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'APPLICATION_DISABLED',
          severity: 'critical',
        }),
      ]),
    );
  });

  it('returns warning diagnostics when roles have no authorization bindings', async () => {
    const cookie = await loginAndBindAdmin(app, 'ou_app_admin_diag_004', '诊断平台管理员四');
    await loginCookie(app, 'ou_app_diag_owner_004', '诊断应用管理员四');
    const created = await app.inject({
      method: 'POST',
      url: '/api/applications',
      headers: { cookie },
      payload: { name: '无授权诊断应用', ownerFeishuUserId: 'ou_app_diag_owner_004' },
    });
    const applicationId = created.json().application.id;
    const groupId = crypto.randomUUID();
    const pointId = crypto.randomUUID();
    const roleId = crypto.randomUUID();
    await pool.query('insert into permission_groups(id, application_id, code, name) values ($1, $2, $3, $4)', [
      groupId,
      applicationId,
      'diag.empty',
      '未授权诊断',
    ]);
    await pool.query('insert into permission_points(id, application_id, group_id, code, name) values ($1, $2, $3, $4, $5)', [
      pointId,
      applicationId,
      groupId,
      'diag.empty:view',
      '查看未授权诊断',
    ]);
    await pool.query('insert into roles(id, application_id, code, name) values ($1, $2, $3, $4)', [
      roleId,
      applicationId,
      'diag.empty.viewer',
      '未授权查看员',
    ]);

    const response = await app.inject({
      method: 'GET',
      url: `/api/applications/${applicationId}/diagnostics`,
      headers: { cookie },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: 'warning' });
    expect(response.json().findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'NO_ROLE_BINDINGS',
          severity: 'warning',
        }),
      ]),
    );
  });

  it('records diagnostics copy audit without accepting diagnostic package plaintext', async () => {
    const cookie = await loginAndBindAdmin(app, 'ou_app_admin_diag_copy_001', '诊断复制管理员');
    const created = await app.inject({
      method: 'POST',
      url: '/api/applications',
      headers: { cookie },
      payload: { name: '诊断复制应用' },
    });
    const applicationId = created.json().application.id;

    const response = await app.inject({
      method: 'POST',
      url: `/api/applications/${applicationId}/diagnostics/copy`,
      headers: { cookie },
      payload: { diagnosticMarkdown: `secret ${created.json().appSecret}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ ok: true });
    const audit = await pool.query(
      "select action, target_id, metadata::text as metadata from audit_logs where action = 'application.diagnostics.copy'",
    );
    expect(audit.rows).toHaveLength(1);
    expect(audit.rows[0]).toMatchObject({
      action: 'application.diagnostics.copy',
      target_id: applicationId,
    });
    expect(audit.rows[0].metadata).toContain(created.json().application.app_key);
    expect(audit.rows[0].metadata).not.toContain(created.json().appSecret);
    expect(audit.rows[0].metadata).not.toContain(created.json().apiSecret);
  });

  it('manages OAuth redirect URIs and enforces active redirect status during authorize', async () => {
    const cookie = await loginAndBindAdmin(app, 'ou_app_admin_redirect_001', '回调管理员');
    const created = await app.inject({
      method: 'POST',
      url: '/api/applications',
      headers: { cookie },
      payload: { name: '回调管理应用' },
    });
    const applicationId = created.json().application.id;
    const appKey = created.json().application.app_key;
    const redirectUri = 'https://crm.example.com/oauth/callback';

    const createResponse = await app.inject({
      method: 'POST',
      url: `/api/applications/${applicationId}/redirect-uris`,
      headers: { cookie },
      payload: { redirectUri, environment: 'production', note: 'CRM 生产回调' },
    });
    expect(createResponse.statusCode).toBe(200);
    expect(createResponse.json()).toMatchObject({
      redirect_uri: redirectUri,
      environment: 'production',
      status: 'active',
      created_by_feishu_user_id: 'ou_app_admin_redirect_001',
    });

    const duplicate = await app.inject({
      method: 'POST',
      url: `/api/applications/${applicationId}/redirect-uris`,
      headers: { cookie },
      payload: { redirectUri, environment: 'production' },
    });
    expect(duplicate.statusCode).toBe(409);
    expect(duplicate.json()).toMatchObject({ code: 'OAUTH_REDIRECT_URI_EXISTS' });

    const activeAuthorize = await app.inject({
      method: 'GET',
      url: `/api/oauth/authorize?client_id=${appKey}&redirect_uri=${encodeURIComponent(redirectUri)}&state=state_active`,
      headers: { cookie },
    });
    expect(activeAuthorize.statusCode).toBe(302);
    expect(activeAuthorize.headers.location).toContain(redirectUri);

    const disable = await app.inject({
      method: 'PATCH',
      url: `/api/applications/${applicationId}/redirect-uris/status`,
      headers: { cookie },
      payload: { redirectUri, status: 'disabled' },
    });
    expect(disable.statusCode).toBe(200);
    expect(disable.json()).toMatchObject({ redirect_uri: redirectUri, status: 'disabled' });

    const disabledAuthorize = await app.inject({
      method: 'GET',
      url: `/api/oauth/authorize?client_id=${appKey}&redirect_uri=${encodeURIComponent(redirectUri)}&state=state_disabled`,
      headers: { cookie },
    });
    expect(disabledAuthorize.statusCode).toBe(400);
    expect(disabledAuthorize.json()).toMatchObject({ code: 'OAUTH_CLIENT_OR_REDIRECT_INVALID' });

    const restore = await app.inject({
      method: 'PATCH',
      url: `/api/applications/${applicationId}/redirect-uris/status`,
      headers: { cookie },
      payload: { redirectUri, status: 'active' },
    });
    expect(restore.statusCode).toBe(200);
    expect(restore.json()).toMatchObject({ redirect_uri: redirectUri, status: 'active' });

    const restoredAuthorize = await app.inject({
      method: 'GET',
      url: `/api/oauth/authorize?client_id=${appKey}&redirect_uri=${encodeURIComponent(redirectUri)}&state=state_restored`,
      headers: { cookie },
    });
    expect(restoredAuthorize.statusCode).toBe(302);

    const audit = await pool.query(
      `
        select action, metadata::text as metadata
        from audit_logs
        where target_id = $1 and action like 'oauth.redirect_uri.%'
        order by id asc
      `,
      [applicationId],
    );
    expect(audit.rows.map((row) => row.action)).toEqual([
      'oauth.redirect_uri.create',
      'oauth.redirect_uri.disable',
      'oauth.redirect_uri.enable',
    ]);
    expect(audit.rows[0].metadata).toContain('production');
  });

  it('lets application admins read redirect URIs but not mutate them', async () => {
    const adminCookie = await loginAndBindAdmin(app, 'ou_app_admin_redirect_002', '回调平台管理员');
    const created = await app.inject({
      method: 'POST',
      url: '/api/applications',
      headers: { cookie: adminCookie },
      payload: { name: '应用管理员回调应用' },
    });
    const applicationId = created.json().application.id;
    const applicationAdminCookie = await loginCookie(app, 'ou_app_scoped_redirect_002', '应用回调管理员');
    await pool.query(
      `
        insert into application_admins(application_id, feishu_user_id, created_by_feishu_user_id)
        values ($1, $2, $3)
      `,
      [applicationId, 'ou_app_scoped_redirect_002', 'ou_app_admin_redirect_002'],
    );

    const list = await app.inject({
      method: 'GET',
      url: `/api/applications/${applicationId}/redirect-uris`,
      headers: { cookie: applicationAdminCookie },
    });
    expect(list.statusCode).toBe(200);
    expect(list.json().items).toHaveLength(1);

    const create = await app.inject({
      method: 'POST',
      url: `/api/applications/${applicationId}/redirect-uris`,
      headers: { cookie: applicationAdminCookie },
      payload: { redirectUri: 'https://crm.example.com/scoped/callback', environment: 'production' },
    });
    expect(create.statusCode).toBe(403);
  });

  it('rotates appSecret and apiSecret once without leaking plaintext in audit logs', async () => {
    const cookie = await loginAndBindAdmin(app, 'ou_app_admin_rotate_001', '密钥轮换管理员');
    const created = await app.inject({
      method: 'POST',
      url: '/api/applications',
      headers: { cookie },
      payload: { name: '密钥轮换应用' },
    });
    const application = created.json().application;
    const oldAppSecret = created.json().appSecret;
    const oldApiSecret = created.json().apiSecret;

    const appSecretRotate = await app.inject({
      method: 'POST',
      url: `/api/applications/${application.id}/secrets/rotate`,
      headers: { cookie },
      payload: { kind: 'app_secret' },
    });
    expect(appSecretRotate.statusCode).toBe(200);
    expect(appSecretRotate.json()).toMatchObject({
      kind: 'app_secret',
      secret: expect.stringMatching(/^sec_/),
    });
    const newAppSecret = appSecretRotate.json().secret;
    expect(newAppSecret).not.toBe(oldAppSecret);

    const userCookie = await loginCookie(app, 'ou_app_rotate_oauth_user', '密钥轮换 OAuth 用户');
    const authorize = await app.inject({
      method: 'GET',
      url: `/api/oauth/authorize?client_id=${application.app_key}&redirect_uri=${encodeURIComponent('http://127.0.0.1:4200/oauth/callback')}&state=rotate_secret`,
      headers: { cookie: userCookie },
    });
    expect(authorize.statusCode).toBe(302);
    const codeForOldSecret = new URL(authorize.headers.location as string).searchParams.get('code');
    const oldToken = await app.inject({
      method: 'POST',
      url: '/api/oauth/token',
      payload: {
        grant_type: 'authorization_code',
        code: codeForOldSecret,
        redirect_uri: 'http://127.0.0.1:4200/oauth/callback',
        client_id: application.app_key,
        client_secret: oldAppSecret,
      },
    });
    expect(oldToken.statusCode).toBe(401);
    expect(oldToken.json()).toMatchObject({ code: 'OAUTH_CLIENT_SECRET_INVALID' });

    const authorizeForNewSecret = await app.inject({
      method: 'GET',
      url: `/api/oauth/authorize?client_id=${application.app_key}&redirect_uri=${encodeURIComponent('http://127.0.0.1:4200/oauth/callback')}&state=rotate_secret_new`,
      headers: { cookie: userCookie },
    });
    const codeForNewSecret = new URL(authorizeForNewSecret.headers.location as string).searchParams.get('code');
    const newToken = await app.inject({
      method: 'POST',
      url: '/api/oauth/token',
      payload: {
        grant_type: 'authorization_code',
        code: codeForNewSecret,
        redirect_uri: 'http://127.0.0.1:4200/oauth/callback',
        client_id: application.app_key,
        client_secret: newAppSecret,
      },
    });
    expect(newToken.statusCode).toBe(200);

    const apiSecretRotate = await app.inject({
      method: 'POST',
      url: `/api/applications/${application.id}/secrets/rotate`,
      headers: { cookie },
      payload: { kind: 'api_secret' },
    });
    expect(apiSecretRotate.statusCode).toBe(200);
    expect(apiSecretRotate.json()).toMatchObject({
      kind: 'api_secret',
      secret: expect.stringMatching(/^api_sec_/),
    });
    const newApiSecret = apiSecretRotate.json().secret;
    expect(newApiSecret).not.toBe(oldApiSecret);

    const groupBody = JSON.stringify({ groups: [{ code: 'rotate.customer', name: '轮换客户' }] });
    const oldHmac = await app.inject({
      method: 'PUT',
      url: '/api/application/permission-groups',
      headers: signApplicationApiRequest({
        method: 'PUT',
        path: '/api/application/permission-groups',
        appKey: application.app_key,
        apiSecret: oldApiSecret,
        body: groupBody,
      }),
      payload: groupBody,
    });
    expect(oldHmac.statusCode).toBe(401);

    const newHmac = await app.inject({
      method: 'PUT',
      url: '/api/application/permission-groups',
      headers: signApplicationApiRequest({
        method: 'PUT',
        path: '/api/application/permission-groups',
        appKey: application.app_key,
        apiSecret: newApiSecret,
        body: groupBody,
      }),
      payload: groupBody,
    });
    expect(newHmac.statusCode).toBe(200);

    const audit = await pool.query(
      "select action, metadata::text as metadata from audit_logs where action = 'secret.rotate' order by id",
    );
    expect(audit.rows.map((row) => row.action)).toEqual(['secret.rotate', 'secret.rotate']);
    const auditMetadata = audit.rows.map((row) => row.metadata).join('\n');
    expect(auditMetadata).toContain('app_secret');
    expect(auditMetadata).toContain('api_secret');
    expect(auditMetadata).not.toContain(oldAppSecret);
    expect(auditMetadata).not.toContain(newAppSecret);
    expect(auditMetadata).not.toContain(oldApiSecret);
    expect(auditMetadata).not.toContain(newApiSecret);
  });

  it('rejects application admins from rotating secrets', async () => {
    const adminCookie = await loginAndBindAdmin(app, 'ou_app_admin_rotate_002', '密钥平台管理员');
    const created = await app.inject({
      method: 'POST',
      url: '/api/applications',
      headers: { cookie: adminCookie },
      payload: { name: '应用管理员不可轮换密钥' },
    });
    const applicationId = created.json().application.id;
    const applicationAdminCookie = await loginCookie(app, 'ou_app_scoped_rotate_002', '应用密钥管理员');
    await pool.query(
      `
        insert into application_admins(application_id, feishu_user_id, created_by_feishu_user_id)
        values ($1, $2, $3)
      `,
      [applicationId, 'ou_app_scoped_rotate_002', 'ou_app_admin_rotate_002'],
    );

    const response = await app.inject({
      method: 'POST',
      url: `/api/applications/${applicationId}/secrets/rotate`,
      headers: { cookie: applicationAdminCookie },
      payload: { kind: 'app_secret' },
    });

    expect(response.statusCode).toBe(403);
  });

  it('manages application admins with last-admin protection', async () => {
    const cookie = await loginAndBindAdmin(app, 'ou_app_admin_members_001', '成员平台管理员');
    const created = await app.inject({
      method: 'POST',
      url: '/api/applications',
      headers: { cookie },
      payload: { name: '多管理员应用' },
    });
    const applicationId = created.json().application.id;
    await loginCookie(app, 'ou_app_member_primary_001', '主要应用管理员');
    await loginCookie(app, 'ou_app_member_second_001', '第二应用管理员');

    const addPrimary = await app.inject({
      method: 'POST',
      url: `/api/applications/${applicationId}/admins`,
      headers: { cookie },
      payload: { feishuUserId: 'ou_app_member_primary_001' },
    });
    expect(addPrimary.statusCode).toBe(200);
    expect(addPrimary.json()).toMatchObject({
      application_id: applicationId,
      feishu_user_id: 'ou_app_member_primary_001',
      role: 'primary',
    });

    const duplicate = await app.inject({
      method: 'POST',
      url: `/api/applications/${applicationId}/admins`,
      headers: { cookie },
      payload: { feishuUserId: 'ou_app_member_primary_001' },
    });
    expect(duplicate.statusCode).toBe(200);
    expect(duplicate.json()).toMatchObject({ feishu_user_id: 'ou_app_member_primary_001', role: 'primary' });

    const lastAdminRemoval = await app.inject({
      method: 'DELETE',
      url: `/api/applications/${applicationId}/admins/ou_app_member_primary_001`,
      headers: { cookie },
    });
    expect(lastAdminRemoval.statusCode).toBe(409);
    expect(lastAdminRemoval.json()).toMatchObject({ code: 'LAST_APPLICATION_ADMIN' });

    const addSecond = await app.inject({
      method: 'POST',
      url: `/api/applications/${applicationId}/admins`,
      headers: { cookie },
      payload: { feishuUserId: 'ou_app_member_second_001' },
    });
    expect(addSecond.statusCode).toBe(200);
    expect(addSecond.json()).toMatchObject({
      feishu_user_id: 'ou_app_member_second_001',
      role: 'application_admin',
    });

    const list = await app.inject({
      method: 'GET',
      url: `/api/applications/${applicationId}/admins`,
      headers: { cookie },
    });
    expect(list.statusCode).toBe(200);
    expect(list.json().items).toMatchObject([
      { feishu_user_id: 'ou_app_member_primary_001', role: 'primary', name: '主要应用管理员' },
      { feishu_user_id: 'ou_app_member_second_001', role: 'application_admin', name: '第二应用管理员' },
    ]);

    const removeSecond = await app.inject({
      method: 'DELETE',
      url: `/api/applications/${applicationId}/admins/ou_app_member_second_001`,
      headers: { cookie },
    });
    expect(removeSecond.statusCode).toBe(200);
    expect(removeSecond.json()).toMatchObject({ ok: true });

    const audit = await pool.query(
      `
        select action, metadata::text as metadata
        from audit_logs
        where target_id = $1 and action like 'application.admin.%'
        order by id asc
      `,
      [applicationId],
    );
    expect(audit.rows.map((row) => row.action)).toEqual([
      'application.admin.add',
      'application.admin.add',
      'application.admin.add',
      'application.admin.remove',
    ]);
    expect(audit.rows.map((row) => row.metadata).join('\n')).toContain('ou_app_member_second_001');
  });

  it('lets application admins read own admin list but not mutate it or read other applications', async () => {
    const cookie = await loginAndBindAdmin(app, 'ou_app_admin_members_002', '成员平台管理员二');
    const first = await app.inject({
      method: 'POST',
      url: '/api/applications',
      headers: { cookie },
      payload: { name: '成员边界应用 A' },
    });
    const second = await app.inject({
      method: 'POST',
      url: '/api/applications',
      headers: { cookie },
      payload: { name: '成员边界应用 B' },
    });
    const applicationAdminCookie = await loginCookie(app, 'ou_app_member_scoped_002', '成员边界管理员');
    await pool.query(
      `
        insert into application_admins(application_id, feishu_user_id, created_by_feishu_user_id)
        values ($1, $2, $3)
      `,
      [first.json().application.id, 'ou_app_member_scoped_002', 'ou_app_admin_members_002'],
    );

    const ownList = await app.inject({
      method: 'GET',
      url: `/api/applications/${first.json().application.id}/admins`,
      headers: { cookie: applicationAdminCookie },
    });
    expect(ownList.statusCode).toBe(200);
    expect(ownList.json().items).toHaveLength(1);

    const add = await app.inject({
      method: 'POST',
      url: `/api/applications/${first.json().application.id}/admins`,
      headers: { cookie: applicationAdminCookie },
      payload: { feishuUserId: 'ou_app_admin_members_002' },
    });
    expect(add.statusCode).toBe(403);

    const otherList = await app.inject({
      method: 'GET',
      url: `/api/applications/${second.json().application.id}/admins`,
      headers: { cookie: applicationAdminCookie },
    });
    expect(otherList.statusCode).toBe(403);
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
