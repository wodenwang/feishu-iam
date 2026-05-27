# feishu-iam v0.2.0 Application Onboarding Productionization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 交付 `v0.2.0 应用接入生产化` 的第一个可运行闭环：redirect URI 管理、secret 轮换、多应用管理员维护、配置审计、应用详情页 UI、验收脚本和文档。

**Architecture:** 后端在现有 Fastify + PostgreSQL runtime 上扩展应用配置 API，继续使用飞书用户和 `application_admins` 作为权限边界来源。前端以已确认 Pencil 原型为蓝图改造 `/applications/:id`，通过 TanStack Query 调用 HTTP adapter，不在页面内硬编码业务数据。验收脚本走黑盒 HTTP API，验证 OAuth、Application API、secret 轮换、管理员保护和审计追溯。

**Tech Stack:** React, TypeScript, Vite, Ant Design, TanStack Query, Fastify, PostgreSQL, Vitest, Playwright.

---

## Scope

### In Scope

- OAuth redirect URI 新增、停用、恢复、列表和 authorize 激活状态校验。
- `appSecret` / `apiSecret` 轮换，旧 secret 立即失效，新 secret 只返回一次。
- 多应用管理员列表、新增、移除和最后管理员保护。
- 应用详情页概览、接入配置、应用管理员、审计记录 Tab 的 v0.2 UI。
- 配置变更审计动作和应用详情审计筛选。
- `scripts/verify-v0.2-application-onboarding.sh`。
- README 和接入文档更新。

### Out Of Scope

- `/directory` 编辑、导入、导出、删除或目录治理 UI。
- 飞书 webhook、event sync、incremental sync 或同步告警。
- OIDC discovery、JWKS、PKCE、refresh token、复杂 consent。
- SDK、CLI、Helm、Terraform、install/upgrade 产品化。
- 多租户 SaaS IdP。
- username/password、本地 root 或独立账号体系。
- push、PR、tag、GitHub Release、merge 或 deploy，除非用户明确授权。

## Source Inputs

- `AGENTS.md`
- `CLAUDE.md`
- `DESIGN.md`
- `design/pencil-input-v0.2.0.md`
- `design/feishu-iam-v0.2.0-application-onboarding.pen`
- `design/feishu-iam-v0.2.0-application-onboarding-prototype-review.md`
- `docs/superpowers/plans/2026-05-27-v0.2.0-application-onboarding-plan-design-review.md`
- `docs/superpowers/plans/2026-05-27-v0.2.0-application-onboarding-eng-review.md`

## File Map

- Create: `server/src/db/migrations/008_application_onboarding.sql`
  - Adds v0.2 fields to redirect URI and secret tables.
- Modify: `server/src/modules/applications/applicationRepository.ts`
  - Inserts default redirect URI with v0.2 metadata.
- Modify: `server/src/modules/applications/applicationRoutes.ts`
  - Adds redirect URI, secret rotation, admin management and detail projection APIs.
- Modify: `server/src/modules/oauth/oauthRoutes.ts`
  - Requires active redirect URI for authorize.
- Modify: `server/src/modules/applicationApi/applicationApiAuth.ts`
  - Uses rotated API secret hash through existing credential table.
- Modify: `server/tests/applications.test.ts`
  - Adds backend coverage for v0.2 application onboarding.
- Modify: `server/tests/oauth.test.ts`
  - Adds active/disabled redirect URI authorize coverage if existing OAuth tests are more suitable than `applications.test.ts`.
- Modify: `src/features/iam/types.ts`
  - Adds redirect URI/admin/secret result DTOs and audit actions.
- Modify: `src/features/iam/httpApi.ts`
  - Adds HTTP adapter calls.
- Modify: `src/features/iam/dtoMappers.ts`
  - Maps runtime DTOs into frontend types.
- Modify: `src/features/iam/mockApi.ts`
  - Keeps mock mode parity for UI tests.
- Modify: `src/features/iam/queries.ts`
  - Adds query keys and mutations.
- Modify: `src/pages/Applications/Detail.tsx`
  - Implements Pencil-backed v0.2 application detail UI.
- Modify or create tests under `src/pages/Applications/` and `src/features/iam/`.
- Create: `scripts/verify-v0.2-application-onboarding.sh`
- Modify: `README.md`
- Modify: `docs/integration/thirdparty-demo.md`
- Modify: `examples/thirdparty-demo/README.md`
- Create: `design/implementation-screenshots/v0.2.0-application-onboarding/`

## Task 1: Backend Schema And DTO Contract

**Files:**
- Create: `server/src/db/migrations/008_application_onboarding.sql`
- Modify: `server/src/modules/applications/applicationRepository.ts`
- Modify: `server/tests/applications.test.ts`

- [x] **Step 1: Write failing migration-backed tests for detail projection**

Add tests in `server/tests/applications.test.ts` that create an application and assert detail includes `redirect_uri_count`, `active_redirect_uri_count`, `admin_count`, and secret timestamps without plaintext.

Run: `npm run server:test -- server/tests/applications.test.ts`

Expected: fail because the fields do not exist.

- [x] **Step 2: Add migration**

Create `server/src/db/migrations/008_application_onboarding.sql`:

```sql
alter table application_oauth_redirect_uris
  add column if not exists status text not null default 'active',
  add column if not exists environment text not null default 'local',
  add column if not exists note text not null default '',
  add column if not exists created_by_feishu_user_id text references feishu_users(feishu_user_id),
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists disabled_at timestamptz,
  add constraint application_oauth_redirect_uris_status_check check (status in ('active', 'disabled')),
  add constraint application_oauth_redirect_uris_environment_check check (environment in ('production', 'staging', 'local'));

alter table application_secrets
  add column if not exists updated_at timestamptz not null default now();

alter table application_api_credentials
  add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_application_oauth_redirect_uris_app_status
  on application_oauth_redirect_uris(application_id, status);
```

- [x] **Step 3: Update default redirect URI insert**

Modify `createApplication()` so the default local URI insert includes `environment`, `status`, `note`, and `created_by_feishu_user_id`.

- [x] **Step 4: Extend application detail projection**

Modify `GET /api/applications/:id` SQL to return:

- `redirect_uri_count`
- `active_redirect_uri_count`
- `admin_count`
- `app_secret_rotated_at`
- `api_secret_rotated_at`

Keep `secret_status` as status metadata only.

- [x] **Step 5: Run targeted tests**

Run: `npm run server:test -- server/tests/applications.test.ts`

Expected: pass.

## Task 2: Redirect URI Runtime API

**Files:**
- Modify: `server/src/modules/applications/applicationRoutes.ts`
- Modify: `server/src/modules/oauth/oauthRoutes.ts`
- Modify: `server/tests/applications.test.ts`

- [x] **Step 1: Write failing tests**

Add tests for:

- platform admin can list/create redirect URI.
- duplicate URI returns `409 OAUTH_REDIRECT_URI_EXISTS`.
- application admin can list own URI but cannot create.
- disabled URI fails `/api/oauth/authorize`.
- restored URI can authorize again.

Run: `npm run server:test -- server/tests/applications.test.ts`

Expected: fail on missing routes and active status check.

- [x] **Step 2: Add validators**

Add local helpers in `applicationRoutes.ts`:

```ts
type RedirectUriEnvironment = 'production' | 'staging' | 'local';
type RedirectUriStatus = 'active' | 'disabled';

function assertPlatformAdmin(actor: typeof request.actor, message: string): void {
  if (!actor) throw unauthorized();
  if (!actor.isPlatformAdmin) throw forbidden(message);
}
```

Also add URL validation that allows `https:` for production/staging and `http://127.0.0.1` or `http://localhost` for local.

- [x] **Step 3: Implement routes**

Add:

- `GET /api/applications/:id/redirect-uris`
- `POST /api/applications/:id/redirect-uris`
- `PATCH /api/applications/:id/redirect-uris/status`

Use `writeAudit()` actions:

- `oauth.redirect_uri.create`
- `oauth.redirect_uri.disable`
- `oauth.redirect_uri.enable`

Never log secret or token data.

- [x] **Step 4: Enforce active URI in OAuth authorize**

Modify `findAuthorizedRedirect()` to add:

```sql
and r.status = 'active'
```

- [x] **Step 5: Run tests**

Run: `npm run server:test -- server/tests/applications.test.ts`

Expected: pass.

## Task 3: Secret Rotation Runtime API

**Files:**
- Modify: `server/src/modules/applications/applicationRoutes.ts`
- Modify: `server/tests/applications.test.ts`
- Modify: `server/tests/oauth.test.ts` if token exchange tests already cover client secret behavior.

- [x] **Step 1: Write failing tests**

Add tests for:

- `POST /api/applications/:id/secrets/rotate` returns new secret once.
- `app_secret` rotation makes old OAuth client secret fail and new one pass.
- `api_secret` rotation makes old Application API HMAC fail and new one pass.
- audit `secret.rotate` metadata does not contain plaintext or hash.
- application admin cannot rotate secret.

Run: `npm run server:test -- server/tests/applications.test.ts`

Expected: fail on missing route.

- [x] **Step 2: Implement route**

Add `POST /api/applications/:id/secrets/rotate` with body:

```ts
{ kind: 'app_secret' | 'api_secret' }
```

Generate values:

- app secret: `sec_${crypto.randomUUID().replaceAll('-', '')}`
- API secret: `api_sec_${crypto.randomUUID().replaceAll('-', '')}`

Hash with SHA-256 and update the relevant table plus `updated_at = now()`.

- [x] **Step 3: Add audit**

Write `secret.rotate` with metadata:

```ts
{ appKey: application.app_key, kind: body.kind }
```

- [x] **Step 4: Run tests**

Run: `npm run server:test -- server/tests/applications.test.ts`

Expected: pass and no plaintext in audit assertions.

## Task 4: Application Admin Runtime API

**Files:**
- Modify: `server/src/modules/applications/applicationRoutes.ts`
- Modify: `server/tests/applications.test.ts`

- [x] **Step 1: Write failing tests**

Add tests for:

- list admins includes derived `role` (`primary` or `application_admin`).
- platform admin can add an existing Feishu user.
- duplicate add is idempotent or returns conflict with stable code.
- platform admin can remove non-last admin.
- removing the last admin returns `409 LAST_APPLICATION_ADMIN`.
- application admin can list own admins but cannot mutate.
- cross-app application admin cannot read another app admins.

Run: `npm run server:test -- server/tests/applications.test.ts`

Expected: fail on missing routes.

- [x] **Step 2: Implement list route**

Add `GET /api/applications/:id/admins` using `requireAdminActor` and `requireApplicationScope`.

Return fields:

- `application_id`
- `feishu_user_id`
- `name`
- `email`
- `status`
- `role`
- `created_by_name`
- `created_at`

- [x] **Step 3: Implement add/remove routes**

Add platform-admin-only:

- `POST /api/applications/:id/admins`
- `DELETE /api/applications/:id/admins/:feishuUserId`

Write audit actions:

- `application.admin.add`
- `application.admin.remove`

- [x] **Step 4: Run tests**

Run: `npm run server:test -- server/tests/applications.test.ts`

Expected: pass.

## Task 5: Frontend Types, API Adapter And Query Hooks

**Files:**
- Modify: `src/features/iam/types.ts`
- Modify: `src/features/iam/httpApi.ts`
- Modify: `src/features/iam/dtoMappers.ts`
- Modify: `src/features/iam/mockApi.ts`
- Modify: `src/features/iam/queries.ts`
- Modify: `src/features/iam/httpApi.test.ts`
- Modify: `src/features/iam/dtoMappers.test.ts`
- Modify: `src/features/iam/mockApi.test.ts`

- [x] **Step 1: Write failing frontend unit tests**

Cover:

- HTTP adapter calls exact routes for redirect URI/admin/secret APIs.
- DTO mapper maps runtime admin and redirect URI rows.
- mock API records audit actions for v0.2 operations.

Run: `npm test -- src/features/iam/httpApi.test.ts src/features/iam/dtoMappers.test.ts src/features/iam/mockApi.test.ts`

Expected: fail on missing types/functions.

- [x] **Step 2: Add frontend types**

Add:

```ts
export type RedirectUriEnvironment = 'production' | 'staging' | 'local';
export type RedirectUriStatus = 'active' | 'disabled';
export type SecretKind = 'app_secret' | 'api_secret';

export interface ApplicationRedirectUri {
  applicationId: string;
  redirectUri: string;
  environment: RedirectUriEnvironment;
  status: RedirectUriStatus;
  note: string;
  createdByName: string;
  updatedAt: string;
  disabledAt?: string;
}

export interface ApplicationAdmin {
  applicationId: string;
  feishuUserId: string;
  name: string;
  email?: string;
  status: 'active' | 'disabled' | 'resigned';
  role: 'primary' | 'application_admin';
  createdByName: string;
  createdAt: string;
}

export interface RotateSecretResult {
  kind: SecretKind;
  secret: string;
  rotatedAt: string;
}
```

Extend `AuditAction` with v0.2 actions.

- [x] **Step 3: Add HTTP adapter and mappers**

Add functions:

- `listApplicationRedirectUris(applicationId)`
- `createApplicationRedirectUri(applicationId, input)`
- `updateApplicationRedirectUriStatus(applicationId, input)`
- `rotateApplicationSecret(applicationId, kind)`
- `listApplicationAdmins(applicationId)`
- `addApplicationAdmin(applicationId, input)`
- `removeApplicationAdmin(applicationId, feishuUserId)`

- [x] **Step 4: Add query hooks**

Add query keys and mutation invalidation for application detail, redirect URIs, admins and audit logs.

- [x] **Step 5: Run tests**

Run: `npm test -- src/features/iam/httpApi.test.ts src/features/iam/dtoMappers.test.ts src/features/iam/mockApi.test.ts`

Expected: pass.

## Task 6: Application Detail UI

**Files:**
- Modify: `src/pages/Applications/Detail.tsx`
- Modify or create: `src/pages/Applications/Detail.test.tsx`

- [x] **Step 1: Write failing UI tests**

Assert the page renders:

- `概览` with configuration completeness.
- `接入配置` with redirect URI table and `新增 redirect URI`.
- Add URI Drawer validation.
- secret rotate confirmation requires app code input.
- one-time secret result modal appears after mutation.
- `应用管理员` table with `新增应用管理员` and only `移除` row action.
- last admin protection error is visible.
- `审计记录` has action/result/keyword filters.

Run: `npm test -- src/pages/Applications/Detail.test.tsx`

Expected: fail on missing UI.

- [x] **Step 2: Implement detail page state and layout**

Use Ant Design `Tabs`, `Card`, `Descriptions`, `Table`, `Drawer`, `Form`, `Modal`, `Tag`, `Alert`, `Input`, `Select`.

Do not introduce another UI framework.

- [x] **Step 3: Implement redirect URI interactions**

Add Drawer form:

- `redirectUri`
- `environment`
- `note`

Add row actions:

- active -> `停用`
- disabled -> `恢复`

- [x] **Step 4: Implement secret rotation interactions**

Add Modal:

- requires entering `application.appKey`.
- calls rotate mutation.
- success opens one-time result Modal.
- result Modal has copy buttons and close confirmation text.

- [x] **Step 5: Implement admin interactions**

Add admins table and Add Drawer. Remove only; no edit action.

Handle `LAST_APPLICATION_ADMIN` as visible Modal or Alert matching Pencil state.

- [x] **Step 6: Implement audit filters**

Add action/result/keyword filters and query refetch.

- [x] **Step 7: Run UI tests**

Run: `npm test -- src/pages/Applications/Detail.test.tsx`

Expected: pass.

## Task 7: Verification Script And Docs

**Files:**
- Create: `scripts/verify-v0.2-application-onboarding.sh`
- Modify: `README.md`
- Modify: `docs/integration/thirdparty-demo.md`
- Modify: `examples/thirdparty-demo/README.md`

- [x] **Step 1: Write script skeleton**

Use existing script style from `scripts/verify-v0.1-access-loop.sh`. The script must fail fast, print safe step names, and never echo raw secret, token, cookie, code or signature.

- [x] **Step 2: Implement script checks**

The script must verify:

- mock Feishu login and platform admin bind.
- application creation.
- redirect URI create/list/disable/restore.
- OAuth authorize/token succeeds with active URI and fails with disabled URI.
- appSecret rotation old fails/new succeeds.
- apiSecret rotation old HMAC fails/new HMAC succeeds.
- admin add/remove and last-admin protection.
- audit actions are queryable.

- [x] **Step 3: Update docs**

README should add v0.2 verification entry:

```bash
bash scripts/verify-v0.2-application-onboarding.sh
```

Docs must reiterate external Feishu config remains manual and credentials stay local.

- [x] **Step 4: Run script against local runtime**

Start runtime:

```bash
DATABASE_URL=postgres://postgres:postgres@127.0.0.1:55432/feishu_iam_v020 \
SESSION_SECRET=local-session-secret-at-least-32-bytes \
FEISHU_AUTH_MODE=mock \
npm run server:dev
```

Run:

```bash
bash scripts/verify-v0.2-application-onboarding.sh
```

Expected: all steps pass with masked output only.

## Task 8: Full Verification, Visual QA, Reviews

**Files:**
- Create: `design/implementation-screenshots/v0.2.0-application-onboarding/v0.2.0-qa-report.md`
- Create: `design/implementation-screenshots/v0.2.0-application-onboarding/v0.2.0-review-report.md`
- Create screenshots in `design/implementation-screenshots/v0.2.0-application-onboarding/`

- [x] **Step 1: Run full automated checks**

Run:

```bash
npm run server:test
npm test
npm run build
npm run server:build
git diff --check
```

Expected: all pass.

- [x] **Step 2: Run Playwright visual checks**

Use Playwright at 1440, 1280 and 768 widths. Capture:

- overview first screen.
- integration config.
- add redirect URI Drawer.
- secret rotate Modal.
- one-time result Modal.
- admins tab and last admin protection.
- audit filters.

- [x] **Step 3: Run gstack loops**

Run these review gates. If any issue appears, fix it and rerun the same gate until clean:

- `gstack /design-review`
- `gstack /qa`
- `gstack /review`

- [x] **Step 4: Record evidence**

Write QA and review reports with:

- commands run.
- screenshots paths.
- issues found.
- fixes applied.
- rerun counts.
- remaining risk.

## Task 9: Ship And Land/Deploy Authorization Boundary

**Files:**
- Modify version/release files only if the user authorizes release work.

- [x] **Step 1: Run final status**

Run:

```bash
git status --short
git diff --stat
```

- [ ] **Step 2: Use `gstack /ship`**

Prepare commit boundary, release notes and remote action plan. Do not push, tag, release, merge or deploy without explicit authorization at that point.

- [ ] **Step 3: Use `gstack /land-and-deploy` after authorization**

If authorized, complete merge/release/tag/deploy and health verification according to project deployment rules. If authorization is missing, stop with a handoff summary.

## Verification Commands

```bash
npm run server:test
npm test
npm run build
npm run server:build
bash scripts/verify-v0.2-application-onboarding.sh
git diff --check
```

## Completion Criteria

- Pencil prototype review is clean and `.pen` source is readable by Pencil.
- `IMPLEMENTATION_PLAN.md` reflects v0.2.0 and no longer points at v0.1.17.
- Backend APIs pass tests for redirect URI, secret rotation, app admins, permissions and audit.
- OAuth authorize rejects disabled redirect URI.
- Old appSecret/apiSecret fail immediately after rotation; new values pass.
- Frontend application detail matches the confirmed Ant Design Pencil structure.
- Verification script passes without leaking secrets.
- Design review, QA and review loops are clean after fixes and reruns.
- Final land/deploy actions only occur after explicit authorization.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|---|---|---:|---:|---|---|
| Plan Design Review on Prototype | `/plan-design-review` | v0.2 Pencil 原型进入工程评审 | 2 | clean | 0 个未关闭设计问题。 |
| Plan Eng Review | `/plan-eng-review` | 锁定数据模型、权限、API 和测试策略 | 1 | clean | 0 个阻塞问题；写操作限定平台管理员。 |
| Writing Plans | `Superpowers writing-plans` | 生成可执行实施计划 | 1 | ready | 可进入 `superpowers:executing-plans`。 |
