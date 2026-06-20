# Feishu IAM v1.0.3 Base Portal 接入包与完整提示词设计稿

## 目标

`v1.0.3` 收口第三方应用接入体验，首个真实场景是 `base-portal`。管理员应能在 Feishu IAM 应用详情中通过一个主动作刷新必要凭证，并复制一份可直接交给第三方 Codex 项目的完整接入提示词。

## 背景判断

现有应用详情把 OAuth credential、Developer credential 和安全版接入提示词拆成多个区域。安全版提示词不包含 `client_secret` 和 `developer_api_token`，对第三方项目初始化帮助有限。Base Portal 接入需要一份完整提示词直接写入其 `AGENTS.md` 或本地 env 边界说明，同时不能长期保存 developer API token 明文。

## 决策

| 决策 | 结论 | 原因 |
|---|---|---|
| 提示词形态 | 完整提示词作为主路径 | 用户复制后即可交给第三方 Codex 项目使用 |
| developer token 策略 | 只保存 hash，需要完整提示词时轮换 | 不长期明文保存 developer API token |
| OAuth secret 策略 | 同一次确认中轮换 OAuth secret | 保证提示词中的登录凭证和开发者凭证同源、同一时间刷新 |
| Base Portal 支持 | 通用模板 + `base-portal` preset | 后续第三方应用可复用，Base Portal 获得更明确的菜单/iframe/权限约束 |
| iframe 无感 SSO | 本版本只做验收矩阵和排障说明 | 不扩大 OAuth 协议面，不做 silent SSO 或 refresh token |

## 用户流程

1. 管理员进入应用详情的 `开发信息` Tab。
2. 页面展示回调地址、OAuth credential、Developer credential 摘要和接入预检。
3. 管理员点击 `刷新凭证并生成完整提示词`。
4. 系统弹出强确认，说明旧 OAuth secret 和 developer API token 会失效。
5. 确认后后端轮换 OAuth secret 和 developer API token，生成完整提示词。
6. 页面展示完整提示词和复制按钮。
7. 管理员把提示词交给 Base Portal 或其他第三方项目的 Codex 会话。

## 后端契约

新增管理后台接口：

```text
POST /api/v1/admin/applications/{app_key}/integration-prompt/refresh
```

响应：

```json
{
  "clientId": "bic_xxx",
  "developerCredentialId": "developer-credential-id",
  "integrationPrompt": "完整接入提示词"
}
```

约束：

- 只有可管理该应用的管理员可调用。
- 如果应用没有 OAuth client，返回稳定错误，不自动补建 client。
- 如果应用没有 developer credential，可创建默认凭证；如果已有则轮换第一个 active 凭证，若无 active 则轮换第一条凭证并置为 active。
- 响应中的明文 secret 只存在于 `integrationPrompt` 文本中。
- 审计日志和安全事件不得写入 `client_secret`、`developer_api_token`、token hash、ciphertext、cookie、authorization 或授权码。

## 提示词内容

完整提示词必须包含：

- 第三方项目应写入自身 `AGENTS.md` 或 `CLAUDE.md` 的接入约束。
- `FEISHU_IAM_URL`、`app_key`、`client_id`、`client_secret`、`developer_api_token`。
- 回调地址精确匹配要求。
- OAuth 授权码流程：`/oauth/authorize`、`/oauth/token`、`/oauth/userinfo`。
- 权限查询：`/api/v1/apps/{app_key}/me/permissions`。
- Developer API 权限边界和接口。
- 权限点 key 必须以 `${app_key}.` 开头。
- Base Portal preset：菜单权限点建议、iframe/new_tab/immersive_iframe 打开方式、无感访问验收。
- Secret 处理要求：写入本地 env 或密钥系统，不进入仓库、日志、截图、聊天消息、测试快照或会话归档。

## Base Portal preset

当 `app_key` 为 `base-portal` 时，提示词额外包含：

- Portal 只负责入口编排、登录态和权限过滤，不替第三方系统做二次鉴权。
- 推荐权限点：
  - `base-portal.portal.access`
  - `base-portal.navigation.view`
  - `base-portal.menu.<menu_key>.open`
  - `base-portal.admin.sync-permissions`
- 菜单打开方式必须显式标注：`iframe`、`immersive_iframe` 或 `new_tab`。
- iframe 无感验收必须覆盖顶层跳转、Portal 内嵌、未登录、已登录和失败 request id。

其他应用使用通用第三方接入模板，不硬编码 Base Portal 域名或真实 secret。

## 接入预检

应用详情应展示稳定 checklist：

- 至少 1 个启用回调地址。
- 至少 1 个启用 OAuth credential。
- 至少 1 个 developer credential。
- `redirect_uri` 必须与第三方后端配置精确一致。
- 生成完整提示词会刷新旧凭证，第三方项目必须同步更新 env。
- 排障只需要 request id，不要求用户复制 token、cookie 或整段问题信息。

## 非目标

- 不实现完整 OIDC、refresh token、SAML。
- 不实现 ABAC、deny 规则、资源级权限或数据范围权限。
- 不把 Base Portal 做进 Feishu IAM 仓库。
- 不长期明文保存 developer API token。
- 不放宽 `redirect_uri` 精确匹配。
- 不改变管理员 session、平台管理员初始化、飞书通讯录同步或生产部署拓扑。

## 验收

- 后端测试覆盖 developer API token 轮换、完整提示词生成和敏感值不进入审计。
- 管理后台测试覆盖刷新确认、完整提示词复制、旧安全版提示词不再作为主展示。
- 文档覆盖 Base Portal 接入包、iframe 无感 SSO 验收矩阵和接入预检。
- `pnpm check` 和前端构建通过。
- Browser/Playwright 检查应用详情 `开发信息` Tab 在桌面和 390px 下无明显溢出、遮挡或异常空白。
