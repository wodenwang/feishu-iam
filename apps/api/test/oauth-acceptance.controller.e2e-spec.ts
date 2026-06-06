import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App as SupertestApp } from 'supertest/types';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AcceptanceModule } from '../src/acceptance/acceptance.module';

describe('OAuth acceptance callback', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AcceptanceModule]
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('展示授权码和 state，便于人工复制换 token', async () => {
    const response = await request(app.getHttpServer() as SupertestApp)
      .get('/acceptance/oauth/callback?code=code-123&state=state-123')
      .expect(200);

    expect(response.header['content-type']).toContain('text/html');
    expect(response.header['cache-control']).toBe('no-store');
    expect(response.text).toContain('code-123');
    expect(response.text).toContain('state-123');
    expect(response.text).not.toContain('access_token');
  });

  it('转义 query 参数，避免验收页执行注入脚本', async () => {
    const response = await request(app.getHttpServer() as SupertestApp)
      .get('/acceptance/oauth/callback?code=%3Cscript%3Ealert(1)%3C%2Fscript%3E&state=s')
      .expect(200);

    expect(response.text).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(response.text).not.toContain('<script>alert(1)</script>');
  });

  it('重复 query 参数时稳定使用第一个字符串值', async () => {
    const response = await request(app.getHttpServer() as SupertestApp)
      .get('/acceptance/oauth/callback?code=first-code&code=second-code&state=first-state&state=second-state')
      .expect(200);

    expect(response.text).toContain('first-code');
    expect(response.text).toContain('first-state');
    expect(response.text).not.toContain('second-code');
    expect(response.text).not.toContain('second-state');
  });

  it('转义 &, 双引号和单引号', async () => {
    const response = await request(app.getHttpServer() as SupertestApp)
      .get('/acceptance/oauth/callback?code=a%26b%22c%27d&state=x%26y%22z%27w')
      .expect(200);

    expect(response.text).toContain('a&amp;b&quot;c&#39;d');
    expect(response.text).toContain('x&amp;y&quot;z&#39;w');
    expect(response.text).not.toContain("a&b\"c'd");
    expect(response.text).not.toContain("x&y\"z'w");
  });
});
