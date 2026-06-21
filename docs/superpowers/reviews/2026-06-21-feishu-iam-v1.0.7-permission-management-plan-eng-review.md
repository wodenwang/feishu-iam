# Feishu IAM v1.0.7 权限管理 Step 5 工程方案评审

评审时间：2026-06-21 11:54 CST。

评审方式：按 gstack `/plan-eng-review` 的工程评审流程执行；因本次 Codex 兼容要求，不进入 Plan mode，不调用 AskUserQuestion / request_user_input，所有交互门禁改为 Markdown 决策表。

## 输入

- `AGENTS.md`
- `DESIGN.md`
- `docs/superpowers/specs/2026-06-21-feishu-iam-v1.0.7-permission-management-prd.md`
- `docs/design-audits/2026-06-21-permission-management-next-prd/step2-product-design-planning-review.md`
- `design/product-design-v1.0.7-permission-management/visual-directions.md`
- `design/product-design-v1.0.7-permission-management/selected-visual-target-review.md`
- 代码证据：`apps/admin-web/src/routes/admin-routes.ts`、`apps/admin-web/src/App.tsx`、`apps/admin-web/src/features/permissions/*`、`apps/admin-web/src/api/permission.ts`、`apps/api/src/admin/admin-permission.controller.ts`、`apps/api/src/permission/iam-role.service.ts`、`apps/api/src/permission/permission-calculation.service.ts`、`apps/api/prisma/schema.prisma`、`migrations/V1_0_5__role_application_bindings.sql`

## 结论

`v1.0.7` 可以按用户已确认的边界在一个版本内完成 S1 角色工作台减负和 S2 权限矩阵 MVP，不需要拆成 `v1.0.8`。

工程上可控的前提：

1. 不新增权限模型和 DDL；角色-应用软解除复用现有 `iam_role_applications.status`。
2. 新增一个只读权限矩阵查询服务，专门返回来源解释字段，不把矩阵逻辑塞进前端聚合。
3. 权限管理二级导航复用现有 `systemRoutes` / `children` / `flattenRoutes` 模式，旧深链保持可用。
4. Step 6 实施计划必须先做后端契约和 route skeleton，再落 UI，避免前端假数据先行。

本轮无关键设计或工程阻塞；可以进入 Step 6 `Superpowers writing-plans`。

## Step 0 Scope Challenge

### What already exists

| 子问题 | 已有能力 | 复用判断 |
|---|---|---|
| 二级导航 | `adminRoutes` 已支持 `children`，`systemRoutes` 已是二级导航 | 复用，不新增导航框架 |
| 旧深链 active 匹配 | `getActiveAdminRoute()` 使用 `flattenRoutes()` 和最长路径匹配 | 复用，但要补权限二级 route id 测试 |
| 创建角色 API | 后端已有 `POST /api/v1/admin/applications/:appKey/iam-roles` | 复用；前端弹框补应用选择 |
| 角色-应用绑定 | 已有 `iam_role_applications` join table 和 `status active/disabled` | 复用；新增停用绑定方法和接口 |
| 绑定审计 | `IamRoleService.bindRoleToApplication()` 已写 `bind_application` audit | 复用同一 audit 模式，新增 `unbind_application` 或 `set_application_binding_status` |
| 用户权限计算 | `PermissionCalculationService.calculate(appKey, userId)` 已计算用户直接绑定和所属组织绑定 | 复用语义，但不能直接满足矩阵来源解释 |
| 组织/用户选择器 | 前端已有 `OrgUserSelector` / `OrgBrowser` | 复用；矩阵查询页不要另造选择器 |
| 状态组件 | 前端已有 `PageState`、`DataTable`、`StatusBadge`、`ResponsiveTabsList` | 复用；补 matrix 专用空/错/加载状态 |

### Minimum complete change

最小完整版本不是“只改前端页面”，而是以下四段闭环：

```text
Admin shell route
  -> /admin/permissions 角色授权
  -> /admin/permissions/matrix 权限矩阵

Role workbench
  -> 三个 tab：总览 / 组织与用户 / 应用权限
  -> 管理角色关联应用 Dialog
  -> PATCH role application binding active/disabled
  -> audit log

Matrix query API
  -> subject validation
  -> application grouped query
  -> source roles / source groups / match type
  -> safe error + request id

Browser + tests
  -> role list, create role, app binding add/remove
  -> user matrix, department matrix
  -> 390px states
```

### Complexity check

本计划会触及超过 8 个文件，但不是过度设计信号，而是因为一个版本内同时包含后台路由、角色工作台 UI、一个写接口、一个只读查询接口和测试。范围可控的工程护栏是：

- 新增服务最多 1 个：`AdminPermissionMatrixService`。
- 新增页面最多 1 个：`PermissionMatrixView`。
- 新增 Dialog 最多 1 个：`RoleApplicationBindingDialog` 或等价命名。
- 不新增 DDL、不新增权限模型、不新增报表/导出/图谱。

### Search check

没有引入新框架、基础设施或并发模式。所有模式采用现有 NestJS Controller/Service、Prisma 查询、React Router、shadcn/ui + 项目 wrapper。[Layer 1]

### TODOS.md

仓库当前没有 `TODOS.md`。本评审不新增 TODO；所有本版必要工作进入 Step 6 实施计划。

### Distribution check

不新增二进制、库包或新镜像类型。仍沿用现有 Docker Compose / `upgrade.sh` 发布链路。

## 决策门禁

### D1：权限管理二级导航和创建角色入口

| 选项 | 推荐项 | pros | cons | 影响范围 |
|---|---|---|---|---|
| A. `权限管理` 改为左侧一级分组，二级为 `角色授权` / `权限矩阵`；`创建角色` 对平台管理员始终可点，未选应用时在弹框内选择应用 | ✅ 推荐 | 与 `系统管理` IA 一致；保留 `/admin/permissions` 旧入口；解决平台管理员无解释 disabled；角色仍归属具体应用 | 需要调整 route id、breadcrumb、active route 测试和创建弹框 props | `admin-routes.ts`、`App.tsx`、`PermissionManagementView`、创建角色 Dialog、路由测试 |
| B. 保持左侧单入口，进入权限管理后用页内 Tab 切 `角色授权` / `权限矩阵` |  | 改动小，路由风险低 | 继续混淆配置任务和查询任务；不符合 Step 2/4 设计结论；深链和移动导航表达弱 | 权限页面内部 UI |
| C. 把 `权限矩阵` 做成独立一级导航 |  | 实现直观，active 匹配简单 | 权限模块被拆散，不符合后台 IA；后续权限类能力扩展会更乱 | 左侧导航和文档入口 |

工程裁决：采用 A。`/admin/permissions` 继续指向角色授权；新增 `/admin/permissions/matrix`；旧角色详情深链继续保留。

### D2：角色-应用绑定软解除 API

| 选项 | 推荐项 | pros | cons | 影响范围 |
|---|---|---|---|---|
| A. 新增 `PATCH /api/v1/admin/applications/:appKey/iam-roles/:roleId/application-binding`，body `{ "status": "active" | "disabled" }`；保留现有 `POST .../application-binding` 作为绑定兼容入口 | ✅ 推荐 | 符合现有 `iam_role_applications.status`；一个接口表达添加/恢复/软解除；不新增 DDL；审计 before/after 清楚 | 比 `POST /disable` 多一个 body validator；前端需新增 `disableIamRoleApplication` 或统一 setStatus API | `IamRoleService`、`AdminPermissionController`、前端 permission API、Dialog、后端测试 |
| B. 只新增 `POST .../application-binding/disable` |  | 语义直白，改动略小 | 未来恢复 active 还要再加接口；与现有 `status` 字段表达不完全对齐 | 后端接口和前端 API |
| C. 删除 join row 或删除权限组绑定来表达移除 |  | 短期 SQL 简单 | 违反 PRD 的软解除和审计边界；外键和历史追溯风险高 | 数据一致性、审计、回滚 |

工程裁决：采用 A。证据：`migrations/V1_0_5__role_application_bindings.sql` 已创建 `status active/disabled`，`apps/api/prisma/schema.prisma` 已映射 `IamRoleApplication.status`。

### D3：权限矩阵 API 和来源解释

| 选项 | 推荐项 | pros | cons | 影响范围 |
|---|---|---|---|---|
| A. 新增只读 `GET /api/v1/admin/permission-matrix` 和 `AdminPermissionMatrixService`，服务端按应用分组返回 `matched_roles`、`permission_groups`、`permission_points`、`source_roles`、`source_groups`、`match_type` | ✅ 推荐 | 权限/安全边界在服务端；避免前端 N+1 聚合；能稳定返回来源解释；便于 e2e 覆盖 | 新增一个服务和控制器入口；需要认真写查询和序列化测试 | `apps/api/src/admin/*`、`apps/admin-web/src/api/permission.ts`、`PermissionMatrixView` |
| B. 扩展 `PermissionCalculationService.calculate()`，让它支持所有应用和来源解释 |  | 复用当前服务名和部分逻辑 | 容易污染开放 API 的权限计算职责；服务参数会膨胀；组织矩阵语义不同 | `permission` domain service 和管理后台接口 |
| C. 前端获取所有应用，再逐个调用现有用户权限接口并拼结果 |  | 后端改动少 | 不能支持组织直接绑定矩阵；N+1 请求；来源解释缺失；权限裁剪放到前端不稳 | 前端复杂度、性能、安全 |

工程裁决：采用 A。`PermissionCalculationService` 可以作为语义参考，但矩阵需要新的服务端查询形态。

## Architecture Review

### 1. 路由和旧深链兼容

当前 `AdminRouteId` 只有单个 `"permissions"`，`adminRoutes` 把 `/admin/permissions` 作为一级入口。新增矩阵时应改为：

```text
permissions parent
  path: /admin/permissions
  label: 权限管理
  children:
    permissionsRoleAuth -> /admin/permissions
    permissionsMatrix   -> /admin/permissions/matrix
```

注意点：

- `getActiveAdminRoute()` 现有最长路径匹配能让 `/admin/permissions/matrix` 命中矩阵子项，但要补测试。
- 父级 route 也使用 `/admin/permissions` 时，排序已用 `Number(Boolean(a.children)) - Number(Boolean(b.children))` 让子项优先于父项；仍要用测试锁定。
- `routePath("permissions")` 如果继续存在，应返回 `/admin/permissions` 兼容老调用；新增 `routePath("permissionsMatrix")`。
- `/admin/permissions/roles/:roleId` 和 `/admin/permissions/:appKey/roles/:roleId` 不应被 matrix route 抢占。React Router 中矩阵 route 要显式放在 role routes 之前或之后都可，但测试必须覆盖。

### 2. 创建角色 disabled 根因

当前前端按钮禁用条件是：

```text
disabled={!search.appKey || !canManageGlobalRoles}
```

这解释了线上平台管理员在全部应用视图下看见 disabled。后端创建接口仍以 appKey 为 path 参数，模型上“角色必须绑定一个应用”是合理的；问题在前端没有把应用选择放进创建流程。

工程方案：

- `PermissionManagementView` 的平台管理员 `创建角色` 按钮不再因 `!search.appKey` 禁用。
- `PermissionRoleCreateDialog` 支持 `applications` 和 `defaultAppKey`。
- 如果 `search.appKey` 为空，Dialog 第一项必须选择应用；提交时调用 `createIamRole(selectedAppKey, draft)`。
- 应用管理员仍禁用创建、编辑、启停和批量写操作，并保留 tooltip / title。

### 3. 角色-应用绑定状态

现有数据模型已经支持软解除。推荐新增：

```text
IamRoleService.setRoleApplicationBindingStatus(appKey, roleId, status, auditContext)
  -> validate application exists
  -> validate role exists
  -> find binding
  -> if missing and status=disabled: 404 IAM_ROLE_APPLICATION_BINDING_NOT_FOUND
  -> if status=active: upsert active
  -> if status=disabled: update binding status disabled
  -> record audit
  -> return role summary with app_key
```

当前角色被移除后的前端 fallback：

```text
confirm remove current app
  -> PATCH disabled
  -> reload role detail
  -> active apps = role.applications where bindingStatus=active
  -> if any: navigate ?appKey=firstActive&tab=permissions
  -> else: stay on role page, show no bound application empty state
```

### 4. 权限矩阵查询数据流

```text
GET /api/v1/admin/permission-matrix?subjectType=user&subjectId=u1
  -> AdminSessionGuard
  -> AdminPermissionService asserts platform_admin or allowed admin scope
  -> validate subject exists and active / not deleted
  -> load user's direct departments
  -> find active role applications across active applications
  -> match role subjects:
       feishu_user == u1
       feishu_department in user's direct departments
  -> collect active permission groups and active permission points
  -> group by application
  -> return source roles, source groups, match types, computed_at
```

```text
GET /api/v1/admin/permission-matrix?subjectType=department&subjectId=d1
  -> validate department exists and not deleted
  -> match only role subjects where subjectType=feishu_department and subjectId=d1
  -> no expansion to department users
  -> same application grouping
  -> scope_note says direct organization binding only
```

关键约束：

- 只读接口默认不写 audit log；如后续认为敏感，可写安全事件，但本版本不新增该要求。
- 不能返回 secret、token、cookie、authorization、授权码、token hash、state hash、raw payload。
- 组织查询不展开用户，避免语义和性能扩大。

## Code Quality Review

### Findings

1. `[P1] (confidence: 9/10) apps/admin-web/src/features/permissions/PermissionRoleDetailSheet.tsx — 当前应用权限区仍把添加应用做成 select + button，并且保留权限点对比面板。`
   - 证据：`GroupsTab` 内有 `添加应用` select，右侧仍渲染 `PermissionPointComparePanel`。
   - Step 6 任务：替换为 `管理角色关联应用` Dialog，并移除角色工作台内的 `权限点对比`。

2. `[P1] (confidence: 9/10) apps/admin-web/src/features/permissions/PermissionManagementView.tsx:270 — 平台管理员在未选择应用时仍被 disabled 拦住创建角色。`
   - 证据：`disabled={!search.appKey || !canManageGlobalRoles}`。
   - Step 6 任务：把应用选择移入创建 Dialog。

3. `[P1] (confidence: 9/10) apps/api/src/permission/permission-calculation.service.ts — 现有权限计算缺少来源解释字段，不能直接作为权限矩阵响应。`
   - 证据：返回 `permissionGroups`、`permissionPoints`、`matchedRoles` 都是去重后的 key/name，没有 `source_roles`、`source_groups`、`match_type`。
   - Step 6 任务：新增管理后台矩阵服务并写来源解释序列化测试。

## Test Review

### Test framework

- Node / pnpm monorepo。
- 前端测试：Vitest + Testing Library，现有文件包括 `PermissionManagementView.test.tsx`、`PermissionRoleDetailSheet.test.tsx`、`permission.test.ts`、`App.test.tsx`。
- 后端测试：NestJS/Vitest 风格，现有 `apps/api/test/admin-permission.service.spec.ts`。

### Coverage diagram

```text
CODE PATHS                                                    USER FLOWS
[+] admin-routes.ts                                           [+] 权限管理导航
  ├── [GAP] permissions parent children                         ├── [GAP] /admin/permissions 显示角色授权
  ├── [GAP] /admin/permissions/matrix active                    ├── [GAP] /admin/permissions/matrix 显示矩阵
  └── [GAP] old role detail active still under permissions       └── [GAP] 旧 role detail 深链可打开

[+] PermissionManagementView / create dialog                   [+] 创建角色
  ├── [GAP] platform admin + no app opens dialog                 ├── [GAP] 未选应用时字段级错误
  ├── [GAP] default app flows through submit                     ├── [GAP] 选择应用后创建成功并刷新
  └── [★★] app admin disabled actions existing                   └── [★★] 应用管理员无写权限提示

[+] RoleApplicationBindingDialog                               [+] 管理角色关联应用
  ├── [GAP] search bound/unbound apps                            ├── [GAP] 添加未绑定应用
  ├── [GAP] PATCH active / disabled                              ├── [GAP] 移除当前应用并 fallback
  ├── [GAP] submit pending / error                               ├── [GAP] 提交失败保留草稿
  └── [GAP] no bound apps empty                                  └── [GAP] 390px 单列分区

[+] AdminPermissionMatrixService                               [+] 权限矩阵查询
  ├── [GAP] user direct role                                     ├── [GAP] 用户查询结果按应用分组
  ├── [GAP] user department inherited role                       ├── [GAP] 组织查询只显示直接组织绑定
  ├── [GAP] department direct role only                          ├── [GAP] 空结果
  ├── [GAP] disabled role/app/group/point excluded               ├── [GAP] 错误带 request id
  └── [GAP] no secret/raw payload in response                    └── [GAP] 权限不足状态

COVERAGE: existing coverage is partial; new paths have 0/24 tests until Step 7.
QUALITY: ★★ existing app-admin disabled path only. All new behavior needs fresh tests.
```

### Required tests

后端：

```bash
pnpm --filter @feishu-iam/api test -- test/admin-permission-matrix.e2e-spec.ts test/admin-role-application-binding.e2e-spec.ts
```

前端：

```bash
pnpm --filter @feishu-iam/admin-web test -- src/routes/admin-url-state.test.ts src/features/permissions/PermissionManagementView.test.tsx src/features/permissions/PermissionRoleDetailSheet.test.tsx src/features/permissions/PermissionMatrixView.test.tsx
pnpm --filter @feishu-iam/admin-web test -- src/api/permission.test.ts
```

全量门禁：

```bash
pnpm --filter @feishu-iam/admin-web typecheck
pnpm --filter @feishu-iam/admin-web lint
pnpm --filter @feishu-iam/admin-web build
pnpm --filter @feishu-iam/api test -- test/admin-permission-matrix.e2e-spec.ts test/admin-role-application-binding.e2e-spec.ts
pnpm check
pnpm build
```

Browser 自检：

- `/admin/permissions`
- `/admin/permissions/roles/:roleId?appKey=...&tab=overview`
- `/admin/permissions/roles/:roleId?appKey=...&tab=subjects`
- `/admin/permissions/roles/:roleId?appKey=...&tab=permissions`
- `管理角色关联应用` Dialog 添加 / 移除 / 提交失败
- `/admin/permissions/matrix` 用户查询
- `/admin/permissions/matrix` 组织查询
- 390px：角色授权、应用权限、Dialog、权限矩阵、解释 Sheet

## Performance Review

### Findings

1. `[P1] (confidence: 8/10) 权限矩阵不能由前端逐应用调用现有用户权限接口。`
   - 原因：会形成应用数级 N+1 请求，不能支持组织直接绑定语义，也不能提供来源解释。
   - 推荐：服务端一次查询所有 active app-role bindings，再在内存中按应用分组。

2. `[P2] (confidence: 7/10) 矩阵结果可能在权限点较多时膨胀。`
   - 推荐：MVP 不分页应用分组，但前端按应用折叠，后端只返回必要字段；后续若真实数据过大再加分页或 appKey filter。

3. `[P2] (confidence: 7/10) 前端 `fetchIamRolesAcrossApplications()` 当前逐应用拉角色列表，角色授权列表在应用数量增加后会变慢。`
   - 本版本不强制新增全局角色列表 API；但 Step 6 应避免让权限矩阵复用这个前端聚合路径。

## Security And Audit

- 角色-应用绑定停用是写操作，必须经过 `AdminSessionGuard`、`assertCanManageApplication()`、`assertCanManageGlobalIamRoles()`，并写审计。
- 权限矩阵是只读管理后台查询，必须走管理员 session 和权限校验。建议平台管理员可查全局；应用管理员是否允许查矩阵应保守处理：首版仅平台管理员可查，避免跨应用泄漏。
- 矩阵响应只返回应用、角色、权限组、权限点和来源解释，不返回 raw payload 或敏感凭证。
- 错误统一使用后台错误结构和 request id，不暴露堆栈。

## Failure Modes

| 新路径 | 真实故障 | 计划处理 | 是否关键缺口 |
|---|---|---|---|
| 二级导航 | `/admin/permissions/matrix` 被 `/admin/permissions/:appKey/roles/:roleId` 误判 | route test 覆盖 matrix path 和 role deep link | 否 |
| 创建角色 | 平台管理员未选应用直接提交 | Dialog 字段级错误，不发请求 | 否 |
| 移除当前应用 | 当前 app disabled 后 URL 仍指向已停用 binding | reload 后切剩余 active app；无剩余则空状态 | 否 |
| 绑定停用 API | binding 不存在仍返回成功 | 对 disabled 缺失 binding 返回 404；active 可 upsert | 否 |
| 用户矩阵 | 用户不存在或已删除 | 返回中文错误 + request id | 否 |
| 组织矩阵 | 实现误展开组织下用户 | 后端测试锁定只匹配直接组织绑定 | 否 |
| 矩阵大结果 | 权限点 key 过长撑破布局 | 前端折叠、break-all、copy/tooltip、390px 测试 | 否 |
| 权限不足 | 前端把 403 当空结果 | `PageState forbidden` 测试 | 否 |

## NOT In Scope

- 不拆 `v1.0.8`。
- 不新增 DDL，除非后续实现发现生产库缺 `iam_role_applications.status`，但当前 schema 和 migration 均显示已存在。
- 不实现 ABAC、资源级权限、deny、数据范围权限。
- 不实现完整 OIDC、SAML、refresh token。
- 不改变管理员 session 或生产登录机制。
- 不把组织矩阵扩展为组织下所有用户的展开计算。
- 不在权限矩阵中编辑角色、权限组或权限点。
- 不新增导出、图谱、BI 报表或跨主体对比。
- 不恢复应用管理中的角色元数据主流程。

## Parallelization Strategy

可以并行，但建议先合并后端契约 skeleton。

| Step | Modules touched | Depends on |
|---|---|---|
| A. 路由和导航 skeleton | `apps/admin-web/src/routes`、`apps/admin-web/src/App.tsx` | - |
| B. 角色-应用绑定 API | `apps/api/src/admin`、`apps/api/src/permission`、`apps/admin-web/src/api` | - |
| C. 权限矩阵 API | `apps/api/src/admin`、`apps/api/test` | - |
| D. 角色工作台 UI | `apps/admin-web/src/features/permissions` | A, B |
| E. 权限矩阵 UI | `apps/admin-web/src/features/permissions` | A, C |
| F. Browser / QA | `output/playwright` 或 QA 记录 | D, E |

Parallel lanes:

- Lane 1：A 路由 skeleton。
- Lane 2：B 绑定 API。
- Lane 3：C 矩阵 API。
- Lane 4：D + E 前端 UI，等 A/B/C 合并后进行。
- Lane 5：F Browser / QA。

冲突提示：D 和 E 都会触碰 `apps/admin-web/src/features/permissions`，建议同一工作树顺序完成，或先拆出共享 API/types 后再并行。

## Implementation Tasks

- [ ] **T1 (P1, human: ~2h / CC: ~25min)** — Admin navigation — 收敛权限管理二级导航并保持旧深链
  - Surfaced by: Architecture Review D1
  - Files: `apps/admin-web/src/routes/admin-routes.ts`、`apps/admin-web/src/App.tsx`、`apps/admin-web/src/routes/admin-url-state.test.ts`
  - Verify: `pnpm --filter @feishu-iam/admin-web test -- src/routes/admin-url-state.test.ts`

- [ ] **T2 (P1, human: ~3h / CC: ~40min)** — Role creation — 修复平台管理员未选应用时创建角色 disabled
  - Surfaced by: Code Quality Finding 2
  - Files: `PermissionManagementView.tsx`、`PermissionRoleCreateDialog.tsx`、`PermissionManagementView.test.tsx`
  - Verify: `pnpm --filter @feishu-iam/admin-web test -- src/features/permissions/PermissionManagementView.test.tsx`

- [ ] **T3 (P1, human: ~4h / CC: ~60min)** — Role application binding — 新增角色-应用绑定 active/disabled API 和审计
  - Surfaced by: Architecture Review D2
  - Files: `IamRoleService`、`AdminPermissionController`、`apps/admin-web/src/api/permission.ts`、对应测试
  - Verify: `pnpm --filter @feishu-iam/api test -- test/admin-role-application-binding.e2e-spec.ts && pnpm --filter @feishu-iam/admin-web test -- src/api/permission.test.ts`

- [ ] **T4 (P1, human: ~5h / CC: ~75min)** — Role workbench UI — 精简角色工作台并实现管理角色关联应用 Dialog
  - Surfaced by: Code Quality Finding 1
  - Files: `PermissionRoleDetailSheet.tsx`、新增 Dialog、`PermissionRoleDetailSheet.test.tsx`
  - Verify: `pnpm --filter @feishu-iam/admin-web test -- src/features/permissions/PermissionRoleDetailSheet.test.tsx`

- [ ] **T5 (P1, human: ~5h / CC: ~75min)** — Permission matrix API — 新增只读矩阵查询服务和来源解释字段
  - Surfaced by: Architecture Review D3 and Code Quality Finding 3
  - Files: `apps/api/src/admin/*`、`apps/api/test/admin-permission-matrix.e2e-spec.ts`
  - Verify: `pnpm --filter @feishu-iam/api test -- test/admin-permission-matrix.e2e-spec.ts`

- [ ] **T6 (P1, human: ~5h / CC: ~75min)** — Permission matrix UI — 实现矩阵查询页、状态和 390px 形态
  - Surfaced by: Test Review coverage gaps
  - Files: `apps/admin-web/src/features/permissions/PermissionMatrixView.tsx`、`apps/admin-web/src/api/permission.ts`、`PermissionMatrixView.test.tsx`
  - Verify: `pnpm --filter @feishu-iam/admin-web test -- src/features/permissions/PermissionMatrixView.test.tsx`

- [ ] **T7 (P1, human: ~3h / CC: ~45min)** — Verification — 跑完整测试、构建和 Browser 自检
  - Surfaced by: Test Review and DESIGN.md Browser 自检硬约束
  - Files: QA 记录或截图目录
  - Verify: `pnpm check && pnpm build`，Browser 覆盖 1440px / 768px / 390px 关键路径

## Completion Summary

- Step 0 Scope Challenge：范围接受为一个版本，复杂度通过“1 个矩阵服务 + 1 个矩阵页 + 1 个应用绑定 Dialog”收敛。
- Architecture Review：3 个决策门禁，均有推荐方案，无需停等用户决策。
- Code Quality Review：3 个 P1 实施风险，已转为 T2/T4/T5。
- Test Review：覆盖图已产出，24 个新路径待 Step 7 写新鲜测试。
- Performance Review：3 个风险，核心要求是矩阵服务端聚合，避免前端 N+1。
- NOT in scope：已写。
- What already exists：已写。
- TODOS.md updates：0 项，仓库无 `TODOS.md`。
- Failure modes：8 个，0 个 critical gap。
- Outside voice：未运行，用户未要求外部模型评审。
- Parallelization：3 条后端/路由前置 lane，前端 UI 建议顺序合并。
- Lake Score：7/7 推荐采用完整但不扩权模型的方案。
