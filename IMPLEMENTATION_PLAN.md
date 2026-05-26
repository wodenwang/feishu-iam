# feishu-iam v0.1.12 Third-party OAuth Demo Runtime Implementation Plan

## Goal

交付 `v0.1.12` 第三方 OAuth Demo Runtime：让 `examples/thirdparty-demo` 从 mock IAM session 推进到最小 OAuth Authorization Code 登录、token exchange、Application API 权限查询和页面权限生效闭环。

## Source Inputs

- Office-hours design: `/Users/wenzhewang/.gstack/projects/wodenwang-feishu-iam/wenzhewang-main-design-20260526-001251.md`
- Project rules: `AGENTS.md`, `CLAUDE.md`
- Product spec: `docs/v0.1-product-spec.md`
- Existing implementation:
  - `server/src/modules/auth/authRoutes.ts`
  - `server/src/modules/applicationApi/applicationApiRoutes.ts`
  - `server/src/modules/applications/applicationRoutes.ts`
  - `examples/thirdparty-demo/src/server.js`
  - `scripts/verify-v0.1.2-access-loop.sh`

## Scope

### In Scope

1. OAuth runtime endpoints:
   - `GET /api/oauth/authorize`
   - `POST /api/oauth/token`
2. OAuth persistence:
   - application redirect URI table
   - authorization code table
   - third-party bearer session table
3. Application API permission query support for third-party OAuth bearer token.
4. Third-party demo OAuth mode:
   - `/login`
   - `/oauth/callback`
   - `/customers`
   - mock fallback retained for local permission-query debugging
5. Tests:
   - authorization code issue and one-time exchange
   - invalid redirect URI
   - invalid client secret
   - bearer token scoped to one application
   - permission query with OAuth bearer token and Application API HMAC
6. Docs and release metadata:
   - `README.md`
   - `CHANGELOG.md`
   - `VERSION`
   - `package.json`
   - `package-lock.json`
   - `examples/thirdparty-demo/README.md`
   - `examples/thirdparty-demo/.env.example`
   - `docs/integration/thirdparty-demo.md`

### Out of Scope

- Full OIDC discovery.
- JWKS.
- refresh token.
- complex consent page.
- Sync runtime / tenant token / full Feishu directory sync.
- Reopening `/directory` beyond existing read-only projection.
- Persisting real Feishu tokens.
- Adding username/password login.

## Engineering Decisions

1. Use `appSecret` for OAuth token exchange and keep `apiSecret` for Application API HMAC.
2. Store authorization codes and bearer sessions only as SHA-256 hashes.
3. Authorization codes expire after 5 minutes and are consumed once.
4. Third-party bearer tokens resolve `request.actor` only for the owning application.
5. `GET /api/application/me/permissions` rejects a bearer token if it is used with a different app's HMAC credential.
6. First slice inserts a local demo redirect URI for created applications: `http://127.0.0.1:4200/oauth/callback`.

## File Tasks

### Backend

- `server/src/db/migrations/003_thirdparty_oauth.sql`
  - Add OAuth redirect URI, authorization code and bearer session tables.
- `server/src/modules/oauth/oauthRoutes.ts`
  - Add authorize and token endpoints.
- `server/src/app.ts`
  - Register OAuth routes.
- `server/src/plugins/requestContext.ts`
  - Resolve bearer token actor when no IAM session cookie exists.
- `server/src/modules/applicationApi/applicationApiRoutes.ts`
  - Enforce OAuth bearer token app scope during permission query.
- `server/src/modules/applications/applicationRepository.ts`
  - Insert default local demo redirect URI for new applications.

### Demo

- `examples/thirdparty-demo/src/server.js`
  - Add OAuth mode login and callback.
  - Store demo access token in HttpOnly cookie.
  - Query permissions using bearer token + Application API HMAC.
  - Retain mock fallback for local debugging only.
- `examples/thirdparty-demo/.env.example`
- `examples/thirdparty-demo/README.md`

### Tests

- `server/tests/oauth.test.ts`
  - Cover happy path, permission query, invalid redirect, invalid secret and cross-app token rejection.
- `server/tests/helpers/testDb.ts`
  - Reset OAuth tables.

### Docs / Release

- `docs/integration/thirdparty-demo.md`
- `README.md`
- `CHANGELOG.md`
- `VERSION`
- `package.json`
- `package-lock.json`

## Verification Commands

```bash
node --check examples/thirdparty-demo/src/server.js
npm run server:build
npm test -- --run src/router/routes.test.tsx
TEST_DATABASE_URL=postgres://postgres:postgres@127.0.0.1:55432/feishu_iam_test npm run server:test -- server/tests/oauth.test.ts
```

## Completion Criteria

- OAuth endpoints compile and are registered.
- Demo OAuth mode compiles and documents required environment variables.
- OAuth authorization code and bearer session data are not stored in plaintext.
- Third-party bearer token cannot be used across applications.
- Version metadata and changelog are aligned to `0.1.12`.
- Database integration tests pass when PostgreSQL is available.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|---|---|---:|---:|---|---|
| Office Hours | `/office-hours` | Scope & product boundary | 1 | clear | v0.1.12 selected as Third-party OAuth Demo Runtime; Sync runtime and OIDC deferred. |
| Eng Review | `/plan-eng-review` equivalent local review | Architecture, data flow, security boundary, tests | 1 | clear-with-limits | Minimal OAuth Demo Runtime approved; pending authorize resume, redirect URI management UI, OIDC, refresh token and Sync runtime remain out of scope. |
