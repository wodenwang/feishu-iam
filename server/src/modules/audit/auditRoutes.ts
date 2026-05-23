import type { FastifyInstance } from 'fastify';
import type { DbPool } from '../../db/pool';
import { forbidden, unauthorized } from '../errors/httpError';

export async function registerAuditRoutes(app: FastifyInstance, pool: DbPool): Promise<void> {
  app.get('/api/audit-logs', async (request) => {
    if (!request.actor) {
      throw unauthorized();
    }
    if (!request.actor.isPlatformAdmin) {
      throw forbidden('只有平台管理员可以查看全局审计日志');
    }

    const result = await pool.query(
      `
        select id, request_id, actor_feishu_user_id, action, target_type, target_id, result, metadata, created_at
        from audit_logs
        order by created_at desc
        limit 50
      `,
    );
    return { items: result.rows };
  });
}
