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

    const query = request.query as {
      page?: string | number;
      pageSize?: string | number;
      action?: string;
      result?: string;
      keyword?: string;
      targetId?: string;
      targetType?: string;
    };
    const page = normalizePositiveInteger(query.page, 1);
    const pageSize = Math.min(normalizePositiveInteger(query.pageSize, 20), 100);
    const offset = (page - 1) * pageSize;
    const filters: string[] = [];
    const values: Array<string | number> = [];

    if (query.action) {
      values.push(query.action);
      filters.push(`action = $${values.length}`);
    }
    if (query.result) {
      values.push(query.result === 'failed' ? 'failure' : query.result);
      filters.push(`result = $${values.length}`);
    }
    if (query.keyword) {
      values.push(`%${query.keyword}%`);
      filters.push(
        `(request_id ilike $${values.length} or actor_feishu_user_id ilike $${values.length} or action ilike $${values.length} or metadata::text ilike $${values.length})`,
      );
    }
    if (query.targetId) {
      values.push(query.targetId);
      filters.push(`target_id = $${values.length}`);
    }
    if (query.targetType) {
      values.push(query.targetType);
      filters.push(`target_type = $${values.length}`);
    }

    const whereClause = filters.length ? `where ${filters.join(' and ')}` : '';
    const itemValues = [...values, pageSize, offset];
    const limitIndex = values.length + 1;
    const offsetIndex = values.length + 2;

    const [items, total] = await Promise.all([
      pool.query(
        `
          select id, request_id, actor_feishu_user_id, action, target_type, target_id, result, metadata, created_at
          from audit_logs
          ${whereClause}
          order by created_at desc
          limit $${limitIndex} offset $${offsetIndex}
        `,
        itemValues,
      ),
      pool.query(
        `
          select count(*)::int as total
          from audit_logs
          ${whereClause}
        `,
        values,
      ),
    ]);
    return { items: items.rows, page, pageSize, total: total.rows[0].total };
  });
}

function normalizePositiveInteger(value: string | number | undefined, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
