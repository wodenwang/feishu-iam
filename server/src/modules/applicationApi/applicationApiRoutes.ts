import crypto from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { DbPool } from '../../db/pool';
import { writeAudit } from '../audit/auditRepository';
import { forbidden, HttpError, unauthorized } from '../errors/httpError';
import { applicationApiAuth } from './applicationApiAuth';

const permissionGroupSchema = {
  body: {
    type: 'object',
    required: ['groups'],
    additionalProperties: false,
    properties: {
      groups: {
        type: 'array',
        minItems: 1,
        maxItems: 100,
        items: {
          type: 'object',
          required: ['code', 'name'],
          additionalProperties: false,
          properties: {
            code: { type: 'string', minLength: 2, maxLength: 100 },
            name: { type: 'string', minLength: 1, maxLength: 100 },
            description: { type: 'string', maxLength: 500 },
            status: { type: 'string', enum: ['active', 'disabled'] },
          },
        },
      },
    },
  },
} as const;

const permissionPointSchema = {
  body: {
    type: 'object',
    required: ['points'],
    additionalProperties: false,
    properties: {
      points: {
        type: 'array',
        minItems: 1,
        maxItems: 500,
        items: {
          type: 'object',
          required: ['groupCode', 'code', 'name'],
          additionalProperties: false,
          properties: {
            groupCode: { type: 'string', minLength: 2, maxLength: 100 },
            code: { type: 'string', minLength: 2, maxLength: 120 },
            name: { type: 'string', minLength: 1, maxLength: 100 },
            description: { type: 'string', maxLength: 500 },
            status: { type: 'string', enum: ['active', 'disabled'] },
          },
        },
      },
    },
  },
} as const;

interface PermissionGroupInput {
  code: string;
  name: string;
  description?: string;
  status?: 'active' | 'disabled';
}

interface PermissionPointInput {
  groupCode: string;
  code: string;
  name: string;
  description?: string;
  status?: 'active' | 'disabled';
}

export async function registerApplicationApiRoutes(app: FastifyInstance, pool: DbPool): Promise<void> {
  const auth = applicationApiAuth(pool);

  app.put('/api/application/permission-groups', { preHandler: auth, schema: permissionGroupSchema }, async (request) => {
    const application = requireApplicationApi(request);
    const body = request.body as { groups: PermissionGroupInput[] };
    assertUniqueCodes(body.groups.map((group) => group.code), 'DUPLICATE_PERMISSION_GROUP_CODE', '权限组 code 不能重复');

    const client = await pool.connect();
    try {
      await client.query('begin');
      const items = [];
      for (const group of body.groups) {
        const result = await client.query(
          `
            insert into permission_groups(id, application_id, code, name, description, status, updated_at)
            values ($1, $2, $3, $4, $5, $6, now())
            on conflict (application_id, code)
            do update set name = excluded.name,
                          description = excluded.description,
                          status = excluded.status,
                          updated_at = now()
            returning id, code, name, description, status, created_at, updated_at
          `,
          [
            crypto.randomUUID(),
            application.applicationId,
            group.code.trim(),
            group.name.trim(),
            group.description?.trim() ?? null,
            group.status ?? 'active',
          ],
        );
        items.push(result.rows[0]);
      }
      await writeAudit(client, {
        requestId: request.id,
        actorFeishuUserId: null,
        action: 'application_api.permission_group.upsert',
        targetType: 'application',
        targetId: application.applicationId,
        result: 'success',
        metadata: { appKey: application.appKey, codes: items.map((item) => item.code) },
      });
      await client.query('commit');
      return { items };
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  });

  app.put('/api/application/permission-points', { preHandler: auth, schema: permissionPointSchema }, async (request) => {
    const application = requireApplicationApi(request);
    const body = request.body as { points: PermissionPointInput[] };
    assertUniqueCodes(body.points.map((point) => point.code), 'DUPLICATE_PERMISSION_POINT_CODE', '权限点 code 不能重复');

    const client = await pool.connect();
    try {
      await client.query('begin');
      const items = [];
      for (const point of body.points) {
        const group = await client.query(
          'select id, code from permission_groups where application_id = $1 and code = $2',
          [application.applicationId, point.groupCode.trim()],
        );
        const groupRow = group.rows[0] as { id: string; code: string } | undefined;
        if (!groupRow) {
          throw new HttpError(400, 'PERMISSION_GROUP_NOT_FOUND', '权限组不存在');
        }

        const result = await client.query(
          `
            insert into permission_points(id, application_id, group_id, code, name, description, status, updated_at)
            values ($1, $2, $3, $4, $5, $6, $7, now())
            on conflict (application_id, code)
            do update set group_id = excluded.group_id,
                          name = excluded.name,
                          description = excluded.description,
                          status = excluded.status,
                          updated_at = now()
            returning id, code, name, description, status, created_at, updated_at
          `,
          [
            crypto.randomUUID(),
            application.applicationId,
            groupRow.id,
            point.code.trim(),
            point.name.trim(),
            point.description?.trim() ?? null,
            point.status ?? 'active',
          ],
        );
        items.push({ ...result.rows[0], groupCode: groupRow.code });
      }
      await writeAudit(client, {
        requestId: request.id,
        actorFeishuUserId: null,
        action: 'application_api.permission_point.upsert',
        targetType: 'application',
        targetId: application.applicationId,
        result: 'success',
        metadata: { appKey: application.appKey, codes: items.map((item) => item.code) },
      });
      await client.query('commit');
      return { items };
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  });

  app.get('/api/application/me/permissions', { preHandler: auth }, async (request) => {
    const application = requireApplicationApi(request);
    if (!request.actor) {
      throw unauthorized();
    }
    if (request.actor.oauthApplicationId && request.actor.oauthApplicationId !== application.applicationId) {
      throw forbidden('OAuth token 不属于当前应用');
    }

    const result = await pool.query(
      `
        select distinct pp.code
        from roles r
        join role_permission_points rpp on rpp.role_id = r.id
        join permission_points pp on pp.id = rpp.permission_point_id
        join permission_groups pg on pg.id = pp.group_id
        where r.application_id = $1
          and r.status = 'active'
          and pp.status = 'active'
          and pg.status = 'active'
          and (
            exists (
              select 1
              from role_user_bindings rub
              where rub.role_id = r.id
                and rub.feishu_user_id = $2
            )
            or exists (
              select 1
              from role_department_bindings rdb
              join directory_users du on du.department_id = rdb.department_id
              where rdb.role_id = r.id
                and du.feishu_user_id = $2
                and du.status = 'active'
            )
          )
        order by pp.code
      `,
      [application.applicationId, request.actor.feishuUserId],
    );

    await writeAudit(pool, {
      requestId: request.id,
      actorFeishuUserId: request.actor.feishuUserId,
      action: 'application_api.permission.query',
      targetType: 'application',
      targetId: application.applicationId,
      result: 'success',
      metadata: { appKey: application.appKey, permissionCount: result.rowCount ?? 0 },
    });

    return {
      appKey: application.appKey,
      feishuUserId: request.actor.feishuUserId,
      permissionCodes: result.rows.map((row) => row.code),
    };
  });
}

function requireApplicationApi(request: FastifyRequest) {
  if (!request.applicationApi) {
    throw new HttpError(401, 'APPLICATION_API_AUTH_REQUIRED', '缺少 Application API 上下文');
  }
  return request.applicationApi;
}

function assertUniqueCodes(codes: string[], code: string, message: string): void {
  const normalizedCodes = codes.map((value) => value.trim());
  if (new Set(normalizedCodes).size !== normalizedCodes.length) {
    throw new HttpError(400, code, message);
  }
}
