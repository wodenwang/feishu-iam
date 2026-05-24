# feishu-iam

`feishu-iam` 是一个以飞书作为身份、组织结构、登录入口和授权数据源的 IAM 系统。

## 项目边界

- 飞书是组织结构和用户的唯一来源。
- 不维护独立的 username / password 登录系统。
- 所有用户认证流程依赖飞书。
- 系统超级管理员身份必须绑定到飞书用户。
- 系统绑定一个专用自建飞书应用。
- 所有飞书 API 权限来自该专用自建飞书应用。

## 当前状态

当前仓库已经进入 `v0.1.4` Directory runtime-backed 只读浏览阶段：

- 已提供 React + TypeScript + Vite + Ant Design 前端骨架。
- 已提供基于 TanStack Query 的 mock IAM service，用于验证页面、权限、同步和审计闭环。
- 已保留 Pencil 原型、实现截图、QA 记录和 E2E 测试。
- `v0.1.1` 已新增本地 Fastify + PostgreSQL runtime slice，用于验证 mock 飞书登录、平台管理员绑定、应用创建和审计日志闭环。
- `v0.1.2` 已新增 Application API HMAC 鉴权、权限组/权限点注册、角色授权、权限查询、mock directory projection、第三方 Demo 壳和本地验收脚本。
- `v0.1.3` 已新增 Admin Console HTTP runtime mode，可通过真实 Fastify API 完成本地 mock 飞书登录、初始化、应用列表/创建和审计日志查看。
- `v0.1.4` 已新增 `/directory` HTTP runtime-backed 只读浏览，可查看部门树、用户分页列表、部门筛选、详情 Drawer 和 requestId 错误态。
- 真实飞书 OAuth、Roles 后续 HTTP 切片、Sync、Dashboard、Application Detail、Onboarding 和交付部署仍在后续独立切片中。

## v0.1.3 HTTP mode 本地验收

`v0.1.3` 的主验收路径是 HTTP runtime，而不是 mock-only 前端。

1. 启动本地 PostgreSQL，并设置 `DATABASE_URL`。
2. 启动 Fastify runtime：

   ```bash
   SESSION_SECRET=local-session-secret-at-least-32-bytes \
   FEISHU_AUTH_MODE=mock \
   npm run server:dev
   ```

3. 启动 Vite HTTP mode：

   ```bash
   VITE_IAM_API_MODE=http npm run dev -- --host 127.0.0.1
   ```

4. 使用 gstack `/browser` 打开 `http://127.0.0.1:5173/login`，走本地 mock 飞书登录、初始化、创建应用、审计日志检查。

5. 可选运行 v0.1.3 HTTP mode E2E。显式设置 `E2E_RESET_DATABASE=true` 时，Playwright 会使用 `TEST_DATABASE_URL` 或 `DATABASE_URL` 重置并迁移本地 runtime DB，避免其他本地测试残留 platform admin：

   ```bash
   E2E_RESET_DATABASE=true \
   DATABASE_URL=postgres://feishu_iam:<replace-me>@127.0.0.1:5432/feishu_iam \
   VITE_IAM_API_MODE=http \
   npm run e2e -- tests/e2e/v0.1.3-admin-console-http.spec.ts
   ```

## v0.1.4 Directory HTTP mode 本地验收

`v0.1.4` 的主验收路径只覆盖 `/directory`，不包含 Roles 授权保存、Sync、Dashboard、Application Detail 或 Onboarding。

1. 启动本地 PostgreSQL，并设置 `DATABASE_URL`。
2. 启动 Fastify runtime：

   ```bash
   SESSION_SECRET=local-session-secret-at-least-32-bytes \
   FEISHU_AUTH_MODE=mock \
   npm run server:dev
   ```

3. 启动 Vite HTTP mode：

   ```bash
   VITE_IAM_API_MODE=http npm run dev -- --host 127.0.0.1
   ```

4. 打开 `http://127.0.0.1:5173/login`，走本地 mock 飞书登录、初始化、进入 `/directory`，检查：

   - Header 显示 `HTTP runtime`。
   - 左侧显示部门树。
   - 右侧用户列表支持分页。
   - 点击部门后用户列表按部门筛选。
   - 点击 `查看详情` 打开只读用户详情 Drawer。
   - 401、403、API error 显示可追踪 `requestId`。

5. 可选运行 v0.1.4 HTTP mode E2E：

   ```bash
   E2E_RESET_DATABASE=true \
   DATABASE_URL=postgres://feishu_iam:<replace-me>@127.0.0.1:5432/feishu_iam \
   VITE_IAM_API_MODE=http \
   npm run e2e -- tests/e2e/v0.1.4-directory-http.spec.ts
   ```

## 本地运行

```bash
npm install
npm run dev
```

## v0.1.1 Runtime Slice

本切片提供本地 mock Feishu 登录、平台管理员绑定、应用创建和审计日志闭环。

```bash
cp .env.example .env
npm install
npm run server:dev
```

另一个终端运行：

```bash
npm run server:test
npm run e2e -- tests/e2e/runtime-api.spec.ts
```

`FEISHU_AUTH_MODE=mock` 只允许本地开发和测试使用，生产环境必须使用真实飞书认证配置。

## v0.1.2 Access Loop

本切片提供内部验收链路：mock 飞书登录、平台管理员绑定、创建应用、Application API 注册权限、创建角色并授权飞书用户、第三方应用查询当前用户权限、审计回溯。

启动后端后运行：

```bash
RUNTIME_API_BASE_URL=http://127.0.0.1:4100 bash scripts/verify-v0.1.2-access-loop.sh
```

第三方 Demo 壳位于 `examples/thirdparty-demo`。先通过验收脚本或手动流程创建应用并注册权限，再用返回的 Application API credential 启动：

```bash
cd examples/thirdparty-demo
IAM_BASE_URL=http://127.0.0.1:4100 \
IAM_APP_KEY=<app_key> \
IAM_API_SECRET=<api_secret> \
DEMO_AUTH_MODE=mock \
npm run dev
```

发布前检查：

```bash
npm run build
npm test
npm run e2e
```

## 项目文档

- [架构说明](docs/architecture.md)
- [v0.1 产品规格说明](docs/v0.1-product-spec.md)
- [Agent 协作规范](AGENTS.md)
- [v0.1 Access Loop 实施计划](docs/superpowers/plans/2026-05-23-v0.1-access-loop.md)

## 安全说明

不要提交飞书应用 secret、tenant access token、private key、本地 `.env`、导出的用户数据或同步快照。
