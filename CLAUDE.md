# 项目 AI 开发规范

## 0. 项目与领域硬性规则

`feishu-iam` 是一个以飞书作为身份与组织数据源的 IAM 项目。

本项目必须遵守以下不可协商的领域规则：

- 飞书是组织结构和用户的唯一来源。
- 项目不得新增独立的 username / password 登录系统。
- 所有登录和认证流程都必须依赖飞书。
- 系统超级管理员身份仍必须绑定到飞书用户。
- 系统绑定一个专用的自建飞书应用。
- 所有飞书 API 权限都必须来自该专用自建飞书应用。
- 飞书应用凭证、tokens、导出的用户列表、同步快照不得提交到仓库。

项目沟通语言使用中文：

- 所有项目文档必须使用中文。
- 所有代码注释必须使用中文。
- 技术栈名称、组件名、目录名、权限码、API 术语保留英文。

当前仓库仍处于初始骨架阶段，尚未实现业务代码。

项目规则的来源优先级：

1. 用户在当前对话中的明确指令
2. 已确认的 Pencil 原型
3. 本 `AGENTS.md` / `CLAUDE.md`
4. `docs/` 下的项目文档
5. 现有实现代码
6. Ant Design 官方模式
7. 通用前端最佳实践

## 1. 项目类型

本项目是一个企业级 Admin Console / 后台管理系统。

前端 UI/UX 必须优先考虑：

- 高信息密度
- 操作效率
- 清晰的数据表格
- 一致的 CRUD 流程
- 符合中国国内企业中后台系统习惯的 UX
- 可维护性优先于视觉创意

本项目不是营销官网、落地页，也不是面向消费者的创意型 UI。

## 2. 默认前端技术栈

除非用户明确另有要求，前端默认使用以下技术栈：

- React
- TypeScript
- Vite
- Ant Design
- React Router
- TanStack Query
- Playwright

不要擅自引入其他 UI 框架。

不要混用 Ant Design 与其他组件体系，例如：

- Material UI
- Chakra UI
- shadcn/ui
- Arco Design
- Element Plus
- 自定义大型 Design System

除非有明确的书面理由，否则 UI 组件体系必须以 Ant Design 为主。

## 3. Pencil 原型是前端实现依据

对于前端 UI 开发，Pencil 原型是视觉和交互的主要依据。

本项目 Pencil 原型、截图和设计说明统一放在项目根目录下的 `/design` 目录。

开始实现前端页面之前，必须：

1. 优先检查 `/design` 目录下是否存在 Pencil 原型、截图或设计说明。
2. 遵守已确认的 Pencil 页面布局、组件结构、信息密度和交互方式。
3. 不要在实现阶段自由重设计 UI。
4. 如果 Pencil 设计与 Ant Design 实现边界冲突，需要说明冲突点，并选择最接近 Ant Design 的可维护实现方式。
5. 除非用户明确要求，否则不要在原型未确认前直接开始前端页面开发。

Pencil 应被视为 Ant Design 兼容的页面蓝图，而不是自由视觉创意画板。

## 4. Ant Design 组件实现边界

所有 UI 元素应优先使用 Ant Design 组件实现。

推荐组件映射关系：

| UI 模式 | Ant Design 组件 |
|---|---|
| 应用整体布局 | Layout |
| 左侧导航 | Layout.Sider + Menu |
| 顶部栏 | Layout.Header |
| 面包屑 | Breadcrumb |
| 页面标题区 | 自定义 PageHeader wrapper |
| 指标卡片 | Card + Statistic |
| 数据表格 | Table |
| 查询筛选区 | Form + Input + Select + DatePicker |
| 新增 / 编辑面板 | Drawer + Form |
| 确认操作 | Modal / Popconfirm |
| 状态展示 | Tag / Badge |
| 详情展示 | Descriptions |
| Tab 页面 | Tabs |
| 分步流程 | Steps |
| 上传 | Upload |
| 树形选择 | Tree / TreeSelect |
| 日期范围 | DatePicker.RangePicker |
| 权限选择 | Tree / Checkbox.Group |

如果 Ant Design 已经有合适组件，不要优先编写大量自定义 CSS 或自定义组件。

## 5. 禁止或不推荐的 UI 模式

除非业务明确要求，避免以下设计和实现：

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

UI 应该像专业的企业后台系统，而不是 Dribbble 风格概念设计稿。

## 6. 标准列表页结构

所有 CRUD 列表页默认必须遵循以下结构，除非业务明确要求不同：

1. 页面标题 / Breadcrumb 区域
2. 查询筛选表单
3. 操作工具栏
4. 数据表格
5. 分页

标准结构示例：

- PageHeader
- SearchForm：
  - Keyword Input
  - Status Select
  - Type Select
  - Date Range Picker
  - Search Button
  - Reset Button
  - Advanced Filters 展开 / 收起
- Toolbar：
  - Primary Create Button
  - Batch Actions
  - Export / Import Actions
- Table：
  - 支持 rowSelection
  - 状态字段使用 Tag 或 Badge
  - 必要时固定右侧操作列
  - 支持 pagination

不要把核心 CRUD 列表页设计成卡片网格，除非业务场景明确需要。

## 7. 查询表单规范

查询 / 筛选区域必须符合企业后台习惯：

- 使用 Ant Design Form。
- 优先采用紧凑的 horizontal 或 grid 布局。
- 默认展示 3-4 个核心筛选项。
- 筛选项过多时，次要条件放入展开 / 收起区域。
- Search 和 Reset 按钮位置保持一致。
- 避免复杂的侧边筛选器，除非业务明确需要。
- 筛选区域应靠近其控制的数据表格。

推荐控件：

- Input
- Select
- DatePicker
- DatePicker.RangePicker
- TreeSelect
- Cascader
- Checkbox
- Radio
- Switch

## 8. 表格规范

Table 是本项目最核心的前端组件。

所有数据列表页必须使用 Ant Design Table。

推荐使用的 Table 能力：

- columns
- dataSource
- rowKey
- pagination
- loading
- rowSelection
- sorter
- filters
- fixed action column
- expandable rows
- scroll

默认避免：

- 合并单元格
- 深层嵌套表格
- 高度自定义 row rendering
- 在表格单元格中嵌入复杂表单
- drag sorting + virtual scroll + fixed columns 的复杂组合
- 无限层级 Tree Table
- 非标准 row actions

每个 Table 应有清晰的 columns 定义，不要把大量业务逻辑直接塞进 JSX。

## 9. 新增 / 编辑 / 详情交互规范

Admin Console 默认采用以下交互模式：

| 场景 | 推荐模式 |
|---|---|
| 简单新增 | Drawer + Form |
| 简单编辑 | Drawer + Form |
| 详情查看 | Drawer + Descriptions |
| 删除 | Popconfirm 或 Modal |
| 启用 / 禁用 | Popconfirm 或 Modal |
| 批量操作 | Modal confirmation |
| 多字段复杂表单 | Full page form |
| 多步骤流程 | Steps + full page |
| 复杂配置 | Full page 或 Tabs |

新增和编辑操作通常应打开右侧 Drawer。

只有在以下情况才优先使用 Full page form：

- 字段很多
- 表单包含多个分组
- 流程包含多个步骤
- 用户需要专注处理复杂任务
- 数据模型不适合放入 Drawer

## 10. 表单规范

业务表单统一使用 Ant Design Form。

表单规则：

- Drawer 内表单优先使用 vertical layout。
- Label 必须清晰。
- 必填字段必须明确标识。
- Validation rules 必须明确。
- Submit buttons 位置保持一致。
- 提交过程中必须有 loading state。
- 防止重复提交。
- 成功和失败必须有反馈。
- 不要把 validation logic 分散写在多个组件内部。

TypeScript 项目中，必须清晰定义 request、response 和 form types。

复杂业务校验应放在可复用 schema 或 utility 文件中。

## 11. 视觉密度规范

使用紧凑的企业后台视觉密度。

默认建议：

- Page padding：24px
- Card gap：16px 或 24px
- Table size：middle 或 small
- Form control height：遵守 Ant Design 默认或 compact 模式
- Table row height：约 40-48px
- Normal content font size：14px
- 避免大面积留白
- 优先保证一屏内操作效率

对于传统 ERP / OA / 财务 / 库存 / 生产管理系统，应使用更紧凑布局。

对于 SaaS Dashboard，可以适当增加留白。

## 12. Theme Token 规范

使用 Ant Design token-based theming。

默认主题方向：

- Primary color：Ant Design blue 或项目品牌色
- Success：green
- Warning：orange / yellow
- Error：red
- Page background：light gray
- Card background：white
- Border radius：中等，不要过度圆角
- Font size：企业后台默认字号

不要在各页面中随意硬编码颜色。

如果需要自定义颜色，必须集中定义在 theme configuration 中。

## 13. 必须考虑的 UI 状态

每个主要页面都应考虑以下状态：

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

不要只实现理想情况下的 happy path。

## 14. 权限与 RBAC 规范

Admin Console 通常涉及权限控制。

实现页面时必须考虑：

- Menu visibility
- Route access
- Button-level permissions
- Field-level read-only logic
- Operation confirmation
- Audit logging needs

常见权限码示例：

- user:view
- user:create
- user:update
- user:delete
- role:view
- role:create
- role:update
- role:delete
- system:config:update

不要把权限判断硬编码分散在大量组件中。

优先使用集中的 permission helpers、hooks 或 route metadata。

## 15. 项目级组件抽象

在构建大量页面之前，应先创建或复用项目级组件。

推荐抽象：

- AdminLayout
- PageHeader
- SearchForm
- AppTable
- FormDrawer
- StatusTag
- ConfirmAction
- PermissionGuard
- EmptyState
- ErrorState

规则：

1. 不要在每个页面重复实现 table / search / form 模式。
2. 不要让每个页面都直接堆 Ant Design 原始组件。
3. 重复模式必须封装为项目级组件。
4. 业务页面应只关注业务字段和业务动作。

## 16. 推荐前端目录结构

建议使用类似以下结构：

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
  pages/
    Dashboard/
    Users/
    Roles/
    Permissions/
    AuditLogs/
    Settings/
  services/
  hooks/
  types/
  utils/
  router/
  mocks/
```

如果项目已经有成熟结构，可以遵守现有结构。

不要在没有明确要求的情况下重构已有成熟项目目录。

## 17. API 与数据请求规范

Server state 统一使用 TanStack Query 管理。

不要在 UI 组件中到处分散写 fetch calls。

推荐模式：

- `services/` 存放 API functions
- `hooks/` 存放 query 和 mutation hooks
- `pages/` 消费 hooks
- `components/` 尽量通过 props 接收数据

示例结构：

```text
services/users.ts
hooks/useUsers.ts
pages/Users/index.tsx
```

列表页必须支持：

- pagination
- filters
- sorting
- loading state
- error state
- mutation 后 refresh

## 18. Mock Data 规范

如果后端 API 尚未准备好：

- 使用 mock services。
- mock data 必须放在 UI 组件外部。
- 不要在 page JSX 中硬编码大量数据。
- mock data shape 应尽量接近预期 backend DTO。
- mock-only code 必须有清晰标记。

## 19. Playwright 视觉 QA

条件允许时，使用 Playwright 进行前端验证。

至少检查：

- 1440px desktop
- 1280px laptop
- 768px tablet，若相关

每个已实现页面都应检查：

- Layout 是否符合 Pencil 原型
- Sidebar 行为是否正确
- Header 和 Breadcrumb 是否正确
- SearchForm 对齐是否正确
- Table columns 和 actions 是否可见
- Drawer 和 Modal 交互是否可用
- Empty / Loading / Error states 是否存在
- 浏览器 console 是否有明显错误

如果页面没有打开并进行视觉检查，不应认为前端工作已经完成。

## 20. Pencil 原型输出要求

创建或评审 Pencil 原型时，每个页面应包含：

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

仅有截图是不够的，必须同时有实现说明。

## 21. Codex / Agent 行为规范

在本项目中工作时：

1. 修改代码前先阅读 AGENTS.md 和 CLAUDE.md。
2. 遵守 Ant Design-compatible patterns。
3. 不要擅自引入新的设计语言。
4. 不要在实现阶段重设计已确认的 Pencil 原型。
5. 企业后台稳定 UX 优先于视觉创意。
6. 代码必须模块化，并保持 TypeScript 类型清晰。
7. 优先复用项目级组件。
8. 避免大型一次性页面组件。
9. API logic 必须与 UI 分离。
10. 条件允许时使用 Playwright 验证 UI。
11. 如需偏离原型或本规范，必须明确说明原因。

## 22. 冲突处理优先级

当规则冲突时，按以下顺序处理：

1. 用户明确指令
2. 已确认的 Pencil 原型
3. 本项目开发规范
4. 现有项目约定
5. Ant Design 官方模式
6. 通用前端最佳实践

不要静默忽略冲突。必须说明取舍，并选择更可维护的方案。

## 23. Admin Console UX 原则

最终 UI 应服务于每天高频使用系统的真实业务操作人员。

优先考虑：

- 快速扫读
- 操作清晰
- 布局可预测
- 表格可靠
- 表单高效
- 权限明确
- 错误可恢复
- CRUD 流程一致

避免：

- 装饰性复杂度
- 低密度布局
- 页面结构不一致
- 关键操作隐藏过深
- 组件过度自定义
- 非标准交互

End of guidelines.
