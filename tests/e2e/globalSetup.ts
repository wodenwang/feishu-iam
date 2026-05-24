import { runMigrations } from '../../server/src/db/migrate';
import { createPool } from '../../server/src/db/pool';
import { resetDatabase } from '../../server/tests/helpers/testDb';

export default async function globalSetup() {
  if (process.env.E2E_RESET_DATABASE !== 'true') {
    return;
  }

  const databaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('E2E_RESET_DATABASE=true requires TEST_DATABASE_URL or DATABASE_URL');
  }

  const pool = createPool(databaseUrl);
  try {
    await resetDatabase(pool);
    await runMigrations(pool);
  } finally {
    await pool.end();
  }
}
