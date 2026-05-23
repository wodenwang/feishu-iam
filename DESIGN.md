# feishu-iam 设计系统基线

本文档是 `feishu-iam` 的视觉与交互设计基线，供 Pencil 原型、前端实现和后续设计评审使用。

规则来源优先级：

1. 用户在当前对话中的明确指令
2. 已确认的 Pencil 原型
3. `AGENTS.md` / `CLAUDE.md`
4. `docs/` 下的项目文档
5. 现有实现代码
6. Ant Design 官方模式
7. 通用前端最佳实践

本文件只描述 UI/UX 与设计系统规则。领域、安全、后端、Agent 行为等规则仍以 `AGENTS.md` 为准。

## 1. 产品类型

`feishu-iam` 是一个企业级 Admin Console / 后台管理系统。

目标用户：

- IT 开发人员
- IT 运维人员
- 平台管理员
- 应用管理员

设计目标：

- 高信息密度
- 操作效率
- 清晰的数据表格
- 一致的 CRUD 流程
- 符合中国国内企业中后台系统习惯
- 可维护性优先于视觉创意

本项目不是：

- 营销官网
- 落地页
- 消费者产品
- Dribbble 风格概念稿
- 装饰性 Dashboard

## 2. 设计原则

### 表格优先

Table 是本项目最核心的前端组件。所有数据列表页默认使用 Ant Design Table。

适用页面：

- 应用管理
- 角色授权
- 组织与用户
- 飞书同步记录
- 审计日志
- 权限组 / 权限点只读列表

默认避免把核心 CRUD 页面设计成卡片网格。

### 操作路径清晰

后台用户每天重复使用系统。页面应该让用户快速完成任务，而不是欣赏视觉效果。

优先级：

1. 快速扫读
2. 操作清晰
3. 布局可预测
4. 表格可靠
5. 表单高效
6. 权限明确
7. 错误可恢复
8. CRUD 流程一致

### 视觉克制

设计应体现企业后台的可信、稳定、可维护。

避免：

- 大面积渐变
- 玻璃拟态
- 异形卡片
- 复杂动画
- 非标准悬浮操作按钮
- 大面积留白
- 过度圆角
- 装饰性图标和插画

### 状态完整

每个主要页面都必须考虑：

- 正常数据状态
- Empty state
- Loading state
- API error state
- No permission state
- Form validation error state
- Delete confirmation state
- Batch operation confirmation state
- Search no results state
- Disabled operation state

不要只设计 happy path。

## 3. 组件体系

UI 组件体系必须以 Ant Design 为主。

默认技术栈：

- React
- TypeScript
- Vite
- Ant Design
- React Router
- TanStack Query
- Playwright

不要混用其他 UI 框架：

- Material UI
- Chakra UI
- shadcn/ui
- Arco Design
- Element Plus
- 自定义大型 Design System

## 4. Ant Design 组件映射

| UI 模式 | Ant Design 组件 |
|---|---|
| 应用整体布局 | `Layout` |
| 左侧导航 | `Layout.Sider + Menu` |
| 顶部栏 | `Layout.Header` |
| 面包屑 | `Breadcrumb` |
| 页面标题区 | 项目级 `PageHeader` wrapper |
| 指标卡片 | `Card + Statistic` |
| 数据表格 | `Table` |
| 查询筛选区 | `Form + Input + Select + DatePicker` |
| 新增 / 编辑面板 | `Drawer + Form` |
| 确认操作 | `Modal / Popconfirm` |
| 状态展示 | `Tag / Badge` |
| 详情展示 | `Descriptions` |
| Tab 页面 | `Tabs` |
| 分步流程 | `Steps` |
| 上传 | `Upload` |
| 树形选择 | `Tree / TreeSelect` |
| 日期范围 | `DatePicker.RangePicker` |
| 权限选择 | `Tree / Checkbox.Group` |

如果 Ant Design 已有合适组件，不优先编写大量自定义 CSS 或自定义组件。

## 5. 标准列表页结构

所有 CRUD 列表页默认使用以下结构：

```text
PageHeader
  |
  v
SearchForm
  |
  v
Toolbar
  |
  v
Table
  |
  v
Pagination
```

### PageHeader

包含：

- 页面标题
- 简短说明
- Breadcrumb
- 必要时显示主操作按钮

标题应说明当前区域是什么，不使用营销文案。

### SearchForm

默认展示 3-4 个核心筛选项。

常用字段：

- Keyword Input
- Status Select
- Type Select
- Date Range Picker
- Search Button
- Reset Button
- Advanced Filters 展开 / 收起

筛选项过多时，次要条件放入展开区域。

### Toolbar

常用操作：

- Primary Create Button
- Batch Actions
- Export / Import Actions
- Refresh

危险操作必须二次确认。

### Table

默认能力：

- `columns`
- `dataSource`
- `rowKey`
- `pagination`
- `loading`
- `rowSelection`
- `sorter`
- `filters`
- fixed action column
- expandable rows
- `scroll`

默认避免：

- 合并单元格
- 深层嵌套表格
- 高度自定义 row rendering
- 表格单元格中嵌入复杂表单
- drag sorting + virtual scroll + fixed columns 的复杂组合
- 无限层级 Tree Table
- 非标准 row actions

## 6. 新增 / 编辑 / 详情交互

Admin Console 默认交互模式：

| 场景 | 推荐模式 |
|---|---|
| 简单新增 | `Drawer + Form` |
| 简单编辑 | `Drawer + Form` |
| 详情查看 | `Drawer + Descriptions` |
| 删除 | `Popconfirm` 或 `Modal` |
| 启用 / 禁用 | `Popconfirm` 或 `Modal` |
| 批量操作 | `Modal confirmation` |
| 多字段复杂表单 | Full page form |
| 多步骤流程 | `Steps + full page` |
| 复杂配置 | Full page 或 `Tabs` |

新增和编辑通常打开右侧 Drawer。

只有以下情况优先使用 Full page form：

- 字段很多
- 表单包含多个分组
- 流程包含多个步骤
- 用户需要专注处理复杂任务
- 数据模型不适合放入 Drawer

## 7. 表单规范

业务表单统一使用 Ant Design Form。

规则：

- Drawer 内表单优先使用 vertical layout。
- Label 必须清晰。
- 必填字段必须明确标识。
- Validation rules 必须明确。
- Submit buttons 位置保持一致。
- 提交过程中必须有 loading state。
- 防止重复提交。
- 成功和失败必须有反馈。
- 不要把 validation logic 分散写在多个组件内部。

TypeScript 项目中必须清晰定义：

- request types
- response types
- form types

复杂业务校验应放在可复用 schema 或 utility 文件中。

## 8. 视觉密度

默认使用紧凑的企业后台视觉密度。

推荐值：

- Page padding：24px
- Card gap：16px 或 24px
- Table size：`middle` 或 `small`
- Form control height：遵守 Ant Design 默认或 compact 模式
- Table row height：约 40-48px
- Normal content font size：14px

避免：

- 大面积留白
- 低密度信息展示
- 大型营销式标题
- 装饰性分区

对于传统 ERP / OA / 财务 / 库存 / 生产管理系统，应使用更紧凑布局。

## 9. Theme Token

使用 Ant Design token-based theming。

默认方向：

| Token | 方向 |
|---|---|
| Primary | Ant Design blue 或项目品牌色 |
| Success | green |
| Warning | orange / yellow |
| Error | red |
| Page background | light gray |
| Card background | white |
| Border radius | 中等，不要过度圆角 |
| Font size | 企业后台默认字号 |

不要在各页面中随意硬编码颜色。

如果需要自定义颜色，必须集中定义在 theme configuration 中。

## 10. 权限与 RBAC UI

页面实现必须考虑：

- Menu visibility
- Route access
- Button-level permissions
- Field-level read-only logic
- Operation confirmation
- Audit logging needs

权限判断不要硬编码分散在组件中。

优先使用：

- permission helpers
- permission hooks
- route metadata
- centralized guards

常见权限码示例：

- `user:view`
- `user:create`
- `user:update`
- `user:delete`
- `role:view`
- `role:create`
- `role:update`
- `role:delete`
- `system:config:update`

## 11. 项目级组件

构建大量页面前，应先创建或复用项目级组件。

推荐抽象：

- `AdminLayout`
- `PageHeader`
- `SearchForm`
- `AppTable`
- `FormDrawer`
- `StatusTag`
- `ConfirmAction`
- `PermissionGuard`
- `EmptyState`
- `ErrorState`

规则：

1. 不要在每个页面重复实现 table / search / form 模式。
2. 不要让每个页面直接堆 Ant Design 原始组件。
3. 重复模式必须封装为项目级组件。
4. 业务页面应只关注业务字段和业务动作。

## 12. 推荐前端目录结构

```text
src/
  app/
  layouts/
    AdminLayout.tsx
  components/
    PageHeader/
    SearchForm/
    AppTable/
    FormDrawer/
    StatusTag/
    ConfirmAction/
    PermissionGuard/
    EmptyState/
    ErrorState/
  pages/
    Dashboard/
    Applications/
    Roles/
    Directory/
    Sync/
    AuditLogs/
    Settings/
  services/
  hooks/
  types/
  utils/
  router/
  mocks/
```

如果项目后续形成成熟结构，遵守现有结构。不要无明确理由重构目录。

## 13. API 与数据请求 UI 规则

Server state 统一使用 TanStack Query 管理。

推荐模式：

```text
services/applications.ts
hooks/useApplications.ts
pages/Applications/index.tsx
```

列表页必须支持：

- pagination
- filters
- sorting
- loading state
- error state
- mutation 后 refresh

不要在 UI 组件中到处分散写 fetch calls。

## 14. Mock Data

如果后端 API 未准备好：

- 使用 mock services。
- mock data 必须放在 UI 组件外部。
- 不要在 page JSX 中硬编码大量数据。
- mock data shape 应尽量接近预期 backend DTO。
- mock-only code 必须有清晰标记。

## 15. 响应式规范

至少考虑：

- 1440px desktop
- 1280px laptop
- 768px tablet

若页面会被手机访问，还需考虑 375px mobile。

规则：

- Desktop：左侧 Sider 固定，表格信息完整展示。
- Laptop：保留 Sider，次要筛选项收起。
- Tablet：Sider 可折叠，表格保留关键列，详情进入 Drawer。
- Mobile：表单单列，触控目标不小于 44px，表格改为关键列或紧凑列表。

页面不得出现无意义水平滚动。

## 16. 可访问性

必须考虑：

- 所有交互控件支持键盘访问。
- `focus-visible` 清晰可见。
- 不使用 `outline: none` 且无替代焦点样式。
- 状态不只靠颜色表达，必须有文字或图标。
- 表单错误靠近对应字段。
- Modal / Drawer 打开后焦点进入容器，关闭后返回触发按钮。
- 危险操作有确认。
- 触控目标不小于 44px。
- 对比度满足 WCAG AA，正文 4.5:1，大字和 UI 组件 3:1。

## 17. 禁止或不推荐模式

除非业务明确要求，避免：

- 异形卡片
- 大量渐变背景
- 玻璃拟态
- 过度装饰性的 Dashboard
- 非标准悬浮操作按钮
- 高度定制化表格行
- 复杂动画
- 非常规导航模型
- 不必要的自定义 CSS 覆盖
- Ant Design Table 难以干净实现的表格布局
- 影响后台操作效率的大面积留白
- Purple / violet / indigo 渐变
- 三列 feature grid
- 装饰性图标圆圈
- 大 hero
- 营销式 slogan

## 18. Pencil 原型要求

Pencil 原型、截图和设计说明统一放在项目根目录 `/design`。

开始实现前端页面前必须：

1. 检查 `/design` 是否存在 Pencil 原型、截图或设计说明。
2. 遵守已确认的 Pencil 页面布局、组件结构、信息密度和交互方式。
3. 不在实现阶段自由重设计 UI。
4. 如果 Pencil 设计与 Ant Design 实现边界冲突，说明冲突点，并选择最接近 Ant Design 的可维护实现方式。
5. 原型未确认前，不直接开始前端页面开发，除非用户明确要求。

每个 Pencil 页面必须包含：

- 页面名称
- 页面用途
- Ant Design component mapping
- Table columns
- Filter fields
- Toolbar actions
- Row actions
- Drawer / Modal interactions
- Form fields
- Permission rules
- Loading / Empty / Error states
- Implementation notes

仅有截图不够，必须同时有实现说明。

## 19. Playwright 视觉 QA

条件允许时，使用 Playwright 做前端验证。

至少检查：

- 1440px desktop
- 1280px laptop
- 768px tablet

每个已实现页面应检查：

- Layout 是否符合 Pencil 原型
- Sidebar 行为是否正确
- Header 和 Breadcrumb 是否正确
- SearchForm 对齐是否正确
- Table columns 和 actions 是否可见
- Drawer 和 Modal 交互是否可用
- Empty / Loading / Error states 是否存在
- 浏览器 console 是否有明显错误

如果页面没有打开并做视觉检查，不应认为前端工作完成。

## 20. v0.1.0 Admin Console 设计注意

v0.1.0 的 UI 以“第三方系统接入闭环”为主线。

必须支撑：

- 飞书登录
- 首次平台管理员 bootstrap 状态
- 工作台接入进度
- 应用管理
- 应用接入向导
- 角色授权
- 组织与用户只读浏览
- 飞书同步中心
- 审计日志
- 无权限页
- 全局错误页

其中“应用接入向导”是 v0.1.0 的关键页面。它必须清晰区分：

- Agent Prompt：不包含真实 secret，只包含规范与环境变量占位符。
- `.env` 运行时配置：包含真实 secret，必须二次确认并写审计。

## 21. 设计完成定义

前端设计可进入实现前，必须满足：

1. `DESIGN.md` 已存在并被遵守。
2. `design/pencil-input-v0.1.0.md` 或对应版本输入文档已确认。
3. `/design` 下存在已确认 Pencil 原型或截图与说明。
4. 页面级说明包含组件映射、表格列、筛选项、操作、状态和权限规则。
5. 如需偏离本文件，必须说明原因并获得确认。

