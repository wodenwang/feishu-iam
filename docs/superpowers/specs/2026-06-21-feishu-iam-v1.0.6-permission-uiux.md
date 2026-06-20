# Feishu IAM v1.0.6 权限管理 UI/UX 小版本规格

## 版本目标

`v1.0.6` 是 `v1.0.5` 权限管理角色配置工作台的 UI/UX 小版本，主要修复生产页面中暴露出的布局和工作台可扫描性问题。

本版本只处理前端表现层和配套测试文档，不改变后端权限模型。

## 输入

- 用户生产页面标注：`组织与用户` 待选区高度间隙异常。
- 用户生产页面标注：`应用权限` 可选权限组高度异常，当前应用应使用纵向 tab 切换。
- Product Design 调研替代记录：`docs/design-audits/2026-06-21-permission-management-uiux/v1.0.6-product-design-audit.md`
- v1.0.5 规格：`docs/superpowers/specs/2026-06-20-feishu-iam-v1.0.5-permission-workbench.md`
- 项目设计规范：`DESIGN.md`

## 范围

### P0：用户标注问题

1. `组织与用户` Tab 的待选区域不再被右侧内容拉伸。
2. `应用权限` Tab 的可选权限组区域不再被右侧内容拉伸。
3. `应用权限` 当前应用切换从下拉框改为纵向 tab。

### P1：调研追加问题

1. 角色工作台页面减少重复标题。
2. `绑定结果预览` 右侧栏建立稳定滚动边界。
3. 权限点对比表在数据较多时使用内部滚动。

## 前端行为

### 组织与用户

- 桌面双栏布局使用 `items-start`。
- 待选组织与用户区域使用内容起始对齐。
- 保持组织和用户同列表展示。
- 保持保存前 diff 和已选摘要。

### 应用权限

- 当前应用区域使用纵向 tablist。
- 每个 tab 展示应用名称、`appKey`、应用状态、绑定状态。
- 选中应用保留可访问状态。
- 未选中应用点击后更新 `appKey` URL 状态。
- 不再展示“当前应用”下拉框。
- `添加应用` 仍使用下拉选择未绑定应用。

### 角色上下文

- 独立页面顶栏标题仍为 `角色配置工作台`。
- 内部详情卡片标题改为 `角色上下文`。
- 总览基础信息标题改为 `基础信息概览`。
- 角色名称作为字段展示。

### 预览和对比

- 桌面端 `绑定结果预览` 使用 sticky 右栏。
- 右栏设置最大高度和内部滚动。
- 权限点对比表设置最大高度和 `overflow-auto`。

## 非目标

- 不新增后端接口。
- 不新增数据库迁移。
- 不改变 v1.0.5 role-application binding 语义。
- 不调整权限计算。
- 不做应用管理、飞书同步、审计、SSO 页面改造。
- 不发布或部署，除非用户另行授权。

## 验收标准

- Focused Vitest 覆盖纵向应用 tab、布局起始对齐、标题去重、预览滚动边界。
- `pnpm --filter @feishu-iam/admin-web typecheck` 通过。
- `pnpm --filter @feishu-iam/admin-web lint` 通过。
- `pnpm --filter @feishu-iam/admin-web build` 通过。
- Playwright 检查 `role-list`、`role-overview`、`role-subjects`、`role-permissions`、`role-base` 的 1440、768、390 视口。
- 浏览器检查无 console error、无失败请求、无页面级横向溢出。
