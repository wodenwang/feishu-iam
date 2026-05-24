# feishu-iam

`feishu-iam` 是一个以飞书作为唯一身份源的轻量 IAM Admin Console。它帮助团队把内部业务系统接入飞书身份、组织和权限体系：应用可以注册权限点，管理员可以按飞书用户或部门授权，第三方系统可以查询当前用户的权限点并据此控制页面和接口。

## 项目价值

- **飞书唯一身份源**：不维护独立 username/password，登录和管理员身份都绑定飞书用户。
- **第三方应用接入**：创建应用后获得 Application API 配置，业务系统可注册权限组和权限点。
- **角色授权闭环**：平台管理员可把权限点授权给飞书用户或部门。
- **审计可追溯**：应用创建、权限注册、授权变更、权限查询和 secret 复制动作都有审计记录。
- **可快速部署**：提供 Fastify + PostgreSQL runtime、Vite Admin Console 和 Docker Compose 启动路径。

## 当前能力

当前版本：`v0.1.11`

- Admin Console 支持真实飞书 OAuth 登录和首次平台管理员绑定。
- Runtime API 支持应用创建、应用列表、应用详情、接入配置、权限注册结果和应用审计查看。
- Application API 支持 HMAC 鉴权、权限组/权限点注册和当前用户权限查询。
- 角色授权支持创建、编辑、停用和绑定权限点、飞书用户、飞书部门。
- `/directory` 支持飞书组织和用户投影的只读浏览。
- 登录页、Admin Shell、UserMenu、退出登录和核心表格状态已经按 Ant Design 后台模式重构。

## 技术栈

- Frontend: React, TypeScript, Vite, Ant Design, React Router, TanStack Query
- Backend: Fastify, PostgreSQL
- Testing: Vitest, Playwright
- Deployment: Docker Compose

## 5 分钟本地启动

1. 安装依赖：

   ```bash
   npm install
   ```

2. 准备 PostgreSQL。你可以使用本机 PostgreSQL，也可以用 Docker 临时启动：

   ```bash
   docker run --rm --name feishu-iam-postgres \
     -e POSTGRES_PASSWORD=postgres \
     -e POSTGRES_DB=feishu_iam \
     -p 5432:5432 \
     postgres:16-alpine
   ```

3. 启动后端 runtime：

   ```bash
   DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/feishu_iam \
   SESSION_SECRET=local-session-secret-at-least-32-bytes \
   FEISHU_AUTH_MODE=mock \
   npm run server:dev
   ```

4. 启动前端：

   ```bash
   VITE_IAM_API_MODE=http npm run dev -- --host 127.0.0.1
   ```

5. 打开：

   ```text
   http://127.0.0.1:5173/login
   ```

本地开发模式可以使用 `Mock 开发登录（仅本地）` 进入系统。生产环境必须使用真实飞书登录。

## 快速 Docker Compose 部署

1. 复制配置模板：

   ```bash
   cp .env.example .env
   ```

2. 编辑 `.env`，至少设置：

   ```text
   FEISHU_IAM_HOST_PORT=8002
   POSTGRES_PASSWORD=<replace-me-postgres-password>
   SESSION_SECRET=<replace-me-at-least-32-characters>
   FEISHU_AUTH_MODE=real
   FEISHU_APP_ID=<replace-me>
   FEISHU_APP_SECRET=<replace-me>
   FEISHU_REDIRECT_URI=https://<your-domain>/api/auth/feishu/callback
   ```

3. 在飞书开放平台把 redirect URI 配成与 `FEISHU_REDIRECT_URI` 完全一致。

4. 启动：

   ```bash
   docker compose up -d --build
   docker compose ps
   curl http://127.0.0.1:${FEISHU_IAM_HOST_PORT:-8002}/api/health
   ```

## 第三方应用接入路径

1. 平台管理员通过飞书登录 Admin Console。
2. 进入 `应用管理`，创建业务系统应用。
3. 在应用详情查看 `appKey`、Application API endpoint、权限注册结果和最近调用记录。
4. 在 `应用接入向导` 复制 Agent Prompt 或运行时环境变量模板。
5. 第三方系统通过 Application API 注册权限组和权限点。
6. 平台管理员在 `角色授权` 中把权限点授权给飞书用户或部门。
7. 第三方系统调用当前用户权限查询接口，根据权限点控制页面和接口。

Application API 请求使用 HMAC header 鉴权。真实 secret 只应写入运行时环境变量或 secret manager，不应写入代码仓库。

## 安全边界

- 飞书是组织结构、用户和登录认证的唯一来源。
- 不新增独立 username/password 登录体系。
- 生产环境禁止 `FEISHU_AUTH_MODE=mock`。
- 不提交飞书 App Secret、tokens、应用 secret、导出用户列表或同步快照。
- Agent Prompt 默认只包含 secret 占位符，不包含真实 secret。
- 创建应用返回的 secret 只显示一次，后续页面只显示占位符或状态。

## 常用验证命令

```bash
npm run server:test
npm test
npm run build
npm run server:build
npm run e2e
```

针对 HTTP runtime 的本地 E2E 通常需要显式测试数据库，例如：

```bash
E2E_RESET_DATABASE=true \
TEST_DATABASE_URL=postgres://postgres:postgres@127.0.0.1:55433/feishu_iam_test \
VITE_IAM_API_MODE=http \
RUNTIME_API_BASE_URL=http://127.0.0.1:4100 \
npm run e2e
```

## 文档入口

- 产品规格：[docs/v0.1-product-spec.md](docs/v0.1-product-spec.md)
- 架构说明：[docs/architecture.md](docs/architecture.md)
- 项目 AI 开发规范：[AGENTS.md](AGENTS.md)
- 设计规范：[DESIGN.md](DESIGN.md)
