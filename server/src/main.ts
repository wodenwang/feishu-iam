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
  secureCookies: config.nodeEnv === 'production',
  feishuAppId: config.feishuAppId,
  feishuAppSecret: config.feishuAppSecret,
  feishuRedirectUri: config.feishuRedirectUri,
  staticAssetsDir: config.staticAssetsDir,
});

await app.listen({ port: config.port, host: '0.0.0.0' });
