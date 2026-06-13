# Feishu IAM v1.0.2 UI/UX P0 Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 发布 `v1.0.2` 的第一个 UI/UX vertical slice，修复移动端资源列表、移动端 Tabs 和 OAuth 公开错误页复制边界这三个 P0 问题。

**Architecture:** 保持 React + Vite + shadcn/ui + tweakcn + Tailwind 基线，不引入新 UI 体系。共享响应式能力下沉到 `DataTable` 和项目级 Tabs wrapper，页面只提供资源卡片字段配置；OAuth 公开 HTML 错误页在服务端模板内收口，只复制 request id。

**Tech Stack:** React 19、Vite、Tailwind CSS、Radix Tabs、lucide-react、Vitest、Testing Library、Playwright/Browser、NestJS、Jest e2e。

---

## 执行状态（2026-06-13）

- Task 1 已完成：`DataTable` 支持 390px 移动端资源卡片，并保留加载、空、错误、无权限状态。
- Task 2 已完成：应用管理、权限管理、管理员授权和操作审计列表接入移动端卡片；管理员移动端卡片保留详情、编辑、启用/停用入口。
- Task 3 已完成：新增 `ResponsiveTabsList`，应用详情、角色详情和操作审计 Tabs 在窄屏下由 Tab 容器横向滚动，不撑破页面。
- Task 4 已完成：OAuth 公开 HTML 错误页只复制 `request id`，移除整段问题信息复制与 `data-feedback`。
- Task 5 已完成：版本号、README、排障文档和验收记录已同步 `v1.0.2`。
- Task 6 已完成：`pnpm check` 通过；`ADMIN_WEB_URL=http://localhost:5173 pnpm --filter @feishu-iam/admin-web test:responsive` 通过。API 本地 Browser 启动因未配置 `DATABASE_URL` 阻断，公开错误页由 API 测试覆盖，并将在生产 canary 中复核。

---

## 不可变边界

- 不新增 DDL。
- 不改变管理员 session、权限裁剪、审计写入、request id 生成或 OAuth redirect_uri 精确匹配规则。
- 不实现完整 OIDC、refresh token、SAML、ABAC、资源级权限或数据范围权限。
- 不恢复整段问题信息复制、粘贴或本地提取。
- 不展示或复制 secret、token、cookie、authorization、授权码、token hash、state hash 或 raw payload。
- 不把 Product Design 输出作为代码生成依据；它只作为视觉目标。
- 本计划只实现 P0 slice：移动端列表、移动端 Tabs、公开 OAuth 错误页。主题 token 大改、工作台信息密度、复杂配置区优化进入后续切片。

## 设计与评审输入

- `DESIGN.md`
- `docs/superpowers/specs/2026-06-13-feishu-iam-v1.0.2-frontend-uiux-iteration.md`
- `docs/superpowers/reviews/2026-06-13-feishu-iam-v1.0.2-uiux-plan-design-review.md`
- `docs/superpowers/reviews/2026-06-13-feishu-iam-v1.0.2-prototype-review.md`
- `docs/superpowers/reviews/2026-06-13-feishu-iam-v1.0.2-eng-review.md`
- `design/v1.0.2-product-design-visual-target.md`
- `design/v1.0.2-responsive-prototype.md`
- `docs/design-audits/2026-06-13-frontend-uiux/`

## 文件结构

- Modify `IMPLEMENTATION_PLAN.md`：当前执行计划，执行中勾选。
- Create `docs/superpowers/plans/2026-06-13-feishu-iam-v1.0.2-uiux-p0.md`：本计划的版本化副本。
- Modify `apps/admin-web/src/components/admin/DataTable.tsx`：新增移动端资源卡片渲染 API。
- Create `apps/admin-web/src/components/admin/DataTable.test.tsx`：覆盖桌面表格、移动卡片和状态分支。
- Create `apps/admin-web/src/components/admin/ResponsiveTabsList.tsx`：项目级 Tabs 横向滚动 wrapper。
- Create `apps/admin-web/src/components/admin/ResponsiveTabsList.test.tsx`：覆盖可访问名称、滚动容器和 TabsList 组合。
- Modify `apps/admin-web/src/features/applications/ApplicationManagementView.tsx`：接入移动端应用卡片。
- Modify `apps/admin-web/src/features/permissions/PermissionManagementView.tsx`：接入移动端角色卡片。
- Modify `apps/admin-web/src/features/admin-users/AdminAuthorizationView.tsx`：接入移动端管理员卡片。
- Modify `apps/admin-web/src/features/records/RecordQueryView.tsx`：接入响应式 Tabs 和移动端记录卡片。
- Modify `apps/admin-web/src/features/applications/ApplicationDetailPage.tsx`：接入响应式 Tabs。
- Modify `apps/admin-web/src/features/permissions/PermissionRoleDetailPage.tsx`：接入响应式 Tabs。
- Modify feature tests：`ApplicationManagementView.test.tsx`、`PermissionManagementView.test.tsx`、`AdminAuthorizationView.test.tsx`、`RecordQueryView.test.tsx`。
- Modify `apps/api/src/oauth/oauth-error.filter.ts`：移除整段反馈文本和 `复制问题信息`。
- Modify `apps/api/test/oauth.controller.e2e-spec.ts`：断言三条公开 OAuth 错误路径只复制 request id。
- Modify `docs/oauth-troubleshooting.md`：更新终端用户反馈说明，只要求 request id。
- Modify `README.md`：同步 v1.0.2 版本历史、文档索引和验证说明。
- Create `docs/acceptance/v1.0.2-uiux-p0.md`：记录测试、Browser 截图和验收结果。
- Update `docs/codex-sessions/2026-06-13-1340-v1.0.2-uiux-audit-plan.md` 或新增本次会话归档：记录本次实施、验证和部署结果。

## Task 1: DataTable 移动端卡片 API

**Files:**
- Modify: `apps/admin-web/src/components/admin/DataTable.tsx`
- Create: `apps/admin-web/src/components/admin/DataTable.test.tsx`

- [ ] **Step 1: 写失败测试**

Create `apps/admin-web/src/components/admin/DataTable.test.tsx`:

```tsx
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "../ui/button";
import { DataTable } from "./DataTable";

type Row = {
  id: string;
  name: string;
  key: string;
  status: string;
  updatedAt: string;
};

const rows: Row[] = [
  {
    id: "app-1",
    name: "客户管理系统",
    key: "crm.production.portal.long-key",
    status: "启用",
    updatedAt: "2026-06-13 15:00",
  },
];

describe("DataTable", () => {
  it("renders desktop table and mobile cards from the same rows", () => {
    render(
      <DataTable
        aria-label="应用清单"
        columns={[
          { key: "name", header: "应用", render: (row) => row.name },
          { key: "key", header: "app_key", render: (row) => row.key },
        ]}
        getRowKey={(row) => row.id}
        mobileCard={{
          title: (row) => row.name,
          description: (row) => row.key,
          fields: [
            { label: "状态", render: (row) => row.status },
            { label: "更新时间", render: (row) => row.updatedAt },
          ],
          actions: (row) => <Button type="button">查看 {row.name}</Button>,
        }}
        rows={rows}
      />,
    );

    expect(screen.getByRole("table", { name: "应用清单" })).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "应用清单移动端列表" })).toBeInTheDocument();
    expect(screen.getByText("crm.production.portal.long-key")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "查看 客户管理系统" })).toBeInTheDocument();
  });

  it("keeps PageState behavior for empty, loading, error, and forbidden states", () => {
    const { rerender } = render(
      <DataTable columns={[]} getRowKey={(row: Row) => row.id} loading rows={[]} />,
    );
    expect(screen.getByText("正在加载")).toBeInTheDocument();

    rerender(<DataTable columns={[]} getRowKey={(row: Row) => row.id} rows={[]} />);
    expect(screen.getByText("暂无数据")).toBeInTheDocument();

    rerender(<DataTable columns={[]} error="无法读取列表" getRowKey={(row: Row) => row.id} rows={[]} />);
    expect(screen.getByText("无法读取列表")).toBeInTheDocument();

    rerender(<DataTable columns={[]} forbidden="没有权限访问" getRowKey={(row: Row) => row.id} rows={[]} />);
    expect(screen.getByText("没有权限")).toBeInTheDocument();
    expect(screen.getByText("没有权限访问")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
pnpm --filter @feishu-iam/admin-web test -- src/components/admin/DataTable.test.tsx
```

Expected: FAIL，TypeScript 报 `mobileCard` 属性不存在。

- [ ] **Step 3: 实现 DataTable API**

Modify `apps/admin-web/src/components/admin/DataTable.tsx`:

```tsx
export type DataTableMobileField<T> = {
  label: string;
  render: (row: T) => ReactNode;
};

export type DataTableMobileCard<T> = {
  title: (row: T) => ReactNode;
  description?: (row: T) => ReactNode;
  fields?: Array<DataTableMobileField<T>>;
  actions?: (row: T) => ReactNode;
};

export type DataTableProps<T> = {
  columns: Array<DataTableColumn<T>>;
  rows: T[];
  getRowKey: (row: T) => string;
  loading?: boolean;
  emptyText?: string;
  error?: string | null;
  forbidden?: boolean | string;
  className?: string;
  mobileCard?: DataTableMobileCard<T>;
  "aria-label"?: string;
};
```

Then replace the successful rows return with:

```tsx
const tableClassName = [
  mobileCard ? "hidden md:block" : undefined,
  "overflow-x-auto rounded-md border bg-card shadow-sm",
  className,
]
  .filter(Boolean)
  .join(" ");

return (
  <div className="grid gap-3">
    {mobileCard ? (
      <ul
        aria-label={`${ariaLabel ?? "数据"}移动端列表`}
        className="grid gap-3 md:hidden"
      >
        {rows.map((row) => (
          <li
            className="grid min-w-0 gap-3 rounded-md border bg-card p-4 shadow-sm"
            key={getRowKey(row)}
          >
            <div className="grid min-w-0 gap-1">
              <div className="break-words text-sm font-semibold text-foreground">
                {mobileCard.title(row)}
              </div>
              {mobileCard.description ? (
                <div className="break-all text-xs leading-5 text-muted-foreground">
                  {mobileCard.description(row)}
                </div>
              ) : null}
            </div>
            {mobileCard.fields?.length ? (
              <dl className="grid gap-2 text-sm">
                {mobileCard.fields.map((field) => (
                  <div
                    className="grid min-w-0 grid-cols-[88px_minmax(0,1fr)] gap-2"
                    key={field.label}
                  >
                    <dt className="text-muted-foreground">{field.label}</dt>
                    <dd className="min-w-0 break-words text-foreground">
                      {field.render(row)}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : null}
            {mobileCard.actions ? (
              <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                {mobileCard.actions(row)}
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    ) : null}

    <div className={tableClassName}>
      <Table aria-label={ariaLabel} className="w-full table-fixed">
        ...
      </Table>
    </div>
  </div>
);
```

- [ ] **Step 4: 运行测试确认通过**

Run:

```bash
pnpm --filter @feishu-iam/admin-web test -- src/components/admin/DataTable.test.tsx
```

Expected: PASS。

## Task 2: 应用、权限、管理员、审计列表接入移动端卡片

**Files:**
- Modify: `apps/admin-web/src/features/applications/ApplicationManagementView.tsx`
- Modify: `apps/admin-web/src/features/permissions/PermissionManagementView.tsx`
- Modify: `apps/admin-web/src/features/admin-users/AdminAuthorizationView.tsx`
- Modify: `apps/admin-web/src/features/records/RecordQueryView.tsx`
- Modify tests in the same feature folders.

- [ ] **Step 1: 写页面级失败测试**

Update each feature test with one assertion that the mobile list exists and key content is readable. Example for applications:

```tsx
expect(await screen.findByRole("list", { name: "应用清单移动端列表" })).toBeInTheDocument();
expect(screen.getByText("crm.production.portal.long-key")).toBeInTheDocument();
expect(screen.getByRole("button", { name: /查看 .* 详情/ })).toBeInTheDocument();
```

Apply the same pattern:

- `PermissionManagementView.test.tsx`: assert `IAM 角色清单移动端列表` and role key.
- `AdminAuthorizationView.test.tsx`: assert `管理员授权清单移动端列表` and `飞书 user_id`。
- `RecordQueryView.test.tsx`: assert non-trace tabs render `${tab.label}列表移动端列表` and request id text.

- [ ] **Step 2: 运行失败测试**

Run:

```bash
pnpm --filter @feishu-iam/admin-web test -- \
  src/features/applications/ApplicationManagementView.test.tsx \
  src/features/permissions/PermissionManagementView.test.tsx \
  src/features/admin-users/AdminAuthorizationView.test.tsx \
  src/features/records/RecordQueryView.test.tsx
```

Expected: FAIL，移动端列表 role 不存在。

- [ ] **Step 3: 接入应用管理移动卡片**

In `ApplicationManagementView.tsx`, pass `mobileCard` to `DataTable`:

```tsx
mobileCard={{
  title: (application) => application.name,
  description: (application) => (
    <code className="break-all rounded bg-muted px-2 py-1 text-xs">
      {application.appKey}
    </code>
  ),
  fields: [
    { label: "状态", render: (application) => <StatusBadge tone={application.status === "active" ? "success" : "muted"}>{formatEntityStatus(application.status)}</StatusBadge> },
    { label: "负责人", render: (application) => application.ownerUserId ?? "未配置" },
    { label: "更新时间", render: (application) => formatDateTime(application.updatedAt) },
    { label: "接入", render: (application) => <IntegrationSummaryCell application={application} /> },
  ],
  actions: (application) => (
    <Button
      aria-label={`查看 ${application.appKey} 详情`}
      size="sm"
      type="button"
      variant="outline"
      onClick={() => {
        const from = `${location.pathname}${location.search}`;
        void navigate(`/admin/applications/${encodeURIComponent(application.appKey)}?from=${encodeURIComponent(from)}`);
      }}
    >
      查看详情
    </Button>
  ),
}}
```

- [ ] **Step 4: 接入权限管理移动卡片**

In `PermissionManagementView.tsx`, pass:

```tsx
mobileCard={{
  title: (role) => role.name,
  description: (role) => (
    <code className="break-all rounded bg-muted px-2 py-1 text-xs">
      {role.key}
    </code>
  ),
  fields: [
    { label: "状态", render: (role) => <StatusBadge tone={role.status === "active" ? "success" : "muted"}>{formatRoleStatus(role.status)}</StatusBadge> },
    { label: "权限组", render: (role) => `${readBoundPermissionGroupIds(role).length} 个` },
    { label: "更新时间", render: (role) => formatDateTime(role.updatedAt) },
  ],
  actions: (role) => (
    <Button aria-label={`查看 ${role.key} 详情`} size="sm" type="button" variant="outline" onClick={() => { handleRowAction({ type: "detail", role }); }}>
      查看详情
    </Button>
  ),
}}
```

If `readBoundPermissionGroupIds` or `formatDateTime` is not exported, export it from `permission-columns.tsx` instead of duplicating logic.

- [ ] **Step 5: 接入管理员授权移动卡片**

In `AdminAuthorizationView.tsx`, pass:

```tsx
mobileCard={{
  title: (adminUser) => adminUser.displayName || "未命名管理员",
  description: (adminUser) => (
    <code className="break-all rounded bg-muted px-2 py-1 text-xs">
      飞书 user_id: {adminUser.feishuUserId}
    </code>
  ),
  fields: [
    { label: "角色", render: (adminUser) => formatAdminRoleLabel(adminUser.roles) },
    { label: "状态", render: (adminUser) => formatAdminStatus(adminUser.status) },
    { label: "应用范围", render: (adminUser) => formatApplicationScopes(adminUser.applicationScopes) },
  ],
  actions: (adminUser) => (
    <div className="flex flex-wrap justify-end gap-2">
      <Button size="sm" type="button" variant="outline" onClick={() => { handleRowAction({ type: "detail", adminUser }); }}>详情</Button>
      {!isReadonlyAdminUser(adminUser) ? (
        <Button size="sm" type="button" variant="outline" onClick={() => { handleRowAction({ type: "edit", adminUser }); }}>编辑</Button>
      ) : null}
    </div>
  ),
}}
```

- [ ] **Step 6: 接入操作审计移动卡片**

In `RecordQueryView.tsx`, pass to non-trace `DataTable`:

```tsx
mobileCard={{
  title: (row) => row.action,
  description: (row) => row.target,
  fields: [
    { label: "结果", render: (row) => formatResult(row.result) },
    { label: "操作者", render: (row) => row.actor },
    { label: "request id", render: (row) => row.requestId ? `request id: ${row.requestId}` : "-" },
    { label: "时间", render: (row) => formatDateTime(row.createdAt) },
  ],
  actions: (row) => (
    <Button aria-label={`查看 ${currentTab.detailLabel} ${row.id}`} size="sm" type="button" variant="outline" onClick={() => { updateSearch({ sheet: `${row.kind === "security" && search.tab === "tokens" ? "token" : row.kind}:${row.id}` }); }}>
      查看详情
    </Button>
  ),
}}
```

Export `formatResult` from `record-columns.tsx` if needed.

- [ ] **Step 7: 运行页面测试**

Run:

```bash
pnpm --filter @feishu-iam/admin-web test -- \
  src/components/admin/DataTable.test.tsx \
  src/features/applications/ApplicationManagementView.test.tsx \
  src/features/permissions/PermissionManagementView.test.tsx \
  src/features/admin-users/AdminAuthorizationView.test.tsx \
  src/features/records/RecordQueryView.test.tsx
```

Expected: PASS。

## Task 3: 响应式 Tabs wrapper

**Files:**
- Create: `apps/admin-web/src/components/admin/ResponsiveTabsList.tsx`
- Create: `apps/admin-web/src/components/admin/ResponsiveTabsList.test.tsx`
- Modify: `apps/admin-web/src/features/records/RecordQueryView.tsx`
- Modify: `apps/admin-web/src/features/applications/ApplicationDetailPage.tsx`
- Modify: `apps/admin-web/src/features/permissions/PermissionRoleDetailPage.tsx`

- [ ] **Step 1: 写失败测试**

Create `ResponsiveTabsList.test.tsx`:

```tsx
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Tabs, TabsTrigger } from "../ui/tabs";
import { ResponsiveTabsList } from "./ResponsiveTabsList";

describe("ResponsiveTabsList", () => {
  it("wraps TabsList in a horizontal scroll region with an accessible label", () => {
    render(
      <Tabs defaultValue="trace">
        <ResponsiveTabsList aria-label="操作审计标签">
          <TabsTrigger value="trace">追踪</TabsTrigger>
          <TabsTrigger value="audit">审计日志</TabsTrigger>
          <TabsTrigger value="security">安全事件</TabsTrigger>
          <TabsTrigger value="sync">同步记录</TabsTrigger>
          <TabsTrigger value="tokens">登录与 Token 记录</TabsTrigger>
        </ResponsiveTabsList>
      </Tabs>,
    );

    expect(screen.getByRole("tablist", { name: "操作审计标签" })).toBeInTheDocument();
    expect(screen.getByTestId("responsive-tabs-scroll")).toHaveClass("overflow-x-auto");
    expect(screen.getByRole("tab", { name: "登录与 Token 记录" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
pnpm --filter @feishu-iam/admin-web test -- src/components/admin/ResponsiveTabsList.test.tsx
```

Expected: FAIL，模块不存在。

- [ ] **Step 3: 实现 wrapper**

Create `apps/admin-web/src/components/admin/ResponsiveTabsList.tsx`:

```tsx
import type { ReactNode } from "react";
import { TabsList } from "../ui/tabs";
import { cn } from "../../lib/utils";

export function ResponsiveTabsList(props: {
  children: ReactNode;
  className?: string;
  "aria-label": string;
}) {
  return (
    <div
      className="max-w-full overflow-x-auto pb-1"
      data-testid="responsive-tabs-scroll"
    >
      <TabsList
        aria-label={props["aria-label"]}
        className={cn("w-max min-w-full justify-start", props.className)}
      >
        {props.children}
      </TabsList>
    </div>
  );
}
```

- [ ] **Step 4: 替换操作审计 Tabs**

In `RecordQueryView.tsx`, replace the manual wrapper:

```tsx
<ResponsiveTabsList aria-label="操作审计标签">
  {tabItems.map((tab) => (
    <TabsTrigger key={tab.value} value={tab.value}>
      {tab.label}
    </TabsTrigger>
  ))}
</ResponsiveTabsList>
```

- [ ] **Step 5: 替换应用详情和角色详情 Tabs**

Search:

```bash
rg -n "TabsList|TabsTrigger" apps/admin-web/src/features/applications/ApplicationDetailPage.tsx apps/admin-web/src/features/permissions/PermissionRoleDetailPage.tsx
```

Replace the direct `TabsList` with `ResponsiveTabsList` and preserve existing `TabsTrigger` values and labels.

- [ ] **Step 6: 运行测试**

Run:

```bash
pnpm --filter @feishu-iam/admin-web test -- \
  src/components/admin/ResponsiveTabsList.test.tsx \
  src/features/records/RecordQueryView.test.tsx
```

Expected: PASS。

## Task 4: OAuth HTML 错误页只复制 request id

**Files:**
- Modify: `apps/api/src/oauth/oauth-error.filter.ts`
- Modify: `apps/api/test/oauth.controller.e2e-spec.ts`
- Modify: `docs/oauth-troubleshooting.md`

- [ ] **Step 1: 写失败测试**

In `apps/api/test/oauth.controller.e2e-spec.ts`, add assertions for all three HTML paths:

```ts
expect(response.text).toContain('复制 request id');
expect(response.text).not.toContain('复制问题信息');
expect(response.text).not.toContain('data-feedback');
expect(response.text).toContain('request id');
```

Cover:

- `/oauth/authorize`
- `/oauth/feishu/callback`
- `/api/auth/feishu/callback`

- [ ] **Step 2: 运行后端测试确认失败**

Run:

```bash
pnpm --filter @feishu-iam/api test -- test/oauth.controller.e2e-spec.ts
```

Expected: FAIL，HTML 仍包含 `复制问题信息` 或 `data-feedback`。

- [ ] **Step 3: 修改 HTML 模板**

In `apps/api/src/oauth/oauth-error.filter.ts`, delete `feedbackText` and replace the copy button with request id only:

```ts
function renderHtmlError(message: string, requestId: string | undefined): string {
  const safeMessage = escapeHtml(message);
  const safeRequestId = escapeHtml(requestId ?? 'unknown');
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>无法完成登录</title>
  <style>
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f8fafc; color: #172033; }
    main { min-height: 100vh; display: grid; place-items: center; padding: 24px; box-sizing: border-box; }
    section { width: min(100%, 640px); padding: 28px; background: #fff; border: 1px solid #dde1e7; border-radius: 8px; box-shadow: 0 8px 28px rgba(15, 23, 42, 0.06); box-sizing: border-box; }
    h1 { margin: 0 0 12px; font-size: 24px; line-height: 1.25; }
    p { margin: 10px 0; line-height: 1.7; }
    dl { display: grid; gap: 12px; margin: 20px 0; }
    dt { color: #64748b; font-size: 13px; }
    dd { margin: 4px 0 0; word-break: break-all; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
    button { border: 1px solid #cbd5e1; background: #fff; border-radius: 6px; padding: 8px 12px; cursor: pointer; min-height: 40px; }
    .actions { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
    .note { color: #64748b; font-size: 13px; }
    @media (max-width: 390px) { main { align-items: start; padding: 16px; } section { padding: 20px; } h1 { font-size: 20px; } }
  </style>
</head>
<body>
  <main aria-label="Feishu IAM 问题提示">
    <section>
      <p class="note">Feishu IAM</p>
      <h1>无法完成登录</h1>
      <p>${safeMessage}</p>
      <p>请返回原系统重新发起登录；如果问题持续出现，只需复制 request id 反馈给接入系统负责人或 Feishu IAM 管理员。</p>
      <dl>
        <div><dt>request id</dt><dd id="request-id">${safeRequestId}</dd></div>
        <div><dt>错误摘要</dt><dd>OAuth 登录失败</dd></div>
      </dl>
      <div class="actions">
        <button type="button" onclick="navigator.clipboard && navigator.clipboard.writeText(document.getElementById('request-id').textContent || 'unknown')">复制 request id</button>
      </div>
    </section>
  </main>
</body>
</html>`;
}
```

- [ ] **Step 4: 更新排障文档**

In `docs/oauth-troubleshooting.md`, replace any instruction telling terminal users to copy full problem info with:

```markdown
终端用户只需要复制统一问题提示页中的 `request id`。不要要求用户复制整段问题信息、URL、token、cookie、authorization、授权码、token hash、state hash 或 raw payload。
```

- [ ] **Step 5: 运行测试**

Run:

```bash
pnpm --filter @feishu-iam/api test -- test/oauth.controller.e2e-spec.ts
```

Expected: PASS。

## Task 5: 版本文档和验收记录

**Files:**
- Modify: `README.md`
- Create: `docs/acceptance/v1.0.2-uiux-p0.md`

- [ ] **Step 1: 更新 README 版本历史**

Add `v1.0.2` to README version history:

```markdown
### v1.0.2

- 修复管理后台 390px 移动端资源列表压缩问题，应用、权限、管理员和操作审计列表改为可读移动端卡片。
- 修复操作审计、应用详情和角色详情等多 Tab 页面在 390px 下的横向溢出风险。
- 修复 OAuth 公开错误页仍复制整段问题信息的问题，公开错误页只复制 `request id`。
- 本版本不新增 DDL，不改变 OAuth 协议、管理员 session、权限模型或第三方应用接入契约。
```

- [ ] **Step 2: 创建验收记录模板**

Create `docs/acceptance/v1.0.2-uiux-p0.md`:

```markdown
# Feishu IAM v1.0.2 UI/UX P0 验收记录

日期：2026-06-13

## 本地验证命令

| 命令 | 结果 |
|---|---|
| `pnpm --filter @feishu-iam/admin-web test -- src/components/admin/DataTable.test.tsx src/components/admin/ResponsiveTabsList.test.tsx src/features/applications/ApplicationManagementView.test.tsx src/features/permissions/PermissionManagementView.test.tsx src/features/admin-users/AdminAuthorizationView.test.tsx src/features/records/RecordQueryView.test.tsx` | 待执行 |
| `pnpm --filter @feishu-iam/api test -- test/oauth.controller.e2e-spec.ts` | 待执行 |
| `pnpm check` | 待执行 |

## Browser 验证

| 页面 | 视口 | 预期 | 结果 |
|---|---:|---|---|
| `/oauth/authorize` 缺参数 | 1440 / 768 / 390 | 只复制 request id，无横向溢出 | 待执行 |
| `/api/auth/feishu/callback` 缺 code | 1440 / 768 / 390 | 只复制 request id，无横向溢出 | 待执行 |
| `/admin/applications` | 390 | 应用卡片可读，app_key 不逐字竖排 | 待执行 |
| `/admin/permissions` | 390 | 角色卡片可读，Tab/详情入口可达 | 待执行 |
| `/admin/system/admins` | 390 | 管理员卡片可读，操作可达 | 待执行 |
| `/admin/system/audit` | 390 | Tabs 不撑破视口 | 待执行 |
```

## Task 6: 全量验证

**Files:**
- No direct source edits unless validation finds failures.

- [ ] **Step 1: 运行目标测试**

Run:

```bash
pnpm --filter @feishu-iam/admin-web test -- \
  src/components/admin/DataTable.test.tsx \
  src/components/admin/ResponsiveTabsList.test.tsx \
  src/features/applications/ApplicationManagementView.test.tsx \
  src/features/permissions/PermissionManagementView.test.tsx \
  src/features/admin-users/AdminAuthorizationView.test.tsx \
  src/features/records/RecordQueryView.test.tsx
pnpm --filter @feishu-iam/api test -- test/oauth.controller.e2e-spec.ts
```

Expected: PASS。

- [ ] **Step 2: 运行项目检查**

Run:

```bash
pnpm check
```

Expected: PASS。

- [ ] **Step 3: Browser 自检**

Start local app:

```bash
pnpm dev
```

Open `http://localhost:3000/` with Browser and verify:

- `/oauth/authorize` 缺参数，1440/768/390，无 `复制问题信息`，无横向溢出。
- `/api/auth/feishu/callback` 缺 code，1440/768/390，无 `复制问题信息`，无横向溢出。
- 登录后台后的应用管理、权限管理、管理员授权、操作审计 390px 资源列表可读。
- 操作审计、应用详情、角色详情 Tabs 在 390px 下不撑破视口。
- Console 无新增 error，Network 无非预期失败。

## Completion Definition

- `IMPLEMENTATION_PLAN.md` 和 `docs/superpowers/plans/2026-06-13-feishu-iam-v1.0.2-uiux-p0.md` 已存在且内容一致。
- Product Design 和 Pencil 降级记录已保存在 `design/`。
- `DataTable` 移动端卡片 API 有测试。
- P0 页面已接入移动端卡片或响应式 Tabs。
- OAuth HTML 错误页只复制 request id。
- README 和验收记录更新。
- 运行并记录目标测试、`pnpm check`、Browser 自检。
- 会话归档更新。

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| Eng Review | `/plan-eng-review` | Architecture & tests | 1 | CLEAR | 3 architecture findings, 12 test gaps converted to implementation tasks |
| Design Review | `/plan-design-review` | UI/UX gaps | 1 | CLEAR | score 7/10 -> 8/10, 4 decisions |

- **UNRESOLVED:** 0
- **VERDICT:** DESIGN + ENG CLEARED — ready to implement first P0 vertical slice.
