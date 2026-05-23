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
    expect(result.rows).toEqual([{ version: '001_runtime' }]);
  });
});
