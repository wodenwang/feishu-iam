import { runMigrations } from '../../src/db/migrate';
import { createPool, type DbPool } from '../../src/db/pool';

export async function createTestPool(): Promise<DbPool> {
  const databaseUrl = process.env.TEST_DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('TEST_DATABASE_URL is required for server tests');
  }
  const pool = createPool(databaseUrl);
  await resetDatabase(pool);
  await runMigrations(pool);
  return pool;
}

export async function resetDatabase(pool: DbPool): Promise<void> {
  await pool.query(`
    drop table if exists sync_runs cascade;
    drop table if exists application_oauth_sessions cascade;
    drop table if exists application_oauth_authorization_codes cascade;
    drop table if exists application_oauth_pending_requests cascade;
    drop table if exists application_oauth_redirect_uris cascade;
    drop table if exists application_admins cascade;
    drop table if exists application_api_nonces cascade;
    drop table if exists role_user_bindings cascade;
    drop table if exists role_department_bindings cascade;
    drop table if exists role_permission_points cascade;
    drop table if exists roles cascade;
    drop table if exists permission_points cascade;
    drop table if exists permission_groups cascade;
    drop table if exists application_api_credentials cascade;
    drop table if exists directory_users cascade;
    drop table if exists directory_departments cascade;
    drop table if exists audit_logs cascade;
    drop table if exists application_secrets cascade;
    drop table if exists applications cascade;
    drop table if exists iam_sessions cascade;
    drop table if exists platform_admins cascade;
    drop table if exists feishu_users cascade;
    drop table if exists schema_migrations cascade;
  `);
}
