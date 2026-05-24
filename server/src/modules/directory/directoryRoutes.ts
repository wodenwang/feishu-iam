import type { FastifyInstance } from 'fastify';
import type { DbPool } from '../../db/pool';
import { forbidden, unauthorized } from '../errors/httpError';

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

export async function registerDirectoryRoutes(app: FastifyInstance, pool: DbPool): Promise<void> {
  app.get('/api/directory/departments', { schema: listQuerySchema }, async (request) => {
    requirePlatformAdmin(request);

    const { page, pageSize } = normalizePagination(request.query as { page?: number; pageSize?: number });
    const offset = (page - 1) * pageSize;
    const [items, total] = await Promise.all([
      pool.query(
        `
          select id, name, parent_id, status, created_at, updated_at
          from directory_departments
          order by name asc
          limit $1 offset $2
        `,
        [pageSize, offset],
      ),
      pool.query('select count(*)::int as total from directory_departments'),
    ]);

    return { items: items.rows, page, pageSize, total: total.rows[0].total };
  });

  app.get('/api/directory/users', { schema: listQuerySchema }, async (request) => {
    requirePlatformAdmin(request);

    const { page, pageSize } = normalizePagination(request.query as { page?: number; pageSize?: number });
    const offset = (page - 1) * pageSize;
    const [items, total] = await Promise.all([
      pool.query(
        `
          select feishu_user_id, name, email, department_id, status, created_at, updated_at
          from directory_users
          order by created_at desc
          limit $1 offset $2
        `,
        [pageSize, offset],
      ),
      pool.query('select count(*)::int as total from directory_users'),
    ]);

    return { items: items.rows, page, pageSize, total: total.rows[0].total };
  });
}

function normalizePagination(query: { page?: number; pageSize?: number }) {
  return {
    page: query.page ?? 1,
    pageSize: query.pageSize ?? 20,
  };
}

function requirePlatformAdmin(request: { actor?: { isPlatformAdmin: boolean } | null }) {
  if (!request.actor) {
    throw unauthorized();
  }
  if (!request.actor.isPlatformAdmin) {
    throw forbidden('只有平台管理员可以查看组织目录投影');
  }
}
