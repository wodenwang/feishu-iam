# feishu-iam v0.1.4 Directory runtime-backed 只读浏览 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 `/directory` 在 `VITE_IAM_API_MODE=http` 下通过 Fastify runtime 浏览飞书部门树和用户列表，覆盖部门筛选、分页、详情 Drawer、loading/empty/API error/401/403/requestId。

**Architecture:** 保持现有 Ant Design Directory 页面布局，不新建 Pencil 原型；只补齐后端 directory query contract、前端 HTTP API 和 DTO mapping、页面错误态。后端继续只暴露只读 projection，不做真实同步、编辑用户、编辑部门或 Roles 授权保存。

**Tech Stack:** React 19、TypeScript、Vite、Ant Design、TanStack Query、Fastify、PostgreSQL、Vitest、Playwright、gstack `/browse`。

---

## Source Inputs

- Office-hours conclusion: current conversation, `v0.1.4` 只覆盖 `/directory` HTTP mode。
- Existing design baseline: `design/feishu-iam-v0.1.0-admin-console.pen`
- Existing screenshots: `design/implementation-screenshots/design-review-fixed/directory-1440x900.png`
- Prior HTTP slice plan: `IMPLEMENTATION_PLAN.md` before this update was v0.1.3 and explicitly excluded Directory.
- Branch: `codex/v0.1.4-directory-runtime-backed`

## Scope

### In Scope

1. `GET /api/directory/departments` 返回可构造部门树的 runtime DTO。
2. `GET /api/directory/users` 支持 `departmentId`、分页、平台管理员 403 和未登录 401。
3. 前端 `httpApi` 实现 `listFeishuDepartments` 和 `listDirectoryUsers`。
4. `dtoMappers` 集中处理 snake_case 到 camelCase，以及缺失字段的安全默认值。
5. `/directory` 在 HTTP mode 展示部门树、用户列表、部门筛选、分页和用户详情 Drawer。
6. `/directory` 覆盖 loading、empty、API error、401、403、requestId。
7. 补充 server、frontend unit/integration、Playwright 或浏览器验证证据。

### Out of Scope

- Roles 创建、编辑、授权保存。
- Sync 真实同步、手动同步、差异处理。
- Dashboard runtime summary。
- Application Detail。
- Application Onboarding。
- 真实飞书 OAuth。
- 部署、CI、Docker、release/tag/push。
- 新 Pencil 原型。

## File Structure

### Modify

- `server/src/modules/directory/directoryRoutes.ts`
  支持 `departmentId` query；返回部门 `path`、`user_count`、`updated_at`；用户返回 `department_name`、`department_path`、`synced_at`、`local_role_summary`、`last_login_at`、`last_permission_queried_at`。

- `server/tests/directory.test.ts`
  新增 runtime directory contract 测试，覆盖未登录、非管理员、部门筛选、分页、requestId。

- `src/features/iam/types.ts`
  保持现有 `FeishuDepartment` / `DirectoryUser` 类型；必要时只补兼容字段，不扩大业务模型。

- `src/features/iam/dtoMappers.ts`
  新增 `mapRuntimeDepartment`、`mapRuntimeDirectoryUser`。

- `src/features/iam/dtoMappers.test.ts`
  覆盖部门和用户 DTO 映射。

- `src/features/iam/httpApi.ts`
  实现 `listFeishuDepartments`、`listDirectoryUsers`。

- `src/features/iam/httpApi.test.ts`
  覆盖 HTTP directory 请求路径、query、分页映射和 requestId 错误透传。

- `src/pages/Directory/index.tsx`
  展示 requestId；区分 401、403、普通 API error；保留现有部门树、表格、分页和详情 Drawer。

- `src/pages/Directory/index.test.tsx`
  增加 HTTP error state 和 requestId 覆盖，保留 mock mode 现有行为。

- `tests/e2e/v0.1.4-directory-http.spec.ts`
  覆盖登录、初始化、进入 `/directory`、部门筛选、详情 Drawer、三视口截图。

- `README.md`
  更新当前状态和 v0.1.4 本地验收说明。

## Tasks

### Task 1: Backend Directory Contract

**Files:**
- Create/modify: `server/tests/directory.test.ts`
- Modify: `server/src/modules/directory/directoryRoutes.ts`

- [ ] **Step 1: Write failing server tests**

Add tests for:

```ts
it('requires a logged-in platform admin to browse directory users', async () => {
  const unauthenticated = await app.inject({ method: 'GET', url: '/api/directory/users' });
  expect(unauthenticated.statusCode).toBe(401);
  expect(unauthenticated.json()).toMatchObject({ code: 'UNAUTHORIZED', requestId: expect.any(String) });

  const userCookie = await loginCookie(app, 'ou_directory_user', '目录普通用户');
  const forbidden = await app.inject({ method: 'GET', url: '/api/directory/users', headers: { cookie: userCookie } });
  expect(forbidden.statusCode).toBe(403);
  expect(forbidden.json()).toMatchObject({ code: 'FORBIDDEN', requestId: expect.any(String) });
});

it('returns departments and filters users by department subtree', async () => {
  const adminCookie = await loginAndBindAdmin(app, 'ou_directory_admin', '目录管理员');
  await seedDepartment(pool, { id: 'dept_root', name: '飞书 IAM 演示组织', parentId: null });
  await seedDepartment(pool, { id: 'dept_sales', name: '销售部', parentId: 'dept_root' });
  await seedDepartment(pool, { id: 'dept_it', name: '信息化中心', parentId: 'dept_root' });
  await seedDirectoryUser(pool, { feishuUserId: 'ou_sales_001', name: '销售一号', departmentId: 'dept_sales' });
  await seedDirectoryUser(pool, { feishuUserId: 'ou_it_001', name: '研发一号', departmentId: 'dept_it' });

  const departments = await app.inject({ method: 'GET', url: '/api/directory/departments', headers: { cookie: adminCookie } });
  expect(departments.statusCode).toBe(200);
  expect(departments.json().items).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ id: 'dept_root', name: '飞书 IAM 演示组织', parent_id: null, path: '飞书 IAM 演示组织' }),
      expect.objectContaining({ id: 'dept_sales', parent_id: 'dept_root', path: '飞书 IAM 演示组织 / 销售部', user_count: 1 }),
    ]),
  );

  const users = await app.inject({
    method: 'GET',
    url: '/api/directory/users?departmentId=dept_sales&page=1&pageSize=20',
    headers: { cookie: adminCookie },
  });
  expect(users.statusCode).toBe(200);
  expect(users.json()).toMatchObject({ page: 1, pageSize: 20, total: 1 });
  expect(users.json().items).toEqual([
    expect.objectContaining({
      feishu_user_id: 'ou_sales_001',
      name: '销售一号',
      department_id: 'dept_sales',
      department_name: '销售部',
      department_path: '飞书 IAM 演示组织 / 销售部',
      local_role_summary: '-',
    }),
  ]);
});
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
npm run server:test -- server/tests/directory.test.ts
```

Expected: fails because directory contract lacks `departmentId`, path/name/count fields, or the test file does not exist yet.

- [ ] **Step 3: Implement the backend query contract**

In `directoryRoutes.ts`:

- Accept `departmentId` in user list querystring.
- Use a recursive CTE to compute department paths.
- Count users per department for the department tree.
- Join users to departments for `department_name` and `department_path`.
- Filter users by selected department subtree when `departmentId` is present.

- [ ] **Step 4: Verify backend tests pass**

Run:

```bash
npm run server:test -- server/tests/directory.test.ts
```

Expected: all directory tests pass.

### Task 2: Frontend HTTP Directory Service

**Files:**
- Modify: `src/features/iam/dtoMappers.ts`
- Modify: `src/features/iam/dtoMappers.test.ts`
- Modify: `src/features/iam/httpApi.ts`
- Modify: `src/features/iam/httpApi.test.ts`

- [ ] **Step 1: Write mapper tests**

Add tests for `mapRuntimeDepartment` and `mapRuntimeDirectoryUser`, asserting:

- `parent_id` maps to `parentId`.
- `user_count` maps to `userCount`.
- `feishu_user_id` maps to `feishuUserId`.
- `department_name` / `department_path` map to display fields.
- missing optional fields fall back to `'-'` or undefined consistently with the existing UI.

- [ ] **Step 2: Write HTTP API tests**

Mock `fetch` and assert:

```ts
await listFeishuDepartments();
expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/api/directory/departments'), expect.any(Object));

await listDirectoryUsers({ departmentId: 'dept_sales', page: 2, pageSize: 20 });
expect(fetch).toHaveBeenCalledWith(expect.stringContaining('departmentId=dept_sales'), expect.any(Object));
```

- [ ] **Step 3: Implement mappers and HTTP methods**

Add exports:

```ts
export function mapRuntimeDepartment(item: RuntimeDepartment): FeishuDepartment;
export function mapRuntimeDirectoryUser(item: RuntimeDirectoryUser): DirectoryUser;
```

Implement:

```ts
export function listFeishuDepartments(): Promise<FeishuDepartment[]>;
export function listDirectoryUsers(request: PageRequest & { departmentId?: string }): Promise<PageResult<DirectoryUser>>;
```

- [ ] **Step 4: Verify frontend service tests pass**

Run:

```bash
npm test -- src/features/iam/dtoMappers.test.ts src/features/iam/httpApi.test.ts
```

Expected: all selected frontend tests pass.

### Task 3: Directory Page Runtime States

**Files:**
- Modify: `src/pages/Directory/index.tsx`
- Modify: `src/pages/Directory/index.test.tsx`

- [ ] **Step 1: Write page tests for runtime errors**

Mock query/service errors with `IamHttpError` and assert:

- 401 shows a session-expired message and retry/login recovery copy.
- 403 shows no-permission copy.
- API error shows `requestId`.
- Empty selected department state remains visible.

- [ ] **Step 2: Implement page error state handling**

In `DirectoryPage`, use `isIamHttpError` and compute an error view:

- `status === 401`: title `会话已过期`
- `status === 403`: title `无权查看组织目录`
- otherwise: title `加载飞书目录失败`
- if `requestId` exists, render it as copyable code text.

- [ ] **Step 3: Verify page tests pass**

Run:

```bash
npm test -- src/pages/Directory/index.test.tsx
```

Expected: all Directory page tests pass.

### Task 4: Browser/E2E Verification

**Files:**
- Create: `tests/e2e/v0.1.4-directory-http.spec.ts`
- Modify: `README.md`

- [ ] **Step 1: Add E2E coverage**

Create a Playwright spec that:

1. Opens `/login`.
2. Uses local mock Feishu login.
3. Binds platform admin if needed.
4. Opens `/directory`.
5. Confirms `HTTP runtime`, `部门树`, `用户列表`.
6. Clicks a department.
7. Opens user detail Drawer.
8. Saves screenshots under `design/implementation-screenshots/v0.1.4-directory/`.

- [ ] **Step 2: Update README**

Add a `v0.1.4 Directory HTTP mode 本地验收` section with the exact server, Vite, and E2E commands.

- [ ] **Step 3: Run fresh verification**

Run:

```bash
npm run server:test -- server/tests/directory.test.ts
npm test -- src/features/iam/dtoMappers.test.ts src/features/iam/httpApi.test.ts src/pages/Directory/index.test.tsx
npm run build
```

If a local PostgreSQL `DATABASE_URL` is available, also run:

```bash
E2E_RESET_DATABASE=true VITE_IAM_API_MODE=http npm run e2e -- tests/e2e/v0.1.4-directory-http.spec.ts
```

Expected: selected tests and build pass; E2E either passes or is explicitly reported as skipped because local DB/server credentials are unavailable.

## Done Criteria

- `/directory` works in HTTP mode without unsupported service errors.
- Department tree and user list are runtime-backed.
- Department selection filters users.
- Pagination stays server-backed.
- User detail Drawer opens from runtime-backed rows.
- Loading, empty, API error, 401, 403, requestId are covered by tests or browser evidence.
- Roles, Sync, Dashboard, Application Detail, Application Onboarding are untouched except incidental shared helpers.
- No remote push, PR, merge, release, tag, deploy, or Docker upload is performed without explicit authorization.
