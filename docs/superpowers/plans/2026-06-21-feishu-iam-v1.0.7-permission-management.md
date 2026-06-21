# Feishu IAM v1.0.7 Permission Management IA Convergence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 交付 `v1.0.7` 权限管理信息架构收敛：角色工作台减负，权限管理新增只读权限矩阵，平台管理员创建角色入口可解释可使用，角色-应用绑定支持软解除并写审计。

**Architecture:** 本版本不扩大权限模型，不新增 DDL。前端复用现有 Admin Shell、React Router、`PageHeader`、`DataTable`、`ResponsiveTabsList`、`OrgUserSelector` 和 shadcn/ui Dialog/Sheet 模式；后端复用现有 NestJS Admin 模块、Prisma 模型、`IamRoleService` 审计模式，并新增一个只读 `AdminPermissionMatrixService` 返回按应用分组的来源解释。

**Tech Stack:** NestJS、Prisma、PostgreSQL、React 19、Vite 6、React Router 7、shadcn/ui + tweakcn + Tailwind、Vitest、Testing Library、Playwright、Docker Compose。

---

## 版本号和 my-harness 位置

本次迭代版本号锁定为 `v1.0.7`。

版本号落点在最后验证任务统一更新：

- `package.json`
- `apps/api/package.json`
- `apps/admin-web/package.json`
- `CHANGELOG.md`
- `README.md`
- API `/version` 运行时仍由部署 env 注入 `APP_VERSION` / `GIT_COMMIT`，本地 package version 用于 release 叙事。

当前 my-harness 步骤：

- Step 1-5 已完成：PRD、Product Design planning review、视觉方向、选定视觉目标评审、工程评审。
- Step 6 当前执行：`Superpowers writing-plans`，本文即实施计划。
- Step 7 下一步：使用 `superpowers:executing-plans` 先实现第一个可运行切片。

## 已确认工程决策

| 决策 | 选择 | 含义 |
|---|---|---|
| D1 | 左侧二级导航 | `权限管理` 展开为 `角色授权` 和 `权限矩阵`；`/admin/permissions` 保持兼容。 |
| D2 | `iam_role_applications.status` | 角色-应用移除使用现有 `active/disabled` 软解除，不新增 DDL，不硬删除。 |
| D3 | 新增只读矩阵服务 | 权限矩阵由服务端按应用分组返回来源解释，前端不逐应用 fan-out 拼结果。 |

## Source Inputs

- `AGENTS.md`
- `DESIGN.md`
- `docs/superpowers/specs/2026-06-21-feishu-iam-v1.0.7-permission-management-prd.md`
- `docs/design-audits/2026-06-21-permission-management-next-prd/step2-product-design-planning-review.md`
- `design/product-design-v1.0.7-permission-management/visual-directions.md`
- `design/product-design-v1.0.7-permission-management/selected-visual-target-review.md`
- `docs/superpowers/reviews/2026-06-21-feishu-iam-v1.0.7-permission-management-plan-eng-review.md`

## File Structure

### Admin Web Routing

- Modify: `apps/admin-web/src/routes/admin-routes.ts`
  - Add `permissionsRoleAuth` and `permissionsMatrix` route ids.
  - Add `permissionRoutes` children under parent `permissions`.
  - Keep `routePath("permissions") === "/admin/permissions"` for compatibility.
- Modify: `apps/admin-web/src/routes/admin-url-state.test.ts`
  - Lock route id list, child route list, `routePath("permissionsMatrix")`, and active matching for matrix and old role detail deep links.
- Modify: `apps/admin-web/src/App.tsx`
  - Add `/admin/permissions/matrix`.
  - Keep `/admin/permissions`, `/admin/permissions/roles/:roleId`, `/admin/permissions/:appKey/roles/:roleId`.
- Create: `apps/admin-web/src/routes/PermissionMatrixPage.tsx`
  - Thin route wrapper that renders `PermissionMatrixView`.

### Admin Web Permissions API

- Modify: `apps/admin-web/src/api/permission.ts`
  - Add `setIamRoleApplicationBindingStatus(appKey, roleId, status)`.
  - Keep `bindIamRoleApplication()` as POST compatibility wrapper or call the new status helper with `active`.
  - Add `fetchPermissionMatrix({ subjectType, subjectId })` and response types.
- Test: `apps/admin-web/src/api/permission.test.ts`
  - Assert PATCH binding endpoint and matrix query URL/normalization.

### Admin Web Role Authorization

- Modify: `apps/admin-web/src/features/permissions/PermissionManagementView.tsx`
  - Keep role authorization list at `/admin/permissions`.
  - Update title/breadcrumb to `权限管理 / 角色授权`.
  - Platform admin can open create dialog even when `search.appKey` is empty.
- Modify: `apps/admin-web/src/features/permissions/PermissionRoleCreateDialog.tsx`
  - Accept `applications`, `defaultAppKey`, and `requireApplicationSelect`.
  - Validate app selection before submit.
- Test: `apps/admin-web/src/features/permissions/PermissionManagementView.test.tsx`
  - Cover platform admin create from all-app view.
  - Preserve app admin disabled behavior.

### Admin Web Role Workbench

- Modify: `apps/admin-web/src/features/permissions/PermissionRoleDetailPage.tsx`
  - Pass `onSetApplicationBindingStatus`.
  - Fallback after removing current app.
- Modify: `apps/admin-web/src/features/permissions/PermissionRoleDetailSheet.tsx`
  - Rename page title back to `角色配置工作台`.
  - Keep only tabs `总览`、`组织与用户`、`应用权限`.
  - Move needed base fields into overview.
  - Remove `基础信息` tab, `变更记录` tab, and `PermissionPointComparePanel` from the role workbench.
  - Replace add-app select with `管理角色关联应用` Dialog.
- Create: `apps/admin-web/src/features/permissions/RoleApplicationBindingDialog.tsx`
  - Search bound/unbound apps.
  - Add active binding and disable existing binding.
  - Show change summary and audit warning.
  - 390px single-column layout.
- Test: `apps/admin-web/src/features/permissions/PermissionRoleDetailSheet.test.tsx`
  - Cover reduced tabs, no compare panel, manage app dialog, remove current app callback, empty bound-app state.

### API Role Application Binding

- Modify: `apps/api/src/permission/iam-role.service.ts`
  - Add `setRoleApplicationBindingStatus(appKey, roleId, status, auditContext)`.
  - Preserve `bindRoleToApplication()` by delegating to active status path or sharing helper logic.
  - Write audit with before/after binding status.
- Modify: `apps/api/src/admin/admin-permission.controller.ts`
  - Add `PATCH /api/v1/admin/applications/:appKey/iam-roles/:roleId/application-binding`.
  - Validate body `{ status: "active" | "disabled" }`.
  - Keep existing `POST .../application-binding`.
- Test: `apps/api/test/admin-role-application-binding.e2e-spec.ts`
  - Cover active upsert, disabled soft解除, missing binding disabled 404, platform admin requirement, audit record.

### API Permission Matrix

- Create: `apps/api/src/admin/admin-permission-matrix.service.ts`
  - Validate `subjectType`.
  - User matrix: direct user roles + direct department roles.
  - Department matrix: only roles directly bound to that department.
  - Exclude disabled applications, role applications, roles, permission groups, and permission points.
  - Return grouped applications and source explanation.
- Modify: `apps/api/src/admin/admin-permission.controller.ts`
  - Add `GET /api/v1/admin/applications/permission-matrix` only if path conflict cannot be avoided.
- Prefer create: `apps/api/src/admin/admin-permission-matrix.controller.ts`
  - Route: `GET /api/v1/admin/permission-matrix`.
  - Use `AdminSessionGuard` and `AdminErrorFilter`.
  - Restrict MVP to `platform_admin`.
- Modify: `apps/api/src/admin/admin.module.ts`
  - Register controller/service.
- Test: `apps/api/test/admin-permission-matrix.e2e-spec.ts`
  - Cover user direct, user department inherited, department direct only, disabled exclusions, forbidden, no sensitive fields.

### Admin Web Permission Matrix

- Create: `apps/admin-web/src/features/permissions/PermissionMatrixView.tsx`
  - PageHeader: `权限矩阵`.
  - Subject type toggle: user / organization.
  - Reuse `OrgUserSelector` or existing Feishu user/department candidate APIs.
  - Show scope note.
  - Render applications as accordion/cards.
  - Desktop explanation panel for selected permission point; mobile bottom sheet.
  - States: initial, loading, empty, error with request id, forbidden.
- Test: `apps/admin-web/src/features/permissions/PermissionMatrixView.test.tsx`
  - Cover user result, department result, empty, error, forbidden, selected point explanation.

### Release and Evidence

- Modify: `package.json`
- Modify: `apps/api/package.json`
- Modify: `apps/admin-web/package.json`
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Modify: `.my-harness/status.md`
- Create or modify: `.my-harness/runs/2026-06-21-v1.0.7-permission-management.md`
- Create: `docs/codex-sessions/YYYY-MM-DD-HHMM-v1.0.7-permission-management-implementation.md`

## Task 1: Permission IA Route Skeleton

**Files:**
- Modify: `apps/admin-web/src/routes/admin-routes.ts`
- Modify: `apps/admin-web/src/routes/admin-url-state.test.ts`
- Modify: `apps/admin-web/src/App.tsx`
- Create: `apps/admin-web/src/routes/PermissionMatrixPage.tsx`
- Create: `apps/admin-web/src/features/permissions/PermissionMatrixView.tsx`

- [x] **Step 1: Write the failing route tests**

Add these assertions to `apps/admin-web/src/routes/admin-url-state.test.ts` under `describe('admin routes', ...)`:

```ts
expect(adminRoutes.find((route) => route.id === 'permissions')?.children?.map((route) => route.id)).toEqual([
  'permissionsRoleAuth',
  'permissionsMatrix'
]);
expect(routePath('permissions')).toBe('/admin/permissions');
expect(routePath('permissionsRoleAuth')).toBe('/admin/permissions');
expect(routePath('permissionsMatrix')).toBe('/admin/permissions/matrix');
expect(getActiveAdminRoute('/admin/permissions')).toBe('permissionsRoleAuth');
expect(getActiveAdminRoute('/admin/permissions/matrix')).toBe('permissionsMatrix');
expect(getActiveAdminRoute('/admin/permissions/roles/role-1')).toBe('permissionsRoleAuth');
expect(getActiveAdminRoute('/admin/permissions/crm/roles/role-1')).toBe('permissionsRoleAuth');
```

- [x] **Step 2: Run route tests and verify they fail**

Run:

```bash
pnpm --filter @feishu-iam/admin-web test -- src/routes/admin-url-state.test.ts
```

Expected: fail because `permissionsRoleAuth`, `permissionsMatrix`, and `getActiveAdminRoute` import/update do not exist yet.

- [x] **Step 3: Update admin route types and route tree**

In `apps/admin-web/src/routes/admin-routes.ts`, add the ids:

```ts
export type AdminRouteId =
  | "workspace"
  | "applications"
  | "permissions"
  | "permissionsRoleAuth"
  | "permissionsMatrix"
  | "system"
  | "systemFeishu"
  | "systemAdmins"
  | "systemAudit"
  | "systemInfo";
```

Add:

```ts
export const permissionRoutes: AdminRoute[] = [
  { id: "permissionsRoleAuth", path: "/admin/permissions", label: "角色授权", iconKey: "permissions" },
  { id: "permissionsMatrix", path: "/admin/permissions/matrix", label: "权限矩阵", iconKey: "permissions" },
];
```

Change the `permissions` route:

```ts
{
  id: "permissions",
  path: "/admin/permissions",
  label: "权限管理",
  iconKey: "permissions",
  children: permissionRoutes,
},
```

- [x] **Step 4: Create the matrix route wrapper and temporary page**

Create `apps/admin-web/src/routes/PermissionMatrixPage.tsx`:

```tsx
import type { AdminMe } from "../admin-types";
import { PermissionMatrixView } from "../features/permissions/PermissionMatrixView";

export function PermissionMatrixPage(props: { admin: AdminMe }) {
  return <PermissionMatrixView admin={props.admin} />;
}
```

Create `apps/admin-web/src/features/permissions/PermissionMatrixView.tsx`:

```tsx
import type { AdminMe } from "../../admin-types";
import { PageHeader } from "../../components/admin/PageHeader";
import { PageState } from "../../components/admin/PageState";

export function PermissionMatrixView({ admin }: { admin: AdminMe }) {
  const canQuery = admin.roles.includes("platform_admin");

  return (
    <main className="flex min-h-full flex-col bg-muted/20" role="region" aria-label="权限矩阵">
      <PageHeader
        breadcrumbs={[
          { label: "后台", href: "/admin/workspace" },
          { label: "权限管理", href: "/admin/permissions" },
          { label: "权限矩阵", current: true },
        ]}
        description="按用户或组织查询最终权限和来源解释。权限矩阵只读，不在此编辑角色、权限组或权限点。"
        title="权限矩阵"
      />
      <section className="flex flex-1 flex-col gap-4 p-6">
        {canQuery ? (
          <PageState
            description="请选择用户或组织后查询最终权限。组织查询首版只统计直接绑定该组织的角色。"
            title="选择查询主体"
            type="empty"
          />
        ) : (
          <PageState
            description="当前管理员无权查询权限矩阵。"
            title="没有权限"
            type="forbidden"
          />
        )}
      </section>
    </main>
  );
}
```

- [x] **Step 5: Wire App route**

In `apps/admin-web/src/App.tsx`, import the wrapper:

```ts
import { PermissionMatrixPage } from "./routes/PermissionMatrixPage";
```

Add the route before role detail routes:

```tsx
<Route
  path="/admin/permissions/matrix"
  element={<PermissionMatrixPage admin={adminState.admin} />}
/>
```

- [x] **Step 6: Run route tests and build check**

Run:

```bash
pnpm --filter @feishu-iam/admin-web test -- src/routes/admin-url-state.test.ts
pnpm --filter @feishu-iam/admin-web typecheck
```

Expected: both pass.

## Task 2: Role Application Binding Status API

**Files:**
- Modify: `apps/api/src/permission/iam-role.service.ts`
- Modify: `apps/api/src/admin/admin-permission.controller.ts`
- Modify: `apps/admin-web/src/api/permission.ts`
- Test: `apps/api/test/admin-role-application-binding.e2e-spec.ts`
- Test: `apps/admin-web/src/api/permission.test.ts`

- [x] **Step 1: Write API client tests first**

In `apps/admin-web/src/api/permission.test.ts`, add a fetch mock assertion:

```ts
it("patches IAM role application binding status", async () => {
  const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
    new Response(JSON.stringify({
      id: "role-1",
      app_key: "crm",
      key: "crm.operator",
      name: "CRM 操作员",
      status: "active",
      createdAt: "2026-06-21T00:00:00.000Z",
      updatedAt: "2026-06-21T00:00:00.000Z"
    }), { status: 200, headers: { "Content-Type": "application/json" } }),
  );

  const { setIamRoleApplicationBindingStatus } = await import("./permission");
  await setIamRoleApplicationBindingStatus("crm", "role-1", "disabled");

  expect(fetchMock).toHaveBeenCalledWith(
    "/api/v1/admin/applications/crm/iam-roles/role-1/application-binding",
    expect.objectContaining({
      method: "PATCH",
      body: JSON.stringify({ status: "disabled" }),
    }),
  );
});
```

- [x] **Step 2: Run API client test and verify it fails**

Run:

```bash
pnpm --filter @feishu-iam/admin-web test -- src/api/permission.test.ts
```

Expected: fail because `setIamRoleApplicationBindingStatus` is missing.

- [x] **Step 3: Implement the frontend API helper**

In `apps/admin-web/src/api/permission.ts`, add:

```ts
export async function setIamRoleApplicationBindingStatus(
  appKey: string,
  roleId: string,
  status: EntityStatus,
): Promise<IamRole> {
  const role = await readJson<RawIamRole>(
    `/api/v1/admin/applications/${encodeURIComponent(appKey)}/iam-roles/${encodeURIComponent(roleId)}/application-binding`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    },
  );
  return normalizeIamRole(role, appKey);
}
```

Keep `bindIamRoleApplication()` unchanged for backward compatibility.

- [x] **Step 4: Add backend body parser and route**

In `apps/api/src/admin/admin-permission.controller.ts`, add:

```ts
type ApplicationBindingBody = {
  status: EntityStatus;
};

function readApplicationBindingBody(body: unknown): ApplicationBindingBody {
  if (!isRecord(body)) {
    throw new PermissionDomainError("IAM_ROLE_APPLICATION_BINDING_BODY_INVALID", "角色应用绑定请求体不合法", 400);
  }
  const status = typeof body.status === "string" ? body.status : "";
  if (status !== "active" && status !== "disabled") {
    throw new PermissionDomainError("IAM_ROLE_APPLICATION_BINDING_BODY_INVALID", "角色应用绑定状态不合法", 400);
  }
  return { status };
}
```

Add controller method after existing `bindRoleApplication()`:

```ts
@Patch("/:appKey/iam-roles/:roleId/application-binding")
async setRoleApplicationBindingStatus(
  @Param("appKey") appKey: string,
  @Param("roleId") roleId: string,
  @Body() body: unknown,
  @Req() request: Request,
): Promise<IamRoleMutationResponse> {
  const { context } = await this.assertCanManageApplication(appKey, request);
  this.permission.assertCanManageGlobalIamRoles(context);
  const role = await this.iamRoles.setRoleApplicationBindingStatus(
    appKey,
    roleId,
    readApplicationBindingBody(body).status,
    buildPermissionAuditContext(request, context),
  );
  return serializeRoleMutation(role, appKey);
}
```

- [x] **Step 5: Implement service method**

In `apps/api/src/permission/iam-role.service.ts`, add:

```ts
async setRoleApplicationBindingStatus(
  appKey: string,
  roleId: string,
  status: EntityStatus,
  auditContext?: PermissionAuditContext
): Promise<IamRole> {
  return this.prisma.$transaction(async (tx) => {
    const application = await this.applications.getApplicationByKey(appKey, tx);
    const role = await tx.iamRole.findFirst({ where: { id: roleId } });

    if (!role) {
      throw new PermissionDomainError("IAM_ROLE_NOT_FOUND", "IAM 角色不存在", 404);
    }

    const currentBinding = await tx.iamRoleApplication.findUnique({
      where: {
        iamRoleId_applicationId: {
          iamRoleId: roleId,
          applicationId: application.id,
        },
      },
    });

    if (!currentBinding && status === "disabled") {
      throw new PermissionDomainError("IAM_ROLE_APPLICATION_BINDING_NOT_FOUND", "角色未绑定该应用", 404);
    }

    await tx.iamRoleApplication.upsert({
      where: {
        iamRoleId_applicationId: {
          iamRoleId: roleId,
          applicationId: application.id,
        },
      },
      create: {
        iamRoleId: roleId,
        applicationId: application.id,
        status,
      },
      update: {
        status,
      },
    });

    await this.recordAudit(
      application.id,
      roleId,
      "set_application_binding_status",
      {
        applicationId: application.id,
        bindingStatus: currentBinding?.status ?? null,
      },
      {
        applicationId: application.id,
        bindingStatus: status,
      },
      tx,
      auditContext
    );

    return role;
  });
}
```

Then change `bindRoleToApplication()` to call this method with `active` only if doing so does not double-record audit. If sharing the method would duplicate audit, leave `bindRoleToApplication()` as-is.

- [x] **Step 6: Add backend tests**

Create `apps/api/test/admin-role-application-binding.e2e-spec.ts` following existing admin test setup patterns. Cover:

```ts
it("soft disables an existing role application binding and writes audit", async () => {
  // seed platform admin session, application crm, role role-1, iam_role_applications active
  // PATCH /api/v1/admin/applications/crm/iam-roles/role-1/application-binding { status: "disabled" }
  // expect 200
  // expect iam_role_applications.status to be "disabled"
  // expect audit_logs action to be "set_application_binding_status"
});

it("rejects disabling a missing role application binding", async () => {
  // seed role without binding to crm
  // PATCH disabled
  // expect 404 with code IAM_ROLE_APPLICATION_BINDING_NOT_FOUND
});
```

- [x] **Step 7: Run binding tests**

Run:

```bash
pnpm --filter @feishu-iam/admin-web test -- src/api/permission.test.ts
pnpm --filter @feishu-iam/api test -- test/admin-role-application-binding.e2e-spec.ts
pnpm --filter @feishu-iam/api typecheck
```

Expected: all pass.

## Task 3: Create Role From All-Applications View

**Files:**
- Modify: `apps/admin-web/src/features/permissions/PermissionManagementView.tsx`
- Modify: `apps/admin-web/src/features/permissions/PermissionRoleCreateDialog.tsx`
- Test: `apps/admin-web/src/features/permissions/PermissionManagementView.test.tsx`

- [x] **Step 1: Add failing create-role behavior test**

In `PermissionManagementView.test.tsx`, add:

```tsx
it("lets platform admins create a role from the all-applications view after selecting an application", async () => {
  const user = userEvent.setup();
  window.history.pushState({}, "", "/admin/permissions");
  renderView();

  await screen.findByText("CRM 操作员");
  await user.click(screen.getByRole("button", { name: "创建角色" }));

  const dialog = await screen.findByRole("dialog", { name: "创建 IAM 角色" });
  expect(within(dialog).getByLabelText("所属应用")).toBeInTheDocument();

  await user.selectOptions(within(dialog).getByLabelText("所属应用"), "crm");
  await user.type(within(dialog).getByLabelText("角色 key"), "crm.auditor");
  await user.type(within(dialog).getByLabelText("角色名称"), "CRM 审计员");
  await user.click(within(dialog).getByRole("button", { name: "创建" }));

  await waitFor(() => {
    expect(createIamRole).toHaveBeenCalledWith("crm", expect.objectContaining({
      key: "crm.auditor",
      name: "CRM 审计员",
    }));
  });
});
```

- [x] **Step 2: Run test and verify it fails**

Run:

```bash
pnpm --filter @feishu-iam/admin-web test -- src/features/permissions/PermissionManagementView.test.tsx
```

Expected: fail because create button is disabled without `search.appKey` or dialog lacks app selector.

- [x] **Step 3: Enable platform admin create button**

In `PermissionManagementView.tsx`, change:

```tsx
disabled={!search.appKey || !canManageGlobalRoles}
```

to:

```tsx
disabled={!canManageGlobalRoles}
```

Change title branch to:

```tsx
title={!canManageGlobalRoles ? "只有平台管理员可以创建角色" : "创建角色"}
```

- [x] **Step 4: Add app selection props to create dialog**

Update `PermissionRoleCreateDialog.tsx` props:

```ts
type PermissionRoleCreateDialogProps = {
  appKey?: string;
  applications: Application[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (role: IamRole, appKey: string) => void;
};
```

Inside the dialog, track:

```ts
const [selectedAppKey, setSelectedAppKey] = useState(props.appKey ?? "");
```

Render select when `!props.appKey`:

```tsx
<label className="grid gap-1.5 text-sm font-medium">
  <span>所属应用</span>
  <select
    aria-label="所属应用"
    className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
    value={selectedAppKey}
    onChange={(event) => { setSelectedAppKey(event.target.value); }}
  >
    <option value="">请选择应用</option>
    {props.applications.map((application) => (
      <option key={application.appKey} value={application.appKey}>
        {application.name} / {application.appKey}
      </option>
    ))}
  </select>
</label>
```

Before submit:

```ts
const targetAppKey = props.appKey ?? selectedAppKey;
if (!targetAppKey) {
  setErrors((current) => ({ ...current, appKey: "请选择所属应用" }));
  return;
}
const created = await createIamRole(targetAppKey, draft);
props.onCreated(created, targetAppKey);
```

- [x] **Step 5: Wire dialog from management view**

Pass `applications` and optional `search.appKey`:

```tsx
<PermissionRoleCreateDialog
  appKey={search.appKey}
  applications={applications}
  open={createOpen}
  onCreated={(role, appKey) => {
    setCreateOpen(false);
    setSearch((current) => ({ ...current, appKey }));
    void reloadPermissions(appKey);
  }}
  onOpenChange={setCreateOpen}
/>
```

- [x] **Step 6: Run focused tests**

Run:

```bash
pnpm --filter @feishu-iam/admin-web test -- src/features/permissions/PermissionManagementView.test.tsx
pnpm --filter @feishu-iam/admin-web typecheck
```

Expected: pass.

## Task 4: Role Workbench Slimdown and Manage Applications Dialog

**Files:**
- Modify: `apps/admin-web/src/features/permissions/PermissionRoleDetailPage.tsx`
- Modify: `apps/admin-web/src/features/permissions/PermissionRoleDetailSheet.tsx`
- Create: `apps/admin-web/src/features/permissions/RoleApplicationBindingDialog.tsx`
- Test: `apps/admin-web/src/features/permissions/PermissionRoleDetailSheet.test.tsx`

- [x] **Step 1: Add failing workbench tests**

In `PermissionRoleDetailSheet.test.tsx`, add:

```tsx
it("shows the reduced role workbench tabs without base, audit, or permission comparison", () => {
  renderSheet();

  expect(screen.getByRole("tab", { name: "总览" })).toBeInTheDocument();
  expect(screen.getByRole("tab", { name: "组织与用户" })).toBeInTheDocument();
  expect(screen.getByRole("tab", { name: "应用权限" })).toBeInTheDocument();
  expect(screen.queryByRole("tab", { name: "基础信息" })).not.toBeInTheDocument();
  expect(screen.queryByRole("tab", { name: "变更记录" })).not.toBeInTheDocument();
  expect(screen.queryByLabelText("权限点对比")).not.toBeInTheDocument();
});

it("opens the manage role applications dialog from application permissions", async () => {
  const user = userEvent.setup();
  renderSheet({ activeTab: "groups" });

  await user.click(screen.getByRole("button", { name: "管理应用" }));
  expect(await screen.findByRole("dialog", { name: "管理角色关联应用" })).toBeInTheDocument();
});
```

- [x] **Step 2: Run tests and verify they fail**

Run:

```bash
pnpm --filter @feishu-iam/admin-web test -- src/features/permissions/PermissionRoleDetailSheet.test.tsx
```

Expected: fail because base/audit tabs and compare panel still exist, and dialog is missing.

- [x] **Step 3: Remove redundant tabs and title**

In `PermissionRoleDetailSheet.tsx`:

- Change page title expression to always use `角色配置工作台`.
- Remove `<TabsTrigger value="base">基础信息</TabsTrigger>`.
- Remove `<TabsTrigger value="audit">变更记录</TabsTrigger>`.
- Remove corresponding `<TabsContent value="base">` and `<TabsContent value="audit">`.
- Keep legacy URL behavior by mapping incoming `activeTab === "base"` or `"audit"` to `"overview"` in the state initializer.

- [x] **Step 4: Remove permission comparison panel**

Delete this render from the application permissions preview:

```tsx
<PermissionPointComparePanel
  permissionGroups={props.permissionGroups}
  selectedGroupIds={props.selectedGroupIds}
/>
```

Keep `EffectivePermissionPointList` as the final permission point summary.

- [x] **Step 5: Create application binding dialog**

Create `RoleApplicationBindingDialog.tsx` with these props:

```ts
type RoleApplicationBindingDialogProps = {
  applications: Application[];
  currentAppKey?: string;
  open: boolean;
  pending?: boolean;
  role: IamRole;
  onOpenChange: (open: boolean) => void;
  onSetBindingStatus: (appKey: string, status: EntityStatus) => Promise<void>;
};
```

The dialog body must render:

- Search input labelled `搜索应用`.
- Bound list where `role.applications?.filter((item) => item.bindingStatus === "active")`.
- Available list where application is not active-bound.
- `移除` button calls `onSetBindingStatus(appKey, "disabled")`.
- `添加` button calls `onSetBindingStatus(appKey, "active")`.
- Alert text: `移除应用会停用当前角色与该应用的绑定，并写入操作审计。`

- [x] **Step 6: Replace add-app select with dialog trigger**

In `GroupsTab`, remove the select/button block for `添加应用`. Add:

```tsx
<Button
  disabled={!props.canBindApplications}
  size="sm"
  type="button"
  variant="outline"
  onClick={() => { setApplicationDialogOpen(true); }}
>
  管理应用
</Button>
```

Render `RoleApplicationBindingDialog` in the same component or parent, with `onSetBindingStatus`.

- [x] **Step 7: Add fallback callback in detail page**

In `PermissionRoleDetailPage.tsx`, import `setIamRoleApplicationBindingStatus` and pass:

```tsx
onSetApplicationBindingStatus={async (nextAppKey, status) => {
  await setIamRoleApplicationBindingStatus(nextAppKey, state.role.id, status);
  setReloadKey((current) => current + 1);
  if (status === "disabled" && nextAppKey === state.application.appKey) {
    const fallback = state.role.applications?.find(
      (application) => application.appKey !== nextAppKey && application.bindingStatus === "active",
    );
    if (fallback) {
      const next = new URLSearchParams(searchParams);
      next.set("appKey", fallback.appKey);
      next.set("tab", "permissions");
      void navigate({ search: `?${next.toString()}` }, { replace: false });
    }
  }
}}
```

After reload, if no active application remains, `GroupsTab` must show `当前角色暂无已绑定应用。` and a `管理应用` button.

- [x] **Step 8: Run focused tests**

Run:

```bash
pnpm --filter @feishu-iam/admin-web test -- src/features/permissions/PermissionRoleDetailSheet.test.tsx
pnpm --filter @feishu-iam/admin-web typecheck
```

Expected: pass.

## Task 5: Permission Matrix API

**Files:**
- Create: `apps/api/src/admin/admin-permission-matrix.service.ts`
- Create: `apps/api/src/admin/admin-permission-matrix.controller.ts`
- Modify: `apps/api/src/admin/admin.module.ts`
- Test: `apps/api/test/admin-permission-matrix.e2e-spec.ts`

- [x] **Step 1: Write matrix API tests**

Create `apps/api/test/admin-permission-matrix.e2e-spec.ts` with cases:

```ts
it("returns user direct and department-inherited permissions grouped by application", async () => {
  // seed active app, active role application, active role, user subject, department subject,
  // active permission group, active permission point, and user department membership.
  // GET /api/v1/admin/permission-matrix?subjectType=user&subjectId=user-1
  // expect one application
  // expect permission_points[0].source_roles includes both direct and department matched roles when applicable
  // expect scope_note to include 用户查询包含直接用户绑定和用户所属组织绑定
});

it("returns department matrix with direct department roles only", async () => {
  // seed department subject role and a user-only role in the same department
  // GET subjectType=department&subjectId=dept-1
  // expect department subject role included
  // expect user-only role excluded
  // expect scope_note to include 不展开组织下用户
});

it("excludes disabled applications, role bindings, roles, groups, and points", async () => {
  // seed disabled variants and assert response applications is []
});

it("does not expose sensitive fields", async () => {
  // assert JSON string does not include secret, token, cookie, authorization, raw_payload, state_hash
});
```

- [x] **Step 2: Run tests and verify they fail**

Run:

```bash
pnpm --filter @feishu-iam/api test -- test/admin-permission-matrix.e2e-spec.ts
```

Expected: fail because controller/service are missing.

- [x] **Step 3: Create service response types**

In `admin-permission-matrix.service.ts`, define:

```ts
export type PermissionMatrixSubjectType = "user" | "department";

export type PermissionMatrixResult = {
  subject: {
    type: PermissionMatrixSubjectType;
    id: string;
    name: string;
  };
  scope_note: string;
  applications: Array<{
    app_key: string;
    name: string;
    matched_roles: Array<{ key: string; name: string; match_type: "direct_user" | "user_department" | "direct_department" }>;
    permission_groups: Array<{ key: string; name: string; source_roles: string[] }>;
    permission_points: Array<{ key: string; name: string; source_roles: string[]; source_groups: string[]; status: "active" }>;
    computed_at: string;
  }>;
  computed_at: string;
};
```

- [x] **Step 4: Implement user and department query**

Use one Prisma `iamRole.findMany()` query with:

```ts
where: {
  status: "active",
  applications: {
    some: {
      status: "active",
      application: { status: "active" },
    },
  },
  subjects: {
    some: {
      isOrphaned: false,
      OR: subjectType === "user"
        ? [
            { subjectType: "feishu_user", subjectId },
            { subjectType: "feishu_department", subjectId: { in: departmentIds } },
          ]
        : [
            { subjectType: "feishu_department", subjectId },
          ],
    },
  },
}
```

Include applications, subjects, permissionGroups.permissionGroup.permissionPoints.permissionPoint, and permissionPoints.permissionPoint.

Build maps by `appKey`, then by group key and point key. Exclude inactive groups and points while building result.

- [x] **Step 5: Create controller**

Create `admin-permission-matrix.controller.ts`:

```ts
@Controller("/api/v1/admin/permission-matrix")
@UseGuards(AdminSessionGuard)
@UseFilters(AdminErrorFilter, PermissionErrorFilter)
export class AdminPermissionMatrixController {
  constructor(
    private readonly matrix: AdminPermissionMatrixService,
    private readonly permission: AdminPermissionService,
  ) {}

  @Get()
  async query(@Query("subjectType") subjectType: string, @Query("subjectId") subjectId: string, @Req() request: Request) {
    const context = readAdminContext(request);
    this.permission.assertCanManageGlobalIamRoles(context);
    return this.matrix.query(readSubjectType(subjectType), readSubjectId(subjectId));
  }
}
```

Use helper `readSubjectType()` to accept `user` and `department`; invalid input throws `PermissionDomainError("PERMISSION_MATRIX_QUERY_INVALID", "权限矩阵查询参数不合法", 400)`.

- [x] **Step 6: Register in admin module**

In `apps/api/src/admin/admin.module.ts`, add controller and provider:

```ts
import { AdminPermissionMatrixController } from './admin-permission-matrix.controller';
import { AdminPermissionMatrixService } from './admin-permission-matrix.service';
```

Add to `controllers` and `providers`.

- [x] **Step 7: Run matrix API tests**

Run:

```bash
pnpm --filter @feishu-iam/api test -- test/admin-permission-matrix.e2e-spec.ts
pnpm --filter @feishu-iam/api typecheck
```

Expected: pass.

## Task 6: Permission Matrix UI

**Files:**
- Modify: `apps/admin-web/src/api/permission.ts`
- Modify: `apps/admin-web/src/features/permissions/PermissionMatrixView.tsx`
- Test: `apps/admin-web/src/features/permissions/PermissionMatrixView.test.tsx`

- [x] **Step 1: Add frontend matrix API types**

In `apps/admin-web/src/api/permission.ts`, add:

```ts
export type PermissionMatrixSubjectType = "user" | "department";

export type PermissionMatrixResult = {
  subject: { type: PermissionMatrixSubjectType; id: string; name: string };
  scope_note: string;
  applications: Array<{
    app_key: string;
    name: string;
    matched_roles: Array<{ key: string; name: string; match_type: string }>;
    permission_groups: Array<{ key: string; name: string; source_roles: string[] }>;
    permission_points: Array<{ key: string; name: string; source_roles: string[]; source_groups: string[]; status: "active" }>;
    computed_at: string;
  }>;
  computed_at: string;
};

export async function fetchPermissionMatrix(input: {
  subjectType: PermissionMatrixSubjectType;
  subjectId: string;
}): Promise<PermissionMatrixResult> {
  const params = new URLSearchParams({
    subjectType: input.subjectType,
    subjectId: input.subjectId,
  });
  return readJson<PermissionMatrixResult>(`/api/v1/admin/permission-matrix?${params.toString()}`);
}
```

- [x] **Step 2: Write matrix UI tests**

Create `PermissionMatrixView.test.tsx`:

```tsx
it("renders user matrix results grouped by application and opens point explanation", async () => {
  vi.mocked(fetchPermissionMatrix).mockResolvedValueOnce(matrixFixture);
  const user = userEvent.setup();
  render(<PermissionMatrixView admin={platformAdmin} />);

  await user.click(screen.getByRole("button", { name: "用户" }));
  await user.type(screen.getByLabelText("主体 ID"), "user-1");
  await user.click(screen.getByRole("button", { name: "查询" }));

  expect(await screen.findByText("基础门户")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: /base-portal.demo.embedded/ }));
  expect(screen.getByRole("region", { name: "权限来源解释" })).toHaveTextContent("source-role");
});

it("shows forbidden state for application admins", () => {
  render(<PermissionMatrixView admin={applicationAdmin} />);
  expect(screen.getByText("没有权限")).toBeInTheDocument();
});
```

- [x] **Step 3: Run tests and verify they fail**

Run:

```bash
pnpm --filter @feishu-iam/admin-web test -- src/features/permissions/PermissionMatrixView.test.tsx
```

Expected: fail because the UI is still placeholder.

- [x] **Step 4: Implement the matrix query UI**

Update `PermissionMatrixView.tsx` to include:

- State:

```ts
const [subjectType, setSubjectType] = useState<PermissionMatrixSubjectType>("user");
const [subjectId, setSubjectId] = useState("");
const [state, setState] = useState<
  | { status: "idle" }
  | { status: "loading" }
  | { status: "loaded"; result: PermissionMatrixResult }
  | { status: "failed"; message: string; forbidden: boolean; requestId?: string }
>({ status: "idle" });
const [selectedPointKey, setSelectedPointKey] = useState<string | null>(null);
```

- Toggle buttons labelled `用户` and `组织`.
- Temporary `Input` labelled `主体 ID` for v1.0.7 MVP if wiring full selector would expand scope; if using `OrgUserSelector` is straightforward, use it instead.
- Query button disabled when `!subjectId.trim()`.
- `PageState` for idle/loading/empty/error/forbidden.
- Application result cards with roles, groups, permission points.
- `权限来源解释` region for selected point.

- [x] **Step 5: Add 390px-safe layout classes**

Use:

```tsx
<section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
```

For app groups:

```tsx
<div className="grid min-w-0 gap-3 rounded-md border bg-background p-4">
  <code className="break-all text-xs text-muted-foreground">{application.app_key}</code>
</div>
```

The explanation panel should be normal stacked content under 1024px and sticky side panel only at `lg`.

- [x] **Step 6: Run matrix UI tests**

Run:

```bash
pnpm --filter @feishu-iam/admin-web test -- src/features/permissions/PermissionMatrixView.test.tsx
pnpm --filter @feishu-iam/admin-web typecheck
```

Expected: pass.

## Task 7: Verification, Docs, Version, Browser Evidence

**Files:**
- Modify: `package.json`
- Modify: `apps/api/package.json`
- Modify: `apps/admin-web/package.json`
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Modify: `.my-harness/status.md`
- Create or modify: `.my-harness/runs/2026-06-21-v1.0.7-permission-management.md`
- Create: `docs/codex-sessions/YYYY-MM-DD-HHMM-v1.0.7-permission-management-implementation.md`

- [x] **Step 1: Run focused tests**

Run:

```bash
pnpm --filter @feishu-iam/admin-web test -- src/routes/admin-url-state.test.ts src/api/permission.test.ts src/features/permissions/PermissionManagementView.test.tsx src/features/permissions/PermissionRoleDetailSheet.test.tsx src/features/permissions/PermissionMatrixView.test.tsx
pnpm --filter @feishu-iam/api test -- test/admin-role-application-binding.e2e-spec.ts test/admin-permission-matrix.e2e-spec.ts
```

Expected: all pass.

- [x] **Step 2: Run full static checks**

Run:

```bash
pnpm --filter @feishu-iam/admin-web typecheck
pnpm --filter @feishu-iam/admin-web lint
pnpm --filter @feishu-iam/admin-web build
pnpm --filter @feishu-iam/api typecheck
pnpm --filter @feishu-iam/api lint
pnpm --filter @feishu-iam/api build
```

Expected: all pass.

- [x] **Step 3: Run repository checks**

Run:

```bash
pnpm check
pnpm --filter @feishu-iam/admin-web build
pnpm --filter @feishu-iam/api build
git diff --check
```

Expected: all pass.

- [x] **Step 4: Run local browser verification**

Start the app if no server is already running:

```bash
pnpm dev
```

Use Browser / Playwright to cover:

- `/admin/permissions`
- platform admin create role from all-applications view
- role workbench overview
- role workbench `组织与用户`
- role workbench `应用权限`
- `管理角色关联应用` Dialog add/remove/error
- `/admin/permissions/matrix` user query
- `/admin/permissions/matrix` department query
- 1440px, 768px, 390px viewports

Actual command:

```bash
ADMIN_WEB_URL=http://localhost:4173 pnpm --filter @feishu-iam/admin-web test:responsive
```

Result: 14 backend admin routes across 390, 768, 1280, and 1440 viewports passed with `failures: []`.

- [x] **Step 5: Update version and release docs**

Set package versions to `1.0.7`.

Append `CHANGELOG.md` entry:

```markdown
## v1.0.7 - 2026-06-21

- 收敛权限管理信息架构：`权限管理` 下新增 `角色授权 / 权限矩阵` 二级入口。
- 精简角色配置工作台，移除重复上下文、`基础信息` tab、`变更记录` tab 和角色内 `权限点对比`。
- 新增 `管理角色关联应用` Dialog，支持添加和软解除角色-应用绑定并写入审计。
- 新增只读权限矩阵，支持按用户或组织查询最终权限和来源解释。
- 修复平台管理员在全部应用视图下 `创建角色` 无解释 disabled 的问题。
```

Update `README.md` version history and docs index with links to PRD, plan, and verification evidence.

- [x] **Step 6: Update my-harness and session archive**

Update `.my-harness/status.md` and `.my-harness/runs/2026-06-21-v1.0.7-permission-management.md` with:

- Completed steps 6-8 when implementation and verification pass.
- Test commands and browser evidence paths.
- Next recommended prompt for Step 9 or Step 10 depending on evidence state.

Create session archive:

```text
docs/codex-sessions/YYYY-MM-DD-HHMM-v1.0.7-permission-management-implementation.md
```

- [x] **Step 7: Prepare for next harness gate**

If Task 1-7 implementation and fresh verification pass, next harness action is Step 9 Browser verification if Browser evidence is not yet complete, otherwise Step 10 Product Design visual QA.

## Self-Review Checklist

- PRD S1 role workbench slimdown: covered by Task 3 and Task 4.
- PRD S2 permission matrix MVP: covered by Task 5 and Task 6.
- D1 route/deep-link compatibility: covered by Task 1.
- D2 soft解除 API and audit: covered by Task 2.
- D3 matrix API/source explanation: covered by Task 5.
- Empty/error/loading/forbidden states: covered by Task 1 placeholder state, Task 6 final state, Task 7 browser verification.
- 390px responsive: covered by Task 4 dialog layout, Task 6 matrix layout, Task 7 browser verification.
- Security and audit: covered by Task 2 and Task 5.
- Release/deploy readiness: covered by Task 7; actual `/ship` and `/land-and-deploy` remain Step 14-15 after QA/review gates.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-21-feishu-iam-v1.0.7-permission-management.md`.

Recommended execution mode for this repository: Inline Execution with `superpowers:executing-plans`, because current worktree already contains multiple uncommitted v1.0.6/v1.0.7 planning artifacts and the first slice should be reviewed carefully before parallelizing.

First runnable slice:

1. Task 1 route skeleton and placeholder matrix page.
2. Task 2 role-application binding status API.
3. Focused tests for both.

Do not start Task 4/6 visual-heavy UI until Task 1/2 API contracts pass.
