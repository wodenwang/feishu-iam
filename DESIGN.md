# Feishu IAM shadcn/ui 设计系统基线

本文档是 `Feishu IAM` 的视觉与交互设计基线，供 Pencil 原型、前端实现和后续设计评审使用。

规则来源优先级：

1. 用户在当前对话中的明确指令
2. 已确认的 Pencil 原型
3. `AGENTS.md` / `CLAUDE.md`
4. `docs/` 下的项目文档
5. 现有实现代码
6. shadcn/ui 官方文档
7. 通用前端最佳实践

本文件只描述 UI/UX 与设计系统规则。领域、安全、后端、Agent 行为等规则仍以 `AGENTS.md` 为准。

## Riversoft 品牌配色补充决策

本节是基于用户提供的公司 logo 素材形成的品牌配色覆盖规则。素材来源：

- Riversoft logo：`https://www.riversoft.com.cn/images/logo-2.png`

本次只重新定义 UI 配色方向，不改变当前系统前端布局风格、组件结构、信息密度、导航形态、表格优先级、抽屉/详情页交互和 shadcn/ui + tweakcn 的实现基线。后续实现时应优先替换集中式 CSS variables / Tailwind token，不要在页面组件里局部硬编码颜色。

### Logo 色彩提取

对 logo 非透明、非白色像素进行本地取样后，主要色彩特征如下：

| 色彩角色 | 代表色 | HSL 近似值 | 用途判断 |
|---|---|---|---|
| 品牌深色文字 | `#231C16` | `28 23% 11%` | 默认文字、深色标题、深色侧栏文字基准。 |
| 品牌主蓝 | `#0E76BD` | `204 86% 40%` | 主操作、选中态、链接、focus ring。 |
| 品牌亮蓝 | `#1C8CCA` / `#26A4D8` | `201 76% 45%` / `198 70% 50%` | hover、图表、轻量强调，不做大面积背景。 |
| 品牌柠檬绿 | `#A6C511` / `#D8E000` | `70 84% 42%` / `62 100% 44%` | 辅助强调、成功趋势、图表色、徽标点缀；不作为主按钮和大面积底色。 |

### 主题决策

- 主题家族继续采用 shadcn/ui + tweakcn 的 modern minimal / neutral admin 方向。
- 品牌主色从旧的深青绿方向调整为 Riversoft 蓝色系：`#0E76BD` 为 primary，`#1C8CCA` 和 `#26A4D8` 作为 hover / chart / info 辅助。
- 品牌柠檬绿饱和度高，后台长时间使用时只作为小面积辅助强调，例如图表、趋势、状态附属点、空状态插画细节或成功类辅助信息；不用于主按钮、整块导航背景、整页背景或表格 hover。
- 页面主体继续保持中性浅灰蓝背景、白色内容面板、清晰浅边框和中等信息密度，不复制官网或 logo 的营销式视觉。
- Sidebar 可以使用深蓝黑而不是纯黑：保持专业、稳定，并与主蓝形成品牌一致性。
- 状态色仍保留语义边界：危险操作使用红色，警告使用琥珀色，成功使用低饱和绿色；不要用 Riversoft 柠檬绿替代所有成功状态。

### 推荐 CSS Variables

后续若实施主题落地，优先在 `apps/admin-web/src/index.css` 的 `:root` 中集中替换为以下 token。数值保持 shadcn/ui / Tailwind `hsl(var(--token))` 格式：

```css
:root {
  --background: 210 25% 98%;
  --foreground: 28 23% 11%;

  --card: 0 0% 100%;
  --card-foreground: 28 23% 11%;
  --popover: 0 0% 100%;
  --popover-foreground: 28 23% 11%;

  --primary: 204 86% 40%;
  --primary-foreground: 0 0% 100%;
  --secondary: 204 35% 94%;
  --secondary-foreground: 205 45% 22%;
  --muted: 210 25% 95%;
  --muted-foreground: 210 12% 42%;
  --accent: 199 72% 94%;
  --accent-foreground: 204 86% 28%;

  --destructive: 0 72% 51%;
  --destructive-foreground: 0 0% 100%;
  --border: 207 24% 86%;
  --input: 207 24% 86%;
  --ring: 204 86% 40%;

  --chart-1: 204 86% 40%;
  --chart-2: 70 84% 42%;
  --chart-3: 198 70% 50%;
  --chart-4: 160 56% 38%;
  --chart-5: 36 84% 55%;

  --sidebar: 205 48% 16%;
  --sidebar-foreground: 210 30% 96%;
  --sidebar-accent: 204 86% 28%;
  --sidebar-accent-foreground: 0 0% 100%;
  --sidebar-border: 205 34% 24%;

  --radius: 0.5rem;
}
```

### 配色使用规则

- Primary button、当前导航项、主要链接和 focus ring 使用 Riversoft 主蓝。
- Sidebar 背景使用深蓝黑，选中/hover 使用深一档或主蓝一档，文字保持高对比浅色。
- 页面背景保持非常浅的冷灰蓝，内容卡片和表格 surface 仍以白色为主。
- 表格 hover、筛选区 hover、DropdownMenu active、Tabs active 等轻量交互使用低饱和浅蓝 `accent`，不要使用高饱和柠檬绿。
- 柠檬绿只用于图表第二色、趋势上升、局部徽标点缀或非关键小面积提示；同一屏内使用面积应明显小于主蓝。
- 任何正文、按钮文字、表格文字和状态标签必须满足 WCAG AA：正文至少 4.5:1，大字和 UI 组件至少 3:1。
- 不使用品牌蓝/绿做大面积渐变、hero、装饰色块、漂浮背景或营销式 banner。

## v1.0.2 Feishu IAM UI/UX 迭代覆盖

`v1.0.2` 是正式版后的前端 UI/UX 收口版本，设计输入以 `docs/superpowers/specs/2026-06-13-feishu-iam-v1.0.2-frontend-uiux-iteration.md` 和 `docs/design-audits/2026-06-13-frontend-uiux/NOTES.md` 为准。

本版本不改变 shadcn/ui + tweakcn + Tailwind 的前端技术架构，但允许重新审视和大幅调整 UI、调色方案、视觉层级、公开问题页构图、后台壳层质感、表格密度和状态表达。任何配色大改都必须收口到 CSS variables / Tailwind token 层，不能在业务页面中零散硬编码颜色。

### 公开问题页规则

公开问题页包括管理后台未登录、管理员 session 失效、无后台权限、OAuth 授权失败、飞书内部回调失败和旧 `/api/auth/feishu/callback` 兼容入口失败等 HTML 页面。

公开问题页必须遵守：

- 统一使用 Feishu IAM 问题提示视觉模型：品牌区、状态图标、用户可读标题、恢复建议、request id、主操作和技术详情。
- 所有可复制内容只允许是 `request id`；不得提供“复制问题信息”“复制整段错误”“复制本地提取信息”等入口。
- 错误摘要用于帮助用户理解当前状态，但不作为复制对象；技术细节应弱化或折叠，不压过恢复动作。
- 管理后台认证类问题页的主恢复动作是 `飞书登录`，并应说明登录后将继续进入后台或返回目标页面。
- OAuth / SSO 错误页应引导用户返回原系统重新发起登录；如果无法提供返回 URL，则优先提供 `复制 request id`。
- 390px、768px、1440px 下都不能出现页面级横向溢出；移动端第一屏必须能看到标题、简短说明、request id 和主操作。
- 不在页面、URL、复制内容、截图说明或文档中暴露 secret、token、cookie、authorization、授权码、token hash、state hash 或 raw payload。

### 主题和配色自由度

Riversoft 蓝绿配色是当前正式版基线，不是后续唯一可选方向。下一版本可以根据线上审计结果更换或重构主题色，但必须满足：

- 使用 shadcn/tweakcn 语义 token 表达：`background`、`foreground`、`card`、`popover`、`primary`、`secondary`、`muted`、`accent`、`destructive`、`border`、`input`、`ring`、`chart` 和 `sidebar`。
- 同一套 token 覆盖公开问题页、后台壳层、表格、筛选、详情、弹窗、状态标签和空/错/加载状态。
- 正文至少 4.5:1 对比度，大字和 UI 组件至少 3:1；状态色不能只靠颜色表达。
- 不用营销式 hero、漂浮装饰、低密度大卡片堆叠或渐变背景替代后台工作区。
- 如果放弃 Riversoft 主蓝作为 primary，必须在版本设计文档中说明新色板的产品理由、适用范围、对比度和迁移边界。

### 下一版视觉 QA 门禁

进入 v1.0.2 实现后，Browser 自检至少覆盖：

- `/` 未登录问题页。
- `/oauth/authorize` 参数缺失错误页。
- `/api/auth/feishu/callback` 缺 code 兼容入口错误页。
- 有管理员会话后的工作台、应用管理、应用详情、权限管理、角色详情、飞书同步、管理员授权和操作审计。

公开问题页必须检查 1440px、768px、390px 并保留截图证据。后台页必须覆盖桌面关键路径，并覆盖工作台、应用管理、应用详情、权限管理、角色详情、飞书同步、管理员授权、操作审计和系统信息的 390px 移动端自适应检查。后台页如果受生产数据或权限限制影响，需要在 QA 记录中写明无法覆盖的状态和原因。

### 控制台移动端硬约束

移动端不是桌面表格的自然压缩版本。v1.0.2 的移动端硬约束适用于公开问题页和登录后的完整管理控制台，包括系统管理下的飞书同步、管理员授权、操作审计和系统信息。390px 下必须优先保证信息可读和操作可达：

- `DataTable` 不允许把 `app_key`、角色 key、request id、URL、时间和操作列压缩成逐字竖排或互相重叠。
- 资源列表在 390px 下应切换为行卡片、关键字段列表或明确可横向滚动的表格；如果使用横向滚动，必须保留表头、滚动容器和可见滚动提示。
- 移动端行卡片至少展示资源名称、关键 ID、状态、最近更新时间和主操作；次要字段进入展开区或详情页。
- 表格操作列在移动端优先收纳为单个 `更多` 菜单或固定尺寸图标组，不能挤压主字段。
- 超过 4 项的 Tab 不得静态撑破视口；应使用横向滚动、折行分组、Select 或 overflow menu。
- 复杂配置页在 390px 下必须使用分步面板或明确分区，例如 `待选 / 已选 / 摘要`；保存入口始终清楚，但不得遮挡待选列表和已选结果。
- 移动端页面级检查不只看是否有横向滚动，还必须看字段是否保持可读、按钮是否可点、用户是否能理解下一步。

## v0.10.0 Feishu IAM 决策覆盖

`v0.10.0` 是管理后台前端运行时重建版本。此前 `v0.9.1` 沉淀的 shadcn/ui + tweakcn neutral admin 设计基线继续有效，但本轮不再只停留在设计基线或第一切片，而是要让 `apps/admin-web` 真实运行在 Tailwind、shadcn/ui、tweakcn token、react-router 和项目级 wrapper 上。

v0.10.0 的设计与工程输入以以下文件为准：

1. `DESIGN.md`：设计系统、组件映射和视觉/交互规则。
2. `docs/superpowers/specs/2026-05-24-feishu-iam-v0.10.0-admin-web-runtime-rebuild.md`：版本边界、路由 query schema、状态矩阵、删除/保留/迁移边界和第一可信切片。
3. `design/admin-console-v0.10.0.pen`：流程、信息结构、状态和响应式参考，不作为像素级实现稿。

执行时若本文件后续章节仍出现 `v0.9.1` 历史表述，应按本节和 v0.10.0 规划文档解释为“设计基线来源”，不得理解为当前版本范围。

## v0.10.1 Feishu IAM 补充决策

`v0.10.1` 是 `v0.10.0` 之后的管理后台 UI/UX 一致性修复版本。版本规划以 `docs/superpowers/plans/2026-05-25-feishu-iam-v0.10.1-admin-uiux-closure.md` 为准。

本版本新增以下设计硬约束：

- 后台壳层必须固定：桌面端左侧菜单固定在 viewport 内，顶部登录人栏固定在内容区域顶部，主内容区域独立滚动。
- 左侧菜单必须支持桌面端收缩和展开；收缩状态下使用图标、tooltip 和无障碍标签，不显示长文本。
- `PageHeader` 必须承载通用面包屑能力，一级模块和二级菜单都显示一致层级。
- `DetailSheet` 必须支持常规、宽屏和填满三档宽度；宽度切换只改变工作空间，不把详情变成独立页面。
- 承载复杂交互的 `DetailSheet` / 右侧抽屉必须默认以填满模式打开；如果交互包含多 Tab、多列表选择、批量勾选、变更摘要或需要长时间专注配置，优先使用独立详情页或全屏配置页。
- `DataTable` 和 `StatusBadge` 必须为状态列、时间列、操作列提供稳定宽度策略，短状态标签不得换行。
- 列表页必须优先保持 100% 宽度，不把底部横向滚动作为桌面端默认体验；列表只展示主 ID、标题、状态、时间和必要关键字段，其他长内容原则上收拢到详情。
- `工作台`、`应用管理`、`权限管理`、`系统管理` 及其二级菜单必须迁移到 `components/admin/*` 和 `components/ui/*`，不得继续以旧 `App.css` 结构类作为主视觉实现。
- 后台导航信息架构调整为四个一级模块：`工作台`、`应用管理`、`权限管理`、`系统管理`。
- `系统管理` 下沉系统类能力为二级菜单：`飞书同步`、`管理员授权`、`操作审计`、`系统信息`。
- 原 `记录查询` 对外展示名称统一改为 `操作审计`；原系统设置中的飞书同步能力拆为独立 `飞书同步` 二级菜单，剩余部署、版本和运行状态等内容保留为 `系统信息`。
- 左侧导航必须使用能表达一二级目录的组件结构。二级菜单默认收拢在对应一级目录下，通过一级目录展开 / 收起查看；当前二级菜单选中时，所属一级目录必须保持展开并显示高亮上下文。
- v0.11.0 起，导航组件应优先采用 `Sidebar` + `Collapsible` + `Tooltip` + 项目级 `SidebarNav` / `NavItem` 组合；不要用扁平列表伪装二级目录，也不要用普通 `DropdownMenu` 承载桌面端常驻主导航二级目录。

## v0.11.0 Feishu IAM 补充决策

`v0.11.0` 是系统管理 IA 与通用体验基线版本。版本规划以 `docs/superpowers/plans/2026-05-26-feishu-iam-v0.11.0-system-management-baseline.md` 和 `/office-hours` 设计文档 `~/.gstack/projects/ai-feishu-iam/tonycheng-main-design-20260526-143105.md` 为准。

本版本新增以下设计硬约束：

- 后台一级导航固定为 `工作台`、`应用管理`、`权限管理`、`系统管理`。
- `系统管理` 下沉系统类能力为二级菜单：`飞书同步`、`管理员授权`、`操作审计`、`系统信息`。
- 原 `记录查询` 对外展示名称统一改为 `操作审计`；该入口承载审计日志、安全事件、同步记录以及登录与 Token 相关事件。
- 原系统设置中的飞书同步能力作为 `飞书同步` 二级入口呈现；运行状态、版本信息和部署信息收敛为 `系统信息`。
- 旧系统类路由必须保留兼容或跳转，例如 `/admin/records`、`/admin/admins`、`/admin/settings`，不能让已有深链、文档链接或 Agent 自动化入口直接 404。
- `PageHeader` 面包屑必须体现 `后台 / 系统管理 / 二级菜单`，不要让系统类页面继续表现为多个互不相关的一级模块。
- 表格和详情中的技术标识符不能以裸值独立展示。`user_id`、`open_id`、`union_id`、`app_key`、权限点 key、request id 等字段必须带清晰字段名、中文标签或定义列表，例如 `飞书 user_id: xxxxxx`、`request id: xxxxxx`。
- `DataTable` 默认优先填满容器宽度；状态列、时间列和操作列使用稳定宽度；长 URL、权限点 key、request id、应用范围、before/after diff 等长字段应截断、换行、tooltip、复制或进入详情，不应撑破桌面端列表。
- `DetailSheet`、信息查询明细和其他可滚动详情容器底部必须有足够留白，避免最后一项内容被窗口底部、sticky footer 或固定按钮区遮挡。
- 当前版本不重做应用管理完整流程、角色详情、组织树选择或权限组绑定；这些复杂配置仍按后续版本使用独立详情页或默认填满的 `DetailSheet`。

## v0.9.1 Feishu IAM 决策覆盖

`v0.9.1` 是管理后台前端大重构版本，采用 `shadcn/ui` 作为前端组件基线，采用 `tweakcn` 的 modern minimal / neutral admin 方向作为主题参考。该决策覆盖此前 `v0.8.x` 的 Ant Design / Pencil 风格落地方式，但不改变 Feishu IAM 的业务边界、审计要求、飞书身份主数据约定和应用接入模型。

本阶段设计目标：

- 新建 `design/admin-console-v0.9.1.pen`，作为 v0.9.1 独立原型源，不直接覆盖旧 `design/admin-console.pen`。
- 重做信息架构和交互原型，不要求沿用旧版“清单 -> 详情抽屉”的全部细节，但必须保持后台系统的可扫描性和操作闭环。
- 前端实现从项目拥有的 shadcn/ui 组件代码出发，建立 `AppShell`、`PageHeader`、`DataTable`、`FilterBar`、`DetailSheet`、`FormDialog`、`ConfirmDialog`、`SecretRevealPanel` 等项目级 wrapper。
- 历史主题曾以 Feishu IAM 深青绿为 primary/sidebar/accent 来源；在 Riversoft 品牌配色补充决策生效后，后续主题更新以 Riversoft 主蓝为 primary 来源，但页面主体仍保持 neutral admin，不复制旧深色顶部栏的厚重感。
- 不混用 Ant Design、MUI、Chakra、Arco、Element Plus 或 Bootstrap。若后续必须保留旧页面过渡，需写迁移隔离策略，不能在同一新页面混用组件体系。

v0.9.1 的核心页面范围：

1. 未登录和登录异常页：展示 Feishu IAM 品牌、飞书登录入口、request id 和稳定错误说明。
2. 工作台：展示系统健康、飞书同步、应用接入、管理员动作和审计风险的运营视图。
3. 应用管理：围绕 v0.8.1 应用接入包重做创建、回调地址、OAuth 凭证、开发者 API 凭证、Codex 接入提示词和应用下角色元数据管理；创建成功后的接入提示词必须提供明确的 `一键复制` 按钮和复制反馈。
4. 权限管理：以角色列表和角色授权绑定为主，不承载角色创建/编辑基础信息，不把权限点 CRUD 暴露成后台主流程；权限点和权限组主要由应用开发者 API 维护。
5. 系统管理：承载系统类二级菜单，不把所有系统能力挤在一个页面内。
6. 飞书同步：作为系统管理二级菜单，重构为运维数据同步控制台，承载同步状态、轻量同步、全量同步、字段诊断、本地组织/用户查询、同步历史和失败诊断入口。
7. 管理员授权：作为系统管理二级菜单，平台管理员、应用管理员、作用域和授权审计形成单页闭环。
8. 操作审计：由原 `记录查询` 改名而来，作为系统管理二级菜单，承载审计日志、安全事件、同步记录和操作详情统一查询，支持稳定导出确认。
9. 系统信息：由原系统设置剩余内容收敛而来，承载部署信息、版本信息、运行状态和运维动作，不展示明文 secret。

本阶段不做：

- HTTPS、反向代理、高可用、滚动升级。
- 完整 OIDC Discovery、JWKS、ID Token、refresh token 或 SAML。
- ABAC、资源级权限、deny 规则、飞书角色同步或飞书用户组同步。
- 管理后台直接维护第三方业务资源权限。

UI 框架选择：

- 当前模板：shadcn/ui。
- 使用条件：只有用户明确倾向 shadcn 或 shadcn/ui 时才选择本模板。
- 默认规则：用户没有明确 UI 框架倾向时，不使用本模板，改用 Ant Design 默认模板。
- 从零到一规则：如果用户明确选择 shadcn/ui，但没有明确后台主题倾向，默认采用 tweakcn 作为主题框架、整体视觉和后台 layout 风格参考。
- 拒绝规则：本 harness 目前只支持 Ant Design 与 shadcn/ui。如果用户要求 Material UI、Chakra UI、Arco Design、Element Plus、Bootstrap、Tailwind UI、Radix-only 或自定义大型 Design System，应拒绝并要求用户在 Ant Design 与 shadcn/ui 中二选一。
- 混用规则：不要把 Ant Design 和 shadcn/ui 混在同一套设计基线中，除非当前任务明确是迁移或过渡方案。

官方参考：

- shadcn/ui Introduction：https://ui.shadcn.com/docs
- shadcn/ui Theming：https://ui.shadcn.com/docs/theming
- shadcn/ui Data Table：https://ui.shadcn.com/docs/components/data-table
- shadcn/ui Card：https://ui.shadcn.com/docs/components/card
- tweakcn：https://tweakcn.com/

## 1. 产品类型

`Feishu IAM` 默认按企业级 Admin Console / 后台管理系统进行设计，除非用户或项目文档明确说明不是后台系统。

目标用户：

- 业务管理员
- 平台管理员
- 运维人员
- 需要高频处理数据、配置、权限和状态的内部用户

设计目标：

- 干净、克制、可组合
- 明确的组件 ownership
- 可访问性优先
- 表格、表单、筛选、详情和操作状态完整
- 适合现代 React / Next.js / Tailwind 项目
- 可维护性优先于视觉创意

本项目默认不是：

- 营销官网
- 落地页
- 消费者产品
- Dribbble 风格概念稿
- 大量装饰卡片堆叠的 Dashboard

## 2. shadcn/ui 风格解析

shadcn/ui 的核心不是传统 NPM 组件库，而是一套可复制进项目、由项目直接拥有的组件代码和分发方式。它的设计倾向是 open code、composition、beautiful defaults 和 AI-ready：组件默认好看、可访问、彼此统一，但最终代码在项目内，可以被团队直接调整。

### 官方原则到落地规则

| 原则 | 本项目落地要求 |
|---|---|
| Open Code | 组件代码进入项目后由项目维护；不要把 shadcn/ui 当黑盒库使用。 |
| Composition | 页面由小型可组合 primitives 和项目级 wrapper 组成，避免巨型万能组件。 |
| Distribution | 使用 shadcn CLI / registry 思路增量引入需要的组件，不一次性复制无关组件。 |
| Beautiful Defaults | 默认保持干净、极简、可访问、低装饰的视觉效果，不过早自定义主题。 |
| AI-Ready | 组件 API、目录和命名保持一致，便于 Agent 读取、复用和修改。 |

### 默认视觉倾向

- 使用 neutral base color 与语义 token，保持黑白灰为主、少量 primary/action 强调。
- 使用 `background` / `foreground`、`card` / `card-foreground`、`primary` / `primary-foreground` 等成对语义 token。
- 使用 CSS variables 作为主题事实源；不要在页面中散落硬编码颜色。
- 圆角、边框、focus ring、input、popover、sidebar 等都通过 token 控制。
- 页面气质应干净、安静、现代，避免 heavy enterprise chrome。
- 不使用大面积渐变、玻璃拟态、过度阴影、装饰图标圆圈或 hero 式排版。
- 卡片只用于真实需要分组的 panel、表单、设置块、统计块或 item，不把整页 section 套进层层卡片。

### tweakcn 后台主题倾向

shadcn/ui 项目的后台视觉主题从零到一时默认采用 tweakcn 的主题编辑、预设和后台预览倾向，但不要把主题选择变成随意换皮。

可参考的方向：

- 主题以 shadcn/ui token 和 Tailwind CSS variables 为事实源，优先调整 `:root` / `.dark` 变量，而不是在页面组件里写零散颜色。
- 允许在明确品牌需求下使用 tweakcn 风格的预设作为起点，例如 modern minimal、amethyst haze、catppuccin、claude、caffeine 等，但必须先检查对比度、状态色和后台可读性。
- 主题应覆盖 background、foreground、card、popover、primary、secondary、muted、accent、destructive、border、input、ring、chart 和 sidebar token。
- 主题调整必须同时检查 light / dark、sidebar、table、form、dialog、popover、chart 和 empty/error/loading states。
- 对后台管理系统，默认选择克制、专业、长时间可读的主题；避免 cyberpunk、neo brutalism、过强高饱和或高阴影主题作为默认后台风格。
- 使用实时预览和代码导出思路固化主题：最终落地应是可复制、可审查的 CSS variables / Tailwind theme 变更，而不是只保留截图。

默认后台布局：

- 使用 shadcn/tweakcn 风格的 `AppShell`：左侧 `Sidebar`、顶部 `TopBar`、内容区 `PageHeader` + 主体面板。
- Sidebar、card、table、form、dialog、popover、chart 和 empty/error/loading states 必须共用同一套 CSS variables。
- 页面结构保持清爽：标题区、筛选/工具区、DataTable 或 FormPanel、Sheet/Dialog/DetailPanel。
- 默认主题从 modern minimal 方向开始：中性色底、清晰边框、适度圆角、稳定 focus ring、少量 primary/accent。
- 如果项目品牌需要更强性格，可以从 tweakcn 预设中选择接近的方向，但必须保留后台可读性。

### 主题素材解析规则

如果用户提供主题色、官网、logo、截图或品牌素材，必须先解析再选择 tweakcn 主题模板，不要直接照搬营销页视觉。

解析步骤：

1. 提取主色、辅助色、中性色、背景色、危险/成功/警告色倾向。
2. 判断品牌气质：稳重、科技、医疗、金融、教育、消费、开发者工具等。
3. 检查色彩是否适合后台长时间使用：对比度、饱和度、light/dark 可读性、状态色冲突。
4. 映射到 shadcn/tweakcn token：background、foreground、card、popover、primary、secondary、muted、accent、destructive、border、input、ring、chart 和 sidebar。
5. 如果素材来自官网或营销页，只提取安全的品牌 token，不复制 hero、渐变、大图、装饰图形或营销式排版。

默认决策：

- 没有素材：使用 tweakcn 的 modern minimal / neutral admin 方向。
- 只有明确主题色：选择接近该色相的 tweakcn 预设或生成 custom token set，并校正对比度。
- 有 logo：从 logo 提取主色和强调色；如果 logo 色过亮或过饱和，用作 accent，不直接作为大面积背景。
- 有官网：提取品牌色、字体气质和图形语言，但后台仍保持 tweakcn/shadcn 的信息架构和组件组合。
- 没有合适预设：使用 tweakcn-compatible custom CSS variables，不强行套不匹配的 preset。

## 3. 设计原则

### 组合优先

shadcn/ui 页面应由 primitives、可复用 project components 和业务页面组合而成。

优先结构：

```text
PageShell
  |
  v
PageHeader
  |
  v
FilterBar / Toolbar
  |
  v
DataTable / DetailPanel / FormPanel
```

默认避免：

- 每页直接堆大量 Tailwind class 且无项目级抽象
- 复制多个相似但不一致的 card/table/form 实现
- 只为视觉差异创建一套并行组件体系
- 把业务逻辑塞进低层 UI primitives

### 表格仍是后台核心

后台列表页仍以数据表格为核心，但 shadcn/ui 的 Data Table 应按可组合方式实现。

适用页面：

- 资源管理
- 用户与组织
- 角色与权限
- 订单、任务、记录、审计日志
- 配置列表

表格能力通常由 `Table` primitives、TanStack Table、项目级 `DataTable` wrapper、列定义、筛选控件和分页控件组合完成。

### 操作路径清晰

后台用户每天重复使用系统。页面应该让用户快速完成任务，而不是欣赏视觉效果。

优先级：

1. 快速扫读
2. 操作清晰
3. 布局可预测
4. 数据状态可靠
5. 表单高效
6. 权限明确
7. 错误可恢复
8. 组件组合一致

### 状态完整

每个主要页面都必须考虑：

- 正常数据状态
- Empty state
- Loading state / Skeleton state
- API error state
- No permission state
- Form validation error state
- Delete confirmation state
- Batch operation confirmation state
- Search no results state
- Disabled operation state

不要只设计 happy path。

## 4. 组件体系

UI 组件体系使用 shadcn/ui。

推荐技术栈：

- React 或 Next.js
- TypeScript
- Tailwind CSS
- shadcn/ui
- Radix-backed shadcn components
- lucide-react icons
- TanStack Query
- TanStack Table
- React Hook Form 或 TanStack Form
- Zod 或项目已有 schema validator
- Playwright

不要混用其他 UI 框架：

- Ant Design
- Material UI
- Chakra UI
- Arco Design
- Element Plus
- Bootstrap
- 自定义大型 Design System

## 5. shadcn/ui 组件映射

| UI 模式 | shadcn/ui / 推荐组合 |
|---|---|
| 应用整体布局 | project `AppShell` + `Sidebar` + CSS grid/flex |
| 左侧导航 | `Sidebar` + `Collapsible` + `Tooltip` + project `SidebarNav` / `NavItem` |
| 顶部栏 | project `TopBar` + `Button` + `DropdownMenu` |
| 面包屑 | `Breadcrumb` |
| 页面标题区 | project `PageHeader` |
| 指标卡片 | `Card` + project metric component |
| 数据表格 | `Table` + TanStack Table + project `DataTable` |
| 查询筛选区 | `Input` + `Select` + `DatePicker` + `Button` |
| 新增 / 编辑面板 | `Sheet` 或 `Dialog` + form components |
| 确认操作 | `AlertDialog` |
| 状态展示 | `Badge` |
| 详情展示 | `Card` / `Item` / project definition list |
| Tab 页面 | `Tabs` |
| 分步流程 | project stepper，必要时自定义 |
| 上传 | project upload component 或框架生态组件 |
| 权限选择 | `Checkbox` + `ScrollArea` + project tree/list |
| 命令式搜索 | `Command` |
| 通知反馈 | `Sonner` / `Toast` |
| 空状态 | `Empty` 或 project `EmptyState` |
| 加载状态 | `Skeleton` / `Spinner` |
| Tooltip | `Tooltip` |
| 下拉菜单 | `DropdownMenu` |

如果 shadcn/ui 已有合适组件，不优先编写大量自定义 primitives；如果缺少企业组件，应在项目级 wrapper 中组合实现。

## 6. 标准列表页结构

所有 CRUD 列表页默认使用以下结构：

```text
PageHeader
  |
  v
FilterBar
  |
  v
Toolbar
  |
  v
DataTable
  |
  v
Pagination / selected row summary
```

### PageHeader

包含：

- 页面标题
- 简短说明
- Breadcrumb
- 必要时显示主操作按钮

标题应说明当前区域是什么，不使用营销文案。

### FilterBar

默认展示 3-4 个核心筛选项。

常用字段：

- Keyword `Input`
- Status `Select`
- Type `Select`
- Date range picker
- Search `Button`
- Reset `Button`
- Advanced filters `Collapsible`

筛选项过多时，次要条件放入 `Collapsible` 或 `Popover`，不要把首屏挤满。

### Toolbar

常用操作：

- Primary create `Button`
- Batch actions `DropdownMenu`
- Export / import actions
- Refresh icon button
- Column visibility menu

危险操作必须使用 `AlertDialog` 二次确认。

### DataTable

默认能力：

- typed columns
- pagination
- sorting
- filtering
- row selection
- selected row summary
- column visibility
- fixed or clearly grouped action column
- loading / skeleton state
- empty state
- error state

列定义必须先判断字段是否适合列表扫描。默认只展示主 ID、标题、状态、时间、操作和少量业务关键字段；描述、长 URL、长回调地址、长 JSON、长错误信息、长权限点清单、长提示词等内容应放入详情，不应强行塞进列表。

列表页应优先使用 100% 宽度布局。桌面端不应默认出现底部横向滚动条；横向滚动只作为极端窄屏或确实无法裁剪字段时的兜底。

纯文本字段过长时可以换行展示，尤其是名称、标题、描述摘要和中文说明。状态、时间、操作列必须保持稳定宽度，短状态标签不得换行，不要为了塞更多列压缩操作按钮或状态标签。

表格和详情中的技术标识符不能以裸值独立展示。`user_id`、`open_id`、`union_id`、`app_key`、权限点 key、request id 等字段必须带清晰字段名、中文标签或定义列表，例如 `user_id: xxxxxx` 或 `飞书 user_id: xxxxxx`。

长标识符必须具备截断、tooltip 或复制能力，不能撑破表格、抽屉、弹窗或详情区域。

按钮、工具栏、表单操作区和表格操作列必须有稳定布局：

- 按钮形态按场景统一选择：列表页行操作按钮使用纯 icon；空间较窄、需要紧凑设计的局部区域可以使用纯 icon；其余场景一律使用 icon + 文字。
- 纯 icon 按钮必须提供清晰的 `aria-label`，并通过 `title`、`Tooltip` 或等价方式让鼠标用户能理解含义；不能只靠图标表达操作。
- 列表页行操作按钮必须使用稳定尺寸的 icon button group。详情、查看、编辑、启用、停用等操作需要保持一致尺寸、顺序、间距和可访问标签。
- 非列表页的主操作、筛选操作、详情页操作、弹窗底部操作和工作台入口默认使用 icon + 文字；若确实保留纯文字按钮，必须在组件规范中写明为例外。
- 按钮文字默认不得在按钮内部断行；短操作按钮使用 `whitespace-nowrap` 或等价策略保持稳定宽度。
- 输入框 + 按钮组合在空间不足时允许整组换行，但不允许把单个按钮压成多行或异常高度。
- 工具栏和表单操作区需要明确 `flex-wrap`、最小宽度或窄屏降级策略。
- 表格操作列应优先使用稳定宽度和 icon/button group，避免操作按钮撑高行高。
- 长文案按钮在窄屏下优先改短文案、纯 icon + tooltip、菜单收纳或整组换行。
- 如果按钮文字必须换行才能放下，说明该位置已经属于空间较窄场景，应重新选择纯 icon、短文案、菜单收纳或重新布局，而不是允许按钮内部换行。

默认避免：

- 深层嵌套表格
- 表格单元格中嵌入复杂表单
- 大量自定义 row rendering
- drag sorting + virtual scroll + sticky columns 的复杂组合
- 非标准 row actions

## 7. 新增 / 编辑 / 详情交互

Admin Console 默认交互模式：

| 场景 | 推荐模式 |
|---|---|
| 简单新增 | `Sheet + form` |
| 简单编辑 | `Sheet + form` |
| 详情查看 | `Sheet` 或 detail page |
| 删除 | `AlertDialog` |
| 启用 / 禁用 | `AlertDialog` 或 inline confirm |
| 批量操作 | `AlertDialog` confirmation |
| 多字段复杂表单 | Full page form |
| 多步骤流程 | Full page stepper |
| 复杂配置 | Full page 或 `Tabs` |
| 复杂详情配置 | Detail page 或默认填满的 `DetailSheet` + `Tabs` |

简单新增和编辑通常打开右侧 `Sheet`。字段很多、包含多个分组、流程包含多个步骤或用户需要专注处理复杂任务时，优先使用 full page form。

如果复杂配置因为上下文连续性仍使用右侧 `Sheet` / `DetailSheet`，必须默认使用填满宽度，不允许用常规窄抽屉承载多 Tab、多列表选择、树形勾选、批量绑定、权限分配、变更摘要等高认知负载流程。填满模式仍需保留清晰标题、关闭入口、主次按钮、保存中状态和错误展示。

详情页、`DetailSheet`、信息查询明细和其他可滚动详情容器底部必须有足够留白，避免最后一项内容被 sticky footer、固定按钮区或窗口底部遮挡。若详情有固定底部操作区，内容滚动区域必须设置相应 `padding-bottom` 或 scroll margin。

长内容或复杂详情底部应提供 `关闭` 按钮，其行为等同于右上角关闭：关闭后返回原清单状态，并保留当前筛选、分页、排序和必要的滚动位置。

## 8. 表单规范

业务表单优先使用 shadcn/ui form primitives 加 React Hook Form / TanStack Form / Zod 组合。

规则：

- 表单字段必须有清晰 `Label`。
- 必填字段必须明确标识。
- 错误信息靠近对应字段。
- helper text 使用 `muted-foreground`，不要和错误信息混淆。
- 业务对象的负责人、成员、管理员、用户等人相关字段，不允许用可手填裸 `user_id` 的文本框表达。默认优先使用当前登录人、人员选择器、管理员选择器或飞书用户搜索选择器；展示时使用姓名 / 部门 / 状态 + `飞书 user_id: xxxxxx`。
- 表单 label 不应写成 `负责人 user_id` 这类技术字段名，应使用 `负责人` 等业务可理解文案；技术 ID 只作为辅助标识展示，不作为主要输入方式。
- Submit buttons 位置保持一致。
- 提交过程中必须有 loading state。
- 防止重复提交。
- 成功和失败必须有反馈。
- 不要把 validation logic 分散写在多个组件内部。

TypeScript 项目中必须清晰定义 request types、response types、form values 和 validation schema。

## 9. 视觉密度

默认使用现代后台的中等信息密度：比传统 Ant Design 后台更轻，但不能低密度到影响工作效率。

推荐值：

- Page padding：24px
- Panel gap：16px 或 24px
- Data table row height：约 40-48px
- Normal content font size：14px
- Card radius：使用 `--radius` 派生值，不在单页硬编码
- Icon button：尺寸稳定，hover/focus 不改变布局

避免大面积留白、大型营销式标题、装饰性分区和层层嵌套卡片。

## 10. Theme Token

使用 shadcn/ui + Tailwind CSS variables。

默认 token 方向：

| Token | 方向 |
|---|---|
| `background` / `foreground` | 页面背景与默认文字 |
| `card` / `card-foreground` | 卡片、panel、设置块 |
| `popover` / `popover-foreground` | Popover、DropdownMenu、ContextMenu |
| `primary` / `primary-foreground` | 高强调操作、选中态、active accent |
| `secondary` / `secondary-foreground` | 次级操作和辅助 surface |
| `muted` / `muted-foreground` | 说明、placeholder、空状态、弱文本 |
| `accent` / `accent-foreground` | hover、focus、selected item |
| `destructive` | 危险操作、错误强调 |
| `border` | 默认边框、分隔线 |
| `input` | 表单控件边框和输入 surface |
| `ring` | focus ring |
| `chart-1` ... `chart-5` | 图表色板 |
| `sidebar` 系列 | Sidebar surface、text、active、border、focus |
| `radius` | 全局圆角比例 |

不要在页面中随意硬编码颜色。如果需要自定义颜色，必须集中定义在 global CSS token 和 Tailwind theme 暴露层。

## 11. 权限与 RBAC UI

页面实现必须考虑：

- Menu visibility
- Route access
- Button-level permissions
- Field-level read-only logic
- Operation confirmation
- Audit logging needs

权限判断不要硬编码分散在组件中。

角色详情是权限配置的主工作区，不应把“组织与用户绑定”和“权限组绑定”拆散到割裂入口。角色详情至少应通过 `Tabs` 承载组织与用户绑定、权限组绑定和必要的基础信息；如果使用 `DetailSheet`，默认必须填满打开，避免复杂权限配置被压缩在窄抽屉中。

角色属于应用之下的资源。新增角色、编辑角色名称 / key / 描述 / 状态等角色基础信息，应收拢在 `应用管理` 的应用详情或应用下角色清单中；`权限管理` 不重复提供角色元数据创建和编辑入口。

`权限管理` 首页应是角色列表，支持按应用快速筛选和搜索角色。列表打开角色后进入角色授权详情，围绕该角色完成权限组、权限点、飞书组织和飞书用户绑定。页面命名、面包屑和 URL 应体现边界，例如 `应用管理 / 应用详情 / 角色` 负责角色基础管理，`权限管理 / 角色详情 / 权限绑定` 负责授权绑定。

飞书组织与用户绑定必须采用典型组织树选择交互：

- 左侧为待选区，展示飞书组织树和组织下用户。
- 勾选用户表示绑定用户主体；勾选组织表示绑定组织主体，二者必须在交互和已选结果中清晰区分。
- 右侧为已选区，使用“左待选、右已选”的穿梭式布局，清楚展示已选择的用户和组织，并支持移除单项。
- 保存前展示本次变更摘要，例如新增用户、移除用户、新增组织、移除组织和权限组变化。
- 不要用两个互不关联的搜索列表替代组织树，也不要只用按钮文案暗示选择对象类型。

优先使用：

- permission helpers
- permission hooks
- route metadata
- centralized guards

## 12. 飞书同步控制台

`飞书同步` 是面向运维管理者的数据同步控制台，不是系统设置页中的普通状态卡片。页面目标是让运维快速判断同步是否健康、定位本地镜像数据、执行低风险修复动作，并在必要时谨慎触发全量同步。

页面至少应包含：

- 同步总览：配置状态、最近同步、当前运行中任务、有效用户、有效部门、失败风险和运行状态。
- 本地组织 / 用户查询：支持搜索本地飞书部门、用户和关系，支持按部门树查看本地组织结构，支持查看部门下用户、用户所属部门、用户状态、关键字段和最近同步时间。
- 轻量同步操作：支持只同步某个具体部门、只同步某个具体用户或用户增量、刷新字段诊断和配置连通性诊断。
- 全量同步：作为重操作放入高级或危险操作区，不作为日常默认主按钮。触发前必须确认影响范围、预计耗时、审计记录和查看运行状态的方式。
- 同步历史和诊断：列表只展示关键字段，详情展示错误、统计、request id / run id、阶段耗时和诊断建议。

交互规则：

- 运维常用入口应优先是查询、诊断和轻量同步，而不是全量同步。
- 全量同步必须有强确认和审计提示；轻量同步也必须记录操作来源、操作者、目标对象和结果。
- 本地组织 / 用户查询应服务排障，默认展示本地镜像数据，不应让用户误以为是在实时浏览飞书远端通讯录。
- 组织树、用户列表、同步历史和诊断详情必须遵守 DataTable、DetailSheet、复杂交互默认满屏和底部留白规则。
- 不在页面、issue、文档、日志或截图说明中记录明文 secret、token、cookie 或飞书 `app_secret`。

## 13. 项目级组件

构建大量页面前，应先创建或复用项目级组件。

推荐抽象：

- `AppShell`
- `PageHeader`
- `FilterBar`
- `DataTable`
- `DataTableToolbar`
- `FormSheet`
- `StatusBadge`
- `ConfirmAction`
- `PermissionGuard`
- `EmptyState`
- `ErrorState`

规则：

1. 不要在每个页面重复实现 table / filter / form 模式。
2. 不要让每个页面直接堆 shadcn/ui primitives 和 Tailwind class。
3. 重复模式必须封装为项目级组件。
4. 业务页面应只关注业务字段和业务动作。

## 14. 推荐前端目录结构

```text
src/
  app/
  components/
    ui/
    app-shell/
    page-header/
    data-table/
    form-sheet/
    status-badge/
    confirm-action/
    permission-guard/
    empty-state/
    error-state/
  features/
  services/
  hooks/
  types/
  utils/
  router/
  mocks/
```

如果项目后续形成成熟结构，遵守现有结构。不要无明确理由重构目录。

## 15. API 与数据请求 UI 规则

Server state 统一使用 TanStack Query 管理。

推荐模式：

```text
services/applications.ts
hooks/useApplications.ts
features/applications/ApplicationsPage.tsx
```

列表页必须支持：

- pagination
- filters
- sorting
- loading state
- error state
- mutation 后 refresh

不要在 UI 组件中到处分散写 fetch calls。

## 16. Mock Data

如果后端 API 未准备好：

- 使用 mock services。
- mock data 必须放在 UI 组件外部。
- 不要在 page JSX 中硬编码大量数据。
- mock data shape 应尽量接近预期 backend DTO。
- mock-only code 必须有清晰标记。

## 17. 响应式规范

至少考虑：

- 1440px desktop
- 1280px laptop
- 768px tablet

若页面会被手机访问，还需考虑 375px mobile。

规则：

- Desktop：Sidebar 固定，表格信息完整展示。
- Laptop：保留 Sidebar，次要筛选项收起。
- Tablet：Sidebar 可折叠，表格保留关键列，详情进入 Sheet。
- Mobile：表单单列，触控目标不小于 44px，表格改为关键列或紧凑列表。
- 390px 和 768px 检查必须覆盖按钮文字、操作区、表单行和表格操作列；不得出现按钮内部断字、换行、遮挡、异常高度或点击区过小。
- gstack design review 必须检查按钮形态是否符合场景：列表行操作和紧凑区域可纯 icon，其余按钮应为 icon + 文字；同时检查纯 icon 是否有可访问标签、按钮文字是否换行、操作列是否拥挤。

页面不得出现无意义水平滚动。

## 18. 可访问性

必须考虑：

- 所有交互控件支持键盘访问。
- `focus-visible` / `ring` 清晰可见。
- 不使用 `outline: none` 且无替代焦点样式。
- 状态不只靠颜色表达，必须有文字或图标。
- 表单错误靠近对应字段。
- Dialog / Sheet 打开后焦点进入容器，关闭后返回触发按钮。
- 危险操作有确认。
- 触控目标不小于 44px。
- 对比度满足 WCAG AA，正文 4.5:1，大字和 UI 组件 3:1。

## 19. 禁止或不推荐模式

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
- 影响后台操作效率的大面积留白
- Purple / violet / indigo 渐变
- 三列 feature grid
- 装饰性图标圆圈
- 大 hero
- 营销式 slogan
- 为了“shadcn 风格”把所有内容都放进 card

## 20. Pencil 原型要求

Pencil 原型、截图和设计说明统一放在项目根目录 `design/`。

开始实现前端页面前必须：

1. 检查 `design/` 是否存在 Pencil 原型、截图或设计说明。
2. 遵守已确认的 Pencil 页面布局、组件结构、信息密度和交互方式。
3. 不在实现阶段自由重设计 UI。
4. 如果 Pencil 设计与 shadcn/ui 实现边界冲突，说明冲突点，并选择最接近 shadcn/ui composition 的可维护实现方式。
5. 原型未确认前，不直接开始前端页面开发，除非用户明确要求。

每个 Pencil 页面必须包含：

- 页面名称
- 页面用途
- shadcn/ui component composition
- Data table columns
- Filter fields
- Toolbar actions
- Row actions
- Sheet / Dialog interactions
- Form fields
- Permission rules
- Loading / Empty / Error states
- Implementation notes

仅有截图不够，必须同时有实现说明。

## 21. Playwright 视觉 QA

条件允许时，使用 Playwright 做前端验证。

至少检查：

- 1440px desktop
- 1280px laptop
- 768px tablet

每个已实现页面应检查：

- Layout 是否符合 Pencil 原型
- Sidebar 行为是否正确
- Header 和 Breadcrumb 是否正确
- FilterBar 对齐是否正确
- DataTable columns 和 actions 是否可见
- Sheet / Dialog 交互是否可用
- Empty / Loading / Error states 是否存在
- focus ring 是否可见
- 浏览器 console 是否有明显错误

如果页面没有打开并做视觉检查，不应认为前端工作完成。

## 22. 当前阶段设计注意

当前阶段：`v1.0.2` 前端 UI/UX 迭代规划。

本阶段应先写清楚并验证：

- 目标用户
- 主路径
- 页面清单
- 不在本阶段范围内的内容
- 权限边界
- 数据表格列
- 查询筛选项
- Sheet / Dialog / 表单交互
- Loading / Empty / Error / No permission 状态
- 公开问题页的 request id 精简和移动端构图
- 1440px、768px、390px Browser 截图证据

## 23. 设计完成定义

前端设计可进入实现前，必须满足：

1. `DESIGN.md` 已存在并被遵守。
2. `docs/superpowers/specs/2026-05-24-feishu-iam-v0.10.0-admin-web-runtime-rebuild.md` 或对应阶段输入文档已确认。
3. `design/` 下存在已确认 Pencil 原型或截图与说明。
4. 页面级说明包含组件组合、表格列、筛选项、操作、状态和权限规则。
5. 如需偏离本文件，必须说明原因并获得确认。
