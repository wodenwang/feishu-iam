# feishu-iam v0.2.1 Application Access Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use Superpowers `executing-plans` to implement this plan task-by-task. Keep scope limited to `v0.2.1 应用接入闭环补缺`.

**Goal:** 交付 `v0.2.1 应用接入闭环补缺`：一键复制第三方应用接入提示词、角色按权限组授权、登录入口恢复态优化，并完成本地验证和版本元数据更新。

**Architecture:** 继续使用 React + Ant Design + TanStack Query 前端、Fastify + PostgreSQL 后端。权限组绑定新增独立关系表；权限查询合并直接权限点和权限组展开结果。应用提示词在前端根据应用详情和 redirect URI 生成，后端只记录复制审计，不保存 prompt 全文或 secret 明文。

## Scope

### In Scope

- 应用详情 `接入配置` Tab 新增 `复制应用提示词`。
- 提示词面向 Codex / Claude Code，指导第三方项目创建或维护 `AGENTS.md` / `CLAUDE.md`。
- 提示词包含 SSO / OAuth / Application API / HMAC / 权限注册 / 权限查询接入信息。
- 角色授权支持 permission group 绑定。
- 权限查询展开 permission group 到启用权限点。
- 登录页支持 `loginRequired`，并优化入口视觉和恢复动作。
- 更新 `VERSION`、`package.json`、`package-lock.json`、`README.md`、`CHANGELOG.md`。
- 增加 v0.2.1 QA / review / design review 证据文件。

### Out Of Scope

- OIDC discovery、JWKS、PKCE、refresh token。
- SDK / CLI / Helm / Terraform。
- 飞书 webhook / event sync / incremental sync。
- `/directory` 编辑、导入、导出。
- username/password 或本地超级管理员。
- push、PR、tag、release、deploy。

## File Map

- Create: `server/src/db/migrations/009_role_permission_groups.sql`
- Modify: `server/src/modules/roles/roleRoutes.ts`
- Modify: `server/src/modules/applicationApi/applicationApiRoutes.ts`
- Modify: `server/tests/roles.test.ts`
- Modify: `src/features/iam/types.ts`
- Modify: `src/features/iam/httpApi.ts`
- Modify: `src/features/iam/dtoMappers.ts`
- Modify: `src/features/iam/mockApi.ts`
- Modify: `src/pages/Roles/index.tsx`
- Modify: `src/pages/Roles/index.test.tsx`
- Modify: `src/pages/Applications/Detail.tsx`
- Modify: `src/pages/Applications/Detail.test.tsx`
- Modify: `src/pages/Login/index.tsx`
- Modify: `src/pages/Login/index.test.tsx`
- Modify: `src/app/App.tsx`
- Modify: `VERSION`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Create: `design/implementation-screenshots/v0.2.1-application-access-closure/`

## Tasks

### Task 1: Role Permission Group Runtime

- Add migration for `role_permission_groups`.
- Extend role authorization request with `permissionGroupCodes`.
- Resolve groups within the role application only.
- Save group bindings atomically with existing point/user/department bindings.
- Update permission query to return active points from direct point bindings and active group bindings.
- Add backend tests for group binding, disabled group semantics and audit metadata.

### Task 2: Roles UI Group Binding

- Split checked tree keys into group codes and point codes.
- Initialize authorization Drawer from existing role `permissionKeys`.
- Save `permissionGroupCodes` and `permissionKeys`.
- Update summary wording to include 权限组 and 权限点.
- Add frontend tests for group selection and summary.

### Task 3: Application Prompt Copy

- Build prompt from current application, active redirect URIs and IAM base URL.
- Add `复制应用提示词` button in `接入配置`.
- Use existing secret copy audit endpoint with `kind: agent_prompt`.
- Ensure prompt uses secret environment variable names, not secret previews.
- Add frontend tests.

### Task 4: Login Recovery UX

- Add `loginRequired` state from URL status.
- Replace Result-dominant login layout with a compact Admin Console login card.
- Include environment/runtime/deployment metadata and clear recovery action.
- Keep DEV mock login secondary and local-only.
- Add tests for `loginRequired` and no username/password.

### Task 5: Version And Evidence

- Update version metadata and public docs.
- Run targeted tests, broader tests/build, and browser verification where available.
- Create v0.2.1 QA, design-review and review reports.

## Completion Criteria

- `npm run server:test -- server/tests/roles.test.ts server/tests/applications.test.ts` passes.
- Relevant frontend tests pass.
- `npm run server:build`, `npm test`, `npm run build`, and `git diff --check` pass or any failure is documented with a clear blocker.
- Browser/Playwright evidence covers application prompt copy, role authorization Drawer and login page.
- No secret plaintext is added to docs, tests, audit fixtures or repository files.
