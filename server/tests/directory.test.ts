import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DbPool } from '../src/db/pool';
import { buildTestApp } from './helpers/testApp';
import { createTestPool } from './helpers/testDb';

describe('directory routes', () => {
  let pool: DbPool;
  let app: Awaited<ReturnType<typeof buildTestApp>>;

  beforeEach(async () => {
    pool = await createTestPool();
    app = await buildTestApp(pool);
  });

  afterEach(async () => {
    await app.close();
    await pool.end();
  });

  it('requires a logged-in platform admin to browse directory users', async () => {
    const unauthenticated = await app.inject({ method: 'GET', url: '/api/directory/users' });
    expect(unauthenticated.statusCode).toBe(401);
    expect(unauthenticated.json()).toMatchObject({ code: 'UNAUTHORIZED', requestId: expect.any(String) });

    const userCookie = await loginCookie(app, 'ou_directory_user', '目录普通用户');
    const forbidden = await app.inject({ method: 'GET', url: '/api/directory/users', headers: { cookie: userCookie } });
    expect(forbidden.statusCode).toBe(403);
    expect(forbidden.json()).toMatchObject({ code: 'FORBIDDEN', requestId: expect.any(String) });
  });

  it('returns departments and filters users by department subtree', async () => {
    const adminCookie = await loginAndBindAdmin(app, 'ou_directory_admin', '目录管理员');
    await seedDepartment(pool, { id: 'dept_root', name: '飞书 IAM 演示组织', parentId: null });
    await seedDepartment(pool, { id: 'dept_sales', name: '销售部', parentId: 'dept_root' });
    await seedDepartment(pool, { id: 'dept_sales_east', name: '华东销售', parentId: 'dept_sales' });
    await seedDepartment(pool, { id: 'dept_it', name: '信息化中心', parentId: 'dept_root' });
    await seedDirectoryUser(pool, { feishuUserId: 'ou_sales_001', name: '销售一号', departmentId: 'dept_sales' });
    await seedDirectoryUser(pool, { feishuUserId: 'ou_sales_east_001', name: '华东销售一号', departmentId: 'dept_sales_east' });
    await seedDirectoryUser(pool, { feishuUserId: 'ou_it_001', name: '研发一号', departmentId: 'dept_it' });

    const departments = await app.inject({ method: 'GET', url: '/api/directory/departments', headers: { cookie: adminCookie } });
    expect(departments.statusCode).toBe(200);
    expect(departments.json().items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'dept_root', name: '飞书 IAM 演示组织', parent_id: null, path: '飞书 IAM 演示组织' }),
        expect.objectContaining({
          id: 'dept_sales',
          parent_id: 'dept_root',
          path: '飞书 IAM 演示组织 / 销售部',
          user_count: 2,
        }),
      ]),
    );

    const users = await app.inject({
      method: 'GET',
      url: '/api/directory/users?departmentId=dept_sales&page=1&pageSize=20',
      headers: { cookie: adminCookie },
    });
    expect(users.statusCode).toBe(200);
    expect(users.json()).toMatchObject({ page: 1, pageSize: 20, total: 2 });
    expect(users.json().items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          feishu_user_id: 'ou_sales_001',
          name: '销售一号',
          department_id: 'dept_sales',
          department_name: '销售部',
          department_path: '飞书 IAM 演示组织 / 销售部',
          local_role_summary: '-',
        }),
        expect.objectContaining({
          feishu_user_id: 'ou_sales_east_001',
          department_id: 'dept_sales_east',
          department_path: '飞书 IAM 演示组织 / 销售部 / 华东销售',
        }),
      ]),
    );
    expect(users.json().items.map((item: { feishu_user_id: string }) => item.feishu_user_id)).not.toContain('ou_it_001');
  });

  it('paginates directory users', async () => {
    const adminCookie = await loginAndBindAdmin(app, 'ou_directory_page_admin', '分页管理员');
    await seedDepartment(pool, { id: 'dept_root', name: '飞书 IAM 演示组织', parentId: null });
    await seedDirectoryUser(pool, { feishuUserId: 'ou_page_001', name: '分页一号', departmentId: 'dept_root' });
    await seedDirectoryUser(pool, { feishuUserId: 'ou_page_002', name: '分页二号', departmentId: 'dept_root' });

    const users = await app.inject({
      method: 'GET',
      url: '/api/directory/users?page=2&pageSize=1',
      headers: { cookie: adminCookie },
    });

    expect(users.statusCode).toBe(200);
    expect(users.json()).toMatchObject({ page: 2, pageSize: 1, total: 3 });
    expect(users.json().items).toHaveLength(1);
  });
});

async function loginAndBindAdmin(app: Awaited<ReturnType<typeof buildTestApp>>, feishuUserId: string, name: string) {
  const cookie = await loginCookie(app, feishuUserId, name);
  await app.inject({ method: 'POST', url: '/api/initialization/bind-platform-admin', headers: { cookie } });
  return cookie;
}

async function loginCookie(app: Awaited<ReturnType<typeof buildTestApp>>, feishuUserId: string, name: string) {
  const login = await app.inject({
    method: 'POST',
    url: '/api/dev/feishu/mock-login',
    payload: { feishuUserId, name },
  });
  return String(login.headers['set-cookie']);
}

async function seedDepartment(pool: DbPool, input: { id: string; name: string; parentId: string | null }) {
  await pool.query(
    `
      insert into directory_departments(id, name, parent_id, status)
      values ($1, $2, $3, 'active')
      on conflict (id) do update set name = excluded.name, parent_id = excluded.parent_id
    `,
    [input.id, input.name, input.parentId],
  );
}

async function seedDirectoryUser(pool: DbPool, input: { feishuUserId: string; name: string; departmentId: string }) {
  await pool.query(
    `
      insert into feishu_users(feishu_user_id, name, status)
      values ($1, $2, 'active')
      on conflict (feishu_user_id) do update set name = excluded.name
    `,
    [input.feishuUserId, input.name],
  );
  await pool.query(
    `
      insert into directory_users(feishu_user_id, name, email, department_id, status)
      values ($1, $2, $3, $4, 'active')
      on conflict (feishu_user_id) do update set name = excluded.name, department_id = excluded.department_id
    `,
    [input.feishuUserId, input.name, `${input.feishuUserId}@example.com`, input.departmentId],
  );
}
