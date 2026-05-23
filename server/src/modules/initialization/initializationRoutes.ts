import type { FastifyInstance } from 'fastify';
import type { DbPool } from '../../db/pool';
import { writeAudit } from '../audit/auditRepository';
import { unauthorized } from '../errors/httpError';

export async function registerInitializationRoutes(app: FastifyInstance, pool: DbPool): Promise<void> {
  app.get('/api/initialization/status', async () => {
    const result = await pool.query('select count(*)::int as count from platform_admins');
    return { initialized: result.rows[0].count > 0 };
  });

  app.post('/api/initialization/bind-platform-admin', async (request) => {
    if (!request.actor) {
      throw unauthorized();
    }

    await pool.query(
      `
        insert into platform_admins(feishu_user_id)
        values ($1)
        on conflict (feishu_user_id) do nothing
      `,
      [request.actor.feishuUserId],
    );
    await writeAudit(pool, {
      requestId: request.id,
      actorFeishuUserId: request.actor.feishuUserId,
      action: 'platform_admin.bind',
      targetType: 'platform_admin',
      targetId: request.actor.feishuUserId,
      result: 'success',
    });

    return { initialized: true, platformAdminFeishuUserId: request.actor.feishuUserId };
  });
}
