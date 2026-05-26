import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DbPool } from '../src/db/pool';
import { cleanupExpiredOAuthArtifacts } from '../src/modules/oauth/oauthRoutes';
import { buildTestApp } from './helpers/testApp';
import { createTestPool } from './helpers/testDb';
import { signApplicationApiRequest } from './helpers/accessLoop';

const demoRedirectUri = 'http://127.0.0.1:4200/oauth/callback';

describe('third-party OAuth runtime', () => {
  let pool: DbPool | undefined;
  let app: Awaited<ReturnType<typeof buildTestApp>> | undefined;

  beforeEach(async () => {
    pool = await createTestPool();
    app = await buildTestApp(pool);
  });

  afterEach(async () => {
    await app?.close();
    await pool?.end();
  });

  it('issues one-time OAuth code and exchanges it for an application scoped bearer token', async () => {
    const adminCookie = await loginAndBindAdmin(app!, 'ou_oauth_admin_001', 'OAuth 管理员');
    const application = await createApplication(app, adminCookie, 'OAuth Demo CRM');
    const userCookie = await loginCookie(app!, 'ou_demo_customer_allowed', '有客户权限用户');

    const authorize = await authorizeCode(app!, {
      cookie: userCookie,
      appKey: application.app_key,
      state: 'state-oauth-happy',
    });
    const code = new URL(authorize.headers.location as string).searchParams.get('code');
    expect(code).toMatch(/^code_/);

    const token = await app!.inject({
      method: 'POST',
      url: '/api/oauth/token',
      payload: {
        grant_type: 'authorization_code',
        code,
        redirect_uri: demoRedirectUri,
        client_id: application.app_key,
        client_secret: application.appSecret,
      },
    });

    expect(token.statusCode).toBe(200);
    expect(token.json()).toMatchObject({
      access_token: expect.stringMatching(/^fiams_/),
      token_type: 'Bearer',
      appKey: application.app_key,
      feishuUserId: 'ou_demo_customer_allowed',
    });
    expect(JSON.stringify(token.json())).not.toContain(application.appSecret);

    const replay = await app!.inject({
      method: 'POST',
      url: '/api/oauth/token',
      payload: {
        grant_type: 'authorization_code',
        code,
        redirect_uri: demoRedirectUri,
        client_id: application.app_key,
        client_secret: application.appSecret,
      },
    });
    expect(replay.statusCode).toBe(400);
    expect(replay.json()).toMatchObject({ code: 'OAUTH_CODE_CONSUMED' });
  });

  it('lets the demo query permissions with an OAuth bearer token and Application API signature', async () => {
    const adminCookie = await loginAndBindAdmin(app!, 'ou_oauth_admin_002', 'OAuth 管理员二');
    const application = await createApplication(app!, adminCookie, 'OAuth Demo 权限');
    await registerDemoPermission(app!, application);
    await loginCookie(app!, 'ou_demo_customer_allowed', '有客户权限用户');
    const role = await app!.inject({
      method: 'POST',
      url: '/api/roles',
      headers: { cookie: adminCookie },
      payload: { appKey: application.app_key, code: 'demo_viewer', name: 'Demo 查看员' },
    });
    expect(role.statusCode).toBe(200);
    const authorization = await app!.inject({
      method: 'PUT',
      url: `/api/roles/${role.json().id}/authorization`,
      headers: { cookie: adminCookie },
      payload: {
        permissionPointCodes: ['demo.customer:view'],
        feishuUserIds: ['ou_demo_customer_allowed'],
        departmentIds: [],
      },
    });
    expect(authorization.statusCode).toBe(200);

    const allowedToken = await loginThroughOAuth(app!, application, 'ou_demo_customer_allowed', '有客户权限用户');
    const deniedToken = await loginThroughOAuth(app!, application, 'ou_demo_customer_denied', '无客户权限用户');

    const allowed = await queryPermissions(app!, application, allowedToken);
    const denied = await queryPermissions(app!, application, deniedToken);

    expect(allowed.statusCode).toBe(200);
    expect(allowed.json().permissionCodes).toEqual(['demo.customer:view']);
    expect(denied.statusCode).toBe(200);
    expect(denied.json().permissionCodes).toEqual([]);
  });

  it('rejects invalid redirect URIs, wrong client secrets, and bearer tokens scoped to another app', async () => {
    const adminCookie = await loginAndBindAdmin(app!, 'ou_oauth_admin_003', 'OAuth 管理员三');
    const firstApplication = await createApplication(app!, adminCookie, 'OAuth Demo A');
    const secondApplication = await createApplication(app!, adminCookie, 'OAuth Demo B');
    const userCookie = await loginCookie(app!, 'ou_demo_cross_scope', '跨应用用户');

    const invalidRedirect = await app!.inject({
      method: 'GET',
      url: `/api/oauth/authorize?client_id=${firstApplication.app_key}&redirect_uri=${encodeURIComponent('http://evil.example/callback')}&state=bad`,
      headers: { cookie: userCookie },
    });
    expect(invalidRedirect.statusCode).toBe(400);
    expect(invalidRedirect.json()).toMatchObject({ code: 'OAUTH_CLIENT_OR_REDIRECT_INVALID' });
    const authorizeFailureAudit = await pool!.query(
      "select metadata->>'reason' as reason from audit_logs where action = 'oauth.authorize' and result = 'failure' order by id desc limit 1",
    );
    expect(authorizeFailureAudit.rows[0]).toMatchObject({ reason: 'invalid_client_or_redirect' });

    const authorize = await authorizeCode(app!, {
      cookie: userCookie,
      appKey: firstApplication.app_key,
      state: 'state-oauth-invalid',
    });
    const code = new URL(authorize.headers.location as string).searchParams.get('code');
    const wrongSecret = await app!.inject({
      method: 'POST',
      url: '/api/oauth/token',
      payload: {
        grant_type: 'authorization_code',
        code,
        redirect_uri: demoRedirectUri,
        client_id: firstApplication.app_key,
        client_secret: 'sec_wrong',
      },
    });
    expect(wrongSecret.statusCode).toBe(401);
    expect(wrongSecret.json()).toMatchObject({ code: 'OAUTH_CLIENT_SECRET_INVALID' });

    const accessToken = await loginThroughOAuth(app!, firstApplication, 'ou_demo_cross_scope', '跨应用用户');
    const crossScope = await queryPermissions(app!, secondApplication, accessToken);
    expect(crossScope.statusCode).toBe(403);
  });

  it('stores and resumes a pending OAuth authorize request after local login', async () => {
    const adminCookie = await loginAndBindAdmin(app!, 'ou_oauth_admin_004', 'OAuth 管理员四');
    const application = await createApplication(app!, adminCookie, 'OAuth Pending Demo');

    const pending = await app!.inject({
      method: 'GET',
      url: `/api/oauth/authorize?client_id=${application.app_key}&redirect_uri=${encodeURIComponent(demoRedirectUri)}&state=state-pending`,
    });
    expect(pending.statusCode).toBe(302);
    expect(pending.headers.location).toBe('/login?status=loginRequired');
    expect(pending.headers['set-cookie']).toContain('iam_oauth_pending=');
    const pendingCookie = String(pending.headers['set-cookie']).split(';')[0];

    const login = await app!.inject({
      method: 'POST',
      url: '/api/dev/feishu/mock-login',
      headers: { cookie: pendingCookie },
      payload: { feishuUserId: 'ou_oauth_pending_user', name: 'Pending OAuth 用户' },
    });
    expect(login.statusCode).toBe(200);
    expect(login.headers['set-cookie']).toEqual(expect.arrayContaining([expect.stringContaining('iam_oauth_pending=;')]));
    expect(login.json().redirectTo).toContain(`${demoRedirectUri}?`);
    expect(login.json().redirectTo).toContain('state=state-pending');
    const code = new URL(login.json().redirectTo).searchParams.get('code');

    const token = await app!.inject({
      method: 'POST',
      url: '/api/oauth/token',
      payload: {
        grant_type: 'authorization_code',
        code,
        redirect_uri: demoRedirectUri,
        client_id: application.app_key,
        client_secret: application.appSecret,
      },
    });
    expect(token.statusCode).toBe(200);
    expect(token.json()).toMatchObject({ feishuUserId: 'ou_oauth_pending_user', appKey: application.app_key });

    const audit = await pool!.query(
      "select action, result from audit_logs where action in ('oauth.pending.create', 'oauth.pending.resume') order by id",
    );
    expect(audit.rows).toEqual([
      { action: 'oauth.pending.create', result: 'success' },
      { action: 'oauth.pending.resume', result: 'success' },
    ]);
  });

  it('does not create pending OAuth requests for invalid clients before login', async () => {
    const pending = await app!.inject({
      method: 'GET',
      url: `/api/oauth/authorize?client_id=app_missing&redirect_uri=${encodeURIComponent(demoRedirectUri)}&state=state-invalid-pending`,
    });

    expect(pending.statusCode).toBe(400);
    expect(pending.json()).toMatchObject({ code: 'OAUTH_CLIENT_OR_REDIRECT_INVALID' });
    expect(pending.headers['set-cookie']).toBeUndefined();
    const pendingCount = await pool!.query('select count(*)::int as count from application_oauth_pending_requests');
    expect(pendingCount.rows[0].count).toBe(0);
  });

  it('does not resume pending OAuth before platform initialization', async () => {
    const userCookie = await loginCookie(app!, 'ou_no_init_creator', '未初始化创建用户');
    await app!.inject({ method: 'POST', url: '/api/initialization/bind-platform-admin', headers: { cookie: userCookie } });
    const application = await createApplication(app!, userCookie, 'OAuth Pending Init Guard');
    await pool!.query('delete from platform_admins');

    const pending = await app!.inject({
      method: 'GET',
      url: `/api/oauth/authorize?client_id=${application.app_key}&redirect_uri=${encodeURIComponent(demoRedirectUri)}&state=state-init`,
    });
    const pendingCookie = String(pending.headers['set-cookie']).split(';')[0];
    const login = await app!.inject({
      method: 'POST',
      url: '/api/dev/feishu/mock-login',
      headers: { cookie: pendingCookie },
      payload: { feishuUserId: 'ou_oauth_init_user', name: '初始化前用户' },
    });

    expect(login.statusCode).toBe(200);
    expect(login.json().redirectTo).toBeUndefined();
    const codeCount = await pool!.query('select count(*)::int as count from application_oauth_authorization_codes');
    expect(codeCount.rows[0].count).toBe(0);
  });

  it('rejects expired pending OAuth requests and writes a resume failure audit', async () => {
    const adminCookie = await loginAndBindAdmin(app!, 'ou_oauth_admin_005', 'OAuth 管理员五');
    const application = await createApplication(app!, adminCookie, 'OAuth Pending Expired');
    const pending = await app!.inject({
      method: 'GET',
      url: `/api/oauth/authorize?client_id=${application.app_key}&redirect_uri=${encodeURIComponent(demoRedirectUri)}&state=state-expired`,
    });
    const pendingCookie = String(pending.headers['set-cookie']).split(';')[0];
    await pool!.query("update application_oauth_pending_requests set expires_at = now() - interval '1 minute'");

    const login = await app!.inject({
      method: 'POST',
      url: '/api/dev/feishu/mock-login',
      headers: { cookie: pendingCookie },
      payload: { feishuUserId: 'ou_oauth_expired_user', name: '过期 Pending 用户' },
    });

    expect(login.statusCode).toBe(200);
    expect(login.json().redirectTo).toBeUndefined();
    const audit = await pool!.query(
      "select result, metadata->>'reason' as reason from audit_logs where action = 'oauth.pending.resume' order by id desc limit 1",
    );
    expect(audit.rows[0]).toMatchObject({ result: 'failure', reason: 'pending_expired' });
  });

  it('cleans up expired OAuth artifacts idempotently', async () => {
    const adminCookie = await loginAndBindAdmin(app!, 'ou_oauth_admin_006', 'OAuth 管理员六');
    const application = await createApplication(app!, adminCookie, 'OAuth Cleanup Demo');
    await loginCookie(app!, 'ou_oauth_cleanup_user', 'Cleanup 用户');
    await pool!.query(
      `
        insert into application_oauth_authorization_codes(code_hash, application_id, redirect_uri, feishu_user_id, state, expires_at)
        values ('expired-code', $1, $2, 'ou_oauth_cleanup_user', 'cleanup-state', now() - interval '1 minute')
      `,
      [application.id, demoRedirectUri],
    );
    await pool!.query(
      `
        insert into application_oauth_sessions(token_hash, application_id, feishu_user_id, expires_at)
        values ('expired-session', $1, 'ou_oauth_cleanup_user', now() - interval '1 minute')
      `,
      [application.id],
    );
    await pool!.query(
      `
        insert into application_oauth_pending_requests(pending_token_hash, client_id, redirect_uri, state, expires_at)
        values ('expired-pending', $1, $2, 'cleanup-state', now() - interval '1 minute')
      `,
      [application.app_key, demoRedirectUri],
    );

    const first = await cleanupExpiredOAuthArtifacts(pool!, { requestId: 'cleanup-test', writeAuditLog: true });
    const second = await cleanupExpiredOAuthArtifacts(pool!, { requestId: 'cleanup-test-2', writeAuditLog: true });

    expect(first).toEqual({ authorizationCodes: 1, oauthSessions: 1, pendingRequests: 1 });
    expect(second).toEqual({ authorizationCodes: 0, oauthSessions: 0, pendingRequests: 0 });
    const audit = await pool!.query("select metadata from audit_logs where action = 'oauth.cleanup'");
    expect(audit.rows).toHaveLength(1);
    expect(audit.rows[0].metadata).toMatchObject(first);
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
  const body = response.json() as {
    application: { id: string; app_key: string };
    appSecret: string;
    apiSecret: string;
  };
  return { ...body.application, appSecret: body.appSecret, apiSecret: body.apiSecret };
}

async function registerDemoPermission(
  app: Awaited<ReturnType<typeof buildTestApp>>,
  application: { app_key: string; apiSecret: string },
) {
  const groupBody = JSON.stringify({ groups: [{ code: 'demo.customer', name: '客户管理' }] });
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

  const pointBody = JSON.stringify({
    points: [{ groupCode: 'demo.customer', code: 'demo.customer:view', name: '查看客户' }],
  });
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

async function authorizeCode(
  app: Awaited<ReturnType<typeof buildTestApp>>,
  input: { cookie: string; appKey: string; state: string },
) {
  const response = await app.inject({
    method: 'GET',
    url: `/api/oauth/authorize?client_id=${input.appKey}&redirect_uri=${encodeURIComponent(demoRedirectUri)}&state=${input.state}`,
    headers: { cookie: input.cookie },
  });
  expect(response.statusCode).toBe(302);
  expect(response.headers.location).toContain(`${demoRedirectUri}?`);
  expect(response.headers.location).toContain(`state=${input.state}`);
  return response;
}

async function loginThroughOAuth(
  app: Awaited<ReturnType<typeof buildTestApp>>,
  application: { app_key: string; appSecret: string },
  feishuUserId: string,
  name: string,
) {
  const cookie = await loginCookie(app, feishuUserId, name);
  const authorize = await authorizeCode(app, {
    cookie,
    appKey: application.app_key,
    state: `state-${feishuUserId}`,
  });
  const code = new URL(authorize.headers.location as string).searchParams.get('code');
  const token = await app.inject({
    method: 'POST',
    url: '/api/oauth/token',
    payload: {
      grant_type: 'authorization_code',
      code,
      redirect_uri: demoRedirectUri,
      client_id: application.app_key,
      client_secret: application.appSecret,
    },
  });
  expect(token.statusCode).toBe(200);
  return token.json().access_token as string;
}

async function queryPermissions(
  app: Awaited<ReturnType<typeof buildTestApp>>,
  application: { app_key: string; apiSecret: string },
  accessToken: string,
) {
  return app.inject({
    method: 'GET',
    url: '/api/application/me/permissions',
    headers: {
      authorization: `Bearer ${accessToken}`,
      ...signApplicationApiRequest({
        method: 'GET',
        path: '/api/application/me/permissions',
        appKey: application.app_key,
        apiSecret: application.apiSecret,
      }),
    },
  });
}
