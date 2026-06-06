# Feishu IAM v0.10.1 管理后台 UI/UX 一致性修复规划

日期：2026-05-25
状态：PLANNED

## 1. 版本定位

`v0.10.1` 是 `v0.10.0` 之后的管理后台 UI/UX 一致性修复版本，不新增后端权限模型、不扩展 SSO 协议、不改部署拓扑。

本版本目标是把 `v0.10.0` 已经建立的 react-router + shadcn/ui + tweakcn + Tailwind 运行时真正扩展到全部后台模块，并修复生产截图中暴露出的壳层、表格、抽屉和导航体验问题。

一句话边界：

```text
v0.10.1 = 全后台 UI/UX 收口补丁：壳层固定、菜单可收缩、面包屑通用、详情 Sheet 可扩展、剩余旧模块迁移。
```

## 2. 当前事实

已确认：

- `应用管理` 和 `记录查询` 相对符合 `DESIGN.md` 的新规范，已经使用 `components/admin/*`、`components/ui/*`、Tailwind 和 shadcn 风格组件。
- `工作台`、`权限管理`、`管理员授权`、`系统设置` 仍大量依赖旧 `App.css`、旧 `admin-page` / `panel` / `application-detail-drawer` 类和旧交互结构。
- `DetailSheet` 当前固定为右侧窄抽屉，缺少“扩展到更宽工作区”的模式。
- `AppShell` 当前左侧菜单不可收缩，桌面端菜单会随页面滚动语义混在同一个文档流里，缺少独立滚动容器。
- 当前页面没有通用面包屑能力，模块之间的层级、详情上下文和返回路径表达不稳定。

## 3. 截图暴露的问题清单

### 3.1 权限管理页面内容居中且右侧常驻详情

问题：

- 中间主内容在宽屏下不是与主展示区域满屏对齐，而是呈现旧版居中布局。
- 角色详情使用旧 `application-detail-drawer` 常驻固定层，视觉和交互都与新 `DetailSheet` 不一致。
- 详情打开后缺少遮罩、宽度模式、URL 深链和统一关闭行为。

修复方向：

- 权限管理迁移为新资源页：`PageHeader -> FilterBar/Toolbar -> DataTable -> DetailSheet`。
- 默认页面只展示应用筛选、角色表格、分页和主操作；点击行内 `详情` 后打开角色详情 Sheet。
- 角色详情 Sheet 内继续承载编辑角色、绑定权限组、绑定成员、启停角色和审计提示。

### 3.2 记录查询表格状态标签换行

问题：

- “成功”等短状态标签被压成两行，影响扫读。
- 表格列宽、badge `white-space` 和单元格最小宽度没有形成稳定约束。

修复方向：

- `StatusBadge` 默认 `whitespace-nowrap`、`shrink-0`，短状态标签不换行。
- `DataTable` 支持列级 `minWidth` / `width` / `nowrap` 或等价 class 约束。
- 记录查询 `结果`、`操作`、`时间` 列使用稳定宽度；长文本列继续允许换行或截断。

### 3.3 工作台仍是旧 dashboard 交互

问题：

- 工作台采用居中卡片和快捷入口堆叠，和当前规范里的“从列表页面向下穿透到明细”不一致。
- 风险、健康、同步状态和快捷入口没有形成可操作清单。
- 页面在宽屏下视觉重心漂移，缺少与应用管理、记录查询一致的 header、toolbar 和表格/清单结构。

修复方向：

- 工作台改为运营清单型首页：风险队列、近期同步、系统健康、最近审计和待处理配置以列表或表格呈现。
- 快捷入口从大按钮改为紧凑 toolbar 或行内操作。
- 点击风险或记录时跳转到对应模块，并带 query 打开详情 Sheet。

## 4. 新增通用 UI/UX 规则

### 4.1 AppShell 固定壳层

- 桌面端左侧菜单固定在 viewport 内，高度为 `100dvh`。
- 顶部登录人栏固定在内容区域顶部。
- 只有主内容区域滚动；左侧菜单有自己的滚动容器。
- 窄屏仍使用移动端 Sheet 导航。

### 4.2 左侧菜单收缩与展开

- 桌面端提供菜单收缩按钮。
- 展开宽度保留当前 `260px` 量级；收缩宽度使用图标栏，不展示长文本。
- 收缩状态下菜单项必须有 tooltip 或可访问标签。
- 收缩状态应保存在 localStorage，不进入 URL。
- 窄屏不显示桌面收缩按钮，继续使用移动端菜单。

### 4.3 通用面包屑

- 在 `PageHeader` 中支持统一 `breadcrumbs`。
- 一级模块显示为 `后台 / 模块名`。
- 打开详情 Sheet 时可以显示 `后台 / 模块名 / 资源名`，但不强制把详情变成独立页面。
- 从其他模块跳转并带资源上下文时，面包屑要表达来源或目标上下文，不能只靠标题。

### 4.4 详情 Sheet 宽度模式

- `DetailSheet` 支持 `normal`、`wide`、`full` 三档宽度。
- Sheet header 右侧提供宽度切换按钮，使用图标按钮并带 tooltip。
- 默认仍为右侧详情抽屉；复杂编辑、权限绑定、长 JSON、审计 diff 可切到更宽模式。
- `full` 模式不是新页面，仍保留 Sheet 关闭、Esc、焦点管理和返回列表上下文。
- 宽度模式只保存在当前打开状态或 localStorage，不污染资源 URL。

### 4.5 剩余模块迁移要求

`工作台`、`权限管理`、`管理员授权`、`系统设置` 必须迁移到：

- `components/admin/AppShell`
- `components/admin/PageHeader`
- `components/admin/DataTable`
- `components/admin/FilterBar`
- `components/admin/DetailSheet`
- `components/admin/FormDialog`
- `components/admin/ConfirmDialog`
- `components/admin/PageState`
- `components/admin/StatusBadge`

迁移后，相关页面不应再依赖旧 `application-detail-drawer`、`admin-page`、`panel`、`module-header`、`status-badge-*` 等旧 CSS 作为主视觉结构。

## 5. 设计评审修正要求

本节是 `v0.10.1` 进入工程评审前必须补齐的设计门禁。当前规划方向正确，但仍偏任务清单，缺少足够具体的页面蓝图、状态矩阵和交互决策。工程评审前必须先把以下内容补入计划或拆成独立实施输入。

### 5.1 设计完整度评分

| 维度 | 当前评分 | 主要缺口 | 达到 10 分需要补齐 |
|---|---:|---|---|
| 信息架构 | 6/10 | 已列出四个旧模块要迁移，但没有定义每个模块首屏层级、表格列、筛选项、主操作和详情入口。 | 为 `工作台`、`权限管理`、`管理员授权`、`系统设置` 各补一张页面结构蓝图和主路径。 |
| 交互状态覆盖 | 5/10 | 有总体验收项，但没有按组件和模块列出 loading、empty、error、no permission、validation、partial states。 | 增加状态矩阵，覆盖 AppShell、DataTable、DetailSheet、FormDialog、每个迁移模块。 |
| 用户旅程 | 6/10 | 计划强调“清单 -> 详情”，但没有定义跨模块跳转、关闭详情、宽度切换、返回列表时用户如何保持上下文。 | 增加用户旅程表，覆盖 5 秒识别、5 分钟高频操作、长期信任。 |
| AI slop 风险 | 8/10 | 已明确反对 dashboard 卡片堆叠和营销化 UI，但工作台“运营清单”仍不够具体。 | 明确工作台首屏只允许风险队列、系统健康、最近同步、最近审计四类工作信息，不做装饰型指标墙。 |
| 设计系统对齐 | 7/10 | 已要求使用 `components/admin/*`，但没有列出新增/修改 wrapper 的 API 形态。 | 给出 `AppShell`、`PageHeader`、`DetailSheet`、`DataTable`、`StatusBadge` 的接口级设计约束。 |
| 响应式与可访问性 | 5/10 | 只有视口验收，没有键盘、焦点恢复、屏幕阅读、触控目标、窄屏列策略。 | 增加响应式和可访问性验收表。 |
| 未决设计决策 | 5/10 | Sheet `full`、菜单收缩、系统设置是否需要详情 Sheet、工作台是否允许指标卡片等仍有解释空间。 | 明确推荐选项和延后项，避免实现阶段自行解释。 |

综合判断：本节记录的是设计初评状态。后续已通过 Pencil 增量原型和 `/plan-design-review` 复审补齐关键交互，当前可进入工程评审；工程实现仍必须按第 10 节切成小切片后再写 `IMPLEMENTATION_PLAN.md`。

### 5.2 必须补齐的信息架构蓝图

工程评审前，每个迁移模块都必须按以下格式补齐页面蓝图：

```text
PageHeader：标题、说明、面包屑、主操作
FilterBar：筛选字段、重置、查询、次要筛选收纳方式
DataTable/List：列、默认排序、状态列、操作列、长文本策略
DetailSheet/Dialog：打开条件、宽度默认值、可切换宽度、关闭后保留状态
ConfirmDialog：危险操作、审计提示、提交中、失败恢复
URL 状态：筛选、分页、tab、detail id 是否进入 query
```

四个模块最低蓝图如下。

#### 工作台

- 首屏顺序：`风险队列` -> `系统健康` -> `最近飞书同步` -> `最近审计事件`。
- 风险队列必须是可操作清单，不是展示卡片；每条风险包含级别、来源、建议动作和跳转目标。
- 系统健康只显示 API、数据库、版本、有效用户四个必要项，避免扩成低密度指标墙。
- 最近同步和最近审计使用紧凑列表或表格；点击行进入 `记录查询` 并带 query。
- 快捷入口只作为 secondary toolbar，不作为大按钮卡片区域。

#### 权限管理

- 默认显示应用筛选、角色表格和创建角色按钮。
- 角色表格列至少包含：角色名称、角色 key、状态、权限组数量、成员数量、更新时间、操作。
- 应用选择优先使用筛选控件或紧凑列表，不再使用宽屏左侧卡片选择器占据主视觉。
- 点击角色详情打开 `DetailSheet`，默认 `normal`，复杂绑定区域允许切到 `wide/full`。
- 绑定权限组和绑定成员必须有独立状态：搜索中、无结果、保存中、保存失败、权限不足。

#### 管理员授权

- 默认显示管理员授权表格、搜索、角色筛选、状态筛选、新增入口。
- 表格列至少包含：管理员、飞书 user_id、角色、应用范围、状态、最近更新、操作。
- 新增管理员使用 `FormDialog` 或 `DetailSheet`，但编辑详情统一使用 `DetailSheet`。
- 历史只读角色只展示稳定说明，不出现可点击但无效的编辑按钮。
- 启用/停用必须通过 `ConfirmDialog`，文案说明审计追踪结果。

#### 系统设置

- 页面结构为设置清单 + 当前设置详情工作区，不能再依赖旧 `panel` 结构。
- `飞书同步` 是默认设置项，包含配置状态、字段诊断、同步动作、同步历史。
- 同步历史使用 `DataTable`；单条同步记录可以打开 `DetailSheet` 查看错误码、耗时、计数和 request id。
- `系统运行` 展示 API health、DB ready、运行状态和必要排障入口。
- `版本信息` 展示版本、镜像、部署入口、升级方式和文档链接，不展示明文 secret。

### 5.3 必须补齐的通用组件接口约束

#### AppShell

- 支持 `expanded` / `collapsed` 两种桌面状态。
- 收缩状态持久化到 localStorage，不能进入 URL。
- 桌面菜单固定 `100dvh`，主内容独立滚动。
- 收缩状态下 nav item 只显示图标，但必须保留 tooltip、`aria-label`、`aria-current`。
- 移动端继续使用导航 Sheet，不显示桌面收缩按钮。

#### PageHeader

- 支持 `breadcrumbs`，类型至少包含 `label`、`href?`、`current?`。
- 支持 `primaryAction`、`secondaryActions`、`badges`。
- 标题区不承担筛选职责，筛选统一进入 `FilterBar`。
- 六个一级模块统一展示 `后台 / 模块名`。

#### DetailSheet

- 宽度模式为 `normal`、`wide`、`full`。
- 默认宽度由调用方指定；资源详情默认 `normal`，复杂编辑可以默认 `wide`。
- Header 内提供宽度切换按钮，使用 lucide 图标和 tooltip。
- 宽度切换不能重挂载 children，不能丢失表单草稿。
- 关闭后焦点返回触发按钮，列表筛选、分页、排序和滚动位置保留。
- `full` 仍是 Sheet，不是路由页；Esc 和关闭按钮语义保持一致。

#### DataTable / StatusBadge

- `StatusBadge` 默认 `whitespace-nowrap`，短中文状态不得换行。
- `DataTableColumn` 支持 `width`、`minWidth`、`nowrap` 或等价 class。
- 状态列、时间列、操作列必须稳定宽度。
- 长文本列必须定义 `break-all`、截断、tooltip 或复制策略。
- 表格必须支持 loading、empty、error、no permission；不能只在页面外层处理。

### 5.4 必须补齐的状态矩阵

工程评审前必须至少补齐以下状态矩阵：

| 功能区域 | Loading | Empty | Error | No permission | Validation | Partial |
|---|---|---|---|---|---|---|
| AppShell | 当前用户读取中，显示最小壳层 | 不适用 | 身份读取失败进入登录失败页 | 无后台权限显示稳定拒绝页 | 不适用 | API 状态失败但导航仍可用 |
| 工作台风险队列 | Skeleton 列表 | 暂无风险，给出查看记录入口 | 风险来源读取失败，允许重试 | 无记录权限时隐藏最近审计 | 不适用 | 部分来源失败时保留可用分区 |
| 权限管理角色表 | 表格 skeleton | 当前应用暂无角色，显示创建角色入口 | 角色读取失败，保留应用筛选 | 无应用权限时显示 `PageState` | 创建/编辑角色字段错误贴近字段 | 权限组或成员详情缺失时提示刷新 |
| 管理员授权表 | 表格 skeleton | 暂无管理员，显示新增入口 | 授权读取失败，允许重试 | 非平台管理员显示拒绝页 | 新增/编辑字段错误贴近字段 | 部分应用范围读取失败时禁用提交 |
| 系统设置同步历史 | 表格 skeleton | 暂无同步记录，显示触发同步入口 | 同步记录读取失败，允许重试 | 无同步权限时禁用触发同步 | 不适用 | 字段诊断失败但历史仍可看 |
| DetailSheet | 内容 skeleton | 当前资源不存在，提示返回列表 | 详情读取失败，保留关闭按钮 | 无详情权限显示拒绝态 | 表单字段错误贴近字段 | 部分 tab 失败不阻断其他 tab |

### 5.5 响应式和可访问性门禁

- 1440px：Sidebar 展开或收缩均可用，主表格不被抽屉永久挤压。
- 1280px：筛选区次要字段可折叠，操作列稳定。
- 768px：Sidebar 可折叠，详情 Sheet 默认接近全宽，表格保留关键列。
- 390px：移动导航 Sheet 可用，表格进入横向滚动或紧凑列表，所有触控目标不小于 44px。
- 键盘：菜单收缩按钮、导航、筛选、表格操作、Sheet 宽度按钮、关闭按钮、Dialog 主次按钮都可 Tab 到达。
- 焦点：Sheet/Dialog 打开后焦点进入容器，关闭后回到触发按钮。
- 屏幕阅读：收缩导航、状态 badge、图标按钮必须有可理解的 accessible name。
- 对比度：正文满足 4.5:1；状态 badge 不能只靠颜色表达。

### 5.6 未决设计决策的推荐结论

| 决策 | 推荐结论 | 不采用的风险 |
|---|---|---|
| 是否需要 Pencil 增量原型 | 需要，但只做窄范围增量，不重画全后台。 | 直接进入实现会让 AppShell、Sheet 宽度和工作台信息架构继续靠工程师临场解释。 |
| Pencil 增量原型覆盖范围 | 只覆盖四张：AppShell 展开/收缩、DetailSheet normal/wide/full、权限管理角色表 + 详情、工作台运营清单。 | 全量重画成本过高；完全不画又无法验证关键交互。 |
| `DetailSheet full` 是否变成详情页 | 不变成详情页，仍是 Sheet 宽度模式。 | 变成详情页会破坏“关闭后回到清单上下文”的项目主范式。 |
| 工作台是否保留指标卡片 | 只保留必要健康摘要，不做 dashboard 卡片墙。 | 会回到旧 dashboard 风格，和后台工作台任务导向冲突。 |
| 系统设置是否强套表格详情 | 不强套资源列表；采用设置项清单 + 当前设置详情，但同步历史使用表格和 Sheet。 | 全部强套表格会让系统配置类页面变别扭，降低操作效率。 |
| 菜单收缩状态是否进入 URL | 不进入 URL，使用 localStorage。 | URL 状态会污染业务深链，复制链接时带入个人偏好。 |

### 5.7 进入工程评审前的修改清单

- [x] 把 5.2 的四个模块蓝图细化到字段、列、操作和 URL query 级别。
- [x] 把 5.3 的通用组件接口约束转成工程可评审的 props/API 草案。
- [x] 把 5.4 状态矩阵扩展为实施计划中的验收清单。
- [x] 在 `design/` 中补一个 `v0.10.1` 增量原型或说明文件，覆盖 AppShell、DetailSheet、权限管理和工作台关键状态。
- [x] 明确 `v0.10.1` 只做 UI/UX 收口；真实生产数据 QA 和细节补丁可以进入 `v0.10.2`，不要挤进本版本。

## 6. 实施任务

### Task 0：基线确认

- 记录当前生产截图问题，覆盖权限管理、记录查询、工作台、管理员授权、系统设置。
- 运行 `git status --short`，确认不覆盖用户已有修改。
- 对照 `DESIGN.md`、`AGENTS.md` 和 `v0.10.0` 第一可信切片文档，确认本版本只做 UI/UX 收口。

验收：

- 有清晰问题清单。
- 不新增后端版本 DDL。
- 不改 SSO、飞书同步或部署边界。

### Task 1：AppShell 固定布局和可收缩菜单

- 重构 `components/admin/AppShell` 为固定壳层。
- 增加桌面端菜单收缩/展开按钮。
- 增加收缩状态 tooltip 和无障碍标签。
- 确认主内容滚动时左侧菜单和顶部栏不随内容滚走。

验收：

- 1440、1280、768、390 视口下导航可用。
- 桌面端菜单展开/收缩状态稳定。
- 主内容滚动时左侧菜单保持固定。

### Task 2：PageHeader 面包屑通用化

- 扩展 `PageHeader` 支持 breadcrumbs。
- 应用管理、记录查询先接入，确保不回退现有新页面。
- 工作台、权限管理、管理员授权、系统设置迁移时统一接入。

验收：

- 六个一级模块都显示一致面包屑。
- 打开详情 Sheet 或从其他模块带上下文跳转时，标题和面包屑不冲突。

### Task 3：DetailSheet 宽度模式

- 扩展 `DetailSheet` 支持 `normal`、`wide`、`full`。
- 增加宽度切换图标按钮和 tooltip。
- 应用管理、记录查询、权限管理、管理员授权都复用同一个 `DetailSheet`。
- 宽度切换不丢失表单输入和当前详情上下文。

验收：

- 常规详情默认右侧抽屉。
- 复杂详情可切到更宽空间。
- 关闭后回到原列表状态，筛选、分页和排序不丢失。

### Task 4：DataTable 和 StatusBadge 稳定列宽

- `StatusBadge` 增加不换行约束。
- `DataTable` 支持列级宽度和 nowrap 约束。
- 记录查询修复 `结果` 标签换行。
- 操作列、时间列、状态列采用稳定宽度，长 request id、target、actor 继续可换行或复制。

验收：

- “成功”“失败”“启用”“停用”等状态标签不再换行。
- 表格不会因长文本撑破布局。
- 操作列按钮不被挤压变形。

### Task 5：权限管理迁移

- 权限管理改为新资源页结构。
- 应用选择从左侧卡片式选择迁移为筛选控件或紧凑列表，不再让主内容居中漂移。
- 角色列表用 `DataTable`，角色详情用 `DetailSheet`。
- 创建角色使用 `FormDialog`。
- 绑定权限组、绑定成员继续使用 Dialog 或 Sheet 内分区，必须有提交中和错误状态。

验收：

- 默认进入权限管理时只看到清单和筛选，不自动占用右侧详情空间。
- 点击角色详情后打开 Sheet。
- 角色编辑、启停、绑定权限组、绑定成员可用。

### Task 6：管理员授权迁移

- 管理员授权列表迁移为 `DataTable + FilterBar + DetailSheet/FormDialog`。
- 新增管理员、编辑授权、启停管理员使用统一 Dialog/Sheet/ConfirmDialog。
- 历史只读角色保留稳定提示，不让按钮静默失败。

验收：

- 默认只展示管理员清单、筛选、分页和新增入口。
- 点击详情或编辑后进入 Sheet，不使用旧固定抽屉。
- 权限不足状态使用 `PageState`。

### Task 7：系统设置迁移

- 系统设置从旧左右布局迁移为新设置清单页。
- 飞书同步、系统运行、版本信息保持现有功能，但使用 `PageHeader`、`DataTable`、`DetailSheet`、`ConfirmDialog`。
- 同步历史长列表使用表格，单条同步记录可打开详情 Sheet。

验收：

- 触发同步确认、运行中、失败、成功状态清晰。
- 字段诊断和同步历史不撑破布局。
- 不展示明文 secret、token、cookie 或敏感凭证。

### Task 8：工作台重构

- 工作台改为运营清单，而不是展示型 dashboard。
- 风险队列、系统健康、最近同步、近期审计以可操作列表呈现。
- 工作台跳转到应用管理、记录查询、系统设置时带 query 上下文，目标页可打开对应详情或保留筛选。

验收：

- 工作台不再是居中卡片堆叠。
- 每个风险项都有明确下一步。
- 跳转后上下文可追溯。

### Task 9：旧 CSS 清理

- 清理剩余旧页面主结构 CSS 使用点。
- 保留必要兼容样式前必须注明原因。
- 搜索并消除新页面对旧结构类的依赖。

重点搜索：

```bash
rg -n "application-detail-drawer|admin-page|module-header|panel|status-badge-" apps/admin-web/src
```

验收：

- 六个一级模块不再使用旧抽屉和旧页面结构作为主实现。
- `App.css` 只保留确有必要的过渡样式，或进一步收敛到 Tailwind / component classes。

### Task 10：验证和发布准备

- 运行 `pnpm check`。
- 运行 `pnpm --filter @feishu-iam/admin-web build`。
- 运行响应式溢出检查。
- 使用 Browser 打开本地 `http://localhost:3000/` 做真实浏览器自检。
- 有条件时使用生产登录态检查 `http://feishu-iam.dev.tangtring.com/admin/...` 六个模块。

验收：

- 浏览器 console 无非预期错误。
- Network 无非预期失败请求。
- 六个一级模块在桌面和窄屏可用。
- 表格、筛选、详情 Sheet、Dialog、分页、导航、面包屑、菜单收缩都通过人工检查。

## 7. 非目标

`v0.10.1` 不做：

- 新增完整 OIDC、refresh token、SAML、ABAC 或资源级权限。
- 飞书角色同步或飞书用户组同步。
- 新增数据库 DDL，除非实现中发现前端无法表达已有业务契约且必须补 API 字段。
- HTTPS、反向代理、高可用、滚动升级。
- 大型视觉换皮或营销化 dashboard。
- 重新引入 Ant Design、MUI、Chakra、Arco、Element Plus 或 Bootstrap。

## 8. 完成标准

版本完成时必须满足：

- README 记录 `v0.10.1` 版本边界、镜像 tag、digest 和相关文档索引。
- `package.json` / `/version` 返回 `0.10.1`。
- 生产镜像发布到 `dockerhub.it.tangtring.com:80/ai/feishu-iam:v0.10.1`。
- 远端 `192.168.2.112:~/feishu-iam` 停机升级验证通过。
- `http://feishu-iam.dev.tangtring.com/admin/workspace`、`/admin/applications`、`/admin/permissions`、`/admin/admins`、`/admin/records`、`/admin/settings` 都完成浏览器自检。
- 会话归档记录实现、验证和剩余风险。

## 9. 风险和控制

- 风险：一次性迁移四个旧模块可能影响既有后台操作。
  - 控制：先落通用壳层和组件，再逐模块迁移；应用管理和记录查询作为回归样板。
- 风险：全屏 Sheet 如果实现成新页面，会破坏“清单 -> 详情”上下文。
  - 控制：宽度模式只改变 Sheet 尺寸，不改变路由范式。
- 风险：旧 CSS 清理过猛导致未迁移细节回退。
  - 控制：每个模块迁移后再删除对应旧类，删除前用 `rg` 确认引用范围。
- 风险：生产真实数据包含长 app_key、request id、URL、描述和 JSON，容易再次撑破布局。
  - 控制：浏览器自检必须覆盖真实生产数据页面，并保留长文本列策略。

## 10. 工程评审锁定结论

本节是 `gstack /plan-eng-review` 对 `v0.10.1` 的工程锁定结论。它不改变版本边界：仍只做管理后台 UI/UX 收口，不新增后端权限模型、数据库 DDL、SSO 协议或部署拓扑。

### 10.1 范围挑战结论

完整 `v0.10.1` 不能作为一个 autopilot 执行切片。它至少会触达 `apps/admin-web/src/components/admin/*`、`apps/admin-web/src/routes/*`、`apps/admin-web/src/features/*`、`apps/admin-web/src/App.tsx`、`apps/admin-web/src/App.css`、测试文件、README、版本文件和部署材料，超过 8 个文件，也跨通用组件和四个模块迁移。

工程上采用以下降维：

1. 第一条垂直切片只做共享基础和既有新页面回归：`AppShell` 固定/收缩、`PageHeader` 面包屑、`DetailSheet` 三档宽度、`DataTable`/`StatusBadge` 列宽稳定，并让 `记录查询` 和 `应用管理` 两个已迁移页面继续通过。
2. 第一切片完成后，再把 `权限管理`、`管理员授权`、`系统设置`、`工作台` 拆成 subagent-driven 的并行模块切片。
3. 旧 CSS 清理和版本发布必须放在所有模块迁移之后，不能在任一模块迁移前大面积删除。

### 10.2 组件 API 锁定

#### AppShell

```ts
type AppShellNavItem = {
  href: string;
  label: string;
  icon: ReactNode;
  active: boolean;
  disabled?: boolean;
  ariaLabel?: string;
};

type AppShellProps = {
  brand: ReactNode;
  navItems: AppShellNavItem[];
  userMenu: ReactNode;
  collapsed?: boolean;
  defaultCollapsed?: boolean;
  storageKey?: string;
  onCollapsedChange?: (collapsed: boolean) => void;
  children: ReactNode;
};
```

约束：

- `collapsed` 未传入时由组件使用 `storageKey` 写入 localStorage；默认 key 为 `feishu-iam:admin-sidebar-collapsed`。
- 桌面端外层使用 viewport 高度壳层，sidebar 与 main 分别滚动；不要让 `body` 成为后台主滚动容器。
- 收缩态只展示 icon，但每个 nav item 必须保留 tooltip、`aria-label` 和 `aria-current`。
- 窄屏继续使用移动 Sheet；桌面收缩按钮不在窄屏展示。

#### PageHeader

```ts
type PageBreadcrumb = {
  label: string;
  href?: string;
  current?: boolean;
};

type PageHeaderProps = {
  title: string;
  description?: string;
  breadcrumbs?: PageBreadcrumb[];
  badges?: ReactNode;
  primaryAction?: ReactNode;
  secondaryActions?: ReactNode;
  className?: string;
};
```

约束：

- 六个一级模块默认展示 `后台 / 模块名`。
- 打开详情 Sheet 时可展示 `后台 / 模块名 / 资源名`，但不能把资源详情改成路由页。
- 标题区只做定位和主操作，不承载筛选；筛选进入 `FilterBar`。

#### DetailSheet

```ts
type DetailSheetSize = 'normal' | 'wide' | 'full';

type DetailSheetProps = {
  open: boolean;
  title: string;
  description?: ReactNode;
  size?: DetailSheetSize;
  defaultSize?: DetailSheetSize;
  sizeStorageKey?: string;
  onSizeChange?: (size: DetailSheetSize) => void;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
};
```

约束：

- `normal`、`wide`、`full` 只改变 Sheet 宽度，不改变路由范式。
- Header 内使用 lucide 图标按钮切换宽度，并提供 tooltip 与 accessible name。
- 宽度切换不能重挂载 `children`，不能丢失表单草稿。
- 关闭后焦点返回触发按钮；列表筛选、分页、排序和滚动位置保留。

#### DataTable / StatusBadge

```ts
type DataTableColumn<T> = {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
  headerClassName?: string;
  width?: string;
  minWidth?: string;
  nowrap?: boolean;
};

type StatusBadgeProps = {
  children: ReactNode;
  tone?: 'default' | 'success' | 'warning' | 'danger' | 'muted';
  ariaLabel?: string;
};
```

约束：

- `StatusBadge` 默认 `whitespace-nowrap shrink-0`。
- `DataTable` 根据 `width`、`minWidth`、`nowrap` 生成 header 和 cell class；状态列、时间列、操作列必须稳定。
- 长 `app_key`、URL、request id、target、actor 和 JSON 文本必须由调用方显式选择 `break-all`、截断、tooltip 或复制策略。
- 表格继续负责 loading、empty、error、forbidden；分页可以保持页面层实现，不强行塞入第一切片。

### 10.3 URL 和状态边界

第一切片只扩展共享组件，不强行把四个旧模块一次性接入 URL schema。模块迁移时按下面规则逐步增加：

| 模块 | 必须进入 URL | 不进入 URL |
|---|---|---|
| 权限管理 | `appKey`、角色详情 `sheet=role:<id>`、分页、筛选 | Sheet 宽度、表单草稿、成员搜索输入 |
| 管理员授权 | 查询、角色、状态、详情 `sheet=admin:<id>` | 新增/编辑表单草稿、飞书候选搜索输入 |
| 系统设置 | 当前设置项 `tab`、同步记录详情 `sheet=sync:<id>` | 触发同步确认框、诊断刷新中状态 |
| 工作台 | 跳转目标 query，例如记录类型、应用 id、同步 run id | 工作台局部展开状态 |

跨模块跳转必须优先生成目标页可解析的 query，而不是通过 `App.tsx` 中的临时 React state 传递上下文。

### 10.4 任务依赖和 subagent-driven 切片

第一切片完成前不要并行迁移旧模块。第一切片完成后，允许 subagent-driven 并行。

| 切片 | 目标 | 主要目录 | 依赖 |
|---|---|---|---|
| S1 共享基础垂直切片 | AppShell/PageHeader/DetailSheet/DataTable/StatusBadge + 记录查询/应用管理回归 | `components/admin/`、`features/records/`、`features/applications/`、`App.tsx`、测试 | 已完成 Pencil 和设计复审 |
| S2 权限管理迁移 | 角色清单、创建、详情 Sheet、绑定权限组、绑定成员 | `routes/PermissionManagementPage.tsx`、`api/permission.ts`、测试 | S1 |
| S3 管理员授权迁移 | 管理员清单、搜索、详情 Sheet/FormDialog、启停确认 | `routes/AdminAuthorizationPage.tsx`、`api/admin.ts`、测试 | S1 |
| S4 系统设置迁移 | 设置项清单、飞书同步、同步历史 DataTable、同步记录 Sheet | `routes/SystemSettingsPage.tsx`、`api/feishu.ts`、测试 | S1 |
| S5 工作台重构 | 风险队列、系统健康、最近同步、最近审计、带 query 跳转 | `routes/WorkspacePage.tsx`、`App.tsx`、测试 | S1，最好在 S2-S4 后 |
| S6 旧 CSS 清理和版本发布 | 移除旧主结构类依赖、版本号、README、镜像、部署 | `App.css`、`package.json`、`README.md`、`deploy/` | S2-S5 全部完成 |

并行建议：

```text
Phase 1:
  S1 共享基础垂直切片（单独执行，禁止并行）

Phase 2:
  Lane A: S2 权限管理迁移
  Lane B: S3 管理员授权迁移
  Lane C: S4 系统设置迁移

Phase 3:
  Lane D: S5 工作台重构（依赖 S2-S4 的 query 目标稳定）

Phase 4:
  S6 旧 CSS 清理和版本发布（单独执行）
```

冲突提示：

- S2、S3、S4 都会读取共享 wrapper，但不应修改 `components/admin/*`；如发现 wrapper 缺口，先回补到 S1 或建立独立 follow-up。
- S5 会改 `App.tsx` 的跨模块跳转，不能和 S2-S4 同时改 URL contract。
- S6 会大面积改 `App.css` 和版本材料，必须在模块迁移后执行。

### 10.5 测试和 Browser 自检门禁

第一切片必须新增或扩展：

- `apps/admin-web/src/components/admin/admin-components.test.tsx`：覆盖 `AppShell` 展开/收缩、`PageHeader` 面包屑、`DetailSheet` 三档按钮、`DataTableColumn` 宽度/nowrap、`StatusBadge` 不换行。
- `apps/admin-web/src/features/records/RecordQueryView.test.tsx`：覆盖状态 badge 不换行、操作列稳定、详情 Sheet 宽度切换不丢 query。
- `apps/admin-web/src/features/applications/ApplicationManagementView.test.tsx`：覆盖应用详情 Sheet 宽度切换、关闭后筛选/分页保留。
- `apps/admin-web/test/run-responsive-overflow-check.mjs`：从只测记录查询扩展为六个一级模块，至少覆盖 390、768、1280。

模块迁移切片必须各自补模块级测试：

- 权限管理：应用筛选、角色表格、创建角色、详情 Sheet、绑定权限组、绑定成员、权限不足。
- 管理员授权：筛选、新增、编辑、启停确认、历史只读角色、非平台管理员拒绝态。
- 系统设置：飞书同步读取失败、触发同步确认、字段诊断失败但历史可看、同步记录详情 Sheet。
- 工作台：风险队列空态/失败态、跳转 query、健康摘要不变成指标墙。

验证命令顺序：

```bash
pnpm --filter @feishu-iam/admin-web typecheck
pnpm --filter @feishu-iam/admin-web test
pnpm --filter @feishu-iam/admin-web build
pnpm --filter @feishu-iam/admin-web test:responsive
pnpm check
```

Browser 自检必须覆盖：

- 本地 `http://localhost:3000/admin/workspace`
- 本地 `http://localhost:3000/admin/applications`
- 本地 `http://localhost:3000/admin/permissions`
- 本地 `http://localhost:3000/admin/admins`
- 本地 `http://localhost:3000/admin/records`
- 本地 `http://localhost:3000/admin/settings`
- 视口：1440、1280、768、390。
- 检查：console error、非预期 network failure、页面级横向溢出、Sheet/Dialog 可用、表格操作列不塌陷、状态 badge 不换行、菜单固定与收缩可用。

### 10.6 测试覆盖图

```text
CODE PATHS                                           USER FLOWS
[+] components/admin/AppShell                        [+] 管理后台壳层
  ├── [GAP] desktop expanded/collapsed                 ├── [GAP] [→E2E] 菜单固定，主内容独立滚动
  ├── [GAP] localStorage persistence                   ├── [GAP] [→E2E] 390 移动导航 Sheet
  └── [GAP] tooltip/aria-current in collapsed mode     └── [GAP] 键盘 Tab 到达菜单和收缩按钮
[+] components/admin/PageHeader                      [+] 页面定位
  ├── [GAP] breadcrumbs rendering                      └── [GAP] 六个一级模块显示 后台 / 模块名
  └── [GAP] action area wrapping
[+] components/admin/DetailSheet                     [+] 清单 -> 详情
  ├── [GAP] normal/wide/full width modes               ├── [GAP] [→E2E] 详情打开、切宽、关闭回列表
  ├── [GAP] size switch does not remount children      └── [GAP] Esc/关闭后焦点返回触发按钮
  └── [GAP] per-open/localStorage size behavior
[+] components/admin/DataTable/StatusBadge           [+] 高密度表格
  ├── [GAP] column width/minWidth/nowrap               ├── [GAP] [→E2E] 记录查询状态 badge 不换行
  ├── [★★ TESTED] loading/empty/error/rows             └── [GAP] 390 横向滚动但页面不横向溢出
  └── [GAP] forbidden state and long text policy
[+] routes legacy module migration                    [+] 四个旧模块迁移
  ├── [GAP] permissions URL state + DetailSheet        ├── [GAP] 权限角色查看/编辑/绑定
  ├── [GAP] admins table + form/sheet                  ├── [GAP] 管理员新增/编辑/启停
  ├── [GAP] settings sync history + sheet              ├── [GAP] 系统设置同步/诊断/历史
  └── [GAP] workspace risk queue + query jump          └── [GAP] 工作台风险跳转到目标模块

COVERAGE: 1/25 paths tested in current baseline
QUALITY: ★★:1 | GAPS:24 (7 E2E/browser-worthy)
```

### 10.7 失败模式和处理要求

| 新路径 | 生产失败模式 | 必须处理 |
|---|---|---|
| AppShell localStorage | localStorage 不可用或值非法导致壳层崩溃 | catch 后回退展开态，不阻断后台 |
| AppShell fixed layout | 主内容滚动被错误放到 body，长表格带走 sidebar | responsive 脚本和 Browser 检查滚动容器 |
| DetailSheet size switch | 切宽时 children 重挂载，表单草稿丢失 | 测试使用输入草稿后切换宽度 |
| DataTable width | 长 request id 或 URL 撑破页面 | 列策略测试 + 390/1280 overflow 检查 |
| 权限管理迁移 | 切换应用时旧角色请求晚返回覆盖新应用 | 沿用 request sequence/ref 防陈旧响应 |
| 管理员授权迁移 | 历史只读角色展示可编辑按钮但保存失败 | 只读角色按钮禁用或隐藏并给稳定说明 |
| 系统设置同步 | 诊断失败时隐藏同步历史，影响排障 | partial state 保留可用分区 |
| 工作台跳转 | 用 React state 传上下文，刷新后丢失目标 | 必须生成 URL query |

当前没有不可接受的 silent failure，只要上述要求进入 `IMPLEMENTATION_PLAN.md` 并配套测试。

### 10.8 What already exists

- `components/admin/*` 已有 shadcn/tweakcn wrapper 基线：`AppShell`、`PageHeader`、`DataTable`、`FilterBar`、`DetailSheet`、`FormDialog`、`ConfirmDialog`、`PageState`、`StatusBadge`。
- `features/records/*` 和 `features/applications/*` 已经是新运行时可信样板，应作为第一切片回归样板，不重写业务逻辑。
- `routes/admin-url-state.ts` 已提供记录查询和应用管理 query schema，应扩展而不是另造每页私有解析器。
- `test/run-responsive-overflow-check.mjs` 已有 Playwright 响应式溢出检查，应扩展到六个一级模块。
- 旧 `components/*`、`AdminShell`、`DetailDrawer`、`FormModal`、`App.css` 中仍有大量可参考业务细节，但不能继续作为新页面主结构。

### 10.9 NOT in scope

- 不新增后端 API 或数据库 DDL，除非实现阶段证明前端无法表达已有业务契约。
- 不做 OAuth/OIDC、飞书同步、权限模型或部署拓扑扩展。
- 不把 `DetailSheet full` 改成独立详情页。
- 不把 Sheet 宽度、表单草稿、候选搜索输入写入 URL。
- 不在第一切片清理全部旧 CSS；旧 CSS 清理必须等模块迁移后进行。
- 不把工作台做成指标 dashboard 或营销化首页。

### 10.10 Implementation Tasks

Synthesized from this engineering review. Each task derives from a specific finding above.

- [ ] **T1 (P1, human: ~1d / CC: ~45min)** — 共享组件 — 实现第一条共享基础垂直切片
  - Surfaced by: Scope Challenge — 完整 v0.10.1 过大，必须先做共享基础和既有新页面回归。
  - Files: `apps/admin-web/src/components/admin/*`、`apps/admin-web/src/features/records/*`、`apps/admin-web/src/features/applications/*`、`apps/admin-web/src/App.tsx`、相关测试。
  - Verify: admin-web typecheck/test/build、responsive overflow、Browser 六模块烟测中的 records/applications。
- [ ] **T2 (P1, human: ~1d / CC: ~45min)** — URL 状态 — 扩展模块 query schema，禁止跨模块临时 state 作为深链合同
  - Surfaced by: Architecture Review — 当前 URL schema 只覆盖 records/applications，后续四模块需要可刷新、可复制、可回退的上下文。
  - Files: `apps/admin-web/src/routes/admin-url-state.ts`、`apps/admin-web/src/routes/admin-url-state.test.ts`、各模块路由。
  - Verify: URL state 单测覆盖非法值归一化、关闭 Sheet 保留筛选、无 secret/token 入 URL。
- [ ] **T3 (P1, human: ~2d / CC: ~90min)** — 模块迁移 — 按 S2/S3/S4 并行迁移权限管理、管理员授权、系统设置
  - Surfaced by: Worktree parallelization — 三个模块依赖 S1 但彼此目录边界清晰，适合 subagent-driven 并行。
  - Files: `routes/PermissionManagementPage.tsx`、`routes/AdminAuthorizationPage.tsx`、`routes/SystemSettingsPage.tsx`、模块测试。
  - Verify: 各模块单测、Browser 对应页面、旧结构类搜索。
- [ ] **T4 (P2, human: ~1d / CC: ~45min)** — 工作台 — 在模块 query 稳定后迁移运营清单和风险跳转
  - Surfaced by: Architecture Review — 工作台依赖目标模块 query 合同，不能抢在 S2-S4 前实现复杂跳转。
  - Files: `routes/WorkspacePage.tsx`、`App.tsx`、工作台测试。
  - Verify: 风险队列空/错/部分态、跳转 query、Browser 桌面和 390。
- [ ] **T5 (P1, human: ~1d / CC: ~40min)** — 验证 — 扩展 responsive overflow 和 Browser 自检到六个一级模块
  - Surfaced by: Test Review — 当前脚本默认只测记录查询，无法证明 v0.10.1 全后台收口。
  - Files: `apps/admin-web/test/run-responsive-overflow-check.mjs`、QA/test plan。
  - Verify: `pnpm --filter @feishu-iam/admin-web test:responsive` 覆盖六路由四视口。
- [ ] **T6 (P2, human: ~1d / CC: ~45min)** — 清理发布 — 模块迁移后清理旧 CSS 并完成 v0.10.1 release 材料
  - Surfaced by: Code Quality Review — 旧结构类仍大量存在，不能在迁移前清，但发布前必须收敛。
  - Files: `apps/admin-web/src/App.css`、`package.json`、`README.md`、`docs/codex-sessions/*`。
  - Verify: 旧结构类搜索、`pnpm check`、镜像/version/readme/deploy 验证。

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|---|---|---|---:|---|---|
| Design Review | `/plan-design-review` | UI/UX 方向和 Pencil 原型 | 2 | CLEAR | 最新记录 `overall_score=9`，`unresolved=0`，Pencil 可进入工程评审。 |
| Eng Review | `/plan-eng-review` | 架构、任务切片、测试和发布风险 | 1 | CLEAR | 范围已降维为 S1-S6；0 个未决决策，0 个 critical gap，6 个 implementation tasks。 |
| Test Plan | `/plan-eng-review` | QA 和 Browser 输入 | 1 | WRITTEN | 已定义六路由四视口、组件测试、URL state 测试、模块测试和 Browser 自检门禁。 |
| Parallelization | `/plan-eng-review` | subagent-driven 准备 | 1 | READY | S1 顺序执行；S2/S3/S4 可并行；S5 等 query 稳定；S6 最后执行。 |

CODEX: 未运行独立 `codex review`，本轮为计划阶段工程评审，不审代码 diff。

CROSS-MODEL: 未运行外部 cross-model review。

UNRESOLVED: 0。

VERDICT: ENG CLEARED — 可以进入 Superpowers `writing-plans`。执行计划应优先按 S1-S6 生成可 subagent-driven 的 `IMPLEMENTATION_PLAN.md`；第 7 步优先 `subagent-driven-development`，但只有 S2/S3/S4 在 S1 完成后可并行。Ship、land、deploy 已获用户预授权，但仍必须先完成验证、review、Git 收口和发布证据。
