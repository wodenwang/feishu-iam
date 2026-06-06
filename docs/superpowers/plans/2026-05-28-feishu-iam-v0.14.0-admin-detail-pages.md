# Feishu IAM v0.14.0 后台导航补齐与重交互详情页 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use Superpowers `executing-plans` to implement this plan task-by-task. 本版本涉及共享路由、导航和两个业务模块，文件边界强耦合，不使用并行 subagent 写代码。

**Goal:** 发布 `v0.14.0`，合并处理 GitLab issue `#16/#6/#7/#9`：系统管理导航补齐，应用详情和角色详情从右侧抽屉升级为独立详情页。

**Architecture:** 不改后端 DDL，不改变权限模型和 SSO。前端在现有 React + Vite + react-router + shadcn/ui + Tailwind 内新增详情路由，复用现有应用/角色详情逻辑，把默认承载从 `DetailSheet` 改为独立页面。

**Tech Stack:** React 19、Vite、react-router、Tailwind、shadcn/ui wrappers、lucide-react、Vitest、Testing Library、Playwright 响应式脚本、Browser 自检。

## 1. 输入工件

- `docs/superpowers/specs/2026-05-28-feishu-iam-v0.14.0-admin-detail-pages.md`
- `docs/superpowers/reviews/2026-05-28-feishu-iam-v0.14.0-admin-detail-pages-design-review.md`
- `docs/superpowers/reviews/2026-05-28-feishu-iam-v0.14.0-admin-detail-pages-eng-review.md`
- `design/v0.11.2-application-ops-prototype.md`
- `design/v0.11.3-role-authorization-prototype.md`
- `design/v0.13.1-sidebar-nav-prototype.md`
- GitLab issue `#16/#6/#7/#9`

## 2. 范围边界

纳入：

- 系统管理导航父级整行展开收起、二级图标、树形层级。
- `/admin/applications/:appKey` 独立应用详情页。
- `/admin/permissions/:appKey/roles/:roleId` 独立角色详情页。
- 列表返回上下文保留。
- 角色详情 Tab 状态进入 URL；应用详情先以独立页面承载既有应用配置分区。
- 自动化测试、Browser 自检、版本发布和 112 部署。

排除：

- 后端 DDL、Prisma schema、新权限模型。
- 完整 OIDC、SAML、ABAC、资源级权限。
- 飞书角色同步、飞书用户组同步。
- HTTPS、反向代理、高可用、滚动升级。
- 权限管理中的角色元数据新增、编辑或启停。

## 3. 文件结构

### 前端导航

- Modify: `apps/admin-web/src/routes/admin-routes.ts`
  - 为系统二级路由配置 icon 字段，或在 App 层建立二级 icon 映射。
- Modify: `apps/admin-web/src/components/admin/AppShell.tsx`
  - 父级整行展开 / 收起。
  - 子项图标。
  - 树形缩进和层级线。
  - 当前系统二级页父级 active。

### 应用详情

- Modify: `apps/admin-web/src/App.tsx`
  - 新增 `/admin/applications/:appKey` 路由。
- Modify/Create: `apps/admin-web/src/routes/ApplicationManagementPage.tsx`
- Create: `apps/admin-web/src/routes/ApplicationDetailPage.tsx`
- Modify/Create: `apps/admin-web/src/features/applications/ApplicationDetailPage.tsx`
- Modify: `apps/admin-web/src/features/applications/ApplicationManagementView.tsx`
  - 详情按钮导航到独立详情页。
  - 移除默认详情抽屉入口。
  - 兼容旧 `sheet=app:*` 时跳转。

### 角色详情

- Modify: `apps/admin-web/src/App.tsx`
  - 新增 `/admin/permissions/:appKey/roles/:roleId` 路由。
- Create: `apps/admin-web/src/routes/PermissionRoleDetailPage.tsx`
- Modify/Create: `apps/admin-web/src/features/permissions/PermissionRoleDetailPage.tsx`
- Modify: `apps/admin-web/src/features/permissions/PermissionManagementView.tsx`
  - 详情按钮导航到独立详情页。
  - 移除默认详情抽屉入口。
  - 兼容旧 `sheet=role:*` 时跳转。

### URL 状态

- Modify: `apps/admin-web/src/routes/admin-url-state.ts`
  - 增加角色详情 Tab、列表返回上下文 helper。
- Modify: `apps/admin-web/src/routes/admin-url-state.test.ts`

### 测试

- Modify: `apps/admin-web/src/components/admin/admin-components.test.tsx`
- Modify: `apps/admin-web/src/App.test.tsx`
- Modify: `apps/admin-web/src/features/applications/ApplicationManagementView.test.tsx`
- Modify: `apps/admin-web/src/features/permissions/PermissionManagementView.test.tsx`

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
- Create: `docs/codex-sessions/YYYY-MM-DD-HHMM-v0.14.0后台详情页重构.md`

## 4. 任务清单

- [x] **Task 1: 导航 S1**
  - 系统管理父级整行展开 / 收起。
  - 二级菜单补图标。
  - 树形层级视觉和移动端 Sheet。
  - 更新 AppShell 测试。

- [x] **Task 2: URL 状态和路由骨架**
  - 新增应用详情和角色详情路由。
  - 增加角色详情 Tab 状态和返回上下文 helper。
  - 旧 sheet 深链兼容跳转。
  - 更新路由测试。

- [x] **Task 3: 应用详情独立页**
  - 复用/迁移 `ApplicationDetailSheet` 核心交互。
  - 独立页面承载既有应用配置分区。
  - 返回列表上下文。
  - 基础信息、回调地址、凭证、提示词、角色、状态操作可用。
  - 更新应用管理测试。

- [x] **Task 4: 角色详情独立页**
  - 复用/迁移 `PermissionRoleDetailSheet` 核心交互。
  - Tab 化详情页。
  - 返回列表上下文。
  - 组织与用户绑定、权限组绑定、保存确认可用。
  - 更新权限管理测试。

- [x] **Task 5: 本地验证**
  - 前端定向测试。
  - admin-web build。
  - `pnpm check`。
  - 响应式检查。

- [x] **Task 6: Browser / design / QA / review**
  - Browser 覆盖桌面、移动、导航、应用详情、角色详情。
  - design-review：高优先级问题修复。
  - qa：功能问题修复。
  - review：diff 风险修复。

- [x] **Task 7: 版本收口**
  - 更新版本号到 `0.14.0` / `v0.14.0`。
  - README、CHANGELOG、AGENTS、会话归档同步。
  - 敏感信息和模板变量扫描。
  - 已补齐 README、CHANGELOG 中的镜像 digest、GitLab Release 和 112 验收证据。

- [x] **Task 8: GitLab 发布和 112 部署**
  - 提交并推送分支。
  - 创建 MR，合并到 `main`。
  - 创建 tag 和 release。
  - 构建并推送多架构镜像。
  - 在 `192.168.2.112:~/feishu-iam` 停机升级。
  - 验证 `/ready`、`/version` 和线上后台。
  - 已关闭 GitLab issue `#16/#6/#7/#9`，关闭说明引用 `v0.14.0` Release、镜像 digest 和 112 验收结果。

## 5. 验证命令

```bash
pnpm --filter @feishu-iam/admin-web test -- src/components/admin/admin-components.test.tsx src/App.test.tsx src/routes/admin-url-state.test.ts src/features/applications/ApplicationManagementView.test.tsx src/features/permissions/PermissionManagementView.test.tsx
pnpm --filter @feishu-iam/admin-web build
ADMIN_WEB_URL=http://127.0.0.1:5173 pnpm --filter @feishu-iam/admin-web test:responsive
pnpm check
```

## 6. 完成标准

- `#16/#6/#7/#9` 的验收项均有实现和验证证据。
- 应用详情和角色详情默认不再使用右侧抽屉。
- 刷新详情页后能恢复目标资源；角色详情能恢复 Tab。
- 返回列表保留上下文。
- 权限管理不出现角色元数据新增、编辑或启停入口。
- Browser 自检、design-review、qa、review 均完成且无未处理阻塞问题。
- GitLab MR、tag、release、镜像和 `192.168.2.112` 部署验证完成。
