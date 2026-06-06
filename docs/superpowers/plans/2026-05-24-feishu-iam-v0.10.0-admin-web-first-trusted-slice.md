# Feishu IAM v0.10.0 Admin Web First Trusted Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 交付 v0.10.0 第一可信切片：Tailwind + shadcn/ui + tweakcn token 运行时、react-router 深链、AppShell，以及记录查询和应用管理两条高密度业务主路径。

**Architecture:** 先建立新运行时事实源，再迁移业务页面。API client、领域类型、错误码安全展示和现有业务断言保留；旧 shell、旧页面 class、自研 Drawer/Modal/Table 视觉层在切片范围内删除重建。URL search params 是记录查询和应用管理的状态事实源，Sheet/Dialog 由 query 驱动，表单草稿和一次性 secret 不进入 URL。

**Tech Stack:** React 19、Vite、TypeScript、Vitest、Testing Library、react-router-dom、Tailwind CSS、shadcn/ui/Radix primitives、class-variance-authority、clsx、tailwind-merge、lucide-react、现有 Feishu IAM Admin API。

---

## Scope Boundary

本计划只覆盖第一可信切片：

- Tailwind、shadcn/ui、tweakcn-compatible CSS variables 和 `components/ui/*` 基础落地。
- `react-router` 接管 `/admin`、`/admin/records`、`/admin/applications`。
- `AppShell`、`Sidebar`、`TopBar`、`PageHeader` 在 1440、768、390 视口可用。
- 记录查询：四个 tab、筛选、分页、详情 Sheet、loading、empty、error、no-permission。
- 应用管理：列表、创建 Dialog、创建成功接入包、应用详情 Sheet、禁用/启用确认、OAuth secret 查看/轮换确认、一次性 secret 展示。
- 切片相关文件不再使用 `legacy-module-page`、`table-wrap`、`tab-list`、`tab-button`、`application-detail-drawer`。

本计划不覆盖：

- 权限管理、管理员授权、系统设置、工作台的完整迁移。
- 后端服务层重构。
- 数据库 DDL。
- 完整 release、tag、镜像发布、远端部署。

## Source Inputs

- `DESIGN.md`
- `docs/superpowers/specs/2026-05-24-feishu-iam-v0.10.0-admin-web-runtime-rebuild.md`
- `design/admin-console-v0.10.0.pen`
- `AGENTS.md`

## Subagent Execution Map

优先使用 `superpowers:subagent-driven-development`。推荐拆分：

| Lane | 任务 | 可并行性 | 写入边界 |
|---|---|---|---|
| A | Task 1、Task 2 | 串行先做 | `package.json`、Tailwind 配置、`src/index.css`、`components/ui/*`、`lib/utils.ts` |
| B | Task 3 | 可在 A 后独立 | `src/routes/admin-routes.ts`、`src/routes/admin-url-state.ts`、对应测试 |
| C | Task 4 | 可在 A 后独立 | `components/admin/*`、对应测试 |
| D | Task 6 | C 和 B 后执行 | `features/records/*`、`routes/RecordQueryPage.tsx`、记录查询测试 |
| E | Task 7 | C 和 B 后执行 | `features/applications/*`、`routes/ApplicationManagementPage.tsx`、应用管理测试 |
| Merge | Task 5、Task 8、Task 9 | 必须串行 | `App.tsx`、`main.tsx`、`App.css`、README、CHANGELOG、会话归档 |

共享文件规则：

- `App.tsx`、`main.tsx`、`App.test.tsx`、`App.css`、`src/index.css` 只能由当前 lane owner 修改。
- 如果两个 lane 都需要补 `App.test.tsx`，先写 lane 内测试文件，最后由 Merge lane 合并路由级断言。
- 不允许两个 subagent 同时删除旧组件。旧组件删除由 Task 8 统一处理。

## File Structure

- Modify: `apps/admin-web/package.json`
- Modify: `pnpm-lock.yaml`
- Create: `apps/admin-web/tailwind.config.ts`
- Create: `apps/admin-web/postcss.config.js`
- Create: `apps/admin-web/src/index.css`
- Create: `apps/admin-web/src/lib/utils.ts`
- Create: `apps/admin-web/src/components/ui/button.tsx`
- Create: `apps/admin-web/src/components/ui/input.tsx`
- Create: `apps/admin-web/src/components/ui/label.tsx`
- Create: `apps/admin-web/src/components/ui/badge.tsx`
- Create: `apps/admin-web/src/components/ui/table.tsx`
- Create: `apps/admin-web/src/components/ui/tabs.tsx`
- Create: `apps/admin-web/src/components/ui/sheet.tsx`
- Create: `apps/admin-web/src/components/ui/dialog.tsx`
- Create: `apps/admin-web/src/components/ui/alert-dialog.tsx`
- Create: `apps/admin-web/src/components/ui/tooltip.tsx`
- Create: `apps/admin-web/src/components/ui/dropdown-menu.tsx`
- Create: `apps/admin-web/src/components/ui/skeleton.tsx`
- Create: `apps/admin-web/src/components/ui/textarea.tsx`
- Create: `apps/admin-web/src/components/admin/AppShell.tsx`
- Create: `apps/admin-web/src/components/admin/PageHeader.tsx`
- Create: `apps/admin-web/src/components/admin/DataTable.tsx`
- Create: `apps/admin-web/src/components/admin/FilterBar.tsx`
- Create: `apps/admin-web/src/components/admin/DetailSheet.tsx`
- Create: `apps/admin-web/src/components/admin/FormDialog.tsx`
- Create: `apps/admin-web/src/components/admin/ConfirmDialog.tsx`
- Create: `apps/admin-web/src/components/admin/SecretRevealPanel.tsx`
- Create: `apps/admin-web/src/components/admin/PageState.tsx`
- Create: `apps/admin-web/src/components/admin/CopyField.tsx`
- Create: `apps/admin-web/src/components/admin/StatusBadge.tsx`
- Create: `apps/admin-web/src/routes/admin-routes.ts`
- Create: `apps/admin-web/src/routes/admin-url-state.ts`
- Create: `apps/admin-web/src/features/records/RecordQueryView.tsx`
- Create: `apps/admin-web/src/features/records/record-columns.tsx`
- Create: `apps/admin-web/src/features/records/record-mappers.ts`
- Create: `apps/admin-web/src/features/applications/ApplicationManagementView.tsx`
- Create: `apps/admin-web/src/features/applications/ApplicationCreateDialog.tsx`
- Create: `apps/admin-web/src/features/applications/ApplicationDetailSheet.tsx`
- Create: `apps/admin-web/src/features/applications/application-form.ts`
- Modify: `apps/admin-web/src/main.tsx`
- Modify: `apps/admin-web/src/App.tsx`
- Modify: `apps/admin-web/src/routes/RecordQueryPage.tsx`
- Modify: `apps/admin-web/src/routes/ApplicationManagementPage.tsx`
- Modify: `apps/admin-web/src/App.test.tsx`
- Modify: `README.md`
- Modify: `CHANGELOG.md`

## Task 0: Baseline Guard

**Files:**
- Read only: repository root

- [ ] **Step 1: Confirm working tree before edits**

Run:

```bash
git status --short
git branch --show-current
```

Expected:

```text
当前分支为 main，未提交文件清晰可见；执行者确认不会回退用户或前序流程已有修改。
```

- [ ] **Step 2: Confirm required design artifacts**

Run:

```bash
test -f DESIGN.md
test -f docs/superpowers/specs/2026-05-24-feishu-iam-v0.10.0-admin-web-runtime-rebuild.md
test -f design/admin-console-v0.10.0.pen
```

Expected:

```text
三个命令退出码均为 0。
```

- [ ] **Step 3: Record legacy class baseline**

Run:

```bash
rg -n "legacy-module-page|table-wrap|tab-list|tab-button|application-detail-drawer" apps/admin-web/src
```

Expected:

```text
命令当前会返回旧页面和旧组件使用点；后续 Task 8 必须保证切片相关文件中不再出现这些 class。
```

## Task 1: Runtime Dependencies And Tailwind Entry

**Files:**
- Modify: `apps/admin-web/package.json`
- Modify: `pnpm-lock.yaml`
- Create: `apps/admin-web/tailwind.config.ts`
- Create: `apps/admin-web/postcss.config.js`
- Create: `apps/admin-web/src/index.css`
- Modify: `apps/admin-web/src/main.tsx`
- Create: `apps/admin-web/src/lib/utils.ts`

- [ ] **Step 1: Install runtime dependencies**

Run:

```bash
pnpm --filter @feishu-iam/admin-web add react-router-dom @radix-ui/react-dialog @radix-ui/react-alert-dialog @radix-ui/react-dropdown-menu @radix-ui/react-label @radix-ui/react-slot @radix-ui/react-tabs @radix-ui/react-tooltip class-variance-authority clsx tailwind-merge tailwindcss-animate @tanstack/react-table
pnpm --filter @feishu-iam/admin-web add -D tailwindcss postcss autoprefixer
```

Expected:

```text
apps/admin-web/package.json 和 pnpm-lock.yaml 更新；安装命令退出码为 0。
```

- [ ] **Step 2: Create Tailwind config**

Create `apps/admin-web/tailwind.config.ts`:

```ts
import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';

const config: Config = {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))'
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))'
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))'
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))'
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))'
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))'
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))'
        },
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar))',
          foreground: 'hsl(var(--sidebar-foreground))',
          accent: 'hsl(var(--sidebar-accent))',
          'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
          border: 'hsl(var(--sidebar-border))'
        }
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)'
      }
    }
  },
  plugins: [animate]
};

export default config;
```

- [ ] **Step 3: Create PostCSS config**

Create `apps/admin-web/postcss.config.js`:

```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {}
  }
};
```

- [ ] **Step 4: Create global CSS variables**

Create `apps/admin-web/src/index.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 210 20% 98%;
    --foreground: 215 28% 17%;
    --card: 0 0% 100%;
    --card-foreground: 215 28% 17%;
    --popover: 0 0% 100%;
    --popover-foreground: 215 28% 17%;
    --primary: 174 73% 25%;
    --primary-foreground: 0 0% 100%;
    --secondary: 210 20% 96%;
    --secondary-foreground: 215 28% 17%;
    --muted: 210 18% 94%;
    --muted-foreground: 215 14% 45%;
    --accent: 174 55% 92%;
    --accent-foreground: 174 73% 20%;
    --destructive: 0 72% 51%;
    --destructive-foreground: 0 0% 100%;
    --border: 214 18% 88%;
    --input: 214 18% 88%;
    --ring: 174 73% 32%;
    --radius: 0.5rem;
    --sidebar: 174 73% 16%;
    --sidebar-foreground: 0 0% 98%;
    --sidebar-accent: 174 69% 22%;
    --sidebar-accent-foreground: 0 0% 100%;
    --sidebar-border: 174 45% 24%;
  }

  * {
    @apply border-border;
  }

  body {
    @apply bg-background text-foreground antialiased;
    font-family:
      Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }

  button,
  input,
  textarea,
  select {
    font: inherit;
  }
}
```

- [ ] **Step 5: Create `cn` utility**

Create `apps/admin-web/src/lib/utils.ts`:

```ts
import { clsx } from 'clsx';
import type { ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 6: Import the Tailwind entry**

Modify `apps/admin-web/src/main.tsx` so imports are:

```ts
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import './App.css';
import { App } from './App';
```

Expected:

```text
`index.css` 在 `App.css` 前导入；旧 CSS 暂时保留，Task 8 再清理切片范围依赖。
```

- [ ] **Step 7: Verify build tooling compiles**

Run:

```bash
pnpm --filter @feishu-iam/admin-web typecheck
```

Expected:

```text
PASS。
```

## Task 2: shadcn UI Primitives

**Files:**
- Create: `apps/admin-web/src/components/ui/button.tsx`
- Create: `apps/admin-web/src/components/ui/input.tsx`
- Create: `apps/admin-web/src/components/ui/label.tsx`
- Create: `apps/admin-web/src/components/ui/badge.tsx`
- Create: `apps/admin-web/src/components/ui/table.tsx`
- Create: `apps/admin-web/src/components/ui/tabs.tsx`
- Create: `apps/admin-web/src/components/ui/sheet.tsx`
- Create: `apps/admin-web/src/components/ui/dialog.tsx`
- Create: `apps/admin-web/src/components/ui/alert-dialog.tsx`
- Create: `apps/admin-web/src/components/ui/tooltip.tsx`
- Create: `apps/admin-web/src/components/ui/dropdown-menu.tsx`
- Create: `apps/admin-web/src/components/ui/skeleton.tsx`
- Create: `apps/admin-web/src/components/ui/textarea.tsx`

- [ ] **Step 1: Add Button primitive**

Create `apps/admin-web/src/components/ui/button.tsx`:

```tsx
import { Slot } from '@radix-ui/react-slot';
import { cva } from 'class-variance-authority';
import type { VariantProps } from 'class-variance-authority';
import type { ButtonHTMLAttributes } from 'react';
import { forwardRef } from 'react';
import { cn } from '../../lib/utils';

const buttonVariants = cva(
  'inline-flex min-h-10 items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 px-3',
        icon: 'h-10 w-10'
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'default'
    }
  }
);

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  }
);

Button.displayName = 'Button';
export { buttonVariants };
```

- [ ] **Step 2: Add form and status primitives**

Create these files with shadcn-style wrappers:

`apps/admin-web/src/components/ui/input.tsx`:

```tsx
import type { InputHTMLAttributes } from 'react';
import { forwardRef } from 'react';
import { cn } from '../../lib/utils';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      className={cn(
        'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      ref={ref}
      {...props}
    />
  )
);

Input.displayName = 'Input';
```

`apps/admin-web/src/components/ui/textarea.tsx`:

```tsx
import type { TextareaHTMLAttributes } from 'react';
import { forwardRef } from 'react';
import { cn } from '../../lib/utils';

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      className={cn(
        'flex min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      ref={ref}
      {...props}
    />
  )
);

Textarea.displayName = 'Textarea';
```

`apps/admin-web/src/components/ui/label.tsx`、`badge.tsx`、`skeleton.tsx` use the same pattern: forward refs, `cn()`, token classes only, no Feishu IAM business text.

- [ ] **Step 3: Add Radix-backed primitives**

Create `sheet.tsx`, `dialog.tsx`, `alert-dialog.tsx`, `tabs.tsx`, `tooltip.tsx`, `dropdown-menu.tsx` using Radix exports and token classes. Keep the exported names aligned with shadcn:

```ts
export { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle, SheetDescription };
export { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription };
export { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription };
```

Expected:

```text
组件文件不 import 业务 API，不出现 Feishu IAM 领域名。
```

- [ ] **Step 4: Verify primitives are business-free**

Run:

```bash
rg -n "Feishu IAM|应用|记录|权限|管理员|飞书" apps/admin-web/src/components/ui
pnpm --filter @feishu-iam/admin-web typecheck
```

Expected:

```text
第一条命令无输出；typecheck 通过。
```

## Task 3: URL State Schema

**Files:**
- Create: `apps/admin-web/src/routes/admin-routes.ts`
- Create: `apps/admin-web/src/routes/admin-url-state.ts`
- Create: `apps/admin-web/src/routes/admin-url-state.test.ts`

- [ ] **Step 1: Write failing URL state tests**

Create `apps/admin-web/src/routes/admin-url-state.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  closeSheet,
  parseApplicationSearch,
  parseRecordSearch,
  serializeApplicationSearch,
  serializeRecordSearch
} from './admin-url-state';

describe('admin url state', () => {
  it('normalizes invalid record pagination and tab', () => {
    const parsed = parseRecordSearch(new URLSearchParams('tab=bad&page=0&pageSize=-1&sort=createdAt:down'));
    expect(parsed).toMatchObject({ tab: 'audit', page: 1, pageSize: 20, sort: 'createdAt:desc' });
  });

  it('serializes record defaults without noisy query params', () => {
    expect(serializeRecordSearch({ tab: 'audit', page: 1, pageSize: 20, sort: 'createdAt:desc' }).toString()).toBe('');
  });

  it('keeps filters when closing a sheet', () => {
    expect(closeSheet(new URLSearchParams('tab=security&page=2&sheet=security:evt-1')).toString()).toBe(
      'tab=security&page=2'
    );
  });

  it('allows application create and app sheets', () => {
    expect(parseApplicationSearch(new URLSearchParams('sheet=create')).sheet).toBe('create');
    expect(parseApplicationSearch(new URLSearchParams('sheet=app:crm')).sheet).toBe('app:crm');
  });

  it('does not serialize secrets or tokens into url', () => {
    const params = serializeApplicationSearch({
      q: 'crm',
      status: 'active',
      page: 1,
      pageSize: 20,
      sort: 'updatedAt:desc',
      sheet: 'app:crm',
      unsafeSecretDraft: 'client-secret-value'
    });
    expect(params.toString()).not.toContain('secret');
    expect(params.toString()).not.toContain('token');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter @feishu-iam/admin-web test -- admin-url-state.test.ts
```

Expected:

```text
FAIL，提示找不到 ./admin-url-state。
```

- [ ] **Step 3: Define route constants**

Create `apps/admin-web/src/routes/admin-routes.ts`:

```ts
export type AdminRouteId = 'workspace' | 'applications' | 'permissions' | 'admins' | 'records' | 'settings';

export const adminRoutes: Array<{ id: AdminRouteId; path: string; label: string }> = [
  { id: 'workspace', path: '/admin/workspace', label: '工作台' },
  { id: 'applications', path: '/admin/applications', label: '应用管理' },
  { id: 'permissions', path: '/admin/permissions', label: '权限管理' },
  { id: 'admins', path: '/admin/admins', label: '管理员授权' },
  { id: 'records', path: '/admin/records', label: '记录查询' },
  { id: 'settings', path: '/admin/settings', label: '系统设置' }
];

export function routePath(id: AdminRouteId): string {
  return adminRoutes.find((route) => route.id === id)?.path ?? '/admin/records';
}
```

- [ ] **Step 4: Implement URL state parsing**

Create `apps/admin-web/src/routes/admin-url-state.ts` with these exported types and functions:

```ts
export type RecordTab = 'audit' | 'security' | 'sync' | 'tokens';
export type RecordSheet = `audit:${string}` | `security:${string}` | `sync:${string}` | `token:${string}`;
export type RecordSort = 'createdAt:desc' | 'createdAt:asc';

export type RecordSearchState = {
  tab: RecordTab;
  requestId?: string;
  action?: string;
  applicationId?: string;
  result?: string;
  page: number;
  pageSize: number;
  sort: RecordSort;
  sheet?: RecordSheet;
};

export type ApplicationSheet = 'create' | `app:${string}` | `client:${string}` | `rotate:${string}` | `prompt:${string}`;
export type ApplicationSort = 'updatedAt:desc' | 'updatedAt:asc' | 'appKey:asc';

export type ApplicationSearchState = {
  q?: string;
  status: 'all' | 'active' | 'disabled';
  owner?: string;
  page: number;
  pageSize: number;
  sort: ApplicationSort;
  sheet?: ApplicationSheet;
  unsafeSecretDraft?: string;
};

const recordTabs: RecordTab[] = ['audit', 'security', 'sync', 'tokens'];
const applicationStatuses: Array<ApplicationSearchState['status']> = ['all', 'active', 'disabled'];

export function parseRecordSearch(params: URLSearchParams): RecordSearchState {
  return {
    tab: parseEnum(params.get('tab'), recordTabs, 'audit'),
    requestId: clean(params.get('requestId')),
    action: clean(params.get('action')),
    applicationId: clean(params.get('applicationId')),
    result: clean(params.get('result')),
    page: parsePositiveInt(params.get('page'), 1),
    pageSize: parsePositiveInt(params.get('pageSize'), 20),
    sort: parseEnum(params.get('sort'), ['createdAt:desc', 'createdAt:asc'], 'createdAt:desc'),
    sheet: parseRecordSheet(params.get('sheet'))
  };
}

export function parseApplicationSearch(params: URLSearchParams): ApplicationSearchState {
  return {
    q: clean(params.get('q')),
    status: parseEnum(params.get('status'), applicationStatuses, 'all'),
    owner: clean(params.get('owner')),
    page: parsePositiveInt(params.get('page'), 1),
    pageSize: parsePositiveInt(params.get('pageSize'), 20),
    sort: parseEnum(params.get('sort'), ['updatedAt:desc', 'updatedAt:asc', 'appKey:asc'], 'updatedAt:desc'),
    sheet: parseApplicationSheet(params.get('sheet'))
  };
}
```

Complete the file with `serializeRecordSearch`, `serializeApplicationSearch`, `closeSheet`, `parsePositiveInt`, `parseEnum`, `parseRecordSheet`, `parseApplicationSheet`, and `clean`.

- [ ] **Step 5: Run URL state tests**

Run:

```bash
pnpm --filter @feishu-iam/admin-web test -- admin-url-state.test.ts
```

Expected:

```text
PASS。
```

## Task 4: Admin Wrapper Components

**Files:**
- Create: `apps/admin-web/src/components/admin/PageState.tsx`
- Create: `apps/admin-web/src/components/admin/StatusBadge.tsx`
- Create: `apps/admin-web/src/components/admin/CopyField.tsx`
- Create: `apps/admin-web/src/components/admin/DataTable.tsx`
- Create: `apps/admin-web/src/components/admin/FilterBar.tsx`
- Create: `apps/admin-web/src/components/admin/DetailSheet.tsx`
- Create: `apps/admin-web/src/components/admin/FormDialog.tsx`
- Create: `apps/admin-web/src/components/admin/ConfirmDialog.tsx`
- Create: `apps/admin-web/src/components/admin/SecretRevealPanel.tsx`
- Create: `apps/admin-web/src/components/admin/admin-components.test.tsx`

- [ ] **Step 1: Write wrapper tests**

Create `apps/admin-web/src/components/admin/admin-components.test.tsx`:

```tsx
import '@testing-library/jest-dom/vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DataTable } from './DataTable';
import { PageState } from './PageState';
import { SecretRevealPanel } from './SecretRevealPanel';

describe('admin components', () => {
  it('DataTable renders loading, empty, error and rows', () => {
    const columns = [{ key: 'name', header: '名称', render: (row: { name: string }) => row.name }];
    const { rerender } = render(<DataTable columns={columns} rows={[]} getRowKey={(row) => row.name} loading />);
    expect(screen.getByText('正在加载')).toBeInTheDocument();

    rerender(<DataTable columns={columns} rows={[]} getRowKey={(row) => row.name} emptyText="暂无数据" />);
    expect(screen.getByText('暂无数据')).toBeInTheDocument();

    rerender(<DataTable columns={columns} rows={[]} getRowKey={(row) => row.name} error="读取失败" />);
    expect(screen.getByText('读取失败')).toBeInTheDocument();

    rerender(<DataTable columns={columns} rows={[{ name: 'CRM' }]} getRowKey={(row) => row.name} />);
    expect(screen.getByRole('cell', { name: 'CRM' })).toBeInTheDocument();
  });

  it('PageState separates no-permission from empty state', () => {
    render(<PageState type="forbidden" title="没有权限" description="当前管理员无权访问该资源" />);
    expect(screen.getByRole('status')).toHaveTextContent('没有权限');
  });

  it('SecretRevealPanel copies secret and keeps the value in local panel only', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<SecretRevealPanel label="client_secret" value="client-secret-value" />);
    const region = screen.getByRole('region', { name: 'client_secret' });
    expect(within(region).getByText('client-secret-value')).toBeInTheDocument();
    await userEvent.click(within(region).getByRole('button', { name: '复制 client_secret' }));
    expect(writeText).toHaveBeenCalledWith('client-secret-value');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter @feishu-iam/admin-web test -- admin-components.test.tsx
```

Expected:

```text
FAIL，提示找不到 admin wrapper 组件。
```

- [ ] **Step 3: Implement wrapper public APIs**

Implement each wrapper with these contracts:

```ts
export type PageStateType = 'loading' | 'empty' | 'error' | 'forbidden';
export type DataTableColumn<T> = { key: string; header: string; render: (row: T) => ReactNode; className?: string };
export type FilterBarProps = { children: ReactNode; actions?: ReactNode; onReset?: () => void };
export type DetailSheetProps = { open: boolean; title: string; description?: ReactNode; onOpenChange: (open: boolean) => void; children: ReactNode };
export type FormDialogProps = { open: boolean; title: string; pending?: boolean; error?: string; onOpenChange: (open: boolean) => void; children: ReactNode };
export type ConfirmDialogProps = { open: boolean; title: string; description: string; pending?: boolean; danger?: boolean; onConfirm: () => void; onOpenChange: (open: boolean) => void };
```

Expected:

```text
Wrapper 只组合 `components/ui/*` 和 Tailwind token class，不调用业务 API。
```

- [ ] **Step 4: Run wrapper tests**

Run:

```bash
pnpm --filter @feishu-iam/admin-web test -- admin-components.test.tsx
```

Expected:

```text
PASS。
```

## Task 5: React Router And AppShell

**Files:**
- Create: `apps/admin-web/src/components/admin/AppShell.tsx`
- Create: `apps/admin-web/src/components/admin/PageHeader.tsx`
- Modify: `apps/admin-web/src/App.tsx`
- Modify: `apps/admin-web/src/App.test.tsx`

- [ ] **Step 1: Add router tests to App test**

Append tests to `apps/admin-web/src/App.test.tsx`:

```tsx
it('默认 /admin 入口进入记录查询', async () => {
  window.history.pushState({}, '', '/admin');
  render(<App />);
  await waitFor(() => expect(screen.getByRole('heading', { name: '记录查询' })).toBeInTheDocument());
});

it('应用创建 deep link 打开创建 Dialog', async () => {
  window.history.pushState({}, '', '/admin/applications?sheet=create');
  render(<App />);
  await waitFor(() => expect(screen.getByRole('dialog', { name: /新增应用/ })).toBeInTheDocument());
});
```

Expected:

```text
测试初始失败，因为 App 还没有 react-router 和 deep link 支持。
```

- [ ] **Step 2: Implement AppShell slots**

Create `apps/admin-web/src/components/admin/AppShell.tsx` with props:

```ts
export type AppShellNavItem = { href: string; label: string; active: boolean; disabled?: boolean };
export type AppShellProps = {
  brand: ReactNode;
  navItems: AppShellNavItem[];
  userMenu: ReactNode;
  children: ReactNode;
};
```

AppShell must render:

- Sidebar brand.
- Primary nav links.
- TopBar user menu and refresh slot.
- `<main>` content area.
- Mobile menu button with accessible label `打开导航` and Sheet content.

- [ ] **Step 3: Implement PageHeader**

Create `apps/admin-web/src/components/admin/PageHeader.tsx`:

```tsx
import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';

export function PageHeader(props: {
  title: string;
  description?: string;
  badges?: ReactNode;
  primaryAction?: ReactNode;
  secondaryActions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn('flex flex-col gap-3 border-b bg-background px-6 py-5 lg:flex-row lg:items-start lg:justify-between', props.className)}>
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold tracking-normal text-foreground">{props.title}</h1>
          {props.badges}
        </div>
        {props.description ? <p className="max-w-3xl text-sm text-muted-foreground">{props.description}</p> : null}
      </div>
      {(props.primaryAction || props.secondaryActions) ? (
        <div className="flex flex-wrap items-center gap-2">
          {props.secondaryActions}
          {props.primaryAction}
        </div>
      ) : null}
    </header>
  );
}
```

- [ ] **Step 4: Replace local route state with BrowserRouter**

Modify `apps/admin-web/src/App.tsx`:

- Wrap app content in `BrowserRouter`.
- Keep `fetchAdminMe()` auth boundary.
- Map `/admin` to `<Navigate to="/admin/records" replace />`.
- Add `/admin/records` and `/admin/applications`.
- Keep old pages for `/admin/permissions`、`/admin/admins`、`/admin/settings`、`/admin/workspace` until later slices.
- Keep `/admin/auth/login` as normal anchor href, not client route.

- [ ] **Step 5: Run router tests**

Run:

```bash
pnpm --filter @feishu-iam/admin-web test -- App.test.tsx
```

Expected:

```text
PASS，且现有 API 安全断言仍通过。
```

## Task 6: Records First Slice

**Files:**
- Create: `apps/admin-web/src/features/records/RecordQueryView.tsx`
- Create: `apps/admin-web/src/features/records/record-columns.tsx`
- Create: `apps/admin-web/src/features/records/record-mappers.ts`
- Modify: `apps/admin-web/src/routes/RecordQueryPage.tsx`
- Create: `apps/admin-web/src/features/records/RecordQueryView.test.tsx`

- [ ] **Step 1: Write records feature tests**

Create `apps/admin-web/src/features/records/RecordQueryView.test.tsx`:

```tsx
import '@testing-library/jest-dom/vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { RecordQueryPage } from '../../routes/RecordQueryPage';

describe('RecordQueryPage v0.10', () => {
  it('opens audit detail sheet from url', async () => {
    window.history.pushState({}, '', '/admin/records?tab=audit&sheet=audit:audit-1');
    render(
      <MemoryRouter initialEntries={['/admin/records?tab=audit&sheet=audit:audit-1']}>
        <RecordQueryPage />
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.getByRole('dialog', { name: /审计日志详情/ })).toBeInTheDocument());
  });

  it('updates query params when switching tabs', async () => {
    render(
      <MemoryRouter initialEntries={['/admin/records?tab=audit']}>
        <RecordQueryPage />
      </MemoryRouter>
    );
    await userEvent.click(screen.getByRole('tab', { name: '安全事件' }));
    expect(window.location.search).not.toContain('secret');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter @feishu-iam/admin-web test -- RecordQueryView.test.tsx
```

Expected:

```text
FAIL，旧页面没有 URL state 驱动的 Sheet。
```

- [ ] **Step 3: Implement record mappers**

Create `apps/admin-web/src/features/records/record-mappers.ts`:

```ts
import type { AdminAuditLog, AdminSecurityEvent } from '../../api/admin';
import type { FeishuSyncRun } from '../../api/feishu';

export type RecordRow =
  | { kind: 'audit'; id: string; createdAt: string; actor: string; action: string; target: string; requestId?: string | null; result: string; raw: AdminAuditLog }
  | { kind: 'security'; id: string; createdAt: string; actor: string; action: string; target: string; requestId?: string | null; result: string; raw: AdminSecurityEvent }
  | { kind: 'sync'; id: string; createdAt: string; actor: string; action: string; target: string; requestId?: string | null; result: string; raw: FeishuSyncRun };

export function mapAuditLog(item: AdminAuditLog): RecordRow {
  return {
    kind: 'audit',
    id: item.id,
    createdAt: item.createdAt,
    actor: item.actorId,
    action: item.action,
    target: `${item.resourceType}:${item.resourceId}`,
    requestId: item.requestId,
    result: item.result,
    raw: item
  };
}
```

Add equivalent `mapSecurityEvent` and `mapSyncRun` functions.

- [ ] **Step 4: Implement RecordQueryView**

Create `RecordQueryView.tsx` that:

- Reads `parseRecordSearch(useSearchParams()[0])`.
- Uses existing `fetchAdminAuditLogs`、`fetchAdminSecurityEvents`、`fetchFeishuSyncRuns`.
- Uses `Tabs` for `audit/security/sync/tokens`.
- Uses `FilterBar` for request id、action、applicationId、result.
- Uses `DataTable` for rows.
- Uses `DetailSheet` when `search.sheet` points to a selected row.
- Uses `PageState` for loading、empty、error、forbidden.

- [ ] **Step 5: Replace route page with new view**

Modify `apps/admin-web/src/routes/RecordQueryPage.tsx` to export only the new route wrapper:

```tsx
import { RecordQueryView } from '../features/records/RecordQueryView';

export function RecordQueryPage() {
  return <RecordQueryView />;
}
```

- [ ] **Step 6: Verify records legacy class removal**

Run:

```bash
rg -n "legacy-module-page|table-wrap|tab-list|tab-button|application-detail-drawer" apps/admin-web/src/routes/RecordQueryPage.tsx apps/admin-web/src/features/records
pnpm --filter @feishu-iam/admin-web test -- RecordQueryView.test.tsx
```

Expected:

```text
legacy class 搜索无输出；记录查询测试通过。
```

## Task 7: Applications First Slice

**Files:**
- Create: `apps/admin-web/src/features/applications/ApplicationManagementView.tsx`
- Create: `apps/admin-web/src/features/applications/ApplicationCreateDialog.tsx`
- Create: `apps/admin-web/src/features/applications/ApplicationDetailSheet.tsx`
- Create: `apps/admin-web/src/features/applications/application-form.ts`
- Modify: `apps/admin-web/src/routes/ApplicationManagementPage.tsx`
- Create: `apps/admin-web/src/features/applications/ApplicationManagementView.test.tsx`

- [ ] **Step 1: Write application form tests**

Create `apps/admin-web/src/features/applications/application-form.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { validateApplicationCreateInput } from './application-form';

describe('application form validation', () => {
  it('requires app key, name and redirect uri', () => {
    expect(validateApplicationCreateInput({ appKey: '', name: '', redirectUri: '' })).toEqual({
      appKey: '应用 key 不能为空',
      name: '应用名称不能为空',
      redirectUri: 'Redirect URI 不能为空'
    });
  });

  it('rejects non-url redirect uri', () => {
    expect(validateApplicationCreateInput({ appKey: 'crm', name: 'CRM', redirectUri: '/callback' }).redirectUri).toBe(
      'Redirect URI 必须是完整 URL'
    );
  });
});
```

- [ ] **Step 2: Implement form validation**

Create `apps/admin-web/src/features/applications/application-form.ts`:

```ts
export type ApplicationCreateDraft = {
  appKey: string;
  name: string;
  description?: string;
  ownerUserId?: string;
  redirectUri: string;
};

export type ApplicationCreateErrors = Partial<Record<keyof ApplicationCreateDraft, string>>;

export function validateApplicationCreateInput(input: ApplicationCreateDraft): ApplicationCreateErrors {
  const errors: ApplicationCreateErrors = {};
  if (!input.appKey.trim()) {
    errors.appKey = '应用 key 不能为空';
  }
  if (!input.name.trim()) {
    errors.name = '应用名称不能为空';
  }
  if (!input.redirectUri.trim()) {
    errors.redirectUri = 'Redirect URI 不能为空';
  } else {
    try {
      new URL(input.redirectUri);
    } catch {
      errors.redirectUri = 'Redirect URI 必须是完整 URL';
    }
  }
  return errors;
}
```

- [ ] **Step 3: Write application route tests**

Create `apps/admin-web/src/features/applications/ApplicationManagementView.test.tsx`:

```tsx
import '@testing-library/jest-dom/vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { ApplicationManagementPage } from '../../routes/ApplicationManagementPage';
import type { AdminMe } from '../../admin-types';

const admin: AdminMe = {
  adminUserId: 'admin-1',
  feishuUserId: 'ou_admin',
  displayName: '唐群管理员',
  roles: [{ roleKey: 'platform_admin', name: '平台管理员' }],
  applicationScopes: []
};

describe('ApplicationManagementPage v0.10', () => {
  it('opens create dialog from url', async () => {
    render(
      <MemoryRouter initialEntries={['/admin/applications?sheet=create']}>
        <ApplicationManagementPage admin={admin} onManagePermissions={() => undefined} onOpenRecords={() => undefined} />
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.getByRole('dialog', { name: /新增应用/ })).toBeInTheDocument());
  });
});
```

- [ ] **Step 4: Implement ApplicationCreateDialog**

Create a dialog that:

- Uses `FormDialog`.
- Validates with `validateApplicationCreateInput`.
- Calls existing `createApplication` from `api/permission`.
- Shows `SecretRevealPanel` for `clientSecret` and `developerApiToken` after success.
- Calls `onCreated(createdPackage)`.
- Never writes secret or token into URL.

- [ ] **Step 5: Implement ApplicationDetailSheet**

Create a Sheet that:

- Uses `DetailSheet`.
- Shows base info, redirect URI summary, OAuth credential summary, developer credential summary, integration prompt entry.
- Uses `ConfirmDialog` for enable/disable and secret rotate/view.
- Uses `CopyField` for `appKey`、`clientId`、Redirect URI.
- Displays request id in inline error if API returns one.

- [ ] **Step 6: Implement ApplicationManagementView**

Create a view that:

- Reads `parseApplicationSearch(useSearchParams()[0])`.
- Calls `fetchApplicationPage`.
- Renders `PageHeader`、`FilterBar`、`DataTable`.
- Opens create Dialog for `sheet=create`.
- Opens detail Sheet for `sheet=app:<appKey>`.
- Closes Sheet by removing only `sheet`.
- Keeps `q`、`status`、`page`、`pageSize` when opening and closing Sheet.

- [ ] **Step 7: Replace route page with new view**

Modify `apps/admin-web/src/routes/ApplicationManagementPage.tsx`:

```tsx
import type { AdminMe } from '../admin-types';
import { ApplicationManagementView } from '../features/applications/ApplicationManagementView';

export function ApplicationManagementPage(props: {
  admin: AdminMe;
  initialAppKey?: string | null;
  onManagePermissions: (appKey: string) => void;
  onOpenRecords: (applicationId: string) => void;
}) {
  return <ApplicationManagementView {...props} />;
}
```

- [ ] **Step 8: Verify application legacy class removal**

Run:

```bash
rg -n "legacy-module-page|table-wrap|tab-list|tab-button|application-detail-drawer" apps/admin-web/src/routes/ApplicationManagementPage.tsx apps/admin-web/src/features/applications
pnpm --filter @feishu-iam/admin-web test -- application-form.test.ts ApplicationManagementView.test.tsx
```

Expected:

```text
legacy class 搜索无输出；应用管理测试通过。
```

## Task 8: Legacy Cleanup And Full Verification

**Files:**
- Modify: `apps/admin-web/src/App.css`
- Modify: `apps/admin-web/src/App.test.tsx`
- Optional delete after no imports remain: `apps/admin-web/src/components/DataTable.tsx`
- Optional delete after no imports remain: `apps/admin-web/src/components/DataToolbar.tsx`
- Optional delete after no imports remain: `apps/admin-web/src/components/DetailDrawer.tsx`
- Optional delete after no imports remain: `apps/admin-web/src/components/FormModal.tsx`

- [ ] **Step 1: Check old component imports**

Run:

```bash
rg -n "components/(DataTable|DataToolbar|DetailDrawer|FormModal)|from '../components/(DataTable|DataToolbar|DetailDrawer|FormModal)'|from './components/(DataTable|DataToolbar|DetailDrawer|FormModal)'" apps/admin-web/src
```

Expected:

```text
切片页面不再引用旧 wrapper；如果权限管理等后续模块仍引用旧 wrapper，保留旧文件并在注释或文档中标明后续切片删除。
```

- [ ] **Step 2: Remove cut-slice legacy CSS dependency**

Run:

```bash
rg -n "legacy-module-page|table-wrap|tab-list|tab-button|application-detail-drawer" apps/admin-web/src/routes/RecordQueryPage.tsx apps/admin-web/src/routes/ApplicationManagementPage.tsx apps/admin-web/src/features
```

Expected:

```text
无输出。
```

- [ ] **Step 3: Run frontend gates**

Run:

```bash
pnpm --filter @feishu-iam/admin-web typecheck
pnpm --filter @feishu-iam/admin-web test
pnpm --filter @feishu-iam/admin-web build
```

Expected:

```text
三条命令均 PASS。
```

- [ ] **Step 4: Run whole-repo gate**

Run:

```bash
pnpm check
```

Expected:

```text
PASS。
```

## Task 9: Browser Verification And Release Readiness Notes

**Files:**
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Create: `docs/codex-sessions/YYYY-MM-DD-HHMM-v0.10.0-admin-web-first-slice.md`

- [ ] **Step 1: Start local environment**

Run:

```bash
pnpm compose:up
```

Expected:

```text
API ready，管理后台可通过 http://localhost:3000/ 访问。
```

- [ ] **Step 2: Browser verify local admin web**

Use gstack `/browse` against:

```text
http://localhost:3000/
http://localhost:3000/admin/records?tab=audit&page=1
http://localhost:3000/admin/applications?sheet=create
```

Expected:

```text
1440、768、390 视口下无页面级横向溢出；console 无非预期错误；Network 无非预期失败请求；记录查询和应用管理截图显示 shadcn/tweakcn 运行时。
```

- [ ] **Step 3: Update version documentation**

Update `CHANGELOG.md` with a `v0.10.0` unreleased entry describing:

- 管理后台运行时迁移到 Tailwind + shadcn/ui + tweakcn token。
- 引入 `react-router` 深链。
- 第一可信切片覆盖记录查询和应用管理。
- 未完成模块仍待后续切片迁移。

Update `README.md` version history with a `v0.10.0` row. Before final release, replace unreleased wording with image tag、digest、部署证据。

- [ ] **Step 4: Archive session**

Create `docs/codex-sessions/YYYY-MM-DD-HHMM-v0.10.0-admin-web-first-slice.md` with:

- 会话目标。
- 用户关键要求。
- 使用的设计和工程约束。
- 修改文件。
- 执行命令和结果。
- 浏览器验证结果。
- 剩余风险和下一步。

## Self-Review Checklist

- [ ] 每个 task 都有明确文件路径。
- [ ] 第一可信切片没有扩展到权限管理、管理员授权、系统设置和工作台完整迁移。
- [ ] URL state 不序列化 secret、token、cookie 或表单草稿。
- [ ] 记录查询和应用管理切片文件不再出现 legacy class。
- [ ] 计划允许第 7 步优先使用 `subagent-driven-development`，并明确共享文件串行合并点。
- [ ] 必跑命令包含 `pnpm --filter @feishu-iam/admin-web typecheck`、`test`、`build` 和 `pnpm check`。
- [ ] Browser 验收包含 1440、768、390 视口。

## Execution Handoff

计划已按 subagent 优先执行方式拆分。第 7 步执行时优先使用 `superpowers:subagent-driven-development`；如果执行器无法保证共享文件串行合并，改用 `superpowers:executing-plans`。
