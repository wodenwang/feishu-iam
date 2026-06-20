# v1.0.5 权限管理 Product Design 原型

本目录是 `v1.0.5` 权限管理模块的 Product Design 静态原型，不使用 Pencil。

## 有效页面

- `index.html#role-list`：权限管理落地页，即角色列表页。
- `index.html#role-subjects`：角色配置工作台 - 组织 / 用户与角色绑定。
- `index.html#role-permissions`：角色配置工作台 - 应用权限与角色绑定。
- `index.html#role-edit`：角色基础信息编辑、状态管理和删除。

## 设计约束

- 前端技术栈按 `DESIGN.md` 的 shadcn/ui + tweakcn + Tailwind 基线处理。
- PC 端优先，1440px 为主要画布。
- 角色配置工作台是独立页面，不是抽屉、Sheet 或弹窗。
- `组织与用户` 使用同一个组织树选择器，组织节点和用户节点在同一棵树中勾选。
- `应用权限` 必须保留权限点对比。
- 本版本必须从原 `应用管理` 中移除角色管理部分；应用详情不再展示角色管理 Tab / 入口 / 操作按钮。
- 应用管理只保留应用自身配置和权限资产查看；角色新增、编辑、删除、启停和配置统一归入 `权限管理`。

## 前端组件映射

- 壳层：`AppShell`、`SidebarNav`、`PageHeader`
- 列表：`FilterBar`、`DataTable`、`StatusBadge`、`ConfirmDialog`
- 工作区：`Tabs`、`RoleConfigLayout`、`SaveSummaryRail`
- 组织用户：`OrgUserSelector`、`ScrollArea`、`Checkbox`
- 应用权限：`PermissionGroupPicker`、`PermissionPointPreview`、`PermissionComparePanel`
- 编辑页：`FormPanel`、`Switch`、`AlertDialog`
