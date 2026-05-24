# feishu-iam v0.1.3 Admin Console HTTP service 切换 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 Admin Console 的第一个可验收路径从 mock-only 切到真实 Fastify HTTP runtime：session、initialization、applications list/create、one-time secret、audit visible。

**Architecture:** 前端新增 `iamService` facade，根据 `VITE_IAM_API_MODE=mock|http` 选择 `mockApi` 或 `httpApi`；HTTP mode 通过 `httpClient` 和 `dtoMappers` 集中处理 fetch、cookie、错误、requestId、snake_case 到 camelCase。后端只做支撑 UI 的小 contract 补齐：session 权限派生、applications 分页/secret envelope、audit logs 分页和筛选。

**Tech Stack:** React 19、TypeScript、Vite、Ant Design、TanStack Query、Fastify、PostgreSQL、Vitest、Playwright、gstack `/browser`。

---

## Source Inputs

- Design review: `/Users/wenzhewang/.gstack/projects/wodenwang-feishu-iam/wenzhewang-codex-v0.1.3-http-service-plan-design-20260524-112049.md`
- Engineering review: `/Users/wenzhewang/.gstack/projects/wodenwang-feishu-iam/wenzhewang-codex-v0.1.3-http-service-plan-eng-review-20260524-113957.md`
- Branch: `codex/v0.1.3-http-service-plan`

## Scope

### In Scope: First Vertical Slice

1. HTTP mode service facade and mode switch.
2. Same-origin `/api` proxy for local HTTP mode.
3. HTTP mode Login dev mock Feishu login.
4. HTTP mode session loading and 401 recovery.
5. Initialization status and bind platform admin.
6. Applications list/create through runtime.
7. One-time `appSecret` / `apiSecret` modal after create.
8. AuditLogs list and `application.create` visibility through runtime.
9. HTTP mode loading/empty/API error/401/403/409/requestId handling for the touched path.
10. README instructions and browser verification checklist.

### Out of Scope For This Plan

- Roles UI/runtime implementation.
- Directory UI/runtime implementation.
- Dashboard/Sync/Application Detail/Onboarding partial runtime-backed work.
- Real Feishu OAuth callback.
- Real directory sync.
- Full Docker/CI/deploy/release automation.
- Complete 401/403/409 matrix beyond the first vertical slice.

Roles and Directory remain planned later slices for v0.1.3, but their implementation tasks are intentionally not expanded here.

## File Structure

### Create

- `src/features/iam/apiMode.ts`  
  Reads and validates `VITE_IAM_API_MODE`; exposes current mode and API base URL.

- `src/features/iam/apiMode.test.ts`  
  Unit tests for default mock mode, explicit http mode, invalid mode, and base URL normalization.

- `src/features/iam/httpClient.ts`  
  Shared fetch wrapper with `credentials: 'include'`, query string building, JSON parsing, and `IamHttpError`.

- `src/features/iam/httpClient.test.ts`  
  Unit tests for success responses, 401/403/409/500, malformed JSON, network errors, and requestId preservation.

- `src/features/iam/dtoMappers.ts`  
  Converts backend runtime DTOs to existing front-end types.

- `src/features/iam/dtoMappers.test.ts`  
  Unit tests for session, applications, create application result, audit logs, and pagination mapping.

- `src/features/iam/httpApi.ts`  
  HTTP implementation of the IAM service methods required by the first vertical slice.

- `src/features/iam/iamService.ts`  
  Mode-based facade exporting the service consumed by `queries.ts`.

- `tests/e2e/v0.1.3-admin-console-http.spec.ts`  
  Scripted browser regression for the first vertical slice. This supplements, not replaces, gstack `/browser`.

### Modify

- `vite.config.ts`  
  Add `/api` proxy to `http://127.0.0.1:4100`.

- `server/src/modules/auth/authRoutes.ts`  
  Return a front-end-friendly current session contract.

- `server/src/modules/applications/applicationRoutes.ts`  
  Add pagination/total, create response envelope, and list count fields.

- `server/src/modules/applications/applicationRepository.ts`  
  Keep one-time secrets out of normal application DTOs; support create envelope cleanly.

- `server/src/modules/audit/auditRoutes.ts`  
  Add pagination and core filters.

- `src/features/iam/types.ts`  
  Add `ApiMode`, `IamHttpError`, `CreateApplicationResult`, and HTTP mode helper types if needed.

- `src/features/iam/queries.ts`  
  Replace direct `mockApi` import with `iamService`.

- `src/app/App.tsx`  
  Route Login/Initialize through runtime-aware page props or wrappers.

- `src/layouts/AdminLayout.tsx`  
  Show `Mock data` / `HTTP runtime`; distinguish 401, 403, and API errors.

- `src/pages/Login/index.tsx`  
  Add HTTP mode dev mock Feishu login behavior.

- `src/pages/Initialize/index.tsx`  
  Connect initialization status and bind platform admin mutation.

- `src/pages/Applications/List.tsx`  
  In HTTP mode, use minimal create form; show one-time secret modal; map 409 to field error; show requestId on errors.

- `src/pages/AuditLogs/index.tsx`  
  Use real requestId from `IamHttpError`; disable unsupported filters if backend does not support them.

- `server/tests/auth.mock-login.test.ts`  
  Update session contract expectations.

- `server/tests/applications.test.ts`  
  Add pagination/total and create envelope tests.

- `server/tests/audit.test.ts`  
  Add pagination/filter/requestId tests.

- `README.md`  
  Add v0.1.3 HTTP runtime local verification path.

### Do Not Modify In First Slice

- `src/pages/Roles/index.tsx`
- `src/pages/Directory/index.tsx`
- `src/pages/Dashboard/index.tsx`
- `src/pages/Sync/index.tsx`
- `src/pages/Applications/Detail.tsx`
- `src/pages/Applications/Onboarding.tsx`

---

## Task 1: Backend Session Contract

**Files:**
- Modify: `server/tests/auth.mock-login.test.ts`
- Modify: `server/src/modules/auth/authRoutes.ts`

- [ ] **Step 1: Write failing server tests for current session contract**

Replace the test named `uses the session cookie for current session lookup` in `server/tests/auth.mock-login.test.ts` with:

```ts
  it('returns a frontend-friendly platform admin session', async () => {
    const login = await app.inject({
      method: 'POST',
      url: '/api/dev/feishu/mock-login',
      payload: { feishuUserId: 'ou_auth_002', name: '当前会话用户' },
    });
    const cookie = String(login.headers['set-cookie']);

    await app.inject({
      method: 'POST',
      url: '/api/initialization/bind-platform-admin',
      headers: { cookie },
    });

    const current = await app.inject({
      method: 'GET',
      url: '/api/session/current',
      headers: { cookie },
    });

    expect(current.statusCode).toBe(200);
    expect(current.json()).toMatchObject({
      authenticated: true,
      user: {
        feishuUserId: 'ou_auth_002',
        displayName: '当前会话用户',
        departmentPath: '-',
        status: 'active',
      },
      roles: ['platform_admin'],
      permissions: [
        'dashboard:view',
        'application:view',
        'application:create',
        'application:update',
        'application:disable',
        'application:secret',
        'role:view',
        'role:update',
        'directory:view',
        'sync:view',
        'sync:run',
        'audit:view',
      ],
      applicationIds: [],
    });
  });

  it('returns authenticated false when no session cookie exists', async () => {
    const current = await app.inject({
      method: 'GET',
      url: '/api/session/current',
    });

    expect(current.statusCode).toBe(200);
    expect(current.json()).toEqual({ authenticated: false });
  });

  it('returns an authenticated non-admin session without console permissions', async () => {
    const login = await app.inject({
      method: 'POST',
      url: '/api/dev/feishu/mock-login',
      payload: { feishuUserId: 'ou_auth_non_admin_001', name: '普通飞书用户' },
    });
    const cookie = String(login.headers['set-cookie']);

    const current = await app.inject({
      method: 'GET',
      url: '/api/session/current',
      headers: { cookie },
    });

    expect(current.statusCode).toBe(200);
    expect(current.json()).toMatchObject({
      authenticated: true,
      user: {
        feishuUserId: 'ou_auth_non_admin_001',
        displayName: '普通飞书用户',
        departmentPath: '-',
        status: 'active',
      },
      roles: [],
      permissions: [],
      applicationIds: [],
    });
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm run server:test -- server/tests/auth.mock-login.test.ts
```

Expected:

```text
FAIL server/tests/auth.mock-login.test.ts
expected object to match frontend-friendly session shape
```

- [ ] **Step 3: Implement current session contract**

In `server/src/modules/auth/authRoutes.ts`, add constants near the top:

```ts
const platformAdminPermissions = [
  'dashboard:view',
  'application:view',
  'application:create',
  'application:update',
  'application:disable',
  'application:secret',
  'role:view',
  'role:update',
  'directory:view',
  'sync:view',
  'sync:run',
  'audit:view',
];
```

Replace the current session route handler with:

```ts
  app.get('/api/session/current', async (request) => {
    if (!request.actor) {
      return { authenticated: false };
    }

    return {
      authenticated: true,
      user: {
        feishuUserId: request.actor.feishuUserId,
        displayName: request.actor.name,
        departmentPath: '-',
        status: 'active',
      },
      roles: request.actor.isPlatformAdmin ? ['platform_admin'] : [],
      permissions: request.actor.isPlatformAdmin ? platformAdminPermissions : [],
      applicationIds: [],
    };
  });
```

- [ ] **Step 4: Run server test**

Run:

```bash
npm run server:test -- server/tests/auth.mock-login.test.ts
```

Expected:

```text
PASS server/tests/auth.mock-login.test.ts
```

- [ ] **Step 5: Commit this task**

Run:

```bash
git add server/tests/auth.mock-login.test.ts server/src/modules/auth/authRoutes.ts
git commit -m "feat: expose admin console session contract"
```

Expected:

Expected: a new commit is created on `codex/v0.1.3-http-service-plan`.

---

## Task 2: Backend Applications and Audit Contracts

**Files:**
- Modify: `server/tests/applications.test.ts`
- Modify: `server/tests/audit.test.ts`
- Modify: `server/src/modules/applications/applicationRoutes.ts`
- Modify: `server/src/modules/applications/applicationRepository.ts`
- Modify: `server/src/modules/audit/auditRoutes.ts`

- [ ] **Step 1: Add failing applications pagination and envelope tests**

Append this test inside the `applications API` describe block in `server/tests/applications.test.ts`:

```ts
  it('lists applications with pagination metadata and count fields', async () => {
    const cookie = await loginAndBindAdmin(app, 'ou_app_admin_list_001', '应用列表管理员');

    await app.inject({ method: 'POST', url: '/api/applications', headers: { cookie }, payload: { name: '列表应用 A' } });
    await app.inject({ method: 'POST', url: '/api/applications', headers: { cookie }, payload: { name: '列表应用 B' } });

    const response = await app.inject({
      method: 'GET',
      url: '/api/applications?page=1&pageSize=1',
      headers: { cookie },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      page: 1,
      pageSize: 1,
      total: 2,
    });
    expect(response.json().items).toHaveLength(1);
    expect(response.json().items[0]).toMatchObject({
      app_key: expect.stringMatching(/^app_/),
      status: 'active',
      permission_group_count: 0,
      permission_point_count: 0,
    });
    expect(response.json().items[0]).not.toHaveProperty('appSecret');
    expect(response.json().items[0]).not.toHaveProperty('apiSecret');
  });

  it('returns create application as an application plus one-time secrets envelope', async () => {
    const cookie = await loginAndBindAdmin(app, 'ou_app_admin_envelope_001', '应用密钥管理员');

    const response = await app.inject({
      method: 'POST',
      url: '/api/applications',
      headers: { cookie },
      payload: { name: 'Envelope 应用' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      application: {
        name: 'Envelope 应用',
        status: 'active',
        app_key: expect.stringMatching(/^app_/),
      },
      appSecret: expect.stringMatching(/^sec_/),
      apiSecret: expect.stringMatching(/^api_sec_/),
    });
    expect(response.json().application).not.toHaveProperty('appSecret');
    expect(response.json().application).not.toHaveProperty('apiSecret');
  });
```

- [ ] **Step 2: Add failing audit pagination and filter tests**

Append this test inside the `audit API` describe block in `server/tests/audit.test.ts`:

```ts
  it('lists audit logs with pagination and action/result/keyword filters', async () => {
    const cookie = await loginAndBindAdmin(app, 'ou_audit_admin_filter_001', '审计筛选管理员');

    await app.inject({
      method: 'POST',
      url: '/api/applications',
      headers: { cookie },
      payload: { name: '审计筛选应用' },
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/audit-logs?page=1&pageSize=10&action=application.create&result=success&keyword=application.create',
      headers: { cookie },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      page: 1,
      pageSize: 10,
      total: 1,
    });
    expect(response.json().items).toHaveLength(1);
    expect(response.json().items[0]).toMatchObject({
      action: 'application.create',
      result: 'success',
      request_id: expect.any(String),
    });
  });
```

- [ ] **Step 3: Run tests to verify they fail**

Run:

```bash
npm run server:test -- server/tests/applications.test.ts server/tests/audit.test.ts
```

Expected:

```text
FAIL server/tests/applications.test.ts
FAIL server/tests/audit.test.ts
```

- [ ] **Step 4: Update application repository create return shape**

In `server/src/modules/applications/applicationRepository.ts`, replace the final `return` with:

```ts
  return {
    application: result.rows[0],
    appSecret,
    apiSecret,
  };
```

- [ ] **Step 5: Update application routes**

In `server/src/modules/applications/applicationRoutes.ts`, update create handling so the returned value is the envelope:

```ts
      const created = await createApplication(client, {
        name: normalizedName,
        createdByFeishuUserId: request.actor.feishuUserId,
      });

      await writeAudit(client, {
        requestId: request.id,
        actorFeishuUserId: request.actor.feishuUserId,
        action: 'application.create',
        targetType: 'application',
        targetId: created.application.id,
        result: 'success',
        metadata: { appKey: created.application.app_key },
      });
      await client.query('commit');

      return created;
```

Replace the list handler with:

```ts
  app.get('/api/applications', async (request) => {
    if (!request.actor) {
      throw unauthorized();
    }

    const query = request.query as { page?: string | number; pageSize?: string | number };
    const page = normalizePositiveInteger(query.page, 1);
    const pageSize = Math.min(normalizePositiveInteger(query.pageSize, 20), 100);
    const offset = (page - 1) * pageSize;

    const [items, total] = await Promise.all([
      pool.query(
        `
          select a.id,
                 a.app_key,
                 a.name,
                 a.status,
                 a.created_at,
                 count(distinct pg.id)::int as permission_group_count,
                 count(distinct pp.id)::int as permission_point_count
          from applications a
          left join permission_groups pg on pg.application_id = a.id
          left join permission_points pp on pp.application_id = a.id
          group by a.id
          order by a.created_at desc
          limit $1 offset $2
        `,
        [pageSize, offset],
      ),
      pool.query('select count(*)::int as total from applications'),
    ]);

    return { items: items.rows, page, pageSize, total: total.rows[0].total };
  });
```

Add this helper below `registerApplicationRoutes`:

```ts
function normalizePositiveInteger(value: string | number | undefined, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
```

- [ ] **Step 6: Update audit route**

In `server/src/modules/audit/auditRoutes.ts`, replace the list handler body after auth checks with:

```ts
    const query = request.query as {
      page?: string | number;
      pageSize?: string | number;
      action?: string;
      result?: string;
      keyword?: string;
    };
    const page = normalizePositiveInteger(query.page, 1);
    const pageSize = Math.min(normalizePositiveInteger(query.pageSize, 20), 100);
    const offset = (page - 1) * pageSize;
    const filters: string[] = [];
    const values: Array<string | number> = [];

    if (query.action) {
      values.push(query.action);
      filters.push(`action = $${values.length}`);
    }
    if (query.result) {
      values.push(query.result === 'failed' ? 'failure' : query.result);
      filters.push(`result = $${values.length}`);
    }
    if (query.keyword) {
      values.push(`%${query.keyword}%`);
      filters.push(
        `(request_id ilike $${values.length} or actor_feishu_user_id ilike $${values.length} or action ilike $${values.length} or metadata::text ilike $${values.length})`,
      );
    }

    const whereClause = filters.length ? `where ${filters.join(' and ')}` : '';
    const itemValues = [...values, pageSize, offset];
    const limitIndex = values.length + 1;
    const offsetIndex = values.length + 2;

    const [items, total] = await Promise.all([
      pool.query(
        `
          select id, request_id, actor_feishu_user_id, action, target_type, target_id, result, metadata, created_at
          from audit_logs
          ${whereClause}
          order by created_at desc
          limit $${limitIndex} offset $${offsetIndex}
        `,
        itemValues,
      ),
      pool.query(
        `
          select count(*)::int as total
          from audit_logs
          ${whereClause}
        `,
        values,
      ),
    ]);

    return { items: items.rows, page, pageSize, total: total.rows[0].total };
```

Add this helper below `registerAuditRoutes`:

```ts
function normalizePositiveInteger(value: string | number | undefined, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
```

- [ ] **Step 7: Run server tests**

Run:

```bash
npm run server:test -- server/tests/applications.test.ts server/tests/audit.test.ts
```

Expected:

```text
PASS server/tests/applications.test.ts
PASS server/tests/audit.test.ts
```

- [ ] **Step 8: Run v0.1.2 access loop to catch contract breakage**

Run:

```bash
npm run server:test -- server/tests/accessLoop.smoke.test.ts server/tests/applicationApi.test.ts
```

Expected:

```text
PASS server/tests/accessLoop.smoke.test.ts
PASS server/tests/applicationApi.test.ts
```

If these fail because old tests expect raw `app_key` at the top level of create responses, update test helpers to unwrap `response.json().application` and preserve `apiSecret` from the envelope.

- [ ] **Step 9: Commit this task**

Run:

```bash
git add server/tests/applications.test.ts server/tests/audit.test.ts server/src/modules/applications/applicationRoutes.ts server/src/modules/applications/applicationRepository.ts server/src/modules/audit/auditRoutes.ts server/tests/accessLoop.smoke.test.ts server/tests/applicationApi.test.ts
git commit -m "feat: align admin runtime API contracts"
```

Expected:

Expected: a new commit is created on `codex/v0.1.3-http-service-plan`.

---

## Task 3: API Mode and HTTP Client

**Files:**
- Create: `src/features/iam/apiMode.ts`
- Create: `src/features/iam/apiMode.test.ts`
- Create: `src/features/iam/httpClient.ts`
- Create: `src/features/iam/httpClient.test.ts`
- Modify: `src/features/iam/types.ts`

- [ ] **Step 1: Add HTTP mode types**

Append to `src/features/iam/types.ts`:

```ts
export type ApiMode = 'mock' | 'http';

export interface IamHttpError extends Error {
  name: 'IamHttpError';
  status: number;
  code: string;
  message: string;
  requestId?: string;
  fieldErrors?: Record<string, string>;
  details?: unknown;
}
```

- [ ] **Step 2: Write apiMode tests**

Create `src/features/iam/apiMode.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';

describe('apiMode', () => {
  it('defaults to mock mode', async () => {
    vi.stubEnv('VITE_IAM_API_MODE', undefined);
    vi.stubEnv('VITE_IAM_API_BASE_URL', undefined);
    vi.resetModules();

    const { getIamApiMode, getIamApiBaseUrl } = await import('./apiMode');

    expect(getIamApiMode()).toBe('mock');
    expect(getIamApiBaseUrl()).toBe('');
    vi.unstubAllEnvs();
  });

  it('reads http mode and trims trailing slashes from base URL', async () => {
    vi.stubEnv('VITE_IAM_API_MODE', 'http');
    vi.stubEnv('VITE_IAM_API_BASE_URL', 'http://127.0.0.1:4100///');
    vi.resetModules();

    const { getIamApiMode, getIamApiBaseUrl } = await import('./apiMode');

    expect(getIamApiMode()).toBe('http');
    expect(getIamApiBaseUrl()).toBe('http://127.0.0.1:4100');
    vi.unstubAllEnvs();
  });

  it('throws for invalid mode', async () => {
    vi.stubEnv('VITE_IAM_API_MODE', 'database');
    vi.resetModules();

    const { getIamApiMode } = await import('./apiMode');

    expect(() => getIamApiMode()).toThrow('VITE_IAM_API_MODE must be mock or http');
    vi.unstubAllEnvs();
  });
});
```

- [ ] **Step 3: Implement apiMode**

Create `src/features/iam/apiMode.ts`:

```ts
import type { ApiMode } from './types';

export function getIamApiMode(): ApiMode {
  const value = import.meta.env.VITE_IAM_API_MODE;

  if (!value) {
    return 'mock';
  }
  if (value === 'mock' || value === 'http') {
    return value;
  }
  throw new Error('VITE_IAM_API_MODE must be mock or http');
}

export function getIamApiBaseUrl(): string {
  const value = import.meta.env.VITE_IAM_API_BASE_URL ?? '';
  return value.replace(/\/+$/, '');
}

export function isHttpApiMode(): boolean {
  return getIamApiMode() === 'http';
}
```

- [ ] **Step 4: Write httpClient tests**

Create `src/features/iam/httpClient.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { httpRequest, isIamHttpError } from './httpClient';

describe('httpClient', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns JSON for successful responses and includes credentials', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    await expect(httpRequest('/api/health')).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith('/api/health', expect.objectContaining({ credentials: 'include' }));
  });

  it('appends query parameters', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ items: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    await httpRequest('/api/audit-logs', { query: { page: 1, pageSize: 20, keyword: 'req_1', empty: undefined } });

    expect(fetchMock).toHaveBeenCalledWith('/api/audit-logs?page=1&pageSize=20&keyword=req_1', expect.any(Object));
  });

  it('throws IamHttpError with requestId for server errors', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ requestId: 'req_error_001', code: 'APPLICATION_NAME_EXISTS', message: '应用名称已存在' }), {
        status: 409,
        headers: { 'content-type': 'application/json' },
      }),
    );

    await expect(httpRequest('/api/applications')).rejects.toMatchObject({
      name: 'IamHttpError',
      status: 409,
      code: 'APPLICATION_NAME_EXISTS',
      message: '应用名称已存在',
      requestId: 'req_error_001',
    });
  });

  it('identifies IamHttpError', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('fetch failed'));

    try {
      await httpRequest('/api/session/current');
      throw new Error('expected request to fail');
    } catch (error) {
      expect(isIamHttpError(error)).toBe(true);
      expect(error).toMatchObject({ status: 0, code: 'NETWORK_ERROR' });
    }
  });
});
```

- [ ] **Step 5: Implement httpClient**

Create `src/features/iam/httpClient.ts`:

```ts
import { getIamApiBaseUrl } from './apiMode';
import type { IamHttpError } from './types';

interface HttpRequestOptions {
  method?: string;
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
}

interface ErrorPayload {
  requestId?: string;
  code?: string;
  message?: string;
  details?: unknown;
}

export async function httpRequest<T>(path: string, options: HttpRequestOptions = {}): Promise<T> {
  const url = buildUrl(path, options.query);

  try {
    const response = await fetch(url, {
      method: options.method ?? 'GET',
      credentials: 'include',
      headers: options.body === undefined ? undefined : { 'content-type': 'application/json' },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });

    const payload = await readJson(response);
    if (!response.ok) {
      throw createIamHttpError(response.status, payload);
    }

    return payload as T;
  } catch (error) {
    if (isIamHttpError(error)) {
      throw error;
    }
    throw createIamHttpError(0, {
      code: 'NETWORK_ERROR',
      message: error instanceof Error ? error.message : '网络请求失败',
    });
  }
}

export function isIamHttpError(error: unknown): error is IamHttpError {
  return typeof error === 'object' && error !== null && (error as { name?: unknown }).name === 'IamHttpError';
}

function buildUrl(path: string, query?: HttpRequestOptions['query']) {
  const baseUrl = getIamApiBaseUrl();
  const url = `${baseUrl}${path}`;
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined) {
      params.set(key, String(value));
    }
  }

  const queryString = params.toString();
  return queryString ? `${url}?${queryString}` : url;
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return {};
  }
  try {
    return JSON.parse(text);
  } catch {
    return { code: 'INVALID_JSON_RESPONSE', message: text };
  }
}

function createIamHttpError(status: number, payload: unknown): IamHttpError {
  const errorPayload = normalizeErrorPayload(payload);
  const error = new Error(errorPayload.message) as IamHttpError;
  error.name = 'IamHttpError';
  error.status = status;
  error.code = errorPayload.code ?? fallbackCode(status);
  error.requestId = errorPayload.requestId;
  error.details = errorPayload.details;
  error.fieldErrors = extractFieldErrors(errorPayload.details);
  return error;
}

function normalizeErrorPayload(payload: unknown): ErrorPayload {
  if (typeof payload !== 'object' || payload === null) {
    return { message: '服务暂时不可用' };
  }
  const record = payload as Record<string, unknown>;
  return {
    requestId: typeof record.requestId === 'string' ? record.requestId : undefined,
    code: typeof record.code === 'string' ? record.code : undefined,
    message: typeof record.message === 'string' ? record.message : '服务暂时不可用',
    details: record.details,
  };
}

function fallbackCode(status: number) {
  if (status === 0) {
    return 'NETWORK_ERROR';
  }
  return status >= 500 ? 'INTERNAL_SERVER_ERROR' : 'REQUEST_ERROR';
}

function extractFieldErrors(details: unknown): Record<string, string> | undefined {
  if (typeof details !== 'object' || details === null || !('fieldErrors' in details)) {
    return undefined;
  }
  const fieldErrors = (details as { fieldErrors?: unknown }).fieldErrors;
  if (typeof fieldErrors !== 'object' || fieldErrors === null) {
    return undefined;
  }
  return Object.fromEntries(
    Object.entries(fieldErrors as Record<string, unknown>).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
  );
}
```

- [ ] **Step 6: Run unit tests**

Run:

```bash
npm test -- src/features/iam/apiMode.test.ts src/features/iam/httpClient.test.ts
```

Expected:

```text
PASS src/features/iam/apiMode.test.ts
PASS src/features/iam/httpClient.test.ts
```

- [ ] **Step 7: Commit this task**

Run:

```bash
git add src/features/iam/types.ts src/features/iam/apiMode.ts src/features/iam/apiMode.test.ts src/features/iam/httpClient.ts src/features/iam/httpClient.test.ts
git commit -m "feat: add IAM HTTP mode client"
```

Expected:

Expected: a new commit is created on `codex/v0.1.3-http-service-plan`.

---

## Task 4: DTO Mapping and HTTP API Service

**Files:**
- Create: `src/features/iam/dtoMappers.ts`
- Create: `src/features/iam/dtoMappers.test.ts`
- Create: `src/features/iam/httpApi.ts`
- Create: `src/features/iam/iamService.ts`
- Modify: `src/features/iam/queries.ts`
- Modify: `src/features/iam/types.ts`

- [ ] **Step 1: Add create result type**

Append to `src/features/iam/types.ts`:

```ts
export interface CreateApplicationResult {
  application: Application;
  appSecret: string;
  apiSecret: string;
}
```

Change the return type expected by `useCreateApplication()` later from `Application` to `CreateApplicationResult`.

- [ ] **Step 2: Write mapper tests**

Create `src/features/iam/dtoMappers.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  mapAuditLog,
  mapCreateApplicationResult,
  mapCurrentSessionResponse,
  mapPageResult,
  mapRuntimeApplication,
} from './dtoMappers';

describe('dtoMappers', () => {
  it('maps authenticated session response', () => {
    expect(
      mapCurrentSessionResponse({
        authenticated: true,
        user: { feishuUserId: 'ou_1', displayName: '管理员', departmentPath: '-', status: 'active' },
        roles: ['platform_admin'],
        permissions: ['dashboard:view'],
        applicationIds: [],
      }),
    ).toMatchObject({
      user: { feishuUserId: 'ou_1', displayName: '管理员' },
      roles: ['platform_admin'],
      permissions: ['dashboard:view'],
    });
  });

  it('rejects unauthenticated session response', () => {
    expect(() => mapCurrentSessionResponse({ authenticated: false })).toThrow('UNAUTHENTICATED_SESSION');
  });

  it('maps runtime application list item without secrets', () => {
    expect(
      mapRuntimeApplication({
        id: 'app-id',
        app_key: 'app_key_1',
        name: 'Demo',
        status: 'active',
        created_at: '2026-05-24T00:00:00.000Z',
        permission_group_count: 2,
        permission_point_count: 3,
      }),
    ).toMatchObject({
      id: 'app-id',
      appKey: 'app_key_1',
      name: 'Demo',
      code: 'app_key_1',
      permissionGroupCount: 2,
      permissionPointCount: 3,
    });
  });

  it('maps create application envelope', () => {
    expect(
      mapCreateApplicationResult({
        application: {
          id: 'app-id',
          app_key: 'app_key_1',
          name: 'Demo',
          status: 'active',
          created_at: '2026-05-24T00:00:00.000Z',
        },
        appSecret: 'sec_x',
        apiSecret: 'api_sec_x',
      }),
    ).toMatchObject({
      application: { id: 'app-id', appKey: 'app_key_1' },
      appSecret: 'sec_x',
      apiSecret: 'api_sec_x',
    });
  });

  it('maps audit log fields and failure result', () => {
    expect(
      mapAuditLog({
        id: 1,
        request_id: 'req_1',
        actor_feishu_user_id: 'ou_1',
        action: 'application.create',
        target_type: 'application',
        target_id: 'app-id',
        result: 'failure',
        metadata: {},
        created_at: '2026-05-24T00:00:00.000Z',
      }),
    ).toMatchObject({
      id: '1',
      requestId: 'req_1',
      actorFeishuUserId: 'ou_1',
      applicationId: 'app-id',
      result: 'failed',
    });
  });

  it('maps page results', () => {
    expect(
      mapPageResult(
        {
          items: [{ id: 'app-id', app_key: 'app_key_1', name: 'Demo', status: 'active', created_at: '2026-05-24T00:00:00.000Z' }],
          page: 1,
          pageSize: 20,
          total: 1,
        },
        mapRuntimeApplication,
      ),
    ).toMatchObject({ page: 1, pageSize: 20, total: 1, items: [{ id: 'app-id' }] });
  });
});
```

- [ ] **Step 3: Implement dtoMappers**

Create `src/features/iam/dtoMappers.ts`:

```ts
import type {
  Application,
  AuditAction,
  AuditLog,
  AuditResult,
  CreateApplicationResult,
  CurrentSession,
  PageResult,
} from './types';

interface RuntimePageResult<T> {
  items: T[];
  page?: number;
  pageSize?: number;
  total?: number;
}

interface RuntimeApplication {
  id: string;
  app_key: string;
  name: string;
  status: Application['status'];
  created_at: string;
  updated_at?: string;
  permission_group_count?: number;
  permission_point_count?: number;
}

interface RuntimeAuditLog {
  id: string | number;
  request_id: string;
  actor_feishu_user_id?: string | null;
  action: string;
  target_type?: string;
  target_id?: string | null;
  result: 'success' | 'failure' | 'failed';
  metadata?: unknown;
  created_at: string;
}

export function mapCurrentSessionResponse(payload: unknown): CurrentSession {
  const value = payload as { authenticated?: boolean; user?: CurrentSession['user']; roles?: CurrentSession['roles']; permissions?: CurrentSession['permissions']; applicationIds?: string[] };

  if (!value.authenticated) {
    throw new Error('UNAUTHENTICATED_SESSION');
  }

  return {
    user: value.user!,
    roles: value.roles ?? [],
    permissions: value.permissions ?? [],
    applicationIds: value.applicationIds ?? [],
  };
}

export function mapRuntimeApplication(item: RuntimeApplication): Application {
  return {
    id: item.id,
    name: item.name,
    code: item.app_key,
    status: item.status,
    appKey: item.app_key,
    appSecretPreview: 'sec_****',
    apiKey: item.app_key,
    apiSecretPreview: 'api_****',
    callbackUrls: [],
    allowedOrigins: [],
    ownerFeishuUserId: '-',
    ownerName: '-',
    permissionGroupCount: item.permission_group_count ?? 0,
    permissionPointCount: item.permission_point_count ?? 0,
    agentPrompt: '',
    createdAt: item.created_at,
    updatedAt: item.updated_at ?? item.created_at,
  };
}

export function mapCreateApplicationResult(payload: { application: RuntimeApplication; appSecret: string; apiSecret: string }): CreateApplicationResult {
  return {
    application: mapRuntimeApplication(payload.application),
    appSecret: payload.appSecret,
    apiSecret: payload.apiSecret,
  };
}

export function mapAuditLog(item: RuntimeAuditLog): AuditLog {
  return {
    id: String(item.id),
    action: normalizeAuditAction(item.action),
    result: normalizeAuditResult(item.result),
    actorFeishuUserId: item.actor_feishu_user_id ?? '-',
    applicationId: item.target_type === 'application' ? item.target_id ?? undefined : undefined,
    message: item.action,
    requestId: item.request_id,
    createdAt: item.created_at,
  };
}

export function mapPageResult<Input, Output>(page: RuntimePageResult<Input>, mapper: (item: Input) => Output): PageResult<Output> {
  return {
    items: page.items.map(mapper),
    page: page.page ?? 1,
    pageSize: page.pageSize ?? page.items.length,
    total: page.total ?? page.items.length,
  };
}

function normalizeAuditAction(action: string): AuditAction {
  const known = new Set<AuditAction>([
    'login',
    'application.create',
    'application.api_call',
    'secret.copy',
    'secret.rotate',
    'role.update',
    'permission.query',
    'sync.run',
  ]);
  if (known.has(action as AuditAction)) {
    return action as AuditAction;
  }
  if (action === 'auth.mock_login') {
    return 'login';
  }
  if (action === 'platform_admin.bind') {
    return 'role.update';
  }
  return 'application.api_call';
}

function normalizeAuditResult(result: RuntimeAuditLog['result']): AuditResult {
  return result === 'success' ? 'success' : 'failed';
}
```

- [ ] **Step 4: Create httpApi**

Create `src/features/iam/httpApi.ts`:

```ts
import { httpRequest } from './httpClient';
import {
  mapAuditLog,
  mapCreateApplicationResult,
  mapCurrentSessionResponse,
  mapPageResult,
  mapRuntimeApplication,
} from './dtoMappers';
import type {
  Application,
  AuditAction,
  AuditResult,
  CreateApplicationInput,
  CreateApplicationResult,
  CurrentSession,
  PageRequest,
  PageResult,
} from './types';

export async function getCurrentSession(): Promise<CurrentSession> {
  return mapCurrentSessionResponse(await httpRequest('/api/session/current'));
}

export async function getInitializationStatus(): Promise<{ initialized: boolean }> {
  return httpRequest('/api/initialization/status');
}

export async function bindPlatformAdmin(): Promise<{ initialized: boolean; platformAdminFeishuUserId: string }> {
  return httpRequest('/api/initialization/bind-platform-admin', { method: 'POST' });
}

export async function mockFeishuLogin(input: { feishuUserId: string; name: string; email?: string }) {
  return httpRequest('/api/dev/feishu/mock-login', { method: 'POST', body: input });
}

export async function listApplications(request: PageRequest): Promise<PageResult<Application>> {
  return mapPageResult(await httpRequest('/api/applications', { query: request }), mapRuntimeApplication);
}

export async function createApplication(input: Pick<CreateApplicationInput, 'name'>): Promise<CreateApplicationResult> {
  return mapCreateApplicationResult(await httpRequest('/api/applications', { method: 'POST', body: { name: input.name } }));
}

export async function listAuditLogs(request: PageRequest & { action?: AuditAction; result?: AuditResult; keyword?: string }): Promise<PageResult<ReturnType<typeof mapAuditLog>>> {
  return mapPageResult(await httpRequest('/api/audit-logs', { query: request }), mapAuditLog);
}
```

- [ ] **Step 5: Create iamService facade**

Create `src/features/iam/iamService.ts`:

```ts
import { getIamApiMode } from './apiMode';
import * as httpApi from './httpApi';
import * as mockApi from './mockApi';

export const iamService = getIamApiMode() === 'http' ? httpApi : mockApi;
```

- [ ] **Step 6: Update queries to use facade**

In `src/features/iam/queries.ts`, replace the import block from `./mockApi` with:

```ts
import { iamService } from './iamService';
```

Then replace each direct service call with `iamService.<name>`, for example:

```ts
queryFn: iamService.getCurrentSession,
queryFn: () => iamService.listApplications(params),
mutationFn: (input: CreateApplicationInput) => iamService.createApplication(input),
queryFn: () => iamService.listAuditLogs(params),
```

For service methods not yet implemented in `httpApi` but still needed in mock mode, keep them callable through `iamService` by adding no-op unsupported HTTP methods only when TypeScript requires them. Use this pattern:

```ts
function unsupportedHttpMethod(name: string): never {
  throw new Error(`${name} is not available in HTTP mode for v0.1.3 first vertical slice`);
}
```

Do not let the first vertical slice silently fallback to mock data in HTTP mode.

- [ ] **Step 7: Run unit tests**

Run:

```bash
npm test -- src/features/iam/dtoMappers.test.ts src/features/iam/apiMode.test.ts src/features/iam/httpClient.test.ts
```

Expected:

```text
PASS src/features/iam/dtoMappers.test.ts
PASS src/features/iam/apiMode.test.ts
PASS src/features/iam/httpClient.test.ts
```

- [ ] **Step 8: Run type build to catch facade gaps**

Run:

```bash
npm run build
```

Expected:

```text
✓ built in
```

- [ ] **Step 9: Commit this task**

Run:

```bash
git add src/features/iam/types.ts src/features/iam/dtoMappers.ts src/features/iam/dtoMappers.test.ts src/features/iam/httpApi.ts src/features/iam/iamService.ts src/features/iam/queries.ts
git commit -m "feat: route IAM queries through service facade"
```

Expected:

Expected: a new commit is created on `codex/v0.1.3-http-service-plan`.

---

## Task 5: Local HTTP Runtime, Login, Initialize, Applications, Audit UI

**Files:**
- Modify: `vite.config.ts`
- Modify: `src/app/App.tsx`
- Modify: `src/layouts/AdminLayout.tsx`
- Modify: `src/pages/Login/index.tsx`
- Modify: `src/pages/Initialize/index.tsx`
- Modify: `src/pages/Applications/List.tsx`
- Modify: `src/pages/AuditLogs/index.tsx`

- [ ] **Step 1: Add Vite proxy**

Replace `vite.config.ts` with:

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:4100',
        changeOrigin: true,
      },
    },
  },
});
```

- [ ] **Step 2: Add runtime mode display to AdminLayout**

In `src/layouts/AdminLayout.tsx`, import:

```ts
import { getIamApiMode } from '../features/iam/apiMode';
import { isIamHttpError } from '../features/iam/httpClient';
```

Inside `AdminLayout`, add:

```ts
  const apiMode = getIamApiMode();
  const environmentTag = apiMode === 'http' ? 'HTTP runtime' : 'Mock data';
```

Replace the current `Tag color="blue">本地环境</Tag>` with:

```tsx
            <Tag color={apiMode === 'http' ? 'green' : 'blue'}>{environmentTag}</Tag>
```

Replace the generic session error branch with:

```tsx
  if (sessionQuery.isError || !session) {
    const error = sessionQuery.error;
    const isHttpError = isIamHttpError(error);
    const title = isHttpError && error.status === 401 ? '会话已过期' : '无法加载当前飞书会话';
    const description = isHttpError
      ? `${error.message}${error.requestId ? `（Request ID: ${error.requestId}）` : ''}`
      : '请检查飞书登录态或稍后重试。';

    return (
      <Layout style={{ minHeight: '100vh' }}>
        <Content style={{ padding: 24 }}>
          <Alert
            type={isHttpError && error.status === 401 ? 'warning' : 'error'}
            showIcon
            title={title}
            description={description}
            action={
              isHttpError && error.status === 401 ? (
                <Link to="/login">重新登录</Link>
              ) : undefined
            }
          />
        </Content>
      </Layout>
    );
  }
```

- [ ] **Step 3: Add Login HTTP mock Feishu login behavior**

In `src/pages/Login/index.tsx`, keep the presentational component but add optional props:

```ts
type LoginPageProps = {
  status?: LoginStatus;
  environmentName?: string;
  deploymentUrl?: string;
  apiModeLabel?: string;
  devMockLoginVisible?: boolean;
  devMockLoginLoading?: boolean;
  onLogin?: () => void;
  onDevMockLogin?: () => void;
};
```

In the `extra` area, use:

```tsx
          extra={
            <Space orientation="vertical" size={12}>
              <Button type="primary" icon={<LoginOutlined aria-hidden="true" />} size="large" onClick={onLogin}>
                使用飞书登录
              </Button>
              {devMockLoginVisible ? (
                <Button loading={devMockLoginLoading} onClick={onDevMockLogin}>
                  使用本地 mock 飞书登录
                </Button>
              ) : null}
              {apiModeLabel ? <Typography.Text type="secondary">{apiModeLabel}</Typography.Text> : null}
            </Space>
          }
```

In `src/app/App.tsx`, create a wrapper component near `App`:

```tsx
function RuntimeLoginPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const apiMode = getIamApiMode();

  return (
    <LoginPage
      apiModeLabel={apiMode === 'http' ? 'HTTP runtime' : 'Mock data'}
      devMockLoginVisible={apiMode === 'http' && import.meta.env.DEV}
      devMockLoginLoading={loading}
      onDevMockLogin={async () => {
        setLoading(true);
        try {
          await httpApi.mockFeishuLogin({
            feishuUserId: `ou_local_admin_${Date.now()}`,
            name: '本地平台管理员',
            email: 'local-admin@example.com',
          });
          navigate('/initialize');
        } finally {
          setLoading(false);
        }
      }}
    />
  );
}
```

Also import:

```ts
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getIamApiMode } from '../features/iam/apiMode';
import * as httpApi from '../features/iam/httpApi';
```

Then change the login route to:

```tsx
<Route path="/login" element={<RuntimeLoginPage />} />
```

- [ ] **Step 4: Connect Initialize to runtime**

Add `getInitializationStatus` and `bindPlatformAdmin` hooks to `src/features/iam/queries.ts`:

Add this property inside the existing `iamQueryKeys` object:

```ts
initializationStatus: ['iam', 'initializationStatus'] as const,
```

Then add these hooks below `useCurrentSession()`:

```ts
export function useInitializationStatus() {
  return useQuery({
    queryKey: iamQueryKeys.initializationStatus,
    queryFn: iamService.getInitializationStatus,
  });
}

export function useBindPlatformAdmin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: iamService.bindPlatformAdmin,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: iamQueryKeys.initializationStatus });
      queryClient.invalidateQueries({ queryKey: iamQueryKeys.session });
    },
  });
}
```

Then update `src/pages/Initialize/index.tsx` to call these hooks and make the primary button bind the current Feishu user:

```tsx
const initializationQuery = useInitializationStatus();
const bindPlatformAdminMutation = useBindPlatformAdmin();
```

Expected UI behavior:

- Loading: show `Spin` or disabled primary button.
- Empty/uninitialized: warning state and `绑定当前飞书用户为平台管理员`.
- Success: show initialized result and button to enter `/applications`.
- Error: show `Alert` with `requestId` when available.

- [ ] **Step 5: Update Applications create behavior for HTTP mode**

In `src/pages/Applications/List.tsx`:

- Import `getIamApiMode` and `isIamHttpError`.
- Use `const apiMode = getIamApiMode();`.
- In HTTP mode, only render `name` in create drawer.
- In mock mode, keep existing `code` / `callbackUrl` / `ownerFeishuUserId` fields.
- Submit HTTP mode create as `{ name: values.name }`.
- On `APPLICATION_NAME_EXISTS`, call:

```ts
createForm.setFields([{ name: 'name', errors: [error.message] }]);
```

- On success, show one-time secret modal:

```tsx
Modal.success({
  title: '应用已创建',
  content: (
    <Space orientation="vertical" size={8}>
      <Typography.Text>以下密钥只显示一次，关闭后无法再次查看。</Typography.Text>
      <Typography.Text code copyable>{createdApplication.appSecret}</Typography.Text>
      <Typography.Text code copyable>{createdApplication.apiSecret}</Typography.Text>
    </Space>
  ),
  okText: '我已保存，查看审计日志',
  onOk: () => navigate('/audit-logs'),
});
```

If TypeScript reports `createdApplication` is a mock `Application` in mock mode and `CreateApplicationResult` in HTTP mode, split the branch:

```ts
if (apiMode === 'http') {
  const result = await createApplicationMutation.mutateAsync({ name: values.name } as CreateApplicationInput);
  // result as CreateApplicationResult
} else {
  const result = await createApplicationMutation.mutateAsync(input);
  // result as Application
}
```

- [ ] **Step 6: Update AuditLogs requestId error display**

In `src/pages/AuditLogs/index.tsx`:

- Remove `const auditLogsErrorRequestId = 'req_audit_error_001';`.
- Import `isIamHttpError`.
- Build error description from `auditLogsQuery.error`:

```tsx
const auditError = auditLogsQuery.error;
const auditRequestId = isIamHttpError(auditError) ? auditError.requestId : undefined;
const auditErrorMessage = isIamHttpError(auditError) ? auditError.message : '请稍后重试，若仍失败可交由管理员排查审计服务。';
```

Use:

```tsx
description={
  <Space orientation="vertical" size={4}>
    <Typography.Text>{auditErrorMessage}</Typography.Text>
    {auditRequestId ? <Typography.Text code copyable>{auditRequestId}</Typography.Text> : null}
  </Space>
}
```

- [ ] **Step 7: Run build and page tests**

Run:

```bash
npm test -- src/pages/Login/index.test.tsx src/pages/Initialize/index.test.tsx src/pages/Applications/List.test.tsx src/pages/AuditLogs/index.test.tsx
npm run build
```

Expected:

```text
PASS src/pages/Login/index.test.tsx
PASS src/pages/Initialize/index.test.tsx
PASS src/pages/Applications/List.test.tsx
PASS src/pages/AuditLogs/index.test.tsx
✓ built in
```

- [ ] **Step 8: Commit this task**

Run:

```bash
git add vite.config.ts src/app/App.tsx src/layouts/AdminLayout.tsx src/pages/Login/index.tsx src/pages/Initialize/index.tsx src/pages/Applications/List.tsx src/pages/AuditLogs/index.tsx src/features/iam/queries.ts
git commit -m "feat: connect first admin console path to HTTP runtime"
```

Expected:

Expected: a new commit is created on `codex/v0.1.3-http-service-plan`.

---

## Task 6: HTTP Mode E2E and Documentation

**Files:**
- Create: `tests/e2e/v0.1.3-admin-console-http.spec.ts`
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Modify: `VERSION`
- Modify: `package.json`

- [ ] **Step 1: Add Playwright HTTP mode smoke test**

Create `tests/e2e/v0.1.3-admin-console-http.spec.ts`:

```ts
import { expect, test } from '@playwright/test';

test.describe('v0.1.3 Admin Console HTTP mode', () => {
  test('logs in through dev mock Feishu, initializes, creates an app, and sees audit', async ({ page }, testInfo) => {
    await page.goto('/login');
    await expect(page.getByText('HTTP runtime')).toBeVisible();

    await page.getByRole('button', { name: '使用本地 mock 飞书登录' }).click();
    await expect(page).toHaveURL(/\/initialize/);

    await page.getByRole('button', { name: /绑定当前飞书用户为平台管理员/ }).click();
    await page.goto('/applications');

    await expect(page.getByText('HTTP runtime')).toBeVisible();
    await page.getByRole('button', { name: '创建应用' }).click();
    await page.getByLabel('应用名称').fill(`HTTP Mode Demo ${testInfo.project.name} ${Date.now()}`);
    await page.getByRole('button', { name: '提交' }).click();

    await expect(page.getByRole('dialog', { name: '应用已创建' })).toBeVisible();
    await expect(page.getByText(/以下密钥只显示一次/)).toBeVisible();
    await page.getByRole('button', { name: /我已保存/ }).click();

    await expect(page).toHaveURL(/\/audit-logs/);
    await expect(page.getByText('创建应用')).toBeVisible();
  });
});
```

- [ ] **Step 2: Document E2E precondition**

Add this note above the new test command in `README.md`:

```markdown
### v0.1.3 HTTP mode 本地验收

`v0.1.3` 的主验收路径是 HTTP runtime，而不是 mock-only 前端。

1. 启动本地 PostgreSQL，并设置 `DATABASE_URL`。
2. 启动 Fastify runtime：

   ```bash
   SESSION_SECRET=local-session-secret-at-least-32-bytes \
   FEISHU_AUTH_MODE=mock \
   npm run server:dev
   ```

3. 启动 Vite HTTP mode：

   ```bash
   VITE_IAM_API_MODE=http npm run dev -- --host 127.0.0.1
   ```

4. 使用 gstack `/browser` 打开 `http://127.0.0.1:5173/login`，走本地 mock 飞书登录、初始化、创建应用、审计日志检查。
```

- [ ] **Step 3: Update version metadata**

Set:

```text
VERSION = 0.1.3
package.json version = 0.1.3
```

Add to the top of `CHANGELOG.md`:

```markdown
## v0.1.3 - Admin Console HTTP service 切换

- Admin Console 新增 HTTP runtime mode，可通过真实 Fastify API 完成本地 mock 飞书登录、初始化、应用列表/创建和审计日志查看。
- 新增 `iamService` facade、HTTP client、DTO/error mapping 和 `VITE_IAM_API_MODE=mock|http` 边界。
- HTTP mode 下错误展示保留 requestId，应用创建返回 one-time appSecret/apiSecret，审计日志不记录 secret 明文。
```

- [ ] **Step 4: Run full verification commands**

Run:

```bash
npm run server:test
npm run server:build
npm test
npm run build
RUNTIME_API_BASE_URL=http://127.0.0.1:4100 bash scripts/verify-v0.1.2-access-loop.sh
npm run e2e -- tests/e2e/v0.1.3-admin-console-http.spec.ts
```

Expected:

```text
PASS server tests
server build exits 0
PASS frontend tests
frontend build exits 0
verify-v0.1.2-access-loop.sh exits 0
PASS tests/e2e/v0.1.3-admin-console-http.spec.ts
```

If `npm run e2e` cannot start Fastify/PostgreSQL automatically, do not mark this complete. Start the runtime manually as documented, rerun the command, and record the exact terminal evidence.

- [ ] **Step 5: Run gstack /browser verification**

Use gstack `/browser`, not generic shell-only verification, for the UI evidence.

Checklist:

```text
[ ] 1440 viewport: /login shows HTTP runtime and dev mock Feishu login.
[ ] 1440 viewport: /initialize binds current mock Feishu user as platform admin.
[ ] 1440 viewport: /applications loads runtime data.
[ ] 1440 viewport: creating an application shows one-time appSecret/apiSecret modal.
[ ] 1440 viewport: /audit-logs shows application.create.
[ ] 1280 viewport: application table and modal do not overlap.
[ ] 768 viewport: audit log details still expose requestId through Drawer/detail path.
[ ] Browser console has no blocking runtime errors.
[ ] Network tab shows /api/session/current, /api/initialization/status, /api/applications, /api/audit-logs.
```

Save screenshots under:

```text
design/implementation-screenshots/
  v0.1.3-http-login-1440.png
  v0.1.3-http-initialize-1440.png
  v0.1.3-http-applications-created-1440.png
  v0.1.3-http-audit-1440.png
  v0.1.3-http-audit-768.png
```

- [ ] **Step 6: Commit this task**

Run:

```bash
git add tests/e2e/v0.1.3-admin-console-http.spec.ts README.md CHANGELOG.md VERSION package.json design/implementation-screenshots
git commit -m "docs: add v0.1.3 HTTP mode verification path"
```

Expected:

Expected: a new commit is created on `codex/v0.1.3-http-service-plan`.

---

## Completion Criteria

The vertical slice is complete only when all are true:

- `src/features/iam/queries.ts` no longer imports `./mockApi`.
- `VITE_IAM_API_MODE=http` loads Admin Console through real Fastify API.
- Browser path works: Login -> mock Feishu login -> Initialize -> Applications -> create app -> one-time secrets -> AuditLogs.
- Runtime errors show real `requestId` when backend provides one.
- Duplicate application name shows 409 as a form-level field error.
- `npm run server:test` passes.
- `npm run server:build` passes.
- `npm test` passes.
- `npm run build` passes.
- `scripts/verify-v0.1.2-access-loop.sh` still passes against runtime.
- `tests/e2e/v0.1.3-admin-console-http.spec.ts` passes with runtime available.
- gstack `/browser` verification has screenshots for 1440, 1280, and 768.
- README documents HTTP mode before mock-only mode.
- No real Feishu credentials, tokens, exported users, sync snapshots, `appSecret`, or `apiSecret` are committed outside intended test/runtime responses.

## Next Harness Action After This Plan

After this plan is reviewed, the next harness action is:

```text
Superpowers executing-plans
```

Recommended execution boundary:

```text
Only execute Task 1 through Task 6 for the first vertical slice. Do not start Roles or Directory implementation in this execution pass.
```
