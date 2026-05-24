# feishu-iam v0.1.8 Real Feishu Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use Superpowers `executing-plans` to implement this plan task-by-task. Track each checkbox as it is completed.

**Goal:** 交付真实飞书 Admin Console 登录闭环：`FEISHU_AUTH_MODE=real` 下可从 `/login` 跳转飞书授权、callback 创建 IAM session、首次绑定 platform admin，并完成测试、ship、land、deploy。

**Architecture:** 扩展现有 Fastify auth module。真实飞书调用封装在 `RealFeishuAuthAdapter`，route 层负责 OAuth state cookie、callback、session 创建和审计。前端 HTTP mode 登录按钮跳转后端 start endpoint。

**Source Inputs:**

- Office-hours design doc: `/Users/wenzhewang/.gstack/projects/wodenwang-feishu-iam/wenzhewang-main-design-20260524-163400.md`
- Engineering review: `docs/superpowers/plans/2026-05-24-v0.1.8-real-feishu-auth-eng-review.md`
- Product spec: `docs/v0.1-product-spec.md`
- Existing runtime: `server/src/modules/auth/authRoutes.ts`

## Scope

### In Scope

1. `GET /api/auth/feishu/start` real-mode OAuth start.
2. `GET /api/auth/feishu/callback` state validation, token exchange, user info, session creation.
3. `RealFeishuAuthAdapter` for Feishu OAuth v2 token endpoint and user info endpoint.
4. Short-lived HttpOnly state cookie.
5. Real login audit success/failure.
6. Frontend `/login` button wiring in HTTP mode.
7. Tests, docs, version metadata, release and deploy closure.

### Out of Scope

- Third-party application OAuth server.
- `feishu-iam-thirdpart-demo`.
- Full Feishu directory sync.
- refresh token persistence and rotation.
- `offline_access`.
- OIDC discovery.
- Username/password login.
- Committing real Feishu credentials or tokens.

## File Structure

### Create

- `server/src/modules/auth/realFeishuAuthAdapter.ts`
- `server/tests/auth.real-feishu.test.ts`
- `.gstack/deploy-reports/2026-05-24-v0.1.8-real-feishu-auth-deploy.md`

### Modify

- `server/src/modules/auth/feishuAuthAdapter.ts`
- `server/src/modules/auth/authRoutes.ts`
- `server/src/app.ts`
- `server/src/main.ts`
- `server/src/config/env.ts`
- `server/tests/helpers/testApp.ts`
- `server/tests/env.test.ts`
- `src/app/App.tsx`
- `src/pages/Login/index.tsx`
- `src/pages/Login/index.test.tsx`
- `.env.example`
- `README.md`
- `CHANGELOG.md`
- `VERSION`
- `package.json`
- `package-lock.json`

## Tasks

### Task 1: Auth Adapter Contract And Env

- [x] Extend `FeishuAuthAdapter` with real OAuth methods.
- [x] Add `RealFeishuAuthAdapter`.
- [x] Pass Feishu config from `main.ts` into `buildApp`.
- [x] Keep mock adapter available for local dev and tests.
- [x] Ensure real mode startup still requires App ID, App Secret, redirect URI.
- [x] Verify `npm run server:test -- server/tests/env.test.ts`.

### Task 2: Real OAuth Routes

- [x] Add tests for `/api/auth/feishu/start`.
- [x] Add tests for callback missing `code`, missing `state`, missing cookie, mismatch, and adapter failure.
- [x] Add tests for callback success: upsert user, directory projection, session cookie, state cookie clear, audit row.
- [x] Implement start route with `iam_oauth_state` cookie.
- [x] Implement callback route with one-time state validation.
- [x] Refactor common session creation/upsert logic so mock and real login share behavior.
- [x] Verify `npm run server:test -- server/tests/auth.real-feishu.test.ts server/tests/auth.mock-login.test.ts`.

### Task 3: Frontend Login Wiring

- [x] Add `startFeishuLogin()` helper in HTTP API or app layer.
- [x] Wire `/login` primary button to `/api/auth/feishu/start` in HTTP mode.
- [x] Keep dev mock login visible only in local development.
- [x] Add Login page/app tests for real login button.
- [x] Verify `npm test -- src/pages/Login/index.test.tsx`.

### Task 4: Docs And Version

- [x] Update `.env.example` with real-mode notes and `FEISHU_REDIRECT_URI`.
- [x] Update README v0.1.8 section with real Feishu login setup and secret boundary.
- [x] Update CHANGELOG.
- [x] Update VERSION, package.json, package-lock.json to `0.1.8`.
- [x] Run secret grep and confirm no real secret is present.

### Task 5: Verification

- [x] Run `npm run server:build`.
- [x] Run `npm run server:test`.
- [x] Run `npm test`.
- [x] Run `npm run build`.
- [x] Run `npm run e2e`.
- [x] Run browser/gstack browse or Playwright visual checks for `/login`, `/initialize`, and authenticated Admin Console path.
- [x] Run Docker build or compose config smoke if deploy files changed or deploy requires it.

### Task 6: Review, Ship, Land, Deploy

- [x] Run design-review or mark UI review not required if only login button behavior changed and existing UI is unchanged.
- [x] Run functional QA.
- [x] Run code review.
- [ ] Commit and push branch.
- [ ] Create PR.
- [ ] Merge PR.
- [ ] Tag and create GitHub Release `v0.1.8`.
- [ ] Deploy to `bpmt-120:/home/bpmt/feishu-iam`.
- [ ] Verify remote `/api/health`.
- [ ] Record deploy report without secrets.

## Expected Outputs

- `v0.1.8` release exists.
- Real Feishu Admin Console login routes exist and pass tests.
- Frontend login button reaches real start endpoint in HTTP mode.
- Remote deployment is updated and health check passes.
- No real Feishu App Secret, token, user export, or sync snapshot is committed.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|---|---|---:|---:|---|---|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | skipped | 当前切片已由 office-hours 收敛为小版本，不再扩大产品方向。 |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | pending | 落地前在 `/review` 阶段处理。 |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | clear | 真实飞书登录 adapter、state、session、测试策略已锁定。 |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | skipped | 本切片不新增页面结构，只接线既有登录按钮。 |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | skipped | 当前重点是运行时登录闭环。 |
