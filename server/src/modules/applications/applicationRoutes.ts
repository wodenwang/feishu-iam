import type { FastifyInstance } from 'fastify';
import type { DbPool } from '../../db/pool';
import type { CurrentActor } from '../../plugins/requestContext';
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

  app.get('/api/applications/:id', async (request) => {
    requirePlatformAdmin(request.actor);
    const { id } = request.params as { id: string };
    const result = await pool.query(
      `
        select a.id,
               a.app_key,
               a.name,
               a.status,
               a.created_by_feishu_user_id,
               coalesce(fu.name, a.created_by_feishu_user_id) as created_by_name,
               a.created_at,
               a.updated_at,
               count(distinct pg.id)::int as permission_group_count,
               count(distinct pp.id)::int as permission_point_count,
               max(al.created_at) filter (where al.action like 'application_api.%') as last_api_called_at,
               max(al.created_at) filter (where al.action = 'application_api.permission.query') as last_permission_query_at
        from applications a
        left join feishu_users fu on fu.feishu_user_id = a.created_by_feishu_user_id
        left join permission_groups pg on pg.application_id = a.id
        left join permission_points pp on pp.application_id = a.id
        left join audit_logs al on al.target_type = 'application' and al.target_id = a.id::text
        where a.id = $1
        group by a.id, fu.name
      `,
      [id],
    );
    const application = result.rows[0];
    if (!application) {
      throw new HttpError(404, 'APPLICATION_NOT_FOUND', '应用不存在');
    }

    return {
      ...application,
      secret_status: {
        app_secret: 'issued',
        api_secret: 'issued',
      },
    };
  });

  app.get('/api/applications/:id/permission-registrations', async (request) => {
    requirePlatformAdmin(request.actor);
    const { id } = request.params as { id: string };
    await assertApplicationExists(pool, id);

    const result = await pool.query(
      `
        select concat(pg.id::text, ':', coalesce(pp.id::text, 'group')) as id,
               pg.application_id,
               pg.code as group_code,
               pg.name as group_name,
               pg.status as group_status,
               pp.code as permission_code,
               pp.name as permission_name,
               pp.status as permission_status,
               coalesce(pp.updated_at, pg.updated_at) as updated_at
        from permission_groups pg
        left join permission_points pp on pp.group_id = pg.id
        where pg.application_id = $1
        order by pg.code asc, pp.code asc nulls first
      `,
      [id],
    );

    return { items: result.rows };
  });

  app.post('/api/applications/:id/secret-copy-events', async (request) => {
    requirePlatformAdmin(request.actor);
    const { id } = request.params as { id: string };
    const body = request.body;
    if (!isSecretCopyBody(body)) {
      throw new HttpError(400, 'INVALID_SECRET_COPY_KIND', '复制事件类型不正确');
    }
    const application = await assertApplicationExists(pool, id);

    await writeAudit(pool, {
      requestId: request.id,
      actorFeishuUserId: request.actor?.feishuUserId ?? null,
      action: 'secret.copy',
      targetType: 'application',
      targetId: application.id,
      result: 'success',
      metadata: { appKey: application.app_key, kind: body.kind },
    });

    return { ok: true };
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

function requirePlatformAdmin(actor: CurrentActor | null): void {
  if (!actor) {
    throw unauthorized();
  }
  if (!actor.isPlatformAdmin) {
    throw forbidden('只有平台管理员可以查看应用接入配置');
  }
}

async function assertApplicationExists(pool: DbPool, id: string): Promise<{ id: string; app_key: string }> {
  const result = await pool.query('select id, app_key from applications where id = $1', [id]);
  const application = result.rows[0] as { id: string; app_key: string } | undefined;
  if (!application) {
    throw new HttpError(404, 'APPLICATION_NOT_FOUND', '应用不存在');
  }
  return application;
}

function isSecretCopyBody(value: unknown): value is { kind: 'runtime_env' | 'agent_prompt' } {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    'kind' in value &&
    (value.kind === 'runtime_env' || value.kind === 'agent_prompt')
  );
}
