# feishu-iam v0.1.16 Sync Operations Runtime Implementation Plan

## Goal

交付 `v0.1.16` 同步运营 Runtime 的 vertical slices：

1. 平台管理员可以读取飞书同步健康状态，并执行不会改写目录投影的飞书通讯录权限预检。
2. 系统可以按环境变量配置执行 scheduled full sync，并使用明确的 system actor，不伪造飞书用户。

该计划仍不实现 release metadata 或增量/事件同步 Runtime。

## Source Inputs

- Office-hours scope: `/Users/wenzhewang/.gstack/projects/wodenwang-feishu-iam/wenzhewang-main-design-20260526-232014.md`
- Eng review: `docs/superpowers/plans/2026-05-26-v0.1.16-sync-ops-runtime-eng-review.md`
- Project rules: `AGENTS.md`, `CLAUDE.md`
- Existing sync backend:
  - `server/src/modules/sync/directorySyncAdapter.ts`
  - `server/src/modules/sync/syncService.ts`
  - `server/src/modules/sync/syncRoutes.ts`
  - `server/tests/sync.test.ts`
- Existing audit and auth boundaries:
  - `server/src/modules/audit/auditRepository.ts`
  - `server/src/plugins/requestContext.ts`
  - `server/src/modules/errors/httpError.ts`

## Version Scope

### In Scope For v0.1.16 Overall

1. Sync health status.
2. Directory sync preflight.
3. Scheduled full sync with system actor.
4. Sync strategy interface notes for later incremental/event runtime.
5. `/sync` page health/preflight/scheduled status.
6. Browser verification screenshots for the completed `/sync` slice.

### Completed First Vertical Slice

1. `GET /api/sync/status`
   - platform admin only.
   - returns latest run, latest successful run, latest failed run, running status, directory counts, health status and reasons.
2. `POST /api/sync/preflight`
   - platform admin only.
   - validates token, department read and user read through adapter.
   - writes `sync.preflight` audit success/failure.
   - does not create `sync_runs`.
   - does not mutate `feishu_users`, `directory_departments`, `directory_users`.
3. Tests for status, preflight, permission denial and non-mutation.

### Second Vertical Slice In This Plan

1. `sync_runs` 支持 system actor：
   - `operator_type = 'feishu_user' | 'system'`
   - scheduled runs use `operator_type='system'`
   - scheduled runs keep `operator_feishu_user_id = null`
2. Scheduled full sync:
   - default disabled.
   - controlled by `FEISHU_SYNC_SCHEDULE_ENABLED`
   - interval controlled by `FEISHU_SYNC_SCHEDULE_INTERVAL_MINUTES`
   - startup delay controlled by `FEISHU_SYNC_SCHEDULE_START_DELAY_SECONDS`
   - uses the same full sync service.
3. Tests for migration, scheduled success, scheduled skip when another sync is running, and no fake Feishu user.

### Completed Third Vertical Slice

1. `/sync` 页面接入 `GET /api/sync/status`：
   - 展示健康状态、健康原因、目录用户数量、目录部门数量、最近成功和最近失败时间。
   - 状态接口失败时展示可重试错误提示，不伪造健康结果。
2. `/sync` 页面接入 `POST /api/sync/preflight`：
   - 使用 `sync:run` 权限控制运行预检。
   - Drawer 展示 token、departments、users 阶段结果、Request ID、错误码和请求批次数。
   - 预检文案保持诊断语义，不暗示已经执行目录同步。
3. scheduled/system actor 可见性：
   - 同步历史表将 `operator_type='system'` 或空 `operator_feishu_user_id` 显示为 `系统任务`。
   - 不新增、不伪造任何飞书用户。
4. 前端 mock 和 HTTP mode 均补齐 status/preflight adapter。

### Out Of Scope For Current Slice

- README/CHANGELOG/VERSION release metadata.
- Incremental sync, event sync or webhook runtime.
- `/directory` editing or import/export.
- Application admin sync access.
- OAuth/OIDC changes.

## Engineering Decisions

1. `DirectorySyncAdapter` gains `preflight(): Promise<DirectorySyncPreflightResult>`.
2. `RealFeishuDirectorySyncAdapter.preflight()` reuses existing token and minimal department/user fetch helpers.
3. `LocalMockDirectorySyncAdapter.preflight()` returns deterministic pass stages for local and E2E use.
4. `GET /api/sync/status` computes status from existing `sync_runs` and directory projection tables; no migration is needed in the first slice.
5. Health rules:
   - running sync exists: `warning`
   - no successful run: `unknown`
   - latest failed run is newer than latest successful run: `failed`
   - otherwise: `healthy`
6. Preflight errors are sanitized to an IAM error code and message. App Secret, tenant token and raw payload are never returned.
7. Scheduled full sync uses `operator_type='system'` and `operator_feishu_user_id=null`; it must not insert a fake `feishu_users` row.
8. Scheduler startup is wired only in `server/src/main.ts`; tests call scheduler functions directly.

## File Tasks

### Backend

- `server/src/modules/sync/directorySyncAdapter.ts`
  - Add `DirectorySyncPreflightStage`, `DirectorySyncPreflightResult`, `preflight()`.
  - Implement real adapter preflight with token, departments and users stages.
  - Implement local mock preflight.
- `server/src/modules/sync/syncService.ts`
  - Add `getSyncStatus()`.
  - Add `runDirectorySyncPreflight()`.
  - Extend `startDirectorySync()` for system-triggered scheduled runs.
  - Add sanitized preflight error handling.
- `server/src/modules/sync/syncScheduler.ts`
  - Add start/stop wrapper and one-shot scheduled sync execution.
- `server/src/modules/sync/syncRoutes.ts`
  - Add `GET /api/sync/status`.
  - Add `POST /api/sync/preflight`.
  - Reuse platform admin guard.
- `server/tests/helpers/testApp.ts`
  - Ensure fake adapter implements `preflight()`.
- `server/tests/sync.test.ts`
  - Cover status, preflight success/failure, scheduled sync, system actor, permission denial and non-mutation.
- `server/tests/migrations.test.ts`
  - Cover migration `007_sync_ops`.

### Docs / Planning

- `IMPLEMENTATION_PLAN.md`
  - This file documents the first vertical slice and remaining version scope.
- `docs/superpowers/plans/2026-05-26-v0.1.16-sync-ops-runtime-eng-review.md`
  - Engineering review source for this slice.
- `docs/superpowers/plans/2026-05-27-v0.1.16-sync-ops-frontend-plan-design-review.md`
  - Frontend design review source for the `/sync` health/preflight slice.

### Frontend

- `src/features/iam/types.ts`
  - Add sync health, preflight and system actor types.
- `src/features/iam/dtoMappers.ts`
  - Map sync status, preflight result and nullable system actor fields.
- `src/features/iam/httpApi.ts`
  - Add `getSyncStatus()` and `runSyncPreflight()`.
- `src/features/iam/mockApi.ts`
  - Add deterministic mock status and preflight behavior.
- `src/features/iam/queries.ts`
  - Add `useSyncStatus()` and `useRunSyncPreflight()`.
- `src/pages/Sync/index.tsx`
  - Render health status, preflight action/result Drawer and system operator label.
- `src/pages/Sync/index.test.tsx`
  - Cover status summary, system actor display, preflight Drawer and permission-disabled state.

## Second Vertical Slice Steps

1. Add migration `007_sync_ops.sql`.
2. Extend sync run mapping and insert logic for `operator_type`.
3. Add scheduled sync one-shot and scheduler start/stop module.
4. Parse scheduler env vars and wire scheduler in `main.ts`.
5. Add focused backend tests.
6. Run targeted server tests, server build and diff check.

## Third Vertical Slice Steps

1. Run `/sync` frontend plan-design-review and confirm no new Pencil prototype is required.
2. Add sync status/preflight DTOs, hooks and mock behavior.
3. Update `/sync` page status summary, toolbar and preflight Drawer.
4. Preserve `sync:view` read-only and `sync:run` action permission split.
5. Run targeted frontend tests, frontend build, browser verification, targeted server tests, server build and diff check.

## Verification Commands

```bash
TEST_DATABASE_URL=postgres://postgres:postgres@127.0.0.1:55432/feishu_iam_test npm run server:test -- server/tests/sync.test.ts server/tests/migrations.test.ts
npm test -- src/pages/Sync/index.test.tsx
npm run build
npm run server:build
git diff --check
```

Optional broader checks if time and runtime allow:

```bash
npm run server:test
npm run build
npm test
```

## Completion Criteria For Current Slice

- `GET /api/sync/status` exists and is platform-admin-only.
- `POST /api/sync/preflight` exists and is platform-admin-only.
- Preflight success/failure writes `sync.preflight` audit.
- Preflight does not create `sync_runs`.
- Preflight does not mutate directory projection.
- Tests cover success, failure, denied access and status health classification.
- `sync_runs.operator_type` migration exists and is tested.
- scheduled full sync can create a succeeded `trigger=scheduled` run with `operator_type=system`.
- scheduled full sync does not create or rely on a fake Feishu user.
- scheduled full sync skips safely when another sync is already running.
- `/sync` displays status health, latest success/failure/scheduled state and system operator without fake Feishu user.
- `/sync` preflight action displays token/departments/users stage results and remains `sync:run` gated.
- Targeted server tests and server build pass.
- Targeted frontend tests, frontend build, browser verification and diff check pass.
- Release metadata remains explicitly out of scope for this user-requested slice.

## Remaining v0.1.16 Work After This Slice

1. README, CHANGELOG, VERSION and release metadata after explicit user authorization.
2. Final ship, tag, GitHub Release and deploy after explicit authorization.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|---|---|---:|---:|---|---|
| Office Hours | `/office-hours` follow-up | 合并 v0.1.16-v0.1.18 范围 | 1 | clear | 合并为 `v0.1.16 同步运营 Runtime`。 |
| Eng Review | local `/plan-eng-review` equivalent | preflight、status、scheduler/system actor 风险 | 1 | clear-with-limits | 按切片推进 backend status/preflight、scheduled system actor 和 `/sync` 前端运营入口。 |
| Design Review | local `/plan-design-review` equivalent | `/sync` 前端健康、预检和 system actor 可见性 | 1 | clear | 复用既有 Pencil 和 v0.1.15 页面模式，不需要新增原型。 |
| Writing Plans | Superpowers `writing-plans` equivalent | 明确文件路径、任务、测试和完成标准 | 1 | ready | 后端 status/preflight、scheduled system actor 和 `/sync` 前端切片均可端到端验证；release metadata 明确延期。 |
