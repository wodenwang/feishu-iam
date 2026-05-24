# feishu-iam v0.1.10 Admin Console Frontend Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Prefer Superpowers `subagent-driven-development` for implementation because tasks below have explicit, mostly non-overlapping ownership. Main agent owns integration, verification, release, and deployment. If a worker needs to touch another worker's files, stop and report before editing.

## Goal

交付 v0.1.10 Admin Console 前端重构：按已批准 Pencil 原型实现 Ant Design Pro 风格 Admin Shell、品牌 logo、飞书唯一登录页、UserMenu、退出登录流程、稳定表格状态、主题 token 和响应式修复。

## Source Inputs

- Design source: `design/feishu-iam-v0.1.10-frontend-redesign.pen`
- Design notes: `design/feishu-iam-v0.1.10-frontend-redesign-notes.md`
- Prototype review R2: `design/feishu-iam-v0.1.10-frontend-redesign-prototype-review-r2.md`
- Engineering review: `docs/superpowers/plans/2026-05-24-v0.1.10-frontend-redesign-eng-review.md`
- Project rules: `AGENTS.md`, `CLAUDE.md`, `DESIGN.md`

## Scope

### In Scope

1. Ant Design token theme using the v0.1.10 brand palette.
2. Shared UI components:
   - `BrandLogo`
   - `PageHeader`
   - `StatusTag`
   - `UserMenu`
   - updated `SearchForm`
   - updated `AppTable`
3. Stable `AdminLayout`:
   - fixed header height
   - stable sider width/collapsed width
   - right-aligned UserMenu
   - responsive 1440 / 1280 / 768 behavior
4. Production and local-dev login page split:
   - no username/password
   - no Mock entry in production
   - DEV ONLY mock entry in local dev
5. Logout flow:
   - backend `POST /api/auth/logout`
   - frontend mutation
   - query cache clearing
   - confirm, loading, failure retry, success redirect
6. Application list layout alignment:
   - `Breadcrumb -> PageHeader + PrimaryAction -> SearchForm -> Table`
   - table loading/empty/error/search-empty state stability
   - query button uses search icon or no icon
   - status tags use semantic Ant Design colors
7. Tests, browser verification, design-review, QA, review, ship, land, deploy.

### Out of Scope

- Username/password login.
- Third-party OAuth Demo closure.
- OIDC discovery, consent, refresh-token productization.
- Full Feishu directory sync redesign.
- Large marketing landing page.
- Replacing Ant Design with another UI framework.

## Task Boundaries For Subagents

### Worker A: Theme And Shared Components

Ownership:

- `src/theme/theme.ts`
- `src/components/BrandLogo/`
- `src/components/PageHeader/`
- `src/components/StatusTag/`
- `src/components/SearchForm/`
- `src/components/AppTable/`
- focused tests for these components if needed

Tasks:

- [ ] Apply theme token palette:
  - `colorPrimary: #0f4c81`
  - `colorInfo: #1f67b2`
  - `colorWarning: #f28c28`
  - `colorBgLayout: #eef4f8`
  - `colorTextBase: #122230`
  - table header `#f6f9fb`
- [ ] Implement `BrandLogo` SVG-based component with expanded/collapsed/login variants.
- [ ] Implement `PageHeader` wrapper with title, description, breadcrumb-compatible spacing, and `extra`.
- [ ] Implement `StatusTag` mapping for active/disabled/draft/system statuses.
- [ ] Update `SearchForm` to support compact grid/inline layout without decorative card nesting.
- [ ] Update `AppTable` to support stable loading/empty/error/search-empty states with fixed min-height and preserved table header/pagination area.
- [ ] Ensure query/search buttons use `SearchOutlined` or no icon, never `PlusOutlined`.

Verification:

- `npm test -- src/components`
- Existing page tests still compile.

### Worker B: Auth, Login, Logout, UserMenu

Ownership:

- `server/src/modules/auth/authRoutes.ts`
- `server/tests/auth.mock-login.test.ts`
- `server/tests/auth.logout.test.ts` if created
- `src/features/iam/httpApi.ts`
- `src/features/iam/queries.ts`
- `src/pages/Login/`
- `src/components/UserMenu/`
- focused auth/login tests

Tasks:

- [ ] Add `POST /api/auth/logout`, clearing the session cookie.
- [ ] Add HTTP API helper `logout()` and mutation hook `useLogout()`.
- [ ] Build `UserMenu` from the prototype:
  - user name and role first
  - environment tag
  - truncated `open_id`
  - copy affordance
  - keyboard-accessible dropdown
  - logout danger action
- [ ] Rebuild `LoginPage` from the approved production/local-dev prototype:
  - production state
  - local dev state with `DEV ONLY`
  - callback processing
  - config/auth/access errors
  - no username/password inputs
- [ ] Wire logout success to cache clear and `/login` navigation.
- [ ] Wire logout failure to visible retryable error without clearing current UI state.

Verification:

- `npm run server:test -- server/tests/auth.mock-login.test.ts server/tests/auth.logout.test.ts`
- `npm test -- src/pages/Login/index.test.tsx`
- `npm test -- src/components/UserMenu`

### Worker C: Admin Shell And Applications Page

Ownership:

- `src/layouts/AdminLayout.tsx`
- `src/layouts/AdminLayout.test.tsx` if created
- `src/pages/Applications/List.tsx`
- `src/pages/Applications/List.test.tsx`
- route/layout test updates

Tasks:

- [ ] Refactor `AdminLayout` to approved shell:
  - `Sider` 224px, collapsed 64px
  - Header 56px
  - `BrandLogo`
  - environment/sync tags
  - `UserMenu`
  - content padding 24 desktop, 16 tablet
- [ ] Keep HTTP mode visible menu to `/applications`, `/roles`, `/directory`, `/audit-logs`.
- [ ] Align Applications list to approved order:
  - `PageHeader + 新增应用`
  - `SearchForm`
  - `AppTable`
- [ ] Add stable table states:
  - data
  - loading
  - empty
  - error with requestId and retry
  - search empty with reset filters
- [ ] Use horizontal scroll at compact viewport and keep application/status/actions accessible.
- [ ] Replace `+ 查询` with search icon or no icon.
- [ ] Avoid black high-contrast `停用` status tag.

Verification:

- `npm test -- src/pages/Applications/List.test.tsx`
- `npm test -- src/router/routes.test.tsx`

### Main Agent: Integration, Version, Verification, Ship, Deploy

Ownership:

- `IMPLEMENTATION_PLAN.md`
- `docs/superpowers/plans/2026-05-24-v0.1.10-frontend-redesign-eng-review.md`
- `CHANGELOG.md`
- `VERSION`
- `package.json`
- `package-lock.json`
- verification reports and screenshots
- final integration across worker output

Tasks:

- [ ] Integrate worker outputs and resolve conflicts.
- [ ] Update version metadata to `0.1.10`.
- [ ] Update `CHANGELOG.md`.
- [ ] Run full verification:
  - `npm run server:test`
  - `npm test`
  - `npm run build`
  - `npm run server:build`
  - `npm run e2e`
- [ ] Run browser verification for:
  - `/login`
  - `/applications`
  - UserMenu logout flow
  - 1440 / 1280 / 768
- [ ] Run design-review loop and fix in-scope findings.
- [ ] Run QA loop and fix in-scope findings.
- [ ] Run review loop and fix in-scope findings.
- [ ] Git closeout, ship, land, deploy under user authorization.

## Completion Criteria

- Production `/login` has no Mock entry and no username/password fields.
- Local dev `/login` shows `DEV ONLY` mock entry only when allowed.
- Admin Shell matches approved hierarchy and does not show long Feishu ID in Header.
- UserMenu supports logout confirm/loading/error/success.
- Table states remain dimensionally stable.
- `SearchForm` does not use `+` icon for query.
- `停用` status tag is not black high-contrast.
- Fresh tests and browser evidence exist.
- `v0.1.10` version metadata and CHANGELOG are updated.
- Release/deploy artifacts are recorded without secrets.

## Expected Commands

```bash
npm run server:test
npm test
npm run build
npm run server:build
npm run e2e
```

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|---|---|---:|---:|---|---|
| CEO Review | `/office-hours` | Scope & strategy | 1 | clear | v0.1.10 scoped to frontend polish/refactor; v0.2.* keeps third-party OAuth Demo. |
| Eng Review | `/plan-eng-review` | Architecture & tests | 1 | clear | subagent task boundaries, logout API, theme/layout/data-flow/test strategy locked. |
| Design Review | `/plan-design-review` | UI/UX gaps | 2 | clear | R2 score 9/10, 0 unresolved; 2 implementation nits folded into tasks. |
