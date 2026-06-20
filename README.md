# Feishu IAM

## 1. 项目介绍

Feishu IAM 是 Riversoft 内部身份与权限管理中台，用于把飞书身份、组织主数据、统一登录、应用接入、权限组/权限点、IAM 角色授权和审计追踪收拢到一个可部署、可升级、可追溯的系统中。

从 `v1.0.0` 开始，本项目按正式版口径维护 README。早期迭代记录保留在 `docs/` 和会话归档中，README 只面向当前正式版使用者和维护者。

核心能力：

- 统一 SSO Provider：第三方系统只对接 Feishu IAM，不直接保存飞书 `app_secret`。
- 飞书身份同步：飞书是身份和组织主数据来源，系统保存本地镜像用于登录、授权和排障。
- 应用接入管理：管理员可创建应用、登记回调地址、管理 OAuth 凭证和开发者 API 凭证。
- 权限模型：权限数据按应用隔离，Feishu IAM 返回权限组和权限点清单，第三方系统自行控制菜单、按钮和后端接口。
- 管理后台：基于 React + Vite、shadcn/ui、tweakcn 和 Tailwind CSS variables，`v1.0.0` 已完成 Riversoft 正式版视觉翻新，`v1.0.1` 已完成第三方 SSO 内部飞书回调兼容补丁，`v1.0.2` 已收口移动端列表、Tabs 和 OAuth 错误页 request id 复制边界，`v1.0.3` 已收口 Base Portal 接入包与完整提示词主流程，`v1.0.4` 已支持第三方 iframe 场景的 OAuth silent SSO，`v1.0.5` 正在收口权限管理角色配置工作台。
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
curl -fsSL https://raw.githubusercontent.com/wodenwang/feishu-iam/v1.0.5/deploy/install.sh | FEISHU_IAM_VERSION=v1.0.5 bash
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
FEISHU_IAM_IMAGE_TAG=v1.0.5
APP_VERSION=1.0.5
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
FEISHU_IAM_IMAGE_TAG=v1.0.5 APP_VERSION=1.0.5 ./upgrade.sh
```

部署成功后检查：

```bash
curl -fsS https://feishu-iam.example.com/ready
curl -fsS https://feishu-iam.example.com/version
```

`/ready` 应返回 ready，`/version` 应返回 `1.0.5`。

### 2.3 当前版本信息

当前源码开发版本：

```text
v1.0.5
```

最新已发布正式版：

```text
v1.0.5
```

线上公网入口：

```text
https://feishu-iam.riversoft.com.cn/
```

GitHub Release：

```text
https://github.com/wodenwang/feishu-iam/releases/tag/v1.0.5
```

`v1.0.5` 是权限管理角色配置工作台重构版本，是 `v1.0.4` 之后的权限管理流程重构版本。它让角色成为独立资源，支持角色与应用多对多绑定，并把角色授权配置收敛到独立工作台。`v1.0.5` 已通过以下本地与浏览器检查；生产部署验收会在 step15 完成后追加记录：

- `pnpm check` 通过：类型检查、lint、后端 41 个测试文件 484 个用例、前端 18 个测试文件 159 个用例通过。
- `pnpm build` 通过：后端 NestJS 构建完成，前端 Vite 生产构建完成；Vite chunk size warning 为既有构建提示。
- 权限管理角色列表支持新增、编辑、启用 / 停用、批量启停、多条件查询和分页。
- 角色配置工作台使用独立页面，支持返回角色列表；旧 `tab=subjects` / `tab=groups` / `tab=permissions` 深链兼容到新工作台。
- 组织与用户绑定继续在同一个 `OrgUserSelector` 中勾选组织节点和用户节点。
- 应用权限绑定支持应用切换、应用关联、权限组选择、权限点查看和权限点对比。
- 应用详情已移除原 `角色管理` Tab、入口、按钮和相关操作；权限资产查看、查询和比对仍可用。
- 后台未登录统一问题提示页可展示 request id 和飞书登录入口。
- `/admin/auth/login` 可进入飞书登录跳转。
- `/oauth/feishu/callback` 和兼容旧路径 `/api/auth/feishu/callback` 都返回 Feishu IAM 业务错误页或业务跳转，不再返回框架默认 `Cannot GET ...`。
- `/oauth/authorize`、`/oauth/feishu/callback` 和 `/api/auth/feishu/callback` 的 HTML 错误页只复制 `request id`，不再复制整段问题信息。
- 390px 下应用管理、权限管理、管理员授权和操作审计列表使用可读移动端卡片，不再把长 key 逐字竖排。
- 390px 下操作审计、应用详情和角色详情 Tabs 不再静态撑破视口。
- Riversoft Logo、favicon 和 Sidebar 品牌区一致。
- 应用详情未登录深链不暴露 secret、token、cookie、飞书 `app_secret`、数据库密码或生产导出数据。
- 应用详情 `开发信息` Tab 可通过强确认刷新 OAuth `client_secret` 和 developer API token，并生成包含完整接入参数的 Codex 提示词。
- `/oauth/authorize?prompt=none` 在 IAM SSO session 有效时 302 回第三方 `redirect_uri` 并携带授权码和原始 `state`。
- `/oauth/authorize?prompt=none` 在未登录、session 失效或应用策略不允许时 302 回第三方 `redirect_uri`，携带稳定 OAuth error 和原始 `state`，不渲染 IAM 登录页。
- 普通 OAuth 登录成功后设置 httpOnly、Secure 的 IAM SSO cookie；前端不可读写。
- OAuth HTML 错误页继续只展示 request id，并设置 `X-Frame-Options: DENY` 与 `Content-Security-Policy: frame-ancestors 'none'`。
- `feishu-iam-sso-demo` 预置允许 silent SSO 的生产 origin：`https://feishu-iam-sso-demo.riversoft.com.cn`。
- “王文哲”已获得 IAM 平台管理员权限。

注意：`v1.0.5` 继续沿用 `v1.0.0` 的单机 Docker Compose 停机升级模型；如果生产环境 `FEISHU_OAUTH_REDIRECT_URI` 仍是旧 `/api/auth/feishu/callback`，服务会兼容处理，但新部署必须改为 `/oauth/feishu/callback`。

### 2.4 版本历史

#### v1.0.5

- 角色从应用内资源调整为独立资源，角色与应用通过 `iam_role_applications` 支持多对多绑定。
- 权限管理首屏调整为全局角色列表，应用只作为筛选条件；角色列表保留新增、编辑、启用 / 停用和配置入口。
- 角色配置工作台使用独立页面，不再以抽屉承载；工作台拆成 `组织与用户` 和 `应用权限` 两个工作区，并保留旧 `tab=subjects` / `tab=groups` 深链兼容。
- `组织与用户` 工作区继续复用同一个组织用户选择器，在同一棵组织树内勾选组织节点和用户节点。
- `应用权限` 工作区按应用上下文绑定权限组、查看最终权限点，并保留权限点对比能力。
- 应用管理移除原 `角色管理` Tab、入口和角色 CRUD 操作，聚焦应用详情、密钥、回调、Codex 提示词和权限资产查看。
- 本版本 release commit 只记录本地实现、验证和发布入口；生产镜像 digest、升级备份和线上验收结果会在 step15 部署完成后追加记录。

#### v1.0.4

- `/oauth/authorize` 支持 `prompt=none`。已有 IAM SSO session 且应用策略允许时，直接签发 authorization code 并 302 回第三方 `redirect_uri`。
- 未登录或策略不允许时，silent SSO 不渲染 IAM 登录页，而是回跳 `error=login_required` 或 `error=unauthorized_client` 并保留原始 `state`。
- 新增应用级 `silent_sso_enabled` 与 `silent_sso_allowed_origins`，默认关闭；迁移为 `feishu-iam-sso-demo` 预置生产 origin。
- 新增 `oauth_browser_sessions`，只保存 session hash 和过期/撤销信息；cookie 为 httpOnly、Secure，前端不可读写。
- OAuth HTML 错误页设置严格 frame policy，不允许任意站点 iframe 嵌入 IAM 登录/错误交互页。
- 不改变 Base Portal 边界：Portal 不传 token、cookie、authorization code 或 secret，也不代理第三方鉴权。

#### v1.0.3

- 应用详情 `开发信息` Tab 新增 `刷新凭证并生成完整提示词` 主流程，一次确认后轮换 OAuth `client_secret` 和 developer API token。
- 完整提示词包含 `FEISHU_IAM_URL`、`app_key`、`client_id`、`client_secret`、`developer_api_token`、回调地址、OAuth 流程、权限查询、Developer API 权限边界和验收 checklist。
- `base-portal` 应用自动追加 Portal preset：菜单权限点建议、`iframe` / `immersive_iframe` / `new_tab` 打开方式和 iframe 无感 SSO 验收矩阵。
- developer API token 仍不长期明文保存；需要完整提示词时通过轮换生成，旧 token 立即失效。
- 不新增 DDL，不改变 OAuth 协议、管理员 session、权限模型、redirect_uri 精确匹配规则或部署拓扑。
- GitHub Release：`https://github.com/wodenwang/feishu-iam/releases/tag/v1.0.3`。
- 生产部署：`bpmt@120.24.236.92:/home/bpmt/feishu-iam` 曾运行 `feishu-iam:v1.0.3`，`/ready` ready，`/version` 返回 `1.0.3 / 53f94b0`。

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

- [v1.0.4 OAuth silent SSO 验收记录](docs/acceptance/v1.0.4-oauth-silent-sso.md)
- [v1.0.4 OAuth silent SSO 设计说明](docs/superpowers/specs/2026-06-20-feishu-iam-v1.0.4-oauth-silent-sso.md)
- [v1.0.5 权限管理角色配置工作台设计说明](docs/superpowers/specs/2026-06-20-feishu-iam-v1.0.5-permission-workbench.md)
- [v1.0.5 权限管理 SOP](design/v1.0.5-permission-management-sop.md)
- [v1.0.5 权限管理静态原型](design/prototypes/v1.0.5-permission-management/index.html)
- [v1.0.5 权限管理实施计划](docs/superpowers/plans/2026-06-20-feishu-iam-v1.0.5-permission-workbench.md)
- [v1.0.2 UI/UX P0 验收记录](docs/acceptance/v1.0.2-uiux-p0.md)
- [v1.0.3 Base Portal 接入包验收记录](docs/acceptance/v1.0.3-base-portal-integration-prompt.md)
- [v1.0.3 Base Portal 接入包设计稿](docs/superpowers/specs/2026-06-20-feishu-iam-v1.0.3-base-portal-integration-prompt.md)
- [v1.0.3 Base Portal 接入包实施计划](docs/superpowers/plans/2026-06-20-feishu-iam-v1.0.3-base-portal-integration-prompt.md)
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
- [部署说明](DEPLOY.md)
- [升级脚本](deploy/upgrade.sh)
- [Docker Compose 模板](deploy/docker-compose.yml)
- [服务器环境变量模板](deploy/server.env.example)
- [迁移目录](migrations/)
- [Agent 工作指南](AGENTS.md)
- [Codex 会话归档目录](docs/codex-sessions/)
