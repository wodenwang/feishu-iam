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
      departmentId: { type: 'string', minLength: 1, maxLength: 100 },
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
          with recursive department_tree as (
            select id, name, parent_id, status, created_at, updated_at, name::text as path
            from directory_departments
            where parent_id is null
            union all
            select child.id,
                   child.name,
                   child.parent_id,
                   child.status,
                   child.created_at,
                   child.updated_at,
                   (department_tree.path || ' / ' || child.name)::text as path
            from directory_departments child
            join department_tree on department_tree.id = child.parent_id
          )
          select department_tree.id,
                 department_tree.name,
                 department_tree.parent_id,
                 department_tree.status,
                 department_tree.path,
                 department_tree.created_at,
                 department_tree.updated_at,
                 (
                   with recursive descendants as (
                     select id
                     from directory_departments
                     where id = department_tree.id
                     union all
                     select child.id
                     from directory_departments child
                     join descendants on child.parent_id = descendants.id
                   )
                   select count(*)::int
                   from directory_users
                   where department_id in (select id from descendants)
                 ) as user_count
          from department_tree
          order by path asc
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

    const query = request.query as { page?: number; pageSize?: number; departmentId?: string };
    const { page, pageSize } = normalizePagination(query);
    const offset = (page - 1) * pageSize;
    const values: Array<string | number> = [pageSize, offset];
    const departmentFilter = query.departmentId
      ? `
          and u.department_id in (
            with recursive selected_departments as (
              select id
              from directory_departments
              where id = $3
              union all
              select child.id
              from directory_departments child
              join selected_departments on child.parent_id = selected_departments.id
            )
            select id from selected_departments
          )
        `
      : '';
    const totalDepartmentFilter = query.departmentId
      ? `
          and u.department_id in (
            with recursive selected_departments as (
              select id
              from directory_departments
              where id = $1
              union all
              select child.id
              from directory_departments child
              join selected_departments on child.parent_id = selected_departments.id
            )
            select id from selected_departments
          )
        `
      : '';
    if (query.departmentId) {
      values.push(query.departmentId);
    }
    const [items, total] = await Promise.all([
      pool.query(
        `
          with recursive department_tree as (
            select id, name, parent_id, name::text as path
            from directory_departments
            where parent_id is null
            union all
            select child.id,
                   child.name,
                   child.parent_id,
                   (department_tree.path || ' / ' || child.name)::text as path
            from directory_departments child
            join department_tree on department_tree.id = child.parent_id
          )
          select u.feishu_user_id,
                 u.name,
                 u.email,
                 u.department_id,
                 coalesce(department_tree.name, '-') as department_name,
                 coalesce(department_tree.path, '-') as department_path,
                 u.status,
                 u.created_at,
                 u.updated_at,
                 u.updated_at as synced_at,
                 coalesce(role_summary.summary, '-') as local_role_summary,
                 login_audit.last_login_at,
                 permission_audit.last_permission_queried_at
          from directory_users u
          left join department_tree on department_tree.id = u.department_id
          left join lateral (
            select string_agg(distinct r.name, '；' order by r.name) as summary
            from roles r
            left join role_user_bindings rub on rub.role_id = r.id and rub.feishu_user_id = u.feishu_user_id
            left join role_department_bindings rdb on rdb.role_id = r.id and rdb.department_id = u.department_id
            where rub.feishu_user_id is not null or rdb.department_id is not null
          ) role_summary on true
          left join lateral (
            select max(created_at) as last_login_at
            from audit_logs
            where actor_feishu_user_id = u.feishu_user_id and action = 'auth.mock_login'
          ) login_audit on true
          left join lateral (
            select max(created_at) as last_permission_queried_at
            from audit_logs
            where actor_feishu_user_id = u.feishu_user_id and action = 'application_api.permission.query'
          ) permission_audit on true
          where true
          ${departmentFilter}
          order by u.created_at desc, u.feishu_user_id asc
          limit $1 offset $2
        `,
        values,
      ),
      pool.query(
        `
          select count(*)::int as total
          from directory_users u
          where true
          ${totalDepartmentFilter}
        `,
        query.departmentId ? [query.departmentId] : [],
      ),
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
