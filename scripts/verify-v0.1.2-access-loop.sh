#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${RUNTIME_API_BASE_URL:-http://127.0.0.1:4100}"

node --input-type=module <<'NODE'
import crypto from 'node:crypto';

const baseUrl = process.env.RUNTIME_API_BASE_URL ?? 'http://127.0.0.1:4100';
const suffix = `${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;

function sha256Hex(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
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

function normalizeQuery(searchParams) {
  return [...searchParams.entries()]
    .sort(([leftKey, leftValue], [rightKey, rightValue]) => {
      if (leftKey === rightKey) return leftValue.localeCompare(rightValue);
      return leftKey.localeCompare(rightKey);
    })
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
}

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options);
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

await request('/api/health');

const adminCookie = await login('ou_v012_verify_admin', 'v0.1.2 验收管理员');
await request('/api/initialization/bind-platform-admin', { method: 'POST', headers: { cookie: adminCookie } });

const allowedCookie = await login(`ou_v012_verify_allowed_${suffix}`, '有客户查看权限用户');
const deniedCookie = await login(`ou_v012_verify_denied_${suffix}`, '无客户查看权限用户');

const appCreate = await request('/api/applications', {
  method: 'POST',
  headers: { cookie: adminCookie, 'content-type': 'application/json' },
  body: JSON.stringify({ name: `v0.1.2 Verify Demo ${suffix}` }),
});
const application = { ...appCreate.json.application, apiSecret: appCreate.json.apiSecret };
if (!application.app_key || !application.apiSecret) {
  throw new Error('application response missing app_key or apiSecret');
}

const groupBody = JSON.stringify({ groups: [{ code: 'demo.customer', name: '客户管理' }] });
await request('/api/application/permission-groups', {
  method: 'PUT',
  headers: sign({
    method: 'PUT',
    path: '/api/application/permission-groups',
    appKey: application.app_key,
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
    appKey: application.app_key,
    apiSecret: application.apiSecret,
    body: pointBody,
  }),
  body: pointBody,
});

const role = await request('/api/roles', {
  method: 'POST',
  headers: { cookie: adminCookie, 'content-type': 'application/json' },
  body: JSON.stringify({ appKey: application.app_key, code: `crm_viewer_${suffix}`, name: '客户查看员' }),
});

await request(`/api/roles/${role.json.id}/authorization`, {
  method: 'PUT',
  headers: { cookie: adminCookie, 'content-type': 'application/json' },
  body: JSON.stringify({
    permissionPointCodes: ['demo.customer:view'],
    feishuUserIds: [`ou_v012_verify_allowed_${suffix}`],
    departmentIds: [],
  }),
});

async function queryPermissions(cookie) {
  const path = '/api/application/me/permissions';
  const result = await request(path, {
    method: 'GET',
    headers: {
      cookie,
      ...sign({ method: 'GET', path, appKey: application.app_key, apiSecret: application.apiSecret }),
    },
  });
  return result.json.permissionCodes;
}

const allowedPermissions = await queryPermissions(allowedCookie);
const deniedPermissions = await queryPermissions(deniedCookie);
expectIncludes(allowedPermissions, 'demo.customer:view', 'allowed user permissions');
expectExcludes(allowedPermissions, 'demo.customer:edit', 'allowed user permissions');
expectExcludes(deniedPermissions, 'demo.customer:view', 'denied user permissions');

const audit = await request('/api/audit-logs', { headers: { cookie: adminCookie } });
const actions = audit.json.items.map((item) => item.action);
for (const action of [
  'application_api.permission_group.upsert',
  'application_api.permission_point.upsert',
  'role.create',
  'role.authorization.update',
  'application_api.permission.query',
]) {
  expectIncludes(actions, action, 'audit actions');
}

console.log(`v0.1.2 access loop verified against ${baseUrl}`);
console.log(`appKey=${application.app_key}`);
NODE

echo "OK: v0.1.2 access loop verified at ${BASE_URL}"
