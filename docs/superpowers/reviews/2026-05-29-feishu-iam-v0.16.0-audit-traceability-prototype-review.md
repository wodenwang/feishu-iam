# Feishu IAM v0.16.0 生产追踪与接入排障原型设计复审

## 复审对象

- Pencil 源文件：`design/admin-console-v0.16.0.pen`
- 原型说明：`design/v0.16.0-audit-traceability-prototype.md`
- 截图目录：`design/exports/v0.16.0-audit-traceability-prototype/`
- 输入规格：`docs/superpowers/specs/2026-05-29-feishu-iam-v0.16.0-audit-traceability-discovery.md`

## 结论

结论：可以进入 `plan-eng-review`。

本轮原型已经覆盖 `v0.16.0` 进入工程评审前必须回答的产品和交互问题：

- `#27` 未登录页被设计成独立 shadcn/ui 风格单页，主路径是飞书登录，`request id` 默认可见并可复制。
- 390px 未登录态证明主操作、复制 `request id`、一键复制问题信息和反馈引导能在窄屏下共存。
- OAuth 接入失败态复用统一问题提示页，并展示 app/client、长回调路径和复制问题信息。
- 操作审计增加独立“追踪”Tab，初始态、完整命中、部分命中、无结果和权限不足状态清楚。
- 追踪详情使用“诊断摘要 + 时间线 + 事件详情”结构，能展示脱敏字段、长 URL 和 before/after 摘要。
- 应用详情开发信息能跳转到追踪视角，并保留应用、client、时间窗口和返回路径上下文。

## 评分

- 初始原型评分：8/10。
- 修复后评分：9/10。

距离 10/10 的差距主要不在设计层，而在工程评审要确认的数据事实：哪些 OAuth / userinfo / 权限查询事件已经稳定落库，`request_id` 是否贯穿所有链路，以及权限边界下能展示哪些可见字段。

## Findings

### 已修复 P1：OAuth 接入失败页长 `request id` 与复制按钮拥挤

位置：`v0.16.0 03 统一问题提示页 OAuth 接入失败态`

问题：长 `request id` 在排障信息区与“复制 request id”按钮空间竞争，视觉上容易让实现者误以为可以让长文本压到按钮区域。

修复：收窄 `request id` 文本区域，使其在按钮左侧换行，复制按钮保持稳定宽度。已重新导出 `Xh2w2.png`。

### 已修复 P1：追踪详情右侧事件详情栏过窄

位置：`v0.16.0 07 追踪详情 诊断摘要与事件详情`

问题：右侧事件详情栏原始宽度不足，错误码、长 `request id`、长回调 URL 和复制按钮出现拥挤，不能作为工程实现参考。

修复：调整左右列宽，扩大事件详情栏；缩短错误码文本尺寸，长 `request id` 和 URL 保持换行展示，复制按钮不再遮挡内容。已重新导出 `obGQv.png`。

### 已修复 P1：应用详情跳转画板的长回调 URL 和默认筛选文本溢出

位置：`v0.16.0 08 应用详情跳转到追踪视角`

问题：开发信息里的长回调 URL 横向压到右侧上下文面板；右侧默认筛选字段也被截断，违背“长文本策略”画板目的。

修复：调整左右列宽，收窄长 URL 文本区域，使其在字段框内换行；默认筛选字段改为换行展示。已重新导出 `Fvz1Z.png`。

## 非阻塞建议

- 工程实现时，统一问题提示页可以先覆盖未登录、会话过期、无权限和 OAuth 接入失败四类场景；登录失败和通用稳定错误页可按路由能力逐步接入。
- 追踪 Tab 的查询表单在实现时建议保留 URL query 状态，便于从问题页、应用详情和文档链接进入。
- 时间线事件类型建议先控制在 4 到 5 类：OAuth、Token、权限查询、安全事件、审计日志；飞书同步事件可在有关联数据时再展示。

## 验证记录

- Pencil `snapshot_layout(maxDepth=5, problemsOnly=true)`：最终结果为 `No layout problems.`。
- 已重新导出 `Xh2w2.png`、`obGQv.png`、`Fvz1Z.png`。
- 人工复核截图：桌面未登录态、390px 未登录态、OAuth 接入失败态、追踪完整命中态、追踪详情和应用详情跳转态均无关键设计阻塞。

## 后续进入 `plan-eng-review` 的重点问题

- `request_id` 是否已贯穿 admin、OAuth authorize、token、userinfo、权限查询和飞书同步相关路径。
- 现有 `audit_logs`、`security_events`、`oauth_login_states`、`oauth_access_tokens` 和 `feishu_sync_runs` 是否足以支撑追踪视角。
- 追踪视角采用单个后端聚合接口，还是前端组合现有接口；权限、性能和分页如何控制。
- 脱敏规则在后端统一生成还是前端复用展示；如何避免敏感字段通过事件详情泄露。
- `platform_admin`、`audit_viewer`、`application_admin`、`sync_admin` 在追踪视角里的可见范围如何落到接口和测试。
