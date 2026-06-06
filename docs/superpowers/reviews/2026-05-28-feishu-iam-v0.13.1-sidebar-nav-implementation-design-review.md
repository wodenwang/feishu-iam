# Feishu IAM v0.13.1 左侧导航层级实现设计复审

日期：2026-05-28
状态：通过，已完成一轮问题修复和复验

## 1. 评审对象

- 本地地址：`http://localhost:3000/admin/system/audit`（临时 mock API 代理到 Vite 页面资源）
- 核心实现：`apps/admin-web/src/components/admin/AppShell.tsx`
- 浏览器截图：
  - `design/exports/v0.13.1-sidebar-nav/browser-qa/desktop-audit.jpg`
  - `design/exports/v0.13.1-sidebar-nav/browser-qa/collapsed-sidebar.jpg`
  - `design/exports/v0.13.1-sidebar-nav/browser-qa/mobile-drawer-fixed.jpg`

## 2. 首轮结论

桌面展开态、桌面收缩态和当前二级页语义基本正确，但移动端 Sheet 暴露一个重要视觉问题：

- 移动 Sheet 背景是浅色面板，`PrimaryNav` 仍使用 `text-sidebar-foreground/80` 等深色侧栏 token，导致未激活二级菜单在浅色背景上可读性不足，视觉上接近消失。

该问题会影响窄屏用户识别 `系统管理` 下的完整二级入口，属于必须修复项。

## 3. 修复结果

已在 `PrimaryNav` 增加 `tone` 参数：

- 桌面深色侧栏继续使用 `sidebar` tone。
- 移动 Sheet 使用 `surface` tone。
- 移动端未激活二级菜单使用 `text-muted-foreground`。
- 移动端当前父级和当前子级使用 `bg-primary text-primary-foreground`。
- 移动主菜单 Sheet 补充 `SheetDescription` 的 sr-only 描述，避免无障碍告警。

## 4. 复验结果

复验截图 `mobile-drawer-fixed.jpg` 显示：

- `工作台 / 应用管理 / 权限管理 / 系统管理` 一级入口可见。
- `飞书同步 / 管理员授权 / 操作审计 / 系统信息` 四个二级入口完整可见。
- 当前页 `操作审计` 高亮清晰。
- 390px 视口下页面 `scrollWidth = 390`，未发现横向溢出。

桌面截图 `desktop-audit.jpg` 显示：

- `系统管理` 作为父级分组展示。
- `操作审计` 是唯一 `aria-current="page"` 的当前项。
- 父级不抢占 `aria-current`，但保留上下文高亮。

收缩态截图 `collapsed-sidebar.jpg` 显示：

- 左侧主菜单宽度固定为 80px。
- 二级 link 不在收缩态主导航 DOM 中直接展示，避免窄栏挤压。

## 5. 剩余设计风险

无阻塞风险。收缩态 tooltip 的真实 hover 可见性已由组件测试覆盖；Browser 的受限 hover API 未能稳定触发 Radix tooltip，但收缩态结构、标题和 tooltip 内容均已有自动化断言。
