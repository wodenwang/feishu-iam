import crypto from 'node:crypto';
import type { DbPool } from '../../db/pool';
import { writeAudit } from '../audit/auditRepository';
import { HttpError } from '../errors/httpError';
import type { DirectorySyncAdapter } from './directorySyncAdapter';
import { startDirectorySync } from './syncService';

export interface SyncEventConfig {
  verificationToken?: string;
  encryptKey?: string;
}

export interface RuntimeSyncEvent {
  id: string;
  event_id: string;
  event_type: string;
  resource_type: string | null;
  resource_id: string | null;
  status: 'pending_sync' | 'processed' | 'failed' | 'ignored';
  request_id: string;
  received_at: string;
  processed_at?: string | null;
  sync_run_id?: string | null;
  error_message?: string | null;
  payload_summary: Record<string, unknown>;
}

export interface RuntimeSyncEventStatus {
  latestEvent: RuntimeSyncEvent | null;
  latestFailedEvent: RuntimeSyncEvent | null;
  pendingCount: number;
  failedCount: number;
  processedCount: number;
  ignoredCount: number;
  healthStatus: 'healthy' | 'warning' | 'failed' | 'unknown';
  healthReasons: string[];
}

interface FeishuEventPayload {
  type?: string;
  challenge?: string;
  token?: string;
  schema?: string;
  header?: {
    event_id?: string;
    event_type?: string;
    token?: string;
  };
  event?: Record<string, unknown>;
}

interface ReceiveEventInput {
  requestId: string;
  rawBody: string;
  body: unknown;
  headers: {
    timestamp?: string;
    nonce?: string;
    signature?: string;
  };
  config: SyncEventConfig;
}

export async function receiveFeishuSyncEvent(pool: DbPool, input: ReceiveEventInput): Promise<{ challenge?: string; event?: RuntimeSyncEvent; duplicate?: boolean }> {
  const payload = decodeAndVerifyPayload(input);
  if (payload.challenge) {
    return { challenge: payload.challenge };
  }

  const eventId = payload.header?.event_id;
  const eventType = payload.header?.event_type ?? readString(payload.event, ['type']) ?? payload.type;
  if (!eventId || !eventType) {
    throw new HttpError(400, 'FEISHU_EVENT_INVALID', '飞书事件缺少 event_id 或 event_type');
  }

  const classification = classifyDirectoryEvent(eventType, payload.event ?? {});
  const inserted = await pool.query(
    `
      insert into sync_events(event_id, event_type, resource_type, resource_id, status, request_id, payload_summary)
      values ($1, $2, $3, $4, $5, $6, $7)
      on conflict (event_id) do nothing
      returning *
    `,
    [
      eventId,
      eventType,
      classification.resourceType,
      classification.resourceId,
      classification.supported ? 'pending_sync' : 'ignored',
      input.requestId,
      JSON.stringify({
        schema: payload.schema,
        eventType,
        resourceType: classification.resourceType,
        resourceId: classification.resourceId,
      }),
    ],
  );

  if ((inserted.rowCount ?? 0) === 0) {
    const existing = await pool.query('select * from sync_events where event_id = $1', [eventId]);
    return { event: mapSyncEventRow(existing.rows[0]), duplicate: true };
  }

  const event = mapSyncEventRow(inserted.rows[0]);
  await writeAudit(pool, {
    requestId: input.requestId,
    actorFeishuUserId: null,
    action: 'sync.event.receive',
    targetType: 'sync_event',
    targetId: event.id,
    result: classification.supported ? 'success' : 'failure',
    metadata: {
      eventId,
      eventType,
      status: event.status,
      resourceType: classification.resourceType,
      resourceId: classification.resourceId,
    },
  });

  return { event };
}

export async function listSyncEvents(pool: DbPool, input: { page: number; pageSize: number }) {
  const offset = (input.page - 1) * input.pageSize;
  const [items, total] = await Promise.all([
    pool.query(
      `
        select *
        from sync_events
        order by received_at desc
        limit $1 offset $2
      `,
      [input.pageSize, offset],
    ),
    pool.query('select count(*)::int as total from sync_events'),
  ]);

  return { items: items.rows.map(mapSyncEventRow), page: input.page, pageSize: input.pageSize, total: total.rows[0].total };
}

export async function getSyncEventStatus(pool: DbPool): Promise<RuntimeSyncEventStatus> {
  const [latestEvent, latestFailedEvent, counts] = await Promise.all([
    pool.query('select * from sync_events order by received_at desc limit 1'),
    pool.query("select * from sync_events where status = 'failed' order by received_at desc limit 1"),
    pool.query(
      `
        select status, count(*)::int as total
        from sync_events
        group by status
      `,
    ),
  ]);
  const countMap = new Map<string, number>(counts.rows.map((row) => [row.status, Number(row.total)]));
  const pendingCount = countMap.get('pending_sync') ?? 0;
  const failedCount = countMap.get('failed') ?? 0;
  const processedCount = countMap.get('processed') ?? 0;
  const ignoredCount = countMap.get('ignored') ?? 0;
  const health = resolveEventHealth({ pendingCount, failedCount, processedCount, ignoredCount, hasEvents: Boolean(latestEvent.rows[0]) });

  return {
    latestEvent: latestEvent.rows[0] ? mapSyncEventRow(latestEvent.rows[0]) : null,
    latestFailedEvent: latestFailedEvent.rows[0] ? mapSyncEventRow(latestFailedEvent.rows[0]) : null,
    pendingCount,
    failedCount,
    processedCount,
    ignoredCount,
    healthStatus: health.status,
    healthReasons: health.reasons,
  };
}

export async function retrySyncEvent(
  pool: DbPool,
  adapter: DirectorySyncAdapter,
  input: { eventId: string; requestId: string },
): Promise<RuntimeSyncEvent> {
  const existing = await pool.query('select * from sync_events where id = $1', [input.eventId]);
  if ((existing.rowCount ?? 0) === 0) {
    throw new HttpError(404, 'SYNC_EVENT_NOT_FOUND', '同步事件不存在');
  }
  const event = mapSyncEventRow(existing.rows[0]);
  if (event.status === 'ignored') {
    throw new HttpError(409, 'SYNC_EVENT_IGNORED', '该事件类型不需要触发通讯录同步');
  }

  const run = await startDirectorySync(pool, adapter, {
    actor: null,
    requestId: input.requestId,
    trigger: 'scheduled',
  });
  const status = run.status === 'succeeded' ? 'processed' : 'failed';
  await pool.query(
    `
      update sync_events
      set status = $2,
          processed_at = now(),
          sync_run_id = $3,
          error_message = $4
      where id = $1
    `,
    [input.eventId, status, run.id, run.error_message ?? null],
  );
  await writeAudit(pool, {
    requestId: input.requestId,
    actorFeishuUserId: null,
    action: 'sync.event.retry',
    targetType: 'sync_event',
    targetId: input.eventId,
    result: status === 'processed' ? 'success' : 'failure',
    metadata: { eventId: event.event_id, eventType: event.event_type, syncRunId: run.id, status },
  });

  const updated = await pool.query('select * from sync_events where id = $1', [input.eventId]);
  return mapSyncEventRow(updated.rows[0]);
}

function decodeAndVerifyPayload(input: ReceiveEventInput): FeishuEventPayload {
  const envelope = input.body as { encrypt?: string; challenge?: string };
  if (input.config.encryptKey && !envelope.encrypt && !envelope.challenge) {
    verifySignature(input);
  }

  if (input.config.encryptKey && envelope.encrypt && input.headers.signature) {
    verifySignature(input);
  }
  const payload = envelope.encrypt ? decryptPayload(envelope.encrypt, input.config.encryptKey) : (input.body as FeishuEventPayload);
  const token = payload.token ?? payload.header?.token;
  if (input.config.verificationToken && token !== input.config.verificationToken) {
    throw new HttpError(401, 'FEISHU_EVENT_TOKEN_INVALID', '飞书事件 Verification Token 校验失败');
  }
  return payload;
}

function verifySignature(input: ReceiveEventInput): void {
  if (!input.config.encryptKey) {
    return;
  }
  if (!input.headers.timestamp || !input.headers.nonce || !input.headers.signature) {
    throw new HttpError(401, 'FEISHU_EVENT_SIGNATURE_MISSING', '飞书事件签名请求头缺失');
  }
  const expected = crypto
    .createHash('sha256')
    .update(input.headers.timestamp + input.headers.nonce + input.config.encryptKey)
    .update(input.rawBody)
    .digest('hex');
  const actual = input.headers.signature;
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(actual);
  if (expectedBuffer.length !== actualBuffer.length || !crypto.timingSafeEqual(expectedBuffer, actualBuffer)) {
    throw new HttpError(401, 'FEISHU_EVENT_SIGNATURE_INVALID', '飞书事件签名校验失败');
  }
}

function decryptPayload(encrypt: string, encryptKey: string | undefined): FeishuEventPayload {
  if (!encryptKey) {
    throw new HttpError(400, 'FEISHU_EVENT_ENCRYPT_KEY_REQUIRED', '缺少飞书事件 Encrypt Key');
  }
  const data = Buffer.from(encrypt, 'base64');
  const iv = data.subarray(0, 16);
  const encrypted = data.subarray(16);
  const key = crypto.createHash('sha256').update(encryptKey).digest();
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
  return JSON.parse(decrypted) as FeishuEventPayload;
}

function classifyDirectoryEvent(eventType: string, event: Record<string, unknown>) {
  const normalized = eventType.toLowerCase();
  const supported = normalized.includes('contact') || normalized.includes('user') || normalized.includes('department');
  const resourceType = normalized.includes('department') ? 'department' : normalized.includes('user') ? 'user' : 'directory';
  return {
    supported,
    resourceType,
    resourceId: findResourceId(event),
  };
}

function findResourceId(event: Record<string, unknown>): string | null {
  const candidates = [
    ['object', 'open_id'],
    ['object', 'user_id'],
    ['object', 'department_id'],
    ['user', 'open_id'],
    ['user', 'user_id'],
    ['department', 'open_department_id'],
    ['department', 'department_id'],
    ['open_id'],
    ['user_id'],
    ['department_id'],
  ];
  for (const path of candidates) {
    const value = readString(event, path);
    if (value) {
      return value;
    }
  }
  return null;
}

function readString(input: unknown, path: string[]): string | undefined {
  let current: unknown = input;
  for (const key of path) {
    if (!current || typeof current !== 'object' || !(key in current)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }
  return typeof current === 'string' ? current : undefined;
}

function resolveEventHealth(input: {
  pendingCount: number;
  failedCount: number;
  processedCount: number;
  ignoredCount: number;
  hasEvents: boolean;
}): { status: RuntimeSyncEventStatus['healthStatus']; reasons: string[] } {
  if (!input.hasEvents) {
    return { status: 'unknown', reasons: ['尚未收到飞书事件'] };
  }
  if (input.failedCount > 0) {
    return { status: 'failed', reasons: [`存在 ${input.failedCount} 个失败事件需要处理`] };
  }
  if (input.pendingCount > 0) {
    return { status: 'warning', reasons: [`存在 ${input.pendingCount} 个待同步事件`] };
  }
  if (input.ignoredCount > 0 && input.processedCount === 0) {
    return { status: 'warning', reasons: ['最近事件均为非通讯录事件，已忽略'] };
  }
  return { status: 'healthy', reasons: ['飞书事件已接收并处理'] };
}

function mapSyncEventRow(row: Record<string, unknown>): RuntimeSyncEvent {
  return {
    id: String(row.id),
    event_id: String(row.event_id),
    event_type: String(row.event_type),
    resource_type: (row.resource_type as string | null) ?? null,
    resource_id: (row.resource_id as string | null) ?? null,
    status: row.status as RuntimeSyncEvent['status'],
    request_id: String(row.request_id),
    received_at: new Date(row.received_at as string).toISOString(),
    processed_at: row.processed_at ? new Date(row.processed_at as string).toISOString() : null,
    sync_run_id: (row.sync_run_id as string | null) ?? null,
    error_message: (row.error_message as string | null) ?? null,
    payload_summary: (row.payload_summary as Record<string, unknown>) ?? {},
  };
}
