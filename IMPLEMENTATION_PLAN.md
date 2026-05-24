# feishu-iam v0.1.11 Application Integration Runtime Implementation Plan

## Goal

交付 `v0.1.11` 应用接入配置闭环：把应用详情、接入配置、权限注册结果、Agent Prompt、secret copy audit 和接入检查从 mock 推进到 HTTP runtime，并重构 README 为公开项目入口文档。

## Source Inputs

- Office-hours design: `/Users/wenzhewang/.gstack/projects/wodenwang-feishu-iam/wenzhewang-main-design-20260524-235745.md`
- Project rules: `AGENTS.md`, `CLAUDE.md`, `DESIGN.md`
- Product spec: `docs/v0.1-product-spec.md`
- Existing implementation: `server/src/modules/applications/applicationRoutes.ts`, `src/pages/Applications/Detail.tsx`, `src/pages/Applications/Onboarding.tsx`

## Scope

### In Scope

1. Runtime application detail endpoints:
   - `GET /api/applications/:id`
   - `GET /api/applications/:id/permission-registrations`
   - `POST /api/applications/:id/secret-copy-events`
2. Application scoped audit filtering through existing audit API.
3. Frontend HTTP service support:
   - `getApplication`
   - `listApplicationPermissionRegistrations`
   - `recordRuntimeSecretCopy`
4. Application detail and onboarding HTTP mode fixes:
   - runtime data mapping
   - no real secret display after create response
   - Agent Prompt uses placeholders
   - secret copy audit is recorded
5. README refactor:
   - concise project value
   - quick local start
   - quick Docker Compose deploy
   - third-party integration path
   - security boundaries
   - no `bpmt-120`, private paths, private ports, private nginx details, real IPs, or secrets
6. Version and release metadata:
   - `package.json`
   - `package-lock.json`
   - `VERSION`
   - `CHANGELOG.md`

### Out of Scope

- Third-party OAuth server / token endpoint / consent page.
- OIDC discovery.
- Sync runtime and Feishu tenant token lifecycle.
- Reopening `/directory` read-only browsing scope.
- Persisting or redisplaying real `appSecret` / `apiSecret` after one-time create response.
- New Pencil prototype.

## Engineering Decisions

1. Do not add a migration for callback URLs in this slice. The first runtime slice exposes integration templates and placeholders, plus Application API facts already stored by runtime.
2. Keep detail access platform-admin only for this slice. Application-admin scoped access remains a future security slice because the DB does not yet model application administrators.
3. `secret.copy` records the copy action and kind only. It never accepts or stores secret text.
4. Extend `GET /api/audit-logs` with `targetId` / `targetType` filters instead of adding duplicate audit endpoints.
5. Runtime permission registrations are read-only and derived from `permission_groups` + `permission_points`.

## File Tasks

### Backend

- `server/src/modules/applications/applicationRoutes.ts`
  - Add detail endpoint.
  - Add permission registration endpoint.
  - Add secret-copy audit endpoint.
  - Reuse platform-admin guard and avoid returning secret plaintext.
- `server/src/modules/audit/auditRoutes.ts`
  - Add `targetId` and `targetType` filters.
- `server/tests/applications.test.ts`
  - Cover detail, permission registrations, secret-copy audit, unauthenticated/forbidden cases, and no secret leaks.
- `server/tests/audit.test.ts`
  - Cover target filters.

### Frontend

- `src/features/iam/types.ts`
  - Add integration status fields if needed.
- `src/features/iam/dtoMappers.ts`
  - Map runtime detail fields and permission registration rows.
- `src/features/iam/httpApi.ts`
  - Implement runtime methods currently marked unsupported.
  - Pass `applicationId` audit filters to backend.
- `src/features/iam/httpApi.test.ts`
  - Cover new runtime calls and mapping.
- `src/pages/Applications/Detail.tsx`
  - Use runtime-safe values and clear error/empty states.
  - Do not expose dangerous secret actions in HTTP mode unless supported.
- `src/pages/Applications/Onboarding.tsx`
  - Generate placeholder-based Agent Prompt from runtime application data.
  - Record copy audit for runtime env and Agent Prompt.
  - Make connection checks reflect runtime facts.
- Existing page tests:
  - Keep mock-mode tests passing and add HTTP service-level coverage.

### Browser / E2E

- `tests/e2e/v0.1.11-application-integration-http.spec.ts`
  - Login through dev mock.
  - Initialize.
  - Create app.
  - Open application detail.
  - Verify integration config and permission registration empty state.
  - Run onboarding copy/check path.

### Docs / Release

- `README.md`
  - Rewrite as a concise public entry document.
- `CHANGELOG.md`
  - Add `v0.1.11`.
- `VERSION`, `package.json`, `package-lock.json`
  - Update to `0.1.11`.
- Deployment report under `design/implementation-screenshots/v0.1.11-application-integration/`.

## Verification Commands

```bash
npm run server:test
npm test
npm run build
npm run server:build
E2E_RESET_DATABASE=true TEST_DATABASE_URL=postgres://postgres:postgres@127.0.0.1:55433/feishu_iam_test VITE_IAM_API_MODE=http RUNTIME_API_BASE_URL=http://127.0.0.1:4100 npm run e2e -- tests/e2e/v0.1.11-application-integration-http.spec.ts
```

## Completion Criteria

- Runtime application detail and onboarding work in HTTP mode.
- Application detail and onboarding never show real secret plaintext after one-time create response.
- Permission registration table reflects Application API runtime data.
- Secret copy actions are audited without leaking secret values.
- README is concise and contains no private deployment details.
- Full test/build suite and targeted E2E pass.
- Browser evidence is saved.
- Version metadata, changelog, Git commit, remote push, release/deploy report, and cloud health check are complete.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|---|---|---:|---:|---|---|
| Office Hours | `/office-hours` | Scope & product boundary | 1 | clear | v0.1.11 selected as Application Integration Runtime; OAuth server and Sync deferred. |
| Eng Review | local harness review | Architecture & tests | 1 | clear | No migration for callback URLs; platform-admin only; secret copy audit does not store secret text. |
