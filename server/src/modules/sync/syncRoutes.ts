import type { FastifyInstance } from 'fastify';
import type { DbPool } from '../../db/pool';
import type { CurrentActor } from '../../plugins/requestContext';
import { forbidden, unauthorized } from '../errors/httpError';
import type { DirectorySyncAdapter } from './directorySyncAdapter';
import { listSyncRuns, startDirectorySync } from './syncService';

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

export async function registerSyncRoutes(app: FastifyInstance, pool: DbPool, adapter: DirectorySyncAdapter): Promise<void> {
  app.get('/api/sync/runs', { schema: listQuerySchema }, async (request) => {
    requirePlatformAdmin(request);
    const query = request.query as { page?: number; pageSize?: number };
    return listSyncRuns(pool, { page: query.page ?? 1, pageSize: query.pageSize ?? 20 });
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
