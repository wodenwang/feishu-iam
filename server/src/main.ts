import { buildApp } from './app';
import { parseEnv } from './config/env';
import { runMigrations } from './db/migrate';
import { createPool } from './db/pool';

const config = parseEnv(process.env);
const pool = createPool(config.databaseUrl);
await runMigrations(pool);

const app = await buildApp({
  pool,
  sessionCookieName: config.sessionCookieName,
  allowMockLogin: config.feishuAuthMode === 'mock',
});

await app.listen({ port: config.port, host: '0.0.0.0' });
