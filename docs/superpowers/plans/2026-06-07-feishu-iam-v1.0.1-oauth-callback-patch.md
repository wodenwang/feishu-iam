# Feishu IAM v1.0.1 OAuth Callback Patch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 发布 `v1.0.1`，快速修复 GitHub issue `#2`：内部 Feishu OAuth 回调地址配置与实际路由不一致导致第三方 SSO 登录 404。

**Architecture:** 本补丁不扩大 OAuth/OIDC 协议面，不新增 DDL，不改变第三方应用 `redirect_uri` 校验模型。修复集中在后端 OAuth 入口兼容、内部回调配置校验、部署配置更新和真实第三方 SSO 验收，保证旧配置不再直接返回框架 404。

**Tech Stack:** NestJS、React/Vite 管理后台、PostgreSQL、Prisma、Docker Compose、Vitest、Supertest、GitHub Release。

---

## 1. 范围

纳入：

- GitHub issue `#2`：`FEISHU_OAUTH_REDIRECT_URI` 指向旧 `/api/auth/feishu/callback` 时，飞书平台回调不应落到 `Cannot GET ...`。
- `GET /api/auth/feishu/callback` 兼容旧路径，并复用现有 `/oauth/feishu/callback` 的业务处理和 OAuth HTML 错误页。
- 启动或授权发起时对 `FEISHU_OAUTH_REDIRECT_URI` 做明确诊断，避免配置漂移静默进入飞书授权页。
- 部署样例、README、会话归档和版本信息更新到 `1.0.1`。
- 线上 `https://feishu-iam.riversoft.com.cn/` 完成 issue 级 SSO 验收。

不纳入：

- 不实现完整 OIDC、refresh token、SAML、ABAC、资源级权限或 deny 规则。
- 不改变第三方应用 `application_redirect_uris` 的精确匹配规则。
- 不把第三方 Demo 的回调地址作为 Feishu IAM 内部飞书平台回调地址。
- 不新增数据库迁移或修改管理员 session 机制。
- 不记录或展示 secret、token、cookie、authorization code、token hash、state hash 或原始飞书 payload。

## 2. 文件结构

- Modify: `apps/api/src/oauth/oauth.controller.ts`
  - 新增旧路径兼容入口，复用 `OauthService.handleFeishuCallback`。
- Create: `apps/api/src/oauth/legacy-oauth-callback.controller.ts`
  - 独立承载 `/api/auth/feishu/callback`，避免在 `@Controller('oauth')` 下使用跨层级路由。
- Modify: `apps/api/src/oauth/oauth.module.ts`
  - 注册旧路径兼容 controller。
- Modify: `apps/api/src/oauth/oauth-error.filter.ts`
  - 将 `/api/auth/feishu/callback` 纳入 OAuth HTML 错误页路径，避免兼容入口异常时返回裸 JSON 或框架默认错误。
- Create: `apps/api/test/oauth-callback-compat.e2e-spec.ts`
  - 使用 Nest testing module + Supertest 固定旧路径兼容、错误页类型和 authorize 生成 URL 的回归行为。
- Modify: `apps/api/src/oauth/oauth.service.ts`
  - 增加内部飞书回调地址校验函数，要求配置路径为 `/oauth/feishu/callback` 或兼容旧路径 `/api/auth/feishu/callback`；缺失或无法解析时返回稳定 OAuth 错误。
- Modify: `deploy/server.env.example`
  - 明确生产推荐值为 `https://feishu-iam.riversoft.com.cn/oauth/feishu/callback`，并注明旧路径仅为兼容，不推荐继续配置。
- Modify: `README.md`
  - 增加 `v1.0.1` 补丁说明、Quick Start 版本号、部署检查和 issue `#2` 验收摘要。
- Modify: `package.json`
  - 版本号从 `1.0.0` 更新到 `1.0.1`。
- Modify: `apps/api/package.json`
  - 版本号从 `1.0.0` 更新到 `1.0.1`。
- Modify: `apps/admin-web/package.json`
  - 版本号从 `1.0.0` 更新到 `1.0.1`，保持 `/version` 和包版本口径一致。
- Create: `docs/codex-sessions/YYYY-MM-DD-HHMM-v1.0.1-oauth-callback-patch.md`
  - 记录本次实现、验证和发布收口，不写敏感凭证。

## 3. Task 1: OAuth 回调兼容测试先行

**Files:**

- Create: `apps/api/test/oauth-callback-compat.e2e-spec.ts`

- [ ] **Step 1: 新建失败测试**

写入以下测试骨架，先固定旧路径不应返回 Nest 默认 404：

```ts
import { Controller, Get, Module, Query, Redirect, UseFilters } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OauthErrorFilter } from '../src/oauth/oauth-error.filter';
import { OauthDomainError } from '../src/oauth/oauth.types';

const handleFeishuCallback = vi.fn();
const startAuthorization = vi.fn();

@Controller()
@UseFilters(OauthErrorFilter)
class TestOauthCompatController {
  @Get('oauth/authorize')
  @Redirect(undefined, 302)
  async authorize(@Query('redirect_uri') redirectUri: string | undefined): Promise<{ url: string }> {
    return startAuthorization({ redirectUri });
  }

  @Get('oauth/feishu/callback')
  @Redirect(undefined, 302)
  async currentCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined
  ): Promise<{ url: string }> {
    return handleFeishuCallback({ code, state });
  }

  @Get('api/auth/feishu/callback')
  @Redirect(undefined, 302)
  async legacyCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined
  ): Promise<{ url: string }> {
    return handleFeishuCallback({ code, state });
  }
}

@Module({ controllers: [TestOauthCompatController] })
class TestModule {}

describe('OAuth Feishu callback compatibility', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  async function createServer() {
    const moduleRef = await Test.createTestingModule({ imports: [TestModule] }).compile();
    const app = moduleRef.createNestApplication();
    await app.init();
    return app;
  }

  it('routes legacy Feishu callback path through the OAuth callback handler', async () => {
    handleFeishuCallback.mockResolvedValueOnce({ url: 'https://third.example/callback?code=biac_ok&state=client_state' });
    const app = await createServer();

    await request(app.getHttpServer())
      .get('/api/auth/feishu/callback?code=feishu_code&state=bils_state')
      .expect(302)
      .expect('Location', 'https://third.example/callback?code=biac_ok&state=client_state');

    expect(handleFeishuCallback).toHaveBeenCalledWith({ code: 'feishu_code', state: 'bils_state' });
    await app.close();
  });

  it('renders OAuth HTML error page on legacy callback failures', async () => {
    handleFeishuCallback.mockRejectedValueOnce(new OauthDomainError('OAUTH_LOGIN_STATE_INVALID', '登录状态已失效，请重新发起登录', 400));
    const app = await createServer();

    const response = await request(app.getHttpServer())
      .get('/api/auth/feishu/callback?code=feishu_code&state=bad_state')
      .expect(400);

    expect(response.headers['content-type']).toContain('text/html');
    expect(response.text).toContain('无法完成登录');
    expect(response.text).toContain('request id');
    await app.close();
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
pnpm --filter @feishu-iam/api test -- --run test/oauth-callback-compat.e2e-spec.ts
```

Expected:

- 第一条测试在真实代码未加旧路径入口前应失败，现象是 `expected 302 "Found", got 404 "Not Found"`。

## 4. Task 2: 实现旧回调路径兼容

**Files:**

- Create: `apps/api/src/oauth/legacy-oauth-callback.controller.ts`
- Modify: `apps/api/src/oauth/oauth.module.ts`
- Modify: `apps/api/src/oauth/oauth-error.filter.ts`

- [ ] **Step 1: 新建旧路径兼容 controller**

创建 `apps/api/src/oauth/legacy-oauth-callback.controller.ts`，保持参数、审计上下文和返回逻辑与当前 `OauthController.feishuCallback` 一致：

```ts
import { Controller, Get, Inject, Query, Redirect, Req, UseFilters } from '@nestjs/common';
import type { Request } from 'express';
import { OauthErrorFilter } from './oauth-error.filter';
import { getOauthRequestId } from './oauth-request-context';
import { OauthService } from './oauth.service';
import type { OauthAuditContext } from './oauth.types';

@Controller('api/auth/feishu')
@UseFilters(OauthErrorFilter)
export class LegacyOauthCallbackController {
  constructor(@Inject(OauthService) private readonly oauth: OauthService) {}

  @Get('callback')
  @Redirect(undefined, 302)
  async feishuCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Req() request: Request
  ): Promise<{ url: string }> {
    const result = await this.oauth.handleFeishuCallback({ code, state }, buildContext(request));
    return { url: result.redirectTo };
  }
}

function buildContext(request: Request): OauthAuditContext {
  return {
    requestId: getOauthRequestId(request),
    ip: request.ip ?? null,
    userAgent: request.header('user-agent') ?? null
  };
}
```

- [ ] **Step 2: 注册独立 controller**

在 `apps/api/src/oauth/oauth.module.ts` 中导入：

```ts
import { LegacyOauthCallbackController } from './legacy-oauth-callback.controller';
```

并加入 controllers：

```ts
controllers: [
  OauthConfigController,
  OauthController,
  LegacyOauthCallbackController,
  AppPermissionsController,
  DeveloperPermissionController
],
```

- [ ] **Step 3: 更新错误页路径识别**

将 `apps/api/src/oauth/oauth-error.filter.ts` 中的判断改为：

```ts
function shouldRenderHtmlError(path: string): boolean {
  return path === '/oauth/authorize' || path === '/oauth/feishu/callback' || path === '/api/auth/feishu/callback';
}
```

- [ ] **Step 4: 运行兼容测试**

Run:

```bash
pnpm --filter @feishu-iam/api test -- --run test/oauth-callback-compat.e2e-spec.ts
```

Expected:

- `routes legacy Feishu callback path through the OAuth callback handler` PASS。
- `renders OAuth HTML error page on legacy callback failures` PASS。

## 5. Task 3: 内部回调配置校验

**Files:**

- Modify: `apps/api/src/oauth/oauth.service.ts`

- [ ] **Step 1: 增加配置校验函数**

在 `oauth.service.ts` 中加入常量和函数：

```ts
const SUPPORTED_FEISHU_OAUTH_CALLBACK_PATHS = ['/oauth/feishu/callback', '/api/auth/feishu/callback'] as const;

function normalizeFeishuRedirectUri(rawRedirectUri: string | undefined): string {
  if (!rawRedirectUri) {
    throw new OauthDomainError(
      'OAUTH_FEISHU_REDIRECT_URI_MISSING',
      'Feishu IAM 飞书 OAuth 回调地址未配置',
      500
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(rawRedirectUri);
  } catch {
    throw new OauthDomainError(
      'OAUTH_FEISHU_REDIRECT_URI_INVALID',
      'Feishu IAM 飞书 OAuth 回调地址格式无效',
      500
    );
  }

  if (!SUPPORTED_FEISHU_OAUTH_CALLBACK_PATHS.includes(parsed.pathname as (typeof SUPPORTED_FEISHU_OAUTH_CALLBACK_PATHS)[number])) {
    throw new OauthDomainError(
      'OAUTH_FEISHU_REDIRECT_URI_UNSUPPORTED',
      'Feishu IAM 飞书 OAuth 回调地址未指向当前服务支持的回调路由',
      500
    );
  }

  return rawRedirectUri;
}
```

- [ ] **Step 2: 在授权发起时使用校验函数**

将 `doStartAuthorization` 中读取 `process.env.FEISHU_OAUTH_REDIRECT_URI` 的逻辑替换为：

```ts
const feishuRedirectUri = normalizeFeishuRedirectUri(process.env.FEISHU_OAUTH_REDIRECT_URI);
```

- [ ] **Step 3: 在飞书 code exchange 时显式传入本次内部回调地址**

将 `doHandleFeishuCallback` 中：

```ts
const identity = await this.feishuClient.exchangeOAuthCode(input.code);
```

改为：

```ts
const identity = await this.feishuClient.exchangeOAuthCode(
  input.code,
  normalizeFeishuRedirectUri(process.env.FEISHU_OAUTH_REDIRECT_URI)
);
```

这样飞书 token exchange 使用的 `redirect_uri` 与发起授权时的内部回调配置一致。

- [ ] **Step 4: 增加配置校验单元测试**

在 `apps/api/test/oauth-callback-compat.e2e-spec.ts` 增加一条 authorize 失败测试：

```ts
it('returns stable OAuth error when internal Feishu callback path is unsupported', async () => {
  startAuthorization.mockRejectedValueOnce(
    new OauthDomainError(
      'OAUTH_FEISHU_REDIRECT_URI_UNSUPPORTED',
      'Feishu IAM 飞书 OAuth 回调地址未指向当前服务支持的回调路由',
      500
    )
  );
  const app = await createServer();

  const response = await request(app.getHttpServer())
    .get('/oauth/authorize?redirect_uri=https%3A%2F%2Fthird.example%2Fcallback')
    .expect(500);

  expect(response.headers['content-type']).toContain('text/html');
  expect(response.text).toContain('无法完成登录');
  expect(response.text).toContain('Feishu IAM 飞书 OAuth 回调地址未指向当前服务支持的回调路由');
  await app.close();
});
```

- [ ] **Step 5: 运行 API 检查**

Run:

```bash
pnpm --filter @feishu-iam/api typecheck
pnpm --filter @feishu-iam/api lint
pnpm --filter @feishu-iam/api test
```

Expected:

- typecheck PASS。
- lint PASS。
- API tests PASS。

## 6. Task 4: 文档、版本和部署配置

**Files:**

- Modify: `package.json`
- Modify: `apps/api/package.json`
- Modify: `apps/admin-web/package.json`
- Modify: `README.md`
- Modify: `deploy/server.env.example`
- Create: `docs/codex-sessions/YYYY-MM-DD-HHMM-v1.0.1-oauth-callback-patch.md`

- [ ] **Step 1: 更新版本号**

把三个 package 版本更新为：

```json
"version": "1.0.1"
```

- [ ] **Step 2: 更新部署样例**

确保 `deploy/server.env.example` 中推荐配置为：

```env
FEISHU_OAUTH_REDIRECT_URI=https://feishu-iam.riversoft.com.cn/oauth/feishu/callback
FEISHU_ADMIN_OAUTH_REDIRECT_URI=https://feishu-iam.riversoft.com.cn/admin/auth/feishu/callback
```

并增加中文说明：

```text
# /api/auth/feishu/callback 仅作为 v1.0.1 兼容旧配置的回调路径保留；新部署必须使用 /oauth/feishu/callback。
```

- [ ] **Step 3: 更新 README**

在 README 中补充 `v1.0.1`：

```markdown
## 版本历史

### v1.0.1

- 修复 GitHub issue #2：内部 Feishu OAuth 回调地址配置与实际路由不一致时，第三方 SSO 登录不再落到 `Cannot GET /api/auth/feishu/callback`。
- 保留 `/api/auth/feishu/callback` 兼容入口，推荐生产配置继续使用 `/oauth/feishu/callback`。
- 部署前必须确认 `FEISHU_OAUTH_REDIRECT_URI=https://feishu-iam.riversoft.com.cn/oauth/feishu/callback`。
```

- [ ] **Step 4: 新增会话归档**

创建 `docs/codex-sessions/YYYY-MM-DD-HHMM-v1.0.1-oauth-callback-patch.md`，至少记录：

```markdown
# Codex 会话归档：v1.0.1 OAuth 回调兼容补丁

## 会话目标

规划并实现 v1.0.1 小版本，快速修复 GitHub issue #2。

## 用户关键要求摘要

- 规划一个 1.0.1 小版本。
- 快速解决当前 issue 中发现的 bug。

## 关键决策

- 只处理内部 Feishu OAuth 回调配置漂移和旧路径兼容。
- 不扩大 OAuth 协议面，不新增 DDL，不记录敏感凭证。

## 修改文件

- apps/api/src/oauth/oauth.controller.ts
- apps/api/src/oauth/oauth-error.filter.ts
- apps/api/src/oauth/oauth.service.ts
- apps/api/test/oauth-callback-compat.e2e-spec.ts
- README.md
- deploy/server.env.example
- package.json
- apps/api/package.json
- apps/admin-web/package.json

## 验证

- pnpm --filter @feishu-iam/api typecheck
- pnpm --filter @feishu-iam/api lint
- pnpm --filter @feishu-iam/api test
- pnpm check
- 线上 SSO issue #2 验收

## 未完成事项

- 发布后关闭 GitHub issue #2。
```

## 7. Task 5: 本地、浏览器和线上验收

**Files:**

- No code changes.

- [ ] **Step 1: 运行全量检查**

Run:

```bash
pnpm check
pnpm build
```

Expected:

- `pnpm check` PASS。
- `pnpm build` PASS。

- [ ] **Step 2: 本地启动并探测旧路径**

Run:

```bash
FEISHU_OAUTH_REDIRECT_URI=http://localhost:3000/api/auth/feishu/callback pnpm compose:up
curl -i 'http://localhost:3000/api/auth/feishu/callback?code=dummy&state=dummy'
```

Expected:

- 不返回 `Cannot GET /api/auth/feishu/callback`。
- 返回 OAuth 业务错误页或稳定 OAuth 错误响应。
- 响应中不得出现 secret、token、cookie、authorization code 原文或 state hash。

- [ ] **Step 3: 使用 Browser 自检后台入口**

打开：

```text
http://localhost:3000/
```

检查：

- 未登录态统一问题提示页仍正常。
- `/admin/auth/login` 仍能 302 到飞书登录。
- Browser console 无非预期错误。
- Network 无非预期 404 到 `/api/auth/feishu/callback`。

- [ ] **Step 4: 线上部署配置修复**

在 `bpmt@120.24.236.92:/home/bpmt/feishu-iam` 的部署环境中确认：

```bash
grep '^FEISHU_OAUTH_REDIRECT_URI=' .env
```

Expected:

```text
FEISHU_OAUTH_REDIRECT_URI=https://feishu-iam.riversoft.com.cn/oauth/feishu/callback
```

如果当前仍是旧值，更新后执行 `APP_VERSION=1.0.1 ./upgrade.sh`，不要在日志或归档中输出真实 secret。

- [ ] **Step 5: 线上 issue #2 验收**

验证：

```bash
curl -i 'https://feishu-iam.riversoft.com.cn/oauth/feishu/callback?code=dummy&state=dummy'
curl -i 'https://feishu-iam.riversoft.com.cn/api/auth/feishu/callback?code=dummy&state=dummy'
curl -fsS 'https://feishu-iam.riversoft.com.cn/version'
```

Expected:

- `/oauth/feishu/callback` 返回业务 400 或统一错误页，不是 404。
- `/api/auth/feishu/callback` 也不再返回 `Cannot GET ...`。
- `/version` 返回 `1.0.1`。
- 第三方 Demo 完整链路 `authorize -> Feishu callback -> third-party callback -> token -> userinfo` 成功。

## 8. 发布收口

- [ ] 创建分支：`codex/v1.0.1-oauth-callback-patch`。
- [ ] 提交：`fix: support legacy Feishu OAuth callback path`。
- [ ] 创建 GitHub Release `v1.0.1`。
- [ ] 构建并部署 `v1.0.1` 镜像或 amd64 离线 tar，沿用 v1.0.0 已验证的部署路径。
- [ ] 线上 `/ready`、`/version`、`/admin/auth/login`、两个回调路径和第三方 Demo SSO 验收通过。
- [ ] 在 GitHub issue `#2` 回复修复版本、验证结果和 release 链接后关闭。

## 9. 自检

- Spec coverage：issue `#2` 的旧路径 404、推荐新路径、第三方 redirect URI 不混用、完整 SSO 验收均有对应任务。
- Placeholder scan：本文不包含未定义占位任务。
- Type consistency：计划中使用的 `OauthService.handleFeishuCallback`、`OauthDomainError`、`FEISHU_OAUTH_REDIRECT_URI` 与现有代码命名一致。
