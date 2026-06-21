# Feishu IAM v1.0.7 权限管理选定视觉目标评审

评审时间：2026-06-21 11:46 CST。

## 选定方案

用户确认选择 D1/D：

- 以 `Role Workbench First` 为主视觉目标。
- 吸收 `Traceable Permissions` 的权限矩阵解释面板和移动端形态。
- 以 `Matrix First` 作为权限矩阵结果密度参考。

对应视觉制品：

- `02-role-workbench-first.png`
- `03-traceable-permissions.png`
- `01-matrix-first.png`

## 评审结论

选定组合视觉目标通过 Step 4 Product Design review，可以进入 Step 5 工程方案评审。

通过条件：

- 不把 `Traceable Permissions` 扩展成通用报表或复杂权限图谱。
- 权限矩阵解释面板只解释当前选中的权限点来源。
- `Role Workbench First` 继续作为角色工作台和应用管理 Dialog 的主实现参考。
- `Matrix First` 只作为权限矩阵桌面结果区的信息密度参考，不替代解释面板的交互结构。

## 审查范围

本次审查覆盖：

- 权限管理二级导航。
- 角色授权列表。
- 角色工作台减负。
- `应用权限` tab。
- `管理角色关联应用` Dialog。
- 权限矩阵查询页。
- 用户查询结果。
- 组织查询结果。
- 空状态、错误状态、权限不足状态、加载状态。
- 390px 窄屏形态。

## Strengths

### 1. 信息架构边界清楚

选定组合将权限管理拆成两个二级入口：

- `角色授权`：配置角色授权绑定。
- `权限矩阵`：只读查询主体最终权限和来源。

这与 `DESIGN.md` 中系统管理二级导航模式一致，也符合 PRD 中“角色配置”和“权限结果查询”分离的目标。

### 2. 角色工作台减负方向正确

`Role Workbench First` 直接修复线上审计中的主要问题：

- 移除独立 `角色上下文` 卡片。
- 将角色 key、状态、关联应用、组织、用户、权限组数量合并到 PageHeader metadata。
- 角色工作台 tab 收敛为 `总览 / 组织与用户 / 应用权限`。
- `应用权限` 不再展示 `权限点对比`。

这能降低首屏重复信息，且与当前 `PermissionRoleDetailSheet` / `ResponsiveTabsList` 结构贴近。

### 3. 应用管理 Dialog 符合 shadcn/tweakcn 后台模型

`管理角色关联应用` Dialog 覆盖：

- 搜索。
- 已绑定应用。
- 可添加应用。
- 添加 / 移除动作。
- 变更摘要。
- 软解除和审计提示。
- 取消 / 确认变更。

该形态适合使用 shadcn `Dialog`、`Table`、`Badge`、`Button`、`Alert` 和项目级确认组件组合实现，不需要新增大型基础组件。

### 4. 权限矩阵解释能力服务排障主路径

`Traceable Permissions` 的解释面板能回答：

- 当前权限点是什么。
- 来源角色是谁。
- 来源权限组是什么。
- 匹配类型是直接用户绑定、组织继承，还是组织直接绑定。
- 下一步去哪里看角色工作台或操作审计。

这正好服务“为什么这个用户有/没有权限”的排障目标。

### 5. 390px 降级路径已明确

选定组合给出移动端方向：

- 角色列表改为行卡片或关键列列表。
- 应用权限从三列降级为分段结构。
- 应用管理 Dialog 改为单列。
- 权限矩阵结果按应用折叠卡片展示。
- 解释面板改为底部 Sheet。

这符合 `DESIGN.md` 对 390px 的硬约束。

## UX Risks

### R1：解释面板可能扩大成过重功能

风险：如果实现时把解释面板做成完整审计、报表、导出或图谱，会超出 `v1.0.7` MVP。

约束：

- 解释面板只显示当前选中的一个权限点。
- 只展示 PRD 响应中已有或 Step 5 确认可提供的字段。
- 不做跨主体比较、批量导出、图谱、BI 图表或时间线。

### R2：角色工作台三列布局在 768px/390px 容易拥挤

风险：`应用权限` 桌面三列清晰，但窄屏若硬压缩会导致 key、按钮和最终权限点列表重叠。

约束：

- 1440px：可使用应用列表 / 权限组 / 保存摘要三列。
- 768px：改为两段或纵向排列，右侧摘要可置于权限组下方。
- 390px：必须单列分段，保存摘要靠近保存按钮，不使用固定右栏。

### R3：创建角色入口需要避免模型误解

风险：权限管理不应恢复角色元数据管理，但平台管理员不能看到无解释 disabled。

约束：

- `创建角色` 可以打开弹框。
- 如果当前未选应用，弹框内第一步必须选择应用。
- 弹框文案要说明角色属于应用，基础信息仍按应用归属管理。
- 无权限用户才禁用按钮，并展示稳定原因。

### R4：二级导航需要兼容现有深链

风险：新增 `权限矩阵` 二级入口时，如果 `权限管理` 路由或 active route 匹配处理不稳，可能破坏旧深链。

约束：

- `/admin/permissions` 继续指向 `角色授权`。
- `/admin/permissions/matrix` 指向 `权限矩阵`。
- `/admin/permissions/roles/:roleId` 和 `/admin/permissions/:appKey/roles/:roleId` 继续可用。
- 侧边栏 active 状态要让 `权限管理` 父级保持展开。

## Accessibility Risks

- Dialog 打开后焦点必须进入弹框，关闭后返回 `管理应用` 按钮。
- `移除`、`添加`、`复制 key`、`查看角色工作台`、`查看操作审计` 等图标或短按钮必须有 `aria-label` / `title` / tooltip。
- `用户 / 组织` 切换必须使用可键盘操作的 Tabs、segmented control 或 RadioGroup。
- 解释面板作为 Sheet 时需要明确标题、关闭按钮和焦点管理。
- 错误状态必须展示 request id 和可恢复动作，不只显示红色图标。
- 所有长 key 都必须可截断、换行、tooltip 或复制，不能只靠缩小字号。

## 状态覆盖验收

进入工程评审和实施计划前，必须保留以下状态：

### 角色授权列表

- 正常数据。
- loading / skeleton。
- 空结果。
- API error。
- no permission。
- 平台管理员创建角色。
- 无权限用户禁用并说明原因。

### 角色工作台

- 总览正常。
- 组织与用户正常。
- 应用权限正常。
- read-only。
- 保存中。
- 保存失败。
- 无绑定应用空状态。

### 管理角色关联应用 Dialog

- 正常。
- 搜索无结果。
- 移除当前应用。
- 添加应用。
- 无可添加应用。
- 提交中。
- 提交失败。
- 390px 单列。

### 权限矩阵

- 未选择主体。
- 用户查询结果。
- 组织查询结果。
- 查询中。
- 无结果。
- 查询错误带 request id。
- 权限不足。
- 390px 应用折叠卡片。
- 解释面板桌面右侧 / 移动端底部 Sheet。

## 组件映射

| 视觉目标 | 推荐组件 |
|---|---|
| 权限管理二级导航 | `Sidebar` + `Collapsible` + project `SidebarNav` |
| 角色授权列表 | `PageHeader` + `FilterBar` + project `DataTable` |
| 创建角色 | `Dialog` 或现有 `PermissionRoleCreateDialog` |
| 角色工作台 tab | `ResponsiveTabsList` + `Tabs` |
| 应用列表 | `ScrollArea` + `Button` / `Badge` / list rows |
| 权限组选择 | `Checkbox` + `Accordion` / `Collapsible` |
| 管理应用 | `Dialog` + `Table` + `Alert` + `Button` |
| 权限矩阵查询 | `Tabs` / `RadioGroup` + `OrgUserSelector` / existing selector |
| 权限矩阵结果 | `Accordion` + `Table` + `Badge` |
| 解释面板 | desktop side panel / mobile `Sheet` |
| 状态展示 | project `EmptyState` / `ErrorState` / `Skeleton` / `Alert` |

## 设计完成标准

选定视觉目标进入 Step 5 前，需要把以下结论带入工程评审：

- `权限管理` 使用左侧二级导航，非页内 Tab。
- `角色授权` 保持 `/admin/permissions` 兼容。
- `权限矩阵` 使用 `/admin/permissions/matrix`。
- 角色工作台只保留 `总览 / 组织与用户 / 应用权限`。
- `管理角色关联应用` Dialog 负责添加和移除应用。
- 权限矩阵解释面板只解释选中权限点来源，不做报表化扩展。
- 390px 下应用权限和权限矩阵都必须单列或折叠，不硬压宽表格。

## 结论

Step 4 通过，无关键设计阻塞。

下一步进入 Step 5：`gstack /plan-eng-review`，重点评审：

- 二级导航路由和深链兼容。
- 创建角色 disabled 根因和交互实现。
- 角色-应用绑定软解除 API。
- 权限矩阵查询 API 和来源解释字段。
- 390px 和状态覆盖的测试策略。
