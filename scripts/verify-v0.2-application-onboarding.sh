#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${RUNTIME_API_BASE_URL:-http://127.0.0.1:4100}"

node --input-type=module <<'NODE'
import crypto from 'node:crypto';

const baseUrl = process.env.RUNTIME_API_BASE_URL ?? 'http://127.0.0.1:4100';
const redirectUri = process.env.DEMO_REDIRECT_URI ?? 'http://127.0.0.1:4200/oauth/callback';
const suffix = `${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
const adminFeishuUserId = process.env.VERIFY_PLATFORM_ADMIN_FEISHU_USER_ID ?? 'ou_v012_verify_admin';
const oauthUserFeishuUserId = `ou_v020_oauth_${suffix}`;
const secondAdminFeishuUserId = `ou_v020_app_admin_${suffix}`;

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

async function requestStatus(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const text = await response.text();
  const json = text ? JSON.parse(text) : {};
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

function expectIncludes(values, expected, label) {
  if (!values.includes(expected)) {
    throw new Error(`${label} should include ${expected}`);
  }
}

function expectStatus(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label} expected HTTP ${expected}, got ${actual}`);
  }
}

async function createApplication(adminCookie) {
  const created = await request('/api/applications', {
    method: 'POST',
    headers: { cookie: adminCookie, 'content-type': 'application/json' },
    body: JSON.stringify({ name: `v0.2 Verify Demo ${suffix}`, ownerFeishuUserId: adminFeishuUserId }),
  });
  const { application, appSecret, apiSecret } = created.json;
  if (!application?.id || !application?.app_key || !appSecret || !apiSecret) {
    throw new Error('application create response missing expected identifiers or one-time secrets');
  }
  return { id: application.id, appKey: application.app_key, appSecret, apiSecret };
}

async function authorize(application, cookie, state) {
  const path = `/api/oauth/authorize?client_id=${encodeURIComponent(application.appKey)}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}`;
  const response = await fetch(`${baseUrl}${path}`, { headers: { cookie }, redirect: 'manual' });
  return response;
}

async function authorizeCode(application, cookie, state) {
  const response = await authorize(application, cookie, state);
  expectStatus(response.status, 302, 'OAuth authorize');
  const location = response.headers.get('location');
  if (!location?.startsWith(`${redirectUri}?`)) {
    throw new Error('OAuth authorize returned unexpected redirect location');
  }
  const code = new URL(location).searchParams.get('code');
  if (!code?.startsWith('code_')) {
    throw new Error('OAuth authorize did not return a valid code');
  }
  return code;
}

async function exchangeToken(application, code, appSecret) {
  return requestStatus('/api/oauth/token', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: application.appKey,
      client_secret: appSecret,
    }),
  });
}

async function putPermissionGroup(application, apiSecret) {
  const body = JSON.stringify({ groups: [{ code: `v020.customer.${suffix}`, name: 'v0.2 验收客户' }] });
  return requestStatus('/api/application/permission-groups', {
    method: 'PUT',
    headers: sign({
      method: 'PUT',
      path: '/api/application/permission-groups',
      appKey: application.appKey,
      apiSecret,
      body,
    }),
    body,
  });
}

async function assertAuditActions(adminCookie, applicationId) {
  const audit = await request(
    `/api/audit-logs?page=1&pageSize=100&targetId=${encodeURIComponent(applicationId)}&targetType=application`,
    { headers: { cookie: adminCookie } },
  );
  const actions = audit.json.items.map((item) => item.action);
  for (const action of [
    'application.create',
    'oauth.redirect_uri.create',
    'oauth.redirect_uri.disable',
    'oauth.redirect_uri.enable',
    'secret.rotate',
    'application.admin.add',
    'application.admin.remove',
  ]) {
    expectIncludes(actions, action, 'audit actions');
  }
}

await request('/api/health');
logStep('runtime health check');

const adminCookie = await login(adminFeishuUserId, 'v0.2 验收平台管理员');
await request('/api/initialization/bind-platform-admin', { method: 'POST', headers: { cookie: adminCookie } });
logStep('mock Feishu login and platform admin bind');

const application = await createApplication(adminCookie);
logStep('application created with one-time secrets hidden from output');

await request(`/api/applications/${application.id}/redirect-uris`, { headers: { cookie: adminCookie } });
await request(`/api/applications/${application.id}/redirect-uris`, {
  method: 'POST',
  headers: { cookie: adminCookie, 'content-type': 'application/json' },
  body: JSON.stringify({
    redirectUri: `https://v020-${suffix}.example.com/oauth/callback`,
    environment: 'production',
    note: 'v0.2 verification URI',
  }),
});
logStep('redirect URI list and create');

const oauthCookie = await login(oauthUserFeishuUserId, 'v0.2 OAuth 验收用户');
const beforeDisable = await authorize(application, oauthCookie, `before_disable_${suffix}`);
expectStatus(beforeDisable.status, 302, 'active redirect authorize');

await request(`/api/applications/${application.id}/redirect-uris/status`, {
  method: 'PATCH',
  headers: { cookie: adminCookie, 'content-type': 'application/json' },
  body: JSON.stringify({ redirectUri, status: 'disabled' }),
});
const disabledAuthorize = await authorize(application, oauthCookie, `disabled_${suffix}`);
expectStatus(disabledAuthorize.status, 400, 'disabled redirect authorize');

await request(`/api/applications/${application.id}/redirect-uris/status`, {
  method: 'PATCH',
  headers: { cookie: adminCookie, 'content-type': 'application/json' },
  body: JSON.stringify({ redirectUri, status: 'active' }),
});
const restoredAuthorize = await authorize(application, oauthCookie, `restored_${suffix}`);
expectStatus(restoredAuthorize.status, 302, 'restored redirect authorize');
logStep('redirect URI disable and restore gate OAuth authorize');

const rotatedAppSecret = await request(`/api/applications/${application.id}/secrets/rotate`, {
  method: 'POST',
  headers: { cookie: adminCookie, 'content-type': 'application/json' },
  body: JSON.stringify({ kind: 'app_secret' }),
});
const newAppSecret = rotatedAppSecret.json.secret;
if (!newAppSecret?.startsWith('sec_')) {
  throw new Error('appSecret rotation did not return a one-time secret');
}
const oldSecretCode = await authorizeCode(application, oauthCookie, `old_secret_${suffix}`);
const oldSecretToken = await exchangeToken(application, oldSecretCode, application.appSecret);
expectStatus(oldSecretToken.response.status, 401, 'old appSecret token exchange');
const newSecretCode = await authorizeCode(application, oauthCookie, `new_secret_${suffix}`);
const newSecretToken = await exchangeToken(application, newSecretCode, newAppSecret);
expectStatus(newSecretToken.response.status, 200, 'new appSecret token exchange');
logStep('appSecret rotation invalidates old secret and accepts new secret');

const rotatedApiSecret = await request(`/api/applications/${application.id}/secrets/rotate`, {
  method: 'POST',
  headers: { cookie: adminCookie, 'content-type': 'application/json' },
  body: JSON.stringify({ kind: 'api_secret' }),
});
const newApiSecret = rotatedApiSecret.json.secret;
if (!newApiSecret?.startsWith('api_sec_')) {
  throw new Error('apiSecret rotation did not return a one-time secret');
}
const oldHmac = await putPermissionGroup(application, application.apiSecret);
expectStatus(oldHmac.response.status, 401, 'old apiSecret HMAC');
const newHmac = await putPermissionGroup(application, newApiSecret);
expectStatus(newHmac.response.status, 200, 'new apiSecret HMAC');
logStep('apiSecret rotation invalidates old HMAC and accepts new HMAC');

await login(secondAdminFeishuUserId, 'v0.2 第二应用管理员');
await request(`/api/applications/${application.id}/admins`, {
  method: 'POST',
  headers: { cookie: adminCookie, 'content-type': 'application/json' },
  body: JSON.stringify({ feishuUserId: secondAdminFeishuUserId }),
});
await request(`/api/applications/${application.id}/admins/${encodeURIComponent(secondAdminFeishuUserId)}`, {
  method: 'DELETE',
  headers: { cookie: adminCookie },
});
const lastAdmin = await requestStatus(`/api/applications/${application.id}/admins/${encodeURIComponent(adminFeishuUserId)}`, {
  method: 'DELETE',
  headers: { cookie: adminCookie },
});
expectStatus(lastAdmin.response.status, 409, 'last application admin protection');
logStep('application admin add/remove and last-admin protection');

await assertAuditActions(adminCookie, application.id);
logStep('configuration audit actions are queryable');

console.log('v0.2 application onboarding verification passed');
NODE
