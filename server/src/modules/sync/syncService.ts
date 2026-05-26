import crypto from 'node:crypto';
import type { DbClient, DbPool } from '../../db/pool';
import type { CurrentActor } from '../../plugins/requestContext';
import { writeAudit } from '../audit/auditRepository';
import { HttpError } from '../errors/httpError';
import type { DirectoryDepartmentSnapshot, DirectorySyncAdapter, DirectorySyncSnapshot, DirectoryUserSnapshot } from './directorySyncAdapter';

export interface RuntimeSyncRun {
  id: string;
  trigger: 'manual' | 'scheduled' | 'retry';
  status: 'running' | 'succeeded' | 'failed';
  operator_feishu_user_id: string;
  request_id: string;
  started_at: string;
  finished_at?: string | null;
  error_message?: string | null;
  request_batch_count: number;
  success_count: number;
  failed_count: number;
  diff_summary: SyncDiffSummary;
  retry_of?: string | null;
}

interface SyncDiffSummary {
  createdUsers: number;
  updatedUsers: number;
  resignedUsers: number;
  failedUsers: number;
  createdDepartments: number;
  updatedDepartments: number;
}

export async function listSyncRuns(pool: DbPool, input: { page: number; pageSize: number }) {
  const offset = (input.page - 1) * input.pageSize;
  const [items, total] = await Promise.all([
    pool.query(
      `
        select id,
               trigger,
               status,
               operator_feishu_user_id,
               request_id,
               started_at,
               finished_at,
               error_message,
               request_batch_count,
               success_count,
               failed_count,
               diff_summary,
               retry_of
        from sync_runs
        order by started_at desc
        limit $1 offset $2
      `,
      [input.pageSize, offset],
    ),
    pool.query('select count(*)::int as total from sync_runs'),
  ]);

  return { items: items.rows.map(mapSyncRunRow), page: input.page, pageSize: input.pageSize, total: total.rows[0].total };
}

export async function startDirectorySync(
  pool: DbPool,
  adapter: DirectorySyncAdapter,
  input: { actor: CurrentActor; requestId: string; trigger: 'manual' | 'retry'; retryOf?: string },
): Promise<RuntimeSyncRun> {
  const running = await pool.query("select id from sync_runs where status = 'running' limit 1");
  if ((running.rowCount ?? 0) > 0) {
    throw new HttpError(409, 'SYNC_ALREADY_RUNNING', '已有同步任务正在运行');
  }

  const runId = crypto.randomUUID();
  await pool.query(
    `
      insert into sync_runs(id, trigger, status, operator_feishu_user_id, request_id, retry_of)
      values ($1, $2, 'running', $3, $4, $5)
    `,
    [runId, input.trigger, input.actor.feishuUserId, input.requestId, input.retryOf ?? null],
  );
  await writeAudit(pool, {
    requestId: input.requestId,
    actorFeishuUserId: input.actor.feishuUserId,
    action: 'sync.run',
    targetType: 'sync_run',
    targetId: runId,
    result: 'success',
    metadata: { status: 'started', trigger: input.trigger },
  });

  try {
    const snapshot = await adapter.fetchDirectorySnapshot();
    const diff = await applyDirectorySnapshot(pool, snapshot);
    await pool.query(
      `
        update sync_runs
        set status = 'succeeded',
            finished_at = now(),
            request_batch_count = $2,
            success_count = $3,
            failed_count = $4,
            diff_summary = $5
        where id = $1
      `,
      [
        runId,
        snapshot.requestBatchCount,
        snapshot.users.length,
        diff.failedUsers,
        JSON.stringify(diff),
      ],
    );
    await writeAudit(pool, {
      requestId: input.requestId,
      actorFeishuUserId: input.actor.feishuUserId,
      action: 'sync.run',
      targetType: 'sync_run',
      targetId: runId,
      result: 'success',
      metadata: { status: 'succeeded', diffSummary: diff },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '飞书同步失败';
    await pool.query(
      `
        update sync_runs
        set status = 'failed',
            finished_at = now(),
            error_message = $2,
            failed_count = 1,
            diff_summary = $3
        where id = $1
      `,
      [runId, message, JSON.stringify(emptyDiff({ failedUsers: 1 }))],
    );
    await writeAudit(pool, {
      requestId: input.requestId,
      actorFeishuUserId: input.actor.feishuUserId,
      action: 'sync.run',
      targetType: 'sync_run',
      targetId: runId,
      result: 'failure',
      metadata: { status: 'failed', reason: message },
    });
  }

  const result = await pool.query('select * from sync_runs where id = $1', [runId]);
  return mapSyncRunRow(result.rows[0]);
}

async function applyDirectorySnapshot(pool: DbPool, snapshot: DirectorySyncSnapshot): Promise<SyncDiffSummary> {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const diff = emptyDiff();
    const departmentIds = new Set(snapshot.departments.map((department) => department.id));

    for (const department of snapshot.departments) {
      await upsertDepartment(client, department, diff);
    }

    const validUsers = snapshot.users.filter((user) => user.feishuUserId && user.name);
    diff.failedUsers += snapshot.users.length - validUsers.length;
    for (const user of validUsers) {
      await upsertUser(client, user, departmentIds, diff);
    }

    if (validUsers.length > 0) {
      const syncedUserIds = validUsers.map((user) => user.feishuUserId);
      const resigned = await client.query(
        `
          update directory_users
          set status = 'resigned', updated_at = now()
          where feishu_user_id <> all($1::text[])
            and status <> 'resigned'
            and department_id is not null
          returning feishu_user_id
        `,
        [syncedUserIds],
      );
      diff.resignedUsers += resigned.rowCount ?? 0;
    }

    await client.query('commit');
    return diff;
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

async function upsertDepartment(client: DbClient, department: DirectoryDepartmentSnapshot, diff: SyncDiffSummary): Promise<void> {
  const existing = await client.query('select name, parent_id, status from directory_departments where id = $1', [department.id]);
  if ((existing.rowCount ?? 0) === 0) {
    diff.createdDepartments += 1;
  } else {
    const row = existing.rows[0];
    if (row.name !== department.name || row.parent_id !== department.parentId || row.status !== (department.status ?? 'active')) {
      diff.updatedDepartments += 1;
    }
  }

  await client.query(
    `
      insert into directory_departments(id, name, parent_id, status, updated_at)
      values ($1, $2, $3, $4, now())
      on conflict (id)
      do update set name = excluded.name,
                    parent_id = excluded.parent_id,
                    status = excluded.status,
                    updated_at = now()
    `,
    [department.id, department.name, department.parentId, department.status ?? 'active'],
  );
}

async function upsertUser(
  client: DbClient,
  user: DirectoryUserSnapshot,
  departmentIds: Set<string>,
  diff: SyncDiffSummary,
): Promise<void> {
  const departmentId = user.departmentId && departmentIds.has(user.departmentId) ? user.departmentId : null;
  const status = user.status ?? 'active';
  const existing = await client.query(
    `
      select fu.name, fu.email, fu.status, du.mobile, du.department_id
      from feishu_users fu
      left join directory_users du on du.feishu_user_id = fu.feishu_user_id
      where fu.feishu_user_id = $1
    `,
    [user.feishuUserId],
  );
  if ((existing.rowCount ?? 0) === 0) {
    diff.createdUsers += 1;
  } else {
    const row = existing.rows[0];
    if (
      row.name !== user.name ||
      row.email !== (user.email ?? null) ||
      row.status !== status ||
      row.mobile !== (user.mobile ?? null) ||
      row.department_id !== departmentId
    ) {
      diff.updatedUsers += 1;
    }
  }

  await client.query(
    `
      insert into feishu_users(feishu_user_id, name, email, status, updated_at)
      values ($1, $2, $3, $4, now())
      on conflict (feishu_user_id)
      do update set name = excluded.name,
                    email = excluded.email,
                    status = excluded.status,
                    updated_at = now()
    `,
    [user.feishuUserId, user.name, user.email ?? null, status],
  );
  await client.query(
    `
      insert into directory_users(feishu_user_id, name, email, mobile, department_id, status, updated_at)
      values ($1, $2, $3, $4, $5, $6, now())
      on conflict (feishu_user_id)
      do update set name = excluded.name,
                    email = excluded.email,
                    mobile = excluded.mobile,
                    department_id = excluded.department_id,
                    status = excluded.status,
                    updated_at = now()
    `,
    [user.feishuUserId, user.name, user.email ?? null, user.mobile ?? null, departmentId, status],
  );
}

function emptyDiff(overrides: Partial<SyncDiffSummary> = {}): SyncDiffSummary {
  return {
    createdUsers: 0,
    updatedUsers: 0,
    resignedUsers: 0,
    failedUsers: 0,
    createdDepartments: 0,
    updatedDepartments: 0,
    ...overrides,
  };
}

function mapSyncRunRow(row: Record<string, unknown>): RuntimeSyncRun {
  return {
    id: String(row.id),
    trigger: row.trigger as RuntimeSyncRun['trigger'],
    status: row.status as RuntimeSyncRun['status'],
    operator_feishu_user_id: String(row.operator_feishu_user_id),
    request_id: String(row.request_id),
    started_at: toIso(row.started_at),
    finished_at: row.finished_at ? toIso(row.finished_at) : null,
    error_message: typeof row.error_message === 'string' ? row.error_message : null,
    request_batch_count: Number(row.request_batch_count ?? 0),
    success_count: Number(row.success_count ?? 0),
    failed_count: Number(row.failed_count ?? 0),
    diff_summary: normalizeDiff(row.diff_summary),
    retry_of: typeof row.retry_of === 'string' ? row.retry_of : null,
  };
}

function normalizeDiff(value: unknown): SyncDiffSummary {
  if (typeof value !== 'object' || value === null) {
    return emptyDiff();
  }
  const record = value as Partial<Record<keyof SyncDiffSummary, unknown>>;
  return {
    createdUsers: Number(record.createdUsers ?? 0),
    updatedUsers: Number(record.updatedUsers ?? 0),
    resignedUsers: Number(record.resignedUsers ?? 0),
    failedUsers: Number(record.failedUsers ?? 0),
    createdDepartments: Number(record.createdDepartments ?? 0),
    updatedDepartments: Number(record.updatedDepartments ?? 0),
  };
}

function toIso(value: unknown): string {
  return value instanceof Date ? value.toISOString() : String(value);
}
