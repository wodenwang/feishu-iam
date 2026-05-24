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

    const body = request.body;
    if (!isRecord(body) || typeof body.name !== 'string' || body.name.trim().length < 2) {
      throw new HttpError(400, 'INVALID_APPLICATION_NAME', '应用名称至少需要 2 个字符');
    }
    const normalizedName = body.name.trim();

    const existing = await pool.query('select id from applications where lower(name) = lower($1) limit 1', [
      normalizedName,
    ]);
    if (existing.rowCount && existing.rowCount > 0) {
      throw new HttpError(409, 'APPLICATION_NAME_EXISTS', '应用名称已存在');
    }

    const client = await pool.connect();
    try {
      await client.query('begin');
      const created = await createApplication(client, {
        name: normalizedName,
        createdByFeishuUserId: request.actor.feishuUserId,
      });

      await writeAudit(client, {
        requestId: request.id,
        actorFeishuUserId: request.actor.feishuUserId,
        action: 'application.create',
        targetType: 'application',
        targetId: created.application.id,
        result: 'success',
        metadata: { appKey: created.application.app_key },
      });
      await client.query('commit');

      return created;
    } catch (error) {
      await client.query('rollback');
      if (isUniqueViolation(error)) {
        throw new HttpError(409, 'APPLICATION_NAME_EXISTS', '应用名称已存在');
      }
      throw error;
    } finally {
      client.release();
    }
  });

  app.get('/api/applications', async (request) => {
    if (!request.actor) {
      throw unauthorized();
    }
    const query = request.query as {
      page?: string | number;
      pageSize?: string | number;
      keyword?: string;
      status?: string;
      createdAtFrom?: string;
      createdAtTo?: string;
    };
    const page = normalizePositiveInteger(query.page, 1);
    const pageSize = Math.min(normalizePositiveInteger(query.pageSize, 20), 100);
    const offset = (page - 1) * pageSize;
    const filters: string[] = [];
    const values: Array<string | number> = [];

    if (query.keyword) {
      values.push(`%${query.keyword}%`);
      filters.push(`(a.name ilike $${values.length} or a.app_key ilike $${values.length})`);
    }
    if (query.status) {
      values.push(query.status);
      filters.push(`a.status = $${values.length}`);
    }
    if (query.createdAtFrom) {
      values.push(query.createdAtFrom);
      filters.push(`a.created_at >= $${values.length}`);
    }
    if (query.createdAtTo) {
      values.push(query.createdAtTo);
      filters.push(`a.created_at <= $${values.length}`);
    }

    const whereClause = filters.length ? `where ${filters.join(' and ')}` : '';
    const itemValues = [...values, pageSize, offset];
    const limitIndex = values.length + 1;
    const offsetIndex = values.length + 2;

    const [items, total] = await Promise.all([
      pool.query(
        `
          select a.id,
                 a.app_key,
                 a.name,
                 a.status,
                 a.created_at,
                 count(distinct pg.id)::int as permission_group_count,
                 count(distinct pp.id)::int as permission_point_count
          from applications a
          left join permission_groups pg on pg.application_id = a.id
          left join permission_points pp on pp.application_id = a.id
          ${whereClause}
          group by a.id
          order by a.created_at desc
          limit $${limitIndex} offset $${offsetIndex}
        `,
        itemValues,
      ),
      pool.query(
        `
          select count(*)::int as total
          from applications a
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

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
}

function isRecord(value: unknown): value is { name?: unknown } {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
