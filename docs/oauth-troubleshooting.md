# Feishu IAM 接入排障指南

## 适用场景

第三方系统在登录、OAuth authorize、飞书回调、授权码换 token、userinfo、权限查询或后台权限配置后出现异常时，使用本指南收集字段并进入后台追踪视角。

如果问题发生在 Base Portal 内嵌页面，还需要区分顶层访问、Portal iframe 访问和新标签页访问。Portal 只负责入口编排、登录态和权限过滤，不替被嵌入的第三方系统做二次鉴权。

## 终端用户需要提供

- `request id`
- 错误码
- 发生时间
- 当前页面路径或回调路径
- 第三方系统名称
- 截图

## 接入开发者需要补充

- 应用 `app_key`
- client id
- 回调地址
- 接口路径：`/oauth/authorize`、`/oauth/token`、`/oauth/userinfo` 或 `/api/v1/apps/{app_key}/me/permissions`
- 第三方系统日志中的请求时间
- 如果来自 Portal：菜单 key、打开方式 `iframe` / `immersive_iframe` / `new_tab`、顶层访问是否正常、iframe 内是否出现额外交互

## 管理员排查路径

1. 打开 Feishu IAM 管理后台。
2. 进入 `系统管理 / 操作审计 / 追踪`。
3. 优先粘贴 `request id` 查询。
4. 如果没有结果，补充应用、client、飞书 user_id 和时间窗口。
5. 查看诊断摘要、时间线、缺失阶段和下一步建议。
6. 如从应用详情进入，使用 `查看接入追踪` 进入带应用和 client 上下文的追踪视角。
7. 如从飞书同步 run 进入，使用 `查看同步追踪` 进入带 request id 的追踪视角。

## 不应收集或转发的信息

- access token
- client secret
- developer API token
- Cookie
- Authorization header
- 授权码
- token hash
- state hash
- 原始敏感 payload

## Base Portal iframe 无感验收

Base Portal 接入 Feishu IAM 后，至少按以下矩阵验收：

| 场景 | 预期 |
|---|---|
| 顶层直接打开第三方系统 | 未登录时进入 Feishu IAM 授权链路，已登录后进入业务页 |
| Portal iframe 打开第三方系统 | 已登录用户无需额外点击即可进入业务页 |
| Portal iframe 未登录 | 允许短暂跳转链路，但不能出现需要用户重复选择或复制信息的流程 |
| 第三方系统禁止 iframe | 菜单应切换为 `new_tab`，或由第三方系统调整 frame 策略 |
| Cookie 在 iframe 中不可用 | 由第三方系统调整 cookie 策略，或切换 `new_tab` |
| 授权失败 | 页面只要求用户复制 request id，不能要求复制 token、cookie、authorization、授权码或整段问题信息 |
| 权限不足 | 第三方系统根据 `/api/v1/apps/{app_key}/me/permissions` 返回值展示稳定无权限状态 |
| developer API 同步失败 | 使用应用详情中的完整提示词刷新凭证，并重新同步权限点和权限组 |

## 反馈模板

终端用户只需要复制统一问题提示页中的 `request id`。不要要求用户复制整段问题信息、URL、token、cookie、authorization、授权码、token hash、state hash 或 raw payload。如果需要手工整理，使用以下字段：

```text
第三方系统：
问题现象：
request id：
错误码：
发生时间：
页面路径或回调路径：
截图：
```

接入开发者补充以下字段：

```text
app_key：
client id：
接口路径：
回调地址：
第三方系统日志时间：
是否发生在登录、token、userinfo 或权限查询阶段：
```
