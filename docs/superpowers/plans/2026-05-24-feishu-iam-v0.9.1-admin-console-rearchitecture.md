# Feishu IAM v0.9.1 管理后台重构工程计划

日期：2026-05-24
状态：ENGINEERING_REVIEWED，待执行计划拆分

## 1. 工程结论

`v0.9.1` 不进入“七个后台模块一次性重写”。工程执行只做第一条可验证 vertical slice：

`shadcn/ui 基础壳层 + 应用接入包主路径`。

该切片覆盖：

- `AppShell`、`Sidebar`、`TopBar`、`PageHeader`、`DataTable`、`FilterBar`、`Sheet`、`AlertDialog`、`SecretRevealPanel` 的项目级基线。
- 应用管理清单、筛选、分页、空态、错误态、加载态和权限视角。
- 创建应用接入包 Sheet：基础信息、回调地址、凭证生成、接入提示词。
- 创建成功后 OAuth `client_secret` 与 developer API secret 的一次性展示。
- 应用详情 Sheet：概览、回调地址、OAuth 凭证、developer API、权限边界、操作记录。
- OAuth secret / developer API secret 轮换确认和轮换成功后一次性展示。

原因：该路径同时覆盖后台重构最关键的表格、表单、凭证、安全文案、抽屉、确认、权限、审计和响应式策略。它跑通后，再决定是否扩展到权限管理、管理员授权、记录查询、系统设置和工作台。

## 2. 当前约束

- 当前 checkout 存在大量既有未提交变更和未跟踪文件；实现前必须明确提交边界，不能重置、覆盖或清理用户变更。
- 最稳妥实现方式是新建干净 worktree，再把已确认的 v0.9.1 设计文档和 Pencil 文件作为输入同步进去。
- 若必须在当前 checkout 实现，只能在明确确认后进行，并且要逐文件检查避免覆盖既有 v0.8.x / v0.9.0 变更。
- 前端当前是 React + Vite + CSS，尚未引入 Tailwind、shadcn/ui、Radix primitives 或 TanStack Table。
- `apps/admin-web/package.json` 当前版本仍是 `0.8.0`，实现阶段需要确认是否随 v0.9.1 更新。

## 3. 不纳入本切片

- 权限管理页面重构。
- 管理员授权页面重构。
- 记录查询、工作台、系统设置重构。
- 后端权限模型、OAuth 协议、飞书同步模型大改。
- HTTPS、反向代理、高可用、滚动升级。
- push、MR、tag、release、Docker 镜像发布或部署。

## 4. 架构和组件边界

### 4.1 技术基线

- UI 使用 shadcn/ui 风格组件，不混用 Ant Design。
- 主题以 Tailwind CSS variables 为事实源，采用 `DESIGN.md` 定义的 neutral admin + 深青绿品牌 token。
- 图标使用 `lucide-react`。
- 表格优先用项目级 `DataTable` wrapper；本切片可以先实现单页所需能力，不做巨型万能表格。
- 表单校验优先保留本地轻量校验；只有在实现时确实需要再引入 Zod 或 React Hook Form，不能为了框架迁移扩大范围。

### 4.2 推荐文件边界

- `apps/admin-web/package.json`：新增本切片需要的 UI 依赖和脚本。
- `apps/admin-web/src/App.css`：收敛为 token、layout 和基础 utility，不继续堆页面级大段样式。
- `apps/admin-web/src/components/ui/*`：放置 shadcn/ui primitives 或等价项目内 primitives。
- `apps/admin-web/src/components/admin/*`：放置 Feishu IAM 后台 wrapper。
- `apps/admin-web/src/routes/ApplicationManagementPage.tsx`：只承载应用接入包主路径。
- `apps/admin-web/src/routes/application-management/*`：拆分创建 Sheet、详情 Sheet、secret 面板、提示词面板和状态视图。
- `apps/admin-web/src/api/*`：优先复用现有 API 封装，只有接口契约缺口明确时才新增。

## 5. 数据流

```text
Admin session
  -> AppShell / route guard
  -> ApplicationManagementPage
  -> fetch application list
  -> DataTable + FilterBar
  -> create application package Sheet
  -> backend create / rotate APIs
  -> SecretRevealPanel one-time display
  -> detail Sheet reloads status and audit summary
```

实现要求：

- 前端不能保存明文 secret 到长期 state、localStorage、sessionStorage、URL 或日志。
- 明文 secret 只存在于创建成功或轮换成功的当前 UI 状态中；关闭后视为过期。
- 复制安全版提示词不得包含明文 secret。
- 回调地址按应用级精确 URL 表达，不恢复 `dev/test/prod` 环境模型。
- 权限不足时，敏感操作按原型指定 hidden、disabled 或 tooltip 处理；后端仍必须兜底校验。

## 6. 边界条件

- 应用列表：loading、empty、error、no result、分页边界、长 `app_key` 和长 URL。
- 创建应用接入包：字段校验失败、回调地址校验失败、提交中、部分凭证生成失败、成功后关闭确认。
- 一次性 secret：复制成功、关闭后过期、轮换成功后进入新一次性展示。
- 详情 Sheet：数据加载失败、无权限深链访问、长 URL 换行、request id 复制。
- 高风险确认：pending、failed、success handoff，不展示明文 secret。
- 响应式：1440 桌面、768 icon rail + 横向滚动、390 全屏 Sheet / 卡片列表 / 44px 触控目标。

## 7. 测试策略

最小检查：

```bash
pnpm --filter @feishu-iam/admin-web typecheck
pnpm --filter @feishu-iam/admin-web test
pnpm check
```

前端测试应覆盖：

- 应用列表正常态、空态、错误态。
- 创建应用接入包成功后显示一次性 secret。
- 关闭一次性 secret 后不再展示明文。
- 复制安全版提示词不包含 secret 占位符以外的明文。
- 详情 Sheet 打开、关闭、轮换确认。
- 权限不足按钮 hidden/disabled/tooltip 的关键路径。

浏览器验证：

- 使用 `gstack /browse` 或 Browser 打开 `http://localhost:3000/`。
- 覆盖 1440、768、390 视口。
- 检查 console、Network、布局溢出、表格横向滚动、Sheet/Dialog 可用性。

## 8. 工程风险

- 当前工作树不干净，直接实现可能覆盖历史变更。
- Tailwind/shadcn 引入会影响 Vite、CSS、测试和 lint 配置。
- 现有 `ApplicationManagementPage.tsx` 已较大，必须先拆边界再重写主路径。
- shadcn/ui DataTable 不是开箱即用企业表格，第一切片只封装必要能力。
- 真实 API 契约如果缺少创建接入包或轮换后的明文返回，需要先查后端现状，不能在前端造假。

## 9. 通过标准

- 设计阶段：`design/admin-console-v0.9.1.pen` 已通过最终 review，作为实现参考稿。
- 工程计划：本文件只锁定第一 vertical slice，不扩展全后台模块。
- 执行计划：下一步需要用 `Superpowers writing-plans` 生成 `IMPLEMENTATION_PLAN.md`，明确文件路径、任务顺序、测试命令和完成标准。
- 实现完成：必须有 fresh typecheck/test/check 和浏览器验证证据。
