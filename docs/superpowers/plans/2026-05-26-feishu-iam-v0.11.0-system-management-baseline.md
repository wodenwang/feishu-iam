# Feishu IAM v0.11.0 System Management Baseline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 Feishu IAM 后台壳层调整为 `工作台 / 应用管理 / 权限管理 / 系统管理`，并完成系统管理二级菜单、旧路由兼容、身份字段标签、列表列宽和详情底部规则基线。

**Architecture:** 采用现有 React + Vite + react-router + shadcn/tweakcn 组件体系，不新增后端 API、Prisma 或 DDL。路由事实源集中在 `apps/admin-web/src/routes/admin-routes.ts`，壳层能力在 `AppShell` 扩展为支持二级导航；业务页面仍复用现有 `features/admin-users`、`features/records`、`features/settings`。

**Tech Stack:** React、TypeScript、Vite、Testing Library、Vitest、Tailwind、shadcn/ui、lucide-react。

---

## Scope

本计划只覆盖 `v0.11.0`：

- 处理 GitLab issue `#8`：一级导航调整为 `工作台 / 应用管理 / 权限管理 / 系统管理`，系统管理二级菜单为 `飞书同步 / 管理员授权 / 操作审计 / 系统信息`。
- 处理 GitLab issue `#10`：管理员、审计和详情里的身份字段展示统一为清晰标签，例如 `飞书 user_id: xxx`。
- 处理 GitLab issue `#11`：建立通用列表列宽策略、详情底部留白、底部关闭按钮和长字段收拢规则。
- 更新 `AGENTS.md` 当前阶段，避免后续 Agent 误判为 `v0.8.1`。
- 保留旧路由兼容，避免 `/admin/records`、`/admin/admins`、`/admin/settings` 深链断掉。

本计划不覆盖：

- 不重做应用管理完整流程。
- 不重做角色详情、组织树选择或权限组绑定。
- 不处理 112 飞书同步失败根因。
- 不新增后端 DDL、完整 OIDC、SAML、ABAC、资源级权限或 HTTPS/高可用工程。

## File Map

- Modify `apps/admin-web/src/routes/admin-routes.ts`
  - 定义一级导航、系统管理二级菜单、新旧路径、默认路径和路由识别工具。
- Modify `apps/admin-web/src/components/admin/AppShell.tsx`
  - 支持带 children 的导航项、桌面展开态、桌面收缩态 tooltip、移动端二级菜单。
- Modify `apps/admin-web/src/components/admin/admin-components.test.tsx`
  - 覆盖二级菜单、收缩态、DataTable 填满宽度和 DetailSheet 底部留白。
- Modify `apps/admin-web/src/App.tsx`
  - 使用新导航模型，增加新系统管理路径，保留旧路径兼容跳转，统一顶部用户区身份标签。
- Modify `apps/admin-web/src/App.test.tsx`
  - 更新导航、旧路由兼容和系统管理二级菜单测试。
- Modify `apps/admin-web/src/features/records/RecordQueryView.tsx`
  - 将可见名称从 `记录查询` 改为 `操作审计`，更新面包屑、权限不足文案和详情标签。
- Modify `apps/admin-web/src/features/records/record-columns.tsx`
  - 调整列宽，收拢长字段，操作者字段显示 `飞书 user_id` 等清晰标签。
- Modify `apps/admin-web/src/features/records/record-mappers.ts`
  - 在可判断身份来源时生成更清晰的 actor 展示值。
- Modify `apps/admin-web/src/features/records/RecordQueryView.test.tsx`
  - 覆盖操作审计命名、身份字段标签、长字段收拢。
- Modify `apps/admin-web/src/features/admin-users/admin-user-columns.tsx`
  - 管理员列表中显示 `飞书 user_id` 标签，不裸露 ID。
- Modify `apps/admin-web/src/features/admin-users/AdminUserDetailSheet.tsx`
  - 详情描述和说明文案统一 `飞书 user_id`、`操作审计` 命名。
- Modify `apps/admin-web/src/features/admin-users/AdminAuthorizationView.tsx`
  - 面包屑调整为 `后台 / 系统管理 / 管理员授权`，确认文案使用 `操作审计`。
- Modify `apps/admin-web/src/features/admin-users/AdminAuthorizationView.test.tsx`
  - 覆盖列表标签和新面包屑。
- Modify `apps/admin-web/src/features/settings/SystemSettingsView.tsx`
  - 将页面作为系统管理下的 `飞书同步` 与 `系统信息` 入口承载页；标题、面包屑、区域标签与新 IA 一致。
- Modify `apps/admin-web/src/features/settings/SystemSettingsView.test.tsx`
  - 覆盖新标题、面包屑和旧 tab 兼容。
- Modify `apps/admin-web/src/components/admin/DataTable.tsx`
  - 默认表格 `w-full table-fixed`，支持列宽策略，容器允许窄屏横向滚动但桌面优先填满。
- Modify `apps/admin-web/src/components/admin/DetailSheet.tsx`
  - 内容区增加底部留白，支持可选 footer，保证底部关闭按钮不遮挡内容。
- Modify `DESIGN.md`
  - 固化 v0.11.0 导航、身份字段、DataTable、DetailSheet 规则。
- Modify `AGENTS.md`
  - 当前阶段更新为 `v0.11.0` 系统管理 IA 与通用体验基线。
- Modify `README.md`
  - 版本历史补充 `v0.11.0` 当前目标、后续发布信息占位语义，不写未生成 digest。
- Modify `CHANGELOG.md`
  - 增加 `v0.11.0` 未发布条目。
- Create `docs/codex-sessions/YYYY-MM-DD-HHMM-v0.11.0-system-management-baseline.md`
  - 记录会话目标、范围、修改文件、验证命令和部署结果。

## Task Decomposition

任务可并行，但 `Task 1` 必须先于其他前端任务完成或至少确定接口类型。推荐 subagent 写入边界：

1. `Task 1` owner：`admin-routes.ts`、`AppShell.tsx`、`admin-components.test.tsx`。
2. `Task 2` owner：`App.tsx`、`App.test.tsx`。
3. `Task 3` owner：`features/records/*`、`features/admin-users/*`、`features/settings/*`。
4. `Task 4` owner：`DataTable.tsx`、`DetailSheet.tsx`、相关组件测试。
5. `Task 5` owner：`AGENTS.md`、`DESIGN.md`、`README.md`、`CHANGELOG.md`、会话归档。

实现时不要修改彼此 owner 之外的文件；如发现必须跨界，先在最终回复说明并等待集成者处理。

---

### Task 1: Navigation Model And AppShell Nested Menu

**Files:**
- Modify: `apps/admin-web/src/routes/admin-routes.ts`
- Modify: `apps/admin-web/src/components/admin/AppShell.tsx`
- Test: `apps/admin-web/src/components/admin/admin-components.test.tsx`

- [ ] **Step 1: Write failing tests for nested navigation**

在 `apps/admin-web/src/components/admin/admin-components.test.tsx` 中扩展 `AppShell supports desktop collapse state...` 或新增测试：

```tsx
it("AppShell renders grouped system management navigation in expanded and collapsed states", async () => {
  localStorage.clear();
  const user = userEvent.setup();

  render(
    <MemoryRouter>
      <AppShell
        brand={<span>Feishu IAM</span>}
        navItems={[
          {
            href: "/admin/workspace",
            label: "工作台",
            icon: <Home className="h-4 w-4" />,
            active: false,
          },
          {
            href: "/admin/system",
            label: "系统管理",
            icon: <ScrollText className="h-4 w-4" />,
            active: true,
            children: [
              {
                href: "/admin/system/feishu",
                label: "飞书同步",
                active: false,
              },
              {
                href: "/admin/system/audit",
                label: "操作审计",
                active: true,
              },
            ],
          },
        ]}
        userMenu={<button type="button">用户菜单</button>}
      >
        <div>页面内容</div>
      </AppShell>
    </MemoryRouter>,
  );

  const nav = screen.getByRole("navigation", { name: "主菜单" });
  expect(within(nav).getByRole("link", { name: "系统管理" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  expect(within(nav).getByRole("link", { name: "飞书同步" })).toHaveAttribute(
    "href",
    "/admin/system/feishu",
  );
  expect(within(nav).getByRole("link", { name: "操作审计" })).toHaveAttribute(
    "aria-current",
    "page",
  );

  await user.click(screen.getByRole("button", { name: "收起主菜单" }));
  expect(screen.getByRole("link", { name: "系统管理" })).toHaveAttribute(
    "title",
    "系统管理",
  );
  expect(screen.queryByRole("link", { name: "飞书同步" })).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run the focused component test and confirm failure**

Run:

```bash
pnpm --filter @feishu-iam/admin-web test -- admin-components.test.tsx
```

Expected: TypeScript or test failure because `AppShellNavItem` does not accept `children` and nested links are not rendered.

- [ ] **Step 3: Implement route model**

Replace `apps/admin-web/src/routes/admin-routes.ts` with a route model equivalent to:

```ts
export type AdminRouteId =
  | "workspace"
  | "applications"
  | "permissions"
  | "system"
  | "systemFeishu"
  | "systemAdmins"
  | "systemAudit"
  | "systemInfo";

export type AdminRoute = {
  id: AdminRouteId;
  path: string;
  label: string;
  legacyPaths?: string[];
  children?: AdminRoute[];
};

export const systemRoutes: AdminRoute[] = [
  { id: "systemFeishu", path: "/admin/system/feishu", label: "飞书同步", legacyPaths: ["/admin/settings"] },
  { id: "systemAdmins", path: "/admin/system/admins", label: "管理员授权", legacyPaths: ["/admin/admins"] },
  { id: "systemAudit", path: "/admin/system/audit", label: "操作审计", legacyPaths: ["/admin/records"] },
  { id: "systemInfo", path: "/admin/system/info", label: "系统信息" },
];

export const adminRoutes: AdminRoute[] = [
  { id: "workspace", path: "/admin/workspace", label: "工作台" },
  { id: "applications", path: "/admin/applications", label: "应用管理" },
  { id: "permissions", path: "/admin/permissions", label: "权限管理" },
  { id: "system", path: "/admin/system/info", label: "系统管理", children: systemRoutes },
];

export function routePath(id: AdminRouteId): string {
  return flattenRoutes(adminRoutes).find((route) => route.id === id)?.path ?? "/admin/system/audit";
}

export function getActiveAdminRoute(pathname: string): AdminRouteId {
  const matched = flattenRoutes(adminRoutes)
    .filter((route) => matchesPath(pathname, route.path) || route.legacyPaths?.some((legacy) => matchesPath(pathname, legacy)))
    .sort((a, b) => b.path.length - a.path.length)[0];
  return matched?.id ?? "systemAudit";
}

export function flattenRoutes(routes: AdminRoute[]): AdminRoute[] {
  return routes.flatMap((route) => [route, ...(route.children ? flattenRoutes(route.children) : [])]);
}

function matchesPath(pathname: string, path: string): boolean {
  return pathname === path || pathname.startsWith(`${path}/`);
}
```

- [ ] **Step 4: Implement nested AppShell items**

Update `AppShellNavItem` in `AppShell.tsx`:

```ts
export type AppShellNavItem = {
  href: string;
  label: string;
  icon?: ReactNode;
  active: boolean;
  disabled?: boolean;
  ariaLabel?: string;
  children?: AppShellNavItem[];
};
```

Update `PrimaryNav` to render top-level item plus children only when `!collapsed`. Child links should use smaller text, left padding, `aria-current` when active, and no icon requirement. In collapsed mode only the parent is shown with tooltip.

- [ ] **Step 5: Run focused tests**

Run:

```bash
pnpm --filter @feishu-iam/admin-web test -- admin-components.test.tsx
```

Expected: PASS.

---

### Task 2: App Route Wiring And Legacy URL Compatibility

**Files:**
- Modify: `apps/admin-web/src/App.tsx`
- Test: `apps/admin-web/src/App.test.tsx`

- [ ] **Step 1: Write failing tests for system management route compatibility**

Add or update tests in `App.test.tsx`:

```tsx
it("系统管理二级菜单展示飞书同步、管理员授权、操作审计和系统信息", async () => {
  const user = userEvent.setup();
  mockFetch({ feishuStatus: makeStatus(), syncRuns: [makeRun()] });

  render(<App />);

  const navigation = within(await screen.findByRole("navigation", { name: "主菜单" }));
  expect(navigation.getByRole("link", { name: "系统管理" })).toHaveAttribute("href", "/admin/system/info");
  expect(navigation.getByRole("link", { name: "飞书同步" })).toHaveAttribute("href", "/admin/system/feishu");
  expect(navigation.getByRole("link", { name: "管理员授权" })).toHaveAttribute("href", "/admin/system/admins");
  expect(navigation.getByRole("link", { name: "操作审计" })).toHaveAttribute("href", "/admin/system/audit");
  expect(navigation.getByRole("link", { name: "系统信息" })).toHaveAttribute("href", "/admin/system/info");

  await user.click(navigation.getByRole("link", { name: "操作审计" }));
  expect(await screen.findByRole("heading", { name: "操作审计" })).toBeInTheDocument();
});

it("旧系统路由兼容跳转到系统管理二级菜单", async () => {
  mockFetch({ feishuStatus: makeStatus(), syncRuns: [makeRun()] });
  window.history.pushState({}, "", "/admin/records?tab=security");

  render(<App />);

  expect(await screen.findByRole("heading", { name: "操作审计" })).toBeInTheDocument();
  await waitFor(() => {
    expect(window.location.pathname).toBe("/admin/system/audit");
  });
  expect(window.location.search).toContain("tab=security");
});
```

- [ ] **Step 2: Run focused app tests and confirm failure**

Run:

```bash
pnpm --filter @feishu-iam/admin-web test -- App.test.tsx
```

Expected: FAIL because new routes and labels are not wired.

- [ ] **Step 3: Update App route wiring**

In `App.tsx`:

- Import `getActiveAdminRoute`, `routePath`.
- Replace old `routeIcons` keys with new ids.
- Build `navItems` from `adminRoutes`, preserving children.
- Treat all `system*` route ids as system group active.
- Load Feishu details when active route is `systemFeishu` or old `/admin/settings`.
- Add routes:
  - `/admin/system/feishu` -> `SystemSettingsPage mode="feishu"` or equivalent prop.
  - `/admin/system/info` -> `SystemSettingsPage mode="info"` or equivalent prop.
  - `/admin/system/admins` -> `AdminAuthorizationPage`.
  - `/admin/system/audit` -> `RecordQueryPage`.
- Add legacy redirects preserving query string:
  - `/admin/admins` -> `/admin/system/admins`
  - `/admin/records` -> `/admin/system/audit`
  - `/admin/settings` -> `/admin/system/feishu` when `tab=feishu`, otherwise `/admin/system/info`.

If preserving query string with `<Navigate>` is awkward, create a small component:

```tsx
function RedirectWithSearch({ to }: { to: string }) {
  const location = useLocation();
  return <Navigate to={`${to}${location.search}`} replace />;
}
```

- [ ] **Step 4: Update user identity display**

In `UserMenu`, change visible and accessible ID label from naked `ou_1` to `飞书 user_id: ou_1`:

```tsx
const feishuUserLabel = `飞书 user_id: ${props.admin.feishuUserId}`;
```

Use `feishuUserLabel` in `aria-label`, dropdown code label area, and visible code text.

- [ ] **Step 5: Run focused app tests**

Run:

```bash
pnpm --filter @feishu-iam/admin-web test -- App.test.tsx
```

Expected: PASS.

---

### Task 3: System Pages, Records Naming, And Identity Labels

**Files:**
- Modify: `apps/admin-web/src/features/records/RecordQueryView.tsx`
- Modify: `apps/admin-web/src/features/records/record-columns.tsx`
- Modify: `apps/admin-web/src/features/records/record-mappers.ts`
- Test: `apps/admin-web/src/features/records/RecordQueryView.test.tsx`
- Modify: `apps/admin-web/src/features/admin-users/admin-user-columns.tsx`
- Modify: `apps/admin-web/src/features/admin-users/AdminUserDetailSheet.tsx`
- Modify: `apps/admin-web/src/features/admin-users/AdminAuthorizationView.tsx`
- Test: `apps/admin-web/src/features/admin-users/AdminAuthorizationView.test.tsx`
- Modify: `apps/admin-web/src/features/settings/SystemSettingsView.tsx`
- Test: `apps/admin-web/src/features/settings/SystemSettingsView.test.tsx`

- [ ] **Step 1: Write failing records naming tests**

In `RecordQueryView.test.tsx`, assert heading and breadcrumb use `操作审计`, and actor label includes `飞书 user_id` when row raw value has `feishuUserId`.

- [ ] **Step 2: Update records visible naming**

In `RecordQueryView.tsx`:

- Change `aria-label="记录查询"` to `aria-label="操作审计"`.
- Change `PageHeader` title to `操作审计`.
- Change description to `集中查询审计日志、安全事件、飞书同步记录以及登录与 Token 相关事件。`
- Breadcrumbs should be `后台` -> `系统管理` -> `操作审计`.
- Permission denied copy should say `当前管理员无权查看操作审计数据。`

- [ ] **Step 3: Update record columns and mappers**

In `record-columns.tsx`:

- Set `action` minWidth `180px`.
- Set `target` minWidth `220px`, render with `line-clamp-2`.
- Set `actor` width or minWidth `180px`, render with `line-clamp-2`.
- Set `requestId` minWidth `180px`, render with visible prefix `request id:`.
- Keep result/time/actions stable width.

In `record-mappers.ts`, ensure actor values that originate from `feishuUserId` become `飞书 user_id: ${id}`.

- [ ] **Step 4: Update admin user identity labels**

In `admin-user-columns.tsx`, render the code line as:

```tsx
<span className="text-xs text-muted-foreground">飞书 user_id</span>
<code ...>{adminUser.feishuUserId}</code>
```

or a single line `飞书 user_id: ${adminUser.feishuUserId}` with truncation.

In `AdminUserDetailSheet.tsx`, change description code to include visible prefix `飞书 user_id:` and update audit text from `记录查询` to `操作审计`.

In `AdminAuthorizationView.tsx`, breadcrumbs should be `后台 / 系统管理 / 管理员授权`; confirmation text should say `可通过操作审计追溯...`。

- [ ] **Step 5: Update system settings page names**

Support a prop in `SystemSettingsViewProps`:

```ts
mode?: "feishu" | "info";
```

When `mode === "feishu"`:

- main `aria-label` and heading should be `飞书同步`.
- Breadcrumbs: `后台 / 系统管理 / 飞书同步`.
- The internal selected tab should be `feishu`.
- Hide or de-emphasize the side setting list if it makes the page title conflict. It may remain as related system information, but primary heading must be `飞书同步`.

When `mode === "info"`:

- main `aria-label` and heading should be `系统信息`.
- Breadcrumbs: `后台 / 系统管理 / 系统信息`.
- Default tab should be `runtime` unless query string explicitly requests `version`.
- Do not show Feishu sync as the primary default content.

- [ ] **Step 6: Run focused feature tests**

Run:

```bash
pnpm --filter @feishu-iam/admin-web test -- RecordQueryView.test.tsx AdminAuthorizationView.test.tsx SystemSettingsView.test.tsx
```

Expected: PASS.

---

### Task 4: Shared DataTable And DetailSheet Baseline

**Files:**
- Modify: `apps/admin-web/src/components/admin/DataTable.tsx`
- Modify: `apps/admin-web/src/components/admin/DetailSheet.tsx`
- Test: `apps/admin-web/src/components/admin/admin-components.test.tsx`

- [ ] **Step 1: Write failing shared component tests**

In `admin-components.test.tsx`, update `DataTable applies column sizing...` to assert:

```tsx
expect(screen.getByRole("table", { name: "记录列表" })).toHaveClass("w-full");
expect(screen.getByRole("table", { name: "记录列表" })).toHaveClass("table-fixed");
```

Add a DetailSheet test that confirms the content wrapper has bottom padding:

```tsx
expect(within(dialog).getByTestId("detail-sheet-body")).toHaveClass("pb-24");
```

- [ ] **Step 2: Run focused component tests and confirm failure**

Run:

```bash
pnpm --filter @feishu-iam/admin-web test -- admin-components.test.tsx
```

Expected: FAIL because `DataTable` uses `min-w-max` and `DetailSheet` body has no `data-testid` / bottom padding.

- [ ] **Step 3: Update DataTable**

Change table wrapper:

```tsx
const tableClassName = ["overflow-x-auto rounded-md border bg-background", className]
  .filter(Boolean)
  .join(" ");
```

Change table class:

```tsx
<Table aria-label={ariaLabel} className="w-full table-fixed">
```

Keep `columnStyle` so fixed/status/action columns remain stable.

- [ ] **Step 4: Update DetailSheet**

Change body wrapper:

```tsx
<div data-testid="detail-sheet-body" className="min-h-0 flex-1 px-6 py-5 pb-24">
  {children}
</div>
```

If a footer prop is needed later, do not add it in this task unless tests require it.

- [ ] **Step 5: Run focused component tests**

Run:

```bash
pnpm --filter @feishu-iam/admin-web test -- admin-components.test.tsx
```

Expected: PASS.

---

### Task 5: Documentation, Version Notes, And Session Archive

**Files:**
- Modify: `AGENTS.md`
- Modify: `DESIGN.md`
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Create: `docs/codex-sessions/YYYY-MM-DD-HHMM-v0.11.0-system-management-baseline.md`

- [ ] **Step 1: Update AGENTS current phase**

Replace the `## 当前阶段` section with a `v0.11.0` section:

```markdown
当前阶段是：`v0.11.0` 系统管理 IA 与通用体验基线实施阶段。`v0.10.4` 已收口，当前主线已完成 shadcn/tweakcn/Tailwind 后台运行时迁移、工作台、应用管理、权限管理、管理员授权、系统设置、操作审计基础迁移和 GitLab issue 级布局修复。

当前优先事项：

- 处理 `#8`：一级导航调整为 `工作台 / 应用管理 / 权限管理 / 系统管理`，系统管理下沉 `飞书同步 / 管理员授权 / 操作审计 / 系统信息`。
- 处理 `#10`：统一管理员、审计、详情和顶部用户区中的身份字段展示，例如 `飞书 user_id: xxx`。
- 处理 `#11`：统一列表列宽策略、详情底部留白、底部关闭按钮和长字段收拢规则。
- 保留 `/admin/records`、`/admin/admins`、`/admin/settings` 等旧路由兼容或跳转，避免深链断掉。

当前阶段不做：

- 不重做角色树、权限组绑定或应用管理大流程。
- 不处理 112 飞书同步失败根因；该问题归入后续 `v0.11.1` 飞书同步可信诊断版本。
- 不新增后端 DDL、完整 OIDC、SAML、ABAC、资源级权限、HTTPS、反向代理、高可用或滚动升级。
```

- [ ] **Step 2: Update DESIGN.md**

Ensure `DESIGN.md` includes:

- v0.11.0 system management IA as a current decision.
- Identity fields must render with clear labels.
- DataTable defaults to full width and stable status/time/action columns.
- DetailSheet body bottom padding prevents bottom obstruction.

- [ ] **Step 3: Update README and CHANGELOG**

In `README.md` version history, add a `v0.11.0` row marked `实施中` or later `已收口` when release completes. During implementation, do not invent image digest.

In `CHANGELOG.md`, add:

```markdown
## v0.11.0 - 2026-05-26

- 调整后台 IA 为工作台、应用管理、权限管理、系统管理。
- 将飞书同步、管理员授权、操作审计、系统信息收敛为系统管理二级菜单。
- 统一身份字段、列表列宽和详情底部留白规则。
- 保留旧系统类路由兼容。
```

- [ ] **Step 4: Create session archive**

Create `docs/codex-sessions/2026-05-26-HHMM-v0.11.0-system-management-baseline.md` with:

- 会话目标。
- 用户关键要求。
- 使用的技能和约束。
- 重要设计决策。
- 修改文件。
- 验证命令和结果。
- 发布、部署和 issue 关闭结果。
- 未完成事项。

- [ ] **Step 5: Run documentation scans**

Run:

```bash
rg -n "《|》|TODO|TBD|PLACEHOLDER|secret|token|cookie|密码" AGENTS.md DESIGN.md README.md CHANGELOG.md docs/codex-sessions/2026-05-26-*-v0.11.0-system-management-baseline.md
```

Expected: No unhandled template placeholders. Security terms may appear only in safety rules or “不要记录” statements, not as actual credentials.

---

## Verification Plan

After all implementation tasks:

1. Run focused unit tests:

```bash
pnpm --filter @feishu-iam/admin-web test -- admin-components.test.tsx App.test.tsx RecordQueryView.test.tsx AdminAuthorizationView.test.tsx SystemSettingsView.test.tsx
```

2. Run full project check:

```bash
pnpm check
```

3. Run admin build:

```bash
pnpm --filter @feishu-iam/admin-web build
```

4. Run responsive overflow check with local Vite server:

```bash
pnpm --filter @feishu-iam/admin-web dev -- --host 127.0.0.1
ADMIN_WEB_URL=http://127.0.0.1:5173 pnpm --filter @feishu-iam/admin-web test:responsive
```

5. Browser self-check:

- Open `http://127.0.0.1:5173/admin/workspace`.
- Verify four top-level nav items.
- Verify system management submenu.
- Visit `/admin/system/audit`, `/admin/system/admins`, `/admin/system/feishu`, `/admin/system/info`.
- Visit legacy `/admin/records?tab=security`, `/admin/admins`, `/admin/settings?tab=version`.
- Check desktop and narrow viewport layout.
- Check console and Network for unexpected errors.

6. Release and deploy after verification:

- Commit intended files.
- Push branch.
- Create GitLab MR.
- Merge MR after checks.
- Create annotated tag `v0.11.0`.
- Create GitLab release.
- Build and push multi-arch image `feishu-iam:v0.11.0`.
- Deploy to `192.168.2.112:~/feishu-iam`.
- Verify:

```bash
curl -fsS http://192.168.2.112:8000/ready
curl -fsS http://192.168.2.112:8000/version
curl -fsS http://feishu-iam.example.com/ready
curl -fsS http://feishu-iam.example.com/version
```

## Self-Review

- Spec coverage: covers #8, #10, #11, `AGENTS.md` current phase, old route compatibility, Browser self-check and deploy to 112.
- Placeholder scan: no `TBD` or unresolved placeholders are intentionally left in implementation steps.
- Type consistency: route ids use `systemFeishu/systemAdmins/systemAudit/systemInfo`; AppShell children use the same `AppShellNavItem` shape.
