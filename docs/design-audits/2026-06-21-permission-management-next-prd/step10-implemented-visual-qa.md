# Feishu IAM v1.0.7 权限管理 Step 10 实现后视觉 QA

时间：2026-06-21 17:30 CST

## 评审目标

对照 `DESIGN.md` 的 shadcn/ui + tweakcn 后台系统基线、PRD、工程计划和已选视觉目标 `D1/D：Role Workbench First + Traceable Permissions + Matrix First 密度参考`，审查 `v1.0.7` 已实现界面是否存在关键设计阻塞。

## 评审结论

Step 10 已通过，无需用户决策。实现整体符合传统后台系统信息密度、左侧导航、表格/表单工作区、弹窗/状态/响应式要求，可以进入 Step 11 `gstack /qa`。

本轮发现 2 个实现后视觉问题，已在当前工作区直接修复并复核：

- 角色配置工作台页面模式存在外层 PageHeader 与内层详情壳重复标题。已调整为：外层继续显示 `角色配置工作台`，内层详情壳显示角色名称，例如 `财务管理员`，避免首屏重复语义。
- `管理角色关联应用` Dialog 中单个状态徽标在 grid 容器里被拉伸成横条。已调整 `StatusBadge` 为内容宽度，避免后台状态标识被父布局拉伸。

未发现需要 D1/D2/D3 决策门禁的关键设计阻塞。

## 覆盖范围

| 检查项 | 结论 | 证据 |
|---|---|---|
| 权限管理二级导航 | 通过 | 左侧 `权限管理` 下包含 `角色授权`、`权限矩阵`，当前二级项高亮稳定 |
| 角色授权列表 | 通过 | 保留查询、应用筛选、状态筛选、表格和行内详情入口 |
| 角色工作台减负首屏 | 通过 | 仅保留 `总览 / 组织与用户 / 应用权限`，内层标题改为角色名 |
| 应用权限 tab | 通过 | 当前应用使用纵向 tab，权限组和绑定结果预览形成主从工作区 |
| 管理角色关联应用 Dialog | 通过 | Dialog 层级、背景、标题、已关联/可添加列表、按钮和徽标宽度稳定 |
| 权限矩阵查询页 | 通过 | 支持主体类型、主体 ID、应用筛选、查询按钮和结果区 |
| 用户查询结果 | 通过 | 展示应用、角色、权限组、权限点和来源解释 |
| 组织查询结果 | 通过 | 展示直接组织绑定角色带来的权限来源 |
| 空状态 | 通过 | 角色列表、Dialog、权限矩阵均有稳定空态文案 |
| 错误状态 | 通过 | API 错误落在页面内 alert，不暴露堆栈和敏感信息 |
| 权限不足状态 | 通过 | 权限矩阵和角色工作台具备 403/只读提示路径 |
| 加载状态 | 通过 | 页面加载、查询提交和保存按钮 pending 状态存在 |
| 390px 窄屏 | 通过 | 响应式检查无页面级横向溢出，导航切换为打开导航按钮 |
| 审计入口 | 通过 | 角色-应用软解除、权限绑定保存仍走后端写操作和审计边界；权限矩阵只读 |
| 权限解释路径 | 通过 | 权限矩阵有 `权限来源解释`，角色工作台有最终权限点来源说明 |

## 视觉证据

截图目录：

```text
output/playwright/v1.0.7-permission-management-design-qa/
```

关键截图：

- `01-role-auth-list-1440.png`
- `02-role-workbench-overview-1440.png`
- `03-role-workbench-application-permissions-1440.png`
- `05-permission-matrix-user-1440.png`
- `06-permission-matrix-department-1440.png`
- `07-permission-matrix-user-390.png`
- `10-role-workbench-title-final-1440.png`
- `11-manage-role-applications-dialog-final-1440.png`

截图补充验证：

```json
{
  "consoleErrors": [],
  "requestFailures": [],
  "screenshots": [
    "10-role-workbench-title-final-1440.png",
    "11-manage-role-applications-dialog-final-1440.png"
  ]
}
```

## 验证命令

```bash
pnpm --filter @feishu-iam/admin-web test -- src/features/permissions/PermissionRoleDetailSheet.test.tsx src/App.test.tsx
pnpm --filter @feishu-iam/admin-web build
ADMIN_WEB_URL=http://localhost:4173 pnpm --filter @feishu-iam/admin-web test:responsive
```

验证结果：

- `PermissionRoleDetailSheet.test.tsx` + `App.test.tsx`：51 个用例通过。
- `admin-web build`：通过；Vite chunk size warning 为既有提示。
- `test:responsive`：14 条后台路由 x 390/768/1280/1440 视口，`failures: []`。

## 接受的设计差异

- 权限矩阵移动端采用单列堆叠解释区，而不是强制底部 Sheet。当前方案在 390px 下无横向溢出，查询与解释路径可读，符合 MVP 和后台系统基线。
- 权限矩阵结果密度参考 Matrix First，但不引入更高复杂度的报表型透视表。当前实现优先保证来源解释、审计边界和响应式稳定。

## 后续建议

进入 Step 11 `gstack /qa`，重点覆盖：

- 角色创建在全部应用视图和指定应用视图下的真实交互。
- 角色-应用添加与软解除后的页面刷新、审计记录和权限组绑定状态。
- 权限矩阵用户查询、组织查询、空结果、错误结果和权限不足结果。
- 旧深链 `/admin/permissions/:appKey/roles/:roleId` 与 `tab=groups` 兼容。
