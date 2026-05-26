import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DbPool } from '../src/db/pool';
import type { DirectorySyncAdapter, DirectorySyncSnapshot } from '../src/modules/sync/directorySyncAdapter';
import { buildTestApp } from './helpers/testApp';
import { createTestPool } from './helpers/testDb';

class FakeDirectorySyncAdapter implements DirectorySyncAdapter {
  snapshot: DirectorySyncSnapshot = { departments: [], users: [], requestBatchCount: 0 };
  error: Error | undefined;

  async fetchDirectorySnapshot(): Promise<DirectorySyncSnapshot> {
    if (this.error) {
      throw this.error;
    }
    return this.snapshot;
  }
}

describe('sync routes', () => {
  let pool: DbPool;
  let adapter: FakeDirectorySyncAdapter;
  let app: Awaited<ReturnType<typeof buildTestApp>>;

  beforeEach(async () => {
    pool = await createTestPool();
    adapter = new FakeDirectorySyncAdapter();
    app = await buildTestApp(pool, { directorySyncAdapter: adapter });
  });

  afterEach(async () => {
    await app.close();
    await pool.end();
  });

  it('lets platform admins trigger full sync and write directory projection', async () => {
    const adminCookie = await loginAndBindAdmin(app, 'ou_sync_admin_001', '同步管理员');
    adapter.snapshot = {
      departments: [
        { id: 'dept_root_sync', name: '飞书 IAM 演示组织', parentId: null },
        { id: 'dept_rd_sync', name: '研发部', parentId: 'dept_root_sync' },
      ],
      users: [
        {
          feishuUserId: 'ou_sync_user_001',
          name: '同步用户一号',
          email: 'sync-user@example.com',
          departmentId: 'dept_rd_sync',
          status: 'active',
        },
      ],
      requestBatchCount: 3,
    };

    const response = await app.inject({ method: 'POST', url: '/api/sync/runs', headers: { cookie: adminCookie } });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      trigger: 'manual',
      status: 'succeeded',
      operator_feishu_user_id: 'ou_sync_admin_001',
      request_batch_count: 3,
      success_count: 1,
      diff_summary: { createdDepartments: 2, createdUsers: 1 },
    });

    const users = await pool.query(
      "select feishu_user_id, name, email, department_id, status from directory_users where feishu_user_id = 'ou_sync_user_001'",
    );
    expect(users.rows).toEqual([
      {
        feishu_user_id: 'ou_sync_user_001',
        name: '同步用户一号',
        email: 'sync-user@example.com',
        department_id: 'dept_rd_sync',
        status: 'active',
      },
    ]);

    const audit = await pool.query("select action, result, target_type from audit_logs where action = 'sync.run' order by id");
    expect(audit.rows).toEqual([
      { action: 'sync.run', result: 'success', target_type: 'sync_run' },
      { action: 'sync.run', result: 'success', target_type: 'sync_run' },
    ]);
  });

  it('updates existing projection idempotently and marks missing users resigned', async () => {
    const adminCookie = await loginAndBindAdmin(app, 'ou_sync_admin_002', '同步管理员二');
    adapter.snapshot = {
      departments: [{ id: 'dept_sync_ops', name: '运营部', parentId: null }],
      users: [
        { feishuUserId: 'ou_keep_sync', name: '保留用户', departmentId: 'dept_sync_ops', status: 'active' },
        { feishuUserId: 'ou_leave_sync', name: '待离职用户', departmentId: 'dept_sync_ops', status: 'active' },
      ],
      requestBatchCount: 2,
    };
    await app.inject({ method: 'POST', url: '/api/sync/runs', headers: { cookie: adminCookie } });

    adapter.snapshot = {
      departments: [{ id: 'dept_sync_ops', name: '运营中心', parentId: null }],
      users: [{ feishuUserId: 'ou_keep_sync', name: '保留用户更新', departmentId: 'dept_sync_ops', status: 'active' }],
      requestBatchCount: 2,
    };
    const response = await app.inject({ method: 'POST', url: '/api/sync/runs', headers: { cookie: adminCookie } });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: 'succeeded',
      diff_summary: { updatedDepartments: 1, updatedUsers: 1, resignedUsers: 1 },
    });
    const users = await pool.query(
      "select feishu_user_id, name, status from directory_users where feishu_user_id in ('ou_keep_sync', 'ou_leave_sync') order by feishu_user_id",
    );
    expect(users.rows).toEqual([
      { feishu_user_id: 'ou_keep_sync', name: '保留用户更新', status: 'active' },
      { feishu_user_id: 'ou_leave_sync', name: '待离职用户', status: 'resigned' },
    ]);
  });

  it('rejects non-platform admins from viewing or triggering sync', async () => {
    const userCookie = await loginCookie(app, 'ou_sync_user_forbidden', '普通用户');

    const list = await app.inject({ method: 'GET', url: '/api/sync/runs', headers: { cookie: userCookie } });
    const start = await app.inject({ method: 'POST', url: '/api/sync/runs', headers: { cookie: userCookie } });

    expect(list.statusCode).toBe(403);
    expect(start.statusCode).toBe(403);
  });

  it('records failed sync runs and failure audit when adapter fails', async () => {
    const adminCookie = await loginAndBindAdmin(app, 'ou_sync_admin_003', '同步管理员三');
    adapter.error = new Error('飞书通讯录权限不足');

    const response = await app.inject({ method: 'POST', url: '/api/sync/runs', headers: { cookie: adminCookie } });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: 'failed',
      error_message: '飞书通讯录权限不足',
      failed_count: 1,
    });
    const audit = await pool.query("select result, metadata from audit_logs where action = 'sync.run' order by id desc limit 1");
    expect(audit.rows[0].result).toBe('failure');
    expect(audit.rows[0].metadata).toMatchObject({ status: 'failed', reason: '飞书通讯录权限不足' });
  });

  it('lists and retries sync runs', async () => {
    const adminCookie = await loginAndBindAdmin(app, 'ou_sync_admin_004', '同步管理员四');
    adapter.snapshot = {
      departments: [{ id: 'dept_retry_sync', name: '重试部门', parentId: null }],
      users: [],
      requestBatchCount: 1,
    };
    const first = await app.inject({ method: 'POST', url: '/api/sync/runs', headers: { cookie: adminCookie } });
    const retry = await app.inject({
      method: 'POST',
      url: `/api/sync/runs/${first.json().id}/retry`,
      headers: { cookie: adminCookie },
    });
    const list = await app.inject({ method: 'GET', url: '/api/sync/runs?page=1&pageSize=20', headers: { cookie: adminCookie } });

    expect(retry.statusCode).toBe(200);
    expect(retry.json()).toMatchObject({ trigger: 'retry', retry_of: first.json().id });
    expect(list.statusCode).toBe(200);
    expect(list.json()).toMatchObject({ total: 2, page: 1, pageSize: 20 });
    expect(list.json().items[0]).toMatchObject({ trigger: 'retry' });
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
