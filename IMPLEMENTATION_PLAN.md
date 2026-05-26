# feishu-iam v0.1.15 Feishu Directory Sync Runtime Implementation Plan

## Goal

交付 `v0.1.15` Feishu Directory Sync Runtime：平台管理员可以在 Admin Console 触发飞书通讯录 full sync，后端通过专用自建飞书应用读取部门和用户，幂等写入本地目录投影，并在 `/sync` 页面查看同步记录、结果和失败原因。

## Source Inputs

- Office-hours scope: 当前会话已确认 `v0.1.15 - Feishu Directory Sync Runtime`
- Eng review: `docs/superpowers/plans/2026-05-26-v0.1.15-feishu-directory-sync-runtime-eng-review.md`
- Project rules: `AGENTS.md`, `CLAUDE.md`
- Existing frontend:
  - `src/pages/Sync/index.tsx`
  - `src/pages/Directory/index.tsx`
  - `src/features/iam/httpApi.ts`
  - `src/features/iam/dtoMappers.ts`
- Existing backend:
  - `server/src/modules/directory/directoryRoutes.ts`
  - `server/src/modules/auth/realFeishuAuthAdapter.ts`
  - `server/src/config/env.ts`
  - `server/src/modules/audit/auditRepository.ts`

## Scope

### In Scope

1. Sync persistence:
   - `sync_runs`
   - trigger/status/operator/requestId
   - diff summary
   - error message
2. Directory sync adapter:
   - `DirectorySyncAdapter` interface
   - `RealFeishuDirectorySyncAdapter`
   - test fake adapter injection
3. Backend sync routes:
   - `GET /api/sync/runs`
   - `POST /api/sync/runs`
   - `POST /api/sync/runs/:id/retry`
4. Sync service:
   - full sync
   - idempotent department/user upsert
   - minimal resigned marking
   - success/failure audit
5. Frontend HTTP integration:
   - `listSyncRuns`
   - `startManualSync`
   - `retrySyncRun`
   - runtime DTO mapping
6. Docs and release metadata:
   - `README.md`
   - `CHANGELOG.md`
   - `VERSION`
   - `package.json`
   - reports under `design/implementation-screenshots/v0.1.15-feishu-directory-sync-runtime/`

### Out of Scope

- 增量同步、定时任务、事件订阅。
- 全字段通讯录同步和复杂删除策略。
- `/directory` 编辑能力。
- 应用管理员触发同步。
- OAuth/OIDC/redirect URI/secret rotation。
- username/password 登录。

## Engineering Decisions

1. 真实飞书 API 只在 adapter 内部调用，业务代码只消费标准化 snapshot。
2. `tenant_access_token` 只在内存里使用，不写数据库、审计或日志。
3. 同步 run 使用 `running -> succeeded/failed` 状态，失败保留错误摘要。
4. 运行中已有 sync run 时拒绝再次触发，避免并发写投影。
5. 本版只做 full sync，后续增量和事件订阅独立切片处理。

## File Tasks

### Backend

- `server/src/db/migrations/006_sync_runs.sql`
  - Add `sync_runs` table and indexes.
- `server/src/modules/sync/directorySyncAdapter.ts`
  - Define snapshot types and real Feishu adapter.
- `server/src/modules/sync/syncService.ts`
  - Implement full sync, diff, upsert, audit and failure handling.
- `server/src/modules/sync/syncRoutes.ts`
  - Add list/start/retry HTTP routes.
- `server/src/app.ts`
  - Register sync routes and accept adapter injection.
- `server/src/main.ts`
  - Wire real adapter in production/runtime.
- `server/tests/helpers/testDb.ts`
  - Reset `sync_runs`.
- `server/tests/migrations.test.ts`
  - Expect migration `006_sync_runs`.
- `server/tests/sync.test.ts`
  - Cover success, idempotency, resigned, permission denial and failure audit.

### Frontend

- `src/features/iam/types.ts`
  - Keep existing `SyncRun` type; extend only if runtime requires it.
- `src/features/iam/dtoMappers.ts`
  - Add runtime sync run mapper.
- `src/features/iam/httpApi.ts`
  - Implement sync HTTP methods.
- `src/pages/Sync/index.tsx`
  - Preserve existing UI; rely on HTTP service methods.
- `src/pages/Sync/index.test.tsx`
  - Ensure HTTP mode can render runtime sync data if needed.

### Docs / Release

- `README.md`
- `CHANGELOG.md`
- `VERSION`
- `package.json`
- `package-lock.json`
- `design/implementation-screenshots/v0.1.15-feishu-directory-sync-runtime/*`

## First Vertical Slice

This version intentionally has one vertical slice:

1. Platform admin opens `/sync`.
2. Platform admin clicks manual sync.
3. Backend creates a `sync_runs` row.
4. Backend calls the directory sync adapter.
5. Backend upserts departments and users into local projection.
6. Backend marks the run succeeded or failed and writes audit.
7. Frontend refreshes `/sync` and `/directory` can read synced projection.

## Verification Commands

```bash
TEST_DATABASE_URL=postgres://postgres:postgres@127.0.0.1:55432/feishu_iam_test npm run server:test -- server/tests/sync.test.ts server/tests/migrations.test.ts
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

- platform admin can open `/sync`
- manual sync button creates a runtime run
- sync history shows succeeded/failed status
- directory page shows synced departments/users
- application admin cannot see or trigger sync

## Completion Criteria

- Sync runtime persistence and routes exist.
- Platform admin can trigger full sync and inspect history.
- Directory projection updates from sync snapshot.
- Failures are visible in sync history and audit.
- Tests and builds pass.
- Browser verification covers `/sync` and `/directory`.
- QA/design-review/review reports are saved under `design/implementation-screenshots/v0.1.15-feishu-directory-sync-runtime/`.
- PR is merged or main is updated, tag `v0.1.15` and GitHub Release exist.
- Remote Docker Compose runtime deploys `FEISHU_IAM_IMAGE_TAG=v0.1.15` and `/api/health` returns `{"ok":true}`.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|---|---|---:|---:|---|---|
| Office Hours | `/office-hours` | Scope & product boundary | 1 | clear | v0.1.15 selected as Feishu Directory Sync Runtime; v0.2.0, OAuth, OIDC and admin maintenance UI deferred. |
| Eng Review | local `/plan-eng-review` equivalent | Feishu API, sync idempotency, permissions and audit | 1 | clear-with-limits | Use manual full sync only; no scheduler, incremental sync or event subscription. |
| Writing Plans | Superpowers `writing-plans` equivalent | Implementation path and tests | 1 | ready | First vertical slice covers end-to-end manual directory sync runtime. |
