# Feishu IAM v0.16.0 生产追踪与接入排障工程评审

## 评审对象

- Discovery：`docs/superpowers/specs/2026-05-29-feishu-iam-v0.16.0-audit-traceability-discovery.md`
- Pencil 原型：`design/admin-console-v0.16.0.pen`
- 原型说明：`design/v0.16.0-audit-traceability-prototype.md`
- 设计复审：`docs/superpowers/reviews/2026-05-29-feishu-iam-v0.16.0-audit-traceability-prototype-review.md`

## 结论

结论：可以进入 `Superpowers writing-plans`，但实施计划必须按本文锁定的工程边界执行。

本版本应做“只读追踪聚合 + 最小事件补齐 + 统一问题提示页”，不应扩展成完整可观测平台、BI 报表、完整 OIDC、refresh token、资源级权限或每次权限查询全量审计。

## Step 0 范围挑战

现有能力已经解决了一半问题：

- `apps/api/src/admin/admin-query.service.ts` 已支持审计日志和安全事件查询，并通过 `redactSensitive` 对 `before/after` 做递归脱敏。
- `apps/admin-web/src/features/records/RecordQueryView.tsx` 已有 `审计日志 / 安全事件 / 同步记录 / 登录与 Token 记录` 四个 Tab。
- `apps/api/prisma/schema.prisma` 已有 `audit_logs`、`security_events`、`oauth_login_states`、`oauth_access_tokens`、`feishu_sync_runs`。
- `apps/api/src/admin/admin-request-context.ts`、`apps/api/src/oauth/oauth-request-context.ts`、`apps/api/src/permission/permission-error.filter.ts` 已能从 `x-request-id` 读取或生成稳定 request id。
- `apps/api/src/oauth/oauth-error.filter.ts` 已让 `/oauth/authorize` 和 `/oauth/feishu/callback` 渲染 HTML 错误页并展示 request id。

最小可交付范围：

1. 新增一个后端只读追踪聚合接口，复用现有查询、权限和脱敏规则。
2. 补齐 OAuth / userinfo / 权限查询路径上必要的安全事件元数据，优先覆盖失败和关键成功点，不做每次权限计算全量审计。
3. 前端在操作审计页新增“追踪”Tab，调用聚合接口展示诊断摘要、时间线、部分命中、无结果和权限不足。
4. 统一问题提示页先落地未登录、会话过期、无权限和 OAuth 接入失败四类状态。
5. 应用详情保留原 Tab 模型，只增加“查看接入追踪”入口和返回上下文。

复杂度约束：

- 后端新增服务控制在 1 个聚合 service 和 1 个 controller 扩展内；不要把每种事件拆成独立 service。
- 前端新增组件应围绕 `RecordQueryView` 局部演进；除统一问题提示页外，不新增独立大型导航入口。
- 如果实施计划预计触达超过 8 个核心文件，必须在计划中解释原因，并把文档、测试和样式文件与核心逻辑文件分开计数。

## request_id 贯穿性评审

| 路径 | 当前状态 | v0.16.0 工程要求 |
|---|---|---|
| Admin API | 基本贯穿。`getAdminRequestId` 读取 `x-request-id` 或生成 UUID，写操作通过 audit context 落入 `audit_logs.request_id`。 | 保持现状；统一问题提示页必须展示后台 401/403 的 request id，并支持复制。 |
| OAuth authorize | 错误响应有 request id，失败会写 `security_events`；但 `oauth_login_states` 不保存 request id。 | 不必为 `oauth_login_states` 追加 request id 字段；追踪接口通过 `security_events` 和 client / 时间窗口关联 authorize 失败。 |
| Feishu callback / login | 成功和失败都已有 `oauth_login` 安全事件，成功事件包含 applicationId、clientId、feishuUserId、requestId。 | 作为时间线 OAuth 登录阶段的主事实来源。 |
| Token exchange | 成功 / 失败已有 `oauth_token_exchange` 安全事件；成功事件当前只记录 clientId 和 requestId，缺 applicationId、feishuUserId。 | 实施计划必须补充成功事件 applicationId 和 feishuUserId，失败事件在已解析 client 时补 applicationId。 |
| Userinfo | 认证失败由 `AppTokenGuard` 写 `oauth_app_token_auth` 失败事件；成功路径不写事件，`getUserinfo` 也拿不到 requestId。 | 补最小安全事件：userinfo 成功可只更新 token `lastUsedAt` 或写轻量 success 事件二选一；userinfo 业务失败必须写 `oauth_userinfo` failed，并包含 requestId、applicationId、clientId、feishuUserId。 |
| 权限查询 | token 认证失败和 app_key 不匹配已有安全事件；成功路径和权限计算失败没有统一事件。 | 补 `oauth_permission_query` 事件：成功可只记录元数据和 permission counts，不写权限点全集；失败必须记录 reasonCode。 |
| 飞书同步 | `feishu_sync_runs.request_id` 已存在，状态页可安全展示。 | 追踪接口纳入 `request_id` 精确匹配；如果只按应用 / 用户查，不强行关联同步 run，避免误导。 |

关键判断：`request_id` 不是所有持久表的字段，也不需要强行补到所有表。v0.16.0 的可靠追踪事实应以 `audit_logs`、`security_events` 和 `feishu_sync_runs` 为主，`oauth_login_states`、`oauth_access_tokens` 只作为上下文补充。

## 数据源是否足够

现有表足以支撑第一版追踪视角，但需要补事件内容和索引：

- `audit_logs`：足够承载 admin 写操作、OAuth 配置变更、角色授权变更、token revoke 等追踪事件；已有 `request_id` 和 `application_id, created_at` 索引。
- `security_events`：是 OAuth 接入追踪主表；当前缺 `request_id`、`application_id + created_at`、`client_id + created_at`、`feishu_user_id + created_at` 索引，也有部分事件 applicationId / feishuUserId 不完整。
- `oauth_login_states`：可解释 redirectUri、scope、state 生命周期，但没有 request id，且包含外部 state。第一版不要直接暴露为原始事件，只在必要时通过 clientId + 时间窗口补上下文。
- `oauth_access_tokens`：可解释 token 所属应用、client、用户、过期、撤销和 lastUsedAt。不得暴露 tokenHash；不需要新增 request id 字段。
- `feishu_sync_runs`：已有 requestId、状态、错误码和错误详情。第一版只按 request id 精确纳入，或在用户不可登录诊断里作为最近同步上下文。

## 后端聚合接口决策

必须新增后端聚合接口，不建议由前端组合现有接口。

推荐接口：

```text
GET /api/v1/admin/traces
```

查询参数：

```text
request_id | requestId
application_id | applicationId
app_key | appKey
client_id | clientId
feishu_user_id | feishuUserId
from
to
result
```

响应结构建议：

```text
{
  "summary": {
    "status": "complete | partial | empty | forbidden",
    "diagnosis": "中文诊断摘要",
    "matchedEventCount": 0,
    "missingStages": ["userinfo", "permission_query"],
    "nextActions": ["检查 client 状态", "核对回调地址"]
  },
  "context": {
    "requestId": "...",
    "application": { "id": "...", "appKey": "...", "name": "..." },
    "clientId": "...",
    "feishuUserId": "...",
    "timeWindow": { "from": "...", "to": "..." }
  },
  "timeline": [
    {
      "id": "...",
      "source": "audit_log | security_event | feishu_sync_run | oauth_token_context",
      "stage": "admin_change | oauth_authorize | oauth_login | token_exchange | userinfo | permission_query | feishu_sync",
      "result": "success | failed | running | partial",
      "occurredAt": "...",
      "title": "授权码换 token 失败",
      "summary": "...",
      "requestId": "...",
      "details": {}
    }
  ],
  "coverage": {
    "auditLogs": 0,
    "securityEvents": 0,
    "feishuSyncRuns": 0,
    "oauthContexts": 0
  }
}
```

后端聚合的原因：

- 权限边界必须在服务端一次性裁剪，避免前端先拉到不可见事件再过滤。
- 脱敏必须在服务端统一执行，避免原始 secret、token、cookie、authorization header、clientSecretHash 进入浏览器。
- 部分命中和无结果需要统一诊断语义，否则每个 Tab 会给出不同解释。
- 未来加索引、分页、窗口限制和事件归一化时不需要改多个前端查询路径。

## 权限边界

追踪接口权限应复用现有角色语义：

| 角色 | 可见范围 | 关键限制 |
|---|---|---|
| `platform_admin` | 全局追踪。 | 可按任意应用、client、用户和 request id 查。 |
| `audit_viewer` | 全局只读追踪。 | 不得暴露 secret/token/cookie/authorization/header 原文。 |
| `application_admin` | 仅授权应用内追踪。 | 未授权应用、client 或 request id 必须表现为无结果或权限不足，不泄露资源存在性。 |
| `sync_admin` | 飞书同步相关审计和同步 run。 | 不得查看应用 OAuth 安全事件；只在 request id 精确匹配同步 run 时展示同步上下文。 |

接口返回应区分：

- 没有任何可见结果：`empty`。
- 有结果但缺少阶段：`partial`。
- 当前角色明确无权使用追踪视角或筛选范围：`forbidden`。

不要在 `application_admin` 未授权时返回“应用存在但不可见”这类文案。

## 脱敏规则

脱敏必须后端完成，前端只展示已脱敏结果。

复用并扩展 `AdminQueryService.redactSensitive`：

- 继续脱敏 `secret`、`token`、`cookie`、`authorization`、`password`、`client_secret`、`accessToken`、`refresh_token`、`clientSecretHash`、`apiKey`、`privateKey`、`credential`。
- 新增事件详情时不得输出 `tokenHash`、`stateHash`、授权码 hash、developer API token hash 或原始 Authorization header。
- `redirectUri`、`clientId`、`appKey`、`requestId` 可以展示并支持复制。
- `externalState` 默认不展示；如必须展示，只展示截断摘要并说明来自第三方系统，不进入一键复制问题信息。
- 飞书 `raw_payload` 不进入追踪接口详情。

## 索引和迁移

建议新增小型索引迁移，不新增业务表：

```sql
CREATE INDEX IF NOT EXISTS security_events_request_id_idx
  ON security_events (request_id);

CREATE INDEX IF NOT EXISTS security_events_application_created_at_idx
  ON security_events (application_id, created_at DESC);

CREATE INDEX IF NOT EXISTS security_events_client_created_at_idx
  ON security_events (client_id, created_at DESC);

CREATE INDEX IF NOT EXISTS security_events_feishu_user_created_at_idx
  ON security_events (feishu_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS feishu_sync_runs_request_id_idx
  ON feishu_sync_runs (request_id);
```

`audit_logs` 已有 `audit_logs_request_id_idx` 和 `audit_logs_application_id_created_at_idx`。`oauth_access_tokens` 已有 `client_id`、`feishu_user_id`、`expires_at` 索引，第一版不需要再加。

时间窗口必须有默认限制，建议默认近 24 小时，最大 30 天。仅传 `request_id` 时可以放宽时间窗口，但仍应限制返回条数。

## 测试策略

后端测试：

- `AdminTraceService` 单元测试：按 request id 命中 audit/security/sync，多源排序，完整命中、部分命中、无结果。
- 权限测试：`platform_admin`、`audit_viewer`、`application_admin`、`sync_admin` 的可见范围和不可见资源不泄露。
- 脱敏测试：详情中不出现 secret、token、cookie、authorization、clientSecretHash、tokenHash、stateHash。
- OAuth 事件补齐测试：token exchange 成功事件包含 applicationId 和 feishuUserId；userinfo / permission query 失败事件包含 requestId 和 reasonCode。
- E2E：`GET /api/v1/admin/traces` 支持 snake_case / camelCase 参数，未登录返回统一 request id，权限不足返回稳定错误。

前端测试：

- 统一问题提示页：桌面和 390px 文案、主操作、复制 request id、一键复制问题信息、复制失败 fallback、`aria-live`。
- 追踪 Tab：初始态、加载、完整命中、部分命中、无结果、权限不足、长 request id、长回调 URL、脱敏字段。
- 应用详情跳转：从开发信息进入追踪视角，URL 带应用 / client / 返回上下文，返回原 Tab。
- 现有四个 Tab 不回退：审计日志、安全事件、同步记录、登录与 Token 记录继续可用。

浏览器自检：

- 实现完成后必须用 Browser 检查 `http://localhost:3000/`，覆盖桌面和 390px；未登录态 401 是预期噪声，但不得有 5xx、布局溢出、遮挡或不可复制字段。

## 发布风险

主要风险：

- 事件补齐如果写太多成功事件，可能扩大 `security_events` 写入量。建议只记录关键成功点和失败点，权限查询成功只存 counts，不存权限全集。
- 应用管理员按 request id 查询时，如果同一 request id 跨应用复用，必须以后端权限裁剪为准。
- 统一问题提示页如果直接替换所有错误页，可能影响现有 OAuth HTML 错误页。建议先抽组件，再逐场景接入。
- 新增索引会带来一次迁移锁风险。当前表规模预期不大，但发布计划仍需包含停机升级和回滚说明。

不建议做的事项：

- 不给 `oauth_login_states` 和 `oauth_access_tokens` 追加 request_id 字段作为第一版前置条件。
- 不让前端并发调用四个旧接口再自行拼时间线。
- 不展示 OAuth token、授权码、stateHash、tokenHash、client secret 或 developer API token 的任何明文或 hash。
- 不在本版本引入 OpenTelemetry、链路追踪中间件或日志聚合基础设施。

## 可进入 writing-plans 的条件

可以进入 `Superpowers writing-plans`。计划文件必须明确：

1. 新增后端聚合接口和事件补齐的文件清单。
2. `security_events` 和 `feishu_sync_runs` 的索引迁移。
3. 统一问题提示页与现有 OAuth HTML 错误页的接入顺序。
4. 每个角色的权限边界和不可见资源表现。
5. 脱敏规则以服务端为准。
6. API、前端、浏览器验证和 112 停机升级验证步骤。

## 推荐 issues 拆分

现有 `#27` 继续作为统一问题提示页入口。

建议 writing-plans 前或计划生成后登记以下 issues：

1. `v0.16.0 追踪聚合接口：按 request id / 应用 / client / 用户生成诊断时间线`
2. `v0.16.0 OAuth 事件补齐：token、userinfo、权限查询失败与关键成功点可追踪`
3. `v0.16.0 操作审计追踪 Tab：诊断摘要、时间线、部分命中和权限不足状态`
4. `v0.16.0 上下文跳转与接入排障文档：应用详情、同步 run、问题提示页闭环`

如果必须压缩 issue 数量，可以把 2 合入 1，但不要把所有工作合成一个泛 issue。

## GSTACK REVIEW REPORT

STATUS：DONE_WITH_CONCERNS

REASON：工程方案可以进入实施计划，但必须新增后端聚合接口、补齐最小事件元数据和索引，不能依赖前端组合旧列表接口。

ATTEMPTED：已读取 discovery、Pencil 原型说明、设计复审、Prisma schema、admin 查询服务、OAuth controller/service、token guard、权限查询 controller、现有记录页和相关测试。

RECOMMENDATION：进入 `Superpowers writing-plans`，并把本文作为工程约束输入。实施计划不要扩大协议面，也不要把追踪视角做成通用报表。
