# Feishu IAM

## 1. 项目介绍

Feishu IAM 是企业内部身份与权限管理中台，用于把飞书身份、组织主数据、统一登录、应用接入、权限组/权限点、IAM 角色授权和审计追踪收拢到一个可部署、可升级、可追溯的系统中。

第一版服务目标是让内部 Web 系统只对接 Feishu IAM，而不直接保存飞书应用密钥。管理员在 Feishu IAM 中创建应用、登记回调地址、生成 OAuth 凭证和开发者 API 凭证；第三方应用通过 Feishu IAM 完成登录、换取 Feishu IAM access token、读取当前用户信息和应用内权限清单，再自行控制菜单、按钮、后端接口和业务行为。

第三方接入闭环已通过独立示例仓库 [feishu-iam-sso-demo](https://github.com/wodenwang/feishu-iam-sso-demo) 验证。该 demo 覆盖 Feishu IAM OAuth 登录、授权码换取 access token、`/oauth/userinfo`、应用权限查询、前端权限展示、刷新权限和退出登录，可作为后续内部系统接入的参考实现。

当前能力边界：

- 飞书是身份和组织主数据唯一来源，Feishu IAM 只使用一个企业级飞书自建应用。
- Feishu IAM 是统一 SSO Provider，实现授权码流程子集，不实现完整 OIDC、SAML 或 refresh token。
- 权限数据按应用隔离，Feishu IAM 返回权限组和权限点清单，不做第三方业务资源级判断。
- 管理后台使用管理员 session 和固定后台角色，支持平台管理员、应用管理员、审计查看和同步管理边界。
- 默认部署方式为单机 Docker Compose，升级方式为停机静态升级，不做高可用或滚动升级。

技术栈：

| 层次       | 技术                            |
| ---------- | ------------------------------- |
| 后端       | NestJS                          |
| 前端       | React + Vite                    |
| 数据库     | PostgreSQL                      |
| ORM 与迁移 | Prisma + 版本化 SQL DDL         |
| 部署       | Docker Compose                  |
| 升级       | `upgrade.sh` + 镜像内迁移执行器 |

主要目录：

```text
apps/api
apps/admin-web
deploy
docs
docs/codex-sessions
migrations
```

## 2. Quick Start

### 2.1 前置条件

服务器需要具备：

- Docker 和 Docker Compose。
- 能访问 GitHub 和内网 Docker Registry。
- 已准备飞书企业自建应用配置。
- 已确认首个平台管理员对应的飞书 `user_id`。

如服务器 Docker 还没有信任内网 HTTP Registry，需要在 Docker daemon 配置中加入：

```json
{
  "insecure-registries": [
    "dockerhub.it.tangtring.com",
    "dockerhub.it.tangtring.com:80"
  ]
}
```

然后重启 Docker，并登录 Registry：

```bash
docker login dockerhub.it.tangtring.com:80
```

不要把 GitHub token、Registry 凭证、飞书密钥、数据库密码、cookie 或其他 secret 写入仓库。

### 2.2 首次部署

正式版本部署使用 one-liner 下载部署文件：

```bash
curl -fsSL https://raw.githubusercontent.com/wodenwang/feishu-iam/v1.0.0/deploy/install.sh | FEISHU_IAM_VERSION=v1.0.0 bash
```

如果正式 tag 尚未创建，验证主线最新部署文件可临时使用：

```bash
curl -fsSL https://raw.githubusercontent.com/wodenwang/feishu-iam/main/deploy/install.sh | FEISHU_IAM_VERSION=v1.0.0 bash
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

首次部署后只在服务器本地编辑 `~/feishu-iam/.env`，至少确认这些配置：

```text
FEISHU_IAM_IMAGE_TAG=v1.0.0
APP_VERSION=1.0.0
FEISHU_IAM_PUBLIC_URL=http://feishu-iam.dev.tangtring.com
FEISHU_IAM_HEALTHCHECK_URL=http://192.168.2.112:8000
POSTGRES_PASSWORD=<服务器本地强密码>
DATABASE_URL=postgresql://feishu_iam:<URL编码后的数据库密码>@db:5432/feishu_iam?schema=public
CLIENT_SECRET_ENCRYPTION_KEY=<32字符本地加密密钥>
FEISHU_APP_ID=<飞书企业自建应用 app_id>
FEISHU_APP_SECRET=<飞书企业自建应用 app_secret>
FEISHU_OAUTH_REDIRECT_URI=http://feishu-iam.dev.tangtring.com/oauth/feishu/callback
FEISHU_ADMIN_OAUTH_REDIRECT_URI=http://feishu-iam.dev.tangtring.com/admin/auth/feishu/callback
INITIAL_PLATFORM_ADMIN_FEISHU_USER_ID=<首个平台管理员飞书 user_id>
```

启动：

```bash
cd ~/feishu-iam
./upgrade.sh
```

部署成功后检查：

```bash
curl -fsS http://feishu-iam.dev.tangtring.com/ready
curl -fsS http://feishu-iam.dev.tangtring.com/version
```

`/version` 应返回 `1.0.0`。

### 2.3 已运行实例升级

停机升级到指定版本：

```bash
cd ~/feishu-iam
FEISHU_IAM_IMAGE_TAG=v1.0.0 APP_VERSION=1.0.0 ./upgrade.sh
```

`upgrade.sh` 会执行：

1. 可选 Git 同步部署目录。
2. 拉取目标 Web 镜像。
3. 停止 `web` 服务。
4. 启动并等待 `db` 健康。
5. 备份 PostgreSQL 到 `backups/`。
6. 通过镜像内迁移执行器应用 `migrations/`。
7. 启动 `web`。
8. 检查 `/ready` 和 `/version`。

本系统当前不做高可用，升级前可以短暂停服务。

### 2.4 镜像下载信息

当前发布镜像：

```text
dockerhub.it.tangtring.com:80/ai/feishu-iam:v0.9.0
dockerhub.it.tangtring.com:80/ai/feishu-iam:v0.9.1
dockerhub.it.tangtring.com:80/ai/feishu-iam:v0.10.0
dockerhub.it.tangtring.com:80/ai/feishu-iam:v0.10.1
dockerhub.it.tangtring.com:80/ai/feishu-iam:v0.10.3
dockerhub.it.tangtring.com:80/ai/feishu-iam:v0.10.4
dockerhub.it.tangtring.com:80/ai/feishu-iam:v0.11.0
dockerhub.it.tangtring.com:80/ai/feishu-iam:v0.11.1
dockerhub.it.tangtring.com:80/ai/feishu-iam:v0.11.2
dockerhub.it.tangtring.com:80/ai/feishu-iam:v0.11.3
dockerhub.it.tangtring.com:80/ai/feishu-iam:v0.12.0
dockerhub.it.tangtring.com:80/ai/feishu-iam:v0.13.0
dockerhub.it.tangtring.com:80/ai/feishu-iam:v0.13.1
dockerhub.it.tangtring.com:80/ai/feishu-iam:v0.14.0
dockerhub.it.tangtring.com:80/ai/feishu-iam:v0.14.1
dockerhub.it.tangtring.com:80/ai/feishu-iam:v0.14.2
dockerhub.it.tangtring.com:80/ai/feishu-iam:v0.15.0
dockerhub.it.tangtring.com:80/ai/feishu-iam:v0.15.1
dockerhub.it.tangtring.com:80/ai/feishu-iam:v0.15.2
dockerhub.it.tangtring.com:80/ai/feishu-iam:v0.16.0
dockerhub.it.tangtring.com:80/ai/feishu-iam:v0.16.1
dockerhub.it.tangtring.com:80/ai/feishu-iam:v0.16.2
dockerhub.it.tangtring.com:80/ai/feishu-iam:v1.0.0
dockerhub.it.tangtring.com:80/ai/feishu-iam:latest
```

`v1.0.0` 多架构 manifest digest 将在 `gstack /ship` 完成镜像发布后写入本节。

`v0.16.2` 多架构 manifest digest：

```text
sha256:09cef06e3adfbbde7cf60124ef4e23b347b27184f0393cce11bd77e242eef5c5
```

`v0.16.1` 多架构 manifest digest：

```text
sha256:c382b674a9581c7066ae92e0114b3abcf46c026772f360bf4c27b524ce9cfe52
```

`v0.16.0` 多架构 manifest digest：

```text
sha256:e4c469ce15223d05d7d241adb48325a54b8da8828c0e9d10d30f4228d5f1e43d
```

`v0.15.2` 多架构 manifest digest：

```text
sha256:864d87d79384a9cce763c189198c03352edc5255a35f9eb3107e275ebd4147ab
```

`v0.15.1` 多架构 manifest digest：

```text
sha256:83adf0dd0c37f939645c11404c0a169be2207b18fa9131166cff3dee4380ff93
```

`v0.15.0` 多架构 manifest digest：

```text
sha256:94ab39ed247f3e8129cab62a91a78bf7bbbbff3017f6a66b74a1e09e099eab79
```

`v0.14.2` 多架构 manifest digest：

```text
sha256:754fab751d132100c8f6fc2b990918d212b53ae7c21fef94e69320dd74289b27
```

`v0.14.1` 多架构 manifest digest：

```text
sha256:b46fe5fb59cebe1aa54a02afd0cfaa347895ce9421dbdcd16b32e1fff3a54621
```

`v0.14.0` 多架构 manifest digest：

```text
sha256:ef1056f1ec36e223b2b71f08d5f119b3e2a718abef7aa239514f9ac14bc36582
```

`v0.13.1` 多架构 manifest digest：

```text
sha256:77b0ae687635428ab611cd77bb67cb79ea92557b0f46e4a9d71fa7f1b8dcf055
```

`v0.13.0` 多架构 manifest digest：

```text
sha256:657b5697e32a4e138a07cb95b9414a09341ec932ab7e8f3c09d0bac8ffd99b76
```

`v0.12.0` 多架构 manifest digest：

```text
sha256:be56fdc2d59841d52c8904acdb906353a07fc580ba912c8f5ca87ad5742942e0
```

`v0.11.3` 多架构 manifest digest：

```text
sha256:33385133b16cee506376975855a5a3f7044e3c4a5903c81f06e1f26abbce0af6
```

`v0.11.2` 多架构 manifest digest：

```text
sha256:252b60decca1021baea685e0abd024c8d54ae07d42df840920880596248a1f88
```

`v0.11.1` 多架构 manifest digest：

```text
sha256:802e0691e86b2d94f0237099b1f738484968b967bf18af1fe3183cc2ab817654
```

下载与架构校验：

```bash
docker pull --platform linux/amd64 dockerhub.it.tangtring.com:80/ai/feishu-iam:v1.0.0
docker pull --platform linux/arm64 dockerhub.it.tangtring.com:80/ai/feishu-iam:v1.0.0
```

发布多架构镜像的标准命令：

```bash
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  --provenance=false \
  --sbom=false \
  -f deploy/api.Dockerfile \
  -t dockerhub.it.tangtring.com:80/ai/feishu-iam:v1.0.0 \
  -t dockerhub.it.tangtring.com:80/ai/feishu-iam:latest \
  --push .
```

`v0.10.3` 历史镜像 digest 为 `sha256:0e1d2709e9fe5fbeb734ad556aca1ba14bb28a505554d74f4d9f3cd95a4cfe8e`。
`v0.10.1` 历史镜像 digest 为 `sha256:461780bb56a2e641d8dc4fad2f5994c575a064e750514b9842fd01c78ba0b917`。
`v0.10.0` 历史镜像 digest 为 `sha256:2e594d8d0b2c10cd6ae826d500eadf96c49aacbd1800f94115c6410197a81846`。
`v0.9.1` 历史镜像 digest 为 `sha256:e21a8c1e4ab92c46604e6d9587ee32017f69a7e47eaf886580393975a8b658a0`。
`v0.9.0` 历史镜像 digest 为 `sha256:8d6fc671a9de55347ee023cf3617db50beb69483a7b211b4b89549cd7691e03f`。

## 3. 版本历史

| 版本         | 状态           | 核心过程                                                                                                                                                                                                                                                        | 部署或镜像信息                                                                                                                                                                                                                                                                       | 详细文档                                                                                                                                                                                                                                                                               |
| ------------ | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `v0.1.0`     | 已收口         | 初始化中文设计、Agent 工作指南、TypeScript monorepo、NestJS API、React 管理端、Prisma 基线和 Docker Compose 骨架。                                                                                                                                              | 本地基础工程版本。                                                                                                                                                                                                                                                                   | [基础设计](docs/superpowers/specs/2026-05-15-feishu-iam-design.md)                                                                                                                                                                                                                       |
| `v0.2.0`     | 已收口         | 实现飞书组织与用户只读镜像、同步 run log、平台 API 和管理端状态页。                                                                                                                                                                                             | 本地 Compose 验证。                                                                                                                                                                                                                                                                  | [飞书身份镜像同步设计](docs/superpowers/specs/2026-05-15-feishu-iam-v0.2.0-feishu-identity-sync-design.md)                                                                                                                                                                               |
| `v0.2.1`     | 已收口         | 增加飞书字段完整性诊断和真实同步发布门槛。                                                                                                                                                                                                                      | 真实飞书字段诊断。                                                                                                                                                                                                                                                                   | [字段就绪设计](docs/superpowers/specs/2026-05-15-feishu-iam-v0.2.1-feishu-field-readiness-design.md)                                                                                                                                                                                     |
| `v0.2.2`     | 已收口         | 修复真实同步验收发现的字段权限、部门 ID 类型和旧镜像主键迁移问题。                                                                                                                                                                                              | 真实飞书同步补丁。                                                                                                                                                                                                                                                                   | [飞书身份镜像同步](docs/feishu-identity-sync.md)                                                                                                                                                                                                                                       |
| `v0.3.0`     | 已收口         | 建立应用、权限组、权限点、IAM 角色、主体绑定、角色授权、权限计算和审计日志。                                                                                                                                                                                    | 数据库迁移 `V0_3_0__permission_model.sql`。                                                                                                                                                                                                                                          | [应用与权限模型](docs/permission-model.md)                                                                                                                                                                                                                                             |
| `v0.4.0`     | 已收口         | 实现 SSO Provider 授权码流程子集、Feishu IAM token、`/oauth/userinfo`、应用侧权限查询和 token 撤销。                                                                                                                                                              | 本机真实浏览器验收流程。                                                                                                                                                                                                                                                             | [SSO Provider 设计](docs/superpowers/specs/2026-05-16-feishu-iam-v0.4.0-sso-provider-design.md)                                                                                                                                                                                          |
| `v0.5.0`     | 已收口         | 实现管理后台与管理员体系：飞书管理员登录、固定后台角色、应用管理范围、管理员 session、审计日志和安全事件查询。                                                                                                                                                  | 管理后台最小闭环。                                                                                                                                                                                                                                                                   | [管理后台设计](docs/superpowers/specs/2026-05-17-feishu-iam-v0.5.0-admin-console-design.md)                                                                                                                                                                                              |
| `v0.5.1`     | 已收口         | 完成真实飞书验证闭环、本地和服务器验收准备、镜像发布收口。                                                                                                                                                                                                      | 历史镜像发布记录见会话归档。                                                                                                                                                                                                                                                         | [飞书验证闭环设计](docs/superpowers/specs/2026-05-17-feishu-iam-v0.5.1-feishu-verification-design.md)                                                                                                                                                                                    |
| `v0.6.0`     | 已收口         | 生产化 Docker Compose 部署与停机升级闭环，初始化首个平台管理员，退出生产破窗入口。                                                                                                                                                                              | `dockerhub.it.tangtring.com:80/ai/feishu-iam:v0.6.0`，digest `sha256:760fd39424ef96fbaff6206972d7c2e76ea962f4c39571c4e2979691044f7548`。                                                                                                                                               | [部署说明](docs/deploy-v0.6.0.md)                                                                                                                                                                                                                                                      |
| `v0.6.1`     | 规划未独立发布 | 规划管理后台手工创建应用、权限和应用管理员闭环；相关能力后续并入 `v0.7.0` 和 `v0.8.0` 主线。                                                                                                                                                                    | 未单独发布镜像。                                                                                                                                                                                                                                                                     | [v0.6.1 设计](docs/superpowers/specs/2026-05-19-feishu-iam-v0.6.1-admin-manual-operations-design.md)                                                                                                                                                                                     |
| `v0.7.0`     | 已收口         | 后台信息架构重构，形成工作台、应用管理、权限管理、管理员授权、记录查询、系统设置等独立模块。                                                                                                                                                                    | 迁移 `V0_7_0__admin_ia.sql`；镜像发布曾受旧 Registry 端口阻塞。                                                                                                                                                                                                                      | [v0.7.0 设计](docs/superpowers/specs/2026-05-20-feishu-iam-v0.7.0-admin-ia-design.md)                                                                                                                                                                                                    |
| `v0.8.0`     | 已收口         | 按“清单 -> 详情抽屉”范式重做后台前端表达和交互体验，保留原业务模型。                                                                                                                                                                                            | `dockerhub.it.tangtring.com:80/ai/feishu-iam:v0.8.0`，digest `sha256:47d34d37fdad26731ff6748f65aae9e30eb15069ffb9dc6e94a65b5050833d4d`。                                                                                                                                               | [v0.8.0 前端重构记录](docs/superpowers/specs/2026-05-21-feishu-iam-v0.8.0-admin-ui-rebuild-prototypes.md)                                                                                                                                                                                |
| `v0.8.1`     | 已收口         | 应用创建接入包、应用去环境化、应用级回调地址、OAuth 凭证、开发者 API 凭证、Codex 接入提示词、一键部署升级增强和多架构镜像发布。                                                                                                                                 | `dockerhub.it.tangtring.com:80/ai/feishu-iam:v0.8.1`，多架构 digest `sha256:5924443b3f64207921818e7b708e377950abf8c13077be8e7cf66c4717f9f780`。                                                                                                                                        | [v0.8.1 应用接入包设计](docs/superpowers/specs/2026-05-22-feishu-iam-v0.8.1-application-onboarding-design.md)                                                                                                                                                                            |
| `v0.9.0`     | 已收口         | 按 `design/admin-console.pen` 完整重构管理后台，统一 Pencil 风格、六个一级模块、右侧详情抽屉、高风险确认弹框和窄屏横向模块栏。                                                                                                                                  | `dockerhub.it.tangtring.com:80/ai/feishu-iam:v0.9.0`，多架构 digest `sha256:8d6fc671a9de55347ee023cf3617db50beb69483a7b211b4b89549cd7691e03f`。                                                                                                                                        | [v0.9.0 管理后台执行计划](docs/superpowers/plans/2026-05-23-feishu-iam-v0.9.0-admin-console-execution.md)                                                                                                                                                                                |
| `v0.9.1`     | 已收口         | 建立 shadcn/tweakcn 管理后台重构设计基线、Pencil 原型和第一切片执行归档；变基后保留 v0.9.0 完整后台实现，不回退已发布能力。                                                                                                                                     | `dockerhub.it.tangtring.com:80/ai/feishu-iam:v0.9.1`，多架构 digest `sha256:e21a8c1e4ab92c46604e6d9587ee32017f69a7e47eaf886580393975a8b658a0`；已在 `192.168.2.112:~/feishu-iam` 升级验证。                                                                                              | [v0.9.1 管理后台重构设计](docs/superpowers/specs/2026-05-24-feishu-iam-v0.9.1-admin-console-rearchitecture-design.md)                                                                                                                                                                    |
| `v0.10.0`    | 已收口         | 管理后台运行时切到 react-router + shadcn/tweakcn/Tailwind 基线，先收口“记录查询 + 应用管理”可信切片：URL 深链、AppShell、PageHeader、表格、筛选、详情抽屉、确认弹框、一次性凭证展示和响应式检查。权限管理、管理员授权、系统设置、工作台完整迁移仍留在后续切片。 | `dockerhub.it.tangtring.com:80/ai/feishu-iam:v0.10.0`，多架构 digest `sha256:2e594d8d0b2c10cd6ae826d500eadf96c49aacbd1800f94115c6410197a81846`；已在 `192.168.2.112:~/feishu-iam` 停机升级验证，`/version` 返回 `0.10.0`。                                                               | [v0.10.0 运行时重建设计](docs/superpowers/specs/2026-05-24-feishu-iam-v0.10.0-admin-web-runtime-rebuild.md)、[第一可信切片计划](docs/superpowers/plans/2026-05-24-feishu-iam-v0.10.0-admin-web-first-trusted-slice.md)                                                                     |
| `v0.10.1-s3` | 已收口         | 管理员授权页面迁移到 S1 新后台组件体系：`PageHeader`、`FilterBar`、`DataTable`、`DetailSheet`、`FormDialog`、`ConfirmDialog` 和 URL 详情状态；保留新增、编辑、启停、历史只读角色和非平台管理员拒绝态。                                                          | 小版本 UI 切片，无镜像发布，不改变后端 API、Prisma、DDL 或部署拓扑。                                                                                                                                                                                                                 | [v0.10.1 UI/UX 修复规划](docs/superpowers/plans/2026-05-25-feishu-iam-v0.10.1-admin-uiux-closure.md)、[S3 会话归档](docs/codex-sessions/2026-05-25-1556-v0.10.1-s3-admin-auth.md)                                                                                                        |
| `v0.10.1-s4` | 已收口         | 系统设置页面迁移到 S1 新后台组件体系：设置项清单、飞书同步、系统运行、版本信息、同步历史 `DataTable`、同步记录 `DetailSheet` 和 `tab` / `sheet=sync:<id>` URL 状态；同步成功关闭确认框，失败保留稳定错误提示。                                                  | 小版本 UI 切片，无镜像发布，不改变后端 API、Prisma、DDL 或部署拓扑；本地 `pnpm check`、admin-web 构建、响应式检查和 Playwright 浏览器自检通过。                                                                                                                                      | [S4 实施计划](docs/superpowers/plans/2026-05-25-feishu-iam-v0.10.1-s4-system-settings-migration.md)、[S4 会话归档](docs/codex-sessions/2026-05-25-1647-v0.10.1-s4-system-settings.md)                                                                                                    |
| `v0.10.1-s5` | 已收口         | 工作台迁移到 S1 新后台组件体系并改为风险优先控制台：默认 `/admin` 进入 `/admin/workspace`，聚合飞书配置、同步运行、API health、DB ready 和有效用户风险，风险入口跳转到可复制、可刷新的系统设置或记录查询 URL。                                                  | 小版本 UI 切片，无镜像发布，不改变后端 API、Prisma、DDL 或部署拓扑；本地 `pnpm check`、admin-web 构建、响应式检查和浏览器自检通过。                                                                                                                                                  | [S5 实施计划](docs/superpowers/plans/2026-05-25-feishu-iam-v0.10.1-s5-workspace-risk.md)、[S5 会话归档](docs/codex-sessions/2026-05-25-1724-v0.10.1-s5-workspace-risk.md)                                                                                                                |
| `v0.10.1-s6` | 已收口         | `v0.10.1` 正式发布收口切片：清理 S1-S5 迁移后遗留的旧后台主结构 CSS、未使用旧组件和迁移期测试债，更新版本号、README、CHANGELOG，发布 `v0.10.1` 多架构镜像并完成远端停机升级验证。                                                                               | 已发布正式镜像 `dockerhub.it.tangtring.com:80/ai/feishu-iam:v0.10.1`，多架构 digest `sha256:461780bb56a2e641d8dc4fad2f5994c575a064e750514b9842fd01c78ba0b917`；已在 `192.168.2.112:~/feishu-iam` 停机升级验证，`/version` 返回 `0.10.1`。                                                | [S6 实施计划](docs/superpowers/plans/2026-05-25-feishu-iam-v0.10.1-s6-css-release.md)                                                                                                                                                                                                    |
| `v0.10.1`    | 已收口         | 管理后台 UI/UX 一致性修复正式版本：固定壳层、左侧菜单收缩、通用面包屑、详情 Sheet 宽度切换、表格状态标签不换行，并把工作台、权限管理、管理员授权、系统设置迁移到新 shadcn/tweakcn 组件体系，最后清理旧 CSS、旧组件和测试 skip。                                 | `dockerhub.it.tangtring.com:80/ai/feishu-iam:v0.10.1`，多架构 digest `sha256:461780bb56a2e641d8dc4fad2f5994c575a064e750514b9842fd01c78ba0b917`；已在 `192.168.2.112:~/feishu-iam` 停机升级验证，`/version` 返回 `0.10.1`。                                                               | [v0.10.1 UI/UX 修复规划](docs/superpowers/plans/2026-05-25-feishu-iam-v0.10.1-admin-uiux-closure.md)、[S6 实施计划](docs/superpowers/plans/2026-05-25-feishu-iam-v0.10.1-s6-css-release.md)                                                                                                |
| `v0.10.3`    | 已发布         | GitLab issue 修复小版本：修复顶部栏布局、右上角用户状态区域、管理员授权操作按钮布局和下拉菜单层级。                                                                                                                                                             | `dockerhub.it.tangtring.com:80/ai/feishu-iam:v0.10.3`，多架构 digest `sha256:0e1d2709e9fe5fbeb734ad556aca1ba14bb28a505554d74f4d9f3cd95a4cfe8e`；已在 `192.168.2.112:~/feishu-iam` 停机升级验证，`/version` 返回 `0.10.3`。                                                               | [v0.10.3 GitLab issue 修复计划](docs/superpowers/plans/2026-05-26-feishu-iam-v0.10.3-gitlab-issues.md)                                                                                                                                                                                   |
| `v0.10.4`    | 已发布         | GitLab issue 修复小版本：修复权限管理 IAM 角色清单操作列按钮样式错误和换行展示，改为与管理员授权一致的 icon button 操作列。                                                                                                                                     | `dockerhub.it.tangtring.com:80/ai/feishu-iam:v0.10.4`，多架构 digest `sha256:15a6470aa5c748be2e5488dfa88aaf1bab588e0f7ef8711a37266f65eeb95cdf`；已在 `192.168.2.112:~/feishu-iam` 停机升级验证，`/version` 返回 `0.10.4`。                                                               | [v0.10.4 GitLab issue 修复计划](docs/superpowers/plans/2026-05-26-feishu-iam-v0.10.4-gitlab-issue-4.md)                                                                                                                                                                                  |
| `v0.11.0`    | 已发布         | 系统管理 IA 与通用体验基线版本：一级导航调整为工作台、应用管理、权限管理、系统管理；系统管理下沉飞书同步、管理员授权、操作审计、系统信息；统一身份字段、列表列宽、详情底部留白和旧路由兼容。                                                                    | `dockerhub.it.tangtring.com:80/ai/feishu-iam:v0.11.0`，多架构 digest `sha256:9ff7baefbb426a8ccafdfc377a4e6a8287b303af8c72e58c51c629294afb0e6e`；已在 `192.168.2.112:~/feishu-iam` 停机升级验证，`/version` 返回 `0.11.0`。                                                               | [v0.11.0 实施计划](docs/superpowers/plans/2026-05-26-feishu-iam-v0.11.0-system-management-baseline.md)                                                                                                                                                                                   |
| `v0.11.1`    | 已发布         | 飞书同步可信诊断版本：修复 112 stale running 同步锁、飞书用户 `open_id`/`union_id` 身份迁移、同步失败阶段和 request id 展示。                                                                                                                                   | `dockerhub.it.tangtring.com:80/ai/feishu-iam:v0.11.1`，多架构 digest `sha256:802e0691e86b2d94f0237099b1f738484968b967bf18af1fe3183cc2ab817654`；已在 `192.168.2.112:~/feishu-iam` 停机升级并完成真实飞书同步，`/version` 返回 `0.11.1 / v0.11.1`。                                       | [v0.11.1 实施计划](docs/superpowers/plans/2026-05-26-feishu-iam-v0.11.1-feishu-sync-diagnostics.md)                                                                                                                                                                                      |
| `v0.11.2`    | 已发布         | 应用管理生产闭环版本：应用清单接入摘要、应用详情分区、基础信息编辑、回调地址维护、安全版接入提示词复制、应用启停确认，以及应用内角色元数据新增和编辑。                                                                                                          | `dockerhub.it.tangtring.com:80/ai/feishu-iam:v0.11.2`，多架构 digest `sha256:252b60decca1021baea685e0abd024c8d54ae07d42df840920880596248a1f88`；已在 `192.168.2.112:~/feishu-iam` 通过 amd64 离线 tar 和 `FEISHU_IAM_PULL_POLICY=never` 完成停机升级，`/version` 返回 `0.11.2 / v0.11.2`。 | [v0.11.2 实施计划](docs/superpowers/plans/2026-05-26-feishu-iam-v0.11.2-application-ops.md)、[v0.11.2 Pencil 原型说明](design/v0.11.2-application-ops-prototype.md)                                                                                                                      |
| `v0.11.3`    | 已发布         | 权限管理角色授权工作区版本：权限管理聚焦按应用筛选和搜索 IAM 角色，角色详情 Tab 承载总览、组织与用户绑定、权限组绑定、基础信息和保存说明；角色元数据继续归应用管理维护。                                                                                        | `dockerhub.it.tangtring.com:80/ai/feishu-iam:v0.11.3`，多架构 digest `sha256:33385133b16cee506376975855a5a3f7044e3c4a5903c81f06e1f26abbce0af6`；已在 `192.168.2.112:~/feishu-iam` 通过 amd64 离线 tar 和 `FEISHU_IAM_PULL_POLICY=never` 完成停机升级，`/version` 返回 `0.11.3 / v0.11.3`。 | [v0.11.3 实施计划](docs/superpowers/plans/2026-05-26-feishu-iam-v0.11.3-role-authorization.md)、[v0.11.3 Pencil 原型说明](design/v0.11.3-role-authorization-prototype.md)                                                                                                                |
| `v0.12.0`    | 已发布         | 真实第三方接入验收版本：`feishu-iam-sso-demo` 已作为独立仓库提交并完成闭环，验证第三方系统可通过 Feishu IAM 登录、换取 access token、读取 userinfo 和权限清单，并让前端权限展示与权限控制生效；同时修复新增应用负责人手填和新增平台管理员跳转空白页问题。           | `dockerhub.it.tangtring.com:80/ai/feishu-iam:v0.12.0`，多架构 digest `sha256:be56fdc2d59841d52c8904acdb906353a07fc580ba912c8f5ca87ad5742942e0`；已在 `192.168.2.112:~/feishu-iam` 通过 amd64 离线 tar 和 `FEISHU_IAM_PULL_POLICY=never` 完成停机升级，`/version` 返回 `0.12.0 / v0.12.0`。 | [v0.12.0 接入验收文档](docs/acceptance/v0.12.0-third-party-sso-demo.md)、[feishu-iam-sso-demo](https://github.com/wodenwang/feishu-iam-sso-demo)、[v0.12.0 实施计划](docs/superpowers/plans/2026-05-27-feishu-iam-v0.12.0-access-closeout.md)                                           |
| `v0.13.0`    | 已发布         | 飞书同步运维控制台版本：范围锁定 GitLab issue `#13`，把 `系统管理 / 飞书同步` 从状态页升级为运维控制台，覆盖同步总览、本地组织/用户查询、同步历史详情、字段诊断、用户/部门轻量同步入口和全量同步强确认。                                                        | `dockerhub.it.tangtring.com:80/ai/feishu-iam:v0.13.0`，多架构 digest `sha256:657b5697e32a4e138a07cb95b9414a09341ec932ab7e8f3c09d0bac8ffd99b76`；已在 `192.168.2.112:~/feishu-iam` 通过 amd64 离线 tar 和 `FEISHU_IAM_PULL_POLICY=never` 完成停机升级，`/version` 返回 `0.13.0 / v0.13.0`。 | [v0.13.0 飞书同步运维控制台规格](docs/superpowers/specs/2026-05-27-feishu-iam-v0.13.0-feishu-sync-console.md)、[v0.13.0 Pencil 原型说明](design/v0.13.0-feishu-sync-console-prototype.md)、[v0.13.0 实施计划](docs/superpowers/plans/2026-05-27-feishu-iam-v0.13.0-feishu-sync-console.md) |
| `v0.13.1`    | 已发布         | GitLab issue `#12` 修复小版本：左侧导航改为明确一级分组和二级菜单层级，`系统管理` 支持展开/收起，当前二级页强制保持父级展开，桌面收缩态通过 tooltip 展示二级入口摘要，移动 Sheet 展示完整层级。                                                                 | `dockerhub.it.tangtring.com:80/ai/feishu-iam:v0.13.1`，多架构 digest `sha256:77b0ae687635428ab611cd77bb67cb79ea92557b0f46e4a9d71fa7f1b8dcf055`；已在 `192.168.2.112:~/feishu-iam` 通过 amd64 离线 tar 和 `FEISHU_IAM_PULL_POLICY=never` 完成停机升级，`/version` 返回 `0.13.1 / v0.13.1`。 | [v0.13.1 规格](docs/superpowers/specs/2026-05-28-feishu-iam-v0.13.1-sidebar-nav.md)、[v0.13.1 Pencil 原型说明](design/v0.13.1-sidebar-nav-prototype.md)、[v0.13.1 实施计划](docs/superpowers/plans/2026-05-28-feishu-iam-v0.13.1-sidebar-nav.md)                                           |
| `v0.14.0`    | 已发布         | 后台体验版本：合并 GitLab issue `#16/#6/#7/#9`，补齐 `系统管理` 父级整行展开收起和二级图标，并把应用详情、角色详情默认入口从右侧抽屉升级为可深链的独立详情页；角色详情 Tab 状态进入 URL，权限管理继续只承载授权绑定。                                           | `dockerhub.it.tangtring.com:80/ai/feishu-iam:v0.14.0`，多架构 digest `sha256:ef1056f1ec36e223b2b71f08d5f119b3e2a718abef7aa239514f9ac14bc36582`；已在 `192.168.2.112:~/feishu-iam` 通过 amd64 离线 tar 和 `FEISHU_IAM_PULL_POLICY=never` 完成停机升级，`/version` 返回 `0.14.0 / v0.14.0`。 | [v0.14.0 规格](docs/superpowers/specs/2026-05-28-feishu-iam-v0.14.0-admin-detail-pages.md)、[v0.14.0 实施计划](docs/superpowers/plans/2026-05-28-feishu-iam-v0.14.0-admin-detail-pages.md)                                                                                                 |
| `v0.14.1`    | 已发布         | GitLab issue `#17` 修复小版本：应用详情页改为 `详细资料 / 角色管理 / 开发信息 / 危险操作` 四个 Tab，Tab 状态进入 URL，默认详情页保持独立页面入口，旧 `sheet=app:*` 抽屉深链继续兼容。                                                                           | `dockerhub.it.tangtring.com:80/ai/feishu-iam:v0.14.1`，多架构 digest `sha256:b46fe5fb59cebe1aa54a02afd0cfaa347895ce9421dbdcd16b32e1fff3a54621`；已在 `192.168.2.112:~/feishu-iam` 通过 amd64 离线 tar 和 `FEISHU_IAM_PULL_POLICY=never` 完成停机升级，`/version` 返回 `0.14.1 / v0.14.1`。 | [v0.14.1 规格](docs/superpowers/specs/2026-05-28-feishu-iam-v0.14.1-application-detail-tabs.md)、[v0.14.1 实施计划](docs/superpowers/plans/2026-05-28-feishu-iam-v0.14.1-application-detail-tabs.md)                                                                                       |
| `v0.14.2`    | 已发布         | GitLab issue `#18/#22/#23` 修复小版本：稳定应用详情新增回调地址操作区，移除权限管理重复应用快捷查询区，并把应用详情 `角色管理` Tab 从卡片堆叠改为普通角色表格 CRUD。                                                                                          | `dockerhub.it.tangtring.com:80/ai/feishu-iam:v0.14.2`，多架构 digest `sha256:754fab751d132100c8f6fc2b990918d212b53ae7c21fef94e69320dd74289b27`；已在 `192.168.2.112:~/feishu-iam` 通过 amd64 离线 tar 和 `FEISHU_IAM_PULL_POLICY=never` 完成停机升级，`/version` 返回 `0.14.2 / v0.14.2`。 | [v0.14.2 规格](docs/superpowers/specs/2026-05-28-feishu-iam-v0.14.2-admin-polish.md)、[v0.14.2 实施计划](docs/superpowers/plans/2026-05-28-feishu-iam-v0.14.2-admin-polish.md)                                                                                                           |
| `v0.15.0`    | 已发布         | GitLab issue `#19/#20/#24` 组织树与组织用户选择器版本：飞书同步页保留健康摘要和排障主旅程，组织用户浏览改为下钻式 `OrgBrowser`；角色绑定改为组织主体与用户主体双栏选择器，390px 使用待选 / 已选 / 摘要分步面板；应用详情角色管理操作列继续保持稳定确认。         | `dockerhub.it.tangtring.com:80/ai/feishu-iam:v0.15.0`，多架构 digest `sha256:94ab39ed247f3e8129cab62a91a78bf7bbbbff3017f6a66b74a1e09e099eab79`；已在 `192.168.2.112:~/feishu-iam` 通过 amd64 离线 tar 和 `FEISHU_IAM_PULL_POLICY=never` 完成停机升级，`/version` 返回 `0.15.0 / v0.15.0`。 | [v0.15.0 规格](docs/superpowers/specs/2026-05-28-feishu-iam-v0.15.0-org-tree-selector.md)、[v0.15.0 Pencil 原型说明](design/v0.15.0-org-tree-selector-prototype.md)、[v0.15.0 实施计划](docs/superpowers/plans/2026-05-28-feishu-iam-v0.15.0-org-tree-selector.md)                      |
| `v0.15.1`    | 已发布         | GitLab issue `#21/#25` 权限可解释性与导航 hover 修复小版本：角色详情 `权限组绑定` Tab 可展开查看权限组内权限点，并展示角色最终有效权限点；左侧普通一级菜单 hover 宽度与系统管理父级一致；应用详情 `角色管理` 的启停操作统一为图标按钮，修复停用按钮变形。 | `dockerhub.it.tangtring.com:80/ai/feishu-iam:v0.15.1`，多架构 digest `sha256:83adf0dd0c37f939645c11404c0a169be2207b18fa9131166cff3dee4380ff93`；已在 `192.168.2.112:~/feishu-iam` 通过 amd64 离线 tar 和 `FEISHU_IAM_PULL_POLICY=never` 完成停机升级，`/version` 返回 `0.15.1 / v0.15.1`。 | [v0.15.1 规格](docs/superpowers/specs/2026-05-28-feishu-iam-v0.15.1-permission-explainability.md)、[v0.15.1 实施计划](docs/superpowers/plans/2026-05-28-feishu-iam-v0.15.1-permission-explainability.md)                                                                                |
| `v0.15.2`    | 已发布         | GitLab issue `#26` 组织和用户选择组件重构小版本：角色组织与用户绑定待选区改为组织和用户同列表展示，根级组织显式从顶层组织开始，路径切换和下钻不清空已选列表。                                      | `dockerhub.it.tangtring.com:80/ai/feishu-iam:v0.15.2`，多架构 digest `sha256:864d87d79384a9cce763c189198c03352edc5255a35f9eb3107e275ebd4147ab`；已在 `192.168.2.112:~/feishu-iam` 通过 amd64 离线 tar 和 `FEISHU_IAM_PULL_POLICY=never` 完成停机升级，`/version` 返回 `0.15.2 / v0.15.2`。 | [v0.15.2 规格](docs/superpowers/specs/2026-05-28-feishu-iam-v0.15.2-org-user-selector-refine.md)、[v0.15.2 实施计划](docs/superpowers/plans/2026-05-28-feishu-iam-v0.15.2-org-user-selector-refine.md)                                                                                   |
| `v0.16.0`    | 已发布         | GitLab issue `#27/#28/#29/#30/#31` 生产追踪与接入排障版本：统一问题提示页、追踪聚合接口、OAuth/userinfo/权限查询事件补齐、操作审计追踪 Tab、应用详情跳转和接入排障文档。                      | `dockerhub.it.tangtring.com:80/ai/feishu-iam:v0.16.0`，多架构 digest `sha256:e4c469ce15223d05d7d241adb48325a54b8da8828c0e9d10d30f4228d5f1e43d`；已在 `192.168.2.112:~/feishu-iam` 通过 amd64 离线 tar 和 `FEISHU_IAM_PULL_POLICY=never` 完成停机升级，`/version` 返回 `0.16.0 / v0.16.0`。 | [v0.16.0 规格](docs/superpowers/specs/2026-05-29-feishu-iam-v0.16.0-audit-traceability-discovery.md)、[v0.16.0 实施计划](docs/superpowers/plans/2026-05-29-feishu-iam-v0.16.0-audit-traceability.md)、[接入排障指南](docs/oauth-troubleshooting.md)                                      |
| `v0.16.1`    | 已发布         | GitLab issue `#35/#26/#32/#33/#34` 追踪闭环、组织用户选择器和按钮轻治理补丁：后台认证/授权失败写入可按 request id 查询的安全事件；追踪页本地提取 request id；角色已选组织/用户展示名称、头像/图标、类型、路径和 orphaned 状态；按钮保持不换行和可访问标签。 | `dockerhub.it.tangtring.com:80/ai/feishu-iam:v0.16.1`，多架构 digest `sha256:c382b674a9581c7066ae92e0114b3abcf46c026772f360bf4c27b524ce9cfe52`；已在 `192.168.2.112:~/feishu-iam` 通过 amd64 离线 tar 和 `FEISHU_IAM_PULL_POLICY=never` 完成停机升级，`/version` 返回 `0.16.1 / v0.16.1`。 | [v0.16.1 实施计划](docs/superpowers/plans/2026-05-29-feishu-iam-v0.16.1-trace-selector-buttons.md)、[v0.16.1 Pencil 原型说明](design/v0.16.1-org-user-selector-prototype.md)、[v0.16.1 原型截图](design/exports/v0.16.1-org-user-selector/) |
| `v0.16.2`    | 已发布         | GitLab issue `#36/#37/#38` 小补丁：组织用户选择器顶层只加载根级组织，兼容飞书根父节点 `0`；应用清单详情操作统一为可访问图标按钮；追踪页和问题提示页只保留 request id 复制与输入，不再复制或粘贴整段问题信息。 | `dockerhub.it.tangtring.com:80/ai/feishu-iam:v0.16.2`，多架构 digest `sha256:09cef06e3adfbbde7cf60124ef4e23b347b27184f0393cce11bd77e242eef5c5`；已在 `192.168.2.112:~/feishu-iam` 通过 amd64 离线 tar 和 `FEISHU_IAM_PULL_POLICY=never` 完成停机升级，`/version` 返回 `0.16.2 / v0.16.2`。 | [v0.16.2 实施计划](docs/superpowers/plans/2026-05-29-feishu-iam-v0.16.2-patch.md)、[v0.16.2 工程评审](docs/superpowers/reviews/2026-05-29-feishu-iam-v0.16.2-eng-review.md) |
| `v1.0.0`     | 收口中         | Riversoft 正式版后台 UI 翻新：通过 shadcn/ui + tweakcn + Tailwind CSS variables 收敛主题 token，升级 AppShell、DataTable、StatusBadge、PageState、FormDialog、DetailSheet、Confirm/Danger Zone 和 Trace/Error Page；数据初始化只确保“王文哲”具备 `platform_admin`。 | 目标镜像 `dockerhub.it.tangtring.com:80/ai/feishu-iam:v1.0.0`；多架构 digest 将在 `gstack /ship` 完成镜像发布后写入。 | [v1.0.0 Pencil 原型说明](design/v1.0.0-riversoft-admin-prototype.md)、[v1.0.0 原型截图](design/exports/v1.0.0-riversoft-admin-prototype/)、[v1.0.0 验收清单](docs/acceptance/v1.0.0-riversoft-ui-init.md) |

版本提交要求：

- 后续每次版本提交、发布、MR 收口或镜像发布，都必须同步更新本 README 的 Quick Start、版本历史和相关文档索引。
- README 只记录可公开的版本、命令、digest、路径和安全原则，不记录真实密钥、token、cookie、密码或一次性 secret。

### v0.9.0 管理后台重构

v0.9.0 将管理后台统一为 Pencil 风格的传统后台控制台。核心变化包括：

- 六个一级模块使用统一清单、筛选、分页、详情抽屉和确认弹框。
- 应用管理按 v0.8.1 应用接入包组织，不再把旧环境模型作为主界面。
- 记录查询提供审计日志、安全事件、同步记录、登录与 Token 记录四类真实查询。
- 工作台首屏先展示待处理风险、同步异常、接入问题和快捷操作，再展示常规指标。
- 窄屏使用顶部横向模块栏，表格和抽屉保持可用。

本地验证命令：

```bash
pnpm check
pnpm --filter @feishu-iam/admin-web build
ADMIN_WEB_URL=http://localhost:4173/ pnpm --filter @feishu-iam/admin-web test:responsive
```

完整 Docker Compose 自检需要本地 `.env` 或 `deploy/.env` 提供 `POSTGRES_PASSWORD`、`DATABASE_URL`、`CLIENT_SECRET_ENCRYPTION_KEY` 等必填运行时配置；真实凭证只允许保存在本机或服务器本地环境文件中，不进入仓库。

## 4. 相关文档

### 4.1 设计规格

- [Feishu IAM 总体设计](docs/superpowers/specs/2026-05-15-feishu-iam-design.md)
- [v0.9.1 管理后台重构设计](docs/superpowers/specs/2026-05-24-feishu-iam-v0.9.1-admin-console-rearchitecture-design.md)
- [v0.9.1 shadcn/tweakcn 设计基线](DESIGN.md)
- [v0.9.1 Pencil 原型](design/admin-console-v0.9.1.pen)
- [v0.9.1 Pencil 输入](design/pencil-input-v0.9.1.md)
- [v0.2.0 飞书身份镜像同步设计](docs/superpowers/specs/2026-05-15-feishu-iam-v0.2.0-feishu-identity-sync-design.md)
- [v0.2.1 飞书字段就绪设计](docs/superpowers/specs/2026-05-15-feishu-iam-v0.2.1-feishu-field-readiness-design.md)
- [v0.3.0 应用与权限模型设计](docs/superpowers/specs/2026-05-16-feishu-iam-v0.3.0-permission-model-design.md)
- [v0.4.0 SSO Provider 设计](docs/superpowers/specs/2026-05-16-feishu-iam-v0.4.0-sso-provider-design.md)
- [v0.5.0 管理后台与管理员体系设计](docs/superpowers/specs/2026-05-17-feishu-iam-v0.5.0-admin-console-design.md)
- [v0.5.0 破窗 Web 登录设计](docs/superpowers/specs/2026-05-17-feishu-iam-bootstrap-web-login-design.md)
- [v0.5.1 飞书验证闭环设计](docs/superpowers/specs/2026-05-17-feishu-iam-v0.5.1-feishu-verification-design.md)
- [v0.6.0 生产化部署与停机升级设计](docs/superpowers/specs/2026-05-19-feishu-iam-v0.6.0-production-compose-upgrade-design.md)
- [v0.6.1 管理后台手工操作设计](docs/superpowers/specs/2026-05-19-feishu-iam-v0.6.1-admin-manual-operations-design.md)
- [v0.7.0 管理后台信息架构设计](docs/superpowers/specs/2026-05-20-feishu-iam-v0.7.0-admin-ia-design.md)
- [v0.8.0 后台前端重构记录](docs/superpowers/specs/2026-05-21-feishu-iam-v0.8.0-admin-ui-rebuild-prototypes.md)
- [v0.8.1 应用接入包设计](docs/superpowers/specs/2026-05-22-feishu-iam-v0.8.1-application-onboarding-design.md)
- [v0.9.0 管理后台 Pencil 原型](design/admin-console.pen)
- [v0.9.0 管理后台设计系统契约](design/feishu-iam-admin-ui-design-system.md)

### 4.2 运维与部署

- [v0.6.0 生产化 Compose 部署说明](docs/deploy-v0.6.0.md)
- [v0.6.0 生产化部署验收清单](docs/acceptance/v0.6.0-production-compose-upgrade.md)
- [v0.5.1 内网部署说明](docs/deploy-v0.5.1.md)
- [部署脚本](deploy/install.sh)
- [升级脚本](deploy/upgrade.sh)
- [Compose 模板](deploy/docker-compose.yml)
- [服务器环境变量模板](deploy/server.env.example)

### 4.3 接入与业务能力

- [飞书身份镜像同步](docs/feishu-identity-sync.md)
- [v0.13.0 飞书同步运维控制台规格](docs/superpowers/specs/2026-05-27-feishu-iam-v0.13.0-feishu-sync-console.md)
- [v0.13.1 左侧导航层级修复规格](docs/superpowers/specs/2026-05-28-feishu-iam-v0.13.1-sidebar-nav.md)
- [v0.14.0 后台导航补齐与重交互详情页规格](docs/superpowers/specs/2026-05-28-feishu-iam-v0.14.0-admin-detail-pages.md)
- [v0.14.1 应用详情 Tab 化规格](docs/superpowers/specs/2026-05-28-feishu-iam-v0.14.1-application-detail-tabs.md)
- [v0.14.2 后台信息密度与控件稳定性规格](docs/superpowers/specs/2026-05-28-feishu-iam-v0.14.2-admin-polish.md)
- [v0.15.0 组织树与组织用户选择器规格](docs/superpowers/specs/2026-05-28-feishu-iam-v0.15.0-org-tree-selector.md)
- [v0.15.0 组织树与组织用户选择器 Pencil 原型说明](design/v0.15.0-org-tree-selector-prototype.md)
- [v0.15.1 权限可解释性规格](docs/superpowers/specs/2026-05-28-feishu-iam-v0.15.1-permission-explainability.md)
- [v0.15.2 组织用户选择器重构规格](docs/superpowers/specs/2026-05-28-feishu-iam-v0.15.2-org-user-selector-refine.md)
- [v0.16.0 生产追踪与接入排障规格](docs/superpowers/specs/2026-05-29-feishu-iam-v0.16.0-audit-traceability-discovery.md)
- [v0.16.0 生产追踪与接入排障 Pencil 原型说明](design/v0.16.0-audit-traceability-prototype.md)
- [v0.16.1 组织用户选择器 Pencil 原型说明](design/v0.16.1-org-user-selector-prototype.md)
- [v0.16.2 工程评审](docs/superpowers/reviews/2026-05-29-feishu-iam-v0.16.2-eng-review.md)
- [v1.0.0 Riversoft 正式版 Pencil 原型说明](design/v1.0.0-riversoft-admin-prototype.md)
- [v1.0.0 Riversoft UI 与管理员初始化验收清单](docs/acceptance/v1.0.0-riversoft-ui-init.md)
- [应用与权限模型](docs/permission-model.md)
- [SSO Provider 接入指南](docs/sso-provider.md)
- [Feishu IAM 接入排障指南](docs/oauth-troubleshooting.md)
- [v0.12.0 第三方接入验收文档](docs/acceptance/v0.12.0-third-party-sso-demo.md)
- [Feishu IAM SSO Demo 独立仓库](https://github.com/wodenwang/feishu-iam-sso-demo)
- [v0.4.0 SSO Provider 真实验收流程](docs/acceptance/v0.4.0-sso-provider-real-acceptance.md)
- [v0.5.1 飞书验证验收清单](docs/acceptance/v0.5.1-feishu-verification.md)

### 4.4 Agent 与会话归档

- [Agent 工作指南](AGENTS.md)
- [Codex 会话归档目录](docs/codex-sessions)
- [团队 Agent 模板](docs/codex-agent-global-template.md)

### 4.5 版本实施计划

- [v0.10.4 GitLab issue 修复计划](docs/superpowers/plans/2026-05-26-feishu-iam-v0.10.4-gitlab-issue-4.md)
- [v0.10.3 GitLab issue 修复计划](docs/superpowers/plans/2026-05-26-feishu-iam-v0.10.3-gitlab-issues.md)
- [v0.11.0 系统管理 IA 与通用体验基线实施计划](docs/superpowers/plans/2026-05-26-feishu-iam-v0.11.0-system-management-baseline.md)
- [v0.11.1 飞书同步可信诊断实施计划](docs/superpowers/plans/2026-05-26-feishu-iam-v0.11.1-feishu-sync-diagnostics.md)
- [v0.11.2 应用管理生产闭环实施计划](docs/superpowers/plans/2026-05-26-feishu-iam-v0.11.2-application-ops.md)
- [v0.11.3 权限管理角色授权工作区实施计划](docs/superpowers/plans/2026-05-26-feishu-iam-v0.11.3-role-authorization.md)
- [v0.13.1 左侧导航层级修复实施计划](docs/superpowers/plans/2026-05-28-feishu-iam-v0.13.1-sidebar-nav.md)
- [v0.14.0 后台导航补齐与重交互详情页实施计划](docs/superpowers/plans/2026-05-28-feishu-iam-v0.14.0-admin-detail-pages.md)
- [v0.14.1 应用详情 Tab 化实施计划](docs/superpowers/plans/2026-05-28-feishu-iam-v0.14.1-application-detail-tabs.md)
- [v0.14.2 后台信息密度与控件稳定性实施计划](docs/superpowers/plans/2026-05-28-feishu-iam-v0.14.2-admin-polish.md)
- [v0.15.0 组织树与组织用户选择器实施计划](docs/superpowers/plans/2026-05-28-feishu-iam-v0.15.0-org-tree-selector.md)
- [v0.15.1 权限可解释性实施计划](docs/superpowers/plans/2026-05-28-feishu-iam-v0.15.1-permission-explainability.md)
- [v0.15.2 组织用户选择器重构实施计划](docs/superpowers/plans/2026-05-28-feishu-iam-v0.15.2-org-user-selector-refine.md)
- [v0.16.0 生产追踪与接入排障实施计划](docs/superpowers/plans/2026-05-29-feishu-iam-v0.16.0-audit-traceability.md)
- [v0.16.1 追踪闭环、组织用户选择器与按钮治理实施计划](docs/superpowers/plans/2026-05-29-feishu-iam-v0.16.1-trace-selector-buttons.md)
- [v0.16.2 根组织、详情按钮与 request id 精简实施计划](docs/superpowers/plans/2026-05-29-feishu-iam-v0.16.2-patch.md)
- [v0.12.0 真实第三方接入验收收口实施计划](docs/superpowers/plans/2026-05-27-feishu-iam-v0.12.0-access-closeout.md)
- [v0.10.1-S6 CSS 清理与版本发布实施计划](docs/superpowers/plans/2026-05-25-feishu-iam-v0.10.1-s6-css-release.md)
- [v0.10.1-S5 工作台风险控制台实施计划](docs/superpowers/plans/2026-05-25-feishu-iam-v0.10.1-s5-workspace-risk.md)
- [v0.10.1-S4 系统设置迁移实施计划](docs/superpowers/plans/2026-05-25-feishu-iam-v0.10.1-s4-system-settings-migration.md)
- [v0.10.1-S2 权限管理迁移实施计划](docs/superpowers/plans/2026-05-25-feishu-iam-v0.10.1-s2-permission-management-migration.md)
- [v0.10.1 UI/UX 修复规划](docs/superpowers/plans/2026-05-25-feishu-iam-v0.10.1-admin-uiux-closure.md)
- [v0.9.1 管理后台第一切片实施计划](docs/superpowers/plans/2026-05-24-feishu-iam-v0.9.1-admin-console-first-slice-implementation.md)
- [v0.9.1 管理后台再架构计划](docs/superpowers/plans/2026-05-24-feishu-iam-v0.9.1-admin-console-rearchitecture.md)
- [v0.9.0 管理后台重构执行计划](docs/superpowers/plans/2026-05-23-feishu-iam-v0.9.0-admin-console-execution.md)
- [v0.8.1 应用接入包实施计划](docs/superpowers/plans/2026-05-22-feishu-iam-v0.8.1-application-onboarding.md)
- [v0.6.0 生产化部署实施计划](docs/superpowers/plans/2026-05-19-feishu-iam-v0.6.0-production-compose-upgrade.md)
- [v0.5.1 飞书验证实施计划](docs/superpowers/plans/2026-05-17-feishu-iam-v0.5.1-feishu-verification.md)
- [v0.4.0 SSO Provider 实施计划](docs/superpowers/plans/2026-05-16-feishu-iam-v0.4.0-sso-provider.md)
- [v0.3.0 权限模型实施计划](docs/superpowers/plans/2026-05-16-feishu-iam-v0.3.0-permission-model.md)
