import crypto from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DbPool } from '../src/db/pool';
import type { DirectorySyncAdapter, DirectorySyncPreflightResult, DirectorySyncSnapshot } from '../src/modules/sync/directorySyncAdapter';
import { runScheduledDirectorySync } from '../src/modules/sync/syncScheduler';
import { buildTestApp } from './helpers/testApp';
import { createTestPool } from './helpers/testDb';

class FakeDirectorySyncAdapter implements DirectorySyncAdapter {
  snapshot: DirectorySyncSnapshot = { departments: [], users: [], requestBatchCount: 0 };
  preflightResult: DirectorySyncPreflightResult = {
    status: 'passed',
    checkedAt: new Date().toISOString(),
    requestBatchCount: 3,
    stages: [
      { name: 'token', status: 'passed' },
      { name: 'departments', status: 'passed' },
      { name: 'users', status: 'passed' },
    ],
    message: '预检通过',
  };
  error: Error | undefined;
  preflightError: Error | undefined;

  async preflight(): Promise<DirectorySyncPreflightResult> {
    if (this.preflightError) {
      throw this.preflightError;
    }
    return this.preflightResult;
  }

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
      operator_type: 'feishu_user',
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

  it('runs scheduled full sync with a system actor and no fake Feishu user', async () => {
    adapter.snapshot = {
      departments: [{ id: 'dept_scheduled_sync', name: '定时同步部门', parentId: null }],
      users: [
        {
          feishuUserId: 'ou_scheduled_sync_user',
          name: '定时同步用户',
          departmentId: 'dept_scheduled_sync',
          status: 'active',
        },
      ],
      requestBatchCount: 2,
    };

    const result = await runScheduledDirectorySync(pool, adapter);

    expect(result).toMatchObject({ status: 'succeeded', runId: expect.any(String) });
    const runs = await pool.query(
      `
        select trigger, status, operator_type, operator_feishu_user_id, request_id
        from sync_runs
        where id = $1
      `,
      [result.status === 'succeeded' || result.status === 'failed' ? result.runId : ''],
    );
    expect(runs.rows).toEqual([
      {
        trigger: 'scheduled',
        status: 'succeeded',
        operator_type: 'system',
        operator_feishu_user_id: null,
        request_id: expect.stringMatching(/^scheduled_/),
      },
    ]);

    const fakeUsers = await pool.query("select feishu_user_id from feishu_users where feishu_user_id = 'ou_system_sync'");
    expect(fakeUsers.rows).toEqual([]);
    const audit = await pool.query("select actor_feishu_user_id, result, metadata from audit_logs where action = 'sync.run' order by id");
    expect(audit.rows).toEqual([
      expect.objectContaining({ actor_feishu_user_id: null, result: 'success', metadata: expect.objectContaining({ operatorType: 'system' }) }),
      expect.objectContaining({ actor_feishu_user_id: null, result: 'success', metadata: expect.objectContaining({ operatorType: 'system' }) }),
    ]);
  });

  it('skips scheduled full sync when another sync is running', async () => {
    await loginCookie(app, 'ou_running_sync_operator', '运行中同步操作人');
    await seedSyncRun(pool, {
      operatorFeishuUserId: 'ou_running_sync_operator',
      status: 'running',
      startedAt: '2026-05-26T10:00:00.000Z',
    });

    const before = await pool.query('select count(*)::int as total from sync_runs');
    const result = await runScheduledDirectorySync(pool, adapter);
    const after = await pool.query('select count(*)::int as total from sync_runs');

    expect(result).toEqual({ status: 'skipped_running' });
    expect(after.rows[0].total).toBe(before.rows[0].total);
  });

  it('returns sync health status for platform admins', async () => {
    const adminCookie = await loginAndBindAdmin(app, 'ou_sync_status_admin', '同步状态管理员');

    const initial = await app.inject({ method: 'GET', url: '/api/sync/status', headers: { cookie: adminCookie } });
    expect(initial.statusCode).toBe(200);
    expect(initial.json()).toMatchObject({
      latestRun: null,
      latestSuccessfulRun: null,
      latestFailedRun: null,
      isRunning: false,
      healthStatus: 'unknown',
    });
    expect(initial.json().directoryUserCount).toEqual(expect.any(Number));
    expect(initial.json().directoryDepartmentCount).toEqual(expect.any(Number));

    await seedSyncRun(pool, {
      operatorFeishuUserId: 'ou_sync_status_admin',
      status: 'succeeded',
      startedAt: '2026-05-26T08:00:00.000Z',
      finishedAt: '2026-05-26T08:01:00.000Z',
    });
    await seedSyncRun(pool, {
      operatorFeishuUserId: 'ou_sync_status_admin',
      status: 'failed',
      startedAt: '2026-05-26T09:00:00.000Z',
      finishedAt: '2026-05-26T09:01:00.000Z',
      errorMessage: '飞书通讯录 API 调用失败',
    });

    const failed = await app.inject({ method: 'GET', url: '/api/sync/status', headers: { cookie: adminCookie } });
    expect(failed.statusCode).toBe(200);
    expect(failed.json()).toMatchObject({
      latestRun: { status: 'failed', error_message: '飞书通讯录 API 调用失败' },
      latestSuccessfulRun: { status: 'succeeded' },
      latestFailedRun: { status: 'failed' },
      healthStatus: 'failed',
      healthReasons: ['最近一次失败同步晚于最近一次成功同步'],
    });

    await seedSyncRun(pool, {
      operatorFeishuUserId: 'ou_sync_status_admin',
      status: 'running',
      startedAt: '2026-05-26T10:00:00.000Z',
    });

    const running = await app.inject({ method: 'GET', url: '/api/sync/status', headers: { cookie: adminCookie } });
    expect(running.statusCode).toBe(200);
    expect(running.json()).toMatchObject({
      isRunning: true,
      healthStatus: 'warning',
      healthReasons: ['已有同步任务正在运行'],
    });
  });

  it('runs preflight without creating sync runs or mutating directory projection', async () => {
    const adminCookie = await loginAndBindAdmin(app, 'ou_sync_preflight_admin', '同步预检管理员');
    await seedDirectoryProjection(pool);
    const beforeCounts = await readRuntimeCounts(pool);

    const response = await app.inject({ method: 'POST', url: '/api/sync/preflight', headers: { cookie: adminCookie } });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: 'passed',
      requestBatchCount: 3,
      requestId: expect.any(String),
      stages: [
        { name: 'token', status: 'passed' },
        { name: 'departments', status: 'passed' },
        { name: 'users', status: 'passed' },
      ],
    });
    expect(await readRuntimeCounts(pool)).toEqual(beforeCounts);

    const audit = await pool.query("select action, result, target_type, metadata from audit_logs where action = 'sync.preflight'");
    expect(audit.rows).toHaveLength(1);
    expect(audit.rows[0]).toMatchObject({ action: 'sync.preflight', result: 'success', target_type: 'sync_preflight' });
    expect(audit.rows[0].metadata).toMatchObject({ status: 'passed', requestBatchCount: 3 });
  });

  it('records preflight failures with sanitized failure audit', async () => {
    const adminCookie = await loginAndBindAdmin(app, 'ou_sync_preflight_failed_admin', '同步预检失败管理员');
    adapter.preflightResult = {
      status: 'failed',
      checkedAt: new Date().toISOString(),
      requestBatchCount: 2,
      stages: [
        { name: 'token', status: 'passed' },
        { name: 'departments', status: 'failed', message: '飞书通讯录 API 调用失败' },
      ],
      errorCode: 'FEISHU_DIRECTORY_API_FAILED',
      message: '飞书通讯录 API 调用失败',
    };

    const response = await app.inject({ method: 'POST', url: '/api/sync/preflight', headers: { cookie: adminCookie } });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: 'failed',
      errorCode: 'FEISHU_DIRECTORY_API_FAILED',
      message: '飞书通讯录 API 调用失败',
      stages: [
        { name: 'token', status: 'passed' },
        { name: 'departments', status: 'failed', message: '飞书通讯录 API 调用失败' },
      ],
    });
    expect(JSON.stringify(response.json())).not.toContain('app_secret');
    expect(JSON.stringify(response.json())).not.toContain('tenant_access_token');

    const audit = await pool.query("select result, metadata from audit_logs where action = 'sync.preflight'");
    expect(audit.rows[0].result).toBe('failure');
    expect(audit.rows[0].metadata).toMatchObject({ status: 'failed', errorCode: 'FEISHU_DIRECTORY_API_FAILED' });
  });

  it('rejects non-platform admins from status and preflight routes', async () => {
    const userCookie = await loginCookie(app, 'ou_sync_status_forbidden', '同步状态普通用户');
    const ownerCookie = await loginCookie(app, 'ou_sync_app_owner_forbidden', '同步应用负责人');
    const adminCookie = await loginAndBindAdmin(app, 'ou_sync_platform_for_app_owner', '同步平台管理员');
    await createApplication(app, adminCookie, '同步预检应用', 'ou_sync_app_owner_forbidden');

    const status = await app.inject({ method: 'GET', url: '/api/sync/status', headers: { cookie: userCookie } });
    const preflight = await app.inject({ method: 'POST', url: '/api/sync/preflight', headers: { cookie: userCookie } });
    const appAdminStatus = await app.inject({ method: 'GET', url: '/api/sync/status', headers: { cookie: ownerCookie } });
    const appAdminPreflight = await app.inject({ method: 'POST', url: '/api/sync/preflight', headers: { cookie: ownerCookie } });

    expect(status.statusCode).toBe(403);
    expect(preflight.statusCode).toBe(403);
    expect(appAdminStatus.statusCode).toBe(403);
    expect(appAdminPreflight.statusCode).toBe(403);
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

async function seedSyncRun(
  pool: DbPool,
  input: {
    operatorFeishuUserId: string;
    status: 'running' | 'succeeded' | 'failed';
    startedAt: string;
    finishedAt?: string;
    errorMessage?: string;
  },
) {
  await pool.query(
    `
      insert into sync_runs(id, trigger, status, operator_feishu_user_id, request_id, started_at, finished_at, error_message)
      values ($1, 'manual', $2, $3, $4, $5, $6, $7)
    `,
    [
      crypto.randomUUID(),
      input.status,
      input.operatorFeishuUserId,
      `req_${crypto.randomUUID()}`,
      input.startedAt,
      input.finishedAt ?? null,
      input.errorMessage ?? null,
    ],
  );
}

async function seedDirectoryProjection(pool: DbPool) {
  await pool.query(
    `
      insert into directory_departments(id, name, parent_id, status)
      values ('dept_preflight_seed', '预检部门', null, 'active')
    `,
  );
  await pool.query(
    `
      insert into feishu_users(feishu_user_id, name, status)
      values ('ou_preflight_seed', '预检用户', 'active')
    `,
  );
  await pool.query(
    `
      insert into directory_users(feishu_user_id, name, department_id, status)
      values ('ou_preflight_seed', '预检用户', 'dept_preflight_seed', 'active')
    `,
  );
}

async function readRuntimeCounts(pool: DbPool) {
  const [runs, departments, users, feishuUsers] = await Promise.all([
    pool.query('select count(*)::int as total from sync_runs'),
    pool.query('select count(*)::int as total from directory_departments'),
    pool.query('select count(*)::int as total from directory_users'),
    pool.query('select count(*)::int as total from feishu_users'),
  ]);

  return {
    syncRuns: runs.rows[0].total,
    departments: departments.rows[0].total,
    users: users.rows[0].total,
    feishuUsers: feishuUsers.rows[0].total,
  };
}

async function createApplication(
  app: Awaited<ReturnType<typeof buildTestApp>>,
  cookie: string,
  name: string,
  ownerFeishuUserId: string,
) {
  const response = await app.inject({
    method: 'POST',
    url: '/api/applications',
    headers: { cookie },
    payload: { name, ownerFeishuUserId },
  });
  expect(response.statusCode).toBe(200);
  return response.json();
}
