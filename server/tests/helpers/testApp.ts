import { buildApp } from '../../src/app';
import type { DbPool } from '../../src/db/pool';

export async function buildTestApp(pool: DbPool, options: { staticAssetsDir?: string } = {}) {
  return buildApp({
    pool,
    sessionCookieName: 'iam_session',
    allowMockLogin: true,
    staticAssetsDir: options.staticAssetsDir,
  });
}
