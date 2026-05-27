# feishu-iam v0.3.1 Admin Shell Polish Implementation Plan

**Goal:** 交付 `v0.3.1 Admin Shell 外框与顶部栏修复`，关闭 GitHub issue #25，让后台顶部栏信息层级更克制、账户入口更轻量，并修复侧边栏收缩按钮不可用的问题。

**Status:** implemented; fresh verification evidence is recorded under `design/implementation-screenshots/v0.3.1-admin-shell-polish/`.

## Scope

### In Scope

- `src/layouts/AdminLayout.tsx`
  - 将侧边栏 collapsed 改为可交互 state。
  - 给顶部栏收缩按钮补齐 `Button`、`aria-label` 和点击行为。
  - 从顶部栏显眼区域移除 runtime/environment 标签。
- `src/components/UserMenu/index.tsx`
  - 顶部触发器只显示头像和必要用户名。
  - 角色、环境、runtime、open_id 和退出操作保留在下拉层。
- 测试
  - 更新 `src/router/routes.test.tsx` 覆盖按钮切换和首屏不显眼展示调试信息。
  - 更新 `src/components/UserMenu/index.test.tsx` 覆盖下拉层低干扰信息。
- 文档与证据
  - `CHANGELOG.md` 增加 `v0.3.1`。
  - `package.json` bump 到 `0.3.1`。
  - 截图和 QA/review/ship/deploy 证据写入 `design/implementation-screenshots/v0.3.1-admin-shell-polish/`。

### Out Of Scope

- `/directory` 编辑、导入、导出或目录治理。
- 完整 event-driven sync worker、事件积压调度器、告警平台。
- OIDC/JWKS/PKCE/refresh token、SDK/CLI/Helm/Terraform。
- 角色授权、应用接入配置或第三方 Demo 新能力。
- username/password、本地 root 或独立账号体系。

## Tasks

1. 修复 `AdminLayout` collapsed state 和顶部按钮行为。
2. 简化 `UserMenu` trigger，把环境/runtime 信息移入 dropdown。
3. 更新单元测试并运行相关测试。
4. 运行完整前端测试、构建和 `git diff --check`。
5. 启动本地应用，使用浏览器/Playwright 验证桌面、笔记本和平板视口。
6. 写入 design review、QA、pre-landing review、ship 和 deploy 报告。
7. 完成 commit、PR/merge、tag/release、Docker Compose deploy 和健康检查。

## Verification Commands

```bash
npm test
npm run build
npm run server:build
git diff --check
```

UI 验证至少覆盖：

- `/applications` 1440px：顶部栏不显眼展示 runtime/environment，账户入口简洁。
- `/applications` 1280px：菜单展开/收起后布局稳定。
- `/applications` 768px：菜单和内容区无遮挡，账户入口不溢出。
