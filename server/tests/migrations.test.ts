import { afterEach, describe, expect, it } from 'vitest';
import { isMigrationFile, runMigrations } from '../src/db/migrate';
import { createPool, type DbPool } from '../src/db/pool';
import { resetDatabase } from './helpers/testDb';

describe('database migrations', () => {
  let pool: DbPool | undefined;

  afterEach(async () => {
    await pool?.end();
  });

  it('ignores macOS metadata and non-numbered files', () => {
    expect(isMigrationFile('001_runtime.sql')).toBe(true);
    expect(isMigrationFile('002_access_loop.sql')).toBe(true);
    expect(isMigrationFile('003_thirdparty_oauth.sql')).toBe(true);
    expect(isMigrationFile('004_oauth_pending_requests.sql')).toBe(true);
    expect(isMigrationFile('005_application_admins.sql')).toBe(true);
    expect(isMigrationFile('006_sync_runs.sql')).toBe(true);
    expect(isMigrationFile('007_sync_ops.sql')).toBe(true);
    expect(isMigrationFile('._001_runtime.sql')).toBe(false);
    expect(isMigrationFile('.DS_Store')).toBe(false);
    expect(isMigrationFile('README.sql')).toBe(false);
  });

  it('can be run concurrently during multi-process startup', async () => {
    const databaseUrl = process.env.TEST_DATABASE_URL;
    if (!databaseUrl) {
      throw new Error('TEST_DATABASE_URL is required for server tests');
    }
    pool = createPool(databaseUrl);
    await resetDatabase(pool);

    await Promise.all([runMigrations(pool), runMigrations(pool)]);

    const result = await pool.query('select version from schema_migrations order by version');
    expect(result.rows).toEqual([
      { version: '001_runtime' },
      { version: '002_access_loop' },
      { version: '003_thirdparty_oauth' },
      { version: '004_oauth_pending_requests' },
      { version: '005_application_admins' },
      { version: '006_sync_runs' },
      { version: '007_sync_ops' },
    ]);
  });

  it('creates access loop and third-party OAuth constraints and indexes', async () => {
    const databaseUrl = process.env.TEST_DATABASE_URL;
    if (!databaseUrl) {
      throw new Error('TEST_DATABASE_URL is required for server tests');
    }
    pool = createPool(databaseUrl);
    await resetDatabase(pool);
    await runMigrations(pool);

    const constraints = await pool.query(
      `
        select conname
        from pg_constraint
        where conname in (
          'permission_groups_application_id_code_key',
          'permission_points_application_id_code_key',
          'roles_application_id_code_key'
        )
        order by conname
      `,
    );
    expect(constraints.rows.map((row) => row.conname)).toEqual([
      'permission_groups_application_id_code_key',
      'permission_points_application_id_code_key',
      'roles_application_id_code_key',
    ]);

    const indexes = await pool.query(
      `
        select indexname
        from pg_indexes
        where schemaname = 'public'
          and indexname in (
            'idx_permission_points_app_group_status',
            'idx_roles_app_status',
            'idx_role_user_bindings_user',
            'idx_directory_users_department_status',
            'idx_application_oauth_codes_expiry',
            'idx_application_oauth_sessions_expiry',
            'idx_application_oauth_pending_expiry',
            'idx_application_admins_user',
            'idx_sync_runs_started_at',
            'idx_sync_runs_operator_type'
          )
        order by indexname
      `,
    );
    expect(indexes.rows.map((row) => row.indexname)).toEqual([
      'idx_application_admins_user',
      'idx_application_oauth_codes_expiry',
      'idx_application_oauth_pending_expiry',
      'idx_application_oauth_sessions_expiry',
      'idx_directory_users_department_status',
      'idx_permission_points_app_group_status',
      'idx_role_user_bindings_user',
      'idx_roles_app_status',
      'idx_sync_runs_operator_type',
      'idx_sync_runs_started_at',
    ]);

    const syncRunColumns = await pool.query(
      `
        select column_name, is_nullable, column_default
        from information_schema.columns
        where table_name = 'sync_runs'
          and column_name in ('operator_type', 'operator_feishu_user_id')
        order by column_name
      `,
    );
    expect(syncRunColumns.rows).toEqual([
      { column_name: 'operator_feishu_user_id', is_nullable: 'YES', column_default: null },
      { column_name: 'operator_type', is_nullable: 'NO', column_default: "'feishu_user'::text" },
    ]);

    const syncRunConstraints = await pool.query(
      `
        select conname
        from pg_constraint
        where conname in ('sync_runs_operator_type_check', 'sync_runs_operator_consistency_check')
        order by conname
      `,
    );
    expect(syncRunConstraints.rows.map((row) => row.conname)).toEqual([
      'sync_runs_operator_consistency_check',
      'sync_runs_operator_type_check',
    ]);
  });
});
