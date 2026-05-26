import { buildApp } from './app';
import { parseEnv } from './config/env';
import { runMigrations } from './db/migrate';
import { createPool } from './db/pool';
import { LocalMockDirectorySyncAdapter, RealFeishuDirectorySyncAdapter } from './modules/sync/directorySyncAdapter';

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
  directorySyncAdapter:
    config.feishuAuthMode === 'mock'
      ? new LocalMockDirectorySyncAdapter()
      : new RealFeishuDirectorySyncAdapter({ appId: config.feishuAppId ?? '', appSecret: config.feishuAppSecret ?? '' }),
  staticAssetsDir: config.staticAssetsDir,
});

await app.listen({ port: config.port, host: '0.0.0.0' });
