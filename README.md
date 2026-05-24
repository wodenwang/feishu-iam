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

当前仓库已经进入 `v0.1.6` 最小部署基础设施阶段：

- 已提供 React + TypeScript + Vite + Ant Design 前端骨架。
- 已提供基于 TanStack Query 的 mock IAM service，用于验证页面、权限、同步和审计闭环。
- 已保留 Pencil 原型、实现截图、QA 记录和 E2E 测试。
- `v0.1.1` 已新增本地 Fastify + PostgreSQL runtime slice，用于验证 mock 飞书登录、平台管理员绑定、应用创建和审计日志闭环。
- `v0.1.2` 已新增 Application API HMAC 鉴权、权限组/权限点注册、角色授权、权限查询、mock directory projection、第三方 Demo 壳和本地验收脚本。
- `v0.1.3` 已新增 Admin Console HTTP runtime mode，可通过真实 Fastify API 完成本地 mock 飞书登录、初始化、应用列表/创建和审计日志查看。
- `v0.1.4` 已新增 `/directory` HTTP runtime-backed 只读浏览，可查看部门树、用户分页列表、部门筛选、详情 Drawer 和 requestId 错误态。
- `v0.1.5` 已新增 `/roles` HTTP runtime-backed 角色管理，可查看角色列表、创建/编辑角色、停用角色、保存授权和查看 requestId 错误态。
- `v0.1.6` 已新增 Docker Compose 最小部署入口，可用 `feishu-iam` + `postgres` 两个容器完成 runtime 启动和 `/api/health` 健康检查。
- 真实飞书 OAuth、Sync、Dashboard、Application Detail、Onboarding、备份监控和更完整的自动化部署仍在后续独立切片中。

## v0.1.6 Docker Compose 部署

`v0.1.6` 的主目标是补齐最小部署基础设施，不新增 IAM 业务页面。

Compose 常驻容器：

- `feishu-iam`：服务 Vite build 后的前端静态资源和 Fastify API。
- `postgres`：PostgreSQL 数据库。

持久化路径：

- `./data/postgres:/var/lib/postgresql/data`

应用日志默认通过 Docker 查看：

```bash
docker compose logs -f feishu-iam
docker compose logs -f postgres
```

本地或服务器部署步骤：

```bash
cp .env.example .env
```

编辑 `.env`，至少设置：

```text
FEISHU_IAM_HOST_PORT=8002
FEISHU_IAM_NODE_IMAGE=node:24-alpine
POSTGRES_IMAGE=postgres:16-alpine
POSTGRES_PASSWORD=<replace-me-postgres-password>
SESSION_SECRET=<replace-me-at-least-32-characters>
FEISHU_AUTH_MODE=real
FEISHU_APP_ID=<replace-me>
FEISHU_APP_SECRET=<replace-me>
FEISHU_REDIRECT_URI=https://<your-domain>/api/auth/feishu/callback
```

启动：

```bash
docker compose up -d --build
docker compose ps
curl http://127.0.0.1:${FEISHU_IAM_HOST_PORT:-8002}/api/health
```

生产环境必须使用 `FEISHU_AUTH_MODE=real`。`NODE_ENV=production` 下如果配置 `FEISHU_AUTH_MODE=mock`，服务会拒绝启动。

如果部署服务器无法访问 Docker Hub，可以把镜像源改为可访问的代理。例如 `bpmt-120` 当前可使用：

```text
FEISHU_IAM_NODE_IMAGE=swr.cn-north-4.myhuaweicloud.com/ddn-k8s/docker.io/node:24-alpine
POSTGRES_IMAGE=swr.cn-north-4.myhuaweicloud.com/ddn-k8s/docker.io/postgres:16-alpine
```

### bpmt-120 部署约定

当前目标服务器为 `bpmt-120`，部署目录为：

```text
/home/bpmt/feishu-iam
```

远端已有 `/home/bpmt/nginx` 作为统一反向代理。部署时读取远端 nginx 配置和监听端口，选择下一个空闲应用端口。当前已知 `8000`、`8001` 被占用，因此优先使用 `8002`；如果部署时 `8002` 已被占用，则递增使用 `8003`。

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

## v0.1.5 Roles HTTP mode 本地验收

`v0.1.5` 的主验收路径只覆盖 `/roles`，不扩大 `/directory` 只读浏览边界，不包含 Sync、Dashboard、Application Detail 或 Onboarding。

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

4. 打开 `http://127.0.0.1:5173/login`，走本地 mock 飞书登录、初始化、进入 `/roles`，检查：

   - Header 显示 `HTTP runtime`。
   - 角色列表来自 Fastify runtime。
   - 可以新建和编辑角色。
   - 可以保存角色授权。
   - 可以停用角色。
   - 401、403、409、API error 显示可追踪 `requestId`。

5. 可选运行 v0.1.5 HTTP mode E2E：

   ```bash
   E2E_RESET_DATABASE=true \
   DATABASE_URL=postgres://feishu_iam:<replace-me>@127.0.0.1:5432/feishu_iam \
   VITE_IAM_API_MODE=http \
   npm run e2e -- tests/e2e/v0.1.5-roles-http.spec.ts
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
