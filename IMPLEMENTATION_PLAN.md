# feishu-iam v0.1.13 OAuth 小收口 Implementation Plan

## Goal

交付 `v0.1.13` OAuth 小收口：修复第三方 Demo 从未登录浏览器发起 IAM OAuth 时的断链体验，补齐过期 OAuth 数据清理和关键审计。

## Source Inputs

- Office-hours design: `/Users/wenzhewang/.gstack/projects/wodenwang-feishu-iam/wenzhewang-main-design-20260526-180927.md`
- Eng review: `docs/superpowers/plans/2026-05-26-v0.1.13-oauth-small-closure-eng-review.md`
- Project rules: `AGENTS.md`, `CLAUDE.md`
- Current OAuth runtime:
  - `server/src/modules/oauth/oauthRoutes.ts`
  - `server/src/modules/auth/authRoutes.ts`
  - `server/src/plugins/requestContext.ts`
  - `server/src/db/migrations/003_thirdparty_oauth.sql`
  - `server/tests/oauth.test.ts`

## Scope

### In Scope

1. Pending OAuth request persistence:
   - `application_oauth_pending_requests`
   - hashed pending token
   - `client_id`, `redirect_uri`, `state`, `expires_at`, `consumed_at`, `failure_reason`
2. Pending request creation:
   - unauthenticated `GET /api/oauth/authorize`
   - HttpOnly `iam_oauth_pending` cookie
   - `oauth.pending.create` audit
3. Pending request resume:
   - real Feishu callback after successful login
   - mock dev login response can return `redirectTo`
   - initialized IAM resumes to third-party callback
   - uninitialized IAM still redirects to `/initialize`
4. Cleanup:
   - expired authorization codes
   - expired OAuth bearer sessions
   - expired pending OAuth requests
   - `oauth.cleanup` audit only when rows are removed
5. Tests:
   - pending create and resume
   - initialization priority
   - expired pending failure
   - cleanup idempotency
   - migration coverage
6. Docs and release metadata:
   - `README.md`
   - `CHANGELOG.md`
   - `package.json`
   - `docs/integration/thirdparty-demo.md`
   - reports under `design/implementation-screenshots/v0.1.13-oauth-small-closure/`

### Out of Scope

- redirect URI 管理 UI。
- OIDC discovery、JWKS、PKCE、refresh token、复杂 consent 页面。
- Sync runtime、tenant token、通讯录全量同步。
- `/directory` 能力扩展。
- username/password 登录。
- 后台 cron/worker 调度器。

## Engineering Decisions

1. Pending request 使用服务端表 + HttpOnly cookie。
2. 未初始化 IAM 时，登录成功后必须进入 `/initialize`，不恢复 pending OAuth。
3. 平台已初始化时，pending OAuth 优先于 Admin Console redirect；普通飞书用户可以恢复第三方 OAuth。
4. cleanup 作为 OAuth module service，OAuth route opportunistic 调用；只有清理到数据才写审计。
5. Pending token、authorization code、bearer token 都只存 hash。

## File Tasks

### Backend

- `server/src/db/migrations/004_oauth_pending_requests.sql`
  - Add pending request table and expiry index.
- `server/src/modules/oauth/oauthRoutes.ts`
  - Create pending request on unauthenticated authorize.
  - Export resume and cleanup helpers for auth flow.
  - Refactor authorization code issuing into reusable helper.
- `server/src/modules/auth/authRoutes.ts`
  - After login session creation, restore pending OAuth when safe.
  - Keep `/initialize` priority before pending restore.
  - Return `redirectTo` from mock login when pending restore succeeds.
- `server/tests/helpers/testDb.ts`
  - Reset pending OAuth table.
- `server/tests/migrations.test.ts`
  - Expect migration `004_oauth_pending_requests`.
  - Assert pending expiry index exists.

### Tests

- `server/tests/oauth.test.ts`
  - Pending creation on unauthenticated authorize.
  - Pending resume through real callback after initialization.
  - Expired pending request failure and audit.
  - Cleanup expired OAuth artifacts.
- `server/tests/auth.real-feishu.test.ts`
  - Callback still goes to `/initialize` before platform bootstrap.

### Frontend / Demo

- `src/app/App.tsx`
  - Respect mock login `redirectTo` for local pending OAuth testing.
- `src/features/iam/httpApi.ts`
  - Type mock login response.
- `examples/thirdparty-demo/README.md`
- `docs/integration/thirdparty-demo.md`

### Docs / Release

- `README.md`
- `CHANGELOG.md`
- `package.json`
- `package-lock.json` if present.
- `design/implementation-screenshots/v0.1.13-oauth-small-closure/*`

## First Vertical Slice

Implement only this first end-to-end slice before broadening:

1. Unauthenticated browser hits `/api/oauth/authorize`.
2. IAM creates pending request and redirects to login.
3. Existing initialized platform user completes real Feishu callback.
4. IAM resumes authorize and redirects to demo callback with `code` and original `state`.
5. Existing token exchange path still succeeds.

Cleanup and docs are included because they are explicitly in this small version boundary.

## Verification Commands

```bash
node --check examples/thirdparty-demo/src/server.js
TEST_DATABASE_URL=postgres://postgres:postgres@127.0.0.1:55432/feishu_iam_test npm run server:test -- server/tests/oauth.test.ts server/tests/auth.real-feishu.test.ts server/tests/migrations.test.ts
npm run server:test
npm run server:build
npm run build
npm test
git diff --check
```

Browser / runtime verification:

```bash
TEST_DATABASE_URL=postgres://postgres:postgres@127.0.0.1:55433/feishu_iam_test VITE_IAM_API_MODE=http RUNTIME_API_BASE_URL=http://127.0.0.1:4100 npm run e2e -- tests/e2e/v0.1.11-application-integration-http.spec.ts
```

## Completion Criteria

- Pending OAuth request is restored after login when IAM is initialized.
- IAM initialization is not bypassed.
- Expired OAuth artifacts are cleaned safely.
- Tests and builds pass.
- QA/design-review/review reports are saved under `design/implementation-screenshots/v0.1.13-oauth-small-closure/`.
- PR is merged, tag `v0.1.13` and GitHub Release exist.
- Remote Docker Compose runtime deploys `FEISHU_IAM_IMAGE_TAG=v0.1.13` and `/api/health` returns `{"ok":true}`.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|---|---|---:|---:|---|---|
| Office Hours | `/office-hours` | Scope & product boundary | 1 | clear | v0.1.13 selected as OAuth small closure; redirect URI UI, app-admin and Sync runtime deferred. |
| Eng Review | `/plan-eng-review` equivalent local review | Authentication redirect, pending request, cleanup and audit strategy | 1 | clear-with-limits | Approved service-side pending request with initialization priority and opportunistic cleanup. |
