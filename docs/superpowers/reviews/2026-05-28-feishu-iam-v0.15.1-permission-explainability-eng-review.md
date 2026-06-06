# Feishu IAM v0.15.1 权限可解释性与后台操作一致性工程评审

日期：2026-05-28
状态：通过，允许进入实施计划

## 评审方式说明

本轮按 `my-harness-next-action` 原则需要工程评审。当前 gstack `/plan-eng-review` 同样依赖当前环境不可用的 AskUserQuestion 交互工具，因此采用项目内可审计降级：基于现有代码、Prisma schema、规格和设计评审完成工程评审，并把结论写入本文。

## 输入

- `docs/superpowers/specs/2026-05-28-feishu-iam-v0.15.1-permission-explainability.md`
- `docs/superpowers/reviews/2026-05-28-feishu-iam-v0.15.1-permission-explainability-design-review.md`
- `apps/api/src/permission/iam-role.service.ts`
- `apps/api/src/admin/admin-permission.controller.ts`
- `apps/api/prisma/schema.prisma`
- `apps/admin-web/src/api/permission.ts`
- `apps/admin-web/src/features/permissions/PermissionRoleDetailSheet.tsx`
- `apps/admin-web/src/features/applications/ApplicationDetailSheet.tsx`
- `apps/admin-web/src/components/admin/AppShell.tsx`

## 关键工程判断

### 1. 不新增 DDL

现有 schema 已有：

- `PermissionGroup.permissionPoints`
- `IamRole.permissionGroups`
- `IamRole.permissionPoints`

这些关系足够支撑权限组内权限点查看和最终权限点聚合，不需要新增表、索引或迁移。

### 2. 扩展角色列表响应，而不是新增多个前端请求

推荐在 `IamRoleService.listRoles()` 中 include：

- 角色绑定的权限组及每个权限组内权限点。
- 角色直接绑定的权限点。

然后返回给 admin-web 的 `IamRole` 结构增加：

- `permissionPoints`：直接绑定权限点。
- `permissionGroups[].permissionPoints`：权限组内权限点。

原因：

- 角色详情当前已经通过 `fetchIamRoles(appKey)` 获取角色绑定数据，扩展同一响应最小。
- 可以避免前端在每个权限组展开时再请求接口，减少状态复杂度。
- 不改变开发者 API `/me/permissions` 和后端授权计算语义。

### 3. 最终权限点在前端聚合

`v0.15.1` 的最终权限点一览是管理后台解释性 UI，不是授权判定接口。前端根据直接权限点和权限组内权限点聚合来源即可。

聚合规则：

```text
直接绑定权限点 -> source.direct = true
权限组内权限点 -> source.groups += group
相同 permissionPoint.id 或 key 合并为一条
搜索匹配 key、name、description、来源权限组 name/key
```

后续如真实数据量变大，再考虑服务端分页和聚合接口。

### 4. 权限边界不变

所有新增响应仍走 `GET /api/v1/admin/applications/:appKey/iam-roles`，保留 `assertCanManageApplication()`。应用管理员只能读取授权应用的数据，不新增跨应用读取路径。

### 5. UI 修复必须复用现有模式

应用详情角色管理启停用图标按钮应复用管理员授权列表中 `Power / PowerOff` 图标按钮模式。左侧导航 hover 修复只改 class 布局，不改导航树、路由或权限判断。

## 风险与处理

| 风险 | 判断 | 处理 |
| --- | --- | --- |
| 角色列表响应变大 | 可接受 | 当前权限管理后台本来按应用读取角色；权限点规模如变大后续再做分页 |
| 前端聚合与后端授权结果不一致 | 中等风险 | 使用同一角色绑定数据和启用状态过滤规则，补 API/前端测试 |
| 禁用权限组或权限点来源展示误导 | 中等风险 | 列表展示状态，最终权限点聚合只把 active 权限点计入最终结果 |
| #25 修复影响收缩态导航 | 低风险 | 保留 collapsed 分支和 tooltip，补 App 测试 |
| 图标按钮可访问名称不清晰 | 低风险 | `aria-label` 必须包含动作和角色 key |

## 测试策略

- API：
  - `apps/api/test/admin.controller.e2e-spec.ts` 增加 admin 角色列表响应断言，覆盖权限组内权限点和直接权限点。
  - `apps/api/test/iam-role.service.spec.ts` 如已有 service mock 结构可补单测，否则以 e2e 为主。
- Admin Web：
  - `PermissionManagementView.test.tsx` 覆盖权限组内权限点展示、最终权限点搜索、来源合并。
  - `ApplicationManagementView.test.tsx` 覆盖应用详情角色管理启停用图标按钮，不再出现文字按钮变形。
  - `App.test.tsx` 覆盖普通一级菜单和分组父级导航 class 行宽一致。
- 验证：
  - `pnpm --filter @feishu-iam/api test -- test/admin.controller.e2e-spec.ts`
  - `pnpm --filter @feishu-iam/admin-web test -- src/features/permissions/PermissionManagementView.test.tsx src/features/applications/ApplicationManagementView.test.tsx src/App.test.tsx`
  - `pnpm --filter @feishu-iam/admin-web build`
  - `ADMIN_WEB_URL=http://127.0.0.1:5173 pnpm --filter @feishu-iam/admin-web test:responsive`
  - `pnpm check`

## 工程结论

工程门禁通过。实施计划应采用一个 vertical slice：

1. 后端扩展 `listRoles()` 响应。
2. 前端类型和角色详情 UI 聚合最终权限点。
3. 修复应用详情角色操作列和左侧导航 hover。
4. 更新版本文档、验证、发布和部署。
