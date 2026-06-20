# v1.0.4 OAuth silent SSO 设计说明

## 目标

支持第三方应用在 Base Portal iframe 中安全判断 Feishu IAM 是否已有登录态：

- 已有 IAM SSO session：`/oauth/authorize?prompt=none` 直接签发 authorization code，302 回第三方 `redirect_uri`。
- 没有 IAM SSO session 或需要交互：不渲染 IAM 登录页，302 回第三方 `redirect_uri`，携带稳定 OAuth error。
- Base Portal 不传 token、cookie、authorization code 或 secret，也不作为 OAuth credential 代理。

## 协议行为

### 普通授权

普通 `/oauth/authorize` 行为不变：

1. 校验 `response_type=code`、`client_id`、`redirect_uri`、`state` 和 `scope`。
2. 写入短期登录 state。
3. 跳转飞书登录。
4. 飞书回调后签发 Feishu IAM authorization code。
5. 回跳第三方 `redirect_uri`。
6. 同时设置 Feishu IAM SSO session cookie，供后续 silent SSO 使用。

### silent SSO

`prompt=none` 时：

1. 仍先校验 `client_id`、`redirect_uri` 精确匹配、应用和 OAuth client 状态、scope。
2. 校验应用 `silent_sso_enabled=true`。
3. 校验 `redirect_uri` origin 属于 `silent_sso_allowed_origins`。
4. 校验 Feishu IAM SSO session cookie 对应的 `oauth_browser_sessions` 记录有效。
5. 用户仍处于可登录状态时签发 authorization code 并回跳。

错误回跳：

| 场景 | 回跳 error |
|---|---|
| 无 IAM SSO session、session 过期、session 已撤销、用户不可用 | `login_required` |
| 应用未启用 silent SSO、origin 未允许 | `unauthorized_client` |
| 后续需要授权确认或交互策略 | `interaction_required` |
| 请求参数不合法且可安全回跳 | `invalid_request` |

`state` 必须原样回传。

## 数据模型

新增表：

```text
oauth_browser_sessions
```

只保存：

- `session_hash`
- `feishu_user_id`
- `expires_at`
- `revoked_at`
- `last_used_at`

不保存明文 cookie。

应用新增字段：

- `silent_sso_enabled`
- `silent_sso_allowed_origins`

迁移为 `feishu-iam-sso-demo` 预置：

```text
https://feishu-iam-sso-demo.riversoft.com.cn
```

## 安全边界

- `redirect_uri` 精确匹配不降低。
- 授权码 TTL、hash 存储、一次性使用和 token exchange 校验不降低。
- IAM 登录页和错误交互页不允许任意 iframe 嵌入。
- `prompt=none` 路径优先 302，不输出 iframe HTML 登录页。
- cookie 为 httpOnly、Secure，前端不可读写。
- 日志、安全事件和审计不记录 code、token、cookie、secret、authorization header、token hash 或 state hash。

## SSO Demo 消费方式

SSO Demo 可在 iframe 初始化阶段构造：

```text
GET https://feishu-iam.riversoft.com.cn/oauth/authorize
  ?response_type=code
  &client_id=<client_id>
  &redirect_uri=https%3A%2F%2Ffeishu-iam-sso-demo.riversoft.com.cn%2F
  &state=<csrf_state>
  &scope=openid%20profile%20permissions
  &prompt=none
```

处理规则：

- 收到 `code`：后端继续 `/oauth/token`、`/oauth/userinfo`、`/api/v1/apps/feishu-iam-sso-demo/me/permissions`。
- 收到 `error=login_required`：不要在 iframe 内渲染 IAM 登录页；在顶层窗口或新标签页发起普通 OAuth 登录。
- 收到 `error=unauthorized_client`：提示接入配置未允许 silent SSO，并让管理员检查应用配置。
