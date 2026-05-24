# feishu-iam v0.1.5 Roles HTTP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 `/roles` 在 `VITE_IAM_API_MODE=http` 下通过 Fastify runtime 完成角色列表、创建/编辑、停用、授权保存和错误追踪。

**Architecture:** 保持既有 Ant Design `RolesPage` 信息架构不变，补齐后端 role projection、permission tree 只读接口、前端 DTO mapping 和 HTTP service。严格复用 v0.1.4 的 `/directory` 只读接口作为授权对象选择来源，不修改目录浏览边界。

**Tech Stack:** React 19、TypeScript、Vite、Ant Design、TanStack Query、Fastify、PostgreSQL、Vitest、Playwright、gstack `/browse`。

---

## Source Inputs

- Office-hours conclusion: `v0.1.5 Roles HTTP` 是下一个最小版本。
- Design review: `docs/superpowers/plans/2026-05-24-v0.1.5-roles-http-plan-design-review.md`
- Engineering review: `docs/superpowers/plans/2026-05-24-v0.1.5-roles-http-eng-review.md`
- Existing page: `src/pages/Roles/index.tsx`
- Existing backend: `server/src/modules/roles/roleRoutes.ts`

## Scope

### In Scope

1. `GET /api/roles` 返回前端角色表格需要的 projection。
2. `GET /api/roles/permission-tree` 返回当前 runtime 已注册 permission groups / points。
3. HTTP service 实现 `listRoles`、`createRole`、`updateRole`、`disableRoles`、`updateRoleAuthorization`、`listIamPermissionTree`。
4. `/roles` 在 HTTP mode 支持角色列表、创建、编辑、停用、授权保存。
5. 401、403、409、普通 API error 显示明确反馈和 requestId。
6. 补充 server、frontend service、page、E2E 或浏览器验证证据。

### Out of Scope

- 扩大 `/directory` 只读浏览边界。
- Sync runtime。
- Dashboard runtime summary。
- Application Detail / Onboarding HTTP runtime。
- 真实飞书 OAuth。
- 新增批量角色后端 API。
- 部署、tag、release。

## File Structure

### Modify

- `server/src/modules/roles/roleRoutes.ts`
  增强 list projection，新增 permission tree route。

- `server/tests/roles.test.ts`
  新增 role runtime contract 测试。

- `src/features/iam/types.ts`
  必要时扩展 `AuditAction` 包含 runtime role actions。

- `src/features/iam/dtoMappers.ts`
  新增 role 和 permission tree mapper。

- `src/features/iam/dtoMappers.test.ts`
  覆盖 role projection 和 permission tree mapping。

- `src/features/iam/httpApi.ts`
  实现 role HTTP methods。

- `src/features/iam/httpApi.test.ts`
  覆盖 role HTTP path、payload、applicationId 到 appKey 映射。

- `src/pages/Roles/index.tsx`
  增强 HTTP error feedback 和 requestId 展示。

- `src/pages/Roles/index.test.tsx`
  覆盖 HTTP error/requestId 和角色页面交互。

- `tests/e2e/v0.1.5-roles-http.spec.ts`
  覆盖 HTTP mode 角色管理主路径。

- `README.md`、`CHANGELOG.md`、`VERSION`、`package.json`、`package-lock.json`
  更新 v0.1.5 状态和验收说明。

## Tasks

### Task 1: Backend Roles Runtime Contract

**Files:**
- Create/modify: `server/tests/roles.test.ts`
- Modify: `server/src/modules/roles/roleRoutes.ts`

- [ ] **Step 1: Write failing server tests**

Add tests that:

- require platform admin for `/api/roles` and `/api/roles/permission-tree`;
- create an application;
- register permission groups and points through Application API;
- create a role;
- save authorization;
- list roles with `application_name`, counts, `permission_keys`, `department_ids`, `user_ids`;
- list permission tree with group nodes and child permission point nodes;
- update and disable a role;
- return requestId for duplicate role code.

- [ ] **Step 2: Run the failing server test**

Run:

```bash
npm run server:test -- server/tests/roles.test.ts
```

Expected: fails until projection and permission tree route are implemented.

- [ ] **Step 3: Implement backend projection and permission tree**

In `roleRoutes.ts`:

- return `application_id`, `application_name`, `app_key`;
- aggregate permission point codes into `permission_keys`;
- aggregate role department bindings into `department_ids`;
- aggregate role user bindings into `user_ids`;
- return `permission_group_count`, `permission_point_count`, `department_binding_count`, `user_binding_count`;
- add `GET /api/roles/permission-tree`;
- keep platform-admin authorization.

- [ ] **Step 4: Verify backend tests pass**

Run:

```bash
npm run server:test -- server/tests/roles.test.ts
```

Expected: all role contract tests pass.

### Task 2: Frontend HTTP Roles Service

**Files:**
- Modify: `src/features/iam/dtoMappers.ts`
- Modify: `src/features/iam/dtoMappers.test.ts`
- Modify: `src/features/iam/httpApi.ts`
- Modify: `src/features/iam/httpApi.test.ts`

- [ ] **Step 1: Write mapper and HTTP API tests**

Add tests for:

- `mapRuntimeRole`;
- `mapRuntimePermissionTree`;
- `listRoles({ applicationId })` sends `appKey`;
- `createRole` converts application id to `appKey`;
- `updateRole` omits immutable role code when patching;
- `disableRoles` patches status to `disabled`;
- `updateRoleAuthorization` sends `permissionPointCodes`, `departmentIds`, `feishuUserIds`.

- [ ] **Step 2: Run failing frontend service tests**

Run:

```bash
npm run test -- src/features/iam/dtoMappers.test.ts src/features/iam/httpApi.test.ts
```

Expected: fails until mappers and methods exist.

- [ ] **Step 3: Implement role HTTP methods**

In `httpApi.ts`:

- implement `listRoles`;
- implement `listIamPermissionTree`;
- implement `createRole`;
- implement `updateRole`;
- implement `disableRoles`;
- implement `updateRoleAuthorization`;
- map `applicationId` to `appKey` using `listApplications({ page: 1, pageSize: 100 })`.

- [ ] **Step 4: Verify frontend service tests pass**

Run:

```bash
npm run test -- src/features/iam/dtoMappers.test.ts src/features/iam/httpApi.test.ts
```

Expected: all targeted service tests pass.

### Task 3: Roles Page HTTP Error Feedback

**Files:**
- Modify: `src/pages/Roles/index.tsx`
- Modify: `src/pages/Roles/index.test.tsx`

- [ ] **Step 1: Add page tests for HTTP error states**

Cover:

- list role error shows requestId;
- create role duplicate error keeps Drawer open and shows message;
- save authorization error shows requestId.

- [ ] **Step 2: Run failing page tests**

Run:

```bash
npm run test -- src/pages/Roles/index.test.tsx
```

Expected: fails until requestId feedback is implemented.

- [ ] **Step 3: Implement page error feedback**

Add local helper to extract `IamHttpError` fields and show:

- `Alert` with requestId for list errors;
- `message.error` with requestId for mutations;
- preserve existing Drawer/Modal state on mutation failure.

- [ ] **Step 4: Verify page tests pass**

Run:

```bash
npm run test -- src/pages/Roles/index.test.tsx
```

Expected: targeted page tests pass.

### Task 4: HTTP Mode E2E And Docs

**Files:**
- Create: `tests/e2e/v0.1.5-roles-http.spec.ts`
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Modify: `VERSION`
- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] **Step 1: Add E2E main path**

Cover:

- local mock Feishu login;
- platform admin initialization;
- create application;
- navigate `/roles`;
- create role;
- save authorization;
- disable role;
- capture 1440/1280/768 screenshots under `design/implementation-screenshots/v0.1.5-roles-http/`.

- [ ] **Step 2: Update docs and version metadata**

Update README current status, v0.1.5 acceptance instructions, CHANGELOG, VERSION, package version and package-lock version.

- [ ] **Step 3: Run final verification**

Run:

```bash
npm run server:test -- server/tests/roles.test.ts
npm run test -- src/features/iam/dtoMappers.test.ts src/features/iam/httpApi.test.ts src/pages/Roles/index.test.tsx
npm run build
```

If local PostgreSQL is available, also run:

```bash
E2E_RESET_DATABASE=true \
DATABASE_URL=postgres://feishu_iam:<replace-me>@127.0.0.1:5432/feishu_iam \
VITE_IAM_API_MODE=http \
npm run e2e -- tests/e2e/v0.1.5-roles-http.spec.ts
```

Expected: targeted tests and build pass; E2E either passes or reports a concrete local environment blocker.
