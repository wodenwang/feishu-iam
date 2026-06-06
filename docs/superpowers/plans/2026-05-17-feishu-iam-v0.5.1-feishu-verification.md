# Feishu IAM v0.5.1 飞书验证闭环 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 Feishu IAM 部署到 `192.168.2.112:3000`，并完成管理后台飞书登录、通讯录同步和第三方 SSO 主链路的真实验证闭环。

**Architecture:** 继续保持单 API 容器加 PostgreSQL 的 Docker Compose 部署形态，由 API 容器同源托管管理后台静态资源，减少 CORS 和 cookie 风险。新增一个只读的 OAuth 验收回调页用于接收授权码；部署真实配置通过服务器本地 `.env` 注入，仓库只保存模板、脚本和验收文档。

**Tech Stack:** NestJS、Express adapter、React + Vite、PostgreSQL、Prisma、Docker Compose、Vitest、Supertest、shell、curl。

---

## 文件结构

后端新增：

- `apps/api/src/admin-web/admin-web.controller.ts`：同源托管 `apps/admin-web/dist/index.html`，让 `/` 和管理端前端路由返回管理后台入口。
- `apps/api/src/admin-web/admin-web.module.ts`：封装管理端静态资源模块。
- `apps/api/src/acceptance/oauth-acceptance.controller.ts`：提供 `/acceptance/oauth/callback`，展示授权码和 state，供 v0.5.1 人工验收使用。
- `apps/api/src/acceptance/acceptance.module.ts`：封装验收辅助模块。
- `apps/api/test/admin-web.controller.e2e-spec.ts`：验证静态资源、前端路由和 API 路由不被前端 fallback 吞掉。
- `apps/api/test/oauth-acceptance.controller.e2e-spec.ts`：验证验收回调页转义输出，不保存、不发 token、不暴露敏感值。

后端修改：

- `apps/api/src/app.module.ts`：导入 `AdminWebModule` 和 `AcceptanceModule`。
- `apps/api/src/main.ts`：配置静态资源目录 `apps/admin-web/dist`，保持 CORS 可由 `ADMIN_WEB_BASE_URL` 控制。
- `apps/api/src/version/version.controller.ts`：默认版本更新为 `0.5.1-dev`。
- `package.json`、`apps/api/package.json`、`apps/admin-web/package.json`：版本更新到 `0.5.1`。

部署修改：

- `deploy/docker-compose.yml`：改为服务器可配置 Compose，端口、数据库密码、Base URL、飞书回调、版本号、commit 均由 `.env` 注入。
- `deploy/server.env.example`：新增服务器 `.env` 模板，全部使用占位值。
- `deploy/upgrade.sh`：读取 `FEISHU_IAM_PUBLIC_URL` 或默认 `http://localhost:3000` 做 readiness 检查，适配内网服务器验收。

文档新增和修改：

- `docs/deploy-v0.5.1.md`：内网服务器 Docker Compose 部署说明。
- `docs/acceptance/v0.5.1-feishu-verification.md`：真实飞书验证闭环 checklist。
- `README.md`：补充 v0.5.1 版本状态和服务器验收入口。
- `AGENTS.md`：当前阶段更新为 v0.5.1。
- `docs/codex-sessions/YYYY-MM-DD-HHMM-v0.5.1-实施计划.md`：归档实施计划会话。

## Task 1: 同源托管管理后台静态资源

**Files:**
- Create: `apps/api/src/admin-web/admin-web.controller.ts`
- Create: `apps/api/src/admin-web/admin-web.module.ts`
- Modify: `apps/api/src/app.module.ts`
- Modify: `apps/api/src/main.ts`
- Test: `apps/api/test/admin-web.controller.e2e-spec.ts`

- [ ] **Step 1: 写失败测试**

Create `apps/api/test/admin-web.controller.e2e-spec.ts`:

```ts
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App as SupertestApp } from 'supertest/types';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Admin web static hosting', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule]
    })
      .overrideProvider(PrismaService)
      .useValue({
        isReady: async () => true,
        $connect: async () => undefined,
        $disconnect: async () => undefined
      })
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
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
  });

  it('GET /health 不被管理端 fallback 覆盖', async () => {
    const response = await request(app.getHttpServer() as SupertestApp).get('/health').expect(200);

    expect(response.body).toMatchObject({
      status: 'ok',
      service: 'feishu-iam-api'
    });
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
pnpm --filter @feishu-iam/api test -- admin-web.controller.e2e-spec.ts
```

Expected: FAIL，`GET /` 返回 404 或不是管理后台 HTML。

- [ ] **Step 3: 新增 AdminWeb 模块和 controller**

Create `apps/api/src/admin-web/admin-web.controller.ts`:

```ts
import { Controller, Get, Header, Res } from '@nestjs/common';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Response } from 'express';

const ADMIN_WEB_DIST_DIR = join(process.cwd(), 'apps/admin-web/dist');
const ADMIN_WEB_INDEX = join(ADMIN_WEB_DIST_DIR, 'index.html');

@Controller()
export class AdminWebController {
  @Get(['/', '/admin', '/admin/*'])
  @Header('content-type', 'text/html; charset=utf-8')
  getIndex(@Res() response: Response): void {
    if (!existsSync(ADMIN_WEB_INDEX)) {
      response.status(503).send(renderMissingAdminWebPage());
      return;
    }

    response.status(200).send(readFileSync(ADMIN_WEB_INDEX, 'utf8'));
  }
}

export function getAdminWebDistDir(): string {
  return ADMIN_WEB_DIST_DIR;
}

function renderMissingAdminWebPage(): string {
  return `<!doctype html>
<html lang="zh-CN">
  <head><meta charset="utf-8" /><title>Feishu IAM 管理后台未构建</title></head>
  <body><h1>Feishu IAM 管理后台未构建</h1><p>请先运行管理端构建或使用 Docker Compose 镜像。</p></body>
</html>`;
}
```

Create `apps/api/src/admin-web/admin-web.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { AdminWebController } from './admin-web.controller';

@Module({
  controllers: [AdminWebController]
})
export class AdminWebModule {}
```

- [ ] **Step 4: 在 AppModule 导入 AdminWebModule**

Modify `apps/api/src/app.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { AdminModule } from './admin/admin.module';
import { AdminWebModule } from './admin-web/admin-web.module';
import { FeishuModule } from './feishu/feishu.module';
import { HealthController } from './health/health.controller';
import { OauthModule } from './oauth/oauth.module';
import { PermissionModule } from './permission/permission.module';
import { PrismaModule } from './prisma/prisma.module';
import { VersionController } from './version/version.controller';

@Module({
  imports: [PrismaModule, FeishuModule, PermissionModule, OauthModule, AdminModule, AdminWebModule],
  controllers: [HealthController, VersionController]
})
export class AppModule {}
```

- [ ] **Step 5: 配置静态资源目录**

Modify `apps/api/src/main.ts`:

```ts
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { getAdminWebDistDir } from './admin-web/admin-web.controller';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.enableCors({
    origin: process.env.ADMIN_WEB_BASE_URL ?? 'http://localhost:5173',
    credentials: true
  });
  app.useStaticAssets(getAdminWebDistDir());

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port, '0.0.0.0');
}

void bootstrap();
```

- [ ] **Step 6: 运行测试确认通过**

Run:

```bash
pnpm --filter @feishu-iam/api test -- admin-web.controller.e2e-spec.ts
```

Expected: PASS，3 个用例全部通过。

- [ ] **Step 7: 提交**

```bash
git add apps/api/src/admin-web apps/api/src/app.module.ts apps/api/src/main.ts apps/api/test/admin-web.controller.e2e-spec.ts
git commit -m "feat: serve admin web from api"
```

## Task 2: 增加 OAuth 验收辅助回调页

**Files:**
- Create: `apps/api/src/acceptance/oauth-acceptance.controller.ts`
- Create: `apps/api/src/acceptance/acceptance.module.ts`
- Modify: `apps/api/src/app.module.ts`
- Test: `apps/api/test/oauth-acceptance.controller.e2e-spec.ts`

- [ ] **Step 1: 写失败测试**

Create `apps/api/test/oauth-acceptance.controller.e2e-spec.ts`:

```ts
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
});
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
pnpm --filter @feishu-iam/api test -- oauth-acceptance.controller.e2e-spec.ts
```

Expected: FAIL，`AcceptanceModule` 不存在。

- [ ] **Step 3: 新增验收辅助 controller**

Create `apps/api/src/acceptance/oauth-acceptance.controller.ts`:

```ts
import { Controller, Get, Header, Query } from '@nestjs/common';

@Controller('/acceptance/oauth')
export class OauthAcceptanceController {
  @Get('/callback')
  @Header('content-type', 'text/html; charset=utf-8')
  callback(@Query('code') code: string | undefined, @Query('state') state: string | undefined): string {
    return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Feishu IAM OAuth 验收回调</title>
    <style>
      body { margin: 0; padding: 32px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f4f7f6; color: #18212f; }
      main { max-width: 760px; margin: 0 auto; padding: 24px; background: #fff; border: 1px solid #d9e1ea; border-top: 4px solid #168a60; border-radius: 8px; }
      h1 { margin: 0 0 16px; font-size: 22px; }
      p { color: #526172; line-height: 1.6; }
      dl { display: grid; gap: 12px; }
      dt { font-weight: 800; }
      dd { margin: 0; padding: 12px; border: 1px solid #d9e1ea; border-radius: 6px; background: #f8fafb; word-break: break-all; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
    </style>
  </head>
  <body>
    <main>
      <h1>Feishu IAM OAuth 验收回调</h1>
      <p>本页面只显示授权码和 state，供验收人员手工调用 /oauth/token。页面不保存授权码，不发 token，不展示 client secret。</p>
      <dl>
        <dt>code</dt>
        <dd>${escapeHtml(code ?? '')}</dd>
        <dt>state</dt>
        <dd>${escapeHtml(state ?? '')}</dd>
      </dl>
    </main>
  </body>
</html>`;
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
```

Create `apps/api/src/acceptance/acceptance.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { OauthAcceptanceController } from './oauth-acceptance.controller';

@Module({
  controllers: [OauthAcceptanceController]
})
export class AcceptanceModule {}
```

- [ ] **Step 4: 在 AppModule 导入 AcceptanceModule**

Modify `apps/api/src/app.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { AcceptanceModule } from './acceptance/acceptance.module';
import { AdminModule } from './admin/admin.module';
import { AdminWebModule } from './admin-web/admin-web.module';
import { FeishuModule } from './feishu/feishu.module';
import { HealthController } from './health/health.controller';
import { OauthModule } from './oauth/oauth.module';
import { PermissionModule } from './permission/permission.module';
import { PrismaModule } from './prisma/prisma.module';
import { VersionController } from './version/version.controller';

@Module({
  imports: [PrismaModule, FeishuModule, PermissionModule, OauthModule, AdminModule, AdminWebModule, AcceptanceModule],
  controllers: [HealthController, VersionController]
})
export class AppModule {}
```

- [ ] **Step 5: 运行测试确认通过**

Run:

```bash
pnpm --filter @feishu-iam/api test -- oauth-acceptance.controller.e2e-spec.ts
```

Expected: PASS，2 个用例全部通过。

- [ ] **Step 6: 提交**

```bash
git add apps/api/src/acceptance apps/api/src/app.module.ts apps/api/test/oauth-acceptance.controller.e2e-spec.ts
git commit -m "feat: add oauth acceptance callback"
```

## Task 3: 服务器化 Docker Compose 配置

**Files:**
- Modify: `deploy/docker-compose.yml`
- Modify: `deploy/upgrade.sh`
- Create: `deploy/server.env.example`
- Test: Compose 配置校验

- [ ] **Step 1: 写 Compose 期望检查命令**

Run before editing:

```bash
docker compose --env-file deploy/server.env.example -f deploy/docker-compose.yml config --quiet
```

Expected: FAIL because `deploy/server.env.example` does not exist.

- [ ] **Step 2: 新增服务器环境模板**

Create `deploy/server.env.example`:

```dotenv
COMPOSE_PROJECT_NAME=feishu-iam
PORT=3000
FEISHU_IAM_PUBLIC_URL=http://192.168.2.112:3000

POSTGRES_DB=feishu_iam
POSTGRES_USER=feishu_iam
POSTGRES_PASSWORD=replace-with-strong-postgres-password
DATABASE_URL=postgresql://feishu_iam:replace-with-strong-postgres-password@postgres:5432/feishu_iam?schema=public

ADMIN_WEB_BASE_URL=http://192.168.2.112:3000
PLATFORM_ADMIN_TOKEN=replace-with-random-platform-token
BOOTSTRAP_SUPER_ADMIN_USERNAME=admin
BOOTSTRAP_SUPER_ADMIN_PASSWORD_HASH=sha256:replace-with-password-sha256-hex

FEISHU_APP_ID=cli_replace_me
FEISHU_APP_SECRET=replace-with-feishu-app-secret
FEISHU_OAUTH_REDIRECT_URI=http://192.168.2.112:3000/oauth/feishu/callback
FEISHU_ADMIN_OAUTH_REDIRECT_URI=http://192.168.2.112:3000/admin/auth/feishu/callback

APP_VERSION=0.5.1
GIT_COMMIT=local
```

- [ ] **Step 3: 修改 Compose 使用环境变量**

Update `deploy/docker-compose.yml`:

```yaml
services:
  postgres:
    image: postgres:16-alpine
    container_name: feishu-iam-postgres
    environment:
      POSTGRES_DB: ${POSTGRES_DB:-feishu_iam}
      POSTGRES_USER: ${POSTGRES_USER:-feishu_iam}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-feishu_iam_dev}
    ports:
      - "5432:5432"
    volumes:
      - feishu_iam_pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $${POSTGRES_USER:-feishu_iam} -d $${POSTGRES_DB:-feishu_iam}"]
      interval: 5s
      timeout: 3s
      retries: 20

  api:
    build:
      context: ..
      dockerfile: deploy/api.Dockerfile
    container_name: feishu-iam-api
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      NODE_ENV: production
      PORT: ${PORT:-3000}
      DATABASE_URL: ${DATABASE_URL:-postgresql://feishu_iam:feishu_iam_dev@postgres:5432/feishu_iam?schema=public}
      ADMIN_WEB_BASE_URL: ${ADMIN_WEB_BASE_URL:-http://localhost:3000}
      PLATFORM_ADMIN_TOKEN: ${PLATFORM_ADMIN_TOKEN:-}
      BOOTSTRAP_SUPER_ADMIN_USERNAME: ${BOOTSTRAP_SUPER_ADMIN_USERNAME:-}
      BOOTSTRAP_SUPER_ADMIN_PASSWORD_HASH: ${BOOTSTRAP_SUPER_ADMIN_PASSWORD_HASH:-}
      FEISHU_APP_ID: ${FEISHU_APP_ID:-}
      FEISHU_APP_SECRET: ${FEISHU_APP_SECRET:-}
      FEISHU_OAUTH_REDIRECT_URI: ${FEISHU_OAUTH_REDIRECT_URI:-}
      FEISHU_ADMIN_OAUTH_REDIRECT_URI: ${FEISHU_ADMIN_OAUTH_REDIRECT_URI:-}
      APP_VERSION: ${APP_VERSION:-0.5.1}
      GIT_COMMIT: ${GIT_COMMIT:-local}
    ports:
      - "${PORT:-3000}:${PORT:-3000}"

volumes:
  feishu_iam_pgdata:
```

- [ ] **Step 4: 修改 upgrade readiness URL**

Modify the readiness section in `deploy/upgrade.sh`:

```bash
PUBLIC_URL="${FEISHU_IAM_PUBLIC_URL:-http://localhost:3000}"

echo "==> Checking readiness at ${PUBLIC_URL}/ready"
for i in {1..60}; do
  if curl -fsS "${PUBLIC_URL}/ready" >/dev/null; then
    echo "==> Feishu IAM is ready"
    exit 0
  fi
  sleep 2
done
```

- [ ] **Step 5: 校验 Compose 配置**

Run:

```bash
docker compose --env-file deploy/server.env.example -f deploy/docker-compose.yml config --quiet
```

Expected: PASS with no output.

- [ ] **Step 6: 提交**

```bash
git add deploy/docker-compose.yml deploy/upgrade.sh deploy/server.env.example
git commit -m "chore: prepare compose for v0.5.1 server deployment"
```

## Task 4: 版本号与运行时版本一致性

**Files:**
- Modify: `package.json`
- Modify: `apps/api/package.json`
- Modify: `apps/admin-web/package.json`
- Modify: `apps/api/src/version/version.controller.ts`
- Test: `apps/api/test/version.controller.e2e-spec.ts`

- [ ] **Step 1: 写版本测试**

Create `apps/api/test/version.controller.e2e-spec.ts`:

```ts
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App as SupertestApp } from 'supertest/types';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { VersionController } from '../src/version/version.controller';

describe('VersionController', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [VersionController]
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('默认开发版本为 0.5.1-dev', async () => {
    const originalVersion = process.env.APP_VERSION;
    delete process.env.APP_VERSION;

    const response = await request(app.getHttpServer() as SupertestApp).get('/version').expect(200);

    expect(response.body.version).toBe('0.5.1-dev');

    if (originalVersion) {
      process.env.APP_VERSION = originalVersion;
    }
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
pnpm --filter @feishu-iam/api test -- version.controller.e2e-spec.ts
```

Expected: FAIL，当前默认版本仍是旧版本。

- [ ] **Step 3: 更新 package 版本**

Set these fields to `0.5.1`:

```json
{
  "version": "0.5.1"
}
```

Files:

```text
package.json
apps/api/package.json
apps/admin-web/package.json
```

- [ ] **Step 4: 更新 VersionController 默认值**

Modify `apps/api/src/version/version.controller.ts`:

```ts
import { Controller, Get } from '@nestjs/common';

@Controller()
export class VersionController {
  @Get('/version')
  getVersion(): { name: string; version: string; commit: string; node_env: string } {
    return {
      name: 'feishu-iam-api',
      version: process.env.APP_VERSION ?? '0.5.1-dev',
      commit: process.env.GIT_COMMIT ?? 'local',
      node_env: process.env.NODE_ENV ?? 'development'
    };
  }
}
```

- [ ] **Step 5: 运行版本测试**

Run:

```bash
pnpm --filter @feishu-iam/api test -- version.controller.e2e-spec.ts
```

Expected: PASS。

- [ ] **Step 6: 提交**

```bash
git add package.json apps/api/package.json apps/admin-web/package.json apps/api/src/version/version.controller.ts apps/api/test/version.controller.e2e-spec.ts
git commit -m "chore: bump version to 0.5.1"
```

## Task 5: 部署与验收文档

**Files:**
- Create: `docs/deploy-v0.5.1.md`
- Create: `docs/acceptance/v0.5.1-feishu-verification.md`
- Modify: `README.md`
- Modify: `AGENTS.md`
- Test: 文档占位符和敏感信息扫描

- [ ] **Step 1: 新增部署文档**

Create `docs/deploy-v0.5.1.md`:

```md
# Feishu IAM v0.5.1 内网服务器部署

本文说明如何把 Feishu IAM 通过 Docker Compose 部署到 `192.168.2.112:3000`。文档只记录配置项名称和占位值，不记录真实密码、token、cookie、client secret 或飞书 app secret。

## 服务器信息

- 服务器地址：`192.168.2.112`
- 部署用户：`dev`
- 部署目录：`~/feishu-iam`
- 访问地址：`http://192.168.2.112:3000`
- 部署方式：Docker Compose

## 飞书回调地址

需要在企业级飞书自建应用中登记：

```text
http://192.168.2.112:3000/admin/auth/feishu/callback
http://192.168.2.112:3000/oauth/feishu/callback
```

## 首次部署

```bash
ssh dev@192.168.2.112
mkdir -p ~/feishu-iam
cd ~/feishu-iam
```

把仓库同步到该目录后，复制服务器环境模板：

```bash
cp deploy/server.env.example .env
chmod 600 .env
```

编辑 `.env`，填入服务器本地真实值。真实值只保存在服务器，不提交到 Git。

启动：

```bash
set -a
source .env
set +a
bash deploy/apply-migrations.sh
docker compose --env-file .env -f deploy/docker-compose.yml up -d --build api
```

## 健康检查

```bash
curl -fsS http://192.168.2.112:3000/health
curl -fsS http://192.168.2.112:3000/ready
curl -fsS http://192.168.2.112:3000/version
```

`/version` 应返回 `0.5.1`。

## 日志和重启

```bash
docker compose --env-file .env -f deploy/docker-compose.yml ps
docker compose --env-file .env -f deploy/docker-compose.yml logs -f api
docker compose --env-file .env -f deploy/docker-compose.yml restart api
```

## 数据保留

PostgreSQL 数据保存在 Docker volume `feishu_iam_pgdata`。不要执行 `docker compose down -v`，除非用户明确要求清空数据。
```

- [ ] **Step 2: 新增验收文档**

Create `docs/acceptance/v0.5.1-feishu-verification.md`:

```md
# Feishu IAM v0.5.1 飞书验证闭环验收

本文记录 `v0.5.1` 的真实验收路径。不要在本文写入服务器密码、飞书密钥、平台 token、client secret、cookie 或 access token。

## 1. 基础服务

```bash
curl -fsS http://192.168.2.112:3000/health
curl -fsS http://192.168.2.112:3000/ready
curl -fsS http://192.168.2.112:3000/version
```

成功标准：

- `/health` 返回 `status=ok`。
- `/ready` 返回 `status=ready`。
- `/version` 返回 `version=0.5.1`。

## 2. 飞书通讯录同步

使用管理后台或平台 API 验证：

- 飞书配置状态为已配置。
- 手动触发一次同步。
- 同步 run 成功。
- `activeUsers > 0`。

## 3. 管理员登录

1. 访问 `http://192.168.2.112:3000/admin/auth/bootstrap`。
2. 使用服务器本地破窗账号绑定首个 `platform_admin`。
3. 退出破窗入口。
4. 访问 `http://192.168.2.112:3000`。
5. 点击飞书登录。
6. 登录后确认 `/api/v1/admin/me` 返回 `platform_admin`。

## 4. 测试应用配置

建议测试应用：

- `app_key`：`acceptance`
- 环境：`dev`
- 回调地址：`http://192.168.2.112:3000/acceptance/oauth/callback`
- scope：`openid profile permissions`

创建 client 后，只在当前终端临时保存明文 secret，不写入文件。

## 5. OAuth 主链路

浏览器访问授权地址：

```text
http://192.168.2.112:3000/oauth/authorize?response_type=code&client_id=<client_id>&redirect_uri=http%3A%2F%2F192.168.2.112%3A3000%2Facceptance%2Foauth%2Fcallback&scope=openid%20profile%20permissions&state=v051
```

从验收回调页复制授权码，在服务器或本地终端换 token：

```bash
curl -sS -X POST http://192.168.2.112:3000/oauth/token \
  -H 'content-type: application/json' \
  -d '{"grant_type":"authorization_code","code":"<code>","redirect_uri":"http://192.168.2.112:3000/acceptance/oauth/callback","client_id":"<client_id>","client_secret":"<client_secret>"}'
```

用返回的 access token 调用：

```bash
curl -sS http://192.168.2.112:3000/oauth/userinfo \
  -H 'authorization: Bearer <access_token>'

curl -sS http://192.168.2.112:3000/api/v1/apps/acceptance/me/permissions \
  -H 'authorization: Bearer <access_token>'
```

撤销 token：

```bash
curl -sS -X POST http://192.168.2.112:3000/oauth/revoke \
  -H 'content-type: application/json' \
  -d '{"token":"<access_token>","client_id":"<client_id>","client_secret":"<client_secret>"}'
```

撤销后再次访问 userinfo 或 permissions，应返回稳定认证错误。
```

- [ ] **Step 3: 更新 README 和 AGENTS**

Update `README.md`:

```md
项目已完成基础工程初始化、`v0.2.0` 飞书身份镜像同步、`v0.2.1` 字段完整性诊断、`v0.2.2` 真实验收补丁收口、`v0.3.0` 应用与权限模型闭环、`v0.4.0` SSO Provider 最小闭环、`v0.5.0` 管理后台与管理员体系最小闭环，并进入 `v0.5.1` 内网 Docker Compose 部署与真实飞书 SSO 验证闭环。
```

Add a short section:

```md
## v0.5.1 内网部署与飞书验证

`v0.5.1` 使用 `http://192.168.2.112:3000` 作为第一轮内网访问地址，不引入 HTTPS、域名或反向代理。部署说明见 [Feishu IAM v0.5.1 内网服务器部署](docs/deploy-v0.5.1.md)，真实验收路径见 [Feishu IAM v0.5.1 飞书验证闭环验收](docs/acceptance/v0.5.1-feishu-verification.md)。
```

Update `AGENTS.md` current stage:

```md
当前阶段是：`v0.5.1` 内网 Docker Compose 部署与真实飞书 SSO 验证闭环。当前重点是把 `v0.5.0` 管理后台和 `v0.4.0` SSO Provider 主链路部署到 `192.168.2.112:3000`，完成飞书通讯录同步、管理员飞书登录、测试应用 OAuth 授权码换 token、userinfo、权限查询和 revoke 验收。
```

- [ ] **Step 4: 扫描文档**

Run:

```bash
rg -n "TB[D]|TO[D]O|\\x{300a}|\\x{300b}|D[e]v@|app[_]secret\\s*=|client[_]secret\\s*=|to[k]en\\s*=|coo[k]ie\\s*=|access[_]to[k]en=[A-Za-z0-9]" README.md AGENTS.md docs/deploy-v0.5.1.md docs/acceptance/v0.5.1-feishu-verification.md
```

Expected: no output.

- [ ] **Step 5: 提交**

```bash
git add README.md AGENTS.md docs/deploy-v0.5.1.md docs/acceptance/v0.5.1-feishu-verification.md
git commit -m "docs: add v0.5.1 deployment acceptance guide"
```

## Task 6: 本地质量验证与 Compose 冒烟

**Files:**
- No source changes expected.

- [ ] **Step 1: 运行全量检查**

Run:

```bash
pnpm check
```

Expected: typecheck、lint、test 全部通过。

- [ ] **Step 2: 校验 Prisma schema**

Run:

```bash
pnpm --filter @feishu-iam/api prisma:validate
```

Expected: Prisma schema is valid.

- [ ] **Step 3: 校验 Compose 配置**

Run:

```bash
docker compose --env-file deploy/server.env.example -f deploy/docker-compose.yml config --quiet
```

Expected: no output.

- [ ] **Step 4: 本地启动 Compose 冒烟**

Run:

```bash
set -a
source deploy/server.env.example
set +a
docker compose --env-file deploy/server.env.example -f deploy/docker-compose.yml up -d --build api
curl -fsS http://localhost:3000/health
curl -fsS http://localhost:3000/ready
curl -fsS http://localhost:3000/version
curl -fsS http://localhost:3000/ | rg "Feishu IAM 管理后台|root"
```

Expected:

- `/health` returns status ok.
- `/ready` returns status ready.
- `/version` returns version `0.5.1`.
- `/` returns管理后台 HTML。

- [ ] **Step 5: 停止本地 Compose**

Run:

```bash
docker compose --env-file deploy/server.env.example -f deploy/docker-compose.yml down
```

Expected: containers stopped，volume 保留。

- [ ] **Step 6: 提交验证归档**

Create `docs/codex-sessions/YYYY-MM-DD-HHMM-v0.5.1-本地验证.md` with command results, then run:

```bash
git add docs/codex-sessions/YYYY-MM-DD-HHMM-v0.5.1-本地验证.md
git commit -m "docs: archive v0.5.1 local verification"
```

## Task 7: 服务器部署到 192.168.2.112

**Files:**
- Server-local `.env` only. Do not commit real `.env`.

- [ ] **Step 1: 登录服务器并准备目录**

Run:

```bash
ssh dev@192.168.2.112
mkdir -p ~/feishu-iam
cd ~/feishu-iam
```

Expected: 当前目录为 `/home/dev/feishu-iam` 或服务器上等效 home 路径。

- [ ] **Step 2: 同步仓库**

If the directory is not a Git repo:

```bash
git clone <current-repository-remote-url> ~/feishu-iam
cd ~/feishu-iam
```

If the directory is already this Git repo:

```bash
cd ~/feishu-iam
git status --short
git fetch --all --prune
git checkout main
git pull --ff-only
```

Expected: checkout contains the v0.5.1 commits.

- [ ] **Step 3: 创建服务器本地 .env**

Run on server:

```bash
cp deploy/server.env.example .env
chmod 600 .env
```

Edit `.env` on the server and set real values for:

```text
POSTGRES_PASSWORD
DATABASE_URL
PLATFORM_ADMIN_TOKEN
BOOTSTRAP_SUPER_ADMIN_USERNAME
BOOTSTRAP_SUPER_ADMIN_PASSWORD_HASH
FEISHU_APP_ID
FEISHU_APP_SECRET
FEISHU_OAUTH_REDIRECT_URI
FEISHU_ADMIN_OAUTH_REDIRECT_URI
APP_VERSION
GIT_COMMIT
```

Expected: `.env` remains untracked and never copied back to the repo.

- [ ] **Step 4: 启动服务**

Run on server:

```bash
set -a
source .env
set +a
bash deploy/apply-migrations.sh
docker compose --env-file .env -f deploy/docker-compose.yml up -d --build api
docker compose --env-file .env -f deploy/docker-compose.yml ps
```

Expected: `feishu-iam-postgres` and `feishu-iam-api` are running.

- [ ] **Step 5: 服务器健康检查**

Run:

```bash
curl -fsS http://192.168.2.112:3000/health
curl -fsS http://192.168.2.112:3000/ready
curl -fsS http://192.168.2.112:3000/version
curl -fsS http://192.168.2.112:3000/ | rg "Feishu IAM 管理后台|root"
```

Expected:

- health ok.
- ready ready.
- version `0.5.1`.
- 管理后台 HTML 可访问。

## Task 8: 真实飞书验证闭环

**Files:**
- Create: `docs/codex-sessions/YYYY-MM-DD-HHMM-v0.5.1-真实飞书验收.md`

- [ ] **Step 1: 确认飞书回调登记**

In Feishu developer console, confirm these callback URLs are registered:

```text
http://192.168.2.112:3000/admin/auth/feishu/callback
http://192.168.2.112:3000/oauth/feishu/callback
```

Expected: both are allowed by the same enterprise Feishu app used by Feishu IAM.

- [ ] **Step 2: 触发真实通讯录同步**

Use admin web or platform API. If using platform API, run with a token stored only in the current shell:

```bash
curl -sS -X POST http://192.168.2.112:3000/api/v1/platform/feishu/sync-runs \
  -H "authorization: Bearer ${PLATFORM_ADMIN_TOKEN}"
curl -sS http://192.168.2.112:3000/api/v1/platform/feishu/status \
  -H "authorization: Bearer ${PLATFORM_ADMIN_TOKEN}"
```

Expected: sync succeeds and `activeUsers > 0`.

- [ ] **Step 3: 绑定并验证管理员飞书登录**

Use browser:

```text
http://192.168.2.112:3000/admin/auth/bootstrap
```

Bind the real Feishu `user_id` as `platform_admin`, then logout and use:

```text
http://192.168.2.112:3000/admin/auth/login
```

Expected: Feishu login returns to Feishu IAM and `/api/v1/admin/me` shows `platform_admin`.

- [ ] **Step 4: 创建测试应用配置**

In admin web, create:

```text
app_key: acceptance
environmentKey: dev
redirectUri: http://192.168.2.112:3000/acceptance/oauth/callback
client name: acceptance-dev
```

Expected: client is active and the plaintext secret is shown once. Store it only in the current terminal session.

- [ ] **Step 5: 浏览器跑授权码流程**

Open:

```text
http://192.168.2.112:3000/oauth/authorize?response_type=code&client_id=<client_id>&redirect_uri=http%3A%2F%2F192.168.2.112%3A3000%2Facceptance%2Foauth%2Fcallback&scope=openid%20profile%20permissions&state=v051
```

Expected: Feishu login succeeds and redirects to `/acceptance/oauth/callback` with a Feishu IAM authorization code.

- [ ] **Step 6: 换 token、查 userinfo、查 permissions、撤销 token**

Run without writing secrets to a file:

```bash
curl -sS -X POST http://192.168.2.112:3000/oauth/token \
  -H 'content-type: application/json' \
  -d '{"grant_type":"authorization_code","code":"<code>","redirect_uri":"http://192.168.2.112:3000/acceptance/oauth/callback","client_id":"<client_id>","client_secret":"<client_secret>"}'

curl -sS http://192.168.2.112:3000/oauth/userinfo \
  -H 'authorization: Bearer <access_token>'

curl -sS http://192.168.2.112:3000/api/v1/apps/acceptance/me/permissions \
  -H 'authorization: Bearer <access_token>'

curl -sS -X POST http://192.168.2.112:3000/oauth/revoke \
  -H 'content-type: application/json' \
  -d '{"token":"<access_token>","client_id":"<client_id>","client_secret":"<client_secret>"}'
```

Expected:

- `/oauth/token` returns access token response.
- `/oauth/userinfo` returns the Feishu user mapped by Feishu IAM.
- `/api/v1/apps/acceptance/me/permissions` returns permission groups and permission points for the test app.
- `/oauth/revoke` returns `{ "revoked": true }`.

- [ ] **Step 7: 验证 revoke 后 token 失效**

Run:

```bash
curl -i http://192.168.2.112:3000/oauth/userinfo \
  -H 'authorization: Bearer <revoked_access_token>'
```

Expected: stable auth error, no stack trace, no token echo.

- [ ] **Step 8: 归档验收结果**

Create `docs/codex-sessions/YYYY-MM-DD-HHMM-v0.5.1-真实飞书验收.md` with:

```md
# v0.5.1 真实飞书验收

## 会话目标

完成 `v0.5.1` 内网服务器部署和真实飞书 SSO 验证闭环。

## 验收结果

- 服务器：`192.168.2.112:3000`
- Docker Compose：已启动 PostgreSQL 和 API。
- `/health`：通过。
- `/ready`：通过。
- `/version`：返回 `0.5.1`。
- 飞书通讯录同步：通过，`activeUsers > 0`。
- 管理员飞书登录：通过。
- 测试应用 OAuth 主链路：通过。
- revoke 后 token 失效：通过。

## 安全说明

本归档未记录服务器密码、飞书密钥、平台 token、client secret、cookie 或 access token。

## 剩余事项

- 后续如需 HTTPS、域名或反向代理，单独规划版本。
```

Commit:

```bash
git add docs/codex-sessions/YYYY-MM-DD-HHMM-v0.5.1-真实飞书验收.md
git commit -m "docs: archive v0.5.1 real acceptance"
```

## Task 9: 发布收口

**Files:**
- Modify only release docs if verification finds wording gaps.

- [ ] **Step 1: 最终状态检查**

Run:

```bash
git status --short
pnpm check
docker compose --env-file deploy/server.env.example -f deploy/docker-compose.yml config --quiet
rg -n "D[e]v@|app[_]secret\\s*=|client[_]secret\\s*=|to[k]en\\s*=|coo[k]ie\\s*=|access[_]to[k]en=[A-Za-z0-9]" README.md AGENTS.md docs deploy apps
```

Expected:

- worktree clean before release branch merge.
- checks pass.
- Compose config passes.
- sensitive scan has no real credential hits.

- [ ] **Step 2: 创建 release 分支或确认当前分支**

If not already on a release branch:

```bash
git checkout -b release/v0.5.1
```

Expected: branch is `release/v0.5.1`.

- [ ] **Step 3: 推送并创建 MR**

Run:

```bash
git push -u origin release/v0.5.1
```

Create a GitLab MR targeting `main` with title:

```text
Release v0.5.1 Feishu verification closure
```

Expected: MR created for review.

- [ ] **Step 4: 合并、打 tag、推送 tag**

After MR is accepted:

```bash
git checkout main
git pull --ff-only
git tag -a v0.5.1 -m "Feishu IAM v0.5.1"
git push origin v0.5.1
```

Expected: `main` contains v0.5.1 and tag `v0.5.1` exists on remote.

## Self-Review Checklist

- Spec coverage: plan covers same-origin admin web serving, acceptance callback, server Compose configuration, version bump, deployment docs, local checks, server deployment, Feishu sync, admin login, OAuth token/userinfo/permissions/revoke and release closure.
- Placeholder scan: plan contains no unresolved placeholder markers, no angle-bracket project placeholders, and no real credentials.
- Scope check: plan does not add HTTPS, domain, reverse proxy, full OIDC, refresh token, SAML, Feishu roles, Feishu groups or third-party demo app.
- Security check: server password, Feishu app secret, platform token, client secret, cookies and access tokens remain outside tracked files.
