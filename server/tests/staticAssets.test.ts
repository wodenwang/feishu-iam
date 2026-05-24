import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DbPool } from '../src/db/pool';
import { buildTestApp } from './helpers/testApp';
import { createTestPool } from './helpers/testDb';

describe('static frontend assets', () => {
  let pool: DbPool;
  let app: Awaited<ReturnType<typeof buildTestApp>>;
  let assetsDir: string;

  beforeEach(async () => {
    pool = await createTestPool();
    assetsDir = await mkdtemp(path.join(os.tmpdir(), 'feishu-iam-static-'));
    await mkdir(path.join(assetsDir, 'assets'));
    await writeFile(path.join(assetsDir, 'index.html'), '<html><body>feishu iam shell</body></html>');
    await writeFile(path.join(assetsDir, 'assets', 'app.js'), 'console.log("feishu-iam");');
    app = await buildTestApp(pool, { staticAssetsDir: assetsDir });
  });

  afterEach(async () => {
    await app.close();
    await pool.end();
    await rm(assetsDir, { recursive: true, force: true });
  });

  it('keeps API routes available when static serving is enabled', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true });
  });

  it('serves Vite assets from the static assets directory', async () => {
    const response = await app.inject({ method: 'GET', url: '/assets/app.js' });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/javascript');
    expect(response.body).toContain('feishu-iam');
  });

  it('falls back to index.html for frontend routes', async () => {
    const response = await app.inject({ method: 'GET', url: '/login' });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/html');
    expect(response.body).toContain('feishu iam shell');
  });

  it('does not serve frontend html for missing API routes', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/missing' });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ code: 'NOT_FOUND', message: '资源不存在' });
    expect(response.body).not.toContain('feishu iam shell');
  });
});
