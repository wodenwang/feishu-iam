import type { FastifyInstance } from 'fastify';
import type { DbPool } from '../../db/pool';
import { writeAudit } from '../audit/auditRepository';
import { forbidden, unauthorized } from '../errors/httpError';

export async function registerInitializationRoutes(app: FastifyInstance, pool: DbPool): Promise<void> {
  app.get('/api/initialization/status', async () => {
    const result = await pool.query('select count(*)::int as count from platform_admins');
    return { initialized: result.rows[0].count > 0 };
  });

  app.post('/api/initialization/bind-platform-admin', async (request) => {
    if (!request.actor) {
      throw unauthorized();
    }

    const client = await pool.connect();
    try {
      await client.query('begin');
      await client.query('lock table platform_admins in exclusive mode');

      const existing = await client.query('select feishu_user_id from platform_admins limit 1');
      const existingAdmin = existing.rows[0]?.feishu_user_id as string | undefined;
      if (existingAdmin && existingAdmin !== request.actor.feishuUserId) {
        throw forbidden('平台管理员已完成初始化');
      }

      await client.query(
        `
          insert into platform_admins(feishu_user_id)
          values ($1)
          on conflict (feishu_user_id) do nothing
        `,
        [request.actor.feishuUserId],
      );
      await writeAudit(client, {
        requestId: request.id,
        actorFeishuUserId: request.actor.feishuUserId,
        action: 'platform_admin.bind',
        targetType: 'platform_admin',
        targetId: request.actor.feishuUserId,
        result: 'success',
      });
      await client.query('commit');
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }

    return { initialized: true, platformAdminFeishuUserId: request.actor.feishuUserId };
  });
}
