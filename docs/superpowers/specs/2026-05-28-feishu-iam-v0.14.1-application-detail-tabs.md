# Feishu IAM v0.14.1 应用详情 Tab 化规格

日期：2026-05-28
状态：实施前规格

## 1. 背景

`v0.14.0` 已把应用详情从右侧抽屉升级为独立详情页，但当前独立页内部仍沿用单页纵向堆叠结构。GitLab issue `#17` 指出：应用基础资料、角色管理、开发接入信息和状态操作混在同一页面中，后续继续扩展会降低日常管理效率。

`v0.14.1` 作为 `v0.14.0` 的小版本补丁，只收口应用详情页信息架构，不扩大后端模型和 SSO 协议面。

## 2. 输入来源

- `AGENTS.md`：当前阶段、Admin UI 开发规范、Browser 自检硬约束。
- `DESIGN.md`：复杂配置优先使用独立详情页或 `Tabs`，长字段必须截断、复制或进入详情。
- GitLab issue `#17`：应用管理详情页缺少 Tab 化功能分区。
- `docs/superpowers/specs/2026-05-28-feishu-iam-v0.14.0-admin-detail-pages.md`：应用详情独立页基线。
- 当前 `apps/admin-web/src/features/applications/ApplicationDetailPage.tsx` 和 `ApplicationDetailSheet.tsx` 实现。

## 3. 版本号

推荐版本号：`v0.14.1`。

原因：

- 这是 `v0.14.0` 详情页重构后的信息架构补丁，不是新产品模块。
- 当前唯一打开的 GitLab issue 是 `#17`，范围明确且不要求后端 DDL。
- 变更影响集中在管理后台应用详情页，适合补丁版本发布和 112 停机升级验证。

## 4. 目标

- 应用详情页展示清晰的 Tab 导航。
- `详细资料`、`角色管理`、`开发信息`、`危险操作` 四个工作区互不混排。
- 当前 Tab 进入 URL query，刷新后仍停留在当前 Tab。
- 从应用管理列表进入详情和返回列表时继续保留搜索、状态、分页和排序上下文。
- 桌面和窄屏下 Tab、表格、表单、复制区和操作按钮无错位、遮挡、溢出或异常空白。

## 5. 纳入范围

### 5.1 应用详情 Tab

应用详情页 `/admin/applications/:appKey` 支持以下 Tab：

- `details`：显示应用名称、`app_key`、负责人、描述、状态、创建时间、更新时间，并承载基础信息编辑。
- `roles`：显示应用内 IAM 角色元数据清单、新增角色、编辑角色基础信息、启用和停用角色。
- `development`：显示 Redirect URI、OAuth credential、Developer credential 和安全版接入提示词复制。
- `danger`：显示应用启用/停用说明、状态操作和审计跳转入口。

Tab 展示中文标签：

- `详细资料`
- `角色管理`
- `开发信息`
- `危险操作`

### 5.2 URL 状态

- 默认路径：`/admin/applications/:appKey`
- 非默认 Tab 使用 query：`/admin/applications/:appKey?tab=roles`
- 默认 `details` Tab 不强制写入 query。
- 无效 `tab` 值降级到 `details`，不展示空白页。
- `from=/admin/applications?...` 返回上下文继续保留。

### 5.3 兼容入口

- 旧 `sheet=app:<appKey>` 兼容入口可以继续打开旧抽屉形态。
- 旧抽屉形态也使用相同 Tab 结构，但不强制写 URL Tab 状态。

## 6. 不纳入范围

- 不新增后端 DDL。
- 不改变管理员 session、管理员权限校验或生产部署拓扑。
- 不恢复权限管理中的角色元数据新增、编辑或启停入口。
- 不新增权限点 CRUD。
- 不新增审计记录 Tab；危险操作只提供已有审计跳转入口。
- 不实现完整 OIDC、SAML、ABAC、资源级权限、飞书角色同步或飞书用户组同步。
- 不新增 HTTPS、反向代理、高可用或滚动升级。

## 7. 验收标准

- 从应用管理列表点击 `详情` 后进入 `/admin/applications/:appKey`，页面可见 Tab 导航。
- `详细资料` Tab 只承载应用基础资料和基础信息编辑。
- `角色管理` Tab 只承载应用角色元数据清单、新增、编辑和启停。
- `开发信息` Tab 只承载 Redirect URI、OAuth credential、Developer credential 和接入提示词复制。
- `危险操作` Tab 承载启用/停用应用和查看审计记录入口。
- 切到 `角色管理` 或 `开发信息` 后刷新页面仍停留在当前 Tab。
- 无效 `tab` query 不导致空白页。
- 返回应用管理列表时保留 `from` 中的列表上下文。
- 桌面和 390px 窄屏下 Tab、表单、列表、复制区域和操作按钮无明显错位、遮挡、溢出或异常空白。
- 浏览器 console 无新增错误，Network 无非预期失败请求。
- `pnpm check`、前端定向测试、构建、响应式检查和 Browser 自检通过。

## 8. 发布要求

- 版本元数据更新为 `0.14.1` / `v0.14.1`。
- 更新 `README.md`、`CHANGELOG.md`、`AGENTS.md` 和会话归档。
- 构建并推送 `dockerhub.it.tangtring.com:80/ai/feishu-iam:v0.14.1`。
- GitLab MR 合并、tag、release 收口。
- 关闭 GitLab issue `#17`。
- 在 `192.168.2.112:~/feishu-iam` 完成停机升级。
- 线上验证 `/ready`、`/version` 和应用详情 Tab 主路径。
