# Feishu IAM v0.13.1 左侧导航层级工程评审

日期：2026-05-28
状态：通过，可进入实施计划

## 1. 评审对象

- 规格：`docs/superpowers/specs/2026-05-28-feishu-iam-v0.13.1-sidebar-nav.md`
- 设计评审：`docs/superpowers/reviews/2026-05-28-feishu-iam-v0.13.1-sidebar-nav-design-review.md`
- 原型：`design/admin-console-v0.13.1.pen`
- 原型复审：`docs/superpowers/reviews/2026-05-28-feishu-iam-v0.13.1-sidebar-nav-prototype-review.md`
- 主要代码：`apps/admin-web/src/components/admin/AppShell.tsx`
- 路由事实源：`apps/admin-web/src/routes/admin-routes.ts`

## 2. 总体结论

可以进入实施。`v0.13.1` 不需要后端、DDL 或部署拓扑改动，工程风险集中在 `AppShell` 的导航渲染、可访问性和响应式测试。

建议不新增 `@radix-ui/react-collapsible` 依赖。当前需求可以用原生 React state、`button`、`aria-expanded`、现有 `Tooltip` 和现有 `Sheet` 完成。避免为小版本引入新依赖和 lockfile 风险。

## 3. 推荐实现方案

### 3.1 组件边界

在 `AppShell.tsx` 内拆出以下局部组件或函数：

- `PrimaryNav`：保留主入口。
- `SidebarNavItem`：负责单个一级项。
- `SidebarChildNav`：负责二级菜单列表。
- `CollapsedNavTooltipContent`：负责收缩态 tooltip 内容。

如果实现后 `AppShell.tsx` 过大，再考虑把 `SidebarNav` 单独提到 `apps/admin-web/src/components/admin/SidebarNav.tsx`。本版本不强制拆文件，避免无意义重构。

### 3.2 展开状态

- 新增 `expandedGroups` 状态，key 使用一级项 `href`。
- 初始状态：包含 active child 的父级默认展开。
- 派生规则：如果 `item.active === true` 且存在 active child，则父级必须展开，用户不能通过折叠让当前路径失去上下文。
- 非当前父级允许展开/收起。
- 展开按钮使用中文 `aria-label`，例如 `展开系统管理子菜单` / `收起系统管理子菜单`。
- 展开按钮设置 `aria-expanded`，并用 `aria-controls` 指向二级菜单容器 id。

### 3.3 父级链接和展开按钮

父级行保留 `Link`，保持现有 “系统管理” 可点击跳转到默认路径 `/admin/system/info` 的行为。

同时在行尾提供独立 chevron button：

- 点击文字或图标区域：跳转父级默认页。
- 点击 chevron：展开/收起二级菜单。

这样不破坏现有测试里对 `getByRole("link", { name: "系统管理" })` 的假设，也避免把链接伪装成按钮。

### 3.4 收缩态

收缩态不展示二级列表，但父级图标必须保留 active 背景。

Tooltip 内容不只显示 `系统管理`，还要列出二级入口摘要：

```text
系统管理
飞书同步 / 管理员授权 / 操作审计 / 系统信息
```

Tooltip 只是视觉辅助，`Link` 仍保留 `aria-label="系统管理"`。

### 3.5 移动端

移动端 Sheet 不使用桌面收缩态逻辑，直接以非收缩模式渲染完整层级。

如果移动端处于系统管理二级页，父级自动展开。

## 4. 测试策略

### 4.1 单元/组件测试

更新 `apps/admin-web/src/components/admin/admin-components.test.tsx`：

- expanded state 下系统管理二级菜单可见。
- 点击 chevron 后二级菜单收起，再点击后展开。
- 当前二级项 active 时，父级强制展开并保留 `aria-current="page"`。
- 展开按钮存在 `aria-expanded` 和正确 accessible name。
- 收缩主菜单后二级 link 不在主导航中，但 tooltip 内容能说明二级入口。

### 4.2 App 路由测试

更新 `apps/admin-web/src/App.test.tsx`：

- `/admin/system/audit` 首次渲染后系统管理父级展开，操作审计高亮。
- `/admin/settings?tab=feishu` 旧路由仍跳转到飞书同步，并保持系统管理父级展开。

### 4.3 响应式和浏览器验证

- 运行 `pnpm --filter @feishu-iam/admin-web test`。
- 运行 `pnpm --filter @feishu-iam/admin-web build`。
- 运行 `ADMIN_WEB_URL=http://127.0.0.1:5173 pnpm --filter @feishu-iam/admin-web test:responsive`。
- 使用 `@Browser` 打开 `http://localhost:3000/` 或实际 dev server 地址，覆盖：
  - 桌面展开。
  - 桌面收缩。
  - 系统管理展开/收起。
  - 刷新 `/admin/system/audit`。
  - 390px 移动端 Sheet。
  - console 和 network。

## 5. 风险和应对

| 风险 | 影响 | 应对 |
| --- | --- | --- |
| 父级同时是链接和可展开控件，交互冲突 | 用户误点或测试不稳定 | 保留 Link，chevron 独立 button，语义分离 |
| 当前二级页被用户折叠后失去上下文 | 回归 `#12` | active child 强制父级展开 |
| 收缩态完全不可发现二级入口 | 回归 `#12` | tooltip 展示二级入口摘要 |
| 移动端复用收缩态导致只剩图标 | 窄屏不可用 | 移动 Sheet 固定渲染完整层级 |
| 引入新依赖造成 lockfile churn | 小版本变复杂 | 不新增 Collapsible 依赖 |

## 6. 通过条件

工程评审通过。下一步进入 Superpowers `writing-plans`，生成 `IMPLEMENTATION_PLAN.md`，再按计划实施。
