import { buildApp } from '../../src/app';
import type { DbPool } from '../../src/db/pool';
import type { FeishuAuthAdapter } from '../../src/modules/auth/feishuAuthAdapter';
import type { DirectorySyncAdapter } from '../../src/modules/sync/directorySyncAdapter';
import type { SyncEventConfig } from '../../src/modules/sync/syncEventService';

export async function buildTestApp(
  pool: DbPool,
  options: {
    staticAssetsDir?: string;
    allowMockLogin?: boolean;
    secureCookies?: boolean;
    feishuRedirectUri?: string;
    feishuAuthAdapter?: FeishuAuthAdapter;
    directorySyncAdapter?: DirectorySyncAdapter;
    syncEventConfig?: SyncEventConfig;
  } = {},
) {
  return buildApp({
    pool,
    sessionCookieName: 'iam_session',
    allowMockLogin: options.allowMockLogin ?? true,
    secureCookies: options.secureCookies,
    feishuRedirectUri: options.feishuRedirectUri,
    feishuAuthAdapter: options.feishuAuthAdapter,
    feishuEventVerificationToken: options.syncEventConfig?.verificationToken,
    feishuEventEncryptKey: options.syncEventConfig?.encryptKey,
    directorySyncAdapter: options.directorySyncAdapter ?? {
      async preflight() {
        return {
          status: 'passed',
          checkedAt: new Date().toISOString(),
          requestBatchCount: 0,
          stages: [
            { name: 'token', status: 'passed' },
            { name: 'departments', status: 'passed' },
            { name: 'users', status: 'passed' },
          ],
        };
      },
      async fetchDirectorySnapshot() {
        return { departments: [], users: [], requestBatchCount: 0 };
      },
    },
    staticAssetsDir: options.staticAssetsDir,
  });
}
