# Feishu IAM v0.10.0 管理后台前端运行时重建规划

日期：2026-05-24
状态：READY_FOR_FIRST_SLICE_IMPLEMENTATION

## 1. 结论

`v0.10.0` 是管理后台前端运行时重建版本，不是 `v0.9.1` 的补丁版本。

`v0.9.1` 已经引入 `DESIGN.md`，并明确要求采用 shadcn/ui + tweakcn，但最终发布代码没有真正完成前端大重构。当前生产后台仍主要运行 `v0.9.0` legacy React + CSS 实现。

`v0.10.0` 的目标必须调整为：

```text
v0.10.0 = 删除并重建管理后台前端 UI 运行时，严格按 DESIGN.md 落地 shadcn/ui + tweakcn + Tailwind。
```

## 2. v0.9.1 偏差复盘

根因不是缺少 `DESIGN.md`，而是设计没有成为前端运行时事实源。

已确认的代码事实：

- `apps/admin-web/package.json` 没有 Tailwind、Radix、class variance authority、tailwind-merge、TanStack Table 等 shadcn/tweakcn 落地依赖。
- `apps/admin-web/src/main.tsx` 仍只引入 `./App.css`，没有 Tailwind 入口样式。
- `apps/admin-web/src/theme.ts` 仍是少量硬编码唐群色值，不是 shadcn/tweakcn token。
- `apps/admin-web/src/components/DataTable.tsx` 是项目自研 table wrapper，不是 shadcn/ui Table + TanStack Table 组合。
- `apps/admin-web/src/components/DetailDrawer.tsx` 是自研抽屉，不是 Sheet/Dialog primitive。
- `apps/admin-web/src/routes/RecordQueryPage.tsx` 仍使用 `admin-page legacy-module-page`、`tab-list`、`tab-button` 和手写 tab 结构。
- `CHANGELOG.md` 和 `README.md` 明确说明 v0.9.1 变基后保留 v0.9.0 完整后台实现，避免旧 first-slice worktree 回退已发布能力。

所以：

- 从不回退已发布能力的角度看，v0.9.1 的合并选择可以解释。
- 从“已经要求 shadcn/ui + tweakcn 重构”的产品验收角度看，这不是正确完成态。
- 如果把 v0.9.1 对外描述为“真实 shadcn/tweakcn 重构已完成”，这是不准确的。

## 3. 用户确认的 v0.10.0 边界

已确认：

1. 允许引入 `react-router`，让模块、筛选、tab 和详情上下文具备刷新、回退和深链能力。
2. 允许删除 `apps/admin-web/src` 下旧页面和旧组件实现，只保留 API client、类型定义和必要测试素材。
3. UI/UX 策划不拘泥之前已经实现的交互方式。
4. Pencil 原型只是参考，实际前端实现按照 tweakcn、shadcn/ui、Tailwind 规范落地，不追求高度还原 Pencil 设计稿。
5. Pencil 原型设计本身也必须严格参照 shadcn/ui 约束，不能自由发挥成与实现体系冲突的视觉稿。

## 4. v0.10.0 版本目标

v0.10.0 只做一件事：把管理后台完整前端运行时重建为 shadcn/ui + tweakcn + Tailwind 体系。

交付后必须满足：

1. 线上管理后台视觉不再是 legacy 后台。
2. 前端依赖、目录、主题、页面组件和浏览器截图都能证明 shadcn/tweakcn 已真实落地。
3. 旧业务能力不回退：未登录态、工作台、应用管理、权限管理、管理员授权、记录查询、系统设置仍可用。
4. 不再用“设计文档已存在”替代“代码已迁移”。
5. 不再让 Pencil 原型反向支配实现；Pencil 只表达流程和状态，最终实现服从 `DESIGN.md` 与 shadcn/tweakcn 组件体系。

## 5. 纳入范围

- 删除并重建前端页面层和 UI 组件层。
- 引入 `react-router`。
- 引入 Tailwind CSS 和 shadcn/ui 所需基础依赖。
- 建立 tweakcn-compatible CSS variables，覆盖 light、sidebar、table、form、sheet、dialog、popover、status token。
- 建立 `components/ui/*` primitives。
- 建立 `components/admin/*` 项目级 wrapper：
  - `AppShell`
  - `PageHeader`
  - `DataTable`
  - `FilterBar`
  - `DetailSheet`
  - `FormDialog`
  - `ConfirmDialog`
  - `SecretRevealPanel`
  - `PageState`
  - `CopyField`
  - `StatusBadge`
- 重建所有管理后台入口和模块：
  - 未登录 / 登录失败 / request id 错误页
  - AppShell / Sidebar / TopBar / PageHeader
  - 工作台
  - 应用管理
  - 权限管理
  - 管理员授权
  - 记录查询
  - 系统设置
- 清理 legacy CSS，避免新页面继续依赖 `legacy-module-page`、`table-wrap`、`tab-button`、`application-detail-drawer` 等旧样式。
- 更新 README、CHANGELOG 和会话归档。
- 构建、测试、浏览器验收、镜像发布和远端部署验证。

## 6. 不纳入范围

- 新增后端权限模型。
- 新增完整 OIDC Discovery、JWKS、ID Token、refresh token 或 SAML。
- HTTPS、反向代理、高可用、滚动升级。
- 飞书角色同步、飞书用户组同步、ABAC、资源级权限。
- 第三方业务系统页面。
- 为了前端重构顺手重构后端服务层。除非前端无法正确表达现有契约，否则后端只做必要 API 补洞。

## 7. 设计与原型原则

### 7.1 DESIGN.md 是唯一设计规范源

`DESIGN.md` 是 v0.10.0 的设计规范源。历史 Pencil 原型、旧页面和 v0.9.0 视觉只能作为业务素材，不能作为最终实现的视觉约束。

### 7.2 UI/UX 可以重新策划

v0.10.0 不需要拘泥旧交互方式。允许重新设计：

- 模块导航。
- 列表与详情关系。
- 详情 Sheet 内部结构。
- Tabs、Segmented Control、Toolbar 的组织方式。
- 创建、编辑、危险操作确认流程。
- 空态、错误态、加载态和权限不足态。

判断标准不是“是否还原旧实现”，而是：

- 是否符合 `DESIGN.md`。
- 是否符合 shadcn/tweakcn 组件组合方式。
- 是否保留后台用户完成任务的效率。
- 是否能用浏览器验收。

### 7.3 Pencil 只做参考，不做像素还原目标

Pencil 原型用于沉淀流程、信息结构和关键状态，不要求前端实现像素级还原。

前端实现优先级：

1. shadcn/ui 官方组件和 composition。
2. tweakcn token 与 neutral admin 风格。
3. Tailwind CSS variables。
4. `DESIGN.md` 的后台密度、可扫描性、状态完整性。
5. Pencil 中表达的业务流程和状态。

如果 Pencil 和 shadcn/tweakcn 实现边界冲突，选择 shadcn/tweakcn 的可维护实现，并在文档中说明取舍。

### 7.4 Pencil 原型也必须受 shadcn 约束

后续 Pencil 原型不能自由发挥成独立视觉体系。原型必须遵守：

- 不使用与 shadcn/tweakcn 冲突的大面积装饰、hero、低密度卡片堆叠或强营销式布局。
- 不设计前端无法用 shadcn primitives 合理组合的控件。
- 不把旧 Ant Design / legacy CSS 视觉重新带回原型。
- 必须覆盖状态矩阵：loading、empty、error、no permission、validation error、confirm pending、success handoff。

## 8. 执行原则

### 8.1 先建立事实源，再迁移页面

v0.10.0 不允许直接在旧 `App.css` 上继续调色。

必须先完成：

```text
Tailwind/shadcn 基础依赖
  -> CSS variables / tweakcn token
  -> ui primitives
  -> admin wrappers
  -> router
  -> 页面迁移
```

### 8.2 保留业务契约，不保留旧视觉实现

允许保留：

- API 封装。
- 类型定义。
- 业务状态机中的领域逻辑。
- 后端错误码映射。
- 已有测试中的业务断言。

需要替换：

- 手写 shell。
- 手写 tab。
- 手写 table markup。
- 手写 drawer/modal。
- 页面级散落 CSS。
- 旧深色顶部栏和厚重后台 chrome。

### 8.3 每个模块都必须真实可验收

不能只迁移应用管理一个页面后声称全后台重构完成。v0.10.0 的验收对象是完整管理后台。

## 9. 分阶段计划

### Phase 0：现场冻结和验收口径

目标：确认 v0.10.0 不再重复 v0.9.1 的偏差。

任务：

- 记录当前线上截图作为 legacy baseline。
- 确认 `DESIGN.md` 中 shadcn/tweakcn 仍是目标基线。
- 确认不再使用过时的 `feishu-iam-admin-ui` skill。
- 明确验收口径：依赖、代码结构、截图和生产环境都必须证明迁移完成。

输出：

- v0.10.0 规划文档。
- v0.10.0 实施计划。

### Phase 1：前端基础设施

目标：让 shadcn/tweakcn 成为运行时事实源。

任务：

- 安装并配置 Tailwind CSS。
- 配置 `components.json` 或等价 shadcn 项目约定。
- 新增 `src/index.css`，导入 Tailwind layers 和 CSS variables。
- 将入口从纯 `App.css` 迁移为 Tailwind global CSS。
- 新增 `lib/utils.ts`，提供 `cn()`。
- 引入基础 primitives：Button、Input、Label、Badge、Table、Tabs、Sheet、Dialog、AlertDialog、Tooltip、Skeleton、DropdownMenu。

验收：

- `pnpm --filter @feishu-iam/admin-web build` 通过。
- `apps/admin-web/package.json` 能看到 shadcn/tweakcn 所需依赖。
- 浏览器中能看到新 token 对 shell、按钮、输入框和表格生效。

### Phase 2：Router 和 Shell

目标：替换 legacy shell，并让模块上下文进入 URL。

任务：

- 引入 `react-router`。
- 建立路由：
  - `/admin`
  - `/admin/applications`
  - `/admin/permissions`
  - `/admin/admins`
  - `/admin/records`
  - `/admin/settings`
- 支持 query 参数承载筛选、tab 和详情上下文。
- 重写 `AppShell`：轻量 Sidebar、克制 TopBar、neutral admin 内容区。
- 建立 `PageHeader`。

验收：

- 当前截图中的厚重顶部深色栏消失。
- 刷新后仍能保留当前模块。
- 深链到记录查询和应用详情上下文可用。
- 390px 下导航和退出登录可用，无页面级横向溢出。

### Phase 3：Admin wrappers

目标：停止每页手写表格、筛选、tab、抽屉和弹窗。

任务：

- 新建 `components/admin/DataTable`。
- 新建 `components/admin/FilterBar`。
- 新建 `components/admin/DetailSheet`。
- 新建 `components/admin/FormDialog`。
- 新建 `components/admin/ConfirmDialog`。
- 新建 `components/admin/PageState`。
- 新建 `components/admin/SecretRevealPanel`。
- 新建 `components/admin/CopyField`。
- 新建 `components/admin/StatusBadge`。

验收：

- 新页面不再直接使用 `table-wrap`、`tab-list`、`tab-button`。
- loading、empty、error、正常数据、分页和操作列统一。
- Sheet/Dialog 具备标题、说明、关闭、提交中、错误展示和焦点行为。

### Phase 4：模块重建

目标：完整迁移已发布后台模块，不回退能力。

推荐顺序：

1. 未登录和错误态：先确保 auth boundary 与 request id 表达稳定。
2. 记录查询：迁移 tab、筛选、四类表格和详情 Sheet，直接解决当前截图暴露的问题。
3. 应用管理：迁移应用接入包、详情 Sheet、OAuth 凭证、developer API 凭证和接入提示词。
4. 权限管理：迁移应用选择、角色列表、绑定权限组/权限点、主体绑定。
5. 管理员授权：迁移授权清单、授权弹窗、禁用/恢复确认。
6. 系统设置：迁移配置摘要、飞书同步、版本信息和高风险动作。
7. 工作台：最后重建，避免先做成低密度 dashboard 风格。

每个模块都必须保留：

- 加载态。
- 空态。
- 错误态。
- 筛选/重置。
- 分页或列表边界。
- 详情 Sheet。
- 高风险确认。
- 审计提示。
- 权限不足状态。

### Phase 5：清理 legacy 和验收

目标：避免“看起来迁移了，实际还靠旧 CSS”。

任务：

- 搜索并清理新页面中的 legacy 类名。
- 对保留的 legacy CSS 写迁移原因和删除计划。
- 用浏览器截图对比 v0.9.1 baseline。
- 运行前端、全仓库检查。

必须执行：

```bash
pnpm --filter @feishu-iam/admin-web typecheck
pnpm --filter @feishu-iam/admin-web test
pnpm --filter @feishu-iam/admin-web build
pnpm check
```

浏览器验收：

- 本地 `http://localhost:3000/`。
- 生产 `http://feishu-iam.dev.tangtring.com/`。
- 1440、768、390 三个视口。
- console 无非预期错误。
- Network 无非预期失败请求。
- 六个模块逐一点击。
- 至少覆盖记录查询、应用管理、权限管理三个高密度模块截图。

### Phase 6：发布和部署

目标：v0.10.0 不是本地完成，而是线上可见。

任务：

- 更新 `CHANGELOG.md`。
- 更新 `README.md` Quick Start、版本历史、镜像和文档索引。
- 创建会话归档。
- 构建并推送多架构镜像。
- 在 `192.168.2.112:~/feishu-iam` 执行停机升级。
- 验证 `/ready`、`/version` 和生产后台 UI。

## 10. v0.10.0 验收清单

功能验收：

- 未登录和登录失败页可用。
- 工作台可打开。
- 应用管理可创建、查看、禁用/启用应用，凭证相关操作不泄露 secret。
- 权限管理可查看并维护角色授权关系。
- 管理员授权可授权、禁用、恢复管理员。
- 记录查询四个 tab 可用，详情 Sheet 可打开。
- 系统设置可查看飞书同步、版本和运维状态。

设计验收：

- 不再呈现 legacy 视觉。
- 页面主体是 neutral admin，品牌深青绿只用于 sidebar、primary 和少量强调。
- 表格、筛选、Sheet、Dialog、AlertDialog、Tabs、Badge、Button、Input 风格一致。
- 长 `app_key`、URL、request id、权限点 key 不撑破布局。
- 移动端触控目标不低于 44px。

工程验收：

- `apps/admin-web/package.json` 包含 shadcn/tweakcn 落地依赖。
- `components/ui/*` 和 `components/admin/*` 存在并被页面真实使用。
- 新页面不再使用 `legacy-module-page`。
- `App.css` 不再承担全部设计系统职责。
- `pnpm check` 通过。
- 生产环境截图和本地截图一致。

发布验收：

- README 已更新到 v0.10.0。
- CHANGELOG 已记录 v0.10.0。
- Docker 镜像已推送。
- 远端已升级。
- `/version` 返回 `0.10.0`。
- 最终回复包含测试、构建、浏览器和远端验证证据。

## 11. 主要风险

- 一次性迁移所有模块风险较高，必须按模块提交和验收，不能最后集中调试。
- 引入 Tailwind/shadcn 会触及构建链路，需先用最小页面证明配置稳定。
- 记录查询和权限管理信息密度高，简单套 card 会降低后台效率，必须保持表格优先。
- shadcn/ui 是源码组件体系，不是安装一个库就完成迁移；必须确保组件代码进入项目并被页面复用。
- 生产验收必须包含真实 Chrome/Browser 截图，否则容易再次出现“文档正确，运行效果不对”的偏差。

## 12. 下一步

下一步应创建 v0.10.0 工程实施计划，按文件和任务拆分到可执行粒度。计划必须包含：

- 分支或 worktree 策略。
- 删除旧前端的精确边界。
- 每个 Phase 的具体文件清单。
- 迁移顺序。
- 测试命令。
- 浏览器验收脚本。
- README / CHANGELOG / release / Docker / 远端部署收口步骤。

## 13. /plan-design-review 修正门禁补充

本节用于关闭上一轮 `GSTACK REVIEW REPORT` 中的 `issues_open`。以下内容是进入 Pencil 原型和后续工程评审前的新增硬约束。

### 13.1 删除 / 保留 / 迁移边界

`v0.10.0` 允许推翻重建管理后台前端运行时，但不是删除业务契约。工程实施前必须按下表执行边界检查。

| 分类 | 范围 | 处理要求 |
|---|---|---|
| 保留 | `apps/admin-web/src/api/*` 或等价 API client | 保留请求路径、错误码解析和认证处理；如函数签名需要调整，必须先在工程计划中列出调用点。 |
| 保留 | `apps/admin-web/src/types/*`、后端生成类型或页面使用的领域类型 | 保留领域字段语义；只允许为新路由和新组件补充 UI 层类型。 |
| 保留 | `apps/admin-web/src/assets/feishu-iam-logo.png` 等真实品牌素材 | 真实 logo 可用于新 AppShell；不得恢复旧 Pencil 占位 logo。 |
| 保留 | 现有测试中的业务断言和 fixture 意图 | 可重写测试文件结构，但不能丢失应用创建、授权、记录查询、凭证安全等核心断言。 |
| 删除重建 | `App.css` 承担的页面级设计系统职责 | `App.css` 不再作为视觉事实源；迁移到 Tailwind global CSS、CSS variables 和 shadcn/tweakcn tokens。 |
| 删除重建 | 旧 shell、旧顶部栏、旧导航、旧页面 class | 不再使用 `legacy-module-page`、`table-wrap`、`tab-list`、`tab-button`、`application-detail-drawer` 等旧视觉类名。 |
| 删除重建 | 自研 `DataTable`、`DetailDrawer`、`FormModal`、`ConfirmDialog` 的视觉和交互层 | 以 shadcn primitives + 项目 wrapper 重建；业务行为可迁移，DOM 和 class 不保留。 |
| 迁移 | 表格列定义、筛选字段、分页参数、详情字段 | 从旧页面抽取为新模块契约，接入 `DataTable`、`FilterBar` 和 URL query。 |
| 迁移 | 权限判断、禁用/启用、审计提示、request id 展示 | 迁移到 `PageState`、`ConfirmDialog`、`StatusBadge`、`DetailSheet` 等 wrapper。 |
| 禁止 | Ant Design、MUI、Chakra、Bootstrap、旧 Pencil 独立视觉体系 | v0.10.0 新页面不得混用其他 UI 框架或把 Pencil 当像素级设计系统。 |

删除动作必须在工程实施计划中列出文件级清单。若某个旧文件临时保留，必须写明保留原因、使用范围和删除条件。

### 13.2 React Router 路由与 query 深链 schema

路由目标是让模块、筛选、tab、分页、排序和详情 Sheet 都能刷新、回退、分享和排障。URL 是状态事实源；组件内部 state 只能作为派生缓存。

| 路由 | 页面 | query schema | 说明 |
|---|---|---|---|
| `/admin` | 管理后台默认入口 | 无 | v0.10.0 第一可信切片阶段默认跳转 `/admin/records`；工作台重建完成后可改为 `/admin/workspace`。 |
| `/admin/workspace` | 工作台 | `range`、`focus` | `range=today\|7d\|30d`；`focus=sync\|apps\|admins\|risks`，用于运营摘要，不承载复杂编辑。 |
| `/admin/records` | 记录查询 | `tab`、`requestId`、`action`、`applicationId`、`result`、`page`、`pageSize`、`sort`、`sheet` | `tab=audit\|security\|sync\|tokens`；`sheet=audit:<id>`、`security:<id>`、`sync:<id>` 或 `token:<id>`。 |
| `/admin/applications` | 应用管理 | `q`、`status`、`owner`、`page`、`pageSize`、`sort`、`sheet` | `sheet=create`、`app:<appKey>`、`client:<clientId>`、`rotate:<clientId>`、`prompt:<appKey>`。 |
| `/admin/permissions` | 权限管理 | `appKey`、`roleId`、`q`、`page`、`pageSize`、`sheet` | `sheet=role:<roleId>`、`subjects:<roleId>`、`groups:<roleId>`、`points:<roleId>`；权限点维护仍以应用开发者 API 为主。 |
| `/admin/admins` | 管理员授权 | `scope`、`q`、`status`、`page`、`pageSize`、`sheet` | `scope=platform\|application`；`sheet=grant`、`admin:<adminUserId>`、`disable:<adminUserId>`、`restore:<adminUserId>`。 |
| `/admin/settings` | 系统设置 | `tab`、`sheet` | `tab=feishu\|sync\|version\|ops`；`sheet=sync-now`、`rotate-config`、`danger-action`。 |

通用 query 规则：

- `page` 从 `1` 开始，`pageSize` 默认 `20`，非法值回退默认值并保留可理解提示。
- `sort` 使用 `<field>:<asc|desc>`，不支持的字段忽略并回退默认排序。
- `sheet` 表达当前打开的详情、创建、确认或凭证动作；关闭 Sheet 时只移除 `sheet`，保留筛选和分页。
- 表单草稿不写入 URL；敏感值、secret、token、cookie 和一次性凭证不得进入 URL。
- 从列表打开详情使用 `navigate({ search })`，浏览器返回必须关闭当前 Sheet 或回到上一筛选状态。
- 无权限访问路由时保留 URL，渲染 `NoPermission`，不静默跳转到工作台。

### 13.3 AppShell / Sidebar / TopBar / PageHeader slot 信息架构

`AppShell` 必须是 shadcn/tweakcn 运行时的第一层组件，不是旧页面的 CSS 包裹。

| 区域 | slot | 内容 | 约束 |
|---|---|---|---|
| Sidebar | Brand | Feishu IAM logo、产品名、简短副标题 | 使用真实 logo；品牌深青绿只用于 sidebar、primary 和少量强调。 |
| Sidebar | Primary Nav | 工作台、应用管理、权限管理、管理员授权、记录查询、系统设置 | 记录查询在第一可信切片中可作为默认落点；最终导航顺序仍按业务模块稳定展示。 |
| Sidebar | Environment | 当前环境、版本短标识 | 不展示 secret；版本详情进入系统设置。 |
| Sidebar | Collapse / Mobile Trigger | 折叠按钮或移动端打开按钮 | 使用 shadcn `Button` + lucide icon；有 accessible label。 |
| TopBar | Context | 当前登录人、角色、平台/应用管理员身份 | 不放大成旧深色顶栏；信息密度克制。 |
| TopBar | Global Actions | 刷新当前页、退出登录、必要帮助入口 | 图标按钮必须有 tooltip；退出登录保持明确文本或菜单项。 |
| TopBar | System Feedback | 全局 loading、离线/请求失败提示 | 不用 toast 承载长期错误；长期错误进入页面状态。 |
| PageHeader | Title | 当前模块标题 | 标题短、稳定，不使用 hero 级排版。 |
| PageHeader | Description | 当前模块一句话说明 | 说明业务对象和操作边界，不写产品宣传语。 |
| PageHeader | Badges | 当前 tab、筛选数、权限状态、环境 | 使用 `Badge`，不堆装饰标签。 |
| PageHeader | Primary Action | 新建应用、授权管理员、同步等主动作 | 每页最多一个主按钮；危险动作不放主按钮。 |
| PageHeader | Secondary Actions | 重置、导出、刷新、复制链接 | 使用 Button variant 和 DropdownMenu，保持操作顺序稳定。 |

响应式规则：

- `>= 1024px`：Sidebar 固定显示，内容区宽度自适应，表格优先横向滚动而不是压缩关键列。
- `768px - 1023px`：Sidebar 可折叠为 icon rail；TopBar 保留登录人和退出入口；PageHeader 主操作可进入更多菜单。
- `< 768px`：Sidebar 以 Sheet 形式打开；PageHeader 标题、说明、主操作垂直排列；FilterBar 改为折叠筛选；表格必须支持横向滚动。
- `390px`：不得出现页面级横向溢出；触控目标不低于 `44px`；长 request id、URL、权限点 key 使用截断、复制和 tooltip/sheet 展示。
- 焦点规则：打开 Sheet/Dialog 后焦点进入标题或首个可操作元素；关闭后回到触发按钮或对应表格行。

### 13.4 模块状态矩阵

状态矩阵是 Pencil 和工程验收的共同门禁。Pencil 可以用画板、局部示意或状态表表达，但不得只画正常态。

| 模块 | loading | empty / no results | error | no permission | validation | confirm | success |
|---|---|---|---|---|---|---|---|
| 未登录 / 登录失败 | 登录检查 Skeleton；飞书跳转 pending | 无可登录入口时显示稳定说明 | 登录失败显示错误码、request id、重试入口 | 已登录但无后台权限显示申请/退出入口 | 回调参数缺失提示字段级或页面级原因 | 退出登录确认不在此页强制展示 | 登录成功跳转保留目标 URL |
| AppShell / 通用框架 | 顶部细粒度 loading，不遮挡整页 | 无模块权限时显示最小可用导航 | 全局 API 失败只影响当前区域 | Sidebar 隐藏无权限模块或进入后显示 no permission | 不承载业务表单校验 | 退出登录或高风险全局动作使用 AlertDialog | 刷新、复制链接等轻操作用 toast/sonner |
| 记录查询 | Tabs 和 DataTable skeleton | 空库、筛选无结果分开；提供重置筛选 | API 失败显示重试、request id | 无审计权限显示 `PageState` | request id/action/app id 输入格式校验 | 导出或高风险查看需要确认时用 AlertDialog | 导出请求创建后显示任务反馈或下载提示 |
| 应用管理 | 列表、详情 Sheet、创建 Dialog 分别 skeleton | 无应用时引导创建；筛选无结果提供重置 | 创建/详情/凭证 API 错误贴近区域展示 | 无创建或凭证权限时禁用/隐藏对应动作并说明 | app key、回调地址、描述、权限前缀字段校验 | 禁用/启用、轮换 secret、关闭一次性 secret 使用 AlertDialog | 创建成功打开接入包；轮换成功只展示一次 secret 并提供复制 |
| 权限管理 | 应用选择、角色表、绑定列表 skeleton | 无角色、无绑定、筛选无结果分别表达 | 角色或绑定加载失败不影响其他区域 | 无维护权限时只读或显示 no permission | 角色 key、名称、绑定对象校验 | 替换 subjects、groups、points 前确认影响范围 | 保存成功回到同一 role Sheet 并保留 tab |
| 管理员授权 | 管理员列表和授权 Sheet skeleton | 无管理员或筛选无结果 | 授权列表/详情失败显示重试 | 非平台管理员显示 no permission | 授权对象、作用域、原因必填校验 | 禁用/恢复/授权前确认并说明审计 | 授权成功定位到新增管理员行 |
| 系统设置 | 配置摘要、版本、同步状态 skeleton | 无同步记录或无配置项时说明原因 | 同步状态、版本接口失败分区展示 | 无运维权限时只读或 no permission | 配置项只显示字段级错误，不展示 secret | 手动同步、危险运维动作必须二次确认 | 同步触发成功显示 run id 或 request id |
| 工作台 | 运营摘要 skeleton | 无近期事件时显示轻量空态 | 某个摘要失败不拖垮整页 | 无某类权限时隐藏对应摘要卡或显示只读说明 | 不承载复杂表单 | 快捷动作跳转到对应模块再确认 | 成功态由目标模块负责，工作台只做跳转反馈 |

跨模块状态规则：

- `loading` 优先使用 `Skeleton`，避免全屏 spinner。
- `empty` 和 `search no results` 必须区分：前者说明系统还没有数据，后者提供重置筛选。
- `error` 必须显示稳定中文说明、重试入口和 request id；不得暴露堆栈、secret、token、cookie。
- `no permission` 不等于空态；必须明确“没有权限查看或操作”。
- `validation` 必须靠近字段展示，提交按钮进入 pending 时禁用重复提交。
- `confirm` 使用 `AlertDialog`，危险动作文案必须说明影响范围和审计记录。
- `success` 必须有明确后继：保留列表位置、打开详情 Sheet、展示一次性凭证或定位到新记录。

### 13.5 Pencil 到 shadcn/tweakcn 组件映射合同

Pencil 原型只能表达流程、布局密度、状态和信息结构，不能成为独立视觉系统。每个 Pencil 画面必须标注所使用的 shadcn primitive 或项目 wrapper。

| Pencil 中的 UI 模式 | 前端实现映射 | Pencil 可表达 | Pencil 不得表达 |
|---|---|---|---|
| 页面壳层 | `AppShell`、`Sidebar`、`TopBar`、`PageHeader` | 导航顺序、slot 内容、响应式示意 | 旧深色厚重顶栏、自由装饰背景、非 token 色块 |
| 一级 / 二级切换 | `Tabs`、`SegmentedControl` 等项目 wrapper | tab 名称、数量、默认项、空/错状态 | 自定义不可访问 tab 或只靠颜色表达选中 |
| 高密度列表 | `DataTable` + shadcn `Table` + TanStack Table | 列优先级、截断、操作列、分页 | 卡片堆叠替代表格主路径 |
| 筛选区 | `FilterBar`、`Input`、`Select`、`DateRange`、`Button` | 筛选字段、重置、展开/收起 | 无字段校验或移动端不可用筛选 |
| 详情 | `DetailSheet` / shadcn `Sheet` | 右侧 Sheet、tabs、复制、审计信息 | 页面中默认占用大块详情导致列表不可扫读 |
| 创建 / 编辑 | `FormDialog`、`Dialog`、`Form`、`Input`、`Textarea` | 字段顺序、校验、提交 pending、成功后继 | 无校验 happy path 表单 |
| 危险确认 | `ConfirmDialog` / `AlertDialog` | 影响范围、确认文案、取消/确认按钮 | `window.confirm`、只有红色按钮没有说明 |
| 密钥展示 | `SecretRevealPanel`、`CopyField`、`Alert` | 一次性展示、复制、关闭风险 | 在 URL、日志、截图示例中出现真实 secret |
| 状态页 | `PageState`、`Skeleton`、`Alert`、`Badge` | loading、empty、error、no permission | 只有正常态，没有状态矩阵 |
| 通知反馈 | `Toast/Sonner`、inline `Alert` | 短反馈与长错误区分 | 用 toast 承载不可恢复的长期错误 |

进入 Pencil 的画板最少应包含：

1. AppShell + Sidebar + TopBar + PageHeader 总体结构。
2. 记录查询正常态、加载态、筛选无结果、错误态、详情 Sheet。
3. 应用管理列表、创建 Dialog、创建成功接入包、应用详情 Sheet、轮换 secret 确认与一次性 secret 展示。
4. 状态矩阵画板或每个模块的状态映射表。
5. 移动端或窄屏参考，至少覆盖 Sidebar Sheet、折叠 FilterBar 和表格横向滚动。

### 13.6 “记录查询 + 应用管理”第一可信切片定义

第一可信切片不是完整 v0.10.0，但必须足以证明新运行时成立。

切片范围：

1. Tailwind、shadcn/ui、tweakcn-compatible tokens、`components/ui/*` 和 `components/admin/*` 基础落地。
2. `react-router` 接管 `/admin`、`/admin/records`、`/admin/applications`，并支持本节定义的 query schema 子集。
3. `AppShell`、`Sidebar`、`TopBar`、`PageHeader` 完成桌面和 390px 可用布局。
4. 记录查询完成四个 tab、筛选、分页、详情 Sheet、loading、empty、error、no-permission。
5. 应用管理完成列表、创建应用、应用详情 Sheet、禁用/启用确认、凭证一次性展示或轮换确认的最小可用路径。
6. legacy class 搜索在切片相关文件中为 0，尤其是 `legacy-module-page`、`table-wrap`、`tab-list`、`tab-button`、`application-detail-drawer`。

切片完成证据：

- `pnpm --filter @feishu-iam/admin-web typecheck` 通过。
- `pnpm --filter @feishu-iam/admin-web test` 通过或说明当前无对应测试并补最小测试计划。
- `pnpm --filter @feishu-iam/admin-web build` 通过。
- 本地浏览器打开 `http://localhost:3000/`，覆盖 1440、768、390 视口。
- 浏览器 console 无非预期错误，Network 无非预期失败请求。
- 截图能证明页面不再是 legacy 后台，并且记录查询与应用管理均使用 shadcn/tweakcn 组件体系。

### 13.7 修正门禁结论

本节补齐后，上一轮 `/plan-design-review` 的阻塞项可以视为已转化为明确规格约束。

明确结论：

- 可以进入 Pencil 原型阶段。
- Pencil 原型必须严格按 `DESIGN.md`、本节路由 / 状态 / 组件映射合同执行。
- Pencil 不追求像素级还原旧稿，不得复用 v0.9.x 的旧 Pencil 视觉作为最终约束。
- Pencil 完成后仍必须执行下一轮 `/plan-design-review on prototype`；只有原型评审通过或问题被明确接受后，才进入 `/plan-eng-review`。

## 14. v0.10.0 Pencil 原型审查

审查对象：`design/admin-console-v0.10.0.pen`

审查日期：2026-05-24

### 原型结构

原型包含 6 个顶层画板：

1. `01 设计系统与组件映射`
2. `02 AppShell 总体结构`
3. `03 记录查询主路径`
4. `04 应用管理主路径`
5. `05 状态矩阵`
6. `06 390px 窄屏参考`

Pencil 结构检查结果：`snapshot_layout(parentId=document, problemsOnly=true)` 返回 `No layout problems.`。

### 评分

| 维度 | 分数 | 结论 |
|---|---:|---|
| 信息架构 | 8/10 | AppShell、记录查询、应用管理三条主线清晰；窄屏工作区状态仍需要补一张更明确的画面。 |
| 状态覆盖 | 9/10 | 状态矩阵覆盖 loading、empty、error、no permission、validation、confirm、success，并明确 request id 和权限态规则。 |
| 用户路径 | 8/10 | 记录查询和应用管理的主路径可读，应用创建后的接入包和 secret 一次性展示合理；未登录 / 登录失败仍只在矩阵表达。 |
| AI Slop 风险 | 9/10 | 没有营销 hero、卡片堆叠或装饰性渐变；整体保持后台表格优先。 |
| 设计系统一致性 | 9/10 | 画板明确映射 shadcn primitives 和项目 wrapper，基本符合 `DESIGN.md` 的 shadcn/tweakcn 约束。 |
| 响应式与可访问性 | 7/10 | 响应式规则写清楚，但 390px 画板主要展示 Sidebar Sheet 打开态，未充分展示关闭 Sheet 后的实际工作区、折叠筛选和横向滚动表格。 |
| 未决设计决策 | 7/10 | 仍需补齐窄屏工作区可用状态；是否单独增加未登录 / 登录失败画板可以在下一轮决定。 |

整体评分：8/10。原型方向正确，但进入 `/plan-eng-review` 前需要修复 1 个阻塞项。

### 必须修复

1. **P1：补齐 390px 窄屏工作区状态。**

   当前 `06 390px 窄屏参考` 已展示 Sidebar Sheet 打开态，但没有清楚展示 Sheet 关闭后的实际业务工作区。工程实现如果只参考当前画板，容易只做出移动端菜单，而漏掉真实操作场景：PageHeader 垂直排列、FilterBar 折叠、DataTable 横向滚动、详情 Sheet 或行操作在窄屏下如何进入。

   修复要求：

   - 在 `06 390px 窄屏参考` 中新增一个并列手机画布，命名为 `390px 手机画布 - Sheet 关闭后的记录查询工作区`。
   - 展示 PageHeader、折叠 FilterBar、DataTable 横向滚动提示、分页或下一页入口。
   - 至少放 1 行长 `request id`，展示截断 + 复制 + 详情 Sheet 入口。
   - 保留现有 Sidebar Sheet 打开态，用来说明导航；新增画布用来说明工作区。

### 建议修复

2. **P2：补一张未登录 / 登录失败入口状态小画板。**

   v0.10.0 版本范围包含未登录、登录失败和 request id 错误页。当前状态矩阵覆盖了规则，但没有独立画面。若时间允许，建议增加 `07 未登录与登录失败状态`，覆盖飞书登录入口、无后台权限、登录失败 request id、重试和退出入口。

3. **P2：在记录查询和应用管理画板上标注 2 个 URL 深链示例。**

   当前规划文档已定义 query schema，但 Pencil 画板没有把深链示例贴到主路径旁。建议在 `03` 和 `04` 分别加入：

   - `/admin/records?tab=audit&page=1&sheet=audit:<id>`
   - `/admin/applications?status=enabled&sheet=app:<appKey>`

   这样工程评审可以直接看到 URL 状态与 Sheet 状态的关系。

### NOT in scope

- 不要求 Pencil 像素级还原最终前端。
- 不要求本轮 Pencil 覆盖权限管理、管理员授权、系统设置、工作台的完整业务画面。
- 不在 Pencil 中展示真实 secret、token、cookie 或生产数据。
- 不在本轮原型审查中进入 React 实现或 Tailwind/shadcn 代码落地。

### What already exists

- `DESIGN.md` 已定义 shadcn/ui + tweakcn neutral admin 设计系统基线。
- 第 13 节已定义删除边界、路由 query schema、AppShell slots、模块状态矩阵和 Pencil 到 shadcn/tweakcn 组件映射合同。
- `design/admin-console-v0.10.0.pen` 已包含 AppShell、记录查询、应用管理、状态矩阵和窄屏参考六个画板。

### Implementation Tasks

Synthesized from this review's findings. Each task derives from a specific finding above.

- [ ] **T1 (P1, human: ~30min / CC: ~10min)** — Pencil prototype — 补齐 390px Sheet 关闭后的记录查询工作区画布
  - Surfaced by: Responsive & Accessibility — 当前 390px 画板主要展示 Sidebar Sheet 打开态，缺少用户实际工作区状态。
  - Files: `design/admin-console-v0.10.0.pen`
  - Verify: `snapshot_layout(parentId=ZtdDN, problemsOnly=true)` 返回 `No layout problems.`，并截图确认折叠 FilterBar、横向滚动表格和详情入口可见。

- [ ] **T2 (P2, human: ~30min / CC: ~10min)** — Pencil prototype — 增加未登录与登录失败状态参考画板
  - Surfaced by: User Journey — v0.10.0 范围包含未登录和登录失败，但当前只在状态矩阵中表达。
  - Files: `design/admin-console-v0.10.0.pen`
  - Verify: 新画板覆盖飞书登录入口、无后台权限、登录失败 request id、重试和退出入口。

- [ ] **T3 (P2, human: ~10min / CC: ~5min)** — Pencil prototype — 在记录查询和应用管理画板标注 URL 深链示例
  - Surfaced by: Information Architecture — 原型已表达路由，但缺少 query 与 Sheet 状态的可视化示例。
  - Files: `design/admin-console-v0.10.0.pen`
  - Verify: `03` 和 `04` 画板分别可见 `/admin/records?...sheet=...` 与 `/admin/applications?...sheet=...` 示例。

## 15. v0.10.0 Pencil 原型复审

复审对象：`design/admin-console-v0.10.0.pen`

复审日期：2026-05-24

复审结论：上一轮 `T1`、`T2`、`T3` 均已关闭，Pencil 原型可以进入工程评审。

### 已关闭问题

| 原问题 | 复审结果 | 证据 |
|---|---|---|
| T1：补齐 390px Sheet 关闭后的记录查询工作区画布 | 已关闭 | `06 390px 窄屏参考` 同时包含 Sidebar Sheet 打开态和 `390px 手机画布 - Sheet 关闭后的记录查询工作区`，展示 PageHeader、折叠筛选、横向滚动 DataTable、长 `request id`、复制入口、详情入口和分页状态。 |
| T2：增加未登录与登录失败状态参考画板 | 已关闭 | 新增 `07 未登录与登录失败状态`，覆盖未登录、无后台权限、登录失败、request id、重新登录、返回登录和退出入口，并明确不得展示裸 JSON、堆栈、secret、token、cookie。 |
| T3：在记录查询和应用管理画板标注 URL 深链示例 | 已关闭 | `03 记录查询主路径` 已标注 `/admin/records?tab=audit&page=1&sheet=audit:<id>`；`04 应用管理主路径` 已标注 `/admin/applications?status=enabled&sheet=app:<appKey>` 和 `/admin/applications?sheet=create`。 |

### 复审评分

| 维度 | 分数 | 结论 |
|---|---:|---|
| 信息架构 | 9/10 | AppShell、Sidebar、TopBar、PageHeader、记录查询、应用管理、状态矩阵和认证失败入口已经形成一致的信息结构。 |
| 状态覆盖 | 9/10 | loading、empty、error、no-permission、validation、confirm、success、未登录和登录失败均有原型表达或矩阵合同。 |
| 用户路径 | 9/10 | `记录查询 + 应用管理` 第一可信切片具备列表、筛选、详情 Sheet、创建 Dialog、一次性 secret 展示、确认和错误恢复路径。 |
| AI Slop 风险 | 9/10 | 画面保持后台管理密度，没有营销页、装饰 hero、大面积渐变或与 shadcn/tweakcn 冲突的独立视觉体系。 |
| 设计系统一致性 | 9/10 | 组件映射合同明确指向 shadcn primitive 和项目 wrapper；Pencil 只作为流程与状态参考。 |
| 响应式与可访问性 | 8.5/10 | 390px 参考已补齐真实工作区；工程实现仍需在浏览器中验证键盘焦点、Sheet/Dialog trap focus、表格横向滚动和文本溢出。 |
| 未决设计决策 | 10/10 | 进入工程评审前没有剩余必须由设计侧决策的问题。 |

整体评分：9/10。

### 进入工程评审的边界

- 可以进入 `/plan-eng-review`。
- 工程评审必须以 `DESIGN.md`、第 13 节运行时合同和本轮 Pencil 原型共同作为输入。
- Pencil 不作为像素级实现稿；工程实现必须落到 shadcn/ui、tweakcn、Tailwind、react-router 和项目 wrapper。
- 进入工程实现前仍不得恢复 v0.9.x legacy 页面、组件和 token 注入路径。

### 本轮无新增任务

本轮复审没有发现新的 P1/P2 设计阻塞项。下一步不是继续扩 Pencil 画面，而是执行 `/plan-eng-review`，把路由、数据契约、组件拆分、测试和迁移顺序锁定为工程计划。

## 16. v0.10.0 工程评审

评审日期：2026-05-24

评审输入：

- `DESIGN.md`
- `docs/superpowers/specs/2026-05-24-feishu-iam-v0.10.0-admin-web-runtime-rebuild.md`
- `design/admin-console-v0.10.0.pen`
- 当前 `apps/admin-web` 代码事实

评审结论：通过。进入实现前仍必须先产出 Superpowers `writing-plans` 实施计划；不得直接开工。

### 当前代码事实

- `apps/admin-web/src/App.tsx` 仍使用本地 `activeRoute` state 驱动模块切换，没有 `react-router`。
- `apps/admin-web/src/main.tsx` 仍只导入 `./App.css`，Tailwind global CSS 尚未接管运行时。
- `apps/admin-web/package.json` 没有 `react-router-dom`、Tailwind、Radix primitives、`class-variance-authority`、`clsx`、`tailwind-merge`、`tailwindcss-animate`、TanStack Table 等 v0.10.0 依赖。
- `RecordQueryPage` 仍使用 `legacy-module-page`、`tab-list`、`tab-button`、`table-wrap`、`application-detail-drawer`。
- `ApplicationManagementPage` 仍使用旧 `DataTable`、`DataToolbar`、`FormModal`、`DetailDrawer` 和旧 class。
- `apps/api/src/admin-web/admin-web.controller.ts` 已支持 `@Get(['/', '/admin', '/admin/*'])` 返回 SPA `index.html`，因此客户端 `/admin/*` 深链具备后端托管基础。
- `apps/admin-web/vite.config.ts` 已代理 `/admin/auth` 到 API，登录、回调、退出路径不能被 React Router 接管。

### 工程决策

1. **采用 BrowserRouter，而不是 hash router。**

   原因：API 已托管 `/admin/*` fallback，生产环境可以刷新深链；hash router 会削弱日志、分享和排障价值。React Router 只接管 SPA 页面，不接管 `/admin/auth/login`、`/admin/auth/feishu/callback`、`/admin/auth/logout`。

2. **URL search params 是模块状态事实源。**

   记录查询和应用管理的 tab、筛选、分页、排序、详情 Sheet、创建 Dialog、轮换确认都从 query schema 解析。组件本地 state 只能保存输入框草稿、pending 状态和短暂复制反馈。关闭 Sheet/Dialog 只移除 `sheet`，不能清空筛选和分页。

3. **先新建 v0.10 运行时，不在旧 `App.css` 上调色。**

   实施顺序必须是：

   ```text
   Tailwind + CSS variables
     -> shadcn ui primitives
     -> admin wrappers
     -> react-router + URL state
     -> 记录查询 + 应用管理第一可信切片
     -> 清理切片 legacy class
     -> 再迁移剩余模块
   ```

4. **旧页面层可以删除重建，但 API client 和业务断言必须保留。**

   `apps/admin-web/src/api/*`、`admin-types.ts`、错误码安全展示、`credentials: 'include'`、一次性 secret 不入 URL、不泄露后端 detail 的测试意图必须迁移。旧 wrapper 的 DOM 和 class 不保留。

5. **第一可信切片只锁定记录查询 + 应用管理。**

   v0.10.0 最终验收仍要求完整后台模块，但第一个实施计划只完成运行时基础、AppShell、记录查询和应用管理。工作台、权限管理、管理员授权、系统设置在后续切片迁移，不允许在第一计划中顺手重写导致失控。

6. **第 7 步优先 `subagent-driven-development`，但要靠实施计划保证边界。**

   可并行的写入边界建议：

   - Lane A：基础设施和主题，只写 package、Tailwind 配置、global CSS、`components/ui/*`、`lib/utils.ts`。
   - Lane B：URL schema 和 router，只写 `src/routes/*` 路由入口、URL state 工具和相关测试。
   - Lane C：admin wrappers，只写 `components/admin/*` 和 wrapper 测试。
   - Lane D：记录查询 feature，只写 `features/records/*`、记录查询页面和记录查询测试。
   - Lane E：应用管理 feature，只写 `features/applications/*`、应用管理页面和应用管理测试。

   `App.test.tsx`、`App.tsx`、`main.tsx`、`App.css` 或 `index.css` 属于共享合并点，不能让多个 subagent 同时改。

7. **`DESIGN.md` 已补 v0.10.0 覆盖说明。**

   评审发现 `DESIGN.md` 仍含 v0.9.1 历史阶段文字，容易误导实现代理。本轮已追加 v0.10.0 决策覆盖说明，并把当前阶段和设计完成定义指向 v0.10.0 规划文档。

### 路由与 query 编解码合同

实施计划必须新增集中式 URL 状态模块，建议文件：

- `apps/admin-web/src/routes/admin-routes.ts`
- `apps/admin-web/src/routes/admin-url-state.ts`

核心 API：

```ts
export type AdminRouteId =
  | 'workspace'
  | 'applications'
  | 'permissions'
  | 'admins'
  | 'records'
  | 'settings';

export type RecordTab = 'audit' | 'security' | 'sync' | 'tokens';
export type RecordSheet =
  | `audit:${string}`
  | `security:${string}`
  | `sync:${string}`
  | `token:${string}`;

export type ApplicationSheet =
  | 'create'
  | `app:${string}`
  | `client:${string}`
  | `rotate:${string}`
  | `prompt:${string}`;
```

编解码规则：

- `parsePositiveInt(value, fallback)`：非法、负数、`0`、小数、非数字全部回退。
- `parseSort(value, allowedFields, fallback)`：只接受 `<field>:asc` 或 `<field>:desc`。
- `setSearchParam(next, key, value)`：空字符串和默认值不写入 URL。
- `withoutSheet(searchParams)`：关闭 Sheet/Dialog 时保留其他 query。
- `sheet` 必须做类型守卫，不支持的 sheet 值忽略并展示轻量提示，不让页面崩溃。
- `secret`、`token`、`cookie`、一次性凭证和表单草稿不得写入 URL。

### 组件结构合同

实施计划必须把 shadcn primitives 和项目 wrapper 分层：

```text
apps/admin-web/src/index.css
apps/admin-web/src/lib/utils.ts
apps/admin-web/src/components/ui/*
apps/admin-web/src/components/admin/AppShell.tsx
apps/admin-web/src/components/admin/PageHeader.tsx
apps/admin-web/src/components/admin/DataTable.tsx
apps/admin-web/src/components/admin/FilterBar.tsx
apps/admin-web/src/components/admin/DetailSheet.tsx
apps/admin-web/src/components/admin/FormDialog.tsx
apps/admin-web/src/components/admin/ConfirmDialog.tsx
apps/admin-web/src/components/admin/SecretRevealPanel.tsx
apps/admin-web/src/components/admin/PageState.tsx
apps/admin-web/src/components/admin/CopyField.tsx
apps/admin-web/src/components/admin/StatusBadge.tsx
```

约束：

- `components/ui/*` 不包含 Feishu IAM 业务词。
- `components/admin/*` 允许包含后台业务语义，但不能直接调用 API。
- `features/*` 允许调用 API client、使用 URL state 和组合 admin wrappers。
- 页面路由只做装配和权限边界，不塞复杂表格和表单逻辑。

### 第一可信切片工程边界

必须包含：

- Tailwind/shadcn/tweakcn 基础依赖和 token。
- `/admin`、`/admin/records`、`/admin/applications` 路由与深链。
- AppShell / Sidebar / TopBar / PageHeader 桌面、平板、390px 基础布局。
- 记录查询四个 tab、筛选、分页、详情 Sheet、loading、empty、error、no-permission。
- 应用管理列表、创建 Dialog、创建成功接入包、应用详情 Sheet、禁用/启用确认、OAuth secret 查看/轮换确认、一次性 secret 展示。
- 切片相关文件中 `legacy-module-page`、`table-wrap`、`tab-list`、`tab-button`、`application-detail-drawer` 搜索结果为 0。

不得包含：

- 顺手重构后端服务层。
- 新增数据库迁移。
- 在第一切片中重写权限管理、管理员授权、系统设置、工作台完整业务。
- 把旧 `components/DataTable.tsx` 等 wrapper 改名后继续当 shadcn 组件使用。

### 测试策略

实施计划必须至少覆盖：

- URL schema 单测：非法 page/pageSize、默认值省略、sort 白名单、sheet 关闭保留筛选、secret 不入 URL。
- API client 安全断言迁移：`credentials: 'include'`、错误码中文 fallback、request id 展示、后端 detail/secret/token 不泄露。
- App 路由测试：`/admin` 默认跳 `/admin/records`；`/admin/records?tab=audit&page=1&sheet=audit:<id>` 打开对应 Sheet；`/admin/applications?sheet=create` 打开创建 Dialog。
- Wrapper 测试：DataTable loading/empty/error/normal/pagination；FormDialog validation/pending/error；ConfirmDialog pending；SecretRevealPanel 一次性展示和复制。
- Feature 测试：记录查询筛选和 tab 切换更新 URL；应用创建成功打开接入包并不把 secret 写入 URL。
- 响应式脚本或浏览器检查：1440、768、390 三个视口无页面级横向溢出。

必跑命令：

```bash
pnpm --filter @feishu-iam/admin-web typecheck
pnpm --filter @feishu-iam/admin-web test
pnpm --filter @feishu-iam/admin-web build
pnpm check
```

浏览器验收：

- 本地 `http://localhost:3000/`。
- 生产 `http://feishu-iam.dev.tangtring.com/`。
- 覆盖 1440、768、390 三个视口。
- console 无非预期错误，Network 无非预期失败请求。
- 记录查询和应用管理必须截图留证。

### ship / land / deploy 风险

- v0.10.0 预计无 DDL，但升级脚本仍会执行镜像内 migration runner；必须确认迁移目录无新增 `V0_10_0__*.sql` 或新增迁移已通过本地和远端。
- README、CHANGELOG、package 版本、`APP_VERSION`、Docker tag、Git tag 必须统一为 `0.10.0` / `v0.10.0`。
- 内网 HTTP Registry 可能导致 `docker buildx imagetools inspect` 走 HTTPS 失败；镜像验证以 `docker pull --platform linux/amd64`、`docker pull --platform linux/arm64` 和远端实际运行作为证据。
- `192.168.2.112` 既往使用 `FEISHU_IAM_PULL_POLICY=never` 和预加载镜像规避 Registry 解析/daemon 配置问题；v0.10.0 部署计划必须先复核远端 `.env`，不要假设远端能直接 pull。
- 部署验收必须同时检查 `http://192.168.2.112:8000/ready`、`http://192.168.2.112:8000/version`、`http://feishu-iam.dev.tangtring.com/ready`、`http://feishu-iam.dev.tangtring.com/version` 和生产后台 UI。

### 工程评审结论

- 可以进入 Superpowers `writing-plans`。
- 实施计划范围限定为 v0.10.0 第一可信切片，不直接扩成所有模块全量重写。
- 第 7 步优先使用 `subagent-driven-development`；若计划生成后发现任务边界重叠，降级为 `executing-plans`。
- 实现完成前必须保留 API client 业务契约和测试意图；完成后再删除切片范围内旧 wrapper 和 legacy class。

## 17. Superpowers writing-plans 输出

实施计划已创建：

- `docs/superpowers/plans/2026-05-24-feishu-iam-v0.10.0-admin-web-first-trusted-slice.md`

计划范围：

- 只实现 v0.10.0 第一可信切片。
- 覆盖运行时基础、`react-router`、URL state、AppShell、记录查询、应用管理和本地浏览器验收。
- 不扩展到权限管理、管理员授权、系统设置、工作台完整迁移。
- 第 7 步优先使用 `superpowers:subagent-driven-development`，并按计划中的 Lane A/B/C/D/E 和 Merge lane 控制文件写入边界。

下一步：

- 使用 `superpowers:subagent-driven-development` 执行该计划。
- 若执行器不能保证共享文件串行合并，降级为 `superpowers:executing-plans`。

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | 未运行；本轮没有发现需要重开产品方向的问题。 |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | — | 未运行。 |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | CLEAN | v0.10.0 工程评审已锁定运行时先行、URL 状态事实源、第一可信切片、测试与发布门禁；Superpowers `writing-plans` 已输出第一可信切片实施计划。 |
| Design Review | `/plan-design-review` | UI/UX gaps | 4 | CLEAN | v0.10.0 Pencil 原型复审评分 9/10，上一轮 1 个 P1 和 2 个 P2 已关闭，无新增设计阻塞项。 |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | 未运行。 |

- **UNRESOLVED:** 0。
- **VERDICT:** READY FOR FIRST SLICE IMPLEMENTATION。下一步执行 Superpowers `subagent-driven-development`；若共享文件合并风险不可控，则降级为 `executing-plans`。
