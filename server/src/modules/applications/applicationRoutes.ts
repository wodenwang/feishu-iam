import crypto from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { DbClient, DbPool } from '../../db/pool';
import { addApplicationScopeFilter, requireAdminActor, requireApplicationScope } from '../adminScope';
import { writeAudit } from '../audit/auditRepository';
import { forbidden, HttpError, unauthorized } from '../errors/httpError';
import { getApplicationDiagnostics } from './applicationDiagnostics';
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
    const ownerFeishuUserId = typeof body.ownerFeishuUserId === 'string' && body.ownerFeishuUserId.trim()
      ? body.ownerFeishuUserId.trim()
      : undefined;

    const existing = await pool.query('select id from applications where lower(name) = lower($1) limit 1', [
      normalizedName,
    ]);
    if (existing.rowCount && existing.rowCount > 0) {
      throw new HttpError(409, 'APPLICATION_NAME_EXISTS', '应用名称已存在');
    }

    const client = await pool.connect();
    try {
      await client.query('begin');
      if (ownerFeishuUserId) {
        await assertFeishuUserExists(client, ownerFeishuUserId);
      }
      const created = await createApplication(client, {
        name: normalizedName,
        createdByFeishuUserId: request.actor.feishuUserId,
      });
      if (ownerFeishuUserId) {
        await client.query(
          `
            insert into application_admins(application_id, feishu_user_id, created_by_feishu_user_id)
            values ($1, $2, $3)
            on conflict do nothing
          `,
          [created.application.id, ownerFeishuUserId, request.actor.feishuUserId],
        );
        await writeAudit(client, {
          requestId: request.id,
          actorFeishuUserId: request.actor.feishuUserId,
          action: 'application.admin.bind',
          targetType: 'application',
          targetId: created.application.id,
          result: 'success',
          metadata: { appKey: created.application.app_key, ownerFeishuUserId },
        });
      }

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
    const actor = requireAdminActor(request.actor, '只有管理员可以查看应用');
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
    const values: Array<string | number | string[]> = [];

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
    addApplicationScopeFilter(actor, filters, values, 'a.id');

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
                 a.created_by_feishu_user_id,
                 coalesce(created_by.name, a.created_by_feishu_user_id) as created_by_name,
                 owner.feishu_user_id as owner_feishu_user_id,
                 owner.name as owner_name,
                 count(distinct pg.id)::int as permission_group_count,
                 count(distinct pp.id)::int as permission_point_count
          from applications a
          left join feishu_users created_by on created_by.feishu_user_id = a.created_by_feishu_user_id
          left join lateral (
            select aa.feishu_user_id, fu.name
            from application_admins aa
            join feishu_users fu on fu.feishu_user_id = aa.feishu_user_id
            where aa.application_id = a.id
            order by aa.created_at asc
            limit 1
          ) owner on true
          left join permission_groups pg on pg.application_id = a.id
          left join permission_points pp on pp.application_id = a.id
          ${whereClause}
          group by a.id, created_by.name, owner.feishu_user_id, owner.name
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
    requireAdminActor(request.actor, '只有管理员可以查看应用接入配置');
    const { id } = request.params as { id: string };
    requireApplicationScope(request.actor, id, '没有权限查看该应用接入配置');
    const result = await pool.query(
      `
        select a.id,
               a.app_key,
               a.name,
               a.status,
               a.created_by_feishu_user_id,
               coalesce(fu.name, a.created_by_feishu_user_id) as created_by_name,
               owner.feishu_user_id as owner_feishu_user_id,
               owner.name as owner_name,
               a.created_at,
               a.updated_at,
               count(distinct pg.id)::int as permission_group_count,
               count(distinct pp.id)::int as permission_point_count,
               (
                 select count(*)::int
                 from application_oauth_redirect_uris r
                 where r.application_id = a.id
               ) as redirect_uri_count,
               (
                 select count(*)::int
                 from application_oauth_redirect_uris r
                 where r.application_id = a.id and r.status = 'active'
               ) as active_redirect_uri_count,
               (
                 select count(*)::int
                 from application_admins aa
                 where aa.application_id = a.id
               ) as admin_count,
               app_secret.updated_at as app_secret_rotated_at,
               api_credential.updated_at as api_secret_rotated_at,
               max(al.created_at) filter (where al.action like 'application_api.%') as last_api_called_at,
               max(al.created_at) filter (where al.action = 'application_api.permission.query') as last_permission_query_at
        from applications a
        left join feishu_users fu on fu.feishu_user_id = a.created_by_feishu_user_id
        left join application_secrets app_secret on app_secret.application_id = a.id
        left join application_api_credentials api_credential on api_credential.application_id = a.id
        left join lateral (
          select aa.feishu_user_id, owner_user.name
          from application_admins aa
          join feishu_users owner_user on owner_user.feishu_user_id = aa.feishu_user_id
          where aa.application_id = a.id
          order by aa.created_at asc
          limit 1
        ) owner on true
        left join permission_groups pg on pg.application_id = a.id
        left join permission_points pp on pp.application_id = a.id
        left join audit_logs al on al.target_type = 'application' and al.target_id = a.id::text
        where a.id = $1
        group by a.id, fu.name, owner.feishu_user_id, owner.name, app_secret.updated_at, api_credential.updated_at
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
    requireAdminActor(request.actor, '只有管理员可以查看应用接入配置');
    const { id } = request.params as { id: string };
    requireApplicationScope(request.actor, id, '没有权限查看该应用权限注册');
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

  app.get('/api/applications/:id/diagnostics', async (request) => {
    requireAdminActor(request.actor, '只有管理员可以查看应用接入诊断');
    const { id } = request.params as { id: string };
    requireApplicationScope(request.actor, id, '没有权限查看该应用接入诊断');
    await assertApplicationExists(pool, id);

    return getApplicationDiagnostics(pool, id);
  });

  app.get('/api/applications/:id/redirect-uris', async (request) => {
    requireAdminActor(request.actor, '只有管理员可以查看 OAuth redirect URI');
    const { id } = request.params as { id: string };
    requireApplicationScope(request.actor, id, '没有权限查看该应用 OAuth redirect URI');
    await assertApplicationExists(pool, id);

    const result = await pool.query(
      `
        select r.application_id,
               r.redirect_uri,
               r.environment,
               r.status,
               r.note,
               r.created_by_feishu_user_id,
               coalesce(created_by.name, r.created_by_feishu_user_id) as created_by_name,
               r.created_at,
               r.updated_at,
               r.disabled_at
        from application_oauth_redirect_uris r
        left join feishu_users created_by on created_by.feishu_user_id = r.created_by_feishu_user_id
        where r.application_id = $1
        order by r.status asc, r.environment asc, r.updated_at desc, r.redirect_uri asc
      `,
      [id],
    );

    return { items: result.rows };
  });

  app.post('/api/applications/:id/redirect-uris', async (request) => {
    const actor = requirePlatformAdmin(request.actor, '只有平台管理员可以维护 OAuth redirect URI');
    const { id } = request.params as { id: string };
    const body = parseRedirectUriCreateBody(request.body);

    const client = await pool.connect();
    try {
      await client.query('begin');
      const application = await assertApplicationExists(client, id);
      const result = await client.query(
        `
          insert into application_oauth_redirect_uris(
            application_id,
            redirect_uri,
            environment,
            status,
            note,
            created_by_feishu_user_id,
            updated_at
          )
          values ($1, $2, $3, 'active', $4, $5, now())
          returning application_id,
                    redirect_uri,
                    environment,
                    status,
                    note,
                    created_by_feishu_user_id,
                    created_at,
                    updated_at,
                    disabled_at
        `,
        [id, body.redirectUri, body.environment, body.note, actor.feishuUserId],
      );
      await writeAudit(client, {
        requestId: request.id,
        actorFeishuUserId: actor.feishuUserId,
        action: 'oauth.redirect_uri.create',
        targetType: 'application',
        targetId: application.id,
        result: 'success',
        metadata: { appKey: application.app_key, redirectUri: body.redirectUri, environment: body.environment },
      });
      await client.query('commit');
      return result.rows[0];
    } catch (error) {
      await client.query('rollback');
      if (isUniqueViolation(error)) {
        throw new HttpError(409, 'OAUTH_REDIRECT_URI_EXISTS', '该 redirect URI 已存在');
      }
      throw error;
    } finally {
      client.release();
    }
  });

  app.patch('/api/applications/:id/redirect-uris/status', async (request) => {
    const actor = requirePlatformAdmin(request.actor, '只有平台管理员可以维护 OAuth redirect URI');
    const { id } = request.params as { id: string };
    const body = parseRedirectUriStatusBody(request.body);

    const client = await pool.connect();
    try {
      await client.query('begin');
      const application = await assertApplicationExists(client, id);
      const result = await client.query(
        `
          update application_oauth_redirect_uris
          set status = $3,
              updated_at = now(),
              disabled_at = case when $3 = 'disabled' then now() else null end
          where application_id = $1 and redirect_uri = $2
          returning application_id,
                    redirect_uri,
                    environment,
                    status,
                    note,
                    created_by_feishu_user_id,
                    created_at,
                    updated_at,
                    disabled_at
        `,
        [id, body.redirectUri, body.status],
      );
      const redirectUri = result.rows[0];
      if (!redirectUri) {
        throw new HttpError(404, 'OAUTH_REDIRECT_URI_NOT_FOUND', 'redirect URI 不存在');
      }
      await writeAudit(client, {
        requestId: request.id,
        actorFeishuUserId: actor.feishuUserId,
        action: body.status === 'active' ? 'oauth.redirect_uri.enable' : 'oauth.redirect_uri.disable',
        targetType: 'application',
        targetId: application.id,
        result: 'success',
        metadata: { appKey: application.app_key, redirectUri: body.redirectUri },
      });
      await client.query('commit');
      return redirectUri;
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  });

  app.post('/api/applications/:id/secrets/rotate', async (request) => {
    const actor = requirePlatformAdmin(request.actor, '只有平台管理员可以轮换应用密钥');
    const { id } = request.params as { id: string };
    const body = parseSecretRotateBody(request.body);
    const secret = body.kind === 'app_secret' ? createAppSecret() : createApiSecret();
    const secretHash = sha256Hex(secret);

    const client = await pool.connect();
    try {
      await client.query('begin');
      const application = await assertApplicationExists(client, id);
      const tableName = body.kind === 'app_secret' ? 'application_secrets' : 'application_api_credentials';
      const columnName = body.kind === 'app_secret' ? 'secret_hash' : 'api_secret_hash';
      await client.query(
        `
          update ${tableName}
          set ${columnName} = $2,
              updated_at = now()
          where application_id = $1
        `,
        [id, secretHash],
      );
      const rotatedAtResult = await client.query(
        `
          select updated_at
          from ${tableName}
          where application_id = $1
        `,
        [id],
      );
      await writeAudit(client, {
        requestId: request.id,
        actorFeishuUserId: actor.feishuUserId,
        action: 'secret.rotate',
        targetType: 'application',
        targetId: application.id,
        result: 'success',
        metadata: { appKey: application.app_key, kind: body.kind },
      });
      await client.query('commit');
      return { kind: body.kind, secret, rotatedAt: rotatedAtResult.rows[0].updated_at };
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  });

  app.get('/api/applications/:id/admins', async (request) => {
    requireAdminActor(request.actor, '只有管理员可以查看应用管理员');
    const { id } = request.params as { id: string };
    requireApplicationScope(request.actor, id, '没有权限查看该应用管理员');
    await assertApplicationExists(pool, id);

    const result = await pool.query(
      `
        select ranked.application_id,
               ranked.feishu_user_id,
               ranked.name,
               ranked.email,
               ranked.status,
               case when ranked.admin_rank = 1 then 'primary' else 'application_admin' end as role,
               ranked.created_by_feishu_user_id,
               ranked.created_by_name,
               ranked.created_at
        from (
          select aa.application_id,
                 aa.feishu_user_id,
                 fu.name,
                 fu.email,
                 fu.status,
                 aa.created_by_feishu_user_id,
                 coalesce(created_by.name, aa.created_by_feishu_user_id) as created_by_name,
                 aa.created_at,
                 row_number() over (partition by aa.application_id order by aa.created_at asc, aa.feishu_user_id asc) as admin_rank
          from application_admins aa
          join feishu_users fu on fu.feishu_user_id = aa.feishu_user_id
          left join feishu_users created_by on created_by.feishu_user_id = aa.created_by_feishu_user_id
          where aa.application_id = $1
        ) ranked
        order by ranked.admin_rank asc
      `,
      [id],
    );

    return { items: result.rows };
  });

  app.post('/api/applications/:id/admins', async (request) => {
    const actor = requirePlatformAdmin(request.actor, '只有平台管理员可以维护应用管理员');
    const { id } = request.params as { id: string };
    const body = parseApplicationAdminBody(request.body);

    const client = await pool.connect();
    try {
      await client.query('begin');
      const application = await assertApplicationExists(client, id);
      await assertFeishuUserExists(client, body.feishuUserId);
      await client.query(
        `
          insert into application_admins(application_id, feishu_user_id, created_by_feishu_user_id)
          values ($1, $2, $3)
          on conflict do nothing
        `,
        [id, body.feishuUserId, actor.feishuUserId],
      );
      const admin = await selectApplicationAdmin(client, id, body.feishuUserId);
      await writeAudit(client, {
        requestId: request.id,
        actorFeishuUserId: actor.feishuUserId,
        action: 'application.admin.add',
        targetType: 'application',
        targetId: application.id,
        result: 'success',
        metadata: { appKey: application.app_key, feishuUserId: body.feishuUserId },
      });
      await client.query('commit');
      return admin;
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  });

  app.delete('/api/applications/:id/admins/:feishuUserId', async (request) => {
    const actor = requirePlatformAdmin(request.actor, '只有平台管理员可以维护应用管理员');
    const { id, feishuUserId } = request.params as { id: string; feishuUserId: string };

    const client = await pool.connect();
    try {
      await client.query('begin');
      const application = await assertApplicationExists(client, id);
      const existing = await client.query(
        'select feishu_user_id from application_admins where application_id = $1 and feishu_user_id = $2',
        [id, feishuUserId],
      );
      if (!existing.rows[0]) {
        throw new HttpError(404, 'APPLICATION_ADMIN_NOT_FOUND', '应用管理员不存在');
      }
      const count = await client.query('select count(*)::int as count from application_admins where application_id = $1', [id]);
      if (count.rows[0].count <= 1) {
        throw new HttpError(409, 'LAST_APPLICATION_ADMIN', '不能移除最后一个应用管理员');
      }
      await client.query('delete from application_admins where application_id = $1 and feishu_user_id = $2', [id, feishuUserId]);
      await writeAudit(client, {
        requestId: request.id,
        actorFeishuUserId: actor.feishuUserId,
        action: 'application.admin.remove',
        targetType: 'application',
        targetId: application.id,
        result: 'success',
        metadata: { appKey: application.app_key, feishuUserId },
      });
      await client.query('commit');
      return { ok: true };
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  });

  app.post('/api/applications/:id/secret-copy-events', async (request) => {
    requireAdminActor(request.actor, '只有管理员可以复制应用接入配置');
    const { id } = request.params as { id: string };
    requireApplicationScope(request.actor, id, '没有权限复制该应用接入配置');
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

  app.post('/api/applications/:id/diagnostics/copy', async (request) => {
    requireAdminActor(request.actor, '只有管理员可以复制应用诊断包');
    const { id } = request.params as { id: string };
    requireApplicationScope(request.actor, id, '没有权限复制该应用诊断包');
    const application = await assertApplicationExists(pool, id);

    await writeAudit(pool, {
      requestId: request.id,
      actorFeishuUserId: request.actor?.feishuUserId ?? null,
      action: 'application.diagnostics.copy',
      targetType: 'application',
      targetId: application.id,
      result: 'success',
      metadata: { appKey: application.app_key },
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function assertApplicationExists(db: Pick<DbPool, 'query'>, id: string): Promise<{ id: string; app_key: string }> {
  const result = await db.query('select id, app_key from applications where id = $1', [id]);
  const application = result.rows[0] as { id: string; app_key: string } | undefined;
  if (!application) {
    throw new HttpError(404, 'APPLICATION_NOT_FOUND', '应用不存在');
  }
  return application;
}

async function assertFeishuUserExists(client: DbClient, feishuUserId: string): Promise<void> {
  const result = await client.query('select feishu_user_id from feishu_users where feishu_user_id = $1', [feishuUserId]);
  if (!result.rows[0]) {
    throw new HttpError(400, 'APPLICATION_ADMIN_USER_NOT_FOUND', '应用管理员飞书用户不存在');
  }
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

function parseSecretRotateBody(value: unknown): { kind: 'app_secret' | 'api_secret' } {
  if (!isRecord(value) || (value.kind !== 'app_secret' && value.kind !== 'api_secret')) {
    throw new HttpError(400, 'INVALID_SECRET_ROTATE_KIND', '密钥轮换类型不正确');
  }
  return { kind: value.kind };
}

function parseApplicationAdminBody(value: unknown): { feishuUserId: string } {
  if (!isRecord(value) || typeof value.feishuUserId !== 'string' || !value.feishuUserId.trim()) {
    throw new HttpError(400, 'INVALID_APPLICATION_ADMIN_USER', '应用管理员飞书用户不正确');
  }
  return { feishuUserId: value.feishuUserId.trim() };
}

async function selectApplicationAdmin(client: DbClient, applicationId: string, feishuUserId: string) {
  const result = await client.query(
    `
      select ranked.application_id,
             ranked.feishu_user_id,
             ranked.name,
             ranked.email,
             ranked.status,
             case when ranked.admin_rank = 1 then 'primary' else 'application_admin' end as role,
             ranked.created_by_feishu_user_id,
             ranked.created_by_name,
             ranked.created_at
      from (
        select aa.application_id,
               aa.feishu_user_id,
               fu.name,
               fu.email,
               fu.status,
               aa.created_by_feishu_user_id,
               coalesce(created_by.name, aa.created_by_feishu_user_id) as created_by_name,
               aa.created_at,
               row_number() over (partition by aa.application_id order by aa.created_at asc, aa.feishu_user_id asc) as admin_rank
        from application_admins aa
        join feishu_users fu on fu.feishu_user_id = aa.feishu_user_id
        left join feishu_users created_by on created_by.feishu_user_id = aa.created_by_feishu_user_id
        where aa.application_id = $1
      ) ranked
      where ranked.feishu_user_id = $2
    `,
    [applicationId, feishuUserId],
  );
  const admin = result.rows[0];
  if (!admin) {
    throw new HttpError(404, 'APPLICATION_ADMIN_NOT_FOUND', '应用管理员不存在');
  }
  return admin;
}

function createAppSecret(): string {
  return `sec_${crypto.randomUUID().replaceAll('-', '')}`;
}

function createApiSecret(): string {
  return `api_sec_${crypto.randomUUID().replaceAll('-', '')}`;
}

function sha256Hex(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function requirePlatformAdmin(actor: Parameters<typeof requireAdminActor>[0], message: string) {
  const currentActor = requireAdminActor(actor, message);
  if (!currentActor.isPlatformAdmin) {
    throw forbidden(message);
  }
  return currentActor;
}

function parseRedirectUriCreateBody(value: unknown): {
  redirectUri: string;
  environment: 'production' | 'staging' | 'local';
  note: string;
} {
  if (!isRecord(value)) {
    throw new HttpError(400, 'INVALID_REDIRECT_URI_PAYLOAD', 'redirect URI 参数不正确');
  }
  const redirectUri = normalizeRedirectUri(value.redirectUri);
  const environment = parseRedirectUriEnvironment(value.environment);
  const note = typeof value.note === 'string' ? value.note.trim() : '';
  if (note.length > 100) {
    throw new HttpError(400, 'REDIRECT_URI_NOTE_TOO_LONG', '备注最多 100 个字符');
  }
  assertRedirectUriAllowedForEnvironment(redirectUri, environment);
  return { redirectUri, environment, note };
}

function parseRedirectUriStatusBody(value: unknown): { redirectUri: string; status: 'active' | 'disabled' } {
  if (!isRecord(value)) {
    throw new HttpError(400, 'INVALID_REDIRECT_URI_PAYLOAD', 'redirect URI 参数不正确');
  }
  const redirectUri = normalizeRedirectUri(value.redirectUri);
  if (value.status !== 'active' && value.status !== 'disabled') {
    throw new HttpError(400, 'INVALID_REDIRECT_URI_STATUS', 'redirect URI 状态不正确');
  }
  return { redirectUri, status: value.status };
}

function normalizeRedirectUri(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new HttpError(400, 'INVALID_REDIRECT_URI', '请输入合法 URL');
  }
  const redirectUri = value.trim();
  try {
    const parsed = new URL(redirectUri);
    if (!parsed.protocol || !parsed.host) {
      throw new Error('missing host');
    }
  } catch {
    throw new HttpError(400, 'INVALID_REDIRECT_URI', '请输入合法 URL');
  }
  return redirectUri;
}

function parseRedirectUriEnvironment(value: unknown): 'production' | 'staging' | 'local' {
  if (value === 'production' || value === 'staging' || value === 'local') {
    return value;
  }
  throw new HttpError(400, 'INVALID_REDIRECT_URI_ENVIRONMENT', 'redirect URI 环境不正确');
}

function assertRedirectUriAllowedForEnvironment(
  redirectUri: string,
  environment: 'production' | 'staging' | 'local',
): void {
  const parsed = new URL(redirectUri);
  if (environment === 'local') {
    if (parsed.protocol === 'https:' || (parsed.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(parsed.hostname))) {
      return;
    }
    throw new HttpError(400, 'LOCAL_REDIRECT_URI_INVALID', '本地开发只允许 HTTPS 或本机 HTTP 回调地址');
  }
  if (parsed.protocol !== 'https:') {
    throw new HttpError(400, 'REDIRECT_URI_REQUIRES_HTTPS', '生产和测试环境必须使用 HTTPS 回调地址');
  }
}
