# Feishu IAM v1.0.6 权限管理 UI/UX 实施计划

> 当前计划对应 `docs/superpowers/plans/2026-06-21-feishu-iam-v1.0.6-permission-uiux.md`。执行时必须遵守 `AGENTS.md`、`DESIGN.md` 和 my-harness 15 步流程。

## 目标

完成 `v1.0.6` 权限管理 UI/UX 小版本：修复角色配置工作台在 `组织与用户` 和 `应用权限` 中的布局拉伸问题，将当前应用切换改为纵向 tab，并优化工作台标题层级和右侧权限预览高度。

## 不可变边界

- 不新增 DDL。
- 不改变角色、应用、权限组、权限点或 role-application binding 数据模型。
- 不改变权限计算、管理员 session、管理员权限校验或审计记录语义。
- 不恢复应用管理中的角色管理。
- 不做全站 UI 主题重构。
- 不发布、不部署、不 push，除非用户另行授权。

## Task 1: 组织与用户布局

- [x] `OrgUserSelector` 桌面双栏父容器使用 `items-start`。
- [x] `OrgBrowser` 待选区域使用 `content-start`。
- [x] 增加布局测试。

## Task 2: 应用权限布局和应用切换

- [x] `GroupsTab` 双栏父容器使用 `items-start`。
- [x] `可选权限组` 区域使用 `content-start`。
- [x] 当前应用切换改为纵向 tablist。
- [x] 保留添加应用能力。
- [x] 增加纵向 tab 和无下拉框测试。

## Task 3: 额外 UI/UX 收口

- [x] 页面模式内部标题改为 `角色上下文`。
- [x] 总览基础信息标题改为 `基础信息概览`。
- [x] `绑定结果预览` 右侧栏设置 sticky、最大高度和内部滚动。
- [x] 权限点对比表设置最大高度和内部滚动。
- [x] 增加标题和滚动边界测试。

## Task 4: 过程记录

- [x] 写入 Product Design 调研记录。
- [x] 写入 v1.0.6 规格。
- [x] 写入 v1.0.6 详细计划。
- [x] 验证完成后更新 `.my-harness/status.md`、run 记录和会话归档。

## Task 5: 验证

已通过：

```bash
pnpm --filter @feishu-iam/admin-web test -- src/features/permissions/PermissionRoleDetailSheet.test.tsx src/features/org-browser/org-user-selector.test.tsx
pnpm --filter @feishu-iam/admin-web typecheck
pnpm --filter @feishu-iam/admin-web lint
pnpm --filter @feishu-iam/admin-web build
```

浏览器验证已通过：

- `role-list`
- `role-overview`
- `role-subjects`
- `role-permissions`
- `role-base`
- 视口：`1440x900`、`768x900`、`390x844`
- 报告：`output/playwright/v1.0.6-permission-uiux-audit/uiux-audit.json`
- 结果：无 console error、无 failed request、无页面级横向溢出。

## 完成标准

- 用户标注的两个高度异常修复。
- 当前应用切换使用纵向 tab。
- 角色工作台标题不再重复。
- 权限点对比和右侧预览有稳定高度边界。
- 所有验证命令有新鲜通过证据。
- 浏览器复查无 console error、失败请求或页面级横向溢出。
