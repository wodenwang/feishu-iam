# Feishu IAM v0.11.3 权限管理角色授权工作区实施计划

> 本计划承接 `docs/superpowers/specs/2026-05-26-feishu-iam-v0.11-roadmap-design.md` 的 `v0.11.3` 范围，以及 `design/v0.11.3-role-authorization-prototype.md` 的 Pencil 原型复审结论。当前会话无法使用 `AskUserQuestion`，因此 `gstack /plan-eng-review` 以普通 Codex 工程审查方式落到本计划，不绕过权限、审计和状态要求。

## 1. 版本目标

`v0.11.3` 交付权限管理角色授权工作区：权限管理首页只作为角色授权入口，支持按应用筛选、搜索和分页；角色详情使用 Tab 化工作区承载总览、组织与用户绑定、权限组绑定、基础信息只读和操作说明；保存组织/用户或权限组变更前必须展示 diff 摘要。

本版本收口 GitLab issue `#7` 和 `#9` 的权限管理侧。不在权限管理新增或编辑角色元数据，角色 key、名称、描述和启停状态继续归应用管理维护。不新增 DDL，不新增飞书同步能力，不实现资源级权限、ABAC、deny 规则、完整 OIDC、HTTPS 或高可用。

## 2. 数据和接口边界

复用现有后端接口：

- `GET /api/v1/admin/applications`
- `GET /api/v1/admin/applications/:appKey/iam-roles`
- `GET /api/v1/admin/applications/:appKey/permission-groups`
- `GET /api/v1/admin/applications/:appKey/feishu/users?keyword=...`
- `GET /api/v1/admin/applications/:appKey/feishu/departments?keyword=...`
- `PUT /api/v1/admin/applications/:appKey/iam-roles/:roleId/subjects`
- `PUT /api/v1/admin/applications/:appKey/iam-roles/:roleId/permission-groups`

飞书组织待选区使用本地飞书镜像搜索结果组织成可扫描列表。当前后端没有“按父部门懒加载完整组织树”的管理端接口，因此本版本不新增后端树接口；UI 文案必须明确是“组织待选区 / 搜索本地飞书镜像”，避免伪装成实时飞书树。

## 3. 前端实现

修改 `apps/admin-web/src/features/permissions/`：

- `PermissionManagementView.tsx`
  - 移除权限管理首页的“创建角色”主操作。
  - 角色列表保留应用筛选、角色搜索、状态筛选、排序、分页、空/错/加载/无权限状态。
  - 行操作只保留进入详情，不在权限管理页暴露角色新增、编辑或启停。
- `permission-columns.tsx`
  - 操作列简化为单一详情入口，列宽随之缩小。
  - 保留权限组和成员摘要，长 key 和成员 ID 必须截断或换行，不撑破布局。
- `PermissionRoleDetailSheet.tsx`
  - 改为 Tab 工作区：总览、组织与用户绑定、权限组绑定、基础信息、操作说明。
  - 使用 `DetailSheet` 的 full 默认尺寸，保证复杂授权区有足够宽度。
  - 组织与用户绑定在同一 Tab 内完成：左侧部门候选和用户候选，右侧已选主体，组织和用户分区展示。
  - 权限组绑定在详情 Tab 内完成，展示 active/disabled 状态和权限组摘要。
  - 保存前统一弹出 diff 摘要确认；保存失败保留草稿和当前 Tab。
  - 空、错、加载、无权限和只读状态按区域展示稳定中文说明。
- 删除或停止使用旧的 `PermissionRoleCreateDialog.tsx`、`PermissionRoleEditDialog.tsx`、`PermissionSubjectBindingDialog.tsx`、`PermissionGroupBindingDialog.tsx` 入口。文件可以留存，但当前页面不再引用它们。

## 4. 测试计划

前端单测：

- `PermissionManagementView.test.tsx`
  - 渲染角色列表、按应用和搜索过滤、重置筛选。
  - 权限管理页不展示创建、编辑、启停角色入口。
  - 从 URL 打开角色详情，Tab 切换后不丢失筛选状态。
  - 在详情内保存权限组绑定前展示 diff 摘要，确认后调用 `replaceIamRolePermissionGroups`。
  - 在详情内搜索飞书用户和部门，加入已选主体，保存前展示 diff 摘要，确认后调用 `replaceIamRoleSubjects`。
  - 保存失败后错误展示在当前 Tab，草稿不丢失。
  - 403 角色响应展示无权限状态而不是空列表。

自动化验证：

- `pnpm --filter @feishu-iam/admin-web test -- src/features/permissions/PermissionManagementView.test.tsx`
- `pnpm --filter @feishu-iam/admin-web typecheck`
- `pnpm --filter @feishu-iam/admin-web build`
- `pnpm check`

Browser 自检：

- 启动本地管理后台后打开 `http://localhost:3000/admin/permissions`。
- 检查角色列表、筛选、详情 Tab、组织/用户绑定、权限组绑定、保存前确认、错误状态、桌面和窄屏布局。
- Console 不应有前端错误，Network 不应有非预期失败。

## 5. 发布和部署路径

- 版本号更新到 `0.11.3`：根包、API、admin-web、`/version` 默认值、deploy 默认镜像 tag、安装脚本、README、CHANGELOG。
- 不新增 migration，数据库 ready schema 版本保持既有要求。
- 构建并发布镜像：
  `docker buildx build --platform linux/amd64,linux/arm64 --provenance=false --sbom=false -f deploy/api.Dockerfile -t dockerhub.it.tangtring.com:80/ai/feishu-iam:v0.11.3 -t dockerhub.it.tangtring.com:80/ai/feishu-iam:latest --push .`
- 创建 tag / release：`v0.11.3`。
- 部署到 `192.168.2.112:~/feishu-iam`，停机升级后检查 `/ready`、`/version` 和管理后台权限管理路径。

## 6. 完成标准

- 权限管理首页不再承担角色元数据维护。
- 角色授权详情 Tab 工作区覆盖组织与用户绑定、权限组绑定和保存前 diff 摘要。
- 保存失败时保留当前草稿并允许重试。
- 关键状态覆盖加载、空、错误、无权限和只读。
- 单测、类型检查、构建、Browser 自检、设计 QA、功能 QA 和落地前 review 都有新鲜证据。
- README、CHANGELOG、会话归档和版本号同步到 `0.11.3`。

## 7. 任务清单

- [ ] 改造权限管理首页和行操作边界。
- [ ] 改造角色详情为 Tab 授权工作区。
- [ ] 内嵌组织/用户绑定和权限组绑定，并加入保存前确认。
- [ ] 更新权限管理测试。
- [ ] 更新版本、README、CHANGELOG 和会话归档。
- [ ] 运行自动化验证和 Browser 自检。
- [ ] review、Git 收口、ship、land-and-deploy。
