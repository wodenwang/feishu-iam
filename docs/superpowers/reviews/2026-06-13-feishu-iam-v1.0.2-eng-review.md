# Feishu IAM v1.0.2 工程评审

日期：2026-06-13
状态：通过，可进入 `IMPLEMENTATION_PLAN.md`

## 评审输入

- `docs/superpowers/specs/2026-06-13-feishu-iam-v1.0.2-frontend-uiux-iteration.md`
- `docs/superpowers/reviews/2026-06-13-feishu-iam-v1.0.2-uiux-plan-design-review.md`
- `docs/superpowers/reviews/2026-06-13-feishu-iam-v1.0.2-prototype-review.md`
- `design/v1.0.2-product-design-visual-target.md`
- `design/v1.0.2-responsive-prototype.md`
- `DESIGN.md`
- 现有前端代码和 OAuth HTML 错误页模板

## Step 0：范围挑战

### 现有能力

- `DataTable` 已统一表格 loading、empty、error、forbidden 状态，但只输出桌面表格结构，见 `apps/admin-web/src/components/admin/DataTable.tsx:70`。
- 权限管理列表已有部分响应式隐藏列补丁，`permission-columns.tsx` 在移动端把角色 key 放到主列内。
- 操作审计页面已经手写了 `max-w-full overflow-x-auto` 包裹 Tabs，见 `apps/admin-web/src/features/records/RecordQueryView.tsx:243`，但当前线上截图仍显示 390px Tab 溢出，说明该策略不能只靠页面级补丁验证。
- `ProblemFeedbackPage` 前端组件已只复制 request id，测试也覆盖不出现“复制问题信息”。
- OAuth HTML 错误页仍在服务端模板中生成 `feedbackText` 并显示 `复制问题信息`，见 `apps/api/src/oauth/oauth-error.filter.ts:68` 和 `apps/api/src/oauth/oauth-error.filter.ts:106`。

### 推荐范围

采用完整 P0 收口，但限制第一切片范围：

1. 增强 `DataTable`，支持移动端资源卡片配置。
2. 建立共享 `ResponsiveTabsList` 或增强 Tabs wrapper，避免每页重复写横向滚动容器。
3. 收口 OAuth HTML 错误页，只复制 request id。
4. 先覆盖应用管理、权限管理、管理员授权和操作审计；复杂配置区和主题 token 进入后续切片。

不建议把主题重做、工作台信息密度和角色复杂配置区一起放入第一切片。原因是第一切片已触达共享表格、Tabs、OAuth 服务端模板、Browser 响应式验证，足够形成端到端闭环。

## D1：移动端资源列表架构

结论：采用 `DataTable` 增加 `mobileCard` 渲染 API。

| 选项 | 判断 | pros | cons | 影响 |
|---|---|---|---|---|
| A. 在 `DataTable` 增加 `mobileCard` 配置 | 推荐并采纳 | 共享 loading/empty/error 状态，应用、权限、管理员、审计可逐步接入；避免页面级重复响应式补丁。 | `DataTable` API 会变宽，需要测试卡片和表格双路径。 | P0 列表缺陷一次性建立组件边界。 |
| B. 每个页面手写移动卡片 | 不采纳 | 单页改动快。 | 四个页面会重复结构，后续系统管理页继续分叉。 | 不符合 DRY，也难以统一 Browser 验证。 |

## D2：Tabs 收口架构

结论：新增项目级 `ResponsiveTabsList` wrapper，保留底层 shadcn/Radix `TabsList`。

| 选项 | 判断 | pros | cons | 影响 |
|---|---|---|---|---|
| A. 增加 `ResponsiveTabsList` | 推荐并采纳 | 不改变底层 `components/ui/tabs.tsx` 的 shadcn 基础组件；页面只替换 wrapper，风险小。 | 需要把现有操作审计、应用详情、角色详情逐步接入。 | 最小化对 Radix/shadcn wrapper 的侵入。 |
| B. 直接修改 `TabsList` 默认行为 | 不采纳 | 所有 Tabs 自动获得滚动能力。 | 可能影响已有桌面布局和内部 `className` 约定。 | 对全站 Tabs 的 blast radius 较大。 |

## D3：公开问题页收口边界

结论：第一切片必须修服务端 OAuth HTML 模板，同时保留前端 `ProblemFeedbackPage` 现有约束。

| 选项 | 判断 | pros | cons | 影响 |
|---|---|---|---|---|
| A. 修 `oauth-error.filter.ts` 并加 API 测试 | 推荐并采纳 | 直接消除线上 `复制问题信息`，覆盖 `/oauth/authorize`、`/oauth/feishu/callback`、旧 `/api/auth/feishu/callback`。 | 需要后端测试和 Browser 公开页截图。 | 对 GitHub issue `#5` 类问题形成真实闭环。 |
| B. 只改前端 `ProblemFeedbackPage` | 不采纳 | 改动更小。 | 当前线上问题不在该组件里，修不到 OAuth HTML 页面。 | 会留下 P0 缺陷。 |

## Architecture Review

发现 3 个需要进入计划的工程问题：

1. `[P1] (confidence: 9/10) apps/admin-web/src/components/admin/DataTable.tsx:120` — 当前 `DataTable` 只返回 `Table`，应用管理列在 `ApplicationManagementView.tsx:155` 到 `ApplicationManagementView.tsx:205` 依赖多列 `minWidth`，390px 下会把内容压碎或迫使页面级横向滚动。
   处理：增加 `mobileCard` 配置，桌面继续表格，移动端输出卡片。

2. `[P1] (confidence: 8/10) apps/admin-web/src/components/ui/tabs.tsx:12` — `TabsList` 默认 `inline-flex h-10`，没有内建滚动容器；页面各自补容器会遗漏。
   处理：新增项目级 `ResponsiveTabsList` 并在 P0 页面替换。

3. `[P1] (confidence: 10/10) apps/api/src/oauth/oauth-error.filter.ts:68` — OAuth HTML 错误页仍构造整段反馈文本，并在 `:106` 复制 `data-feedback`。
   处理：删除整段反馈复制，只展示错误摘要和 request id 复制。

## Code Quality Review

- 共享组件改动必须保持显式，不把列配置自动猜成卡片字段；每个页面提供主字段、元字段和操作区。
- `ResponsiveTabsList` 应作为项目级 admin wrapper 或 UI wrapper，不修改所有 `TabsList` 默认行为，降低回归面。
- OAuth HTML 模板应抽出小的 `renderHtmlError` 内部结构即可，不引入 React SSR 或模板引擎。

## Test Review

测试框架：前端 Vitest + Testing Library，后端 Jest / Nest e2e，响应式脚本为 `apps/admin-web/test/run-responsive-overflow-check.mjs`。

```text
CODE PATHS                                      USER FLOWS
[+] DataTable mobileCard                        [+] 390px 应用管理
  ├── [GAP] loading/empty/error 保持 PageState      ├── [GAP][→E2E] app_key 不逐字竖排
  ├── [GAP] desktop table 仍渲染                    ├── [GAP][→E2E] 状态/更新时间/详情可见
  └── [GAP] mobile card 渲染主字段/元字段/操作       └── [GAP] 无页面级横向溢出

[+] ResponsiveTabsList                          [+] 390px 操作审计
  ├── [GAP] 横向滚动容器存在                       ├── [GAP][→E2E] 5 个 Tab 不撑破视口
  └── [GAP] focus ring 不被裁切                    └── [GAP] 键盘/触控目标可达

[+] OAuth HTML error page                       [+] 公开 OAuth 错误页
  ├── [GAP] /oauth/authorize HTML 只复制 request id ├── [GAP][→E2E] 1440/768/390 无横向溢出
  ├── [GAP] /oauth/feishu/callback 同约束          └── [GAP] 不出现“复制问题信息”
  └── [GAP] /api/auth/feishu/callback 同约束

COVERAGE: 0/12 new paths tested before implementation
QUALITY: ★★★:0 ★★:0 ★:0 | GAPS: 12 (4 E2E/browser)
```

必须新增或更新：

- `apps/admin-web/src/components/admin/DataTable.test.tsx`
- `apps/admin-web/src/components/admin/ResponsiveTabsList.test.tsx` 或对应 wrapper 测试
- `apps/admin-web/src/features/applications/ApplicationManagementView.test.tsx`
- `apps/admin-web/src/features/permissions/PermissionManagementView.test.tsx`
- `apps/admin-web/src/features/admin-users/AdminAuthorizationView.test.tsx`
- `apps/admin-web/src/features/records/RecordQueryView.test.tsx`
- `apps/api/test/oauth.controller.e2e-spec.ts` 或现有 OAuth 测试文件
- Browser 验证：390px 应用管理、权限管理、管理员授权、操作审计，公开错误页 1440/768/390

## Performance Review

无数据库或 API 查询新增。主要性能风险来自移动端卡片重复渲染：

- 资源列表只渲染当前分页数据，不做虚拟滚动。
- `mobileCard` 应避免在 render 内做昂贵排序或聚合；排序和过滤保持在页面现有逻辑中。
- Browser 验证需观察控制台和明显渲染卡顿，但本切片不引入性能基础设施。

## Failure Modes

| 失败模式 | 是否有测试 | 用户表现 | 处理 |
|---|---|---|---|
| 移动端卡片漏主操作 | 计划新增组件和页面测试 | 390px 能看字段但无法进入详情 | `mobileCard.actions` 必填或页面测试断言详情按钮。 |
| 桌面表格因 `DataTable` 修改回退 | 计划新增 desktop table 测试 | 桌面管理员扫描效率下降 | 保持桌面路径默认不变。 |
| Tabs wrapper 裁切 focus ring | 计划新增 wrapper 测试和 Browser 截图 | 键盘用户看不到当前焦点 | 滚动容器保留 padding / focus-visible 样式。 |
| OAuth 模板复制整段信息未清干净 | 计划新增后端 HTML 测试 | 终端用户继续复制多行问题信息 | 测试断言不含 `复制问题信息`、`data-feedback` 和错误详情复制文本。 |

关键风险均有测试或 Browser 验证覆盖，无静默失败的 critical gap。

## NOT in scope

- 不重做全站主题 token；主题和壳层质感进入后续切片。
- 不重构角色组织与用户绑定工作区；本切片只保证列表和 Tabs P0。
- 不新增后端 DDL、OAuth 协议能力、refresh token、SAML、ABAC 或资源级权限。
- 不引入 React SSR 或新模板引擎渲染 OAuth 错误页。
- 不改变管理员 session、权限裁剪、审计写入或 request id 生成机制。

## What Already Exists

- `DataTable`：复用状态和表格壳层，扩展移动卡片。
- `StatusBadge`：复用状态标签。
- `PageState`：复用 loading、empty、error、forbidden。
- `Tabs` / `TabsList` / `TabsTrigger`：保留底层 shadcn/Radix 组件，新增响应式 wrapper。
- `ProblemFeedbackPage`：保留前端问题页约束，服务端 OAuth HTML 模板单独修复。
- `RecordQueryView`：保留 request id 查询和追踪数据流，不恢复问题信息粘贴。

## Parallelization

Sequential implementation, no parallelization opportunity. 第一切片同时触达共享 `DataTable` 和多个页面，且页面接入依赖共享 API 先稳定；并行 worktree 容易产生同文件冲突。

## Implementation Tasks

- [ ] **T1 (P1, human: ~2h / CC: ~25min)** — DataTable — 增加移动端资源卡片 API 并接入应用/权限/管理员/审计列表
  - Surfaced by: Architecture Review finding 1
  - Files: `apps/admin-web/src/components/admin/DataTable.tsx`, `apps/admin-web/src/features/applications/ApplicationManagementView.tsx`, `apps/admin-web/src/features/permissions/PermissionManagementView.tsx`, `apps/admin-web/src/features/admin-users/AdminAuthorizationView.tsx`, `apps/admin-web/src/features/records/RecordQueryView.tsx`
  - Verify: 前端组件测试 + Browser 390px 截图无逐字竖排或页面级溢出。
- [ ] **T2 (P1, human: ~1h / CC: ~15min)** — Tabs — 新增响应式 Tabs wrapper 并接入操作审计、应用详情、角色详情
  - Surfaced by: Architecture Review finding 2
  - Files: `apps/admin-web/src/components/admin/ResponsiveTabsList.tsx`, `apps/admin-web/src/features/records/RecordQueryView.tsx`, `apps/admin-web/src/features/applications/ApplicationDetailPage.tsx`, `apps/admin-web/src/features/permissions/PermissionRoleDetailPage.tsx`
  - Verify: 390px 操作审计、应用详情、角色详情 Tabs 不撑破视口。
- [ ] **T3 (P1, human: ~1h / CC: ~15min)** — OAuth problem page — 移除整段问题信息复制，只复制 request id
  - Surfaced by: Architecture Review finding 3
  - Files: `apps/api/src/oauth/oauth-error.filter.ts`, `apps/api/test/oauth.controller.e2e-spec.ts`
  - Verify: HTML 测试断言无 `复制问题信息` / `data-feedback`，Browser 覆盖 1440/768/390。
- [ ] **T4 (P2, human: ~1h / CC: ~15min)** — QA evidence — 补响应式断言和 Browser 截图记录
  - Surfaced by: Test Review
  - Files: `apps/admin-web/test/run-responsive-overflow-check.mjs`, `docs/acceptance/`
  - Verify: `pnpm --filter @feishu-iam/admin-web test:responsive` 或 Browser 脚本记录。

## Completion Summary

- Step 0: Scope Challenge — scope reduced to complete P0 first slice.
- Architecture Review: 3 issues found, 3 decisions adopted.
- Code Quality Review: 0 blockers, wrapper/API boundary recorded.
- Test Review: diagram produced, 12 gaps identified for implementation.
- Performance Review: 0 blockers.
- NOT in scope: written.
- What already exists: written.
- TODOS.md updates: 0 items proposed; current findings must be built now, not deferred.
- Failure modes: 0 critical gaps flagged.
- Parallelization: sequential.
- Lake Score: 3/3 recommendations chose complete P0 option.
