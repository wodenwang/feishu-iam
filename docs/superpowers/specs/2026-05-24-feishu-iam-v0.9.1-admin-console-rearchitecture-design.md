# Feishu IAM v0.9.1 管理后台大重构设计

日期：2026-05-24
状态：OFFICE_HOURS_FINALIZED，待设计评审和原型确认

## 1. 版本目标

`v0.9.1` 是 Feishu IAM 管理后台前端的大重构版本。目标不是在旧页面上修补样式，而是根据新的设计规范重建前端设计基线、信息架构、Pencil 原型和实现计划。

一句话边界：

`v0.9.1 = shadcn/ui 组件体系 + tweakcn 主题方向 + 管理后台信息架构重做 + 新 Pencil 原型 + 前端重构实施计划`。

完成后，管理后台应具备现代、克制、可维护的 shadcn/ui Admin Console 基线，并继续服务 Feishu IAM 的核心业务：应用接入、权限授权、管理员治理、审计查询和系统运维。

## 1.1 office-hours 结论

`v0.9.1` 不应直接作为“七个一级模块一次性全后台重写”进入自动执行。当前最小可行切片锁定为：

`shadcn/ui 基础壳层 + 应用接入包主路径`。

该切片包括：

- Feishu IAM 管理后台 AppShell、Sidebar、TopBar、PageHeader、DataTable、FilterBar、Sheet、Dialog、AlertDialog 和 SecretRevealPanel 的项目级基线。
- 应用列表、筛选、分页和状态展示。
- 创建应用接入包流程。
- 创建成功后 `client_secret` 与开发者 API secret 的一次性展示。
- 安全版 Codex 接入提示词复制。
- 应用详情 Sheet。
- OAuth 凭证和开发者 API 凭证轮换确认。

原因：应用接入包主路径同时覆盖 Feishu IAM 管理后台最关键的表格、表单、凭证、提示词、详情、确认、审计和错误状态。该切片跑通后，才能判断 shadcn/ui + tweakcn 是否适合继续推广到权限管理、管理员授权、记录查询、系统设置和工作台。

## 2. 设计来源

本版本遵守以下来源，优先级从高到低：

1. 用户当前要求：使用最新 `my-harness-writing-design`，采用 shadcn/ui 和 tweakcn 风格，重新规划原型并新建 `admin-console-v0.9.1.pen`。
2. `DESIGN.md`：项目级 UI/UX 基线。
3. `design/pencil-input-v0.9.1.md`：v0.9.1 Pencil 原型输入。
4. `design/admin-console-v0.9.1.pen`：v0.9.1 原型源文件。
5. `docs/superpowers/specs/2026-05-22-feishu-iam-v0.8.1-application-onboarding-design.md`：应用接入包和去环境化模型。
6. `docs/superpowers/specs/2026-05-15-feishu-iam-design.md`：Feishu IAM 总体业务和安全边界。

本轮通过官方 shadcn/ui 文档确认：shadcn/ui 以复制进项目的组件代码为核心，Data Table 推荐基于 `Table` 和 TanStack Table 组合实现；组件目录包含 Sidebar、Sheet、Alert Dialog、Data Table、Tabs、Badge、Skeleton、Tooltip 等后台常用 primitives。tweakcn 当前定位为 shadcn/ui 的可视化主题编辑器，可导出 CSS variables，并提供 modern minimal 等预设方向。

## 3. 范围

纳入范围：

- 新建 `DESIGN.md` 并把 shadcn/ui + tweakcn 作为 v0.9.1 设计基线。
- 在 `AGENTS.md` 中补充设计规范入口。
- 新建 `design/admin-console-v0.9.1.pen`，作为独立原型起点。
- 新建 `design/pencil-input-v0.9.1.md`，描述原型页面、交互、主题和组件映射。
- 规划前端重构的实施步骤、验证门禁和风险。
- 后续实现时替换旧 CSS/自研控件为项目拥有的 shadcn/ui 组件体系。

不纳入范围：

- HTTPS、反向代理、高可用、滚动升级。
- 完整 OIDC Discovery、JWKS、ID Token、refresh token、SAML。
- ABAC、资源级权限、deny 规则。
- 飞书用户组同步或飞书角色同步。
- 第三方业务系统页面或第三方业务资源级权限管理。
- 后端核心权限模型大改；除非前端重构暴露出必须补齐的 API 契约。

## 4. UI 技术决策

### 4.1 组件体系

使用 shadcn/ui，不再以 Ant Design / ProComponents 作为 v0.9.1 新页面基线。

原因：

- 用户明确要求采用 shadcn/ui 和 tweakcn 风格。
- shadcn/ui 组件进入项目源码后由项目直接拥有，适合这次大重构统一封装。
- Feishu IAM 当前页面已有大量自研 CSS 和不统一交互，重构时更适合建立项目级 wrapper，而不是继续局部修补。

实施要求：

- 使用 `components/ui/*` 放置 shadcn/ui primitives。
- 使用 `components/admin/*` 或现有组件目录放置 Feishu IAM 项目级 wrapper。
- `DataTable` 不做巨型万能表格；按 shadcn/ui 官方思路使用 TanStack Table 和列定义组合，抽取可复用壳层。
- 高风险操作使用 `AlertDialog`，详情使用 `Sheet`，常规编辑使用 `Dialog` 或 `Sheet`。
- 使用 lucide-react 图标，并为 icon-only 按钮提供 tooltip。

### 4.2 主题

主题采用 tweakcn modern minimal / neutral admin 方向，并吸收 Feishu IAM 既有深青绿品牌。

建议 token：

- `background`: 浅灰绿页面底。
- `foreground`: 深墨绿色正文。
- `card`: 白色或近白。
- `primary`: 深青绿。
- `accent`: 青绿。
- `destructive`: 红色语义色。
- `border` / `input`: 低饱和中性色。
- `sidebar`: 深青绿色。

主题事实源必须是 Tailwind CSS variables，不允许页面散落硬编码色值。

## 5. 信息架构

一级模块保持业务稳定，但重做页面组织：

1. 登录与异常态。
2. 工作台。
3. 应用管理。
4. 权限管理。
5. 管理员授权。
6. 记录查询。
7. 系统设置。

旧版原型和实现可作为业务素材，不作为交互硬约束。v0.9.1 允许重新选择 Sheet、Dialog、局部导航、步骤流程、tab 和 segmented control，只要满足后台管理系统的密度、可扫描性和可验证闭环。

## 6. 页面设计要求

### 6.1 应用管理

应用管理是 v0.9.1 的主路径。

必须支持：

- 应用清单、筛选、分页、状态、负责人、最近使用。
- 创建应用接入包。
- 应用详情和局部导航。
- 回调地址维护。
- OAuth 登录凭证状态和轮换。
- 开发者 API 凭证状态和轮换。
- 完整版和安全版 Codex 接入提示词。
- 应用相关操作记录。

页面不得再出现 `dev`、`test`、`prod` 环境主流程，也不得要求管理员直接理解旧 `client` 模型。

### 6.2 权限管理

权限管理以角色授权关系解释为中心：

- 应用选择。
- IAM 角色列表。
- 角色绑定对象。
- 已生效权限组摘要。
- 绑定权限组弹窗或 Sheet。
- 差异预览和审计提示。

权限点和权限组 CRUD 主要由开发者 API 维护，后台只保留必要的只读解释和绑定能力。

### 6.3 管理员授权

必须清楚区分平台管理员和应用管理员。

授权动作要包含：

- 被授权飞书用户。
- 授权角色。
- 应用作用域。
- 生效状态。
- 影响说明。
- 操作记录。

禁用、恢复、调整作用域必须进入 `AlertDialog`。

### 6.4 记录查询

审计日志、安全事件、同步记录可以同页组织，使用 tabs 或 segmented control。

必须支持：

- request id 查询。
- actor / action / resource / result 筛选。
- 时间范围筛选。
- 详情 Sheet。
- 导出确认。
- 错误和空态。

### 6.5 系统设置

展示运维配置和系统状态，不展示明文 secret。

必须支持：

- 飞书同步配置摘要和立即同步。
- 当前版本、部署模式、数据库版本。
- 安全配置摘要。
- 高风险动作确认和审计提示。

## 7. 实施策略

建议分成三段：

1. 设计段：补齐 `DESIGN.md`、`design/pencil-input-v0.9.1.md`、`design/admin-console-v0.9.1.pen` 和本规格。
2. 基础段：引入 Tailwind、shadcn/ui、主题变量、AppShell 和基础组件。
3. 业务段：逐模块重构页面，并用真实浏览器完成视觉和交互自检。

由于当前工作树存在较多 v0.8.x 未提交变更，正式实现前应创建独立分支或 worktree，例如 `codex/v0.9.1-admin-console-rearchitecture`，避免与既有改动互相覆盖。

## 8. 验收标准

设计验收：

- `DESIGN.md` 存在并说明 shadcn/ui + tweakcn 决策。
- `AGENTS.md` 链接 `DESIGN.md` 和 `design/`。
- `design/admin-console-v0.9.1.pen` 存在。
- `design/pencil-input-v0.9.1.md` 写清页面范围、组件映射、主题和交互。
- 本设计规格和实施计划存在，且无未替换模板变量。

实现验收：

- 新前端页面不混用 Ant Design。
- `pnpm check` 通过，或记录明确阻塞。
- 使用 Browser 打开 `http://localhost:3000/` 自检。
- 覆盖桌面和窄屏下的导航、表格、Sheet、Dialog、确认弹框、空态、错误态和加载态。
- 浏览器 console 无非预期错误，Network 无非预期失败请求。

## 9. 风险

- 当前 `apps/admin-web` 仍是 Vite + CSS 的轻量实现，引入 Tailwind 和 shadcn/ui 会影响构建、lint 和测试配置。
- 当前工作树有大量未提交变更，直接在同一 checkout 开始实现容易覆盖旧工作。
- Pencil MCP 当前不可用，本轮 `.pen` 文件先作为原型起点；后续需要在 Pencil App 可用后继续视觉细化和截图验收。
- shadcn/ui Data Table 不是开箱即用的企业表格，需要项目级封装和清晰列定义，否则容易再次产生页面级重复实现。
