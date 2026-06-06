import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App as SupertestApp } from 'supertest/types';
import { afterAll, beforeAll, describe, it, vi } from 'vitest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('基础健康检查', () => {
  let app: INestApplication;

  beforeAll(async () => {
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
  });

  it('GET /health 返回 API 进程健康', async () => {
    const httpServer = app.getHttpServer() as SupertestApp;

    await request(httpServer)
      .get('/health')
      .expect(200)
      .expect({
        status: 'ok',
        service: 'feishu-iam-api'
      });
  });

  it('GET /ready 返回数据库就绪状态', async () => {
    const httpServer = app.getHttpServer() as SupertestApp;

    await request(httpServer)
      .get('/ready')
      .expect(200)
      .expect({
        status: 'ready',
        checks: {
          database: 'ok'
        }
      });
  });
});
