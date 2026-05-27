import { buildApp } from './app';
import { parseEnv } from './config/env';
import { runMigrations } from './db/migrate';
import { createPool } from './db/pool';
import { LocalMockDirectorySyncAdapter, RealFeishuDirectorySyncAdapter } from './modules/sync/directorySyncAdapter';
import { createSyncScheduler } from './modules/sync/syncScheduler';

const config = parseEnv(process.env);
const pool = createPool(config.databaseUrl);
await runMigrations(pool);
const directorySyncAdapter =
  config.feishuAuthMode === 'mock'
    ? new LocalMockDirectorySyncAdapter()
    : new RealFeishuDirectorySyncAdapter({ appId: config.feishuAppId ?? '', appSecret: config.feishuAppSecret ?? '' });

const app = await buildApp({
  pool,
  sessionCookieName: config.sessionCookieName,
  allowMockLogin: config.feishuAuthMode === 'mock',
  secureCookies: config.nodeEnv === 'production',
  feishuAppId: config.feishuAppId,
  feishuAppSecret: config.feishuAppSecret,
  feishuRedirectUri: config.feishuRedirectUri,
  directorySyncAdapter,
  feishuEventVerificationToken: config.feishuEventVerificationToken,
  feishuEventEncryptKey: config.feishuEventEncryptKey,
  staticAssetsDir: config.staticAssetsDir,
});
const syncScheduler = createSyncScheduler(pool, directorySyncAdapter, {
  enabled: config.syncScheduleEnabled,
  intervalMinutes: config.syncScheduleIntervalMinutes,
  startDelaySeconds: config.syncScheduleStartDelaySeconds,
});
syncScheduler.start();

await app.listen({ port: config.port, host: '0.0.0.0' });

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    syncScheduler.stop();
    void app.close().finally(() => {
      void pool.end();
    });
  });
}
