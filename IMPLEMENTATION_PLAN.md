# feishu-iam v0.1.14 Application Admin Runtime Implementation Plan

## Goal

交付 `v0.1.14` Application Admin Runtime：平台管理员创建应用时绑定一个飞书用户作为应用管理员；该用户登录后只能访问和管理自己负责的应用、角色授权、权限注册和应用审计。

## Source Inputs

- Office-hours design: `/Users/wenzhewang/.gstack/projects/wodenwang-feishu-iam/wenzhewang-main-design-20260526-190652.md`
- Eng review: `docs/superpowers/plans/2026-05-26-v0.1.14-application-admin-runtime-eng-review.md`
- Project rules: `AGENTS.md`, `CLAUDE.md`
- Current runtime:
  - `server/src/modules/auth/authRoutes.ts`
  - `server/src/modules/applications/applicationRoutes.ts`
  - `server/src/modules/roles/roleRoutes.ts`
  - `server/src/modules/audit/auditRoutes.ts`
  - `src/features/iam/permissions.ts`
  - `src/pages/Applications/List.tsx`
  - `src/pages/Roles/index.tsx`

## Scope

### In Scope

1. Application admin persistence:
   - `application_admins`
   - `application_id`
   - `feishu_user_id`
   - `created_by_feishu_user_id`
2. Application create binding:
   - optional `ownerFeishuUserId`
   - validate owner user exists
   - bind owner to application
   - audit `application.admin.bind`
3. Session projection:
   - application admin role
   - scoped permission codes
   - scoped application IDs
4. Backend scope enforcement:
   - applications list/detail/permission registrations/secret-copy audit
   - roles list/create/update/authorization/permission tree
   - audit logs limited to owned application target
5. Frontend HTTP integration:
   - send `ownerFeishuUserId` on create
   - map owner fields
   - preserve scoped UI behavior
6. Docs and release metadata:
   - `README.md`
   - `CHANGELOG.md`
   - `VERSION`
   - `package.json`
   - reports under `design/implementation-screenshots/v0.1.14-application-admin-runtime/`

### Out of Scope

- 重开 `v0.1.13` OAuth 小收口。
- redirect URI 管理 UI。
- OIDC discovery、JWKS、PKCE、refresh token、复杂 consent 页面。
- Sync runtime、tenant token、通讯录全量同步。
- `/directory` 能力扩展。
- 创建后应用管理员维护 UI、多人管理员、邀请审批。
- username/password 登录。

## Engineering Decisions

1. `application_admins` 表表达应用管理员绑定，`applications.created_by_feishu_user_id` 保持创建人语义。
2. 创建应用时只支持一个主要应用管理员，后续多人维护 UI 独立切片处理。
3. `ownerFeishuUserId` 必须已存在于 `feishu_users`，避免孤儿绑定。
4. 后端统一做 application scope 校验，前端过滤只作为 UX。
5. 应用管理员可管理自己应用下角色授权，但不能创建/停用应用、触发同步或读取全局审计。

## File Tasks

### Backend

- `server/src/db/migrations/005_application_admins.sql`
  - Add application admin binding table and indexes.
- `server/src/modules/adminScope.ts`
  - Add shared scope helpers for platform admin and application admin.
- `server/src/plugins/requestContext.ts`
  - Resolve actor application admin IDs.
- `server/src/modules/auth/authRoutes.ts`
  - Project application admin session roles, permissions and application IDs.
- `server/src/modules/applications/applicationRoutes.ts`
  - Accept `ownerFeishuUserId`, bind owner and enforce scoped reads.
- `server/src/modules/roles/roleRoutes.ts`
  - Enforce scoped role list/create/update/authorization and permission tree.
- `server/src/modules/audit/auditRoutes.ts`
  - Allow application admins to read only owned application target logs.
- `server/tests/helpers/testDb.ts`
  - Reset application admin table.
- `server/tests/migrations.test.ts`
  - Expect migration `005_application_admins`.

### Tests

- `server/tests/applications.test.ts`
  - Bind application admin on create.
  - Reject missing owner user.
  - Scoped application list/detail/permission registration/secret copy.
- `server/tests/requestContext.test.ts`
  - Application admin session projection.
- `server/tests/roles.test.ts`
  - Application admin role management in owned app and cross-app denial.
- `server/tests/audit.test.ts`
  - Scoped application audit allowed, global/other app audit denied.

### Frontend

- `src/features/iam/httpApi.ts`
  - Send `ownerFeishuUserId` in HTTP create application.
- `src/features/iam/dtoMappers.ts`
  - Continue mapping owner fields from runtime application.
- `src/pages/Applications/List.tsx`
  - Keep owner field active for HTTP mode create.
- `src/pages/Applications/Detail.tsx`
  - Display real owner fields from runtime.
- `src/pages/Roles/index.tsx`
  - Preserve scoped role UX for application admins.

### Docs / Release

- `README.md`
- `CHANGELOG.md`
- `VERSION`
- `package.json`
- `package-lock.json`
- `design/implementation-screenshots/v0.1.14-application-admin-runtime/*`

## First Vertical Slice

Implement this single end-to-end slice:

1. Platform admin creates an application with `ownerFeishuUserId`.
2. Backend validates owner user and inserts `application_admins`.
3. Owner logs in and receives `application_admin` session with scoped application IDs.
4. Owner can see/read only the owned application.
5. Owner can create/update/authorize roles only inside the owned application.
6. Owner can read only owned application audit logs.

This covers the whole v0.1.14 scope because the version is intentionally narrow.

## Verification Commands

```bash
TEST_DATABASE_URL=postgres://postgres:postgres@127.0.0.1:55432/feishu_iam_test npm run server:test -- server/tests/applicationAdmin.test.ts server/tests/applications.test.ts server/tests/roles.test.ts server/tests/audit.test.ts server/tests/requestContext.test.ts server/tests/migrations.test.ts
npm run server:test
npm run server:build
npm run build
npm test
git diff --check
```

Browser / runtime verification:

```bash
VITE_IAM_API_MODE=http npm run dev -- --host 127.0.0.1
DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/feishu_iam SESSION_SECRET=local-session-secret-at-least-32-bytes FEISHU_AUTH_MODE=mock npm run server:dev
```

Check:

- platform admin creates app with owner Feishu User ID
- owner logs in as application admin
- owner sees scoped application list/detail/onboarding/roles/audit
- owner cannot access other application/global audit/sync

## Completion Criteria

- Application admin binding is stored and audited.
- Application admin session projection returns scoped role, permissions and application IDs.
- Application admin can access and manage only owned application data.
- Cross-application and global audit access is denied.
- Tests and builds pass.
- QA/design-review/review reports are saved under `design/implementation-screenshots/v0.1.14-application-admin-runtime/`.
- PR is merged, tag `v0.1.14` and GitHub Release exist.
- Remote Docker Compose runtime deploys `FEISHU_IAM_IMAGE_TAG=v0.1.14` and `/api/health` returns `{"ok":true}`.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|---|---|---:|---:|---|---|
| Office Hours | `/office-hours` | Scope & product boundary | 1 | clear | v0.1.14 selected as Application Admin Runtime; OAuth, Sync and redirect URI UI deferred. |
| Eng Review | local `/plan-eng-review` equivalent | Session projection, application scope, role scope and audit scope | 1 | clear-with-limits | Use create-time primary application admin only; no maintenance UI. |
| Writing Plans | Superpowers `writing-plans` equivalent | Implementation path and tests | 1 | ready | First vertical slice is end-to-end application admin runtime. |
