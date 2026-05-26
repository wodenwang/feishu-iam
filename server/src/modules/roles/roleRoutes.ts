import crypto from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { DbClient, DbPool } from '../../db/pool';
import { addApplicationScopeFilter, requireAdminActor, requireApplicationScope, requireRoleScope } from '../adminScope';
import { writeAudit } from '../audit/auditRepository';
import { HttpError } from '../errors/httpError';

const listRolesSchema = {
  querystring: {
    type: 'object',
    additionalProperties: false,
    properties: {
      page: { type: 'integer', minimum: 1, default: 1 },
      pageSize: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
      appKey: { type: 'string', minLength: 1, maxLength: 100 },
      keyword: { type: 'string', maxLength: 100 },
      status: { type: 'string', enum: ['active', 'disabled'] },
      createdAtFrom: { type: 'string', maxLength: 40 },
      createdAtTo: { type: 'string', maxLength: 40 },
    },
  },
} as const;

const createRoleSchema = {
  body: {
    type: 'object',
    required: ['appKey', 'code', 'name'],
    additionalProperties: false,
    properties: {
      appKey: { type: 'string', minLength: 1, maxLength: 100 },
      code: { type: 'string', minLength: 2, maxLength: 100 },
      name: { type: 'string', minLength: 1, maxLength: 100 },
      description: { type: 'string', maxLength: 500 },
      status: { type: 'string', enum: ['active', 'disabled'] },
    },
  },
} as const;

const updateRoleSchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: { id: { type: 'string', format: 'uuid' } },
  },
  body: {
    type: 'object',
    minProperties: 1,
    additionalProperties: false,
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 100 },
      description: { type: 'string', maxLength: 500 },
      status: { type: 'string', enum: ['active', 'disabled'] },
    },
  },
} as const;

const authorizationSchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: { id: { type: 'string', format: 'uuid' } },
  },
  body: {
    type: 'object',
    required: ['permissionPointCodes', 'feishuUserIds', 'departmentIds'],
    additionalProperties: false,
    properties: {
      permissionPointCodes: {
        type: 'array',
        maxItems: 500,
        items: { type: 'string', minLength: 2, maxLength: 120 },
      },
      feishuUserIds: {
        type: 'array',
        maxItems: 500,
        items: { type: 'string', minLength: 1, maxLength: 100 },
      },
      departmentIds: {
        type: 'array',
        maxItems: 200,
        items: { type: 'string', minLength: 1, maxLength: 100 },
      },
    },
  },
} as const;

interface CreateRoleBody {
  appKey: string;
  code: string;
  name: string;
  description?: string;
  status?: 'active' | 'disabled';
}

interface UpdateRoleBody {
  name?: string;
  description?: string;
  status?: 'active' | 'disabled';
}

interface AuthorizationBody {
  permissionPointCodes: string[];
  feishuUserIds: string[];
  departmentIds: string[];
}

export async function registerRoleRoutes(app: FastifyInstance, pool: DbPool): Promise<void> {
  app.get('/api/roles', { schema: listRolesSchema }, async (request) => {
    const actor = requireAdminActor(request.actor, '只有管理员可以管理角色');
    const query = request.query as {
      page?: number;
      pageSize?: number;
      appKey?: string;
      keyword?: string;
      status?: 'active' | 'disabled';
      createdAtFrom?: string;
      createdAtTo?: string;
    };
    const { page, pageSize } = normalizePagination(query);
    const offset = (page - 1) * pageSize;
    const filters: string[] = [];
    const filterParams: Array<string | number | string[]> = [];
    const addFilter = (buildClause: (paramIndex: number) => string, value: string) => {
      filterParams.push(value);
      filters.push(buildClause(filterParams.length));
    };

    if (query.appKey) {
      addFilter((paramIndex) => `a.app_key = $${paramIndex}`, query.appKey);
    }
    if (query.keyword?.trim()) {
      addFilter(
        (paramIndex) => `(r.name ilike '%' || $${paramIndex} || '%' or r.code ilike '%' || $${paramIndex} || '%' or a.name ilike '%' || $${paramIndex} || '%')`,
        query.keyword.trim(),
      );
    }
    if (query.status) {
      addFilter((paramIndex) => `r.status = $${paramIndex}`, query.status);
    }
    if (query.createdAtFrom) {
      addFilter((paramIndex) => `r.created_at >= $${paramIndex}`, query.createdAtFrom);
    }
    if (query.createdAtTo) {
      addFilter((paramIndex) => `r.created_at <= $${paramIndex}`, query.createdAtTo);
    }
    addApplicationScopeFilter(actor, filters, filterParams, 'r.application_id');
    const whereClause = filters.length ? `where ${filters.join(' and ')}` : '';
    const listParams: Array<string | number | string[]> = [...filterParams, pageSize, offset];
    const limitParam = filterParams.length + 1;
    const offsetParam = filterParams.length + 2;

    const [items, total] = await Promise.all([
      pool.query(
        `
          select r.id,
                 r.application_id,
                 a.name as application_name,
                 a.app_key,
                 r.code,
                 r.name,
                 r.description,
                 r.status,
                 r.created_at,
                 r.updated_at,
                 coalesce(permission_summary.permission_keys, '{}'::text[]) as permission_keys,
                 coalesce(permission_summary.permission_group_count, 0)::int as permission_group_count,
                 coalesce(permission_summary.permission_point_count, 0)::int as permission_point_count,
                 coalesce(department_summary.department_ids, '{}'::text[]) as department_ids,
                 coalesce(department_summary.department_binding_count, 0)::int as department_binding_count,
                 coalesce(user_summary.user_ids, '{}'::text[]) as user_ids,
                 coalesce(user_summary.user_binding_count, 0)::int as user_binding_count
          from roles r
          join applications a on a.id = r.application_id
          left join lateral (
            select array_agg(pp.code order by pp.code) as permission_keys,
                   count(distinct pp.group_id)::int as permission_group_count,
                   count(pp.id)::int as permission_point_count
            from role_permission_points rpp
            join permission_points pp on pp.id = rpp.permission_point_id
            where rpp.role_id = r.id
          ) permission_summary on true
          left join lateral (
            select array_agg(rdb.department_id order by rdb.department_id) as department_ids,
                   count(rdb.department_id)::int as department_binding_count
            from role_department_bindings rdb
            where rdb.role_id = r.id
          ) department_summary on true
          left join lateral (
            select array_agg(rub.feishu_user_id order by rub.feishu_user_id) as user_ids,
                   count(rub.feishu_user_id)::int as user_binding_count
            from role_user_bindings rub
            where rub.role_id = r.id
          ) user_summary on true
          ${whereClause}
          order by r.created_at desc
          limit $${limitParam} offset $${offsetParam}
        `,
        listParams,
      ),
      pool.query(
        `
          select count(*)::int as total
          from roles r
          join applications a on a.id = r.application_id
          ${whereClause}
        `,
        filterParams,
      ),
    ]);

    return { items: items.rows, page, pageSize, total: total.rows[0].total };
  });

  app.post('/api/roles', { schema: createRoleSchema }, async (request) => {
    const actor = requireAdminActor(request.actor, '只有管理员可以管理角色');
    const body = request.body as CreateRoleBody;
    const application = await findApplicationByAppKey(pool, body.appKey);
    if (!application) {
      throw new HttpError(400, 'APPLICATION_NOT_FOUND', '应用不存在');
    }
    requireApplicationScope(actor, application.id, '没有权限管理该应用的角色');

    const client = await pool.connect();
    try {
      await client.query('begin');
      const result = await client.query(
        `
          insert into roles(id, application_id, code, name, description, status)
          values ($1, $2, $3, $4, $5, $6)
          returning id, application_id, code, name, description, status, created_at, updated_at
        `,
        [
          crypto.randomUUID(),
          application.id,
          body.code.trim(),
          body.name.trim(),
          body.description?.trim() ?? null,
          body.status ?? 'active',
        ],
      );
      await writeAudit(client, {
        requestId: request.id,
        actorFeishuUserId: request.actor!.feishuUserId,
        action: 'role.create',
        targetType: 'role',
        targetId: result.rows[0].id,
        result: 'success',
        metadata: { appKey: application.app_key, code: result.rows[0].code },
      });
      await client.query('commit');
      return { ...result.rows[0], appKey: application.app_key };
    } catch (error) {
      await client.query('rollback');
      if (isUniqueViolation(error)) {
        throw new HttpError(409, 'ROLE_CODE_EXISTS', '角色 code 已存在');
      }
      throw error;
    } finally {
      client.release();
    }
  });

  app.get('/api/roles/permission-tree', async (request) => {
    const actor = requireAdminActor(request.actor, '只有管理员可以查看权限树');
    const filters: string[] = ["pg.status = 'active'"];
    const values: Array<string | number | string[]> = [];
    addApplicationScopeFilter(actor, filters, values, 'pg.application_id');
    const result = await pool.query(
      `
        select pg.code as group_code,
               pg.name as group_name,
               pp.code as point_code,
               pp.name as point_name
        from permission_groups pg
        left join permission_points pp on pp.group_id = pg.id and pp.status = 'active'
        where ${filters.join(' and ')}
        order by pg.code asc, pp.code asc
      `,
      values,
    );
    const groups = new Map<string, { key: string; title: string; children: Array<{ key: string; title: string }>; childKeys: Set<string> }>();
    for (const row of result.rows as Array<{ group_code: string; group_name: string; point_code?: string; point_name?: string }>) {
      if (!groups.has(row.group_code)) {
        groups.set(row.group_code, { key: row.group_code, title: row.group_name, children: [], childKeys: new Set() });
      }
      const group = groups.get(row.group_code)!;
      if (row.point_code && row.point_name && !group.childKeys.has(row.point_code)) {
        group.childKeys.add(row.point_code);
        group.children.push({ key: row.point_code, title: row.point_name });
      }
    }
    return {
      items: Array.from(groups.values()).map((group) => ({
        key: group.key,
        title: group.title,
        children: group.children,
      })),
    };
  });

  app.patch('/api/roles/:id', { schema: updateRoleSchema }, async (request) => {
    const { id } = request.params as { id: string };
    await requireRoleScope(pool, request.actor, id);
    const body = request.body as UpdateRoleBody;

    const result = await pool.query(
      `
        update roles
        set name = coalesce($2, name),
            description = coalesce($3, description),
            status = coalesce($4, status),
            updated_at = now()
        where id = $1
        returning id, application_id, code, name, description, status, created_at, updated_at
      `,
      [id, body.name?.trim() ?? null, body.description?.trim() ?? null, body.status ?? null],
    );
    const role = result.rows[0];
    if (!role) {
      throw new HttpError(404, 'ROLE_NOT_FOUND', '角色不存在');
    }

    await writeAudit(pool, {
      requestId: request.id,
      actorFeishuUserId: request.actor!.feishuUserId,
      action: 'role.update',
      targetType: 'role',
      targetId: id,
      result: 'success',
      metadata: { code: role.code, status: role.status },
    });
    return role;
  });

  app.put('/api/roles/:id/authorization', { schema: authorizationSchema }, async (request) => {
    const { id } = request.params as { id: string };
    const body = request.body as AuthorizationBody;
    assertUniqueValues(body.permissionPointCodes, 'DUPLICATE_AUTHORIZATION_PERMISSION_POINT', '授权权限点不能重复');
    assertUniqueValues(body.feishuUserIds, 'DUPLICATE_AUTHORIZATION_USER', '授权用户不能重复');
    assertUniqueValues(body.departmentIds, 'DUPLICATE_AUTHORIZATION_DEPARTMENT', '授权部门不能重复');

    const client = await pool.connect();
    try {
      await client.query('begin');
      const role = await client.query('select id, application_id, code from roles where id = $1', [id]);
      const roleRow = role.rows[0] as { id: string; application_id: string; code: string } | undefined;
      if (!roleRow) {
        throw new HttpError(404, 'ROLE_NOT_FOUND', '角色不存在');
      }
      requireApplicationScope(request.actor, roleRow.application_id, '没有权限管理该应用的角色');

      const permissionPointIds = await resolvePermissionPointIds(client, roleRow.application_id, body.permissionPointCodes);
      await assertFeishuUsersExist(client, body.feishuUserIds);
      await assertDepartmentsExist(client, body.departmentIds);

      await client.query('delete from role_permission_points where role_id = $1', [id]);
      await client.query('delete from role_user_bindings where role_id = $1', [id]);
      await client.query('delete from role_department_bindings where role_id = $1', [id]);

      for (const permissionPointId of permissionPointIds) {
        await client.query(
          'insert into role_permission_points(role_id, permission_point_id) values ($1, $2) on conflict do nothing',
          [id, permissionPointId],
        );
      }
      for (const feishuUserId of body.feishuUserIds) {
        await client.query('insert into role_user_bindings(role_id, feishu_user_id) values ($1, $2) on conflict do nothing', [
          id,
          feishuUserId,
        ]);
      }
      for (const departmentId of body.departmentIds) {
        await client.query(
          'insert into role_department_bindings(role_id, department_id) values ($1, $2) on conflict do nothing',
          [id, departmentId],
        );
      }

      await writeAudit(client, {
        requestId: request.id,
        actorFeishuUserId: request.actor!.feishuUserId,
        action: 'role.authorization.update',
        targetType: 'role',
        targetId: id,
        result: 'success',
        metadata: {
          roleCode: roleRow.code,
          permissionPointCount: permissionPointIds.length,
          userCount: body.feishuUserIds.length,
          departmentCount: body.departmentIds.length,
        },
      });
      await client.query('commit');

      return {
        roleId: id,
        permissionPointCodes: body.permissionPointCodes,
        feishuUserIds: body.feishuUserIds,
        departmentIds: body.departmentIds,
      };
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  });
}

function normalizePagination(query: { page?: number; pageSize?: number }) {
  return {
    page: query.page ?? 1,
    pageSize: query.pageSize ?? 20,
  };
}

async function findApplicationByAppKey(pool: DbPool, appKey: string): Promise<{ id: string; app_key: string } | null> {
  const result = await pool.query('select id, app_key from applications where app_key = $1', [appKey]);
  return result.rows[0] ?? null;
}

async function resolvePermissionPointIds(
  client: DbClient,
  applicationId: string,
  codes: string[],
): Promise<string[]> {
  if (codes.length === 0) {
    return [];
  }
  const result = await client.query(
    `
      select id, code
      from permission_points
      where application_id = $1
        and code = any($2::text[])
    `,
    [applicationId, codes],
  );
  if (result.rowCount !== codes.length) {
    throw new HttpError(400, 'PERMISSION_POINT_NOT_FOUND', '授权权限点不存在');
  }
  const idByCode = new Map(result.rows.map((row) => [row.code, row.id]));
  return codes.map((code) => idByCode.get(code) as string);
}

async function assertFeishuUsersExist(client: DbClient, feishuUserIds: string[]): Promise<void> {
  if (feishuUserIds.length === 0) {
    return;
  }
  const result = await client.query('select feishu_user_id from feishu_users where feishu_user_id = any($1::text[])', [
    feishuUserIds,
  ]);
  if (result.rowCount !== feishuUserIds.length) {
    throw new HttpError(400, 'FEISHU_USER_NOT_FOUND', '授权飞书用户不存在');
  }
}

async function assertDepartmentsExist(client: DbClient, departmentIds: string[]): Promise<void> {
  if (departmentIds.length === 0) {
    return;
  }
  const result = await client.query('select id from directory_departments where id = any($1::text[])', [departmentIds]);
  if (result.rowCount !== departmentIds.length) {
    throw new HttpError(400, 'DIRECTORY_DEPARTMENT_NOT_FOUND', '授权部门不存在');
  }
}

function assertUniqueValues(values: string[], code: string, message: string): void {
  if (new Set(values).size !== values.length) {
    throw new HttpError(400, code, message);
  }
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
}
