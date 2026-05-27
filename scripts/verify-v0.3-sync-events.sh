#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${RUNTIME_API_BASE_URL:-http://127.0.0.1:4100}"

node --input-type=module <<'NODE'
import crypto from 'node:crypto';

const baseUrl = process.env.RUNTIME_API_BASE_URL ?? 'http://127.0.0.1:4100';
const suffix = `${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
const adminFeishuUserId = process.env.VERIFY_PLATFORM_ADMIN_FEISHU_USER_ID ?? 'ou_v030_verify_admin';
const eventId = `evt_v030_contact_user_updated_${suffix}`;

function logStep(message) {
  console.log(`✓ ${message}`);
}

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, { redirect: 'follow', ...options });
  const text = await response.text();
  const json = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(`${options.method ?? 'GET'} ${path} failed with ${response.status}: ${text}`);
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

function assertNoSensitivePayload(value) {
  const text = JSON.stringify(value).toLowerCase();
  for (const forbidden of ['app_secret', 'tenant_access_token', 'authorization_code', 'bearer ', 'cookie=', 'x-lark-signature']) {
    if (text.includes(forbidden)) {
      throw new Error(`sync event payload contains forbidden sensitive value: ${forbidden}`);
    }
  }
}

await request('/api/health');
logStep('runtime health check');

const challenge = await request('/api/feishu/events', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ type: 'url_verification', challenge: `challenge_${suffix}`, token: 'local-token' }),
});
if (challenge.json.challenge !== `challenge_${suffix}`) {
  throw new Error('Feishu URL verification challenge was not echoed');
}
logStep('Feishu URL verification challenge');

const adminCookie = await login(adminFeishuUserId, 'v0.3.0 事件同步管理员');
await request('/api/initialization/bind-platform-admin', { method: 'POST', headers: { cookie: adminCookie } });
logStep('mock Feishu login and platform admin bind');

const payload = {
  schema: '2.0',
  header: {
    event_id: eventId,
    event_type: 'contact.user.updated_v3',
  },
  event: {
    user: { user_id: `ou_v030_event_user_${suffix}` },
  },
};

const received = await request('/api/feishu/events', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(payload),
});
if (received.json.duplicate || received.json.event.status !== 'pending_sync') {
  throw new Error('Feishu directory event should be recorded as pending_sync');
}
assertNoSensitivePayload(received.json);
logStep('directory event recorded as pending_sync');

const duplicate = await request('/api/feishu/events', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(payload),
});
if (!duplicate.json.duplicate) {
  throw new Error('duplicate Feishu event should be reported as duplicate');
}
logStep('event idempotency check');

const statusBefore = await request('/api/sync/events/status', { headers: { cookie: adminCookie } });
if (statusBefore.json.pendingCount < 1 || statusBefore.json.healthStatus !== 'warning') {
  throw new Error(`expected pending event warning, got ${JSON.stringify(statusBefore.json)}`);
}
const list = await request('/api/sync/events?page=1&pageSize=20', { headers: { cookie: adminCookie } });
const event = list.json.items.find((item) => item.event_id === eventId);
if (!event) {
  throw new Error('received event should be listed for platform admin');
}
logStep('event status and list are visible to platform admin');

const retry = await request(`/api/sync/events/${event.id}/retry`, { method: 'POST', headers: { cookie: adminCookie } });
if (retry.json.status !== 'processed' || !retry.json.sync_run_id) {
  throw new Error(`expected processed event with sync_run_id, got ${JSON.stringify(retry.json)}`);
}
assertNoSensitivePayload(retry.json);
logStep('event retry triggers system sync and marks event processed');

const statusAfter = await request('/api/sync/events/status', { headers: { cookie: adminCookie } });
if (statusAfter.json.processedCount < 1 || statusAfter.json.failedCount !== 0) {
  throw new Error(`expected processed event status, got ${JSON.stringify(statusAfter.json)}`);
}
logStep('event status is healthy after processing');

console.log('v0.3.0 sync events verification passed');
NODE
