# Feishu IAM v0.10.4 GitLab issue 修复计划

日期：2026-05-26
状态：PLANNED
范围：仅修复 GitLab issue，不新增业务功能。

## 1. 版本定位

`v0.10.4` 是 `v0.10.3` 之后的管理后台 UI bugfix 小版本，只处理当前 GitLab open bug：

- `#4 权限管理：操作按钮样式错误且换行展示`

本版本不新增后端权限模型、数据库 DDL、SSO 协议、部署拓扑、完整 OIDC、refresh token、资源级权限、ABAC、飞书角色同步或飞书用户组同步。

## 2. 当前问题

Issue `#4` 指向线上管理后台：

```text
/admin/permissions?appKey=ssoaccept223013
```

现象：

- 权限管理模块 IAM 角色清单的操作列按钮样式不一致。
- `详情 / 编辑 / 权限组 / 成员` 使用文字按钮。
- `停用` 是单独红色按钮，并且在常见桌面宽度下换到下一行。
- 操作列会让表格行异常增高，视觉上与后台表格操作区不一致。

根因判断：

- 当前 `apps/admin-web/src/features/permissions/permission-columns.tsx` 中，操作列宽度为 `280px`，按钮容器使用 `flex flex-wrap items-center gap-2`。
- 五个文字按钮总宽度超过操作列可用宽度时会自动换行。
- `停用` 使用 `destructive` 文字按钮，比 icon button 占用更大宽度。
- `v0.10.3` 已在管理员授权模块中落地稳定的 icon button 操作列，可作为参照。

## 3. 前提判断

1. `v0.10.4` 只修复 GitLab issue `#4`，不顺手处理未登记的新 UI 改造。
2. 权限管理仍保持现有主路径：应用选择、IAM 角色清单、角色详情 Sheet、编辑角色、绑定权限组、绑定成员、启停角色。
3. 修复应优先复用管理员授权模块已经通过验证的操作列模式，而不是重新设计表格操作体系。
4. 危险操作仍需要清晰可识别，但不应通过换行的大红文字按钮破坏行高。
5. 修复完成后必须通过本地测试、构建和 Browser 自检，再进入发布收口。

## 4. 方案取舍

### 方案 A：最小修复，权限管理操作列改为 icon button 组

把 IAM 角色清单操作列改成与管理员授权模块一致的紧凑 icon button 组，保留现有操作顺序和事件流。

- Effort：S
- Risk：Low
- Pros：
  - 文件边界最小，主要集中在 `permission-columns.tsx` 和对应测试。
  - 直接复用 `AdminAuthorizationView` 已验证的视觉和交互模式。
  - 不改变权限管理数据流、URL state、弹窗或详情 Sheet。
- Cons：
  - 仍保留一行内多个高频操作，只是通过 icon 和 tooltip 降低宽度压力。
  - 如果后续操作继续增加，仍可能需要进一步收敛为更多菜单。
- Reuses：
  - `apps/admin-web/src/features/admin-users/admin-user-columns.tsx`
  - `apps/admin-web/src/components/ui/button.tsx`
  - `lucide-react` icon button 模式

### 方案 B：抽取共享 RowActionButtons 组件

把管理员授权和权限管理的操作列按钮抽成共享组件，再由两个模块传入 action 配置。

- Effort：M
- Risk：Med
- Pros：
  - 后续多个资源表格可复用一致的操作列结构。
  - 可以集中处理按钮尺寸、tooltip、危险操作和可访问性。
  - 能减少管理员授权与权限管理之间的重复实现。
- Cons：
  - 本版本只修复一个 GitLab issue，抽象会扩大影响面。
  - 管理员授权和权限管理的操作数量、只读态和危险态不完全一致，过早抽象容易产生不自然 API。
- Reuses：
  - `DataTableColumn` 操作列配置
  - `Button size="icon"` 模式

### 方案 C：保留文字主操作，把次要操作收进 DropdownMenu

操作列保留 `详情` 作为文字按钮，其余 `编辑 / 权限组 / 成员 / 停用` 收进更多菜单。

- Effort：M
- Risk：Med
- Pros：
  - 操作列宽度最稳定，后续新增操作也不容易撑破表格。
  - 危险操作可以在菜单中单独标红并保持确认流程。
  - 行内视觉更克制。
- Cons：
  - GitLab issue 明确要求参考管理员授权模块，菜单方案会偏离当前参照。
  - 权限管理的 `编辑 / 权限组 / 成员` 是高频操作，收进菜单会增加一次点击。
- Reuses：
  - `apps/admin-web/src/components/ui/dropdown-menu.tsx`
  - `v0.10.3` 顶部用户菜单的 Radix portal 层级经验

推荐方案：A。它最贴合 “仅修复 GitLab issue” 的边界，能用最小 diff 消除换行和样式不一致，同时不改变权限管理已有功能流。

## 5. 实施范围

### 修改文件

```text
apps/admin-web/src/features/permissions/permission-columns.tsx
apps/admin-web/src/features/permissions/PermissionManagementView.test.tsx
```

可选修改：

```text
apps/admin-web/src/components/admin/admin-components.test.tsx
```

只有在发现 `DataTable` 对稳定操作列还缺少可测试约束时，才补充组件级测试。

### 明确不改

```text
apps/api/src/**
apps/admin-web/src/api/**
apps/admin-web/src/routes/admin-url-state.ts
apps/admin-web/src/features/permissions/PermissionManagementView.tsx
apps/admin-web/src/features/permissions/PermissionRoleDetailSheet.tsx
apps/admin-web/src/features/admin-users/**
```

除非实现过程中发现 issue #4 的根因不在操作列，否则不扩大到这些文件。

## 6. 实施要点

1. 在 `permission-columns.tsx` 引入合适的 lucide icons：
   - `Eye`：详情。
   - `Pencil`：编辑。
   - `ShieldCheck` 或 `Layers`：权限组。
   - `Users`：成员。
   - `PowerOff` / `Power`：停用 / 启用。
2. 操作列宽度从 `280px` 收敛到稳定紧凑宽度，建议 `216px` 左右，具体以五个 `h-8 w-8` icon button 加间距为准。
3. 操作容器改为：

```tsx
<div className="flex w-full items-center justify-end gap-1.5">
```

4. 所有操作按钮使用：
   - `size="icon"`
   - `className="h-8 w-8 min-h-8 p-0"`
   - `title`
   - `aria-label`
   - `sr-only` 文案
5. `详情` 保留 `variant="outline"`，次要操作使用 `variant="ghost"`，启用使用 `secondary`，停用使用 `destructive`。
6. 不使用 `flex-wrap`，让操作列在桌面宽度下保持单行。
7. 保持现有 `onAction` 类型和事件语义不变。

## 7. 测试计划

本地自动化验证：

```bash
pnpm --filter @feishu-iam/admin-web exec vitest run src/features/permissions/PermissionManagementView.test.tsx
pnpm --filter @feishu-iam/admin-web exec vitest run src/features/admin-users/AdminAuthorizationView.test.tsx src/components/admin/admin-components.test.tsx
pnpm check
pnpm --filter @feishu-iam/admin-web build
```

Browser 自检：

1. 启动本地管理后台。
2. 打开：

```text
http://localhost:3000/admin/permissions?appKey=ssoaccept223013
```

如果本地数据没有该应用，则使用现有 mock 或本地已有应用进入权限管理角色清单。

3. 检查：
   - IAM 角色清单操作列所有按钮保持单行。
   - 操作列不撑破表格，不导致行高异常增大。
   - `详情 / 编辑 / 权限组 / 成员 / 停用或启用` 均可点击并打开对应 Sheet、Dialog 或确认框。
   - 常见桌面宽度和窄屏下表格仍可横向滚动或保持可操作。
   - 浏览器 console 无非预期错误；未登录或权限不足产生的预期 401 / 403 不计为本 issue 失败。

## 8. 发布边界

`v0.10.4` 收口时需要：

1. 更新版本号到 `0.10.4`。
2. 更新 `CHANGELOG.md` 和 `README.md` 版本历史。
3. 补充 Codex 会话归档。
4. 创建修复分支和 GitLab MR。
5. 合并后打 `v0.10.4` tag。
6. 如本版本进入部署发布，则构建并推送 `dockerhub.it.tangtring.com:80/ai/feishu-iam:v0.10.4` 多架构镜像，并完成远端停机升级验证。
7. 验收通过后关闭 GitLab issue `#4`。

## 9. 验收标准

- GitLab issue `#4` 中描述的权限管理操作列换行问题消失。
- 权限管理操作按钮样式与管理员授权模块保持一致或足够接近。
- 操作列宽度、按钮间距、危险操作样式稳定。
- 不引入权限管理功能回归：详情、编辑、权限组绑定、成员绑定、启停仍可用。
- 不改后端 API、数据库、部署拓扑或权限业务规则。
- 自动化检查和 Browser 自检均有记录。
