import { afterEach, describe, expect, it } from 'vitest';
import { runMigrations } from '../src/db/migrate';
import { createPool, type DbPool } from '../src/db/pool';
import { resetDatabase } from './helpers/testDb';

describe('database migrations', () => {
  let pool: DbPool | undefined;

  afterEach(async () => {
    await pool?.end();
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
    expect(result.rows).toEqual([{ version: '001_runtime' }, { version: '002_access_loop' }]);
  });

  it('creates access loop constraints and indexes', async () => {
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
            'idx_directory_users_department_status'
          )
        order by indexname
      `,
    );
    expect(indexes.rows.map((row) => row.indexname)).toEqual([
      'idx_directory_users_department_status',
      'idx_permission_points_app_group_status',
      'idx_role_user_bindings_user',
      'idx_roles_app_status',
    ]);
  });
});
