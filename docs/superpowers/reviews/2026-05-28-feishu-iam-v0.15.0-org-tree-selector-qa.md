# Feishu IAM v0.15.0 组织树与组织用户选择器 QA 记录

QA 时间：2026-05-28 17:03

## 结论

QA 循环 1 次，发现 1 个重要问题，已修复 1 个，无遗留阻塞。

## 发现与修复

- 重要：飞书同步页初版实现已视觉接入 `OrgBrowser`，但旧“本地部门树 / 本地用户列表”区域仍以 `hidden` 形式留在 DOM 中，削弱“去掉重复 IA”的验收结论。
- 修复：移除旧列表状态、旧加载函数、隐藏部门树和隐藏用户表格；轻量同步成功后只刷新当前详情，不再依赖旧列表。

## 验证

- `pnpm --filter @feishu-iam/admin-web test -- src/features/settings/SystemSettingsView.test.tsx src/App.test.tsx`：2 个测试文件 57 个测试通过。
- `pnpm --filter @feishu-iam/admin-web build`：通过，仅保留既有 Vite chunk size warning。
- `pnpm check`：通过，API 40 个测试文件 436 个测试通过，admin-web 13 个测试文件 144 个测试通过。
- `ADMIN_WEB_URL=http://127.0.0.1:5173 pnpm --filter @feishu-iam/admin-web test:responsive`：通过，覆盖 12 条后台关键路由和 390、768、1280、1440 宽度视口，`failures: []`。

## 剩余风险

- 本地 Playwright 裸跑如未启动 API 后端会出现预期的 API 500/401，不能作为有效产品验收；最终以自动化测试、响应式脚本和生产部署后入口验证为准。
- #21 继续排除到后续小版本。
