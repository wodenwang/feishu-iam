# Feishu IAM v0.14.1 应用详情 Tab 化工程评审

日期：2026-05-28
状态：通过，可进入实施计划

## 评审输入

- `docs/superpowers/specs/2026-05-28-feishu-iam-v0.14.1-application-detail-tabs.md`
- GitLab issue `#17`
- `AGENTS.md`
- `DESIGN.md`
- 当前 `apps/admin-web` 应用详情实现

## 结论

`v0.14.1` 可以在不新增 DDL、不调整后端 API 的前提下推进。现有 `ApplicationDetailSheet` 已经集中承载基础信息、回调地址、OAuth credential、Developer credential、接入提示词、角色元数据和应用启停操作；本版本只需要在前端引入 Tab 状态和区块重组。

## 架构方案

### 路由和 URL 状态

- 应用详情页继续使用 `/admin/applications/:appKey`。
- 允许的应用详情 Tab 为 `details`、`roles`、`development`、`danger`。
- `details` 是默认 Tab，不写 query。
- 切换到其他 Tab 时写入 `tab` query，并保留已有 `from` 参数。
- 无效 Tab 降级为 `details`，避免空白页和未知状态。

### 组件边界

- `ApplicationDetailPage.tsx` 负责从 URL 解析 Tab，并把受控 Tab 状态传入详情组件。
- `ApplicationDetailSheet.tsx` 继续负责应用详情数据加载、表单提交、角色操作、凭证操作和确认弹窗。
- `ApplicationDetailSheet.tsx` 增加受控或非受控 Tab 能力：独立页面使用受控模式，旧抽屉兼容入口使用组件内部状态。
- 不抽取新的通用资源页抽象，避免为单页补丁过度抽象。

### 数据流

- 现有数据请求保持不变：应用详情页先按 `appKey` 定位应用，详情组件并行加载接入摘要和角色列表。
- Tab 切换不重新拉取数据，不改变保存流程。
- 应用基础信息、Redirect URI、OAuth secret、角色元数据和应用启停继续复用现有提交函数。

## 风险和处理

- **旧抽屉入口兼容风险**：`ApplicationDetailSheet` 增加默认本地 Tab 状态，未传入 `activeTab` 时仍可使用。
- **URL query 覆盖风险**：切换 Tab 时基于当前 `searchParams` 修改，只增删 `tab`，不丢失 `from`。
- **布局风险**：Tab 列表使用可换行布局，窄屏通过响应式检查和 Browser 自检验证。
- **误改业务边界风险**：本版本不移动角色元数据职责，`角色管理` Tab 仍属于应用管理；权限管理不新增角色元数据入口。

## 测试策略

必须覆盖：

- 应用详情页默认显示 `详细资料` Tab。
- 切换 `角色管理` 后 URL 包含 `tab=roles`。
- 直接访问 `/admin/applications/:appKey?tab=development` 显示 `开发信息`。
- 无效 `tab` 降级到 `详细资料`。
- 旧应用详情抽屉仍可打开并展示 Tab。
- 角色元数据入口仍只在应用管理内，不回到权限管理。

验证命令：

```bash
pnpm --filter @feishu-iam/admin-web test -- src/features/applications/ApplicationManagementView.test.tsx src/App.test.tsx
pnpm --filter @feishu-iam/admin-web build
ADMIN_WEB_URL=http://127.0.0.1:5173 pnpm --filter @feishu-iam/admin-web test:responsive
pnpm check
```

## 放行条件

- `IMPLEMENTATION_PLAN.md` 指向 `v0.14.1`。
- 实现和测试完成后执行 Browser 自检。
- design-review、qa、review 没有未解决阻塞问题。
- README、CHANGELOG、AGENTS、会话归档、版本号、镜像、GitLab release 和 112 部署全部收口。
