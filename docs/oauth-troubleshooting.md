# Feishu IAM 接入排障指南

## 适用场景

第三方系统在登录、OAuth authorize、飞书回调、授权码换 token、userinfo、权限查询或后台权限配置后出现异常时，使用本指南收集字段并进入后台追踪视角。

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

## 反馈模板

终端用户可直接复制统一问题提示页中的问题信息；如果需要手工整理，使用以下字段：

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
