import type { FastifyInstance } from 'fastify';
import type { DbPool } from '../../db/pool';
import type { CurrentActor } from '../../plugins/requestContext';
import { forbidden, unauthorized } from '../errors/httpError';
import type { DirectorySyncAdapter } from './directorySyncAdapter';
import {
  getSyncEventStatus,
  listSyncEvents,
  receiveFeishuSyncEvent,
  retrySyncEvent,
  type SyncEventConfig,
} from './syncEventService';
import { getSyncStatus, listSyncRuns, runDirectorySyncPreflight, startDirectorySync } from './syncService';

const listQuerySchema = {
  querystring: {
    type: 'object',
    additionalProperties: false,
    properties: {
      page: { type: 'integer', minimum: 1, default: 1 },
      pageSize: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
    },
  },
} as const;

export async function registerSyncRoutes(
  app: FastifyInstance,
  pool: DbPool,
  adapter: DirectorySyncAdapter,
  eventConfig: SyncEventConfig = {},
): Promise<void> {
  app.get('/api/sync/status', async (request) => {
    requirePlatformAdmin(request);
    return getSyncStatus(pool);
  });

  app.get('/api/sync/runs', { schema: listQuerySchema }, async (request) => {
    requirePlatformAdmin(request);
    const query = request.query as { page?: number; pageSize?: number };
    return listSyncRuns(pool, { page: query.page ?? 1, pageSize: query.pageSize ?? 20 });
  });

  app.get('/api/sync/events/status', async (request) => {
    requirePlatformAdmin(request);
    return getSyncEventStatus(pool);
  });

  app.get('/api/sync/events', { schema: listQuerySchema }, async (request) => {
    requirePlatformAdmin(request);
    const query = request.query as { page?: number; pageSize?: number };
    return listSyncEvents(pool, { page: query.page ?? 1, pageSize: query.pageSize ?? 20 });
  });

  app.post('/api/feishu/events', async (request, reply) => {
    const result = await receiveFeishuSyncEvent(pool, {
      requestId: request.id,
      rawBody: request.rawBody,
      body: request.body,
      headers: {
        timestamp: request.headers['x-lark-request-timestamp'] as string | undefined,
        nonce: request.headers['x-lark-request-nonce'] as string | undefined,
        signature: request.headers['x-lark-signature'] as string | undefined,
      },
      config: eventConfig,
    });

    if (result.challenge) {
      return { challenge: result.challenge };
    }
    reply.code(result.duplicate ? 200 : 202);
    return { ok: true, duplicate: Boolean(result.duplicate), event: result.event };
  });

  app.post('/api/sync/preflight', async (request) => {
    const actor = requirePlatformAdmin(request);
    return runDirectorySyncPreflight(pool, adapter, { actor, requestId: request.id });
  });

  app.post('/api/sync/runs', async (request) => {
    const actor = requirePlatformAdmin(request);
    return startDirectorySync(pool, adapter, { actor, requestId: request.id, trigger: 'manual' });
  });

  app.post('/api/sync/runs/:id/retry', async (request) => {
    const actor = requirePlatformAdmin(request);
    const params = request.params as { id: string };
    return startDirectorySync(pool, adapter, { actor, requestId: request.id, trigger: 'retry', retryOf: params.id });
  });

  app.post('/api/sync/events/:id/retry', async (request) => {
    requirePlatformAdmin(request);
    const params = request.params as { id: string };
    return retrySyncEvent(pool, adapter, { eventId: params.id, requestId: request.id });
  });
}

function requirePlatformAdmin(request: { actor?: CurrentActor | null }): CurrentActor {
  if (!request.actor) {
    throw unauthorized();
  }
  if (!request.actor.isPlatformAdmin) {
    throw forbidden('只有平台管理员可以触发和查看飞书同步');
  }
  return request.actor;
}
