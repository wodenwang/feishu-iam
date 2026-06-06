# Feishu IAM v0.10.1-S2 权限管理页面迁移实施计划

日期：2026-05-25
状态：PLANNED
范围：只覆盖 `权限管理` 页面前端迁移，不实现代码。

## 1. 目标和边界

`v0.10.1-S2` 的目标是把 `权限管理` 从旧 `App.css` / 旧弹窗 / 常驻详情抽屉迁移到 S1 已完成的后台基础组件体系：

- `AppShell`
- `PageHeader`
- `DetailSheet`
- `DataTable`
- `StatusBadge`
- 以及已存在的 `FilterBar`、`FormDialog`、`ConfirmDialog`、`PageState`、`Button`、`Input`、`Textarea`

本切片不做：

- 不新增后端权限模型。
- 不修改 `apps/api/src/permission/*` 的业务规则。
- 不把权限组、权限点做成后台常驻 CRUD 主页面。
- 不做权限点直接绑定 UI。
- 不改应用管理、管理员授权、记录查询、系统设置页面。
- 不扩展 OIDC、ABAC、资源级权限、飞书角色同步或飞书用户组同步。

## 2. 当前事实

### 已可复用的 S1 基础

- `apps/admin-web/src/components/admin/AppShell.tsx`
  - 已支持桌面菜单展开/收缩、localStorage 持久化、独立滚动容器、移动端导航 Sheet。
- `apps/admin-web/src/components/admin/PageHeader.tsx`
  - 已支持 `breadcrumbs`、`primaryAction`、`secondaryActions`、`badges`。
- `apps/admin-web/src/components/admin/DetailSheet.tsx`
  - 已支持 `normal` / `wide` / `full` 三档宽度、宽度按钮、localStorage、Esc 关闭。
- `apps/admin-web/src/components/admin/DataTable.tsx`
  - 已支持 `width`、`minWidth`、`nowrap`、loading、empty、error、forbidden。
- `apps/admin-web/src/components/admin/StatusBadge.tsx`
  - 已支持 `success` / `warning` / `danger` / `muted`，默认 `whitespace-nowrap`。

### 当前权限管理旧实现

- 页面文件：`apps/admin-web/src/routes/PermissionManagementPage.tsx`
- 主要旧结构：
  - `admin-page`
  - `panel`
  - `permission-management-layout`
  - `role-list-panel`
  - `application-detail-drawer`
  - `dialog-backdrop`
  - `management-dialog`
  - `status-badge-*`
- 已有 API 能力：
  - `fetchApplications`
  - `fetchPermissionGroups`
  - `fetchIamRoles`
  - `createIamRole`
  - `updateIamRole`
  - `enableIamRole`
  - `disableIamRole`
  - `replaceIamRolePermissionGroups`
  - `replaceIamRoleSubjects`
  - `searchApplicationFeishuUsers`
  - `searchApplicationFeishuDepartments`

结论：S2 应做前端结构迁移和状态补齐，不碰后端。

## 3. 前提判断

1. 权限管理仍按角色中心建模：`应用 -> IAM 角色 -> 权限组绑定 -> 用户/部门绑定`。
2. 权限组和权限点由应用开发者 API 维护，后台 UI 只在绑定权限组时读取并勾选权限组。
3. 默认入口必须是清单，不是常驻详情区；详情只通过 `DetailSheet` 打开。
4. URL query 只保存可分享、可恢复的列表和当前打开对象，不保存表单草稿、搜索候选结果或敏感值。
5. S2 的验收标准应比旧页面更严格：URL 深链、关闭保留筛选、无权限状态、响应式、Browser 自检都要覆盖。

## 4. 方案取舍

### 方案 A：单页 feature 迁移，复用现有 API

把旧 `PermissionManagementPage` 拆到 `features/permissions`，保持 API 不变，补 URL query、DataTable、DetailSheet、FormDialog 和 focused tests。

- Effort：M
- Risk：Low
- Pros：
  - 文件边界清晰，风险集中在一个页面。
  - 不引入后端分页或新接口，避免把 UI 修复扩大成模型变更。
  - 能直接复用 S1 的组件和应用管理页面的 URL state 模式。
- Cons：
  - 角色列表分页只能先做前端分页，因为当前 `fetchIamRoles` 返回全量数组。
  - 绑定成员的搜索、候选和已选状态仍需要在前端仔细管理。

### 方案 B：先抽通用资源页模式，再迁移权限管理

先抽 `ResourcePage` / `PaginationBar` / `ResourceToolbar` 等通用抽象，再把权限管理接入。

- Effort：L
- Risk：Med
- Pros：
  - 后续管理员授权、系统设置迁移可复用更多结构。
  - 表格、分页、筛选和详情代码更统一。
- Cons：
  - S2 只覆盖权限管理，先抽大抽象容易扩大影响面。
  - 当前应用管理和记录查询已可用，抽象可能造成无关页面回归。

### 方案 C：保留旧页面逻辑，只局部替换视觉组件

不拆 feature，只在原文件中替换表格、弹窗和抽屉样式。

- Effort：S
- Risk：High
- Pros：
  - 最少文件变动，最快看到视觉变化。
  - 可以短时间消除部分旧 CSS 痕迹。
- Cons：
  - 无法彻底解决旧常驻详情、URL query 和状态管理问题。
  - 仍会留下难维护的大文件和旧交互结构。

推荐方案：A。它能在不扩大后端和共享抽象范围的情况下，把权限管理页面真正迁移到 S1 基础组件体系。

## 5. 文件边界

### 新增文件

```text
apps/admin-web/src/features/permissions/PermissionManagementView.tsx
apps/admin-web/src/features/permissions/PermissionRoleCreateDialog.tsx
apps/admin-web/src/features/permissions/PermissionRoleDetailSheet.tsx
apps/admin-web/src/features/permissions/PermissionGroupBindingDialog.tsx
apps/admin-web/src/features/permissions/PermissionSubjectBindingDialog.tsx
apps/admin-web/src/features/permissions/permission-columns.tsx
apps/admin-web/src/features/permissions/permission-form.ts
apps/admin-web/src/features/permissions/PermissionManagementView.test.tsx
```

### 修改文件

```text
apps/admin-web/src/routes/PermissionManagementPage.tsx
apps/admin-web/src/routes/admin-url-state.ts
apps/admin-web/src/routes/admin-url-state.test.ts
apps/admin-web/src/components/admin/admin-components.test.tsx
apps/admin-web/src/App.tsx
```

说明：

- `PermissionManagementPage.tsx` 只保留路由包装，类似 `ApplicationManagementPage.tsx` 和 `RecordQueryPage.tsx`。
- `admin-url-state.ts` 增加权限管理 URL query 解析和序列化。
- `App.tsx` 只调整从应用管理跳转权限管理时的传参方式：优先改为 query，而不是仅靠 React state。
- `admin-components.test.tsx` 只有在发现现有 S1 组件 API 缺口时才补测试，不主动扩组件 API。

### 明确不改

```text
apps/api/src/permission/*
apps/api/src/admin/admin-permission.controller.ts
apps/admin-web/src/features/applications/*
apps/admin-web/src/features/records/*
```

## 6. 组件 API 使用

### PageHeader

使用方式：

```tsx
<PageHeader
  breadcrumbs={[
    { label: "后台", href: "/admin/workspace" },
    { label: "权限管理", current: true },
  ]}
  title="权限管理"
  description="按应用管理 IAM 角色、权限组绑定和飞书用户/部门成员绑定。"
  primaryAction={<Button>创建角色</Button>}
/>
```

要求：

- `primaryAction` 只在已选择应用且当前管理员有应用管理权限时可用。
- 页面标题不放筛选控件；筛选统一进入 `FilterBar`。

### FilterBar

筛选字段：

- 应用：`appKey`
- 角色查询：`q`
- 状态：`status`

行为：

- 查询提交后 `page` 重置为 `1`。
- 重置后保留默认应用选择，但清空 `q`、`status`、`sheet`。
- 应用切换后关闭当前 Sheet，并重新加载对应应用角色和权限组。

### DataTable

使用要求：

- `loading`：角色列表读取中。
- `emptyText`：当前应用暂无 IAM 角色。
- `error`：角色或应用读取失败。
- `forbidden`：接口返回 403 时显示无权限状态，不误判为空列表。
- 状态列、时间列、操作列必须使用稳定宽度和 `nowrap`。

### StatusBadge

映射：

- `active` -> `tone="success"`，显示 `启用`
- `disabled` -> `tone="muted"`，显示 `停用`
- orphaned 主体 -> `tone="warning"`，显示 `orphaned`

### DetailSheet

角色详情使用：

```tsx
<DetailSheet
  open={Boolean(selectedRole)}
  title="角色详情"
  description={...}
  defaultSize="normal"
  sizeStorageKey="feishu-iam:permissions-role-detail-sheet-size"
  onOpenChange={...}
>
  ...
</DetailSheet>
```

要求：

- 详情默认 `normal`。
- 权限组和成员区域较长时允许用户切到 `wide` / `full`。
- 关闭后只删除 `sheet` query，保留 `appKey`、`q`、`status`、`page`、`pageSize`、`sort`。
- Sheet 内宽度切换不得导致编辑草稿丢失。

### FormDialog

用于：

- 创建角色。
- 绑定权限组。
- 绑定成员。

原因：

- 创建角色和绑定流程都是短事务，不需要独立路由页。
- 表单草稿和候选搜索结果不进入 URL，避免复制链接时带入临时状态。

### ConfirmDialog

用于：

- 启用角色。
- 停用角色。

要求：

- 停用使用 `danger`。
- 文案必须说明停用后该角色不再参与权限计算。
- 文案必须说明操作会写入审计日志，可在记录查询追溯。

## 7. 页面结构

```text
PermissionManagementView
  PageHeader
  section p-6
    form
      FilterBar
        应用选择
        角色查询
        状态选择
        查询 / 重置
      DataTable(角色清单)
      PaginationBar(本页本地组件)
  PermissionRoleCreateDialog
  PermissionRoleDetailSheet
    基础信息
    编辑角色
    已绑定权限组
    已绑定成员
    状态与审计提示
  PermissionGroupBindingDialog
  PermissionSubjectBindingDialog
  ConfirmDialog(启用/停用)
```

首屏只展示筛选、表格、分页和创建入口。不要恢复旧版宽屏左侧应用卡片选择器，也不要在右侧常驻角色详情。

## 8. 表格列

角色表格列：

| key | 表头 | 宽度策略 | 内容 | 说明 |
|---|---|---|---|---|
| `role` | 角色 | `minWidth: 220px` | 角色名称 + 描述 | 描述可换行，不撑破表格 |
| `key` | 角色 key | `minWidth: 180px` | `code` + `break-all` | 支持长 key |
| `status` | 状态 | `width: 96px`, `nowrap` | `StatusBadge` | 短中文不换行 |
| `permissionGroups` | 权限组 | `width: 120px`, `nowrap` | 数量 + 可选警告 | 只显示数量，不展示常驻目录 |
| `subjects` | 成员 | `width: 120px`, `nowrap` | 用户/部门总数 | orphaned 可在详情展示 |
| `updatedAt` | 更新时间 | `minWidth: 160px`, `nowrap` | 本地格式化时间 | 与记录查询一致 |
| `actions` | 操作 | `width: 112px`, `nowrap` | `详情` 按钮 | 打开 `sheet=role:<roleId>` |

默认排序：

- 由于当前后端按 `key asc` 返回，前端默认 `sort=key:asc`。
- 可选排序只在前端实现：`key:asc`、`updatedAt:desc`、`updatedAt:asc`。
- S2 不新增后端排序参数。

## 9. 筛选项

| 字段 | query | 默认值 | UI | 行为 |
|---|---|---|---|---|
| 应用 | `appKey` | `initialAppKey` 或第一条应用 | `select` | 切换应用后加载权限组和角色 |
| 角色查询 | `q` | 空 | `Input` | 匹配角色名称、角色 key、描述 |
| 状态 | `status` | `all` | `select` | `all` / `active` / `disabled` |
| 页码 | `page` | `1` | PaginationBar | 前端分页 |
| 每页条数 | `pageSize` | `20` | `select` | 10 / 20 / 50 |
| 排序 | `sort` | `key:asc` | 后续可放到 select | S2 可先隐藏，仅 query 支持 |

筛选实现方式：

- 应用列表仍通过 `fetchApplications()` 读取。
- 角色、权限组通过当前应用调用 `fetchIamRoles(appKey)` 和 `fetchPermissionGroups(appKey)`。
- `q`、`status`、`sort`、`page`、`pageSize` 在前端处理。
- 快速切换应用时继续保留 request sequence guard，旧请求不能覆盖新应用状态。

## 10. 详情 Sheet

打开条件：

- `sheet=role:<roleId>` 且当前应用角色列表中存在该角色。

Sheet 标题：

- 标题：`角色详情`
- 描述：`{应用名称} · {role.key}` + 状态 Badge

内容结构：

1. 基础信息
   - 应用名称
   - `app_key`
   - 角色 key
   - 状态
   - 创建时间
   - 更新时间
2. 编辑角色
   - 角色名称
   - 描述
   - 保存按钮
   - 字段级错误
3. 已绑定权限组
   - 权限组名称
   - 权限组 key
   - 状态
   - 绑定数量
   - `绑定权限组` 按钮
4. 已绑定成员
   - 类型：飞书用户 / 飞书部门
   - 主体 ID
   - orphaned 状态
   - `绑定成员` 按钮
5. 状态与审计
   - 启用 / 停用按钮
   - 审计提示
   - 错误提示

状态要求：

- 当前角色不存在：显示 `PageState` 式说明，提示返回列表。
- 当前角色绑定详情缺失：禁用全量替换按钮，提示刷新。
- 无权限：显示稳定中文说明，不展示堆栈或原始错误。

## 11. 创建和编辑角色

### 创建角色

入口：

- `PageHeader.primaryAction`
- URL：`sheet=create`

组件：

- `PermissionRoleCreateDialog`
- 使用 `FormDialog`

字段：

- 角色 key：必填，校验 `^[a-z0-9][a-z0-9._-]{0,127}$`
- 角色名称：必填
- 描述：可选

行为：

- 提交调用 `createIamRole(appKey, input)`。
- 成功后刷新当前应用角色列表。
- 成功后关闭创建弹窗并打开新角色详情：`sheet=role:<createdRole.id>`。
- 创建过程中的 `client_secret` / token 类字段不存在，不得向 URL 写入任何表单草稿。

### 编辑角色

入口：

- `PermissionRoleDetailSheet` 的编辑区域。

字段：

- 角色名称：必填。
- 描述：可选，空字符串提交为 `null`。
- 角色 key 不可编辑，只读展示。

行为：

- 提交调用 `updateIamRole(appKey, roleId, input)`。
- 成功后刷新角色列表，保留当前详情 Sheet。
- 提交中禁用保存按钮。
- 错误贴近表单区展示。

## 12. 绑定权限组

入口：

- 角色详情 Sheet 内 `绑定权限组`。

组件：

- `PermissionGroupBindingDialog`
- 使用 `FormDialog`

数据：

- 可绑定权限组来自 `fetchPermissionGroups(appKey)`。
- 当前绑定来自 `role.permissionGroupIds` 或 `role.permissionGroups`。

UI：

- 搜索框：按权限组名称和 key 过滤。
- 勾选列表：展示名称、key、状态。
- 已停用权限组可展示但默认不隐藏；状态用 `StatusBadge`。
- 不显示权限点常驻目录，不做权限点 CRUD。

行为：

- 保存调用 `replaceIamRolePermissionGroups(appKey, roleId, selectedIds)`。
- 保存成功后刷新角色列表并关闭弹窗。
- 保存失败保留勾选草稿。
- 无权限组时显示空状态：“当前应用暂无可绑定权限组，请使用应用开发者 API 维护权限组。”

差异提示：

- 展示“新增 N 个，移除 M 个”，但不需要复杂 diff 表。
- 提交按钮文案：`保存权限组绑定`。

## 13. 绑定成员

入口：

- 角色详情 Sheet 内 `绑定成员`。

组件：

- `PermissionSubjectBindingDialog`
- 使用 `FormDialog`

数据：

- 当前成员来自 `role.subjects`。
- 搜索用户调用 `searchApplicationFeishuUsers(appKey, keyword)`。
- 搜索部门调用 `searchApplicationFeishuDepartments(appKey, keyword)`。

UI：

- 两个搜索区：
  - 飞书用户：关键词输入 + 搜索按钮 + 候选列表。
  - 飞书部门：关键词输入 + 搜索按钮 + 候选列表。
- 已选成员列表：
  - 类型
  - 主体 ID
  - 名称或候选显示名
  - orphaned 标记
  - 移除按钮
- 允许手动输入 `user_id` / `department_id`，但必须去重。

行为：

- 保存调用 `replaceIamRoleSubjects(appKey, roleId, subjects)`。
- 保存成功后刷新角色列表并关闭弹窗。
- 搜索失败只影响候选区，不清空已选成员。
- 重复成员不允许加入，并给出字段附近提示。

约束：

- 不做“按人直接分配权限点”。
- 不同步或引用飞书角色/飞书用户组。
- 成员仍只支持 `feishu_user` 和 `feishu_department`。

## 14. URL query 设计

新增类型：

```ts
export type PermissionSheet = "create" | `role:${string}`;
export type PermissionSort = "key:asc" | "updatedAt:desc" | "updatedAt:asc";

export type PermissionSearchState = {
  appKey?: string;
  q?: string;
  status: "all" | "active" | "disabled";
  page: number;
  pageSize: number;
  sort: PermissionSort;
  sheet?: PermissionSheet;
};
```

新增函数：

```ts
parsePermissionSearch(params: URLSearchParams): PermissionSearchState
serializePermissionSearch(state: PermissionSearchState): URLSearchParams
```

序列化规则：

- 默认值不写入 URL。
- 只识别 `sheet=create` 和 `sheet=role:<id>`。
- 非法 `status`、`page`、`pageSize`、`sort` 回退默认值。
- 关闭 Sheet 使用现有 `closeSheet(params)`，只删除 `sheet`。

URL 示例：

```text
/admin/permissions?appKey=crm
/admin/permissions?appKey=crm&q=admin&status=active&page=2&pageSize=10
/admin/permissions?appKey=crm&sheet=create
/admin/permissions?appKey=crm&sheet=role%3Arole-uuid
```

从应用管理跳转：

- 当前 `onManagePermissions(appKey)` 不应只写 React state。
- S2 改为导航到 `/admin/permissions?appKey=<appKey>`。
- 如果后续有角色 id，可导航到 `/admin/permissions?appKey=<appKey>&sheet=role:<roleId>`。

不进入 URL：

- 创建/编辑表单草稿。
- 权限组搜索关键词和勾选草稿。
- 成员搜索关键词、候选列表和已选草稿。
- 任何 secret、token、cookie、密码。

## 15. 状态矩阵

| 区域 | Loading | Empty | Error | No permission | Validation | Partial |
|---|---|---|---|---|---|---|
| 应用选择 | 显示正在读取应用 | 暂无应用，提示先创建应用 | 应用列表读取失败 | 403 显示无权限 | 不适用 | 读取应用成功但角色失败时保留应用选择 |
| 角色表格 | `DataTable.loading` | 当前应用暂无 IAM 角色 | 角色读取失败 | 403 显示无权限 | 不适用 | 权限组读取失败时禁用绑定入口 |
| 角色详情 | Sheet 内 skeleton 或加载提示 | 角色不存在，提示返回列表 | 详情数据不可用 | 无详情权限稳定说明 | 编辑字段贴近字段展示 | 绑定详情缺失时禁用全量替换 |
| 创建角色 | 提交中禁用按钮 | 不适用 | 提交失败保留草稿 | 无应用权限禁用入口 | key/name 字段错误 | 创建成功刷新失败时提示手动刷新 |
| 绑定权限组 | 保存中禁用按钮 | 当前应用暂无权限组 | 保存失败保留草稿 | 无权限禁用保存 | 重复或非法数据不应出现 | 权限组列表为空但角色详情仍可看 |
| 绑定成员 | 搜索中只禁用对应搜索按钮 | 无候选，允许手动输入 | 搜索失败不清空已选 | 无权限禁用保存 | 重复成员贴近成员区提示 | 用户搜索失败不影响部门搜索 |
| 启停角色 | 确认中禁用按钮 | 不适用 | 失败停留确认框 | 无权限显示错误 | 不适用 | 状态更新成功但刷新失败时保留当前行提示 |

## 16. 测试计划

### 单元和组件测试

新增：

```text
apps/admin-web/src/features/permissions/PermissionManagementView.test.tsx
```

覆盖用例：

1. 通过 URL `appKey=crm&sheet=role:<id>` 打开角色详情 Sheet。
2. 关闭详情后保留 `appKey`、`q`、`status`、`page`、`pageSize`、`sort`。
3. 创建角色成功后刷新列表并打开新角色详情。
4. 角色 key/name 校验错误贴近字段展示。
5. 编辑角色成功后保留当前详情 Sheet。
6. 绑定权限组时可搜索、勾选、保存，失败保留草稿。
7. 绑定成员时可搜索用户/部门、去重、移除、保存。
8. 启用/停用角色必须经过 ConfirmDialog，停用使用危险态。
9. 403 角色列表响应显示无权限状态，不显示空状态。
10. 状态、时间、操作列宽度稳定，状态 Badge 不换行。
11. `sheet=create` 不把表单草稿写入 URL。

扩展：

```text
apps/admin-web/src/routes/admin-url-state.test.ts
```

覆盖：

- `parsePermissionSearch` 默认值。
- 非法 query 归一化。
- `sheet=create` / `sheet=role:<id>`。
- `serializePermissionSearch` 不输出默认值。
- 不序列化未知字段、secret、token。

如发现 S1 组件缺口，再扩：

```text
apps/admin-web/src/components/admin/admin-components.test.tsx
```

但 S2 不应主动修改 S1 API。

### 命令

实现完成后至少运行：

```bash
pnpm --filter @feishu-iam/admin-web exec vitest run src/routes/admin-url-state.test.ts src/features/permissions/PermissionManagementView.test.tsx
pnpm --filter @feishu-iam/admin-web typecheck
pnpm --filter @feishu-iam/admin-web lint
pnpm --filter @feishu-iam/admin-web test
pnpm --filter @feishu-iam/admin-web build
pnpm --filter @feishu-iam/admin-web test:responsive
pnpm check
```

如果 `pnpm check` 因本地环境变量或 Prisma client 缺失失败，必须记录失败原因、补必要的非敏感本地配置或执行 `prisma:generate` 后复跑。

## 17. Browser 自检计划

实现完成后必须用 Browser 打开本地页面自检，默认入口：

```text
http://localhost:3000/admin/permissions
```

如本地 Compose 未启动，先运行：

```bash
pnpm compose:up
curl -fsS http://localhost:3000/ready
```

如果缺少本地 `.env` 导致 Compose 不可用，允许使用 Vite + API mock 或已可用的本地服务，但最终回复必须说明不是完整后端链路。

Browser 自检覆盖：

1. 桌面 1440px：
   - 页面使用固定 AppShell。
   - 权限管理首屏无旧居中布局。
   - 默认只显示筛选、表格、分页、创建按钮。
   - 不出现旧常驻 `application-detail-drawer`。
2. 桌面 1280px：
   - 表格列宽稳定。
   - 状态、更新时间、操作列不换行。
3. 窄屏 768px：
   - 菜单和表格可用。
   - 详情 Sheet 默认接近全宽，宽度切换按钮可达。
4. 移动 390px：
   - 页面无整体横向溢出。
   - 表格在容器内横向滚动或保持可操作。
   - 按钮触控目标不小于 44px。
5. 交互：
   - 应用筛选。
   - 查询、重置、分页。
   - 创建角色。
   - 打开/关闭角色详情。
   - 编辑角色。
   - 绑定权限组。
   - 绑定成员。
   - 启用/停用确认。
6. URL：
   - 复制带 `appKey` 和 `sheet=role:<id>` 的链接可恢复当前详情。
   - 关闭 Sheet 后筛选和分页保留。
   - 表单草稿、搜索候选、secret/token 不进入 URL。
7. Console 和 Network：
   - console 无非预期错误。
   - Network 无非预期 4xx/5xx。
   - 预期 401/403 必须在页面上显示稳定中文状态。

## 18. 完成标准

S2 完成必须同时满足：

- `PermissionManagementPage.tsx` 已变成薄路由包装。
- 权限管理主要实现位于 `features/permissions/*`。
- 页面不再依赖旧 `admin-page`、`panel`、`application-detail-drawer`、`management-dialog`、`status-badge-*` 作为主视觉结构。
- 权限管理使用 `PageHeader`、`FilterBar`、`DataTable`、`DetailSheet`、`StatusBadge`、`FormDialog`、`ConfirmDialog`。
- 角色表格列、筛选项、分页、详情 Sheet、创建角色、编辑角色、绑定权限组、绑定成员、启停角色全部可用。
- URL query 支持 `appKey`、`q`、`status`、`page`、`pageSize`、`sort`、`sheet`。
- 关闭详情后保留列表上下文。
- 403、空状态、加载、错误、校验错误、保存失败都有稳定中文 UI。
- 不新增明文 secret、token、cookie、密码。
- 不把权限组/权限点 CRUD 做成后台主流程。
- Focused tests、admin-web typecheck/lint/test/build、responsive check 和 `pnpm check` 完成并记录结果。
- Browser 自检覆盖 `http://localhost:3000/admin/permissions` 的桌面、窄屏、移动和核心 CRUD 交互。

## 19. 实施顺序

1. 扩展 `admin-url-state.ts` 和测试，先锁住 query 契约。
2. 新建 `features/permissions/permission-form.ts`，提取角色 key/name/description 校验。
3. 新建 `permission-columns.tsx`，定义 DataTable 列和格式化函数。
4. 新建 `PermissionManagementView.tsx`，先完成应用筛选、角色表格、分页、URL state。
5. 新建 `PermissionRoleCreateDialog.tsx`，接入创建角色和创建后打开详情。
6. 新建 `PermissionRoleDetailSheet.tsx`，接入编辑角色、绑定摘要、启停入口。
7. 新建 `PermissionGroupBindingDialog.tsx`，接入权限组搜索、勾选和保存。
8. 新建 `PermissionSubjectBindingDialog.tsx`，接入用户/部门搜索、去重和保存。
9. 把 `routes/PermissionManagementPage.tsx` 改为薄包装。
10. 修改 `App.tsx` 中应用管理跳转权限管理的方式，改为 query。
11. 跑 focused tests，再跑 admin-web 全量，再跑 `pnpm check`。
12. 启动本地页面，完成 Browser 自检并记录结果。

## 20. 剩余风险

- 当前角色 API 返回全量列表，S2 前端分页能满足 UI 收口，但大数据量下仍不是最终方案；如角色数量显著增长，后续版本应补后端分页。
- 绑定成员搜索依赖飞书镜像数据质量；如果镜像字段不完整，候选显示名可能为空，需要保持可通过 `user_id` / `department_id` 手动绑定。
- 绑定权限组是全量替换操作，UI 必须明确保存影响，并在失败时保留草稿，避免误删绑定。
- 应用管理员的应用范围权限由后端决定；前端只能根据 403 展示无权限状态，不能做越权假过滤。
