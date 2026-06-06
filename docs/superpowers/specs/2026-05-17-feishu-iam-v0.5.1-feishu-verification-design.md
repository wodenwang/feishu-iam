# Feishu IAM v0.5.1 飞书验证闭环设计

日期：2026-05-17
状态：已确认设计方向，待用户审阅书面规格

## 1. 版本目标

`v0.5.1` 是 `v0.5.0` 管理后台后的真实内网验收版本，目标不是扩展权限模型或 OAuth 协议，而是把已完成的能力部署到一台真实服务器，并完成飞书到 Feishu IAM 再到第三方应用接口的最小闭环验证。

一句话边界：

`v0.5.1 = 内网 Docker Compose 部署与真实飞书 SSO 验证闭环`。

版本完成后，应能证明：

1. Feishu IAM 可以通过 Docker Compose 部署到内网服务器。
2. 飞书通讯录只读同步在服务器环境可用。
3. 管理员可以通过飞书登录 Feishu IAM 管理后台。
4. 首个 `platform_admin` 可以通过破窗入口完成绑定，随后切换到飞书管理员身份日常登录。
5. 管理后台可以创建测试应用、环境、回调地址和 client。
6. 测试应用可以跑通 `/oauth/authorize`、飞书登录、`/oauth/token`、`/oauth/userinfo` 和 `/api/v1/apps/{app_key}/me/permissions`。
7. 验收过程可复现，且不把服务器密码、飞书密钥、平台 token、client secret 或 cookie 写入仓库、文档、日志和会话归档。

## 2. 部署环境

第一轮部署使用用户准备的内网服务器：

- 服务器地址：`192.168.2.112`
- 部署用户：`dev`
- 部署目录：`~/feishu-iam`
- 访问地址：`http://192.168.2.112:3000`
- 部署方式：Docker Compose

当前阶段不使用域名、HTTPS 或反向代理。后续如果需要接入内网网关、域名、证书或统一入口，应作为独立版本处理。

## 3. 飞书回调地址

`v0.5.1` 先使用内网 IP 回调，必须在同一个企业级飞书自建应用后台登记以下地址：

```text
http://192.168.2.112:3000/admin/auth/feishu/callback
http://192.168.2.112:3000/oauth/feishu/callback
```

两类回调必须保持分离：

- `FEISHU_ADMIN_OAUTH_REDIRECT_URI` 用于 Feishu IAM 管理后台飞书登录。
- `FEISHU_OAUTH_REDIRECT_URI` 用于第三方应用 SSO 流程中的飞书登录中转。

不要把管理后台回调和第三方 SSO 回调混用。不要新增第三方飞书应用，Feishu IAM 仍然只配置一个企业级飞书自建应用。

## 4. 纳入范围

`v0.5.1` 纳入以下工作：

- 补齐 Docker Compose 服务器部署配置，使运行时版本、公开访问地址、CORS、飞书回调、平台 token、破窗管理员配置和数据库配置都可以通过服务器本地 `.env` 注入。
- 让管理端构建产物在 Compose 部署中可访问，保证 `http://192.168.2.112:3000` 可以打开管理后台，而不是只启动 API。
- 提供服务器部署和升级说明，包括首次部署、重启、日志查看、健康检查和数据卷保留规则。
- 提供真实飞书验收文档，覆盖通讯录同步、管理员飞书登录、管理员权限边界、测试应用配置和 OAuth 主链路。
- 提供一个轻量验收辅助回调方式，用于接收测试应用授权码。该能力只用于验收拿到 `code`，不发 token、不保存授权码、不绕过 client 校验，也不作为第三方 demo 产品。
- 更新版本号到 `0.5.1`，保证 `/version`、Compose 配置和文档一致。
- 归档本次版本规划、部署验收过程和验证结果。

## 5. 不纳入范围

`v0.5.1` 不做以下能力：

- HTTPS、域名、反向代理或网关配置。
- 完整 OIDC Discovery、JWKS、ID Token。
- SAML。
- refresh token。
- 资源级权限、ABAC、deny 规则或数据范围权限。
- 飞书角色同步或飞书用户组同步。
- 新增第三方 demo 应用或 demo 页面。
- 多租户 SaaS 化。
- 平台 API token 的完整 scope 化。
- 可配置后台 RBAC。

这些能力如果需要，应进入后续独立版本。

## 6. 运行架构

`v0.5.1` 继续使用单仓库、单 Compose 项目部署：

```text
浏览器
  |
  | http://192.168.2.112:3000
  v
Feishu IAM API 容器
  |-- 管理后台静态资源
  |-- /admin/auth/*
  |-- /oauth/*
  |-- /api/v1/admin/*
  |-- /api/v1/platform/*
  |-- /api/v1/apps/*
  |
  v
PostgreSQL 容器
```

管理端和 API 采用同源部署，减少 CORS 和 cookie 问题。API 容器负责暴露管理后台静态资源，后台请求同源 API。Compose 不单独引入 Nginx，避免在没有反向代理的阶段增加部署复杂度。

## 7. 配置策略

服务器真实配置只放在 `~/feishu-iam/.env` 或等效本地环境文件中，不进入仓库。仓库只提供模板和说明。

必需配置包括：

- `DATABASE_URL`
- `POSTGRES_PASSWORD`
- `ADMIN_WEB_BASE_URL=http://192.168.2.112:3000`
- `PLATFORM_ADMIN_TOKEN`
- `BOOTSTRAP_SUPER_ADMIN_USERNAME`
- `BOOTSTRAP_SUPER_ADMIN_PASSWORD_HASH`
- `FEISHU_APP_ID`
- `FEISHU_APP_SECRET`
- `FEISHU_OAUTH_REDIRECT_URI=http://192.168.2.112:3000/oauth/feishu/callback`
- `FEISHU_ADMIN_OAUTH_REDIRECT_URI=http://192.168.2.112:3000/admin/auth/feishu/callback`
- `APP_VERSION=0.5.1`
- `GIT_COMMIT`

安全要求：

- 明文服务器密码只允许用于 SSH 登录，不写入仓库。
- 飞书 `app_secret` 只进入服务器本地 `.env`。
- `BOOTSTRAP_SUPER_ADMIN_PASSWORD_HASH` 只能写哈希，不写明文密码。
- `PLATFORM_ADMIN_TOKEN` 和 client secret 不出现在文档正文和会话归档。
- 验收日志如需记录配置状态，只记录“已配置/未配置”，不输出真实值。

## 8. 管理员验证流程

管理员验证流程分为两步。

第一步使用破窗入口完成首个管理员绑定：

1. 部署服务并确认 `/health`、`/ready`、`/version` 正常。
2. 访问 `/admin/auth/bootstrap`。
3. 使用服务器本地环境变量配置的破窗账号登录。
4. 绑定真实飞书用户为 `platform_admin`。
5. 退出破窗入口。

第二步使用飞书管理员身份日常登录：

1. 访问管理后台首页。
2. 点击飞书登录。
3. 飞书回调到 `/admin/auth/feishu/callback`。
4. Feishu IAM 创建 HttpOnly 管理员 session。
5. 管理端调用 `/api/v1/admin/me` 返回管理员身份、角色和应用范围。
6. 管理员可以查看飞书同步、应用管理、权限管理、接入配置、审计日志和安全事件。

验收时必须确认破窗入口没有获得完整日常管理权限；完成首个管理员绑定后，日常操作应切换到飞书管理员登录。

## 9. 第三方 SSO 验证流程

`v0.5.1` 不新增第三方 demo 应用，但需要用一个测试应用配置验证完整 SSO 主链路。

建议测试应用：

- `app_key`：`acceptance`
- 环境：`dev`
- 回调地址：使用验收辅助回调地址，或使用验收文档中指定的临时回调接收方式。
- client：由 Feishu IAM 创建，明文 `client_secret` 只在创建时展示一次，验收记录不得保存明文。

验证步骤：

1. 管理员在后台创建测试应用、环境、回调地址和 client。
2. 构造 `/oauth/authorize` URL，参数包含 `client_id`、`redirect_uri`、`response_type=code`、`scope=openid profile permissions` 和 `state`。
3. 浏览器访问授权地址。
4. Feishu IAM 跳转飞书登录。
5. 飞书回调到 `/oauth/feishu/callback`。
6. Feishu IAM 发放自己的授权码并跳转测试应用回调。
7. 验收人员从回调地址取得授权码。
8. 使用 client 凭据调用 `/oauth/token` 换取 Feishu IAM access token。
9. 使用 access token 调用 `/oauth/userinfo`。
10. 使用 access token 调用 `/api/v1/apps/acceptance/me/permissions`。
11. 调用 `/oauth/revoke` 撤销 token。
12. 再次调用 userinfo 或 permissions 应返回稳定认证错误。

成功标准：

- token 响应不泄露内部哈希或飞书密钥。
- userinfo 返回稳定用户标识和基础资料，不返回不该暴露的敏感字段。
- permissions 返回当前应用范围内权限组和权限点。
- revoke 后 token 不可继续使用。
- 失败场景返回稳定错误码和 request id。

## 10. 飞书通讯录同步验证

部署后需要先验证飞书身份镜像仍然可用：

1. 读取飞书同步状态，确认配置为已配置。
2. 触发一次真实同步。
3. 确认同步 run 成功。
4. 确认 `activeUsers > 0`。
5. 抽查管理员绑定使用的飞书 `user_id` 存在且可登录。

飞书通讯录访问继续保持只读双保险：

- 飞书应用权限侧只授予通讯录读取能力。
- Feishu IAM 代码侧只封装和调用读取接口，不提供写飞书通讯录的路径。

`v0.5.1` 不重新扩大通讯录字段范围，除非真实验收发现登录或同步被现有字段缺失阻断。若出现阻断，只修复与验证闭环直接相关的字段兼容问题。

## 11. 错误处理

部署和验收期间重点处理以下错误：

- Docker 或 Compose 不可用：部署前置检查失败，先修复服务器运行环境。
- `.env` 缺少必需配置：服务可以启动时也要在状态页或验收检查中显示不可用原因。
- 飞书回调未登记：飞书授权失败，按回调地址清单修正飞书开放平台配置。
- 飞书用户未同步或不可用：管理员登录失败，先重新同步通讯录并检查用户状态。
- 管理员未绑定：通过破窗入口绑定首个 `platform_admin`。
- 测试应用回调地址不匹配：`/oauth/authorize` 返回稳定错误，不跳转未知地址。
- client secret 错误：`/oauth/token` 返回稳定 OAuth 错误，并记录安全事件。
- token 撤销后继续使用：返回稳定认证错误，并记录安全事件。

所有错误响应不得显示堆栈、密钥、token、cookie、数据库连接串或框架默认错误页。

## 12. 验收证据

`v0.5.1` 完成时应提供以下证据：

- `git status --short`：确认工作区状态。
- `pnpm check`：本地质量检查通过。
- `docker compose -f deploy/docker-compose.yml config --quiet`：Compose 配置有效。
- 服务器 `docker compose ps`：PostgreSQL 和 API 服务运行。
- `curl http://192.168.2.112:3000/health`：API 健康。
- `curl http://192.168.2.112:3000/ready`：数据库和迁移就绪。
- `curl http://192.168.2.112:3000/version`：版本为 `0.5.1`。
- 飞书同步状态和同步 run 成功证据。
- 管理员飞书登录成功证据。
- 测试应用 OAuth 主链路成功证据。
- revoke 后 token 不可用证据。
- 敏感信息扫描结果，确认真实密钥、密码、token 和 cookie 未进入仓库。

## 13. 发布和归档

建议发布方式延续既有版本流程：

1. 创建 `release/v0.5.1`。
2. 完成设计、计划、实现和验收文档。
3. 执行本地质量检查和服务器真实验收。
4. 更新 README、AGENTS 当前阶段和必要接入文档。
5. 创建 GitLab MR。
6. 合并到 `main`。
7. 创建 annotated tag `v0.5.1`。
8. 归档 Codex 会话，记录目标、约束、修改文件、关键命令、验收结果和未完成事项。

归档中不得记录服务器密码、飞书密钥、平台 token、client secret、cookie 或真实 access token。
