# Feishu IAM v0.14.2 Admin Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 发布 `v0.14.2`，收口 GitLab issue `#18/#22/#23`，提升后台信息密度和控件稳定性。

**Architecture:** 本版本只修改管理后台前端、设计规范和版本材料，不改变后端 API、Prisma、DDL、权限模型或 SSO 协议。应用详情继续复用 `ApplicationDetailSheet` 同时服务独立详情页和旧抽屉兼容入口；权限管理继续保留应用下拉筛选，移除重复快捷入口。

**Tech Stack:** React、Vite、TypeScript、shadcn/ui primitives、Tailwind、Vitest、Testing Library、Playwright responsive check。

---

## 文件结构

- Modify: `apps/admin-web/src/features/applications/ApplicationDetailSheet.tsx`
  - 稳定新增回调地址操作区。
  - 将 `RoleSection` 从卡片堆叠改为表格/高密度列表 CRUD。
- Modify: `apps/admin-web/src/features/applications/ApplicationManagementView.test.tsx`
  - 覆盖回调地址按钮稳定类名、角色列表表格、创建、编辑、启停和查看入口。
- Modify: `apps/admin-web/src/features/permissions/PermissionManagementView.tsx`
  - 移除应用快捷查询按钮区域。
- Modify: `apps/admin-web/src/features/permissions/PermissionManagementView.test.tsx`
  - 断言快捷查询区域消失，应用下拉筛选仍可用。
- Modify: `DESIGN.md`
  - 增补按钮文字、工具栏、表单操作区、表格操作列和响应式控件稳定性规则。
- Modify: `package.json`, `apps/api/package.json`, `apps/admin-web/package.json`, `deploy/*`, `README.md`, `CHANGELOG.md`, `AGENTS.md`
  - 发布切片更新版本号、部署默认值和文档索引。
- Create: `docs/codex-sessions/YYYY-MM-DD-HHMM-v0.14.2后台信息密度与控件稳定性.md`
  - 会话归档。

## Task 1: 应用详情回调地址操作区和角色列表 CRUD

**Files:**
- Modify: `apps/admin-web/src/features/applications/ApplicationDetailSheet.tsx`
- Test: `apps/admin-web/src/features/applications/ApplicationManagementView.test.tsx`

- [ ] **Step 1: 写回调地址操作区测试**

在 `creates and disables redirect uri from detail sheet` 用例中，输入回调地址后增加以下断言：

```ts
const redirectActionGroup = within(dialog)
  .getByRole("button", { name: "新增回调地址" })
  .closest("[data-ui='redirect-uri-action-group']");
expect(redirectActionGroup).toHaveClass("flex", "flex-col", "gap-2", "sm:flex-row");
expect(within(dialog).getByRole("button", { name: "新增回调地址" })).toHaveClass("whitespace-nowrap", "shrink-0");
```

- [ ] **Step 2: 写角色管理表格测试**

在 `creates and edits application role metadata without entering authorization binding` 用例中，切换到 `角色管理` Tab 后增加以下断言：

```ts
const roleTable = within(dialog).getByRole("table", { name: "应用角色清单" });
expect(within(roleTable).getByRole("columnheader", { name: "角色名称" })).toBeInTheDocument();
expect(within(roleTable).getByRole("columnheader", { name: "角色 key" })).toBeInTheDocument();
expect(within(roleTable).getByRole("columnheader", { name: "操作" })).toHaveStyle({
  width: "132px",
  minWidth: "132px",
});
expect(within(roleTable).getByRole("button", { name: "查看 crm.admin" })).toBeInTheDocument();
expect(within(roleTable).getByRole("button", { name: "编辑 crm.admin" })).toBeInTheDocument();
expect(within(roleTable).getByRole("button", { name: "停用 crm.admin" })).toBeInTheDocument();
expect(screen.queryByText("后续 v0.11.3")).not.toBeInTheDocument();
```

- [ ] **Step 3: 运行测试确认失败**

Run:

```bash
pnpm --filter @feishu-iam/admin-web test -- src/features/applications/ApplicationManagementView.test.tsx
```

Expected: FAIL，因为按钮 accessible name、`data-ui` 和角色表格尚未实现。

- [ ] **Step 4: 修改回调地址操作区**

在 `ApplicationDetailSheet.tsx` 中把新增回调地址区域改成：

```tsx
<div
  className="flex flex-col gap-2 sm:flex-row sm:items-center"
  data-ui="redirect-uri-action-group"
>
  <Input
    aria-label="新增 Redirect URI"
    className="min-w-0 flex-1"
    placeholder="https://example.com/auth/callback"
    value={redirectDraft}
    onChange={(event) => {
      setRedirectDraft(event.target.value);
    }}
  />
  <Button
    className="shrink-0 whitespace-nowrap"
    disabled={redirectPending || !redirectDraft.trim()}
    type="submit"
  >
    <Plus aria-hidden="true" size={16} />
    新增回调地址
  </Button>
</div>
```

- [ ] **Step 5: 修改角色管理为表格 CRUD**

在 `ApplicationDetailSheet.tsx` 中把 `RoleSection` 的卡片列表替换为表格结构。关键实现形态：

```tsx
<div className="overflow-x-auto rounded-md border bg-background">
  <table className="w-full table-fixed text-sm" aria-label="应用角色清单">
    <thead>
      <tr className="border-b bg-muted/50 text-left">
        <th className="w-[180px] px-3 py-2 font-medium">角色名称</th>
        <th className="w-[220px] px-3 py-2 font-medium">角色 key</th>
        <th className="w-[88px] px-3 py-2 font-medium">状态</th>
        <th className="min-w-[180px] px-3 py-2 font-medium">描述摘要</th>
        <th className="w-[150px] px-3 py-2 font-medium">创建时间</th>
        <th className="w-[150px] px-3 py-2 font-medium">更新时间</th>
        <th className="w-[132px] min-w-[132px] px-3 py-2 text-right font-medium">操作</th>
      </tr>
    </thead>
    <tbody>
      {props.roleState.roles.map((role) => (
        <tr className="border-b last:border-b-0" key={role.id}>
          <td className="px-3 py-2 font-medium text-foreground">{role.name}</td>
          <td className="px-3 py-2">
            <code className="block max-w-[200px] truncate rounded bg-muted px-2 py-1 text-xs" title={role.key}>
              {role.key}
            </code>
          </td>
          <td className="px-3 py-2">
            <StatusBadge tone={role.status === "active" ? "success" : "muted"}>
              {formatEntityStatus(role.status)}
            </StatusBadge>
          </td>
          <td className="px-3 py-2 text-muted-foreground">
            <span className="line-clamp-2" title={role.description ?? "暂无描述"}>
              {role.description ?? "暂无描述"}
            </span>
          </td>
          <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{formatDateTime(role.createdAt)}</td>
          <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{formatDateTime(role.updatedAt)}</td>
          <td className="px-3 py-2">
            <div className="flex justify-end gap-1.5">
              <Button aria-label={`查看 ${role.key}`} size="sm" type="button" variant="outline">查看</Button>
              <Button aria-label={`编辑 ${role.key}`} disabled={props.readonly || props.rolePending} size="sm" type="button" variant="outline">编辑</Button>
              <Button aria-label={`${role.status === "active" ? "停用" : "启用"} ${role.key}`} disabled={props.readonly || props.rolePending} size="sm" type="button" variant={role.status === "active" ? "destructive" : "outline"}>
                {role.status === "active" ? "停用" : "启用"}
              </Button>
            </div>
          </td>
        </tr>
      ))}
    </tbody>
  </table>
</div>
```

查看按钮不改变权限边界，可将当前行详情显示为只读摘要区域或打开现有编辑表单的只读信息。编辑和启停继续复用当前 `setRoleForm` 与 `setRoleStatusConfirmation`。

- [ ] **Step 6: 运行应用管理定向测试**

Run:

```bash
pnpm --filter @feishu-iam/admin-web test -- src/features/applications/ApplicationManagementView.test.tsx
```

Expected: PASS。

## Task 2: 权限管理移除快捷查询区

**Files:**
- Modify: `apps/admin-web/src/features/permissions/PermissionManagementView.tsx`
- Test: `apps/admin-web/src/features/permissions/PermissionManagementView.test.tsx`

- [ ] **Step 1: 写快捷查询移除测试**

在 `renders role table for the selected application` 用例中增加：

```ts
expect(screen.queryByLabelText("应用列表")).not.toBeInTheDocument();
expect(screen.getByLabelText("应用")).toHaveValue("crm");
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
pnpm --filter @feishu-iam/admin-web test -- src/features/permissions/PermissionManagementView.test.tsx
```

Expected: FAIL，因为当前仍渲染 `aria-label="应用列表"` 快捷查询区域。

- [ ] **Step 3: 删除快捷查询区域**

从 `PermissionManagementView.tsx` 删除以下结构：

```tsx
{applicationsState.status === "loaded" ? (
  <div className="flex flex-wrap gap-2 rounded-md border bg-background p-3" aria-label="应用列表">
    {applicationsState.applications.map((application) => (
      <Button>...</Button>
    ))}
  </div>
) : null}
```

保留 `FilterBar` 中的 `应用` 下拉框和 `updateSearch` 逻辑。

- [ ] **Step 4: 运行权限管理定向测试**

Run:

```bash
pnpm --filter @feishu-iam/admin-web test -- src/features/permissions/PermissionManagementView.test.tsx
```

Expected: PASS。

## Task 3: 设计规范补充

**Files:**
- Modify: `DESIGN.md`

- [ ] **Step 1: 在表格规范后补按钮稳定性规则**

在 `## 6. 表格规范` 的长标识符规则附近新增：

```markdown
按钮、工具栏、表单操作区和表格操作列必须有稳定布局：

- 按钮文字默认不得在按钮内部断行；短操作按钮使用 `whitespace-nowrap` 或等价策略保持稳定宽度。
- 输入框 + 按钮组合在空间不足时允许整组换行，但不允许把单个按钮压成多行或异常高度。
- 工具栏和表单操作区需要明确 `flex-wrap`、最小宽度或窄屏降级策略。
- 表格操作列应优先使用稳定宽度和 icon/button group，避免操作按钮撑高行高。
- 长文案按钮在窄屏下优先改短文案、图标加 tooltip、菜单收纳或整组换行。
```

- [ ] **Step 2: 在响应式规范补充检查点**

在 `## 17. 响应式规范` 增加：

```markdown
- 390px 和 768px 检查必须覆盖按钮文字、操作区、表单行和表格操作列；不得出现按钮内部断字、换行、遮挡、异常高度或点击区过小。
```

- [ ] **Step 3: 扫描规范占位和敏感信息**

Run:

```bash
rg -n "TBD|TODO|PLACEHOLDER|《|》|password\\s*=|secret\\s*=|token\\s*=|cookie\\s*=" DESIGN.md docs/superpowers/specs/2026-05-28-feishu-iam-v0.14.2-admin-polish.md
```

Expected: no output。

## Task 4: 版本元数据和项目文档

**Files:**
- Modify: `package.json`
- Modify: `apps/api/package.json`
- Modify: `apps/admin-web/package.json`
- Modify: `deploy/server.env.example`
- Modify: `deploy/install.sh`
- Modify: `deploy/docker-compose.yml`
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Modify: `AGENTS.md`
- Create: `docs/codex-sessions/YYYY-MM-DD-HHMM-v0.14.2后台信息密度与控件稳定性.md`

- [ ] **Step 1: 更新版本号和部署默认值**

把 `0.14.1` 更新为 `0.14.2`，把 `v0.14.1` 更新为 `v0.14.2`，仅限版本元数据、部署默认 tag 和本版本文档入口。

- [ ] **Step 2: 更新 README 版本历史**

新增 `v0.14.2` 行，核心过程写：

```markdown
GitLab issue `#18/#22/#23` 后台体验补丁：修复应用详情新增回调地址按钮文字换行变形，移除权限管理角色列表无价值快捷查询区域，并把应用详情 `角色管理` Tab 改为普通列表 CRUD；不改变后端 API、DDL、权限模型或 SSO 协议。
```

部署信息在镜像发布前写为待发布语义；镜像发布后补 digest 和 112 验收结果。

- [ ] **Step 3: 更新 CHANGELOG**

在顶部新增 `## v0.14.2`，说明纳入范围、排除 `#19/#20/#21`、验证和发布状态。

- [ ] **Step 4: 更新 AGENTS 当前阶段**

把当前阶段更新为 `v0.14.2` 已收口或实施中，保持 `v0.14.1` 不回退要求，并增加 `v0.14.2` 不回退项。

- [ ] **Step 5: 写会话归档**

新增中文归档，记录目标、用户关键要求、关键约束、修改文件、验证命令和未完成事项。

## Task 5: 验证、浏览器自检和发布收口

**Files:**
- Create/Modify: `docs/superpowers/reviews/2026-05-28-feishu-iam-v0.14.2-admin-polish-*.md`
- Modify: `docs/codex-sessions/YYYY-MM-DD-HHMM-v0.14.2后台信息密度与控件稳定性.md`
- Modify after release: `README.md`, `CHANGELOG.md`

- [ ] **Step 1: 运行定向测试**

Run:

```bash
pnpm --filter @feishu-iam/admin-web test -- src/features/applications/ApplicationManagementView.test.tsx src/features/permissions/PermissionManagementView.test.tsx
```

Expected: PASS。

- [ ] **Step 2: 运行构建**

Run:

```bash
pnpm --filter @feishu-iam/admin-web build
```

Expected: PASS，生成 `apps/admin-web/dist`。

- [ ] **Step 3: 运行响应式检查**

Run:

```bash
ADMIN_WEB_URL=http://127.0.0.1:5173 pnpm --filter @feishu-iam/admin-web test:responsive
```

Expected: `failures: []`。

- [ ] **Step 4: 运行全量检查**

Run:

```bash
pnpm check
```

Expected: PASS。

- [ ] **Step 5: Browser 或 Playwright 自检**

本地打开管理后台，至少覆盖：

- `/admin/applications/crm?tab=development`
- `/admin/applications/crm?tab=roles`
- `/admin/permissions?appKey=crm`
- 390px、768px、1280px、1440px

记录 console、Network、横向溢出、按钮换行、角色列表和权限管理筛选区结果。

- [ ] **Step 6: 预落地 review**

记录 design-review、qa 和 pre-landing review 到 `docs/superpowers/reviews/`，高优先级问题必须修复或明确接受。

- [ ] **Step 7: Git、release、镜像和 112 部署**

完成 commit、push/MR、tag、GitLab release、多架构镜像、`192.168.2.112:~/feishu-iam` 停机升级和 `/ready` `/version` 验证。发布后关闭 GitLab issue `#18/#22/#23`。

## 自查清单

- 规格覆盖：`#18/#22/#23` 均有实现任务、测试任务和验收任务。
- 排除项覆盖：`#19/#20/#21` 明确留到后续版本，不在本计划实现。
- 类型一致：计划使用现有 `ApplicationDetailSheet`、`PermissionManagementView`、`DataTable`、`StatusBadge`、`Button`、`Input`。
- 无占位：本计划不包含未定义的占位任务。
