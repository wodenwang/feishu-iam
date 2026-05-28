# 第三方 Demo 接入说明

`v0.2.0` 在既有第三方 Demo 链路上补齐应用接入生产化能力：应用详情页可以维护 OAuth redirect URI，轮换 `appSecret` / `apiSecret`，维护多应用管理员，并通过配置审计追溯变更。Demo 仍基于最小 OAuth Authorization Code runtime 和未登录恢复能力：如果浏览器还没有 IAM 登录态，Demo 发起 authorize 后会先进入 IAM 登录，登录成功后恢复原始 authorize 请求并回到 Demo callback。

`v0.4.0` 新增 Agent-first 初始化提示词。内部第三方项目如果由 Codex / Claude Code 开发，应优先从 `feishu-iam` 应用详情复制初始化提示词，让 Agent 在第三方项目中创建或维护 `AGENTS.md`、`CLAUDE.md`，而不是从 README 手工摘接口。

## 链路

```text
Demo 首页
  -> /login
  -> feishu-iam /api/oauth/authorize
  -> 未登录时 feishu-iam 保存 pending OAuth request 并进入 /login
  -> IAM 飞书登录成功后恢复 pending OAuth request
  -> Demo /oauth/callback?code=...&state=...
  -> feishu-iam /api/oauth/token
  -> Demo 保存短期 bearer token
  -> feishu-iam /api/application/me/permissions
  -> Demo 按 permission code 展示页面
```

## 权限点

当前 Demo 使用：

- `demo.customer:view`

有该权限的飞书用户可以查看客户列表；没有该权限的飞书用户进入 403。

## 安全边界

- Demo 不实现 username/password 登录。
- Demo 不保存真实飞书 token。
- Demo 只从环境变量读取 `IAM_APP_SECRET` 和 `IAM_API_SECRET`。
- OAuth state 使用 HttpOnly cookie 校验。
- IAM pending OAuth request 使用服务端 hash + HttpOnly cookie，不保存 secret 或 token。
- `feishu-iam` 返回的 authorization code 是短期、一次性消费。
- 过期 authorization code、OAuth bearer session 和 pending request 会被清理。
- `IAM_APP_SECRET` 和 `IAM_API_SECRET` 不得写入 README、截图、日志或提交记录。
- 创建应用或轮换 secret 的一次性 Agent 初始化提示词可以包含当次明文 secret，但只允许写入第三方项目 `.env`、CI secret 或 secret manager，不得提交到 Git。
- 普通应用详情页提示词只包含 secret 占位符，不提供历史 secret 再次查看能力。
- v0.2 轮换 secret 后旧 secret 立即失效，新 secret 仅显示一次。
- 停用的 OAuth redirect URI 不能再通过 authorize 校验，恢复后才可重新使用。
- v0.2.2 的接入诊断只展示脱敏状态、计数、端点和 requestId，不返回 secret、token、authorization code、signature、cookie 或 hash 原文。

## 本地验收要点

v0.4.0 Agent 初始化接入 SOP：

1. 在 `feishu-iam` 创建应用或轮换 secret。
2. 复制 `一次性 Agent 初始化提示词`，交给第三方项目中的 Codex / Claude Code。
3. 要求第三方 Agent 创建或更新 `AGENTS.md`、`CLAUDE.md`，写清 `IAM_BASE_URL`、`IAM_APP_KEY`、`IAM_APP_SECRET`、`IAM_API_SECRET`、OAuth SOP、Application API SOP、HMAC-SHA256 canonical string、权限命名规范和验收命令。
4. 在第三方项目 `.env` 或 secret manager 中保存 secret，不把明文写入 Git。
5. 让第三方项目注册权限组和权限点，再到 `feishu-iam` 做角色授权。
6. 用 OAuth 登录和 `GET /api/application/me/permissions` 验证有权限与无权限两条路径。

v0.2 应用接入生产化自动验收：

```bash
RUNTIME_API_BASE_URL=http://127.0.0.1:4100 \
bash scripts/verify-v0.2-application-onboarding.sh
```

该脚本使用 mock Feishu runtime 自动创建临时应用，验证 redirect URI 新增/停用/恢复、OAuth active URI 校验、`appSecret` / `apiSecret` 轮换、旧 secret 失效、新 secret 生效、多应用管理员维护、最后管理员保护和配置审计。脚本不会打印一次性 secret、cookie、authorization code、bearer token 或 HMAC signature。

v0.2.2 接入诊断自动验收：

```bash
RUNTIME_API_BASE_URL=http://127.0.0.1:4100 \
bash scripts/verify-v0.2-access-diagnostics.sh
```

该脚本使用 mock Feishu runtime 自动创建临时应用，验证接入诊断的 warning、healthy、failed 状态转换，检查诊断输出不包含一次性 secret，并确认复制诊断包会写入 `application.diagnostics.copy` 审计。

v0.1 接入闭环自动验收：

```bash
RUNTIME_API_BASE_URL=http://127.0.0.1:4100 \
bash scripts/verify-v0.1-access-loop.sh
```

该脚本使用 mock Feishu runtime 自动创建临时应用、注册 `demo.customer:view`、创建角色授权、执行 OAuth authorize/token、查询有权限和无权限用户权限，并检查审计日志。脚本不会打印一次性 secret、cookie、bearer token 或 HMAC signature。

建议在干净数据库中运行该脚本，或使用已经由 `ou_v017_verify_admin` 完成首次平台管理员绑定的本地测试库；脚本仍通过公开 API 完成验收，不直接写数据库。

浏览器验收：

1. 创建应用并保存一次性 `appSecret` / `apiSecret`。
2. 在应用详情 `接入配置` 确认 Demo redirect URI 处于启用状态。
3. 启动 Demo，填入 `IAM_APP_KEY`、`IAM_APP_SECRET`、`IAM_API_SECRET`。
4. 第三方 Demo 从未登录浏览器发起 IAM OAuth 登录。
5. 为登录用户绑定包含 `demo.customer:view` 的角色。
6. Demo 客户列表可访问。
7. 换无授权用户登录后进入 403。
8. 轮换 secret 后同步更新 Demo 环境变量，旧 secret 不应再通过 token exchange 或 HMAC。
9. 在 IAM 应用详情查看 `接入诊断`，确认配置健康；需要排查时复制脱敏诊断包给第三方系统开发者。
10. 审计日志可以查到 OAuth、Application API、redirect URI、secret rotate、应用管理员配置变更和诊断包复制事件。

真实飞书验收仍需要在飞书开放平台手动配置 Admin Console 登录 redirect URI、第三方应用 OAuth redirect URI、通讯录读取权限和部署环境白名单；这些外部配置不由脚本自动完成。
