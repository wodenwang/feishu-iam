# Feishu IAM v0.13.1 左侧导航层级修复 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use Superpowers `executing-plans` to implement this plan task-by-task. 本版本改动集中且文件边界强耦合，不使用 subagent 并行写代码。

**Goal:** 修复 GitLab issue `#12`，让 Feishu IAM 后台左侧导航清楚表达一级目录和二级目录，并完成小版本发布部署。

**Architecture:** 不改后端、不改 DDL、不新增 API。前端在现有 React + Vite + shadcn/ui + Tailwind + react-router 体系内重构 `AppShell` 导航渲染。路由事实源继续是 `adminRoutes`，导航状态由 `AppShell` 根据 active route 和用户展开状态派生。

**Tech Stack:** React 19、Vite、Tailwind、shadcn/ui wrappers、lucide-react、Vitest、Testing Library、Playwright 响应式脚本、Browser 自检。

---

## 1. 输入工件

- `docs/superpowers/specs/2026-05-28-feishu-iam-v0.13.1-sidebar-nav.md`
- `docs/superpowers/reviews/2026-05-28-feishu-iam-v0.13.1-sidebar-nav-design-review.md`
- `design/admin-console-v0.13.1.pen`
- `design/v0.13.1-sidebar-nav-prototype.md`
- `docs/superpowers/reviews/2026-05-28-feishu-iam-v0.13.1-sidebar-nav-prototype-review.md`
- `docs/superpowers/reviews/2026-05-28-feishu-iam-v0.13.1-sidebar-nav-eng-review.md`
- GitLab issue `#12`

## 2. 范围边界

纳入：

- `AppShell` 一级/二级导航结构。
- 桌面展开、桌面收缩、移动端 Sheet。
- `aria-expanded`、`aria-controls`、`aria-current` 和 tooltip。
- 组件测试、App 路由测试、响应式检查、Browser 自检。
- `v0.13.1` 版本材料、镜像、GitLab release 和 112 部署。

排除：

- 后端 DDL、Prisma、NestJS API。
- 飞书同步业务逻辑。
- 应用管理、权限管理、角色授权工作区业务能力。
- 完整 OIDC、SAML、ABAC、资源级权限、HTTPS、高可用或滚动升级。

## 3. 文件结构

### 前端实现

- Modify: `apps/admin-web/src/components/admin/AppShell.tsx`
  - 拆分一级项和二级项渲染。
  - 对带 children 的一级项增加独立展开按钮。
  - 当前 active child 强制父级展开。
  - 收缩态 tooltip 展示二级入口摘要。
  - 移动端非收缩渲染完整层级。

### 测试

- Modify: `apps/admin-web/src/components/admin/admin-components.test.tsx`
  - 覆盖展开/收起、`aria-expanded`、active child 强制展开、收缩态 tooltip。
- Modify: `apps/admin-web/src/App.test.tsx`
  - 覆盖 `/admin/system/audit` 刷新后导航状态。
  - 覆盖旧路由跳转到系统管理二级页后的导航状态。

### 文档和版本

- Modify: `IMPLEMENTATION_PLAN.md`
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Modify: `AGENTS.md`
- Modify: `package.json`
- Modify: `apps/api/package.json`
- Modify: `apps/admin-web/package.json`
- Modify: `deploy/.env.example`
- Modify: `deploy/install.sh`
- Create: `docs/codex-sessions/YYYY-MM-DD-HHMM-v0.13.1左侧导航层级修复.md`

## 4. 任务清单

- [ ] **Task 1: AppShell 导航结构重构**
  - 保留父级 `Link`。
  - 为带 children 的父级增加 chevron `button`。
  - 展开按钮具备 `aria-expanded`、`aria-controls`、中文 `aria-label`。
  - 当前 active child 父级强制展开。

- [ ] **Task 2: 桌面收缩态和移动端层级**
  - 收缩态隐藏二级 link，但 tooltip 展示二级入口摘要。
  - 移动端 Sheet 渲染完整层级，不使用收缩态逻辑。
  - 当前系统管理二级页父级 active。

- [ ] **Task 3: 自动化测试**
  - 更新组件测试。
  - 更新 App 路由测试。
  - 运行定向测试。

- [ ] **Task 4: 浏览器和视觉 QA**
  - 启动本地 admin-web。
  - 使用 Browser 检查桌面展开、桌面收缩、系统管理展开/收起、深链刷新、移动端 Sheet。
  - 修复 console、network、布局和可访问性问题。

- [ ] **Task 5: 评审循环**
  - design-review：有高优先级问题则修复并复审。
  - qa：有功能问题则修复并复测。
  - review：有 diff 风险则修复并复审。

- [ ] **Task 6: 版本收口**
  - 版本号更新为 `0.13.1` / `v0.13.1`。
  - README、CHANGELOG、AGENTS、会话归档同步。
  - `pnpm check` 通过。

- [ ] **Task 7: GitLab 发布和部署**
  - 提交并推送分支。
  - 创建 MR，合并到 `main`。
  - 创建 tag 和 release。
  - 构建并推送多架构镜像。
  - 在 `192.168.2.112:~/feishu-iam` 停机升级。
  - 验证 `/ready`、`/version` 和线上后台导航。

## 5. 验证命令

```bash
pnpm --filter @feishu-iam/admin-web test -- src/components/admin/admin-components.test.tsx src/App.test.tsx
pnpm --filter @feishu-iam/admin-web build
ADMIN_WEB_URL=http://127.0.0.1:5173 pnpm --filter @feishu-iam/admin-web test:responsive
pnpm check
```

## 6. 完成标准

- 桌面展开态：`系统管理` 是明确一级分组，二级菜单收拢在其下。
- 桌面折叠分组：可展开/收起，且不会让当前二级页失去父级上下文。
- 桌面收缩态：`系统管理` 图标 active，tooltip 提示二级入口摘要。
- 移动端：Sheet 内完整展示一级/二级层级。
- 深链刷新：`/admin/system/audit` 自动展开父级并高亮 `操作审计`。
- 旧路由兼容不回退。
- Browser 自检、design-review、qa、review 均完成且无未处理阻塞问题。
- GitLab、镜像、release 和 112 部署验证完成。
