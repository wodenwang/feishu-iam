# Feishu IAM v1.0.6 权限管理 UI/UX 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: use my-harness flow, then execute this plan slice-by-slice. Do not change backend schema or permission semantics.

## Goal

交付 `v1.0.6` 权限管理 UI/UX 小版本：修复角色配置工作台在 `组织与用户`、`应用权限` 中的布局拉伸问题，将当前应用切换改为纵向 tab，并改善工作台标题层级和右侧权限预览高度。

## Architecture

本版本是前端表现层修复。保持 `v1.0.5` 的角色独立资源、角色-应用多对多绑定、组织用户选择器和应用权限工作区架构不变。

## Source Inputs

- `AGENTS.md`
- `DESIGN.md`
- `.my-harness/status.md`
- `docs/design-audits/2026-06-21-permission-management-uiux/v1.0.6-product-design-audit.md`
- `docs/superpowers/specs/2026-06-21-feishu-iam-v1.0.6-permission-uiux.md`
- 用户生产页面浏览器标注截图

## Task 1: 组织与用户布局修复

**Files:**

- `apps/admin-web/src/features/org-browser/org-browser.tsx`
- `apps/admin-web/src/features/org-browser/org-user-selector.tsx`
- `apps/admin-web/src/features/org-browser/org-user-selector.test.tsx`

Steps:

- [x] `OrgUserSelector` 桌面双栏父容器增加起始对齐，避免左右栏等高拉伸。
- [x] `OrgBrowser` 待选区域使用 `content-start`，避免内部空白被拉开。
- [x] 增加测试覆盖待选区域和父容器布局类。

Expected output:

- 生产标注的 `待选组织与用户` 区域按内容高度展示。

## Task 2: 应用权限工作区修复

**Files:**

- `apps/admin-web/src/features/permissions/PermissionRoleDetailSheet.tsx`
- `apps/admin-web/src/features/permissions/PermissionRoleDetailSheet.test.tsx`

Steps:

- [x] `GroupsTab` 顶层双栏父容器使用 `items-start`。
- [x] `可选权限组` 左侧区域使用 `content-start`。
- [x] 当前应用切换从下拉框改为纵向 tablist。
- [x] 保留添加应用的下拉选择能力。
- [x] 测试覆盖纵向 tablist、无当前应用 combobox、应用切换回调。

Expected output:

- 生产标注的 `可选权限组` 区域按内容高度展示。
- 当前应用切换符合用户指定的纵向 tab 方式。

## Task 3: 额外 UI/UX 收口

**Files:**

- `apps/admin-web/src/features/permissions/PermissionRoleDetailSheet.tsx`
- `apps/admin-web/src/features/permissions/PermissionRoleDetailSheet.test.tsx`

Steps:

- [x] 页面模式下内部详情标题改为 `角色上下文`。
- [x] 总览首块标题改为 `基础信息概览`，角色名称作为字段展示。
- [x] `绑定结果预览` 桌面端使用 sticky 右栏和内部滚动。
- [x] 权限点对比表增加最大高度和内部滚动。
- [x] 测试覆盖标题去重和滚动边界。

Expected output:

- 角色工作台首屏标题层级更清晰。
- 右侧权限预览在权限点较多时不会无限拉长页面。

## Task 4: 文档和 harness 记录

**Files:**

- `docs/design-audits/2026-06-21-permission-management-uiux/v1.0.6-product-design-audit.md`
- `docs/superpowers/specs/2026-06-21-feishu-iam-v1.0.6-permission-uiux.md`
- `docs/superpowers/plans/2026-06-21-feishu-iam-v1.0.6-permission-uiux.md`
- `IMPLEMENTATION_PLAN.md`
- `.my-harness/status.md`
- `.my-harness/runs/2026-06-21-v1.0.6-permission-uiux.md`
- `docs/codex-sessions/2026-06-21-0234-v1.0.6-permission-uiux.md`

Steps:

- [x] 记录 Product Design 工具不可用和替代调研证据。
- [x] 写入 v1.0.6 规格。
- [x] 写入 v1.0.6 实施计划。
- [x] 验证完成后更新 harness 状态和会话归档。

## Task 5: 验证

Commands passed:

```bash
pnpm --filter @feishu-iam/admin-web test -- src/features/permissions/PermissionRoleDetailSheet.test.tsx src/features/org-browser/org-user-selector.test.tsx
pnpm --filter @feishu-iam/admin-web typecheck
pnpm --filter @feishu-iam/admin-web lint
pnpm --filter @feishu-iam/admin-web build
```

Browser verification passed:

- Start admin web dev server.
- Run Playwright audit for role list, overview, subjects, permissions and base tabs.
- Cover 1440, 768 and 390 viewports.
- Confirm no console errors, failed requests or horizontal overflow.
- Report: `output/playwright/v1.0.6-permission-uiux-audit/uiux-audit.json`

## Completion Criteria

- All focused tests and admin-web checks pass.
- Browser audit passes on the target routes and viewports.
- User-marked issues are fixed.
- Additional audited UI/UX issues are fixed.
- No backend schema, permission semantics or deployment artifacts are changed.
