# feishu-iam

`feishu-iam` 是一个以飞书作为唯一身份源的轻量 IAM Admin Console。它帮助团队把内部业务系统接入飞书身份、组织和权限体系：应用可以注册权限点，管理员可以按飞书用户或部门授权，第三方系统可以查询当前用户的权限点并据此控制页面和接口。

## 项目价值

- **飞书唯一身份源**：不维护独立 username/password，登录和管理员身份都绑定飞书用户。
- **第三方应用接入**：创建应用后获得 Application API 配置，业务系统可注册权限组和权限点。
- **角色授权闭环**：平台管理员可把权限点授权给飞书用户或部门。
- **审计可追溯**：应用创建、权限注册、授权变更、权限查询和 secret 复制动作都有审计记录。
- **可快速部署**：提供 Fastify + PostgreSQL runtime、Vite Admin Console 和 Docker Compose 启动路径。

## 当前能力

当前版本：`v0.2.1`

- Admin Console 支持真实飞书 OAuth 登录和首次平台管理员绑定。
- Runtime API 支持应用创建、应用列表、应用详情、接入配置、权限注册结果和应用审计查看。
- Runtime API 支持 OAuth redirect URI 新增、停用、恢复和 active authorize 校验。
- Runtime API 支持 `appSecret` / `apiSecret` 轮换，旧 secret 立即失效，新 secret 只返回一次。
- Runtime API 支持多应用管理员维护，并保护最后 1 位应用管理员不能被移除。
- 应用管理员登录后只能查看和管理自己负责的应用、角色授权和本应用审计。
- 平台管理员可以在 `飞书同步` 页面查看同步健康状态、运行权限预检、触发通讯录 full sync，并查看手动或定时同步历史、差异摘要和失败原因。
- 第三方 Demo 支持最小 OAuth Authorization Code 登录、token exchange 和按权限点展示页面。
- 第三方 Demo 从未登录浏览器发起 OAuth 时，IAM 登录成功后可恢复原始 authorize 请求并回到 Demo callback。
- Application API 支持 HMAC 鉴权、权限组/权限点注册和当前用户权限查询。
- 角色授权支持创建、编辑、停用和绑定权限组、权限点、飞书用户、飞书部门。
- 应用详情可一键复制第三方应用接入提示词，帮助 Codex / Claude Code 在业务系统中维护 `AGENTS.md` / `CLAUDE.md`。
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

3. 在飞书开放平台把 redirect URI 配成与 `FEISHU_REDIRECT_URI` 完全一致，并为该自建应用开通通讯录读取权限。同步 runtime 至少需要读取部门和用户基础信息的权限范围。

4. 启动：

   ```bash
   docker compose up -d --build
   docker compose ps
   curl http://127.0.0.1:${FEISHU_IAM_HOST_PORT:-8002}/api/health
   ```

## 第三方应用接入路径

1. 平台管理员通过飞书登录 Admin Console。
2. 进入 `应用管理`，创建业务系统应用。
3. 在应用详情查看 `appKey`、redirect URI、secret 状态、Application API endpoint、权限注册结果和最近调用记录。
4. 在 `接入配置` 维护 OAuth redirect URI，并在需要时轮换 `appSecret` / `apiSecret`。
5. 第三方系统通过 OAuth 登录 IAM，并通过 Application API 注册权限组和权限点。
6. 平台管理员或应用管理员在 `角色授权` 中把权限点授权给飞书用户或部门。
7. 第三方系统调用当前用户权限查询接口，根据权限点控制页面和接口。

本仓库提供最小 Demo：

```bash
cp examples/thirdparty-demo/.env.example examples/thirdparty-demo/.env
npm --prefix examples/thirdparty-demo run dev
```

详细说明见 [docs/integration/thirdparty-demo.md](docs/integration/thirdparty-demo.md)。

Application API 请求使用 HMAC header 鉴权。真实 secret 只应写入运行时环境变量或 secret manager，不应写入代码仓库。

## v0.2 应用接入生产化验收

当前版本提供应用接入生产化自动验收脚本，用来证明 redirect URI 管理、OAuth active URI 校验、secret 轮换、应用管理员保护和配置审计可以串起来：

```bash
DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/feishu_iam \
SESSION_SECRET=local-session-secret-at-least-32-bytes \
FEISHU_AUTH_MODE=mock \
npm run server:dev
```

在另一个终端运行：

```bash
RUNTIME_API_BASE_URL=http://127.0.0.1:4100 \
bash scripts/verify-v0.2-application-onboarding.sh
```

脚本会创建临时应用，新增和停用/恢复 redirect URI，验证 disabled URI 不能 authorize，轮换 `appSecret` 和 `apiSecret` 并确认旧 secret 失效，新增/移除应用管理员并验证最后管理员保护，最后检查配置审计动作。脚本不输出一次性 secret、cookie、bearer token、authorization code 或 HMAC signature。

建议在干净数据库中运行该脚本，或使用已由 `ou_v012_verify_admin` 初始化的平台管理员测试库；如果本地库已绑定其他平台管理员，可通过 `VERIFY_PLATFORM_ADMIN_FEISHU_USER_ID=<feishu-user-id>` 指定脚本登录用户。

真实飞书验收仍需要在飞书开放平台手动配置 Admin Console 登录 redirect URI、第三方应用 OAuth redirect URI、通讯录读取权限和部署环境白名单；真实凭证只应写入运行时环境变量或 secret manager，不要写入仓库。

## v0.1 接入闭环验收

保留 v0.1 接入闭环脚本，用来证明 IAM runtime、OAuth、Application API、角色授权、同步预检和审计链路可以串起来：

```bash
DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/feishu_iam \
SESSION_SECRET=local-session-secret-at-least-32-bytes \
FEISHU_AUTH_MODE=mock \
npm run server:dev
```

在另一个终端运行：

```bash
RUNTIME_API_BASE_URL=http://127.0.0.1:4100 \
bash scripts/verify-v0.1-access-loop.sh
```

脚本会创建临时 demo 应用，注册 `demo.customer:view` 权限点，授权一个 mock 飞书用户，通过 OAuth code/token 获取第三方 bearer token，并验证有权限用户可获得权限、无权限用户无法获得权限。脚本只输出 `appKey` 和权限摘要，不输出一次性 secret、cookie、bearer token 或 HMAC signature。

建议在干净数据库中运行该脚本，或使用已经由 `ou_v017_verify_admin` 完成首次平台管理员绑定的本地测试库；脚本不会绕过飞书身份边界或直接写数据库。

浏览器验收可继续使用 `examples/thirdparty-demo`，把应用创建时得到的一次性 `appSecret` / `apiSecret` 写入本地 `.env` 后访问 `http://127.0.0.1:4200`。真实飞书验收需要额外在飞书开放平台配置 redirect URI、通讯录读取权限和部署环境白名单；不要把真实凭证写入仓库。

## 安全边界

- 飞书是组织结构、用户和登录认证的唯一来源。
- 不新增独立 username/password 登录体系。
- 生产环境禁止 `FEISHU_AUTH_MODE=mock`。
- 不提交飞书 App Secret、tokens、应用 secret、导出用户列表或同步快照。
- 应用提示词默认只包含 secret 环境变量名，不包含真实 secret。
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
