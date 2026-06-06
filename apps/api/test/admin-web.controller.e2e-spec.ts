import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import type { App as SupertestApp } from 'supertest/types';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../src/prisma/prisma.service';

const adminWebIndexHtml = `<!doctype html>
<html lang="zh-CN">
  <head><meta charset="UTF-8" /><title>Feishu IAM 管理后台</title></head>
  <body><div id="root"></div></body>
</html>`;

describe('Admin web static hosting', () => {
  let app: INestApplication;
  let adminWebDistDir: string;
  let previousAdminWebDistDir: string | undefined;

  beforeAll(async () => {
    previousAdminWebDistDir = process.env.FEISHU_IAM_ADMIN_WEB_DIST_DIR;
    adminWebDistDir = mkdtempSync(join(tmpdir(), 'feishu-iam-admin-web-'));
    writeFileSync(join(adminWebDistDir, 'index.html'), adminWebIndexHtml, 'utf8');
    process.env.FEISHU_IAM_ADMIN_WEB_DIST_DIR = adminWebDistDir;

    const { AppModule } = await import('../src/app.module');
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule]
    })
      .overrideProvider(PrismaService)
      .useValue({
        isReady: vi.fn().mockResolvedValue(true),
        $connect: vi.fn(),
        $disconnect: vi.fn()
      })
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();

    if (previousAdminWebDistDir === undefined) {
      delete process.env.FEISHU_IAM_ADMIN_WEB_DIST_DIR;
    } else {
      process.env.FEISHU_IAM_ADMIN_WEB_DIST_DIR = previousAdminWebDistDir;
    }

    rmSync(adminWebDistDir, { force: true, recursive: true });
  });

  it('GET / 返回管理后台 HTML 入口', async () => {
    const response = await request(app.getHttpServer() as SupertestApp).get('/').expect(200);

    expect(response.header['content-type']).toContain('text/html');
    expect(response.text).toContain('<div id="root"></div>');
    expect(response.text).toContain('Feishu IAM 管理后台');
  });

  it('GET /admin 任意前端路由返回管理后台 HTML 入口', async () => {
    const response = await request(app.getHttpServer() as SupertestApp).get('/admin/applications').expect(200);

    expect(response.text).toContain('<div id="root"></div>');
    expect(response.text).toContain('Feishu IAM 管理后台');
  });

  it('GET /health 不被管理端 fallback 覆盖', async () => {
    const response = await request(app.getHttpServer() as SupertestApp).get('/health').expect(200);

    expect(response.body).toMatchObject({
      status: 'ok',
      service: 'feishu-iam-api'
    });
  });
});
