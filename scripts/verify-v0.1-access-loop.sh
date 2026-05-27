#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${RUNTIME_API_BASE_URL:-http://127.0.0.1:4100}"

node --input-type=module <<'NODE'
import crypto from 'node:crypto';

const baseUrl = process.env.RUNTIME_API_BASE_URL ?? 'http://127.0.0.1:4100';
const demoRedirectUri = process.env.DEMO_BASE_URL
  ? `${process.env.DEMO_BASE_URL.replace(/\/$/, '')}/oauth/callback`
  : 'http://127.0.0.1:4200/oauth/callback';
const suffix = `${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
const adminFeishuUserId = 'ou_v017_verify_admin';
const allowedFeishuUserId = `ou_v017_allowed_${suffix}`;
const deniedFeishuUserId = `ou_v017_denied_${suffix}`;

function sha256Hex(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function normalizeQuery(searchParams) {
  return [...searchParams.entries()]
    .sort(([leftKey, leftValue], [rightKey, rightValue]) => {
      if (leftKey === rightKey) return leftValue.localeCompare(rightValue);
      return leftKey.localeCompare(rightKey);
    })
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
}

function sign({ method, path, appKey, apiSecret, body = '' }) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = crypto.randomUUID();
  const bodyHash = sha256Hex(body);
  const url = new URL(path, 'http://feishu-iam.local');
  const canonical = [
    method.toUpperCase(),
    url.pathname,
    normalizeQuery(url.searchParams),
    timestamp,
    nonce,
    bodyHash,
  ].join('\n');
  const signingKey = sha256Hex(apiSecret);
  const signature = crypto.createHmac('sha256', signingKey).update(canonical).digest('hex');
  return {
    'content-type': 'application/json',
    'x-fiam-app-key': appKey,
    'x-fiam-timestamp': timestamp,
    'x-fiam-nonce': nonce,
    'x-fiam-body-sha256': bodyHash,
    'x-fiam-signature': signature,
  };
}

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    redirect: 'follow',
    ...options,
  });
  const text = await response.text();
  const json = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(`${options.method ?? 'GET'} ${path} failed: ${response.status} ${text}`);
  }
  return { response, json };
}

async function login(feishuUserId, name) {
  const { response } = await request('/api/dev/feishu/mock-login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ feishuUserId, name, email: `${feishuUserId}@example.com` }),
  });
  const cookie = response.headers.get('set-cookie');
  if (!cookie?.includes('iam_session=')) {
    throw new Error(`mock login did not return iam_session for ${feishuUserId}`);
  }
  return cookie;
}

function expectIncludes(values, expected, label) {
  if (!values.includes(expected)) {
    throw new Error(`${label} should include ${expected}; got ${JSON.stringify(values)}`);
  }
}

function expectExcludes(values, expected, label) {
  if (values.includes(expected)) {
    throw new Error(`${label} should not include ${expected}; got ${JSON.stringify(values)}`);
  }
}

async function createApplication(adminCookie) {
  const created = await request('/api/applications', {
    method: 'POST',
    headers: { cookie: adminCookie, 'content-type': 'application/json' },
    body: JSON.stringify({ name: `v0.1.17 Verify Demo ${suffix}` }),
  });
  const { application, appSecret, apiSecret } = created.json;
  if (!application?.id || !application?.app_key || !appSecret || !apiSecret) {
    throw new Error('application create response missing expected appKey or one-time secrets');
  }
  return {
    id: application.id,
    appKey: application.app_key,
    appSecret,
    apiSecret,
  };
}

async function registerDemoPermissions(application) {
  const groupBody = JSON.stringify({ groups: [{ code: 'demo.customer', name: '客户管理' }] });
  await request('/api/application/permission-groups', {
    method: 'PUT',
    headers: sign({
      method: 'PUT',
      path: '/api/application/permission-groups',
      appKey: application.appKey,
      apiSecret: application.apiSecret,
      body: groupBody,
    }),
    body: groupBody,
  });

  const pointBody = JSON.stringify({
    points: [
      { groupCode: 'demo.customer', code: 'demo.customer:view', name: '查看客户' },
      { groupCode: 'demo.customer', code: 'demo.customer:edit', name: '编辑客户' },
    ],
  });
  await request('/api/application/permission-points', {
    method: 'PUT',
    headers: sign({
      method: 'PUT',
      path: '/api/application/permission-points',
      appKey: application.appKey,
      apiSecret: application.apiSecret,
      body: pointBody,
    }),
    body: pointBody,
  });
}

async function createViewerRole(adminCookie, application) {
  const role = await request('/api/roles', {
    method: 'POST',
    headers: { cookie: adminCookie, 'content-type': 'application/json' },
    body: JSON.stringify({ appKey: application.appKey, code: `crm_viewer_${suffix}`, name: '客户查看员' }),
  });
  await request(`/api/roles/${role.json.id}/authorization`, {
    method: 'PUT',
    headers: { cookie: adminCookie, 'content-type': 'application/json' },
    body: JSON.stringify({
      permissionPointCodes: ['demo.customer:view'],
      feishuUserIds: [allowedFeishuUserId],
      departmentIds: [],
    }),
  });
}

async function loginThroughOAuth(application, feishuUserId, name) {
  const cookie = await login(feishuUserId, name);
  const state = `state-${feishuUserId}-${suffix}`;
  const authorizePath = `/api/oauth/authorize?client_id=${encodeURIComponent(application.appKey)}&redirect_uri=${encodeURIComponent(demoRedirectUri)}&state=${encodeURIComponent(state)}`;
  const authorize = await fetch(`${baseUrl}${authorizePath}`, {
    headers: { cookie },
    redirect: 'manual',
  });
  if (authorize.status !== 302) {
    throw new Error(`OAuth authorize failed for ${feishuUserId}: ${authorize.status} ${await authorize.text()}`);
  }
  const location = authorize.headers.get('location');
  if (!location?.startsWith(`${demoRedirectUri}?`)) {
    throw new Error(`OAuth authorize returned unexpected redirect: ${location}`);
  }
  const redirectUrl = new URL(location);
  if (redirectUrl.searchParams.get('state') !== state) {
    throw new Error(`OAuth state mismatch for ${feishuUserId}`);
  }
  const code = redirectUrl.searchParams.get('code');
  if (!code?.startsWith('code_')) {
    throw new Error(`OAuth authorize did not return a valid code for ${feishuUserId}`);
  }

  const token = await request('/api/oauth/token', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      code,
      redirect_uri: demoRedirectUri,
      client_id: application.appKey,
      client_secret: application.appSecret,
    }),
  });
  if (!token.json.access_token?.startsWith('fiams_')) {
    throw new Error(`OAuth token response missing access token for ${feishuUserId}`);
  }
  return token.json.access_token;
}

async function queryPermissions(application, bearerToken) {
  const path = '/api/application/me/permissions';
  const result = await request(path, {
    method: 'GET',
    headers: {
      authorization: `Bearer ${bearerToken}`,
      ...sign({ method: 'GET', path, appKey: application.appKey, apiSecret: application.apiSecret }),
    },
  });
  return result.json.permissionCodes ?? [];
}

async function assertAuditActions(adminCookie) {
  const requiredActions = [
    'application.create',
    'application_api.permission_group.upsert',
    'application_api.permission_point.upsert',
    'role.create',
    'role.authorization.update',
    'oauth.authorize',
    'oauth.token.exchange',
    'application_api.permission.query',
    'sync.preflight',
  ];
  const audit = await request('/api/audit-logs?page=1&pageSize=100', { headers: { cookie: adminCookie } });
  const actions = audit.json.items.map((item) => item.action);
  for (const action of requiredActions) {
    expectIncludes(actions, action, 'audit actions');
  }
}

await request('/api/health');

const adminCookie = await login(adminFeishuUserId, 'v0.1.17 验收管理员');
await request('/api/initialization/bind-platform-admin', { method: 'POST', headers: { cookie: adminCookie } });

const syncStatus = await request('/api/sync/status', { headers: { cookie: adminCookie } });
if (!syncStatus.json.healthStatus) {
  throw new Error('sync status response missing healthStatus');
}
const preflight = await request('/api/sync/preflight', { method: 'POST', headers: { cookie: adminCookie } });
const preflightStages = new Set((preflight.json.stages ?? []).map((stage) => stage.name));
for (const stage of ['token', 'departments', 'users']) {
  expectIncludes([...preflightStages], stage, 'sync preflight stages');
}

const application = await createApplication(adminCookie);
await registerDemoPermissions(application);
await login(allowedFeishuUserId, '有客户查看权限用户');
await login(deniedFeishuUserId, '无客户查看权限用户');
await createViewerRole(adminCookie, application);

const allowedBearerToken = await loginThroughOAuth(application, allowedFeishuUserId, '有客户查看权限用户');
const deniedBearerToken = await loginThroughOAuth(application, deniedFeishuUserId, '无客户查看权限用户');

const allowedPermissions = await queryPermissions(application, allowedBearerToken);
const deniedPermissions = await queryPermissions(application, deniedBearerToken);
expectIncludes(allowedPermissions, 'demo.customer:view', 'allowed user permissions');
expectExcludes(allowedPermissions, 'demo.customer:edit', 'allowed user permissions');
expectExcludes(deniedPermissions, 'demo.customer:view', 'denied user permissions');

await assertAuditActions(adminCookie);

console.log(`v0.1 access loop verified against ${baseUrl}`);
console.log(`appKey=${application.appKey}`);
console.log(`allowedPermissions=${JSON.stringify(allowedPermissions)}`);
console.log(`deniedPermissions=${JSON.stringify(deniedPermissions)}`);
console.log(`syncHealth=${syncStatus.json.healthStatus}`);
NODE

echo "OK: v0.1 access loop verified at ${BASE_URL}"
