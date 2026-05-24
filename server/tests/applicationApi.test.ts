import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DbPool } from '../src/db/pool';
import { buildTestApp } from './helpers/testApp';
import { createTestPool } from './helpers/testDb';
import { sha256Hex, signApplicationApiRequest } from './helpers/accessLoop';

describe('Application API', () => {
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

  it('registers permission groups and points with appKey HMAC and audit logs without leaking secrets', async () => {
    const adminCookie = await loginAndBindAdmin(app, 'ou_app_api_admin_001', '应用 API 管理员');
    const application = await createApplication(app, adminCookie, 'Demo CRM');

    const groupBody = JSON.stringify({
      groups: [{ code: 'demo.customer', name: '客户管理', description: 'Demo CRM 客户权限' }],
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
    expect(group.json()).toMatchObject({
      items: [{ code: 'demo.customer', name: '客户管理', status: 'active' }],
    });

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
    expect(point.json()).toMatchObject({
      items: [{ groupCode: 'demo.customer', code: 'demo.customer:view', name: '查看客户', status: 'active' }],
    });

    const storedCredential = await pool.query('select api_secret_hash from application_api_credentials where application_id = $1', [
      application.id,
    ]);
    expect(storedCredential.rows[0].api_secret_hash).toBe(sha256Hex(application.apiSecret));
    expect(storedCredential.rows[0].api_secret_hash).not.toBe(application.apiSecret);

    const audit = await pool.query(
      `
        select action, metadata::text as metadata
        from audit_logs
        where action in ('application_api.permission_group.upsert', 'application_api.permission_point.upsert')
        order by id
      `,
    );
    expect(audit.rows.map((row) => row.action)).toEqual([
      'application_api.permission_group.upsert',
      'application_api.permission_point.upsert',
    ]);
    expect(audit.rows.map((row) => row.metadata).join('\n')).not.toContain(application.apiSecret);
    expect(audit.rows.map((row) => row.metadata).join('\n')).not.toContain('x-fiam-signature');
  });

  it('rejects stale timestamps, replayed nonces, mismatched body hashes, and invalid signatures', async () => {
    const adminCookie = await loginAndBindAdmin(app, 'ou_app_api_admin_002', '应用 API 管理员二');
    const application = await createApplication(app, adminCookie, 'Demo CRM 安全校验');
    const body = JSON.stringify({ groups: [{ code: 'demo.secure', name: '安全校验' }] });

    const stale = await app.inject({
      method: 'PUT',
      url: '/api/application/permission-groups',
      headers: signApplicationApiRequest({
        method: 'PUT',
        path: '/api/application/permission-groups',
        appKey: application.app_key,
        apiSecret: application.apiSecret,
        body,
        timestamp: (Math.floor(Date.now() / 1000) - 600).toString(),
      }),
      payload: body,
    });
    expect(stale.statusCode).toBe(401);
    expect(stale.json()).toMatchObject({ code: 'APPLICATION_API_TIMESTAMP_EXPIRED' });

    const nonce = 'nonce-replay-test';
    const headers = signApplicationApiRequest({
      method: 'PUT',
      path: '/api/application/permission-groups',
      appKey: application.app_key,
      apiSecret: application.apiSecret,
      body,
      nonce,
    });
    const first = await app.inject({ method: 'PUT', url: '/api/application/permission-groups', headers, payload: body });
    const replay = await app.inject({ method: 'PUT', url: '/api/application/permission-groups', headers, payload: body });
    expect(first.statusCode).toBe(200);
    expect(replay.statusCode).toBe(401);
    expect(replay.json()).toMatchObject({ code: 'APPLICATION_API_NONCE_REPLAYED' });

    const wrongHashHeaders = {
      ...signApplicationApiRequest({
        method: 'PUT',
        path: '/api/application/permission-groups',
        appKey: application.app_key,
        apiSecret: application.apiSecret,
        body,
      }),
      'x-fiam-body-sha256': sha256Hex('different body'),
    };
    const wrongHash = await app.inject({
      method: 'PUT',
      url: '/api/application/permission-groups',
      headers: wrongHashHeaders,
      payload: body,
    });
    expect(wrongHash.statusCode).toBe(401);
    expect(wrongHash.json()).toMatchObject({ code: 'APPLICATION_API_BODY_HASH_MISMATCH' });

    const wrongSignature = await app.inject({
      method: 'PUT',
      url: '/api/application/permission-groups',
      headers: signApplicationApiRequest({
        method: 'PUT',
        path: '/api/application/permission-groups',
        appKey: application.app_key,
        apiSecret: 'api_sec_wrong',
        body,
      }),
      payload: body,
    });
    expect(wrongSignature.statusCode).toBe(401);
    expect(wrongSignature.json()).toMatchObject({ code: 'APPLICATION_API_SIGNATURE_INVALID' });
  });

  it('rejects duplicate permission codes inside an application', async () => {
    const adminCookie = await loginAndBindAdmin(app, 'ou_app_api_admin_003', '应用 API 管理员三');
    const application = await createApplication(app, adminCookie, 'Demo CRM 重复校验');
    const body = JSON.stringify({
      groups: [
        { code: 'demo.duplicate', name: '重复权限 A' },
        { code: 'demo.duplicate', name: '重复权限 B' },
      ],
    });

    const response = await app.inject({
      method: 'PUT',
      url: '/api/application/permission-groups',
      headers: signApplicationApiRequest({
        method: 'PUT',
        path: '/api/application/permission-groups',
        appKey: application.app_key,
        apiSecret: application.apiSecret,
        body,
      }),
      payload: body,
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ code: 'DUPLICATE_PERMISSION_GROUP_CODE' });
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
