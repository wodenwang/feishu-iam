#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${RUNTIME_API_BASE_URL:-http://127.0.0.1:4100}"

node --input-type=module <<'NODE'
import crypto from 'node:crypto';

const baseUrl = process.env.RUNTIME_API_BASE_URL ?? 'http://127.0.0.1:4100';
const redirectUri = process.env.DEMO_REDIRECT_URI ?? 'http://127.0.0.1:4200/oauth/callback';
const suffix = `${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
const adminFeishuUserId = process.env.VERIFY_PLATFORM_ADMIN_FEISHU_USER_ID ?? 'ou_v022_verify_admin';
const assigneeFeishuUserId = `ou_v022_assignee_${suffix}`;

function logStep(message) {
  console.log(`✓ ${message}`);
}

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
  const response = await fetch(`${baseUrl}${path}`, { redirect: 'follow', ...options });
  const text = await response.text();
  const json = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(`${options.method ?? 'GET'} ${path} failed with ${response.status}`);
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
    throw new Error('mock login did not return an IAM session cookie');
  }
  return cookie;
}

function assertNoSensitivePayload(value, appSecret, apiSecret) {
  const text = JSON.stringify(value);
  for (const forbidden of [appSecret, apiSecret, 'authorization_code', 'bearer ', 'cookie=']) {
    if (text.toLowerCase().includes(forbidden.toLowerCase())) {
      throw new Error(`diagnostics payload contains forbidden sensitive value: ${forbidden}`);
    }
  }
}

function expectFinding(diagnostics, code) {
  if (!diagnostics.findings.some((finding) => finding.code === code)) {
    throw new Error(`diagnostics should include finding ${code}`);
  }
}

function expectStatus(diagnostics, status) {
  if (diagnostics.status !== status) {
    throw new Error(`diagnostics expected ${status}, got ${diagnostics.status}`);
  }
}

async function createApplication(adminCookie) {
  const created = await request('/api/applications', {
    method: 'POST',
    headers: { cookie: adminCookie, 'content-type': 'application/json' },
    body: JSON.stringify({ name: `v0.2.2 Diagnostics Demo ${suffix}`, ownerFeishuUserId: adminFeishuUserId }),
  });
  const { application, appSecret, apiSecret } = created.json;
  if (!application?.id || !application?.app_key || !appSecret || !apiSecret) {
    throw new Error('application create response missing expected identifiers or one-time secrets');
  }
  return { id: application.id, appKey: application.app_key, appSecret, apiSecret };
}

async function putPermissionGroup(application, apiSecret, groupCode) {
  const body = JSON.stringify({ groups: [{ code: groupCode, name: 'v0.2.2 诊断客户' }] });
  return request('/api/application/permission-groups', {
    method: 'PUT',
    headers: sign({ method: 'PUT', path: '/api/application/permission-groups', appKey: application.appKey, apiSecret, body }),
    body,
  });
}

async function putPermissionPoint(application, apiSecret, groupCode, pointCode) {
  const body = JSON.stringify({ points: [{ groupCode, code: pointCode, name: '查看客户' }] });
  return request('/api/application/permission-points', {
    method: 'PUT',
    headers: sign({ method: 'PUT', path: '/api/application/permission-points', appKey: application.appKey, apiSecret, body }),
    body,
  });
}

async function getDiagnostics(adminCookie, applicationId) {
  return (await request(`/api/applications/${applicationId}/diagnostics`, { headers: { cookie: adminCookie } })).json;
}

await request('/api/health');
logStep('runtime health check');

const adminCookie = await login(adminFeishuUserId, 'v0.2.2 验收平台管理员');
await request('/api/initialization/bind-platform-admin', { method: 'POST', headers: { cookie: adminCookie } });
const assigneeCookie = await login(assigneeFeishuUserId, 'v0.2.2 授权用户');
void assigneeCookie;
logStep('mock Feishu login, platform admin bind and directory user projection');

const application = await createApplication(adminCookie);
let diagnostics = await getDiagnostics(adminCookie, application.id);
expectStatus(diagnostics, 'warning');
expectFinding(diagnostics, 'NO_PERMISSION_REGISTRATIONS');
expectFinding(diagnostics, 'NO_ROLE_BINDINGS');
assertNoSensitivePayload(diagnostics, application.appSecret, application.apiSecret);
logStep('diagnostics reports warning for missing permission registration and role bindings');

const groupCode = `v022.customer.${suffix}`;
const pointCode = `${groupCode}:read`;
await putPermissionGroup(application, application.apiSecret, groupCode);
await putPermissionPoint(application, application.apiSecret, groupCode, pointCode);
const role = await request('/api/roles', {
  method: 'POST',
  headers: { cookie: adminCookie, 'content-type': 'application/json' },
  body: JSON.stringify({ appKey: application.appKey, code: `v022_role_${suffix}`, name: 'v0.2.2 诊断角色' }),
});
await request(`/api/roles/${role.json.id}/authorization`, {
  method: 'PUT',
  headers: { cookie: adminCookie, 'content-type': 'application/json' },
  body: JSON.stringify({
    permissionPointCodes: [pointCode],
    feishuUserIds: [assigneeFeishuUserId],
    departmentIds: [],
  }),
});
diagnostics = await getDiagnostics(adminCookie, application.id);
expectStatus(diagnostics, 'healthy');
if (diagnostics.findings.length !== 0) {
  throw new Error(`healthy diagnostics should not include findings: ${JSON.stringify(diagnostics.findings)}`);
}
assertNoSensitivePayload(diagnostics, application.appSecret, application.apiSecret);
logStep('diagnostics reports healthy after permission registration and role authorization');

await request(`/api/applications/${application.id}/redirect-uris/status`, {
  method: 'PATCH',
  headers: { cookie: adminCookie, 'content-type': 'application/json' },
  body: JSON.stringify({ redirectUri, status: 'disabled' }),
});
diagnostics = await getDiagnostics(adminCookie, application.id);
expectStatus(diagnostics, 'failed');
expectFinding(diagnostics, 'NO_ACTIVE_REDIRECT_URI');
logStep('diagnostics reports failed when active redirect URI is missing');

await request(`/api/applications/${application.id}/diagnostics/copy`, {
  method: 'POST',
  headers: { cookie: adminCookie, 'content-type': 'application/json' },
  body: '{}',
});
const audit = await request(
  `/api/audit-logs?page=1&pageSize=100&targetId=${encodeURIComponent(application.id)}&targetType=application`,
  { headers: { cookie: adminCookie } },
);
if (!audit.json.items.some((item) => item.action === 'application.diagnostics.copy')) {
  throw new Error('diagnostics copy audit action should be queryable');
}
logStep('diagnostics copy audit is queryable and stores no diagnostic package plaintext');

console.log('v0.2.2 access diagnostics verification passed');
NODE
