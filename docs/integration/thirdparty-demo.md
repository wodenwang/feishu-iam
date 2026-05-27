# 第三方 Demo 接入说明

`v0.1.17` 将第三方 Demo 纳入 v0.1 接入闭环验收包。Demo 基于 `v0.1.12` 最小 OAuth Authorization Code runtime 和 `v0.1.13` 未登录恢复能力：如果浏览器还没有 IAM 登录态，Demo 发起 authorize 后会先进入 IAM 登录，登录成功后恢复原始 authorize 请求并回到 Demo callback。

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

## 本地验收要点

自动验收：

```bash
RUNTIME_API_BASE_URL=http://127.0.0.1:4100 \
bash scripts/verify-v0.1-access-loop.sh
```

该脚本使用 mock Feishu runtime 自动创建临时应用、注册 `demo.customer:view`、创建角色授权、执行 OAuth authorize/token、查询有权限和无权限用户权限，并检查审计日志。脚本不会打印一次性 secret、cookie、bearer token 或 HMAC signature。

建议在干净数据库中运行该脚本，或使用已经由 `ou_v017_verify_admin` 完成首次平台管理员绑定的本地测试库；脚本仍通过公开 API 完成验收，不直接写数据库。

浏览器验收：

1. 创建应用并保存一次性 `appSecret` / `apiSecret`。
2. 启动 Demo，填入 `IAM_APP_KEY`、`IAM_APP_SECRET`、`IAM_API_SECRET`。
3. 第三方 Demo 从未登录浏览器发起 IAM OAuth 登录。
4. 为登录用户绑定包含 `demo.customer:view` 的角色。
5. Demo 客户列表可访问。
6. 换无授权用户登录后进入 403。
7. 审计日志可以查到 `oauth.pending.create`、`oauth.pending.resume`、`oauth.authorize`、`oauth.token.exchange` 和 `application_api.permission.query`。
