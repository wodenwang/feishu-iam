import type { FastifyInstance } from 'fastify';
import type { DbPool } from '../../db/pool';
import { writeAudit } from '../audit/auditRepository';
import { forbidden, HttpError, unauthorized } from '../errors/httpError';
import { createApplication } from './applicationRepository';

export async function registerApplicationRoutes(app: FastifyInstance, pool: DbPool): Promise<void> {
  app.post('/api/applications', async (request) => {
    if (!request.actor) {
      throw unauthorized();
    }
    if (!request.actor.isPlatformAdmin) {
      throw forbidden('只有平台管理员可以创建应用');
    }

    const body = request.body as { name?: string };
    if (!body.name || body.name.trim().length < 2) {
      throw new HttpError(400, 'INVALID_APPLICATION_NAME', '应用名称至少需要 2 个字符');
    }
    const normalizedName = body.name.trim();

    const existing = await pool.query('select id from applications where lower(name) = lower($1) limit 1', [
      normalizedName,
    ]);
    if (existing.rowCount && existing.rowCount > 0) {
      throw new HttpError(409, 'APPLICATION_NAME_EXISTS', '应用名称已存在');
    }

    const application = await createApplication(pool, {
      name: normalizedName,
      createdByFeishuUserId: request.actor.feishuUserId,
    });

    await writeAudit(pool, {
      requestId: request.id,
      actorFeishuUserId: request.actor.feishuUserId,
      action: 'application.create',
      targetType: 'application',
      targetId: application.id,
      result: 'success',
      metadata: { appKey: application.app_key },
    });

    return application;
  });

  app.get('/api/applications', async (request) => {
    if (!request.actor) {
      throw unauthorized();
    }
    const result = await pool.query(
      'select id, app_key, name, status, created_at from applications order by created_at desc limit 50',
    );
    return { items: result.rows };
  });
}
