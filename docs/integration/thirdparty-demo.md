# 第三方 Demo 接入说明

`v0.1.12` 将 `examples/thirdparty-demo` 从 mock IAM session 推进到最小 OAuth Authorization Code runtime。

## 链路

```text
Demo 首页
  -> /login
  -> feishu-iam /api/oauth/authorize
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
- `feishu-iam` 返回的 authorization code 是短期、一次性消费。
- `IAM_APP_SECRET` 和 `IAM_API_SECRET` 不得写入 README、截图、日志或提交记录。

## 本地验收要点

1. 创建应用并保存一次性 `appSecret` / `apiSecret`。
2. 启动 Demo，填入 `IAM_APP_KEY`、`IAM_APP_SECRET`、`IAM_API_SECRET`。
3. 第三方 Demo 发起 IAM OAuth 登录。
4. 为登录用户绑定包含 `demo.customer:view` 的角色。
5. Demo 客户列表可访问。
6. 换无授权用户登录后进入 403。
7. 审计日志可以查到 `oauth.authorize`、`oauth.token.exchange` 和 `application_api.permission.query`。
