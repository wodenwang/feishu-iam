import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DbPool } from '../src/db/pool';
import { buildTestApp } from './helpers/testApp';
import { createTestPool } from './helpers/testDb';

describe('platform initialization QA regressions', () => {
  let pool: DbPool;
  let app: Awaited<ReturnType<typeof buildTestApp>>;

  beforeEach(async () => {
    pool = await createTestPool();
    app = await buildTestApp(pool);
  });

  afterEach(async () => {
    await app.close();
    await pool.end();
  });

  it('returns 400 instead of 500 for empty JSON POST bodies', async () => {
    // Regression: ISSUE-001 - empty JSON body parser errors were reported as 500.
    // Found by /qa on 2026-05-23.
    // Report: .gstack/qa-reports/qa-report-runtime-api-2026-05-23.md
    const cookie = await loginCookie(app, 'ou_init_regression_001', '初始化回归管理员');

    const response = await app.inject({
      method: 'POST',
      url: '/api/initialization/bind-platform-admin',
      headers: {
        cookie,
        'content-type': 'application/json',
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      code: 'BAD_REQUEST',
      message: '请求格式错误',
    });
    expect(response.json().requestId).toEqual(expect.any(String));
  });
});

async function loginCookie(app: Awaited<ReturnType<typeof buildTestApp>>, feishuUserId: string, name: string) {
  const login = await app.inject({
    method: 'POST',
    url: '/api/dev/feishu/mock-login',
    payload: { feishuUserId, name },
  });
  return String(login.headers['set-cookie']);
}
