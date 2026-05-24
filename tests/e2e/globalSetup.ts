import { runMigrations } from '../../server/src/db/migrate';
import { createPool } from '../../server/src/db/pool';
import { resetDatabase } from '../../server/tests/helpers/testDb';

export default async function globalSetup() {
  const databaseUrl = process.env.DATABASE_URL ?? process.env.TEST_DATABASE_URL;
  if (!databaseUrl) {
    return;
  }

  const pool = createPool(databaseUrl);
  try {
    await resetDatabase(pool);
    await runMigrations(pool);
  } finally {
    await pool.end();
  }
}
