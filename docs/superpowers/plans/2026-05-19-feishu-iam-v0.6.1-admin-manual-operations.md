# Feishu IAM v0.6.1 Admin Manual Operations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the v0.6.1 production admin console manual configuration flow: create applications, permission points, permission groups, group-point bindings, search synced Feishu users, and grant demo application admins from the web UI.

**Architecture:** Add admin-session write endpoints that wrap existing permission domain services and always pass an `admin_web` audit context. Add a local Feishu user search service backed only by the `feishu_users` mirror table. Keep the current admin web layout, but split new form-heavy UI into focused components so `App.tsx` does not absorb all new behavior.

**Tech Stack:** NestJS, Prisma, PostgreSQL, React, Vite, Vitest, Testing Library, Docker Compose versioned SQL migrations.

---

## File Structure

Backend files:

- Modify `apps/api/src/admin/admin-permission.controller.ts`: add admin write endpoints for applications, permission groups, permission points, and group-point bindings.
- Create `apps/api/src/admin/admin-feishu-user-search.service.ts`: query local `feishu_users` mirror table and serialize safe search result fields.
- Create `apps/api/src/admin/admin-feishu-user.controller.ts`: expose `GET /api/v1/admin/feishu-users/search`.
- Modify `apps/api/src/admin/admin.module.ts`: register the new service and controller.
- Modify `apps/api/test/admin.controller.e2e-spec.ts`: cover admin write API permissions, audit context forwarding, group-point binding, and Feishu user search.
- Modify `apps/api/src/prisma/prisma.service.ts`: raise readiness schema marker to `0.6.1`.

Frontend files:

- Modify `apps/admin-web/src/api/permission.ts`: add create application, create permission group, create permission point, and replace permission group points API functions.
- Modify `apps/admin-web/src/api/admin.ts`: add Feishu user search types and API function.
- Create `apps/admin-web/src/components/ApplicationCreatePanel.tsx`: platform-admin-only application create form.
- Create `apps/admin-web/src/components/PermissionCatalogManager.tsx`: create/list permission group and permission point UI.
- Create `apps/admin-web/src/components/PermissionGroupPointBinder.tsx`: bind current application permission points to a permission group.
- Modify `apps/admin-web/src/components/AdminUserCenter.tsx`: replace free-text application IDs with app selection and add local Feishu user search.
- Modify `apps/admin-web/src/App.tsx`: wire new API functions/components into the current application selection state.
- Modify `apps/admin-web/src/App.css`: add compact form, selectable list, search result, and binding styles.
- Modify `apps/admin-web/src/App.test.tsx`: cover the new manual flow and permission-gated UI.

Version and deployment files:

- Modify `package.json`, `apps/api/package.json`, and `apps/admin-web/package.json`: bump version to `0.6.1`.
- Modify `apps/api/src/version/version.controller.ts`: change fallback version to `0.6.1-dev`.
- Modify `deploy/docker-compose.yml` and `deploy/server.env.example`: default image tag and `APP_VERSION` to `v0.6.1` / `0.6.1`.
- Create `migrations/V0_6_1__admin_manual_operations.sql`: record schema version `0.6.1`.
- Modify or create v0.6.1 docs as needed after implementation.
- Create `docs/codex-sessions/YYYY-MM-DD-HHMM-v0.6.1-管理后台手工配置实施.md`: session archive.

---

### Task 1: Backend Admin Write API

**Files:**
- Modify `apps/api/src/admin/admin-permission.controller.ts`
- Test `apps/api/test/admin.controller.e2e-spec.ts`

- [ ] **Step 1: Extend mocked services in the failing test**

In `apps/api/test/admin.controller.e2e-spec.ts`, update the `applications` and `catalog` mocks near the top of the file:

```ts
const applications = {
  listApplications: vi.fn<ApplicationService['listApplications']>(),
  getApplicationByKey: vi.fn<ApplicationService['getApplicationByKey']>(),
  createApplication: vi.fn<ApplicationService['createApplication']>()
};
const catalog = {
  listPermissionPoints: vi.fn<PermissionCatalogService['listPermissionPoints']>(),
  listPermissionGroups: vi.fn<PermissionCatalogService['listPermissionGroups']>(),
  createPermissionPoint: vi.fn<PermissionCatalogService['createPermissionPoint']>(),
  createPermissionGroup: vi.fn<PermissionCatalogService['createPermissionGroup']>(),
  replacePermissionGroupPoints: vi.fn<PermissionCatalogService['replacePermissionGroupPoints']>()
};
```

- [ ] **Step 2: Add default mocked return values**

In the same file, inside `beforeEach`, add these return values after the existing `applications.getApplicationByKey.mockImplementation(...)` setup:

```ts
applications.createApplication.mockResolvedValue({
  id: 'app-demo',
  appKey: 'demo',
  name: 'Demo 应用',
  description: '用于验证 Feishu IAM 手工配置闭环',
  ownerUserId: '5be616gc',
  status: 'active',
  createdAt: new Date('2026-05-19T01:00:00.000Z'),
  updatedAt: new Date('2026-05-19T01:00:00.000Z')
});
catalog.createPermissionPoint.mockResolvedValue({
  id: 'point-demo-view',
  applicationId: 'app-demo',
  key: 'demo.view.all',
  name: '查看 Demo',
  description: null,
  status: 'active',
  createdAt: new Date('2026-05-19T01:00:00.000Z'),
  updatedAt: new Date('2026-05-19T01:00:00.000Z')
});
catalog.createPermissionGroup.mockResolvedValue({
  id: 'group-demo-default',
  applicationId: 'app-demo',
  key: 'demo.default',
  name: 'Demo 默认权限组',
  description: null,
  status: 'active',
  createdAt: new Date('2026-05-19T01:00:00.000Z'),
  updatedAt: new Date('2026-05-19T01:00:00.000Z')
});
catalog.replacePermissionGroupPoints.mockResolvedValue(undefined);
```

- [ ] **Step 3: Write failing tests for create application and denied application admin**

Append these tests near the existing admin application API tests:

```ts
it('POST /api/v1/admin/applications 平台管理员可创建应用并传入 admin 审计上下文', async () => {
  auth.getContextFromSessionSecret.mockResolvedValue({
    adminUserId: 'admin-platform',
    feishuUserId: 'ou_platform',
    displayName: '平台管理员',
    roles: ['platform_admin'],
    applicationIds: []
  });
  const httpServer = app.getHttpServer() as SupertestApp;

  await request(httpServer)
    .post('/api/v1/admin/applications')
    .set('Cookie', ['feishu_iam_admin_session=bias_platform'])
    .set('x-request-id', 'req-admin-create-app')
    .set('user-agent', 'vitest-admin-console')
    .send({
      appKey: 'demo',
      name: 'Demo 应用',
      description: '用于验证 Feishu IAM 手工配置闭环',
      ownerUserId: '5be616gc'
    })
    .expect(201)
    .expect((response) => {
      expect(getField(response.body as unknown, 'appKey')).toBe('demo');
      expect(JSON.stringify(response.body)).not.toMatch(INTERNAL_OR_SENSITIVE_FIELD_PATTERN);
    });

  expect(applications.createApplication).toHaveBeenCalledWith(
    {
      appKey: 'demo',
      name: 'Demo 应用',
      description: '用于验证 Feishu IAM 手工配置闭环',
      ownerUserId: '5be616gc'
    },
    expect.objectContaining({
      actorType: 'admin_user',
      actorId: 'admin-platform',
      source: 'admin_web',
      requestId: 'req-admin-create-app',
      userAgent: 'vitest-admin-console'
    }) as unknown
  );
});

it('POST /api/v1/admin/applications 应用管理员不能创建应用', async () => {
  auth.getContextFromSessionSecret.mockResolvedValue({
    adminUserId: 'admin-app',
    feishuUserId: 'ou_app',
    displayName: '应用管理员',
    roles: ['application_admin'],
    applicationIds: ['app-finance']
  });
  const httpServer = app.getHttpServer() as SupertestApp;

  await request(httpServer)
    .post('/api/v1/admin/applications')
    .set('Cookie', ['feishu_iam_admin_session=bias_app'])
    .send({ appKey: 'demo', name: 'Demo 应用' })
    .expect(403)
    .expect((response) => {
      expect(getErrorCode(response.body as unknown)).toBe('ADMIN_PERMISSION_DENIED');
    });

  expect(applications.createApplication).not.toHaveBeenCalled();
});
```

- [ ] **Step 4: Write failing tests for permission point and group writes**

Append:

```ts
it('POST /api/v1/admin/applications/demo/permission-points 授权应用管理员可创建权限点', async () => {
  auth.getContextFromSessionSecret.mockResolvedValue({
    adminUserId: 'admin-app-demo',
    feishuUserId: 'ou_app_demo',
    displayName: 'Demo 应用管理员',
    roles: ['application_admin'],
    applicationIds: ['app-demo']
  });
  const httpServer = app.getHttpServer() as SupertestApp;

  await request(httpServer)
    .post('/api/v1/admin/applications/demo/permission-points')
    .set('Cookie', ['feishu_iam_admin_session=bias_app_demo'])
    .set('x-request-id', 'req-admin-create-point')
    .send({ key: 'demo.view.all', name: '查看 Demo' })
    .expect(201)
    .expect((response) => {
      expect(getField(response.body as unknown, 'key')).toBe('demo.view.all');
    });

  expect(applications.getApplicationByKey).toHaveBeenCalledWith('demo');
  expect(catalog.createPermissionPoint).toHaveBeenCalledWith(
    'demo',
    { key: 'demo.view.all', name: '查看 Demo' },
    expect.objectContaining({
      actorType: 'admin_user',
      actorId: 'admin-app-demo',
      source: 'admin_web',
      requestId: 'req-admin-create-point'
    }) as unknown
  );
});

it('POST /api/v1/admin/applications/demo/permission-groups 未授权应用管理员被拒绝', async () => {
  auth.getContextFromSessionSecret.mockResolvedValue({
    adminUserId: 'admin-app-finance',
    feishuUserId: 'ou_app_finance',
    displayName: '财务应用管理员',
    roles: ['application_admin'],
    applicationIds: ['app-finance']
  });
  const httpServer = app.getHttpServer() as SupertestApp;

  await request(httpServer)
    .post('/api/v1/admin/applications/demo/permission-groups')
    .set('Cookie', ['feishu_iam_admin_session=bias_app_finance'])
    .send({ key: 'demo.default', name: 'Demo 默认权限组' })
    .expect(403)
    .expect((response) => {
      expect(getErrorCode(response.body as unknown)).toBe('ADMIN_PERMISSION_DENIED');
    });

  expect(applications.getApplicationByKey).toHaveBeenCalledWith('demo');
  expect(catalog.createPermissionGroup).not.toHaveBeenCalled();
});
```

- [ ] **Step 5: Write failing test for permission group point binding**

Append:

```ts
it('PUT /api/v1/admin/applications/demo/permission-groups/:id/points 授权管理员可替换权限点绑定', async () => {
  auth.getContextFromSessionSecret.mockResolvedValue({
    adminUserId: 'admin-platform',
    feishuUserId: 'ou_platform',
    displayName: '平台管理员',
    roles: ['platform_admin'],
    applicationIds: []
  });
  const httpServer = app.getHttpServer() as SupertestApp;

  await request(httpServer)
    .put('/api/v1/admin/applications/demo/permission-groups/group-demo-default/points')
    .set('Cookie', ['feishu_iam_admin_session=bias_platform'])
    .set('x-request-id', 'req-admin-bind-points')
    .send({ pointIds: ['point-demo-view'] })
    .expect(200)
    .expect((response) => {
      expect(response.body).toEqual({ ok: true });
    });

  expect(applications.getApplicationByKey).toHaveBeenCalledWith('demo');
  expect(catalog.replacePermissionGroupPoints).toHaveBeenCalledWith(
    'demo',
    'group-demo-default',
    ['point-demo-view'],
    expect.objectContaining({
      actorType: 'admin_user',
      actorId: 'admin-platform',
      source: 'admin_web',
      requestId: 'req-admin-bind-points'
    }) as unknown
  );
});
```

- [ ] **Step 6: Run the backend admin tests and confirm failure**

Run:

```bash
pnpm --filter @feishu-iam/api test -- admin.controller.e2e-spec.ts
```

Expected: tests fail with 404 for the new admin application write routes, or with mock method not called.

- [ ] **Step 7: Implement admin write endpoints**

In `apps/api/src/admin/admin-permission.controller.ts`, update imports:

```ts
import { Body, Controller, Get, Inject, Param, Post, Put, Req, UseFilters, UseGuards } from '@nestjs/common';
```

Add body types near the existing `IamRoleResponse` type:

```ts
type CreateApplicationBody = {
  appKey: string;
  name: string;
  description?: string;
  ownerUserId?: string;
};

type CreateCatalogBody = {
  key: string;
  name: string;
  description?: string;
};

type ReplacePermissionGroupPointsBody = {
  pointIds?: string[];
};

type OkResponse = {
  ok: true;
};
```

Add methods to `AdminPermissionController`:

```ts
  @Post()
  async createApplication(
    @Body() body: CreateApplicationBody,
    @Req() request: Request
  ): Promise<Awaited<ReturnType<ApplicationService['createApplication']>>> {
    const context = readRequiredAdminContext(request);
    this.permission.assertCanManageAdmins(context);
    return this.applications.createApplication(body, buildAdminAuditContext(request, context));
  }

  @Post('/:appKey/permission-points')
  async createPermissionPoint(
    @Param('appKey') appKey: string,
    @Body() body: CreateCatalogBody,
    @Req() request: Request
  ): Promise<Awaited<ReturnType<PermissionCatalogService['createPermissionPoint']>>> {
    await this.assertCanManageApplication(appKey, request);
    return this.catalog.createPermissionPoint(appKey, body, buildAdminAuditContext(request, readRequiredAdminContext(request)));
  }

  @Post('/:appKey/permission-groups')
  async createPermissionGroup(
    @Param('appKey') appKey: string,
    @Body() body: CreateCatalogBody,
    @Req() request: Request
  ): Promise<Awaited<ReturnType<PermissionCatalogService['createPermissionGroup']>>> {
    await this.assertCanManageApplication(appKey, request);
    return this.catalog.createPermissionGroup(appKey, body, buildAdminAuditContext(request, readRequiredAdminContext(request)));
  }

  @Put('/:appKey/permission-groups/:groupId/points')
  async replacePermissionGroupPoints(
    @Param('appKey') appKey: string,
    @Param('groupId') groupId: string,
    @Body() body: ReplacePermissionGroupPointsBody,
    @Req() request: Request
  ): Promise<OkResponse> {
    await this.assertCanManageApplication(appKey, request);
    await this.catalog.replacePermissionGroupPoints(
      appKey,
      groupId,
      readStringArrayField(body, 'pointIds', 'PERMISSION_POINT_IDS_INVALID', '权限点列表必须是字符串数组'),
      buildAdminAuditContext(request, readRequiredAdminContext(request))
    );
    return { ok: true };
  }
```

Add helper functions at the bottom:

```ts
function buildAdminAuditContext(request: Request, context: AdminContext) {
  return {
    actorType: 'admin_user' as const,
    actorId: context.adminUserId,
    source: 'admin_web' as const,
    requestId: getAdminRequestId(request),
    ip: request.ip ?? null,
    userAgent: request.header('user-agent') ?? null
  };
}

function readStringArrayField<T extends string>(
  body: unknown,
  field: string,
  code: string,
  message: string
): T[] {
  if (!isRecord(body)) {
    throw new AdminDomainError(code, message, 422);
  }

  const value = body[field];
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new AdminDomainError(code, message, 422);
  }

  return value.map((item) => item.trim()).filter((item): item is T => item.length > 0);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
```

Also import `getAdminRequestId`:

```ts
import { getAdminRequestId, readAdminContext } from './admin-request-context';
```

- [ ] **Step 8: Run backend admin tests and fix type issues**

Run:

```bash
pnpm --filter @feishu-iam/api test -- admin.controller.e2e-spec.ts
```

Expected: PASS for the admin controller suite.

- [ ] **Step 9: Commit backend admin write API**

```bash
git add apps/api/src/admin/admin-permission.controller.ts apps/api/test/admin.controller.e2e-spec.ts
git commit -m "feat: add admin permission write endpoints"
```

---

### Task 2: Local Feishu User Search API

**Files:**
- Create `apps/api/src/admin/admin-feishu-user-search.service.ts`
- Create `apps/api/src/admin/admin-feishu-user.controller.ts`
- Modify `apps/api/src/admin/admin.module.ts`
- Test `apps/api/test/admin.controller.e2e-spec.ts`

- [ ] **Step 1: Write failing controller tests**

In `apps/api/test/admin.controller.e2e-spec.ts`, import the service:

```ts
import { AdminFeishuUserSearchService } from '../src/admin/admin-feishu-user-search.service';
```

Add mock:

```ts
const feishuUserSearch = {
  search: vi.fn<AdminFeishuUserSearchService['search']>()
};
```

Override it in `beforeAll`:

```ts
.overrideProvider(AdminFeishuUserSearchService)
.useValue(feishuUserSearch)
```

Add default result in `beforeEach`:

```ts
feishuUserSearch.search.mockResolvedValue([
  {
    userId: 'yuxiao',
    name: '禹笑',
    enName: null,
    email: 'yu@example.com',
    mobile: null,
    avatarKey: null,
    isActive: true,
    isDeleted: false
  }
]);
```

Append tests:

```ts
it('GET /api/v1/admin/feishu-users/search 平台管理员可搜索本地飞书用户', async () => {
  auth.getContextFromSessionSecret.mockResolvedValue({
    adminUserId: 'admin-platform',
    feishuUserId: 'ou_platform',
    displayName: '平台管理员',
    roles: ['platform_admin'],
    applicationIds: []
  });
  const httpServer = app.getHttpServer() as SupertestApp;

  await request(httpServer)
    .get('/api/v1/admin/feishu-users/search?query=%E7%A6%B9%E7%AC%91')
    .set('Cookie', ['feishu_iam_admin_session=bias_platform'])
    .expect(200)
    .expect((response) => {
      expect(getField(response.body as unknown, 'items')).toEqual([
        expect.objectContaining({
          userId: 'yuxiao',
          name: '禹笑',
          isActive: true,
          isDeleted: false
        })
      ]);
      expect(JSON.stringify(response.body)).not.toMatch(/rawPayload|secret|token|cookie|password/i);
    });

  expect(feishuUserSearch.search).toHaveBeenCalledWith('禹笑');
});

it('GET /api/v1/admin/feishu-users/search 空 query 返回 422', async () => {
  const httpServer = app.getHttpServer() as SupertestApp;

  await request(httpServer)
    .get('/api/v1/admin/feishu-users/search?query=')
    .set('Cookie', ['feishu_iam_admin_session=bias_platform'])
    .expect(422)
    .expect((response) => {
      expect(getErrorCode(response.body as unknown)).toBe('ADMIN_FEISHU_USER_QUERY_INVALID');
    });
});
```

- [ ] **Step 2: Run the failing test**

```bash
pnpm --filter @feishu-iam/api test -- admin.controller.e2e-spec.ts
```

Expected: FAIL because `AdminFeishuUserSearchService` and route do not exist.

- [ ] **Step 3: Create search service**

Create `apps/api/src/admin/admin-feishu-user-search.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type AdminFeishuUserSearchResult = {
  userId: string;
  name: string;
  enName: string | null;
  email: string | null;
  mobile: string | null;
  avatarKey: string | null;
  isActive: boolean;
  isDeleted: boolean;
};

@Injectable()
export class AdminFeishuUserSearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(query: string): Promise<AdminFeishuUserSearchResult[]> {
    const normalizedQuery = normalizeQuery(query);
    const users = await this.prisma.feishuUser.findMany({
      where: {
        OR: [
          { userId: { contains: normalizedQuery, mode: 'insensitive' } },
          { name: { contains: normalizedQuery, mode: 'insensitive' } },
          { enName: { contains: normalizedQuery, mode: 'insensitive' } },
          { email: { contains: normalizedQuery, mode: 'insensitive' } }
        ]
      },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
      take: 20
    });

    return users.map((user) => ({
      userId: user.userId,
      name: user.name,
      enName: user.enName,
      email: user.email,
      mobile: user.mobileVisible ? user.mobile : null,
      avatarKey: user.avatarKey,
      isActive: user.isActive,
      isDeleted: user.isDeleted
    }));
  }
}

function normalizeQuery(query: string): string {
  const normalizedQuery = query.trim();
  if (normalizedQuery.length === 0 || normalizedQuery.length > 64) {
    throw new Error('ADMIN_FEISHU_USER_QUERY_INVALID');
  }
  return normalizedQuery;
}
```

- [ ] **Step 4: Convert query validation error to admin domain error**

Replace the `throw new Error(...)` branch with an exported validator:

```ts
import { AdminDomainError } from './admin.types';
```

Use:

```ts
throw new AdminDomainError('ADMIN_FEISHU_USER_QUERY_INVALID', '飞书用户搜索关键词不合法', 422);
```

- [ ] **Step 5: Create controller**

Create `apps/api/src/admin/admin-feishu-user.controller.ts`:

```ts
import { Controller, Get, Inject, Query, Req, UseFilters, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AdminErrorFilter } from './admin-error.filter';
import { AdminFeishuUserSearchService, type AdminFeishuUserSearchResult } from './admin-feishu-user-search.service';
import { readAdminContext } from './admin-request-context';
import { AdminSessionGuard } from './admin-session.guard';
import { AdminDomainError } from './admin.types';

@Controller('/api/v1/admin/feishu-users')
@UseGuards(AdminSessionGuard)
@UseFilters(AdminErrorFilter)
export class AdminFeishuUserController {
  constructor(
    @Inject(AdminFeishuUserSearchService)
    private readonly searchService: AdminFeishuUserSearchService
  ) {}

  @Get('/search')
  async search(
    @Query('query') query: string | undefined,
    @Req() request: Request
  ): Promise<{ items: AdminFeishuUserSearchResult[] }> {
    const context = readAdminContext(request);
    if (!context) {
      throw new AdminDomainError('ADMIN_SESSION_REQUIRED', '需要登录 Feishu IAM 管理后台', 401);
    }

    return { items: await this.searchService.search(query ?? '') };
  }
}
```

- [ ] **Step 6: Register controller and service**

Modify `apps/api/src/admin/admin.module.ts`:

```ts
import { AdminFeishuUserController } from './admin-feishu-user.controller';
import { AdminFeishuUserSearchService } from './admin-feishu-user-search.service';
```

Add `AdminFeishuUserController` to `controllers` and `AdminFeishuUserSearchService` to `providers`.

- [ ] **Step 7: Run tests**

```bash
pnpm --filter @feishu-iam/api test -- admin.controller.e2e-spec.ts
```

Expected: PASS.

- [ ] **Step 8: Commit Feishu user search API**

```bash
git add apps/api/src/admin/admin-feishu-user-search.service.ts apps/api/src/admin/admin-feishu-user.controller.ts apps/api/src/admin/admin.module.ts apps/api/test/admin.controller.e2e-spec.ts
git commit -m "feat: add admin feishu user search"
```

---

### Task 3: Frontend API Client Functions

**Files:**
- Modify `apps/admin-web/src/api/permission.ts`
- Modify `apps/admin-web/src/api/admin.ts`
- Test through `apps/admin-web/src/App.test.tsx` in later UI tasks

- [ ] **Step 1: Add permission write input types**

In `apps/admin-web/src/api/permission.ts`, add:

```ts
export type CreateApplicationInput = {
  appKey: string;
  name: string;
  description?: string;
  ownerUserId?: string;
};

export type CreateCatalogInput = {
  key: string;
  name: string;
  description?: string;
};
```

- [ ] **Step 2: Add permission write functions**

Append:

```ts
export async function createApplication(input: CreateApplicationInput): Promise<Application> {
  return readJson<Application>('/api/v1/admin/applications', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input)
  });
}

export async function createPermissionGroup(appKey: string, input: CreateCatalogInput): Promise<PermissionGroup> {
  return readJson<PermissionGroup>(`/api/v1/admin/applications/${encodeURIComponent(appKey)}/permission-groups`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input)
  });
}

export async function createPermissionPoint(appKey: string, input: CreateCatalogInput): Promise<PermissionPoint> {
  return readJson<PermissionPoint>(`/api/v1/admin/applications/${encodeURIComponent(appKey)}/permission-points`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input)
  });
}

export async function replacePermissionGroupPoints(
  appKey: string,
  groupId: string,
  pointIds: string[]
): Promise<void> {
  await readJson<{ ok: true }>(
    `/api/v1/admin/applications/${encodeURIComponent(appKey)}/permission-groups/${encodeURIComponent(groupId)}/points`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pointIds })
    }
  );
}
```

- [ ] **Step 3: Add safe messages for new error codes**

In `safeErrorMessage`, extend `codeMessages`:

```ts
APPLICATION_KEY_CONFLICT: '应用 key 已存在',
PERMISSION_KEY_INVALID: '权限 key 必须以当前 app_key 加点号开头',
PERMISSION_POINT_IDS_INVALID: '权限点列表不合法'
```

- [ ] **Step 4: Add Feishu user search API types and function**

In `apps/admin-web/src/api/admin.ts`, add:

```ts
export type AdminFeishuUserSearchResult = {
  userId: string;
  name: string;
  enName?: string | null;
  email?: string | null;
  mobile?: string | null;
  avatarKey?: string | null;
  isActive: boolean;
  isDeleted: boolean;
};
```

Add function:

```ts
export async function searchAdminFeishuUsers(query: string): Promise<AdminFeishuUserSearchResult[]> {
  const params = new URLSearchParams({ query });
  const result = await readJson<{ items: AdminFeishuUserSearchResult[] }>(
    `/api/v1/admin/feishu-users/search?${params.toString()}`
  );
  return result.items;
}
```

Extend `adminErrorMessageByCode`:

```ts
ADMIN_FEISHU_USER_QUERY_INVALID: '飞书用户搜索关键词不合法'
```

- [ ] **Step 5: Typecheck frontend API changes**

```bash
pnpm --filter @feishu-iam/admin-web typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit API client functions**

```bash
git add apps/admin-web/src/api/permission.ts apps/admin-web/src/api/admin.ts
git commit -m "feat: add admin web manual operation APIs"
```

---

### Task 4: Application and Permission Catalog UI

**Files:**
- Create `apps/admin-web/src/components/ApplicationCreatePanel.tsx`
- Create `apps/admin-web/src/components/PermissionCatalogManager.tsx`
- Create `apps/admin-web/src/components/PermissionGroupPointBinder.tsx`
- Modify `apps/admin-web/src/App.tsx`
- Modify `apps/admin-web/src/App.css`
- Test `apps/admin-web/src/App.test.tsx`

- [ ] **Step 1: Extend the existing frontend fetch helper**

In `apps/admin-web/src/App.test.tsx`, extend the `mockFetch` options type:

```tsx
function mockFetch(options: {
  adminMe?: AdminMe;
  feishuStatus: FeishuStatus;
  syncRuns: FeishuSyncRun[];
  diagnostics?: FeishuFieldDiagnostics;
  createdClientSecret?: string;
  environments?: EnvironmentFixture[];
  createdEnvironment?: EnvironmentFixture;
  createdAdminUser?: AdminUserFixture;
  adminUsers?: AdminUserFixture[];
  onRequest?: (url: string, method: string, body: unknown) => void;
  onCreateAdminUser?: (body: unknown) => void;
  customResponse?: (url: string, method: string, body: unknown) => Promise<Response> | Response | null;
}) {
```

At the top of the `fetch` implementation inside `mockFetch`, replace the current `options.onRequest?.(url);` line with:

```tsx
const body: unknown = typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : init?.body;
options.onRequest?.(url, method, body);
const customResponse = options.customResponse?.(url, method, body);
if (customResponse) {
  return customResponse;
}
```

In the existing admin-user POST branch, reuse `body`:

```tsx
if (url === '/api/v1/admin/admin-users') {
  if (method === 'POST') {
    options.onCreateAdminUser?.(body);
    const created = options.createdAdminUser ?? makeAdminUser({ id: 'admin-user-created', displayName: '新管理员' });
    adminUsers = [...adminUsers, created];
    return jsonResponse(created);
  }
  return jsonResponse({ items: adminUsers, total: adminUsers.length, page: 1, pageSize: 20 });
}
```

Existing tests that pass `onRequest: (url) => ...` remain valid because JavaScript ignores extra callback arguments.

- [ ] **Step 2: Write failing test for creating application**

In `apps/admin-web/src/App.test.tsx`, add a test in the main `describe('App')` block:

```tsx
it('平台管理员可以创建 demo 应用并自动选中', async () => {
  const user = userEvent.setup();
  const requested: Array<{ url: string; method: string; body?: unknown }> = [];

  mockFetch({
    feishuStatus: makeStatus(),
    syncRuns: [makeRun()],
    onRequest: (url, method, body) => {
      requested.push({ url, method, body });
    },
    customResponse: (url, method) => {
      if (url === '/api/v1/admin/applications' && method === 'POST') {
        return jsonResponse(makeApplication({ id: 'app-demo', appKey: 'demo', name: 'Demo 应用' }));
      }
      if (url === '/api/v1/admin/applications/demo/permission-groups') {
        return jsonResponse({ items: [] });
      }
      if (url === '/api/v1/admin/applications/demo/permission-points') {
        return jsonResponse({ items: [] });
      }
      if (url === '/api/v1/admin/applications/demo/iam-roles') {
        return jsonResponse({ items: [] });
      }
      if (url === '/api/v1/admin/applications/demo/environments') {
        return jsonResponse({ items: [] });
      }
      return null;
    }
  });

  render(<App />);

  const section = await screen.findByRole('region', { name: '应用与权限' });
  await user.type(within(section).getByLabelText('应用 key'), 'demo');
  await user.type(within(section).getByLabelText('应用名称'), 'Demo 应用');
  await user.click(within(section).getByRole('button', { name: '创建应用' }));

  expect(await within(section).findByText('Demo 应用')).toBeInTheDocument();
  expect(within(section).getByText('demo')).toBeInTheDocument();
  expect(requested).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        url: '/api/v1/admin/applications',
        method: 'POST',
        body: expect.objectContaining({ appKey: 'demo', name: 'Demo 应用' })
      })
    ])
  );
});
```

- [ ] **Step 3: Write failing test for creating point, group, and binding**

Add:

```tsx
it('管理员可以创建权限点、权限组并把权限点加入权限组', async () => {
  const user = userEvent.setup();
  const requests: Array<{ url: string; method: string; body?: unknown }> = [];
  mockFetch({
    feishuStatus: makeStatus(),
    syncRuns: [makeRun()],
    onRequest: (url, method, body) => {
      if (method !== 'GET') {
        requests.push({ url, method, body });
      }
    },
    customResponse: (url, method) => {
      if (url === '/api/v1/admin/applications/finance/permission-points' && method === 'POST') {
        return jsonResponse(makePermissionPoint({ id: 'point-demo-view', key: 'finance.demo.view', name: '查看 Demo' }));
      }
      if (url === '/api/v1/admin/applications/finance/permission-groups' && method === 'POST') {
        return jsonResponse(makePermissionGroup({ id: 'group-demo-default', key: 'finance.demo.default', name: 'Demo 默认权限组' }));
      }
      if (url === '/api/v1/admin/applications/finance/permission-groups/group-demo-default/points' && method === 'PUT') {
        return jsonResponse({ ok: true });
      }
      return null;
    }
  });

  render(<App />);

  const section = await screen.findByRole('region', { name: '应用与权限' });
  await user.click(await within(section).findByRole('button', { name: /finance/ }));

  await user.type(within(section).getByLabelText('权限点 key'), 'finance.demo.view');
  await user.type(within(section).getByLabelText('权限点名称'), '查看 Demo');
  await user.click(within(section).getByRole('button', { name: '创建权限点' }));
  expect(await within(section).findByText('finance.demo.view')).toBeInTheDocument();

  await user.type(within(section).getByLabelText('权限组 key'), 'finance.demo.default');
  await user.type(within(section).getByLabelText('权限组名称'), 'Demo 默认权限组');
  await user.click(within(section).getByRole('button', { name: '创建权限组' }));
  expect(await within(section).findByText('finance.demo.default')).toBeInTheDocument();

  await user.click(within(section).getByLabelText('绑定权限点 finance.demo.view'));
  await user.click(within(section).getByRole('button', { name: '保存权限组绑定' }));

  expect(requests).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        url: '/api/v1/admin/applications/finance/permission-groups/group-demo-default/points',
        method: 'PUT',
        body: { pointIds: ['point-demo-view'] }
      })
    ])
  );
});
```

- [ ] **Step 4: Run failing frontend tests**

```bash
pnpm --filter @feishu-iam/admin-web test -- App.test.tsx
```

Expected: FAIL because the UI controls do not exist.

- [ ] **Step 5: Create `ApplicationCreatePanel`**

Create `apps/admin-web/src/components/ApplicationCreatePanel.tsx`:

```tsx
import { useState } from 'react';
import type { AdminMe } from '../admin-types';
import type { Application, CreateApplicationInput } from '../api/permission';

export function ApplicationCreatePanel(props: {
  admin: AdminMe;
  onCreate: (input: CreateApplicationInput) => Promise<Application>;
}) {
  const canCreate = props.admin.roles.includes('platform_admin');
  const [appKey, setAppKey] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [ownerUserId, setOwnerUserId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!canCreate) {
    return <p className="muted">当前管理员不能创建应用。</p>;
  }

  return (
    <form
      className="compact-form"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <label>
        应用 key
        <input aria-label="应用 key" value={appKey} onChange={(event) => setAppKey(event.target.value)} placeholder="demo" />
      </label>
      <label>
        应用名称
        <input aria-label="应用名称" value={name} onChange={(event) => setName(event.target.value)} placeholder="Demo 应用" />
      </label>
      <label>
        描述
        <input aria-label="应用描述" value={description} onChange={(event) => setDescription(event.target.value)} />
      </label>
      <label>
        owner 飞书 user_id
        <input aria-label="owner 飞书 user_id" value={ownerUserId} onChange={(event) => setOwnerUserId(event.target.value)} />
      </label>
      <button className="text-button" type="submit" disabled={submitting || appKey.trim().length === 0 || name.trim().length === 0}>
        {submitting ? '创建中...' : '创建应用'}
      </button>
      {error ? <p className="inline-error">{error}</p> : null}
    </form>
  );

  async function submit(): Promise<void> {
    setSubmitting(true);
    setError(null);
    try {
      await props.onCreate({
        appKey: appKey.trim(),
        name: name.trim(),
        description: description.trim() || undefined,
        ownerUserId: ownerUserId.trim() || undefined
      });
      setAppKey('');
      setName('');
      setDescription('');
      setOwnerUserId('');
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : '无法创建应用');
    } finally {
      setSubmitting(false);
    }
  }
}
```

- [ ] **Step 6: Create `PermissionGroupPointBinder`**

Create `apps/admin-web/src/components/PermissionGroupPointBinder.tsx`:

```tsx
import { useState } from 'react';
import type { PermissionGroup, PermissionPoint } from '../api/permission';

export function PermissionGroupPointBinder(props: {
  group: PermissionGroup;
  points: PermissionPoint[];
  onSave: (groupId: string, pointIds: string[]) => Promise<void>;
}) {
  const [selectedPointIds, setSelectedPointIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="binder-box">
      <strong>{props.group.name}</strong>
      {props.points.length === 0 ? <p className="muted">当前应用暂无权限点。</p> : null}
      {props.points.map((point) => (
        <label className="checkbox-row" key={point.id}>
          <input
            aria-label={`绑定权限点 ${point.key}`}
            type="checkbox"
            checked={selectedPointIds.includes(point.id)}
            onChange={(event) => {
              setSelectedPointIds((current) =>
                event.target.checked ? [...current, point.id] : current.filter((pointId) => pointId !== point.id)
              );
            }}
          />
          <span>{point.key}</span>
        </label>
      ))}
      <button className="text-button" type="button" disabled={submitting} onClick={() => void save()}>
        {submitting ? '保存中...' : '保存权限组绑定'}
      </button>
      {error ? <p className="inline-error">{error}</p> : null}
    </div>
  );

  async function save(): Promise<void> {
    setSubmitting(true);
    setError(null);
    try {
      await props.onSave(props.group.id, selectedPointIds);
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : '无法保存权限组绑定');
    } finally {
      setSubmitting(false);
    }
  }
}
```

- [ ] **Step 7: Create `PermissionCatalogManager`**

Create `apps/admin-web/src/components/PermissionCatalogManager.tsx`:

```tsx
import { useState } from 'react';
import type { PermissionGroup, PermissionPoint } from '../api/permission';
import { PermissionGroupPointBinder } from './PermissionGroupPointBinder';

export function PermissionCatalogManager(props: {
  appKey: string;
  groups: PermissionGroup[];
  points: PermissionPoint[];
  onCreateGroup: (input: { key: string; name: string; description?: string }) => Promise<void>;
  onCreatePoint: (input: { key: string; name: string; description?: string }) => Promise<void>;
  onReplaceGroupPoints: (groupId: string, pointIds: string[]) => Promise<void>;
}) {
  return (
    <div className="catalog-manager">
      <CatalogCreateForm appKey={props.appKey} title="创建权限点" keyLabel="权限点 key" nameLabel="权限点名称" onSubmit={props.onCreatePoint} />
      <CatalogCreateForm appKey={props.appKey} title="创建权限组" keyLabel="权限组 key" nameLabel="权限组名称" onSubmit={props.onCreateGroup} />
      <div className="binder-grid">
        {props.groups.map((group) => (
          <PermissionGroupPointBinder
            key={group.id}
            group={group}
            points={props.points}
            onSave={props.onReplaceGroupPoints}
          />
        ))}
      </div>
    </div>
  );
}

function CatalogCreateForm(props: {
  appKey: string;
  title: string;
  keyLabel: string;
  nameLabel: string;
  onSubmit: (input: { key: string; name: string; description?: string }) => Promise<void>;
}) {
  const [key, setKey] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const keyValid = key.trim().startsWith(`${props.appKey}.`);

  return (
    <form className="compact-form" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
      <h4>{props.title}</h4>
      <label>
        {props.keyLabel}
        <input aria-label={props.keyLabel} value={key} onChange={(event) => setKey(event.target.value)} placeholder={`${props.appKey}.view.all`} />
      </label>
      {key.trim().length > 0 && !keyValid ? <p className="inline-error">key 必须以 {props.appKey}. 开头</p> : null}
      <label>
        {props.nameLabel}
        <input aria-label={props.nameLabel} value={name} onChange={(event) => setName(event.target.value)} />
      </label>
      <label>
        描述
        <input aria-label={`${props.title}描述`} value={description} onChange={(event) => setDescription(event.target.value)} />
      </label>
      <button className="text-button" type="submit" disabled={submitting || !keyValid || name.trim().length === 0}>
        {submitting ? '创建中...' : props.title}
      </button>
      {error ? <p className="inline-error">{error}</p> : null}
    </form>
  );

  async function submit(): Promise<void> {
    setSubmitting(true);
    setError(null);
    try {
      await props.onSubmit({ key: key.trim(), name: name.trim(), description: description.trim() || undefined });
      setKey('');
      setName('');
      setDescription('');
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : `无法${props.title}`);
    } finally {
      setSubmitting(false);
    }
  }
}
```

- [ ] **Step 8: Wire components into `App.tsx`**

Modify imports:

```tsx
import {
  createApplication,
  createPermissionGroup,
  createPermissionPoint,
  fetchApplications,
  fetchIamRoles,
  fetchPermissionGroups,
  fetchPermissionPoints,
  replacePermissionGroupPoints
} from './api/permission';
import { ApplicationCreatePanel } from './components/ApplicationCreatePanel';
import { PermissionCatalogManager } from './components/PermissionCatalogManager';
```

Add helper functions inside `App`:

```tsx
async function handleCreateApplication(input: CreateApplicationInput): Promise<Application> {
  const created = await createApplication(input);
  setPermissionState((current) => ({
    status: 'loaded',
    applications: current.status === 'loaded' ? [...current.applications, created] : [created]
  }));
  await selectApplication(created.appKey);
  return created;
}

async function handleCreatePermissionPoint(input: CreateCatalogInput): Promise<void> {
  if (!selectedAppKey) return;
  const created = await createPermissionPoint(selectedAppKey, input);
  setPermissionDetailState((current) =>
    current.status === 'loaded' ? { ...current, points: [...current.points, created] } : current
  );
}

async function handleCreatePermissionGroup(input: CreateCatalogInput): Promise<void> {
  if (!selectedAppKey) return;
  const created = await createPermissionGroup(selectedAppKey, input);
  setPermissionDetailState((current) =>
    current.status === 'loaded' ? { ...current, groups: [...current.groups, created] } : current
  );
}

async function handleReplacePermissionGroupPoints(groupId: string, pointIds: string[]): Promise<void> {
  if (!selectedAppKey) return;
  await replacePermissionGroupPoints(selectedAppKey, groupId, pointIds);
}
```

Render `ApplicationCreatePanel` above the application list, and render `PermissionCatalogManager` after the existing read-only catalog cards.

- [ ] **Step 9: Add CSS**

Append to `apps/admin-web/src/App.css`:

```css
.compact-form,
.catalog-manager,
.binder-box {
  display: grid;
  gap: 12px;
  min-width: 0;
  padding: 14px;
  border: 1px solid #d9e1ea;
  border-radius: 8px;
  background: #ffffff;
}

.compact-form label,
.binder-box label {
  display: grid;
  gap: 6px;
  min-width: 0;
  color: #344054;
  font-size: 13px;
  font-weight: 700;
}

.compact-form input,
.compact-form select {
  min-width: 0;
  min-height: 36px;
  padding: 0 10px;
  border: 1px solid #cfd8e3;
  border-radius: 6px;
  font: inherit;
}

.binder-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 12px;
}

.checkbox-row {
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
}
```

- [ ] **Step 10: Run frontend tests**

```bash
pnpm --filter @feishu-iam/admin-web test -- App.test.tsx
```

Expected: PASS.

- [ ] **Step 11: Commit application and permission UI**

```bash
git add apps/admin-web/src/App.tsx apps/admin-web/src/App.css apps/admin-web/src/App.test.tsx apps/admin-web/src/components/ApplicationCreatePanel.tsx apps/admin-web/src/components/PermissionCatalogManager.tsx apps/admin-web/src/components/PermissionGroupPointBinder.tsx
git commit -m "feat: add admin manual permission UI"
```

---

### Task 5: Admin User Search and Application Scope UI

**Files:**
- Modify `apps/admin-web/src/components/AdminUserCenter.tsx`
- Modify `apps/admin-web/src/App.tsx`
- Modify `apps/admin-web/src/api/admin.ts`
- Modify `apps/admin-web/src/App.test.tsx`
- Modify `apps/admin-web/src/App.css`

- [ ] **Step 1: Write failing frontend test**

In `apps/admin-web/src/App.test.tsx`, add:

```tsx
it('平台管理员可以搜索飞书用户并授权为 demo 应用管理员', async () => {
  const user = userEvent.setup();
  let createdAdminBody: unknown;

  mockFetch({
    feishuStatus: makeStatus(),
    syncRuns: [makeRun()],
    onCreateAdminUser: (body) => {
      createdAdminBody = body;
    },
    createdAdminUser: makeAdminUser({
      id: 'admin-yuxiao',
      feishuUserId: 'yuxiao',
      displayName: '禹笑',
      roles: [{ roleKey: 'application_admin', name: '应用管理员' }],
      applicationScopes: [{ id: 'app-finance', appKey: 'finance', name: '财务系统' }]
    })
  });

    customResponse: (url) => {
      if (url === '/api/v1/admin/feishu-users/search?query=%E7%A6%B9%E7%AC%91') {
      return jsonResponse({
        items: [{ userId: 'yuxiao', name: '禹笑', email: 'yu@example.com', isActive: true, isDeleted: false }]
      });
      }
      return null;
    }
  });

  render(<App />);

  const adminSection = await screen.findByRole('region', { name: '管理员授权' });
  await user.type(within(adminSection).getByLabelText('查找飞书用户'), '禹笑');
  await user.click(within(adminSection).getByRole('button', { name: '搜索飞书用户' }));
  await user.click(await within(adminSection).findByRole('button', { name: /选择 禹笑/ }));
  await user.selectOptions(within(adminSection).getByLabelText('管理员角色'), 'application_admin');
  await user.selectOptions(within(adminSection).getByLabelText('应用范围'), 'app-finance');
  await user.click(within(adminSection).getByRole('button', { name: '创建管理员' }));

  expect(createdAdminBody).toEqual({
    feishuUserId: 'yuxiao',
    roleKeys: ['application_admin'],
    applicationIds: ['app-finance']
  });
  expect(await within(adminSection).findByText('禹笑')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run failing test**

```bash
pnpm --filter @feishu-iam/admin-web test -- App.test.tsx
```

Expected: FAIL because the search UI and application scope select do not exist.

- [ ] **Step 3: Pass applications into `AdminUserCenter`**

In `App.tsx`, change:

```tsx
<AdminUserCenter admin={adminState.admin} />
```

to:

```tsx
<AdminUserCenter
  admin={adminState.admin}
  applications={permissionState.status === 'loaded' ? permissionState.applications : []}
/>
```

- [ ] **Step 4: Update component props and imports**

In `apps/admin-web/src/components/AdminUserCenter.tsx`, import:

```tsx
import { createAdminUser, fetchAdminUsers, searchAdminFeishuUsers } from '../api/admin';
import type { AdminFeishuUserSearchResult, AdminUser } from '../api/admin';
import type { Application } from '../api/permission';
```

Change props:

```tsx
export function AdminUserCenter(props: { admin: AdminMe; applications: Application[] }) {
```

- [ ] **Step 5: Replace application ID text input with select and search state**

Use these states:

```tsx
const [selectedApplicationId, setSelectedApplicationId] = useState('');
const [searchInput, setSearchInput] = useState('');
const [searchResults, setSearchResults] = useState<AdminFeishuUserSearchResult[]>([]);
const [searchState, setSearchState] = useState<'idle' | 'loading'>('idle');
const [searchError, setSearchError] = useState<string | null>(null);
```

Remove `applicationIdsInput`.

- [ ] **Step 6: Add search UI above the create form fields**

Inside the platform-admin form, add:

```tsx
<label>
  <span>查找飞书用户</span>
  <input
    aria-label="查找飞书用户"
    value={searchInput}
    onChange={(event) => setSearchInput(event.target.value)}
    placeholder="输入姓名或 user_id"
  />
</label>
<button className="text-button" type="button" disabled={searchState === 'loading'} onClick={() => void handleSearch()}>
  {searchState === 'loading' ? '搜索中...' : '搜索飞书用户'}
</button>
{searchError ? <p className="inline-error">{searchError}</p> : null}
{searchResults.length > 0 ? (
  <ul className="search-result-list">
    {searchResults.map((user) => (
      <li key={user.userId}>
        <span>{user.name} · {user.userId}</span>
        <button className="text-button" type="button" onClick={() => selectFeishuUser(user)}>
          选择 {user.name}
        </button>
      </li>
    ))}
  </ul>
) : null}
```

- [ ] **Step 7: Add application scope select**

Replace the application scope text input with:

```tsx
<label>
  <span>应用范围</span>
  <select
    aria-label="应用范围"
    value={selectedApplicationId}
    onChange={(event) => setSelectedApplicationId(event.target.value)}
    disabled={roleInput !== 'application_admin'}
  >
    <option value="">平台角色不需要选择应用</option>
    {props.applications.map((application) => (
      <option key={application.id} value={application.id}>
        {application.appKey} / {application.name}
      </option>
    ))}
  </select>
</label>
```

- [ ] **Step 8: Add search handlers**

Inside `AdminUserCenter`:

```tsx
async function handleSearch(): Promise<void> {
  const query = searchInput.trim();
  if (!query) {
    setSearchError('请填写姓名或 user_id');
    return;
  }

  setSearchState('loading');
  setSearchError(null);
  try {
    const results = await searchAdminFeishuUsers(query);
    setSearchResults(results);
    if (results.length === 0) {
      setSearchError('未找到已同步飞书用户，请先确认飞书同步状态');
    }
  } catch (error: unknown) {
    setSearchError(error instanceof Error ? error.message : '无法搜索飞书用户');
  } finally {
    setSearchState('idle');
  }
}

function selectFeishuUser(user: AdminFeishuUserSearchResult): void {
  setFeishuUserIdInput(user.userId);
  setSearchResults([]);
  setSearchInput(user.name);
}
```

Change `handleCreate` application IDs:

```tsx
applicationIds: roleInput === 'application_admin' && selectedApplicationId ? [selectedApplicationId] : []
```

Clear `selectedApplicationId` after success.

- [ ] **Step 9: Add CSS**

Append:

```css
.search-result-list {
  display: grid;
  gap: 8px;
  padding: 0;
  margin: 0;
  list-style: none;
}

.search-result-list li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-width: 0;
  padding: 10px;
  border: 1px solid #d9e1ea;
  border-radius: 8px;
  background: #ffffff;
}
```

- [ ] **Step 10: Run tests**

```bash
pnpm --filter @feishu-iam/admin-web test -- App.test.tsx
```

Expected: PASS.

- [ ] **Step 11: Commit admin user search UI**

```bash
git add apps/admin-web/src/App.tsx apps/admin-web/src/App.css apps/admin-web/src/App.test.tsx apps/admin-web/src/components/AdminUserCenter.tsx
git commit -m "feat: add admin user search and app scopes"
```

---

### Task 6: Version, Migration, and Documentation Updates

**Files:**
- Modify `package.json`
- Modify `apps/api/package.json`
- Modify `apps/admin-web/package.json`
- Modify `apps/api/src/version/version.controller.ts`
- Modify `apps/api/src/prisma/prisma.service.ts`
- Modify `deploy/docker-compose.yml`
- Modify `deploy/server.env.example`
- Create `migrations/V0_6_1__admin_manual_operations.sql`
- Modify `docs/permission-model.md`
- Create `docs/codex-sessions/YYYY-MM-DD-HHMM-v0.6.1-管理后台手工配置实施.md`

- [ ] **Step 1: Add migration**

Create `migrations/V0_6_1__admin_manual_operations.sql`:

```sql
INSERT INTO schema_versions(version, description)
VALUES ('0.6.1', '管理后台手工创建应用、权限和应用管理员闭环')
ON CONFLICT (version) DO NOTHING;
```

- [ ] **Step 2: Update readiness schema version**

In `apps/api/src/prisma/prisma.service.ts`, change:

```ts
const REQUIRED_SCHEMA_VERSION = '0.6.1';
```

- [ ] **Step 3: Bump package versions**

Change `"version": "0.6.0"` to `"version": "0.6.1"` in:

```text
package.json
apps/api/package.json
apps/admin-web/package.json
```

- [ ] **Step 4: Update version fallback**

In `apps/api/src/version/version.controller.ts`, change:

```ts
version: process.env.APP_VERSION ?? '0.6.1-dev',
```

- [ ] **Step 5: Update deploy defaults**

In `deploy/docker-compose.yml`, change default image tag and app version defaults:

```yaml
image: ${FEISHU_IAM_IMAGE:-192.168.2.73:5050/ai/feishu-iam}:${FEISHU_IAM_IMAGE_TAG:-v0.6.1}
APP_VERSION: ${APP_VERSION:-0.6.1}
```

In `deploy/server.env.example`, change:

```text
FEISHU_IAM_IMAGE_TAG=v0.6.1
APP_VERSION=0.6.1
```

- [ ] **Step 6: Update docs**

In `docs/permission-model.md`, add a short `v0.6.1` section near the current Web 管理端 section:

```md
## v0.6.1 管理后台手工配置闭环

`v0.6.1` 起，Web 管理端支持平台管理员通过后台 session 直接创建应用，支持平台管理员和授权应用管理员创建权限组、权限点，并支持把权限点绑定到权限组。管理员授权表单支持搜索本地已同步飞书用户，并把指定用户授权为某个应用的应用管理员。

推荐 demo 验收样例：

- 应用 key：`demo`
- 应用名称：`Demo 应用`
- 权限点：`demo.view.all`
- 权限组：`demo.default`

该版本不自动创建 demo 数据；上述内容应由管理员在页面手工录入。
```

- [ ] **Step 7: Add session archive**

Create `docs/codex-sessions/YYYY-MM-DD-HHMM-v0.6.1-管理后台手工配置实施.md` with:

```md
# v0.6.1 管理后台手工配置实施

## 会话目标

实现 `v0.6.1` 管理后台手工配置闭环。

## 用户原始关键要求摘要

- 登录远端后台后创建应用等按钮点击无效。
- 需要能手工创建 demo 应用。
- 需要能手工创建权限组和权限点。
- 需要能手工把禹笑和鄢景松创建为 demo 应用管理员。

## 重要设计决策和原因

- Web 管理端写操作使用 `/api/v1/admin/*` 和管理员 session，不使用前端注入平台 token。
- 飞书用户搜索只查本地同步镜像，不直连飞书开放接口。
- demo 数据不自动初始化，保留真实手工验收价值。

## 修改过的文件

- 记录本次实际修改文件。

## 执行过的关键命令和验证结果

- 记录 `pnpm --filter @feishu-iam/api test -- admin.controller.e2e-spec.ts`。
- 记录 `pnpm --filter @feishu-iam/admin-web test -- App.test.tsx`。
- 记录 `pnpm check`。

## 未完成事项和下一步建议

- 记录远端验收或后续发布事项。
```

When implementing this step, replace `YYYY-MM-DD-HHMM` with the real timestamp and replace the generic file/command bullets with actual results before committing.

- [ ] **Step 8: Run focused checks**

```bash
pnpm --filter @feishu-iam/api typecheck
pnpm --filter @feishu-iam/admin-web typecheck
pnpm --filter @feishu-iam/api test -- admin.controller.e2e-spec.ts
pnpm --filter @feishu-iam/admin-web test -- App.test.tsx
```

Expected: all commands PASS.

- [ ] **Step 9: Commit version and docs**

```bash
git add package.json apps/api/package.json apps/admin-web/package.json apps/api/src/version/version.controller.ts apps/api/src/prisma/prisma.service.ts deploy/docker-compose.yml deploy/server.env.example migrations/V0_6_1__admin_manual_operations.sql docs/permission-model.md docs/codex-sessions/*v0.6.1-管理后台手工配置实施.md
git commit -m "chore: prepare v0.6.1 release metadata"
```

---

### Task 7: Full Verification and Local UI Sanity

**Files:**
- No required source changes unless verification finds bugs.

- [ ] **Step 1: Run full repository check**

```bash
pnpm check
```

Expected: typecheck, lint, and test all PASS.

- [ ] **Step 2: Start local environment if Docker is available**

```bash
pnpm compose:up
```

Expected: `web` and database become healthy. If the first run fails because PostgreSQL is still starting, wait for the database to become healthy and run `pnpm compose:up` again.

- [ ] **Step 3: Verify local health**

```bash
curl -fsS http://localhost:3000/ready
curl -fsS http://localhost:3000/version
```

Expected: `/ready` returns ready status and `/version` returns `0.6.1` when `APP_VERSION=0.6.1` is present, or `0.6.1-dev` without that env.

- [ ] **Step 4: Browser sanity check**

Open the local admin web through the API-hosted entry:

```text
http://localhost:3000/
```

Manual check:

- Visible buttons either work, show loading/error feedback, or are disabled with clear reason.
- Create application form validates required fields.
- Permission key fields require the current app key prefix.
- Admin user search does not show raw payload or sensitive fields.

- [ ] **Step 5: Commit any verification fixes**

If fixes are needed:

```bash
git add <changed-files>
git commit -m "fix: stabilize v0.6.1 admin manual flow"
```

If no fixes are needed, do not create an empty commit.

---

### Task 8: Remote Release Handoff

**Files:**
- No source changes unless release verification finds docs gaps.

- [ ] **Step 1: Build and push image**

Use the repo’s established Docker registry and target linux/amd64:

```bash
docker buildx build --platform linux/amd64 -f deploy/api.Dockerfile -t 192.168.2.73:5050/ai/feishu-iam:v0.6.1 --push .
```

Expected: image push succeeds and prints the pushed digest.

- [ ] **Step 2: Upgrade server**

On `dev@192.168.2.112`, in `~/feishu-iam`, update server `.env` locally:

```text
FEISHU_IAM_IMAGE_TAG=v0.6.1
APP_VERSION=0.6.1
```

Then run:

```bash
./upgrade.sh
```

Expected: backup created, migration `0.6.1` applied or skipped if already applied, web starts, health check passes, version check passes.

- [ ] **Step 3: Verify remote endpoints**

```bash
curl -fsS http://192.168.2.112:8000/ready
curl -fsS http://192.168.2.112:8000/version
curl -fsS http://feishu-iam.example.com/version
```

Expected: `/version` returns `0.6.1`.

- [ ] **Step 4: Remote manual acceptance**

In `http://feishu-iam.example.com/`, verify:

- 王文哲 can log in as `platform_admin`.
- 王文哲 creates `demo` application.
- 王文哲 creates `demo.view.all` permission point.
- 王文哲 creates `demo.default` permission group.
- 王文哲 binds `demo.view.all` into `demo.default`.
- 王文哲 searches “禹笑” and “鄢景松”.
- 王文哲 creates both users as `application_admin` scoped to demo.
- 禹笑 or 鄢景松 logs in and can see/manage only demo.
- Audit logs show the create and bind operations.

- [ ] **Step 5: Record release session**

Update or create a release session archive in `docs/codex-sessions/` with:

- image tag and digest
- `./upgrade.sh` result
- `/ready` and `/version` output summary
- manual acceptance result
- remaining risks

- [ ] **Step 6: Commit release archive if changed**

```bash
git add docs/codex-sessions/*v0.6.1*
git commit -m "docs: record v0.6.1 acceptance"
```

---

## Self-Review Checklist

- Spec coverage: Tasks 1-2 cover backend admin writes and Feishu search; Tasks 3-5 cover frontend manual operations; Task 6 covers versioning, migration, docs, and session archive; Tasks 7-8 cover local and remote verification.
- Scope: The plan does not add HTTPS, OIDC expansion, refresh token, SAML, resource-level permissions, ABAC, Feishu role sync, Feishu user group sync, one-click demo seeding, or a full onboarding wizard.
- Safety: The plan keeps secrets out of code, docs, tests, logs, and archives. It preserves one-time client secret behavior.
- Test strategy: Backend and frontend tests are written before implementation in each feature task, then focused tests and `pnpm check` verify the full repo.
