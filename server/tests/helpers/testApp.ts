import { buildApp } from '../../src/app';
import type { DbPool } from '../../src/db/pool';
import type { FeishuAuthAdapter } from '../../src/modules/auth/feishuAuthAdapter';

export async function buildTestApp(
  pool: DbPool,
  options: {
    staticAssetsDir?: string;
    allowMockLogin?: boolean;
    secureCookies?: boolean;
    feishuRedirectUri?: string;
    feishuAuthAdapter?: FeishuAuthAdapter;
  } = {},
) {
  return buildApp({
    pool,
    sessionCookieName: 'iam_session',
    allowMockLogin: options.allowMockLogin ?? true,
    secureCookies: options.secureCookies,
    feishuRedirectUri: options.feishuRedirectUri,
    feishuAuthAdapter: options.feishuAuthAdapter,
    staticAssetsDir: options.staticAssetsDir,
  });
}
