# Feishu IAM

## 1. 项目介绍

Feishu IAM 是 Riversoft 内部身份与权限管理中台，用于把飞书身份、组织主数据、统一登录、应用接入、权限组/权限点、IAM 角色授权和审计追踪收拢到一个可部署、可升级、可追溯的系统中。

从 `v1.0.0` 开始，本项目按正式版口径维护 README。早期迭代记录保留在 `docs/` 和会话归档中，README 只面向当前正式版使用者和维护者。

核心能力：

- 统一 SSO Provider：第三方系统只对接 Feishu IAM，不直接保存飞书 `app_secret`。
- 飞书身份同步：飞书是身份和组织主数据来源，系统保存本地镜像用于登录、授权和排障。
- 应用接入管理：管理员可创建应用、登记回调地址、管理 OAuth 凭证和开发者 API 凭证。
- 权限模型：权限数据按应用隔离，Feishu IAM 返回权限组和权限点清单，第三方系统自行控制菜单、按钮和后端接口。
- 管理后台：基于 React + Vite、shadcn/ui、tweakcn 和 Tailwind CSS variables，`v1.0.0` 已完成 Riversoft 正式版视觉翻新，`v1.0.1` 已完成第三方 SSO 内部飞书回调兼容补丁，`v1.0.2` 已收口移动端列表、Tabs 和 OAuth 错误页 request id 复制边界。
- 审计与追踪：后台提供审计日志、安全事件和 request id 追踪入口，服务生产接入排障。

当前边界：

- 实现授权码流程子集，不实现完整 OIDC、SAML、refresh token、ABAC、资源级权限或 deny 规则。
- 管理后台使用管理员 session 和固定后台角色，平台管理员初始化只处理 IAM 管理权限。
- 默认部署方式为单机 Docker Compose，升级方式为停机静态升级，不做高可用或滚动升级。
- 明文 secret 只允许创建或轮换后展示一次；README、文档、日志和截图不得记录真实 secret、token、cookie、飞书 `app_secret` 或数据库密码。

技术栈：

| 层次 | 技术 |
| --- | --- |
| 后端 | NestJS |
| 前端 | React + Vite |
| UI | shadcn/ui + tweakcn + Tailwind CSS variables |
| 数据库 | PostgreSQL |
| ORM 与迁移 | Prisma + 版本化 SQL DDL |
| 部署 | Docker Compose |
| 升级 | `upgrade.sh` + 镜像内迁移执行器 |

主要目录：

```text
apps/api
apps/admin-web
deploy
docs
design
migrations
```

## 2. Quick Start

### 2.1 前置条件

服务器需要具备：

- Docker 和 Docker Compose。
- 能访问 GitHub Release 或项目内约定的镜像/离线包来源。
- 已准备飞书企业自建应用配置。
- 已确认首个平台管理员对应的飞书 `user_id`，初始化只会确保该用户获得 IAM 平台管理员权限。

不要把 GitHub token、Registry 凭证、飞书密钥、数据库密码、cookie 或其他 secret 写入仓库。

### 2.2 首次部署

正式版本部署使用 one-liner 下载部署文件：

```bash
curl -fsSL https://raw.githubusercontent.com/wodenwang/feishu-iam/v1.0.2/deploy/install.sh | FEISHU_IAM_VERSION=v1.0.2 bash
```

部署脚本会创建 `~/feishu-iam`，并写入：

```text
docker-compose.yml
upgrade.sh
.env
data/
config/
logs/
backups/
```

首次部署后只在服务器本地编辑 `~/feishu-iam/.env`。至少确认以下配置，示例值必须替换为本环境真实值：

```text
FEISHU_IAM_IMAGE_TAG=v1.0.2
APP_VERSION=1.0.2
FEISHU_IAM_PUBLIC_URL=https://feishu-iam.example.com
FEISHU_IAM_HEALTHCHECK_URL=https://feishu-iam.example.com
POSTGRES_PASSWORD=<服务器本地强密码>
DATABASE_URL=postgresql://feishu_iam:<URL编码后的数据库密码>@db:5432/feishu_iam?schema=public
CLIENT_SECRET_ENCRYPTION_KEY=<32字符本地加密密钥>
FEISHU_APP_ID=<飞书企业自建应用 app_id>
FEISHU_APP_SECRET=<飞书企业自建应用 app_secret>
FEISHU_OAUTH_REDIRECT_URI=https://feishu-iam.example.com/oauth/feishu/callback
FEISHU_ADMIN_OAUTH_REDIRECT_URI=https://feishu-iam.example.com/admin/auth/feishu/callback
INITIAL_PLATFORM_ADMIN_FEISHU_USER_ID=<首个平台管理员飞书 user_id>
```

启动或升级到目标版本：

```bash
cd ~/feishu-iam
FEISHU_IAM_IMAGE_TAG=v1.0.2 APP_VERSION=1.0.2 ./upgrade.sh
```

部署成功后检查：

```bash
curl -fsS https://feishu-iam.example.com/ready
curl -fsS https://feishu-iam.example.com/version
```

`/ready` 应返回 ready，`/version` 应返回 `1.0.2`。

### 2.3 当前正式版信息

当前正式版：

```text
v1.0.2
```

线上公网入口：

```text
https://feishu-iam.riversoft.com.cn/
```

GitHub Release：

```text
https://github.com/wodenwang/feishu-iam/releases/tag/v1.0.2
```

`v1.0.2` 是 `v1.0.1` 之后的前端 UI/UX P0 收口补丁。当前版本需要通过以下检查：

- `/ready` 返回 ready。
- `/version` 返回 `1.0.2`。
- 后台未登录统一问题提示页可展示 request id 和飞书登录入口。
- `/admin/auth/login` 可进入飞书登录跳转。
- `/oauth/feishu/callback` 和兼容旧路径 `/api/auth/feishu/callback` 都返回 Feishu IAM 业务错误页或业务跳转，不再返回框架默认 `Cannot GET ...`。
- `/oauth/authorize`、`/oauth/feishu/callback` 和 `/api/auth/feishu/callback` 的 HTML 错误页只复制 `request id`，不再复制整段问题信息。
- 390px 下应用管理、权限管理、管理员授权和操作审计列表使用可读移动端卡片，不再把长 key 逐字竖排。
- 390px 下操作审计、应用详情和角色详情 Tabs 不再静态撑破视口。
- Riversoft Logo、favicon 和 Sidebar 品牌区一致。
- 应用详情未登录深链不暴露 secret、token、cookie、飞书 `app_secret`、数据库密码或生产导出数据。
- “王文哲”已获得 IAM 平台管理员权限。

注意：`v1.0.2` 继续沿用 `v1.0.0` 的单机 Docker Compose 停机升级模型；如果生产环境 `FEISHU_OAUTH_REDIRECT_URI` 仍是旧 `/api/auth/feishu/callback`，服务会兼容处理，但新部署必须改为 `/oauth/feishu/callback`。

### 2.4 版本历史

#### v1.0.2

- 修复 390px 管理后台资源列表压缩问题，应用、权限、管理员授权和操作审计列表改为可读移动端卡片。
- 修复操作审计、应用详情和角色详情等多 Tab 页面在窄屏下撑破视口的问题。
- 修复 OAuth 公开错误页仍复制整段问题信息的问题，只保留 `request id` 展示和复制。
- 不新增 DDL，不改变 OAuth 协议、管理员 session、权限模型或第三方应用接入契约。
- GitHub Release：`https://github.com/wodenwang/feishu-iam/releases/tag/v1.0.2`。

#### v1.0.1

- 修复 GitHub issue `#2`：内部 Feishu OAuth 回调地址配置与实际路由不一致时，第三方 SSO 登录不再落到 `Cannot GET /api/auth/feishu/callback`。
- 保留 `/api/auth/feishu/callback` 兼容入口，推荐生产配置继续使用 `/oauth/feishu/callback`。
- 部署前必须确认 `FEISHU_OAUTH_REDIRECT_URI=https://feishu-iam.riversoft.com.cn/oauth/feishu/callback`。
- GitHub Release：`https://github.com/wodenwang/feishu-iam/releases/tag/v1.0.1`。
- canary 已完成；错误页 768px 横向溢出登记在 GitHub issue `#4`，OAuth 错误页整段问题信息复制登记在 GitHub issue `#5`。

#### v1.0.0

- Riversoft 正式版视觉翻新、平台管理员初始化、amd64 离线 tar 部署和线上 canary 已完成。
- GitHub Release：`https://github.com/wodenwang/feishu-iam/releases/tag/v1.0.0`。

### 2.5 本地开发

安装依赖：

```bash
pnpm install
```

常用检查：

```bash
pnpm check
pnpm --filter @feishu-iam/admin-web typecheck
pnpm --filter @feishu-iam/admin-web lint
pnpm --filter @feishu-iam/admin-web test
pnpm --filter @feishu-iam/admin-web test:buttons
```

前端响应式检查需要先启动本地 Admin Web：

```bash
pnpm --filter @feishu-iam/admin-web dev
ADMIN_WEB_URL=http://localhost:5173 pnpm --filter @feishu-iam/admin-web test:responsive
```

涉及管理后台 UI 的变更，完成后还需要使用真实浏览器检查 1440、768 和 390 视口。

## 3. 相关文档

### 3.1 正式版设计与验收

- [v1.0.2 UI/UX P0 验收记录](docs/acceptance/v1.0.2-uiux-p0.md)
- [v1.0.2 Product Design 视觉目标](design/v1.0.2-product-design-visual-target.md)
- [v1.0.2 响应式原型说明](design/v1.0.2-responsive-prototype.md)
- [v1.0.2 UI/UX 实施计划](docs/superpowers/plans/2026-06-13-feishu-iam-v1.0.2-uiux-p0.md)
- [v1.0.0 Riversoft 后台原型说明](design/v1.0.0-riversoft-admin-prototype.md)
- [v1.0.0 原型截图目录](design/exports/v1.0.0-riversoft-admin-prototype/)
- [v1.0.0 UI 翻新与管理员初始化验收](docs/acceptance/v1.0.0-riversoft-ui-init.md)
- [v1.0.0 浏览器验证证据目录](docs/acceptance/v1.0.0-riversoft-browser/)
- [v1.0.0 线上部署归档](docs/codex-sessions/2026-06-06-2305-v1.0.0-riversoft-land-deploy.md)
- [v1.0.0 canary 观察归档](docs/codex-sessions/2026-06-06-2320-v1.0.0-riversoft-canary.md)
- [v1.0.0 checkpoint 归档](docs/codex-sessions/2026-06-06-2334-v1.0.0-riversoft-checkpoint.md)
- [v1.0.1 OAuth 回调补丁发布与 canary 归档](docs/codex-sessions/2026-06-07-1031-v1.0.1-oauth-callback-release-canary.md)

### 3.2 架构、接入与排障

- [Feishu IAM 总体设计](docs/superpowers/specs/2026-05-15-feishu-iam-design.md)
- [管理后台设计基线](DESIGN.md)
- [飞书身份镜像同步](docs/feishu-identity-sync.md)
- [应用与权限模型](docs/permission-model.md)
- [SSO Provider 接入指南](docs/sso-provider.md)
- [Feishu IAM 接入排障指南](docs/oauth-troubleshooting.md)
- [Feishu IAM SSO Demo 独立仓库](https://github.com/wodenwang/feishu-iam-sso-demo)

### 3.3 部署与维护入口

- [部署脚本](deploy/install.sh)
- [升级脚本](deploy/upgrade.sh)
- [Docker Compose 模板](deploy/docker-compose.yml)
- [服务器环境变量模板](deploy/server.env.example)
- [迁移目录](migrations/)
- [Agent 工作指南](AGENTS.md)
- [Codex 会话归档目录](docs/codex-sessions/)
