import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DbPool } from './pool';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(dirname, 'migrations');

export async function runMigrations(pool: DbPool): Promise<void> {
  const files = (await fs.readdir(migrationsDir)).filter((file) => file.endsWith('.sql')).sort();
  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query("select pg_advisory_xact_lock(hashtext('feishu_iam_schema_migrations'))");
    await client.query(`
      create table if not exists schema_migrations (
        version text primary key,
        applied_at timestamptz not null default now()
      )
    `);

    for (const file of files) {
      const version = file.replace('.sql', '');
      const existing = await client.query('select version from schema_migrations where version = $1', [version]);
      if (existing.rowCount === 0) {
        const sql = await fs.readFile(path.join(migrationsDir, file), 'utf8');
        await client.query(sql);
        await client.query('insert into schema_migrations(version) values ($1) on conflict do nothing', [version]);
      }
    }

    await client.query('commit');
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}
