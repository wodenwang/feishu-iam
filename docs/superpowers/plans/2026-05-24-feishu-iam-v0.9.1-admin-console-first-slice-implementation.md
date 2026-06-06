# Feishu IAM v0.9.1 Admin Console First Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 交付 v0.9.1 第一条可验收垂直切片：shadcn/ui + tweakcn 风格的管理后台基础壳层，以及“应用接入包”创建、查看、复制和高风险凭证操作主路径。

**Architecture:** 本切片以 `apps/admin-web` 为主，先建立 shadcn/tweakcn 视觉与交互基础，再把应用管理页收敛为“应用清单 -> 创建接入包 Sheet -> 详情 Sheet”的主流程。现有后端仍是 `application_environment -> redirect_uri/client` 模型，因此本切片不伪造新后端能力：前端用 `dev` 环境作为当前单环境兼容层，并在计划内明确后续移除环境模型的后端迁移边界。

**Tech Stack:** React 19、Vite、TypeScript、Vitest、Testing Library、lucide-react、Tailwind CSS、shadcn/ui/Radix 基础组件、现有 Feishu IAM Admin API。

---

## Scope Boundary

本计划只覆盖 v0.9.1 第一条垂直切片：

- 管理后台基础壳层和设计变量落地。
- 应用管理清单的视觉重构。
- 创建应用接入包主流程。
- 应用详情 Sheet 的接入信息、回调地址、凭证、操作记录入口。
- 凭证查看、复制、轮换、禁用等高风险确认交互。

本计划不覆盖：

- 权限管理、管理员授权、记录查询、工作台、系统设置的业务重构。
- 完整后端数据模型迁移。
- 多环境 dev/test/prod 的新 UI。
- release、tag、镜像发布、远端部署。
- 飞书角色、飞书用户组、资源级权限、ABAC。

## Current Contract Facts

当前代码事实必须在执行前重新确认：

- `apps/admin-web/src/api/applications.ts` 只提供应用创建、更新、启用、禁用。
- `apps/admin-web/src/api/oauth.ts` 仍提供 `ApplicationEnvironment`、`ApplicationRedirectUri`、`ApplicationClient`，接口路径仍是 `/api/v1/admin/applications/:appKey/environments/:environmentId/...`。
- `apps/api/src/admin/admin-oauth-config.controller.ts` 后端管理 API 仍以 environment 为 OAuth 配置容器。
- `apps/admin-web/package.json` 尚未引入 Tailwind、Radix、class variance 等 shadcn 依赖。
- `apps/admin-web/src/routes/ApplicationManagementPage.tsx` 当前页面已包含环境、Redirect URI、OAuth 凭证、开发者凭证、操作记录多个 tab，需拆薄并改为 Sheet 主范式。

## File Structure

- Modify: `apps/admin-web/package.json`  
  引入 Tailwind、Radix、class 组合工具和必要 shadcn 依赖。
- Modify/Create: `apps/admin-web/tailwind.config.ts`、`apps/admin-web/postcss.config.js`、`apps/admin-web/src/index.css` 或现有入口样式文件  
  建立 tweakcn 风格变量、字体、背景、ring、border、radius。
- Create: `apps/admin-web/src/lib/utils.ts`  
  提供 `cn()`。
- Create: `apps/admin-web/src/components/ui/*.tsx`  
  放置 button、input、label、sheet、dialog、badge、table、tabs、toast 等基础 UI。
- Create: `apps/admin-web/src/routes/applications/application-package.ts`  
  定义应用接入包 view model、兼容层函数、表单校验。
- Create: `apps/admin-web/src/routes/applications/ApplicationList.tsx`  
  应用清单、筛选、空态、错误态和行操作。
- Create: `apps/admin-web/src/routes/applications/ApplicationPackageSheet.tsx`  
  创建接入包 Sheet、成功后一次性 secret 展示和复制。
- Create: `apps/admin-web/src/routes/applications/ApplicationDetailSheet.tsx`  
  应用详情 Sheet、接入信息、回调地址、client 信息和操作记录入口。
- Create: `apps/admin-web/src/routes/applications/CredentialDangerDialog.tsx`  
  凭证查看、轮换、禁用确认弹窗。
- Modify: `apps/admin-web/src/routes/ApplicationManagementPage.tsx`  
  改为组合上述子组件的页面容器。
- Modify: `apps/admin-web/src/api/oauth.ts`  
  增加 first-slice 兼容 API helper，不移除旧 API，确保其它页面不受影响。
- Test: `apps/admin-web/src/routes/applications/*.test.tsx`、`apps/admin-web/src/routes/ApplicationManagementPage.test.tsx`  
  覆盖创建、详情、复制、轮换确认、禁用确认、空态和错误态。
- Modify: `docs/codex-sessions/<timestamp>-v0.9.1-admin-console-first-slice.md`  
  执行完成后归档会话。

## Task 0: Worktree And Baseline Guard

**Files:**
- Read only: repository root

- [ ] **Step 1: Confirm current Git state**

Run:

```bash
git status --short
git branch --show-current
```

Expected:

```text
当前分支和未提交文件清晰可见；如存在非本切片大量修改，停止并创建隔离 worktree 或请求用户确认在当前目录执行。
```

- [ ] **Step 2: Verify design and planning artifacts exist**

Run:

```bash
test -f DESIGN.md
test -f design/admin-console-v0.9.1.pen
test -f design/pencil-input-v0.9.1.md
test -f docs/superpowers/specs/2026-05-24-feishu-iam-v0.9.1-admin-console-rearchitecture-design.md
test -f docs/superpowers/plans/2026-05-24-feishu-iam-v0.9.1-admin-console-rearchitecture.md
```

Expected:

```text
所有命令退出码为 0。
```

- [ ] **Step 3: Re-read implementation boundary**

Run:

```bash
sed -n '1,220p' docs/superpowers/plans/2026-05-24-feishu-iam-v0.9.1-admin-console-rearchitecture.md
sed -n '1,220p' design/pencil-input-v0.9.1.md
```

Expected:

```text
范围仍然是 shadcn/ui 基础壳层 + 应用接入包主路径；未新增权限管理、记录查询、部署或 release 要求。
```

## Task 1: Contract Tests For The Application Package Adapter

**Files:**
- Create: `apps/admin-web/src/routes/applications/application-package.ts`
- Create: `apps/admin-web/src/routes/applications/application-package.test.ts`

- [ ] **Step 1: Write failing adapter tests**

Create `apps/admin-web/src/routes/applications/application-package.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  buildDefaultEnvironmentInput,
  buildPackageSummary,
  validateApplicationPackageInput
} from './application-package';

describe('application package adapter', () => {
  it('validates required app key, name and redirect uri', () => {
    expect(validateApplicationPackageInput({ appKey: '', name: '', redirectUri: '' })).toEqual({
      appKey: '应用 key 不能为空',
      name: '应用名称不能为空',
      redirectUri: '回调地址不能为空'
    });
  });

  it('rejects callback urls that are not absolute urls', () => {
    expect(
      validateApplicationPackageInput({
        appKey: 'finance',
        name: '财务系统',
        redirectUri: '/callback'
      }).redirectUri
    ).toBe('回调地址必须是完整 URL');
  });

  it('uses the current single-environment compatibility layer', () => {
    expect(buildDefaultEnvironmentInput()).toEqual({
      environmentKey: 'dev',
      name: '默认接入环境'
    });
  });

  it('builds a package summary without exposing client secret unless provided once', () => {
    expect(
      buildPackageSummary({
        application: {
          id: 'app-1',
          appKey: 'finance',
          name: '财务系统',
          description: null,
          ownerUserId: null,
          status: 'active',
          createdAt: '2026-05-24T08:00:00.000Z',
          updatedAt: '2026-05-24T08:00:00.000Z'
        },
        environment: {
          id: 'env-1',
          applicationId: 'app-1',
          environmentKey: 'dev',
          name: '默认接入环境',
          status: 'active'
        },
        redirectUris: [{ id: 'uri-1', environmentId: 'env-1', redirectUri: 'http://localhost:5173/callback', status: 'active' }],
        clients: [{ id: 'client-1', environmentId: 'env-1', clientId: 'bic_test', name: '默认 OAuth Client', status: 'active', lastUsedAt: null }]
      })
    ).toMatchObject({
      appKey: 'finance',
      callbackUrl: 'http://localhost:5173/callback',
      clientId: 'bic_test',
      clientSecret: undefined
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter @feishu-iam/admin-web test -- application-package.test.ts
```

Expected:

```text
FAIL，提示找不到 ./application-package 或导出的函数。
```

- [ ] **Step 3: Implement adapter**

Create `apps/admin-web/src/routes/applications/application-package.ts`:

```ts
import type { Application } from '../../api/permission';
import type {
  ApplicationClient,
  ApplicationEnvironment,
  ApplicationRedirectUri,
  CreatedApplicationClient
} from '../../api/oauth';

export type ApplicationPackageInput = {
  appKey: string;
  name: string;
  description?: string;
  ownerUserId?: string;
  redirectUri: string;
};

export type ApplicationPackageErrors = Partial<Record<keyof ApplicationPackageInput, string>>;

export type ApplicationPackageSummary = {
  appKey: string;
  name: string;
  status: Application['status'];
  callbackUrl?: string;
  clientId?: string;
  clientSecret?: string;
};

export function validateApplicationPackageInput(input: ApplicationPackageInput): ApplicationPackageErrors {
  const errors: ApplicationPackageErrors = {};
  if (!input.appKey.trim()) {
    errors.appKey = '应用 key 不能为空';
  }
  if (!input.name.trim()) {
    errors.name = '应用名称不能为空';
  }
  if (!input.redirectUri.trim()) {
    errors.redirectUri = '回调地址不能为空';
  } else {
    try {
      new URL(input.redirectUri);
    } catch {
      errors.redirectUri = '回调地址必须是完整 URL';
    }
  }
  return errors;
}

export function buildDefaultEnvironmentInput(): { environmentKey: 'dev'; name: string } {
  return { environmentKey: 'dev', name: '默认接入环境' };
}

export function buildPackageSummary(params: {
  application: Application;
  environment?: ApplicationEnvironment;
  redirectUris: ApplicationRedirectUri[];
  clients: ApplicationClient[];
  createdClient?: CreatedApplicationClient;
}): ApplicationPackageSummary {
  const client = params.createdClient ?? params.clients[0];
  return {
    appKey: params.application.appKey,
    name: params.application.name,
    status: params.application.status,
    callbackUrl: params.redirectUris[0]?.redirectUri,
    clientId: client?.clientId,
    clientSecret: params.createdClient?.clientSecret
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
pnpm --filter @feishu-iam/admin-web test -- application-package.test.ts
```

Expected:

```text
PASS apps/admin-web/src/routes/applications/application-package.test.ts
```

## Task 2: Install And Wire shadcn/tweakcn Foundation

**Files:**
- Modify: `apps/admin-web/package.json`
- Create/Modify: `apps/admin-web/tailwind.config.ts`
- Create/Modify: `apps/admin-web/postcss.config.js`
- Modify: `apps/admin-web/src/App.css`
- Create: `apps/admin-web/src/lib/utils.ts`
- Create: `apps/admin-web/src/components/ui/button.tsx`
- Create: `apps/admin-web/src/components/ui/input.tsx`
- Create: `apps/admin-web/src/components/ui/badge.tsx`
- Create: `apps/admin-web/src/components/ui/dialog.tsx`
- Create: `apps/admin-web/src/components/ui/sheet.tsx`

- [ ] **Step 1: Add dependencies**

Run:

```bash
pnpm --filter @feishu-iam/admin-web add @radix-ui/react-dialog @radix-ui/react-slot class-variance-authority clsx tailwind-merge tailwindcss-animate
pnpm --filter @feishu-iam/admin-web add -D tailwindcss postcss autoprefixer
```

Expected:

```text
apps/admin-web/package.json 和 pnpm-lock.yaml 更新；未引入与本切片无关的大型组件库。
```

- [ ] **Step 2: Add `cn()` helper**

Create `apps/admin-web/src/lib/utils.ts`:

```ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 3: Add Tailwind config**

Create `apps/admin-web/tailwind.config.ts`:

```ts
import type { Config } from 'tailwindcss';

export default {
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
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))'
        }
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)'
      }
    }
  },
  plugins: [require('tailwindcss-animate')]
} satisfies Config;
```

- [ ] **Step 4: Add PostCSS config**

Create `apps/admin-web/postcss.config.js`:

```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {}
  }
};
```

- [ ] **Step 5: Replace global visual tokens**

Modify `apps/admin-web/src/App.css` so the top of the file contains:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --background: 210 30% 98%;
  --foreground: 216 38% 16%;
  --primary: 203 72% 22%;
  --primary-foreground: 0 0% 100%;
  --secondary: 174 48% 36%;
  --secondary-foreground: 0 0% 100%;
  --muted: 206 28% 93%;
  --muted-foreground: 213 18% 38%;
  --destructive: 0 70% 45%;
  --destructive-foreground: 0 0% 100%;
  --border: 210 20% 86%;
  --input: 210 20% 88%;
  --ring: 174 48% 36%;
  --radius: 0.5rem;
}
```

Expected:

```text
页面主色保持深蓝、青绿、白色，避免紫蓝渐变、营销 hero 和卡片堆叠。
```

## Task 3: Application Package Creation Flow

**Files:**
- Create: `apps/admin-web/src/routes/applications/ApplicationPackageSheet.tsx`
- Modify: `apps/admin-web/src/routes/ApplicationManagementPage.tsx`
- Test: `apps/admin-web/src/routes/applications/ApplicationPackageSheet.test.tsx`

- [ ] **Step 1: Write failing component test**

Create `apps/admin-web/src/routes/applications/ApplicationPackageSheet.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ApplicationPackageSheet } from './ApplicationPackageSheet';

describe('ApplicationPackageSheet', () => {
  it('shows field-level validation before submit', async () => {
    const user = userEvent.setup();
    render(<ApplicationPackageSheet open onOpenChange={() => undefined} onCreated={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: '创建接入包' }));

    expect(screen.getByText('应用 key 不能为空')).toBeInTheDocument();
    expect(screen.getByText('应用名称不能为空')).toBeInTheDocument();
    expect(screen.getByText('回调地址不能为空')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter @feishu-iam/admin-web test -- ApplicationPackageSheet.test.tsx
```

Expected:

```text
FAIL，提示找不到 ApplicationPackageSheet。
```

- [ ] **Step 3: Implement Sheet skeleton and validation**

Create `apps/admin-web/src/routes/applications/ApplicationPackageSheet.tsx` with these public props:

```tsx
import { useState } from 'react';
import { validateApplicationPackageInput, type ApplicationPackageInput } from './application-package';

export function ApplicationPackageSheet(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState<ApplicationPackageInput>({ appKey: '', name: '', description: '', ownerUserId: '', redirectUri: '' });
  const [errors, setErrors] = useState<Partial<Record<keyof ApplicationPackageInput, string>>>({});

  function submit() {
    const nextErrors = validateApplicationPackageInput(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }
    props.onCreated();
  }

  if (!props.open) {
    return null;
  }

  return (
    <section role="dialog" aria-label="创建应用接入包">
      <h2>创建应用接入包</h2>
      <label>
        应用 key
        <input value={form.appKey} onChange={(event) => setForm((current) => ({ ...current, appKey: event.target.value }))} />
      </label>
      {errors.appKey ? <p>{errors.appKey}</p> : null}
      <label>
        应用名称
        <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
      </label>
      {errors.name ? <p>{errors.name}</p> : null}
      <label>
        回调地址
        <input value={form.redirectUri} onChange={(event) => setForm((current) => ({ ...current, redirectUri: event.target.value }))} />
      </label>
      {errors.redirectUri ? <p>{errors.redirectUri}</p> : null}
      <button type="button" onClick={submit}>创建接入包</button>
      <button type="button" onClick={() => props.onOpenChange(false)}>取消</button>
    </section>
  );
}
```

- [ ] **Step 4: Replace skeleton markup with shadcn Sheet once UI primitives exist**

Keep the same accessible names:

```text
dialog: 创建应用接入包
primary button: 创建接入包
secondary button: 取消
field labels: 应用 key、应用名称、回调地址
```

- [ ] **Step 5: Run component test**

Run:

```bash
pnpm --filter @feishu-iam/admin-web test -- ApplicationPackageSheet.test.tsx
```

Expected:

```text
PASS apps/admin-web/src/routes/applications/ApplicationPackageSheet.test.tsx
```

## Task 4: Compatibility API For Creating One Application Package

**Files:**
- Modify: `apps/admin-web/src/api/oauth.ts`
- Modify: `apps/admin-web/src/routes/applications/ApplicationPackageSheet.tsx`
- Test: `apps/admin-web/src/routes/applications/application-package.test.ts`

- [ ] **Step 1: Add API helper contract**

Append to `apps/admin-web/src/api/oauth.ts`:

```ts
export async function createDefaultApplicationPackageConfig(
  appKey: string,
  input: { redirectUri: string; clientName?: string }
): Promise<{
  environment: ApplicationEnvironment;
  redirectUri: ApplicationRedirectUri;
  client: CreatedApplicationClient;
}> {
  const environment = await createApplicationEnvironment(appKey, {
    environmentKey: 'dev',
    name: '默认接入环境'
  });
  const redirectUri = await createRedirectUri(appKey, environment.id, { redirectUri: input.redirectUri });
  const client = await createApplicationClient(appKey, environment.id, { name: input.clientName ?? '默认 OAuth Client' });
  return { environment, redirectUri, client };
}
```

Expected:

```text
该 helper 明确是 v0.9.1 first-slice 兼容层，不改变后端接口。
```

- [ ] **Step 2: Wire create flow**

In `ApplicationPackageSheet.tsx`, submit order must be:

```text
createApplication -> createDefaultApplicationPackageConfig -> show one-time clientSecret -> refresh application list
```

Do not persist `clientSecret` after closing the Sheet.

- [ ] **Step 3: Add rollback note in UI error handling**

If application creation succeeds but OAuth config creation fails, show:

```text
应用已创建，但接入配置未完成。请进入应用详情继续补齐回调地址和 OAuth Client。
```

Do not attempt destructive rollback from the frontend.

## Task 5: Application List And Detail Sheet

**Files:**
- Create: `apps/admin-web/src/routes/applications/ApplicationList.tsx`
- Create: `apps/admin-web/src/routes/applications/ApplicationDetailSheet.tsx`
- Modify: `apps/admin-web/src/routes/ApplicationManagementPage.tsx`
- Test: `apps/admin-web/src/routes/ApplicationManagementPage.test.tsx`

- [ ] **Step 1: Write page-level smoke test**

Create or update `apps/admin-web/src/routes/ApplicationManagementPage.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ApplicationManagementPage } from './ApplicationManagementPage';

vi.mock('../api/permission', async () => {
  const actual = await vi.importActual<typeof import('../api/permission')>('../api/permission');
  return {
    ...actual,
    fetchApplications: vi.fn().mockResolvedValue([
      {
        id: 'app-1',
        appKey: 'finance',
        name: '财务系统',
        description: '内部财务应用',
        ownerUserId: 'ou_user',
        status: 'active',
        createdAt: '2026-05-24T08:00:00.000Z',
        updatedAt: '2026-05-24T08:00:00.000Z'
      }
    ])
  };
});

describe('ApplicationManagementPage', () => {
  it('renders the application package entry point and list', async () => {
    render(<ApplicationManagementPage />);
    expect(screen.getByRole('button', { name: '创建应用接入包' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('财务系统')).toBeInTheDocument());
    expect(screen.getByText('finance')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails or captures old UI**

Run:

```bash
pnpm --filter @feishu-iam/admin-web test -- ApplicationManagementPage.test.tsx
```

Expected:

```text
FAIL 或旧页面断言不匹配，说明页面尚未收敛到新主路径。
```

- [ ] **Step 3: Refactor page container**

`ApplicationManagementPage.tsx` should become a thin container:

```tsx
export function ApplicationManagementPage() {
  return (
    <AdminPage
      title="应用接入"
      subtitle="为内部系统创建 Feishu IAM 接入包，管理回调地址、OAuth Client 和接入凭证。"
      actions={<button type="button">创建应用接入包</button>}
    >
      {/* ApplicationList + ApplicationPackageSheet + ApplicationDetailSheet */}
    </AdminPage>
  );
}
```

Expected:

```text
页面默认只展示清单、筛选、分页和主操作；详情进入右侧 Sheet。
```

- [ ] **Step 4: Move old environment tabs out of the default visible path**

Do not show `dev/test/prod` tabs. When兼容层仍需读取环境，文案统一称为：

```text
默认接入配置
```

Expected:

```text
用户不会在第一屏看到环境模型；但代码仍可调用现有 API。
```

## Task 6: Credential Danger Actions

**Files:**
- Create: `apps/admin-web/src/routes/applications/CredentialDangerDialog.tsx`
- Modify: `apps/admin-web/src/routes/applications/ApplicationDetailSheet.tsx`
- Test: `apps/admin-web/src/routes/applications/CredentialDangerDialog.test.tsx`

- [ ] **Step 1: Write confirmation test**

Create `apps/admin-web/src/routes/applications/CredentialDangerDialog.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CredentialDangerDialog } from './CredentialDangerDialog';

describe('CredentialDangerDialog', () => {
  it('requires exact app key before confirming secret rotation', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<CredentialDangerDialog open appKey="finance" action="rotate" pending={false} onOpenChange={() => undefined} onConfirm={onConfirm} />);

    expect(screen.getByRole('button', { name: '确认轮换' })).toBeDisabled();
    await user.type(screen.getByLabelText('输入应用 key 确认'), 'finance');
    await user.click(screen.getByRole('button', { name: '确认轮换' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Implement dialog**

Create `apps/admin-web/src/routes/applications/CredentialDangerDialog.tsx`:

```tsx
import { useState } from 'react';

type DangerAction = 'view' | 'rotate' | 'disable';

const labelByAction: Record<DangerAction, string> = {
  view: '确认查看',
  rotate: '确认轮换',
  disable: '确认禁用'
};

export function CredentialDangerDialog(props: {
  open: boolean;
  appKey: string;
  action: DangerAction;
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  const [value, setValue] = useState('');
  if (!props.open) {
    return null;
  }
  const confirmed = value === props.appKey;
  return (
    <section role="alertdialog" aria-label={labelByAction[props.action]}>
      <p>此操作会影响第三方系统接入，请输入应用 key 确认。</p>
      <label>
        输入应用 key 确认
        <input value={value} onChange={(event) => setValue(event.target.value)} />
      </label>
      <button type="button" disabled={!confirmed || props.pending} onClick={props.onConfirm}>
        {labelByAction[props.action]}
      </button>
      <button type="button" onClick={() => props.onOpenChange(false)}>取消</button>
    </section>
  );
}
```

- [ ] **Step 3: Wire actions**

In `ApplicationDetailSheet.tsx`, call existing API helpers:

```text
viewApplicationClientSecret(appKey, clientId)
rotateApplicationClientSecret(appKey, clientId)
disableApplicationClient(appKey, clientId)
```

Expected:

```text
查看和轮换 secret 只在本次弹窗中展示一次；关闭后不再保留明文。
```

## Task 7: Verification Before Completion

**Files:**
- Read only unless fixing findings

- [ ] **Step 1: Run admin-web focused checks**

Run:

```bash
pnpm --filter @feishu-iam/admin-web typecheck
pnpm --filter @feishu-iam/admin-web test
pnpm --filter @feishu-iam/admin-web lint
```

Expected:

```text
全部通过；如失败，修复 first-slice 范围内的问题后重跑。
```

- [ ] **Step 2: Run repo-level check if focused checks pass**

Run:

```bash
pnpm check
```

Expected:

```text
通过，或仅存在与本切片无关且已记录的既有失败。
```

- [ ] **Step 3: Start local app**

Run:

```bash
pnpm compose:up
pnpm --filter @feishu-iam/admin-web dev
```

Expected:

```text
管理后台可通过 http://localhost:3000/ 或当前 Vite 输出地址访问。
```

- [ ] **Step 4: Browser self-check**

Use Browser or gstack browse to verify:

```text
1. 应用清单无明显布局错位、溢出、遮挡。
2. 创建应用接入包 Sheet 可打开，字段校验贴近字段。
3. 成功路径展示一次性 secret；关闭后不保留明文。
4. 详情 Sheet 可打开，回到清单时筛选状态保留。
5. 凭证查看、轮换、禁用均有确认输入。
6. Console 无新增错误，Network 无非预期失败请求。
```

## Task 8: Documentation And Session Archive

**Files:**
- Modify: `README.md` if v0.9.1 user-facing behavior changes need记录
- Create: `docs/codex-sessions/YYYY-MM-DD-HHMM-v0.9.1-admin-console-first-slice.md`

- [ ] **Step 1: Update user-facing docs only if behavior is actually delivered**

If implementation completed, add a short Chinese note to README describing:

```text
v0.9.1 管理后台第一切片提供应用接入包创建、查看和凭证操作主路径；后端 OAuth 配置仍复用默认 dev 环境兼容层，后续版本再迁移为应用级接入包模型。
```

- [ ] **Step 2: Create session archive**

Archive must include:

```text
会话目标
用户原始关键要求摘要
本次使用的 skill 和约束
关键设计/工程决策
修改文件
验证命令和结果
未完成事项和下一步建议
```

- [ ] **Step 3: Check for placeholders and sensitive content**

Run:

```bash
rg -n "待补充|占位符|真实凭证|明文密钥|测试密码" README.md docs/codex-sessions docs/superpowers/plans
```

Expected:

```text
没有新增未处理占位符；没有明文敏感凭证。
```

## Execution Notes

- 推荐使用 `superpowers:executing-plans` inline 执行，因为第一切片的 UI、API 兼容层和页面容器高度耦合。
- 只有在创建隔离 worktree 后，才推荐使用 `superpowers:subagent-driven-development` 拆分任务。
- 当前仓库存在大量未提交修改时，不要在同一目录直接开始 Task 1 代码实现；先请求用户确认隔离 worktree 或当前目录执行策略。
- 本计划不授权 push、PR、merge、tag、release、镜像上传或部署。

## Self-Review

- Spec coverage: 覆盖 Pencil 最终稿中的应用清单、创建接入包、详情 Sheet、高风险确认弹框和设计系统基线；不覆盖后续模块。
- Placeholder scan: 本计划没有未解释的占位符。
- Type consistency: `Application` 来自 `api/permission`，`ApplicationEnvironment`、`ApplicationRedirectUri`、`ApplicationClient`、`CreatedApplicationClient` 来自 `api/oauth`，与当前代码一致。
