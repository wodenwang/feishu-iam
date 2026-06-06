# Feishu IAM v1.0.0 Riversoft UI Refresh and Admin Initialization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 发布 `v1.0.0` 内部正式版收口切片，只完成 Riversoft 正式版后台 UI 翻新和“王文哲”平台管理员初始化，不改变任何业务流程、数据契约、权限逻辑或 CRUD 行为。

**Architecture:** 前端通过 shadcn/ui + tweakcn + Tailwind CSS variables 统一落地 Riversoft token，再由项目级组件吸收视觉升级，页面只做证明性、保守的样式适配。数据初始化通过版本化 SQL 迁移复用现有 `INITIAL_PLATFORM_ADMIN_FEISHU_USER_ID` 部署变量，幂等授予 `platform_admin`，不初始化第三方应用、client、回调地址或业务角色。

**Tech Stack:** React 19、Vite、Tailwind CSS、shadcn/ui、tweakcn CSS variables、Radix UI、lucide-react、Vitest、Playwright、NestJS、PostgreSQL versioned SQL migrations、Docker Compose deploy scripts。

---

## 不可变边界

- 不改变 UX 流程、信息架构、路由、URL 参数、表单流程、字段命名、分页参数、状态枚举、数据契约、CRUD 行为、权限逻辑、审计语义或业务逻辑。
- 不恢复权限管理中的角色元数据管理；角色元数据继续归应用管理。
- 不新增第三方应用权限、demo client、回调地址、业务角色、完整 OIDC、SAML、ABAC、资源级权限或数据范围权限。
- 不展示或提交真实 secret、token、cookie、飞书 `app_secret`、数据库密码、生产导出数据、raw payload、authorization、授权码、token hash、state hash 或 `sk-` 形态内容。
- 不撤销现有管理员；v1.0.0 初始化只确保 `INITIAL_PLATFORM_ADMIN_FEISHU_USER_ID` 指向的“王文哲”具备 `platform_admin`。
- Pencil 原型只作为流程、状态和视觉方向参考，不做像素级还原。

## 文件结构

- Modify `IMPLEMENTATION_PLAN.md`：本计划文件，执行期间持续勾选。
- Modify `apps/admin-web/src/index.css`：集中替换 Riversoft CSS variables，新增语义状态 token，保持 Tailwind/shadcn 变量接口。
- Modify `apps/admin-web/src/theme.ts`：把旧硬编码品牌色替换为 Riversoft token 常量，供少量非 Tailwind 场景复用。
- Modify `apps/admin-web/src/components/admin/AppShell.tsx`：只调整 Sidebar、移动 Sheet、header、focus/active/hover 视觉，不改导航树和路由。
- Modify `apps/admin-web/src/components/admin/DataTable.tsx`：统一表格容器、表头、行 hover、加载/空/错状态承载和横向滚动。
- Modify `apps/admin-web/src/components/admin/StatusBadge.tsx`：集中定义 success/warning/danger/info/muted 语义 tone，消除页面级颜色散落。
- Modify `apps/admin-web/src/components/admin/PageState.tsx`：统一空、错、加载、禁用/无权限状态矩阵，保持中文说明和稳定高度。
- Modify `apps/admin-web/src/components/admin/FormDialog.tsx`：统一表单错误、提交中、滚动边界和 focus ring。
- Modify `apps/admin-web/src/components/admin/DetailSheet.tsx`：统一 page/sheet 展示质感、触控目标、宽度切换按钮和响应式边界。
- Modify `apps/admin-web/src/components/admin/ConfirmDialog.tsx`：统一危险确认、提交中和不可重复提交表现。
- Modify `apps/admin-web/src/components/admin/ProblemFeedbackPage.tsx`：主旅程保持复制 request id 与跳转追踪页，联系管理员只作为次级说明。
- Modify `apps/admin-web/src/features/records/TraceResultPanel.tsx`：追踪页 warning/empty/error/loading 状态改用共享语义样式，不暴露敏感字段。
- Modify `apps/admin-web/src/features/applications/ApplicationManagementView.tsx`：第一个证明页面之一，消除局部硬编码状态色，保留列表字段、筛选、分页和详情入口。
- Modify `apps/admin-web/src/features/applications/ApplicationDetailPage.tsx` and `apps/admin-web/src/features/applications/ApplicationDetailSheet.tsx`：第一个证明页面之一，凭证区只展示凭证状态、最近轮换和“创建或轮换后仅展示一次”的安全表达。
- Modify `apps/admin-web/src/features/permissions/PermissionRoleDetailSheet.tsx` and `apps/admin-web/src/features/permissions/permission-columns.tsx`：只做状态色归一，不改变权限解释、组织/用户绑定或角色授权流程。
- Modify `apps/admin-web/src/features/settings/SystemSettingsView.tsx` and `apps/admin-web/src/features/admin-users/AdminAuthorizationView.tsx`：只做状态矩阵和语义色归一，不改变飞书同步和管理员授权行为。
- Create `migrations/V1_0_0__platform_admin_initialization.sql`：幂等确认“王文哲”平台管理员授权。
- Modify `README.md`：同步 v1.0.0 Quick Start、版本历史、初始化变量和设计/验证文档索引。
- Modify `docs/acceptance/v1.0.0-riversoft-ui-init.md`：记录 v1.0.0 UI、状态矩阵、响应式、管理员初始化和敏感信息验收清单。

## 第一 vertical slice

第一切片固定为 `D2-A：Token + 项目级组件 + 3 个证明页面 + 管理员初始化`。

证明页面：

1. 工作台 / AppShell：验证 1440 桌面 Sidebar + 内容区、768 收缩导航、390 移动导航。
2. 应用管理 / 应用详情：验证 DataTable、StatusBadge、凭证安全表达、Tab 和危险确认。
3. 统一问题提示页 / 追踪页：验证 request id 主旅程、PageState 和敏感信息边界。

第一切片不要求一次性重画全站，但共享组件变化会自然影响所有使用处。任何受影响页面必须保持原有路由和行为。

---

### Task 1: 锁定 Riversoft token 和硬编码颜色扫描

**Files:**
- Modify: `apps/admin-web/src/index.css`
- Modify: `apps/admin-web/src/theme.ts`
- Reference: `design/v1.0.0-riversoft-admin-prototype.md`

- [x] **Step 1: 记录当前硬编码颜色基线**

Run:

```bash
rg -n "bg-(emerald|amber|blue|sky|cyan|teal|slate|red|green|yellow)|text-(emerald|amber|blue|sky|cyan|teal|slate|red|green|yellow)|border-(emerald|amber|blue|sky|cyan|teal|slate|red|green|yellow)|#[0-9A-Fa-f]{3,6}" apps/admin-web/src
```

Expected: 输出至少包含 `apps/admin-web/src/theme.ts`、`StatusBadge.tsx`、`ProblemFeedbackPage.tsx`、`TraceResultPanel.tsx` 和若干页面级 warning/success 样式。把这些作为本切片需要收敛的清单。

- [x] **Step 2: 修改全局 CSS variables**

在 `apps/admin-web/src/index.css` 的 `:root` 中使用 HSL 变量替换旧青绿色基线。实现值：

```css
@layer base {
  :root {
    --background: 210 33% 97%;
    --foreground: 25 17% 14%;
    --card: 0 0% 100%;
    --card-foreground: 25 17% 14%;
    --popover: 0 0% 100%;
    --popover-foreground: 25 17% 14%;
    --primary: 203 86% 37%;
    --primary-foreground: 0 0% 100%;
    --secondary: 210 24% 95%;
    --secondary-foreground: 215 40% 18%;
    --muted: 210 24% 94%;
    --muted-foreground: 215 16% 42%;
    --accent: 201 76% 94%;
    --accent-foreground: 203 86% 27%;
    --destructive: 0 72% 51%;
    --destructive-foreground: 0 0% 100%;
    --border: 214 20% 86%;
    --input: 214 20% 86%;
    --ring: 203 86% 37%;
    --radius: 0.5rem;
    --sidebar: 211 76% 15%;
    --sidebar-foreground: 210 33% 97%;
    --sidebar-accent: 211 52% 24%;
    --sidebar-accent-foreground: 0 0% 100%;
    --sidebar-border: 211 42% 28%;
    --status-success: 156 55% 33%;
    --status-success-foreground: 0 0% 100%;
    --status-warning: 43 86% 42%;
    --status-warning-foreground: 25 17% 14%;
    --status-info: 196 72% 49%;
    --status-info-foreground: 0 0% 100%;
    --status-neutral: 215 16% 42%;
    --status-neutral-foreground: 0 0% 100%;
  }
}
```

Do not add `.dark` unless the existing app already supports dark mode in another file. v1.0.0 正式版只要求当前后台主题。

- [x] **Step 3: 修改 `theme.ts` 常量**

Replace old teal values with:

```ts
export const adminTheme = {
  primary: '#0E76BD',
  blue500: '#1C8CCA',
  blue400: '#26A4D8',
  foreground: '#231C16',
  sidebar: '#0A2540',
  background: '#F0F4F8',
  card: '#FFFFFF',
  lemon: '#A6C511'
} as const;
```

Expected: `theme.ts` 不再出现 `#0b2f33`、`#082528`、`#1f6f8b`、`#168a60`、`#9ccf31`、`#f3f7f5`。

- [x] **Step 4: 运行 token smoke check**

Run:

```bash
pnpm --filter @feishu-iam/admin-web typecheck
```

Expected: `Exit 0`，没有 TypeScript 错误。

---

### Task 2: 升级项目级状态和表格组件

**Files:**
- Modify: `apps/admin-web/src/components/admin/StatusBadge.tsx`
- Modify: `apps/admin-web/src/components/admin/PageState.tsx`
- Modify: `apps/admin-web/src/components/admin/DataTable.tsx`

- [x] **Step 1: 更新 `StatusBadge` 语义 tone**

实现以下类型和 class 映射，允许现有 `default/success/warning/danger/muted` 继续工作，并新增 `info`：

```tsx
export type StatusBadgeTone =
  | "default"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "muted";

const toneClasses: Record<StatusBadgeTone, string> = {
  default: "border-transparent bg-primary text-primary-foreground",
  success: "border-transparent bg-[hsl(var(--status-success))] text-[hsl(var(--status-success-foreground))]",
  warning: "border-transparent bg-[hsl(var(--status-warning))] text-[hsl(var(--status-warning-foreground))]",
  danger: "border-transparent bg-destructive text-destructive-foreground",
  info: "border-transparent bg-[hsl(var(--status-info))] text-[hsl(var(--status-info-foreground))]",
  muted: "border-border bg-muted text-muted-foreground",
};
```

Keep `ariaLabel` behavior unchanged.

- [x] **Step 2: 更新 `PageState` 状态矩阵**

保留 `PageStateType = 'loading' | 'empty' | 'error' | 'forbidden'`。把容器 class 调整为稳定后台状态块：

```tsx
className="flex min-h-36 flex-col items-center justify-center gap-3 rounded-md border border-dashed border-border bg-card p-6 text-center shadow-sm"
```

加载态 skeleton 保持两行，并新增第三条短 skeleton，避免加载态过空：

```tsx
<Skeleton className="mx-auto h-5 w-32" />
<Skeleton className="mx-auto h-4 w-56" />
<Skeleton className="mx-auto h-4 w-40" />
```

Expected: error 继续使用 `role="alert"`；loading 继续使用 `aria-live="polite"`。

- [x] **Step 3: 更新 `DataTable` 表格表面**

只改视觉 class，不改 props、columns、rows、loading/empty/error/forbidden 分支：

```tsx
const tableClassName = [
  "overflow-x-auto rounded-md border bg-card shadow-sm",
  className,
]
  .filter(Boolean)
  .join(" ");
```

在 `TableHeader` 行上增加稳定背景：

```tsx
<TableRow className="bg-muted/60 hover:bg-muted/60">
```

在 body row 上增加 hover，不改变点击逻辑：

```tsx
<TableRow key={getRowKey(row)} className="hover:bg-accent/45">
```

- [x] **Step 4: 运行共享组件测试**

Run:

```bash
pnpm --filter @feishu-iam/admin-web test -- src/features/applications/ApplicationManagementView.test.tsx src/features/records/RecordQueryView.test.tsx src/components/admin/ProblemFeedbackPage.test.tsx
```

Expected: `PASS`，没有快照或文本断言因业务文案变化失败。若失败，修正计划外文案改动，保留原业务文案。

---

### Task 3: 升级 AppShell、弹窗、抽屉和危险确认

**Files:**
- Modify: `apps/admin-web/src/components/admin/AppShell.tsx`
- Modify: `apps/admin-web/src/components/admin/FormDialog.tsx`
- Modify: `apps/admin-web/src/components/admin/DetailSheet.tsx`
- Modify: `apps/admin-web/src/components/admin/ConfirmDialog.tsx`

- [x] **Step 1: AppShell 只做视觉升级**

保留 `gridTemplateColumns`、`DEFAULT_STORAGE_KEY`、`PrimaryNav`、`aria-current`、`aria-expanded`、移动 Sheet 和左侧 Sidebar。允许的 class 调整：

```tsx
<main className="min-w-0 flex-1 bg-background lg:min-h-0 lg:overflow-y-auto">
```

Desktop aside 保持：

```tsx
className="hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:flex lg:flex-col"
```

Mobile `SheetContent` 改为：

```tsx
<SheetContent side="left" className="w-[300px] max-w-[calc(100vw-2rem)] border-sidebar-border bg-card p-0">
```

Do not add topbar navigation and do not change `navItems` shape.

- [x] **Step 2: FormDialog 错误和提交中状态统一**

`DialogContent` 保持 `aria-busy={pending}`，错误块改为：

```tsx
<div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
  {error}
</div>
```

不要改 `DialogDescription` 文案，不新增表单字段。

- [x] **Step 3: DetailSheet page/sheet 视觉统一**

`presentation === "page"` 的两个容器从 `bg-background` 改为 `bg-card shadow-sm`。Sheet body 保持 `data-testid="detail-sheet-body"`，按钮继续有 `aria-label` 和 `aria-pressed`。

Expected: 详情抽屉关闭、宽度切换和 Escape 行为不变。

- [x] **Step 4: ConfirmDialog 危险确认补齐 pending 语义**

在 `AlertDialogContent` 增加危险态边框 class：

```tsx
<AlertDialogContent
  aria-busy={pending}
  className={danger ? "border-destructive/40" : undefined}
>
```

确认按钮保留：

```tsx
disabled={pending}
```

Expected: `pending` 时取消和确认均不可重复点击，确认文案仍为 `处理中`。

- [x] **Step 5: 运行按钮治理**

Run:

```bash
pnpm --filter @feishu-iam/admin-web test:buttons
```

Expected: 输出 `button governance check passed`。

---

### Task 4: 完成三个证明页面的保守 UI 适配

**Files:**
- Modify: `apps/admin-web/src/features/applications/ApplicationManagementView.tsx`
- Modify: `apps/admin-web/src/features/applications/ApplicationDetailPage.tsx`
- Modify: `apps/admin-web/src/features/applications/ApplicationDetailSheet.tsx`
- Modify: `apps/admin-web/src/components/admin/ProblemFeedbackPage.tsx`
- Modify: `apps/admin-web/src/features/records/TraceResultPanel.tsx`

- [x] **Step 1: 应用管理列表移除局部成功/警告硬编码**

把 `ApplicationManagementView.tsx` 中类似：

```tsx
<span className={ready ? "text-emerald-700" : "text-amber-700"}>
```

替换为语义文本 class：

```tsx
<span className={ready ? "text-[hsl(var(--status-success))]" : "text-[hsl(var(--status-warning))]"}>
```

Do not change table columns, filters, pagination, row action order, detail route, create/edit/enable/disable behavior.

- [x] **Step 2: 应用详情凭证区使用安全表达**

在 `ApplicationDetailPage.tsx` 和 `ApplicationDetailSheet.tsx` 中，凭证相关区域只能展示：

```text
凭证状态
最近轮换时间
创建或轮换后仅展示一次
```

禁止展示 `client_secret`、`secret`、`token`、`cookie`、`app_secret`、数据库密码或任何 `sk-` 形态字符串。轮换后一次性展示逻辑如现有业务已存在则保留；本任务不新增凭证接口、不改变数据契约。

- [x] **Step 3: 统一问题提示页突出 request id 主旅程**

`ProblemFeedbackPage.tsx` 保留 `copyRequestId()` 和 `primaryAction`，只调整视觉层级。警告 icon 容器改为：

```tsx
<div className="rounded-md bg-[hsl(var(--status-warning))]/15 p-2 text-[hsl(var(--status-warning))]" aria-hidden="true">
```

主行动必须仍是复制 request id 与 `props.primaryAction` 跳转追踪页。不要新增“联系管理员”按钮。

- [x] **Step 4: 追踪页 warning 使用语义 token**

把 `TraceResultPanel.tsx` 中缺少阶段提示从硬编码 amber 改为：

```tsx
<p className="rounded-md border border-[hsl(var(--status-warning))]/35 bg-[hsl(var(--status-warning))]/10 p-3 text-sm text-foreground">
```

`<pre>{JSON.stringify(item.details, null, 2)}</pre>` 保持不变；敏感字段脱敏仍由后端契约保证，本任务不改变追踪数据结构。

- [x] **Step 5: 运行证明页面测试**

Run:

```bash
pnpm --filter @feishu-iam/admin-web test -- src/features/applications/ApplicationManagementView.test.tsx src/features/records/RecordQueryView.test.tsx src/components/admin/ProblemFeedbackPage.test.tsx
```

Expected: `PASS`。如果测试提示按钮文本、request id、Tab 或详情入口消失，撤回对应 UI 改动。

---

### Task 5: 收敛剩余项目级硬编码状态色

**Files:**
- Modify: `apps/admin-web/src/components/admin/SecretRevealPanel.tsx`
- Modify: `apps/admin-web/src/features/permissions/permission-columns.tsx`
- Modify: `apps/admin-web/src/features/permissions/PermissionSubjectBindingDialog.tsx`
- Modify: `apps/admin-web/src/features/permissions/PermissionRoleDetailSheet.tsx`
- Modify: `apps/admin-web/src/features/org-browser/org-user-selector.tsx`
- Modify: `apps/admin-web/src/features/admin-users/AdminAuthorizationView.tsx`
- Modify: `apps/admin-web/src/features/settings/SystemSettingsView.tsx`

- [x] **Step 1: 只替换颜色 class**

把 warning/success 类统一替换为 CSS variable class。示例：

```tsx
"rounded-md border border-[hsl(var(--status-warning))]/35 bg-[hsl(var(--status-warning))]/10 px-3 py-2 text-sm text-foreground"
```

Success 示例：

```tsx
"rounded-md border border-[hsl(var(--status-success))]/30 bg-[hsl(var(--status-success))]/10 px-4 py-3 text-sm text-foreground"
```

Do not change organization/user selector search, selected draft, orphaned state, permission explanation, sync actions or admin authorization rules.

- [x] **Step 2: 重新运行硬编码颜色扫描**

Run:

```bash
rg -n "bg-(emerald|amber|blue|sky|cyan|teal|slate|red|green|yellow)|text-(emerald|amber|blue|sky|cyan|teal|slate|red|green|yellow)|border-(emerald|amber|blue|sky|cyan|teal|slate|red|green|yellow)|#[0-9A-Fa-f]{3,6}" apps/admin-web/src
```

Expected: 只允许 `apps/admin-web/src/theme.ts` 中的 Riversoft token 十六进制值继续存在。若扫描仍出现页面级颜色类，改为共享 token 或 `StatusBadge` tone。

- [x] **Step 3: 运行前端测试**

Run:

```bash
pnpm --filter @feishu-iam/admin-web test
```

Expected: `PASS`。

---

### Task 6: 新增 v1.0.0 管理员初始化迁移

**Files:**
- Create: `migrations/V1_0_0__platform_admin_initialization.sql`
- Verify existing: `deploy/apply-migrations-in-container.sh`
- Verify existing: `deploy/upgrade.sh`

- [x] **Step 1: 创建幂等迁移**

Create `migrations/V1_0_0__platform_admin_initialization.sql`:

```sql
\if :{?initial_platform_admin_feishu_user_id}
\else
\set initial_platform_admin_feishu_user_id ''
\endif

CREATE TEMP TABLE v1_0_0_migration_vars AS
SELECT NULLIF(btrim(:'initial_platform_admin_feishu_user_id'), '') AS initial_feishu_user_id;

DO $$
DECLARE
  initial_feishu_user_id text;
  target_admin_user_id text;
  platform_role_id text;
BEGIN
  SELECT vars.initial_feishu_user_id
  INTO initial_feishu_user_id
  FROM v1_0_0_migration_vars vars;

  IF initial_feishu_user_id IS NULL THEN
    RAISE EXCEPTION 'INITIAL_PLATFORM_ADMIN_FEISHU_USER_ID is required for v1.0.0 migration';
  END IF;

  SELECT id INTO platform_role_id
  FROM admin_roles
  WHERE role_key = 'platform_admin';

  IF platform_role_id IS NULL THEN
    RAISE EXCEPTION 'platform_admin role is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM feishu_users
    WHERE user_id = initial_feishu_user_id
      AND is_active = true
      AND is_deleted = false
  ) THEN
    RAISE EXCEPTION 'v1.0.0 platform admin feishu user is missing or unavailable: %', initial_feishu_user_id;
  END IF;

  SELECT id INTO target_admin_user_id
  FROM admin_users
  WHERE feishu_user_id = initial_feishu_user_id;

  IF target_admin_user_id IS NULL THEN
    target_admin_user_id := 'admin-user-v1-0-0-platform-admin';

    INSERT INTO admin_users(id, feishu_user_id, display_name, status, created_at, updated_at)
    SELECT target_admin_user_id, user_id, name, 'active', now(), now()
    FROM feishu_users
    WHERE user_id = initial_feishu_user_id;
  ELSE
    UPDATE admin_users
    SET status = 'active',
        updated_at = now()
    WHERE id = target_admin_user_id;
  END IF;

  INSERT INTO admin_user_roles(admin_user_id, admin_role_id, created_at)
  VALUES (target_admin_user_id, platform_role_id, now())
  ON CONFLICT (admin_user_id, admin_role_id) DO NOTHING;

  INSERT INTO audit_logs(
    id,
    actor_type,
    actor_id,
    source,
    resource_type,
    resource_id,
    action,
    before,
    after,
    result,
    request_id,
    created_at
  )
  VALUES (
    'audit-v1-0-0-platform-admin-initialization',
    'system',
    'deployment',
    'deployment_init',
    'admin_user',
    target_admin_user_id,
    'initialize_platform_admin',
    NULL,
    jsonb_build_object(
      'adminUserId', target_admin_user_id,
      'feishuUserId', initial_feishu_user_id,
      'roleKeys', jsonb_build_array('platform_admin')
    ),
    'success',
    'deployment-init-v1.0.0',
    now()
  )
  ON CONFLICT (id) DO NOTHING;
END $$;

DROP TABLE v1_0_0_migration_vars;

INSERT INTO schema_versions(version, description)
VALUES ('1.0.0', 'Riversoft 正式版 UI 翻新与平台管理员初始化')
ON CONFLICT (version) DO NOTHING;
```

Expected: 迁移只写 `admin_users`、`admin_user_roles`、`audit_logs`、`schema_versions`，不写应用、client、回调地址、权限点、权限组或业务角色。

- [x] **Step 2: 确认部署脚本无需新增 secret**

Run:

```bash
rg -n "initial_platform_admin_feishu_user_id|INITIAL_PLATFORM_ADMIN_FEISHU_USER_ID" deploy migrations/V1_0_0__platform_admin_initialization.sql
```

Expected: `deploy/apply-migrations-in-container.sh` 已继续通过 `-v initial_platform_admin_feishu_user_id="${INITIAL_PLATFORM_ADMIN_FEISHU_USER_ID:-}"` 注入变量，`deploy/upgrade.sh` 已继续 `require_env INITIAL_PLATFORM_ADMIN_FEISHU_USER_ID`。不新增任何 secret env。

- [x] **Step 3: 迁移静态边界扫描**

Run:

```bash
rg -n "applications|clients|callback|redirect|permission_points|permission_groups|roles|client_secret|app_secret|token|cookie|sk-" migrations/V1_0_0__platform_admin_initialization.sql
```

Expected: 只允许 `admin_user_roles` 和 `roleKeys` 这类 IAM 管理权限相关命中；不得出现第三方应用、client、回调地址、secret、token、cookie 或 `sk-`。

---

### Task 7: 补充文档和验收清单

**Files:**
- Modify: `README.md`
- Create: `docs/acceptance/v1.0.0-riversoft-ui-init.md`

- [x] **Step 1: 更新 README**

在 `README.md` 中补充 v1.0.0 记录，至少包含：

```markdown
### v1.0.0

- Riversoft 正式版后台 UI 翻新：基于 shadcn/ui + tweakcn + Tailwind CSS variables 收敛主题 token，升级 AppShell、DataTable、StatusBadge、PageState、FormDialog、DetailSheet、Confirm/Danger Zone 和 Trace/Error Page。
- 数据初始化只处理 IAM 管理权限：通过 `INITIAL_PLATFORM_ADMIN_FEISHU_USER_ID` 确保“王文哲”具备 `platform_admin`，不初始化第三方应用权限、demo client、回调地址或业务角色。
- 设计输入：`design/admin-console-v1.0.0.pen`、`design/v1.0.0-riversoft-admin-prototype.md`、`design/exports/v1.0.0-riversoft-admin-prototype/`。
```

Do not add real user id, app id, app secret, database password or production URL.

- [x] **Step 2: 新增验收文档**

Create `docs/acceptance/v1.0.0-riversoft-ui-init.md`:

```markdown
# v1.0.0 Riversoft UI 翻新与管理员初始化验收

## 范围

- 前端 UI 翻新：通过 Riversoft token 和项目级组件完成正式版质感升级。
- 数据初始化：确保 `INITIAL_PLATFORM_ADMIN_FEISHU_USER_ID` 指向的“王文哲”拥有 `platform_admin`。

## 不做

- 不改变 UX 流程、信息架构、路由、表单流程、数据契约、CRUD 行为、权限逻辑或业务逻辑。
- 不初始化第三方应用权限、demo client、回调地址或业务角色。
- 不记录真实 secret、token、cookie、飞书 app_secret、数据库密码或生产导出数据。

## UI 验收

- [ ] 1440 桌面：左侧 Sidebar + 内容工作区稳定，无深色 topbar 误导。
- [ ] 768 平板：导航可收缩，应用详情 Tab 和凭证状态表达不溢出。
- [ ] 390 窄屏：移动 Header + Sheet 导航，表格横向滚动，触控目标不小于 44px。
- [ ] 状态矩阵：空、错、加载、禁用、提交中、危险确认均有稳定展示。
- [ ] 可访问性：focus ring、`aria-current`、`aria-expanded`、图标按钮 `aria-label`、44px 触控目标通过检查。

## 数据初始化验收

- [ ] `INITIAL_PLATFORM_ADMIN_FEISHU_USER_ID` 使用“王文哲”的飞书 `user_id`，不写入仓库。
- [ ] `/api/v1/admin/me` 返回角色包含 `platform_admin`。
- [ ] 迁移不创建第三方应用、client、回调地址、权限点、权限组或业务角色。

## 验证命令

```bash
pnpm --filter @feishu-iam/admin-web typecheck
pnpm --filter @feishu-iam/admin-web lint
pnpm --filter @feishu-iam/admin-web test
pnpm --filter @feishu-iam/admin-web test:buttons
pnpm --filter @feishu-iam/admin-web test:responsive
pnpm check
```
```

- [x] **Step 3: 文档占位和敏感信息扫描**

Run:

```bash
rg -n "TB""D|TO""DO|待""补|place""holder|(^|[^A-Za-z0-9])sk-[A-Za-z0-9]|app_secret|client_secret|cookie|DATABASE_PASSWORD|password=" README.md docs/acceptance/v1.0.0-riversoft-ui-init.md IMPLEMENTATION_PLAN.md
```

Expected: 不出现占位关键字、真实 secret、token、cookie、数据库密码或 `sk-`。执行时若命令本身造成自我命中，把占位关键字拆成 shell 拼接形式，例如 `"TB""D|TO""DO|place""holder"`。

---

### Task 8: 完成前端、迁移、响应式和 Browser 验证

**Files:**
- Verify: `apps/admin-web/test/run-responsive-overflow-check.mjs`
- Verify: `apps/admin-web/test/button-governance-check.mjs`
- Verify: local Browser at admin web URL

- [x] **Step 1: 运行前端基础验证**

Run:

```bash
pnpm --filter @feishu-iam/admin-web typecheck
pnpm --filter @feishu-iam/admin-web lint
pnpm --filter @feishu-iam/admin-web test
pnpm --filter @feishu-iam/admin-web test:buttons
pnpm --filter @feishu-iam/admin-web test:responsive
```

Expected: 全部 `Exit 0`。`test:responsive` 覆盖 390、768、1280、1440；若 dev server 不在 `http://localhost:3000`，执行前设置 `ADMIN_WEB_URL`。

- [x] **Step 2: 运行全仓检查**

Run:

```bash
pnpm check
```

Expected: `typecheck`、`lint`、`test` 全部通过。

- [x] **Step 3: 启动本地服务**

Run:

```bash
pnpm dev
```

Expected: API 和 admin web 均启动。若 Vite 输出端口不是 `3000`，记录实际 admin web URL，并用于 Browser 验证。

- [x] **Step 4: Browser / Playwright 手动验证 1440**

Open actual admin web URL and verify:

```text
/admin/workspace
/admin/applications
/admin/applications/crm?from=/admin/applications
/admin/system/audit?tab=trace&requestId=req_0123456789abcdef0123456789abcdef_long
```

Viewport: `1440x900`。

Expected: 左侧 Sidebar 可见；当前导航有 `aria-current`；工作区无页面级横向溢出；应用列表表格、筛选、分页、详情入口稳定；应用详情凭证区不展示 secret/token/cookie；追踪页围绕 request id。

- [x] **Step 5: Browser / Playwright 手动验证 768**

Viewport: `768x900`。

Expected: 打开导航按钮可见；表格允许横向滚动；应用详情 Tab 不挤压；弹窗/抽屉宽度不超过视口；图标按钮保留 label/title。

- [x] **Step 6: Browser / Playwright 手动验证 390**

Viewport: `390x844`。

Expected: 移动 Header + Sheet 导航可用；触控目标不小于 44px；筛选、详情、复制 request id、关闭、确认和取消按钮可点击；文本不溢出容器。

- [x] **Step 7: 控制台和网络检查**

Expected:

```text
Browser console: no unexpected errors
Network: no unexpected failed requests
No raw JSON/stack/default framework error page visible
```

---

### Task 9: 发布前安全扫描和交付边界确认

**Files:**
- Verify all changed files

- [x] **Step 1: 查看变更**

Run:

```bash
git status --short
git diff -- IMPLEMENTATION_PLAN.md apps/admin-web/src README.md docs/acceptance migrations
```

Expected: 只出现 v1.0.0 UI、文档和管理员初始化相关变更；没有无关业务代码重构。

- [x] **Step 2: 敏感信息扫描**

Run:

```bash
rg -n "(^|[^A-Za-z0-9])sk-[A-Za-z0-9]|secret|token|cookie|app_secret|client_secret|DATABASE_URL=|POSTGRES_PASSWORD=|password=" .
```

Expected: 只允许文档中的禁止性说明、类型名、脱敏字段名、环境变量模板和既有安全测试命中；不得出现真实值。

- [x] **Step 3: UX/业务不变更扫描**

Run:

```bash
git diff --name-only
rg -n "Route|path=|createBrowserRouter|fetch\\(|api/v1|permission|roleKey|applicationIds|callback|redirect" apps/admin-web/src apps/api/src migrations/V1_0_0__platform_admin_initialization.sql
```

Expected: 前端路由、API 路径、权限判断和 CRUD 请求没有因 UI 翻新发生契约变化。迁移只处理 `admin_users`、`admin_user_roles`、`audit_logs`、`schema_versions`。

- [x] **Step 4: 会话归档**

Create one Chinese session archive under `docs/codex-sessions/` after implementation and verification are complete. The archive must include goal, key constraints, modified files, commands, verification results, unresolved items and next action. Do not record secrets or real credential values.

---

## 验收标准

- Riversoft token 通过 CSS variables 和 `theme.ts` 集中管理；页面内不散落品牌色或语义色硬编码。
- `AppShell`、`DataTable`、`StatusBadge`、`PageState`、`FormDialog`、`DetailSheet`、`Confirm/Danger Zone`、`Trace/Error Page` 已完成项目级视觉升级。
- 工作台、应用管理/详情、统一问题提示页/追踪页三个证明页面通过 1440、768、390 验证。
- 空、错、加载、禁用、提交中、危险确认状态矩阵在共享组件和证明页面中可见。
- 应用详情不展示任何 secret、token、cookie、飞书 `app_secret`、数据库密码、生产导出数据或 `sk-` 形态内容。
- `V1_0_0__platform_admin_initialization.sql` 幂等确保“王文哲”具备 `platform_admin`，且不写第三方应用、client、回调地址、权限点、权限组或业务角色。
- 所有指定测试、Browser/Playwright 检查和敏感信息扫描都有当次证据。
- `README.md` 和 `docs/acceptance/v1.0.0-riversoft-ui-init.md` 已同步 v1.0.0 范围、验证命令和初始化约束。

## 明确不作为完成依据的内容

- 只替换 `--primary` 而未收敛 `StatusBadge`、warning/success 页面色。
- 只看 Pencil 截图而未做真实 Browser/Playwright 验证。
- 只让测试“应该通过”而没有当次命令输出。
- 只创建管理员但未验证 `platform_admin` 角色。
- 任何包含真实 secret、token、cookie、飞书 app_secret、数据库密码或生产导出数据的变更。
