# Feishu IAM v0.15.0 组织树与组织用户选择器工程评审

评审时间：2026-05-28 16:28

评审方式：用户要求使用 `gstack /plan-eng-review` 视角审查工程方案；本轮放弃 AskUserQuestion gate，改用普通 Codex 静态工程评审。评审不代表原型或工程实现已批准交付，只判断是否可以进入 Superpowers writing-plans。

## 输入

- `docs/superpowers/specs/2026-05-28-feishu-iam-v0.15.0-org-tree-selector.md`
- `design/admin-console-v0.15.0.pen`
- `design/v0.15.0-org-tree-selector-prototype.md`
- `design/exports/v0.15.0-org-tree-selector/`
- `docs/codex-sessions/2026-05-28-1448-v0.15.0组织树原型复审.md`
- `docs/codex-sessions/2026-05-28-1555-v0.15.0组织树原型二次阻塞修复.md`
- 现有后端、前端和测试代码结构。

## 结论

可以进入 Superpowers writing-plans。

前提是实施计划必须显式纳入本文的组件边界、API 契约、保存语义、区域隔离失败处理、响应式状态、#24 操作列实现和测试矩阵。当前没有必须回到 Pencil 的阻塞；工程侧也不需要新增 DDL 或改变部署拓扑。

## 版本边界

本版本进入范围：

- #19：飞书同步页去掉重复 IA，组织与用户浏览首屏改为可下钻的组织浏览体验。
- #20：角色绑定页引入组织/用户选择器，支持组织主体和用户主体分别选择、双栏桌面态和 390px 分步窄屏态。
- #24：应用详情角色管理操作列稳定化，危险操作有确认、tooltip 或 aria label，按钮不换行、不变形。

本版本明确不进入范围：

- #21 权限组树形勾选和最终权限点查看器，留到后续小版本。
- 飞书实时通讯录树、飞书角色同步、飞书用户组同步。
- 新增 Prisma DDL、完整 OIDC、SAML、ABAC、资源级权限、部署拓扑或管理员 session 机制调整。
- 把角色元数据新增、编辑、启停迁回权限管理。

## 工程边界

推荐收敛为三个可并行但有清晰边界的实现面：

1. 组织浏览基础能力：新增项目内封装 `OrgBrowser`，负责本地镜像组织下钻、搜索、加载、空态、无权限和区域隔离失败状态。
2. 组织用户选择能力：新增项目内封装 `OrgUserSelector`，复用 `OrgBrowser` 的节点模型，但只负责角色授权草稿、已选列表、差异摘要和保存状态。
3. #24 操作列：在应用详情角色管理 Tab 内独立修复操作列，不与组织选择器耦合。

组件不应进入通用设计系统包；本版本先放在管理后台项目内，例如 `apps/admin-web/src/features/org-browser/`。如果后续第二个业务域复用，再考虑抽取更通用层。

## 数据契约

现有数据库已经有 `FeishuDepartment.parentDepartmentId`、`FeishuUserDepartment`、`IamRoleSubject(subjectType, subjectId, isOrphaned)`，足够支撑 v0.15.0，不建议新增 DDL。

组织浏览节点建议统一为前端域模型：

```ts
type OrgBrowserNode =
  | {
      kind: "department";
      id: string;
      name: string;
      parentDepartmentId: string | null;
      isDeleted: boolean;
      disabledReason?: string;
      childCount?: number;
      userCount?: number;
    }
  | {
      kind: "user";
      id: string;
      name: string;
      departmentIds: string[];
      isActive: boolean;
      isDeleted: boolean;
      disabledReason?: string;
    };
```

飞书同步页可继续使用现有 `/api/v1/admin/feishu/departments`、`/api/v1/admin/feishu/departments/:departmentId`、`/api/v1/admin/feishu/users` 和 `/api/v1/admin/feishu/users/:userId`，但实现时不得依赖 `getDepartment()` 内部 `take: 50` 的 children/users 静默截断作为完整列表。组织下钻列表应使用分页列表接口，或在接口中显式返回 `hasMore`、`total` 和加载更多状态。

角色绑定页建议保留应用级权限边界，不直接要求所有应用管理员具备全局飞书同步查询权限。可以扩展现有应用级候选接口：

- `GET /api/v1/admin/applications/:appKey/feishu/departments`
- `GET /api/v1/admin/applications/:appKey/feishu/users`

扩展参数建议包括 `parent_department_id`、`department_id`、`keyword`、`page`、`page_size`，响应补齐 `parentDepartmentId`、`isDeleted`、`isActive`、分页信息和必要的禁用原因。后端继续使用 `assertCanManageApplication`。

## 保存语义

角色授权保存必须把组织主体和用户主体分开建模：

```json
{
  "org_subjects": ["od-root", "od-sales"],
  "user_subjects": ["ou_1", "ou_2"]
}
```

后端 `PUT /api/v1/admin/applications/:appKey/iam-roles/:roleId/subjects` 建议在 v0.15.0 接受上述新格式，并兼容旧格式：

```json
{
  "subjects": [
    { "type": "feishu_department", "id": "od-sales" },
    { "type": "feishu_user", "id": "ou_1" }
  ]
}
```

服务层可以继续使用现有扁平 `RoleSubjectInput[]`，但 Controller 必须把 `org_subjects` 映射为 `feishu_department`，把 `user_subjects` 映射为 `feishu_user`。重复覆盖、无效类型、空字符串和同一主体重复提交应在 Controller 或统一校验函数中稳定报错。

选择语义必须保持清楚：

- 选择部门表示绑定组织主体。
- 选择部门不把该部门下所有用户展开保存为 `user_subjects`。
- 用户可单独选择。
- 父子半选只表达视觉覆盖关系，不改变保存 payload。
- 已被直接选择或被组织覆盖的用户在 UI 中要能解释重复覆盖，但不要重复保存。
- 移除摘要必须分别展示新增组织、移除组织、新增用户、移除用户。

现有 `IamRoleService.replaceRoleSubjects()` 会逐个调用 `subjectExists()`，实现时应改为按用户和部门批量查存在性，避免大批量选择时出现 N+1 查询。

## 区域隔离失败

`OrgBrowser` 的失败状态只能污染当前浏览区域：

- 当前下钻节点加载失败时，右侧或当前列表显示错误卡片、重试按钮和返回可见范围动作。
- 已选草稿、差异摘要和保存按钮状态不能被浏览区错误清空。
- 搜索无结果、无权限、加载中和失败要区分展示。
- 飞书同步页字段诊断、同步历史和健康摘要不应因为组织浏览失败消失。

这一点已经在 Pencil 原型二次修复中通过“无权限查看该组织”状态表达，工程实现必须用状态模型和测试固定下来。

## 响应式要求

桌面态：

- `OrgBrowser` 使用下钻双栏组织浏览器，不恢复旧的扁平部门列表。
- `OrgUserSelector` 使用待选区和已选区双栏，右侧保留已选分组、移除动作、差异摘要和保存状态。
- 角色详情页不得继续依赖 `min-w-[760px]` 让窄屏横向滚动承载主流程。

390px 窄屏态：

- 必须是待选、已选、摘要三个分步面板。
- 底部保存区稳定，不被列表滚动挤出。
- 保存中、保存失败、无权限、空态和搜索无结果都要在分步模型中可达。
- 长姓名、长部门名和长角色名必须截断、换行或 tooltip，不撑破容器。

## shadcn/ui + tweakcn + Tailwind 约束

实现应复用现有 shadcn 风格组件和 Tailwind token：

- `Button`、`Tabs`、`AlertDialog`、`Tooltip`、`Badge`、`ScrollArea`、`Input`、`Skeleton`、`Alert` 优先使用现有组件。
- 不新增 Ant Design、ProComponents 或独立 Tree UI 依赖。
- 图标按钮使用 lucide 图标，补 `aria-label` 和 tooltip。
- 不使用营销式 hero、装饰性渐变、大面积低密度卡片或自由视觉稿风格。
- 操作列宽度固定，危险操作必须确认。

## #24 操作列

应用详情角色管理 Tab 的操作列可以独立实施：

- 固定列宽，不随角色名称、状态或按钮文案变化。
- 查看、编辑、启用、停用使用图标按钮或稳定紧凑按钮组。
- 停用必须经过 `AlertDialog` 确认，说明审计影响和停用后行为。
- 每个图标按钮必须有 `aria-label`，例如 `停用 crm.admin`。
- tooltip 说明按钮含义；禁用状态也要能解释原因。
- 不进入角色授权绑定流程，不恢复旧的“后续版本”占位文案。

现有测试已经覆盖了应用角色表格操作列宽度和基础 aria 名称，但还缺停用确认、tooltip 和窄宽稳定性的断言。

## 测试策略

后端测试需要覆盖：

- 应用级飞书用户和部门候选接口新增分页、父级过滤、部门过滤和权限拒绝。
- `org_subjects` / `user_subjects` payload 解析、legacy `subjects` 兼容、重复主体、无效主体和空主体。
- `IamRoleService.replaceRoleSubjects()` 批量存在性检查、orphaned 标记和审计 before/after diff。
- 飞书镜像查询在超过 50 个子部门或用户时不会静默丢数据。

前端单元和组件测试需要覆盖：

- 飞书同步页不再显示重复内部 IA，健康摘要、组织用户浏览、字段诊断和同步历史仍在。
- 全量同步只在高级/危险区，轻量操作保留在主操作区。
- `OrgBrowser` 的加载、空态、搜索无结果、无权限、失败重试、返回可见范围和区域隔离失败。
- `OrgUserSelector` 桌面双栏选择、移除、重复覆盖说明、保存中、保存失败且草稿保留。
- 390px 待选、已选、摘要三步流程。
- #24 停用确认、tooltip 或 aria label、操作列宽度稳定。

建议命令：

```bash
pnpm --filter @feishu-iam/api test -- test/feishu-mirror-query.service.spec.ts test/iam-role.service.spec.ts
pnpm --filter @feishu-iam/admin-web test -- src/features/settings/SystemSettingsView.test.tsx src/features/permissions/PermissionManagementView.test.tsx src/features/applications/ApplicationManagementView.test.tsx
pnpm --filter @feishu-iam/admin-web build
pnpm check
```

涉及管理后台页面和响应式布局后，必须按项目规范启动本地页面并用 Browser 自检桌面和 390px 状态，检查 console、Network、布局溢出、遮挡和主流程交互。

## 主要风险

- 如果继续用部门详情接口的 `take: 50` 结果渲染整棵树，会产生静默遗漏，这是本版本最需要在计划中前置修掉的风险。
- 如果应用级角色选择器直接复用全局飞书同步查询权限，可能扩大应用管理员权限边界。
- 如果保存 payload 仍只暴露扁平 `subjects`，前端规则说明、半选状态和差异摘要容易与后端语义漂移。
- 如果 390px 继续依赖横向滚动而不是三步面板，#20 的窄屏验收会失败。
- 如果 #24 只修视觉宽度而不补危险确认和可访问说明，仍不能闭环。

## 推荐实施拆分

1. API 和保存契约：扩展应用级候选接口、增加 `org_subjects` / `user_subjects` parser、保留 legacy 兼容、批量化主体存在性检查。
2. 前端共享模型：新增 `OrgBrowser`、`OrgUserSelector`、选择状态 reducer、差异摘要工具和错误状态模型。
3. 飞书同步页集成：去掉重复 IA，接入只读 `OrgBrowser`，保持健康摘要、字段诊断、同步历史和危险区全量同步。
4. 角色绑定页集成：替换当前分散搜索列表和 `min-w-[760px]` 主流程，完成桌面双栏和 390px 三步面板。
5. #24 操作列：补停用确认、tooltip、aria label 和稳定宽度测试。
6. 验证与版本收口：补测试、Browser 自检、README/CHANGELOG/AGENTS/session archive、版本号和发布计划。

## writing-plans 准入意见

允许进入 Superpowers writing-plans。

writing-plans 产物必须把本文的 API 契约、选择语义、区域隔离失败、390px 状态、#24 操作列和测试命令写成可执行任务。#21 必须继续明确排除到后续小版本。
