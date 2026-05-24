import crypto from 'node:crypto';
import { expect, test, type APIRequestContext, type APIResponse } from '@playwright/test';

test.describe('v0.1.2 access loop API smoke', () => {
  test('registers permissions, grants a role, and queries allow/deny permissions', async ({ request }, testInfo) => {
    const runtimeBaseUrl = process.env.RUNTIME_API_BASE_URL ?? 'http://127.0.0.1:4100';
    const suffix = `${testInfo.project.name}_${Date.now()}`;

    const adminCookie = await login(request, runtimeBaseUrl, 'ou_v012_verify_admin', 'E2E 管理员');
    await expectOk(
      request.post(`${runtimeBaseUrl}/api/initialization/bind-platform-admin`, {
        headers: { cookie: adminCookie },
      }),
    );

    const allowedCookie = await login(request, runtimeBaseUrl, `ou_e2e_allowed_${suffix}`, 'E2E 有权限用户');
    const deniedCookie = await login(request, runtimeBaseUrl, `ou_e2e_denied_${suffix}`, 'E2E 无权限用户');

    const appResponse = await expectOk(
      request.post(`${runtimeBaseUrl}/api/applications`, {
        headers: { cookie: adminCookie },
        data: { name: `v0.1.2 E2E Demo ${suffix}` },
      }),
    );
    const application = await appResponse.json();

    const groupBody = JSON.stringify({ groups: [{ code: 'demo.customer', name: '客户管理' }] });
    await expectOk(
      request.put(`${runtimeBaseUrl}/api/application/permission-groups`, {
        headers: sign({
          method: 'PUT',
          path: '/api/application/permission-groups',
          appKey: application.app_key,
          apiSecret: application.apiSecret,
          body: groupBody,
        }),
        data: groupBody,
      }),
    );

    const pointBody = JSON.stringify({
      points: [{ groupCode: 'demo.customer', code: 'demo.customer:view', name: '查看客户' }],
    });
    await expectOk(
      request.put(`${runtimeBaseUrl}/api/application/permission-points`, {
        headers: sign({
          method: 'PUT',
          path: '/api/application/permission-points',
          appKey: application.app_key,
          apiSecret: application.apiSecret,
          body: pointBody,
        }),
        data: pointBody,
      }),
    );

    const roleResponse = await expectOk(
      request.post(`${runtimeBaseUrl}/api/roles`, {
        headers: { cookie: adminCookie },
        data: { appKey: application.app_key, code: `crm_viewer_${suffix}`, name: '客户查看员' },
      }),
    );
    const role = await roleResponse.json();

    await expectOk(
      request.put(`${runtimeBaseUrl}/api/roles/${role.id}/authorization`, {
        headers: { cookie: adminCookie },
        data: {
          permissionPointCodes: ['demo.customer:view'],
          feishuUserIds: [`ou_e2e_allowed_${suffix}`],
          departmentIds: [],
        },
      }),
    );

    const allowedPermissions = await queryPermissions(request, runtimeBaseUrl, application, allowedCookie);
    const deniedPermissions = await queryPermissions(request, runtimeBaseUrl, application, deniedCookie);

    expect(allowedPermissions.permissionCodes).toEqual(['demo.customer:view']);
    expect(deniedPermissions.permissionCodes).toEqual([]);
  });
});

async function login(request: APIRequestContext, baseUrl: string, feishuUserId: string, name: string) {
  const response = await expectOk(
    request.post(`${baseUrl}/api/dev/feishu/mock-login`, {
      data: { feishuUserId, name, email: `${feishuUserId}@example.com` },
    }),
  );
  const cookie = response.headers()['set-cookie'];
  expect(cookie).toContain('iam_session=');
  return cookie;
}

async function queryPermissions(
  request: APIRequestContext,
  baseUrl: string,
  application: { app_key: string; apiSecret: string },
  cookie: string,
) {
  const path = '/api/application/me/permissions';
  const response = await expectOk(
    request.get(`${baseUrl}${path}`, {
      headers: {
        cookie,
        ...sign({ method: 'GET', path, appKey: application.app_key, apiSecret: application.apiSecret }),
      },
    }),
  );
  return response.json();
}

async function expectOk(responsePromise: Promise<APIResponse>) {
  const response = await responsePromise;
  if (!response.ok()) {
    throw new Error(`request failed: ${response.status()} ${await response.text()}`);
  }
  return response;
}

function sign(input: { method: string; path: string; appKey: string; apiSecret: string; body?: string }) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = crypto.randomUUID();
  const bodyHash = sha256Hex(input.body ?? '');
  const canonical = [input.method.toUpperCase(), input.path, '', timestamp, nonce, bodyHash].join('\n');
  const signingKey = sha256Hex(input.apiSecret);
  return {
    'content-type': 'application/json',
    'x-fiam-app-key': input.appKey,
    'x-fiam-timestamp': timestamp,
    'x-fiam-nonce': nonce,
    'x-fiam-body-sha256': bodyHash,
    'x-fiam-signature': crypto.createHmac('sha256', signingKey).update(canonical).digest('hex'),
  };
}

function sha256Hex(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}
