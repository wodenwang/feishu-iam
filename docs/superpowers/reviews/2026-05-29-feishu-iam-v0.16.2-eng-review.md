# Feishu IAM v0.16.2 工程评审

日期：2026-05-29
状态：已完成，允许进入实施计划

## 评审目标

锁定 `v0.16.2` 对 GitLab issue `#36/#37/#38` 的工程边界、数据流、测试策略和发布风险。该版本是 `v0.16.1` 后的补丁版本，不引入新业务模型。

## 结论

建议按 `v0.16.2` 继续推进，并进入 Superpowers `writing-plans`。

核心决策：

- `#36` 的根因是前端、API 封装、后端和 112 数据库对顶层组织哨兵值不一致。修复应同时覆盖前端顶层用户加载策略和后端 `__root__` 查询口径。
- `#37` 只改应用管理列表操作列按钮形态，不改变应用列表字段、筛选、分页、路由或接口。
- `#38` 只移除“粘贴问题信息 / 提取 request id / 复制问题信息”这类过度复制链路，保留 request id 输入、查询和复制。
- 本版本仍按补丁发布：不新增 DDL，不改变管理员 session，不扩大 SSO 协议和权限模型。

## Step 0 Scope Challenge

### 已有能力

- `OrgBrowser` 已经封装组织与用户同列表浏览、搜索、下钻、返回上级、分页和错误态，位于 `apps/admin-web/src/features/org-browser/org-browser.tsx`。
- 角色组织与用户绑定已经通过 `OrgUserSelector` 复用 `OrgBrowser`，位于 `apps/admin-web/src/features/org-browser/org-user-selector.tsx`。
- 应用内飞书组织/用户候选接口已经存在，位于 `apps/api/src/admin/admin-permission.controller.ts` 和 `apps/admin-web/src/api/feishu.ts`。
- 飞书同步页只读组织浏览也复用同一个 `OrgBrowser`，位于 `apps/admin-web/src/features/settings/SystemSettingsView.tsx`。
- 应用管理列表已通过 `DataTable` 统一操作列，行操作当前位置在 `apps/admin-web/src/features/applications/ApplicationManagementView.tsx`。
- 问题提示页和追踪页已存在复制逻辑，位置分别是 `apps/admin-web/src/components/admin/ProblemFeedbackPage.tsx`、`apps/admin-web/src/features/records/RecordQueryView.tsx`、`apps/admin-web/src/features/records/TraceResultPanel.tsx`。

### 最小变更集

```text
OrgBrowser 顶层状态
  ├─ 组织请求：parentDepartmentId = null
  │    └─ API 编码为 parent_department_id=__root__
  │         └─ 后端把 __root__ 解释为顶层根父节点，兼容 '0' 与 null
  └─ 用户请求：无关键词且未进入具体组织时不请求全量用户

搜索状态
  ├─ 组织请求：keyword，无 parentDepartmentId
  └─ 用户请求：keyword，无 departmentId，允许跨组织搜索

下钻状态
  ├─ 组织请求：parentDepartmentId = 当前组织 id
  └─ 用户请求：departmentId = 当前组织 id
```

最小变更不需要新表、新服务、新路由或新组件体系。

### 复杂度判断

预计改动文件不超过 8 个，新增服务/类为 0。复杂度未触发降 scope。

## Architecture Review

无阻塞架构问题。

架构建议已经锁定：

- 顶层组织语义应在后端集中兼容，避免把生产数据中 `parent_department_id = '0'` 的事实散落到多个前端调用点。
- 前端仍可保留 `null` 表示“顶层组织”的组件语义，由 API 编码为 `__root__`，后端把 `__root__` 解释为飞书镜像根父节点。
- 为避免 112 的历史/真实数据差异，后端顶层组织查询应兼容 `parentDepartmentId in ['0', null]`，同时按 `isDeleted: false` 过滤。
- 顶层无关键词时，`OrgBrowser` 不应调用用户候选接口获取全量用户第一页；可以返回空用户结果或跳过请求后合并空结果。
- 搜索模式继续允许跨组织搜索组织和用户，避免修复顶层问题时破坏 `v0.15.2` 已收口的搜索体验。

## Code Quality Review

无阻塞代码质量问题。

实现建议：

- 抽出一个小型前端空分页 helper，例如 `emptyPage<T>()`，避免在 `OrgBrowser` 里内联重复 `{ items: [], total: 0, page, pageSize }`。
- 后端不要复制一套新 controller；直接调整现有 `normalizeParentDepartmentId` 或查询构造逻辑。
- `#38` 中如果删除 `buildFeedbackText` 或 `extractTraceRequestIdFromText` 后出现无引用函数，应同步删除测试和导出，避免保留死代码。
- 应用管理行操作按钮使用现有 `lucide-react` 的 `Eye`，不要新增图标库。

## Test Review

测试框架：

- 后端：Vitest + Supertest。
- 前端：Vitest + Testing Library。
- 响应式/浏览器：项目已有 `test:responsive` 和 Browser 自检要求。

### 覆盖图

```text
CODE PATHS                                                       USER FLOWS
[+] OrgBrowser 顶层加载                                          [+] 角色组织与用户绑定
  ├── [GAP] 顶层无关键词：只加载一级组织，不加载全量用户            ├── [GAP] 顶层显示 4 个一级组织
  ├── [GAP] 顶层无关键词：用户结果为空且不报错                    ├── [GAP] 下钻惠州唐群 / 信息技术部后显示直接用户
  ├── [GAP] 搜索关键词：组织和用户跨组织搜索仍可用                └── [GAP] 已选组织/用户草稿不因下钻或返回被清空
  └── [GAP] 下钻组织：加载子组织和直接用户

[+] 后端应用内组织候选接口                                      [+] 飞书同步只读组织浏览
  ├── [GAP] parent_department_id=__root__ 查询 '0' 与 null        ├── [GAP] 不出现角色绑定语义
  └── [GAP] parent_department_id=具体组织 查询子组织              └── [GAP] 继续只读浏览组织和用户

[+] 应用管理列表操作列                                          [+] 应用管理
  └── [GAP] 详情按钮为纯 icon，保留 aria-label/title              └── [GAP] 桌面和窄屏操作列不换行、不变形

[+] 问题提示页 / 操作审计追踪页                                  [+] 排障
  ├── [GAP] 问题提示页只保留复制 request id                       ├── [GAP] 用户只能复制 request id
  ├── [GAP] 追踪页不再显示粘贴问题信息区域                       └── [GAP] 管理员仍可输入 request id 查询
  └── [GAP] 追踪结果不再出现复制问题信息按钮
```

### 必须补齐的测试

- `apps/admin-web/src/features/permissions/PermissionManagementView.test.tsx`
  - 覆盖角色详情 `组织与用户绑定` 顶层默认只请求组织，不请求全量用户。
  - 覆盖下钻后请求直接用户，搜索时仍允许跨组织用户搜索。
- `apps/api/test/admin.controller.e2e-spec.ts`
  - 覆盖应用内组织候选接口 `parent_department_id=__root__` 返回根级组织，兼容 `parentDepartmentId = '0'` 与 `null`。
- `apps/admin-web/src/features/applications/ApplicationManagementView.test.tsx`
  - 覆盖应用管理列表详情操作为纯 icon，有可访问名称。
- `apps/admin-web/src/features/records/RecordQueryView.test.tsx`
  - 删除“粘贴问题信息 / 提取 request id”测试，新增不出现相关控件且 request id 查询仍可用的测试。
- `apps/admin-web/src/components/admin/ProblemFeedbackPage.test.tsx`
  - 覆盖页面只提供“复制 request id”，不再提供“复制问题信息”。
- `apps/admin-web/src/features/records/TraceResultPanel` 相关测试或现有 `RecordQueryView.test.tsx`
  - 覆盖追踪结果不再提供“复制问题信息”按钮。

## Performance Review

无阻塞性能问题。

注意点：

- 修复后的顶层视图会少一次全量用户分页请求，是性能收益。
- 顶层组织查询用 `OR [{ parentDepartmentId: '0' }, { parentDepartmentId: null }]` 时，当前数据量很小，不需要新增索引或 DDL。
- 不应在前端为了规避接口问题而请求全部组织后本地过滤；继续让后端分页过滤。

## Failure Modes

| 路径 | 生产失败方式 | 测试要求 | 用户体验要求 |
|---|---|---|---|
| 顶层组织加载 | 112 根组织父节点为 `'0'`，查询 `null` 返回空 | 后端 e2e 和前端集成测试覆盖 | 显示一级组织，不误显示全量用户 |
| 顶层用户加载 | 未传 `department_id` 返回全量用户第一页 | 前端测试断言顶层不调用用户全量请求 | 顶层不出现无关用户列表 |
| 搜索用户 | 修复顶层后误禁用跨组织搜索 | 前端测试覆盖关键词搜索用户 | 搜索结果仍能出现用户 |
| 下钻用户 | 进入部门后不加载直接用户 | 前端测试覆盖下钻请求 | 组织下可看到直接用户 |
| request id 排障 | 移除粘贴区后误删 request id 查询 | 前端测试覆盖 request id 输入查询 | 管理员仍能直接查询追踪 |
| 问题提示页 | 复制按钮误复制整段信息 | 前端测试覆盖仅复制 request id | 用户只复制最小排障信息 |

当前无“无测试、无错误处理且静默失败”的关键缺口；实施计划必须把上表测试写入任务。

## What Already Exists

- 复用 `OrgBrowser` / `OrgUserSelector`，不重做组织选择器。
- 复用 `fetchApplicationFeishuDepartments` / `fetchApplicationFeishuUsers`，不新增 API 封装体系。
- 复用 `admin-permission.controller` 的应用内候选接口，不新增路由。
- 复用 `DataTable` 和 `Button`，不新增行操作组件体系。
- 复用 `ProblemFeedbackPage`、`RecordQueryView` 和 `TraceResultPanel`，不新增排障页面。

## NOT in scope

- 不新增 DDL 或 Prisma schema 变更：当前问题可通过查询口径和前端加载策略修复。
- 不实现飞书实时组织树或实时通讯录：本版本只读取本地镜像。
- 不做全站按钮治理：只处理 `#37` 指定的应用管理列表行操作。
- 不改变 request id 生成、传递、后端日志追踪或追踪聚合接口。
- 不改变管理员 session、权限模型、SSO/OIDC、部署拓扑或 112 升级方式。

## Worktree Parallelization Strategy

Sequential implementation, no parallelization opportunity.

原因：三个 issue 都触达 `apps/admin-web` 的共享测试和后台 UI，`#36` 还需要前后端契约同步。并行拆分会增加测试和 merge 冲突成本，不符合补丁版本目标。

## Implementation Tasks

- [ ] **T1 (P1, human: ~2h / CC: ~20min)** — 组织用户选择器 — 修复顶层组织和用户加载口径
  - Surfaced by: Architecture/Test Review — `#36` 生产可复现，顶层组织不应显示全量用户。
  - Files: `apps/admin-web/src/features/org-browser/org-browser.tsx`, `apps/admin-web/src/features/permissions/PermissionManagementView.test.tsx`, `apps/api/src/admin/admin-permission.controller.ts`, `apps/api/test/admin.controller.e2e-spec.ts`
  - Verify: `pnpm --filter @feishu-iam/api test -- test/admin.controller.e2e-spec.ts`, `pnpm --filter @feishu-iam/admin-web test -- src/features/permissions/PermissionManagementView.test.tsx`
- [ ] **T2 (P2, human: ~30min / CC: ~8min)** — 应用管理 — 将列表详情操作改为纯 icon
  - Surfaced by: Code Quality/Test Review — `#37` 违反当前按钮规范。
  - Files: `apps/admin-web/src/features/applications/ApplicationManagementView.tsx`, `apps/admin-web/src/features/applications/ApplicationManagementView.test.tsx`
  - Verify: `pnpm --filter @feishu-iam/admin-web test -- src/features/applications/ApplicationManagementView.test.tsx`, `pnpm --filter @feishu-iam/admin-web test:buttons`
- [ ] **T3 (P2, human: ~45min / CC: ~12min)** — 操作审计追踪 — 移除问题信息粘贴和整段复制
  - Surfaced by: Architecture/Test Review — `#38` 要求只保留 request id 输入、查询和复制。
  - Files: `apps/admin-web/src/components/admin/ProblemFeedbackPage.tsx`, `apps/admin-web/src/components/admin/ProblemFeedbackPage.test.tsx`, `apps/admin-web/src/features/records/RecordQueryView.tsx`, `apps/admin-web/src/features/records/RecordQueryView.test.tsx`, `apps/admin-web/src/features/records/TraceResultPanel.tsx`, `apps/admin-web/src/features/records/trace-format.ts`, `apps/admin-web/src/features/records/trace-format.test.ts`
  - Verify: `pnpm --filter @feishu-iam/admin-web test -- src/components/admin/ProblemFeedbackPage.test.tsx src/features/records/RecordQueryView.test.tsx src/features/records/trace-format.test.ts`
- [ ] **T4 (P2, human: ~45min / CC: ~10min)** — 版本材料 — 更新 `v0.16.2` 文档和会话归档
  - Surfaced by: Release boundary — 项目要求版本提交、发布、MR 收口或镜像发布同步 README。
  - Files: `README.md`, `CHANGELOG.md`, `AGENTS.md`, `package.json`, `apps/api/package.json`, `apps/admin-web/package.json`, `docs/codex-sessions/`
  - Verify: `rg -n "v0\\.16\\.2|v0\\.16\\.1" README.md CHANGELOG.md AGENTS.md package.json apps/api/package.json apps/admin-web/package.json`

## 完成摘要

- Step 0: Scope Challenge — scope accepted as-is。
- Architecture Review: 0 blocking issues found。
- Code Quality Review: 0 blocking issues found。
- Test Review: diagram produced, 13 gaps identified and converted into implementation tasks。
- Performance Review: 0 issues found。
- NOT in scope: written。
- What already exists: written。
- TODOS.md updates: 0 items proposed；无长期 TODO 需要新增。
- Failure modes: 0 critical gaps flagged after test requirements are included。
- Outside voice: skipped；当前是小补丁工程评审。
- Parallelization: 1 lane, sequential。
- Lake Score: 4/4 recommendations chose complete option。
