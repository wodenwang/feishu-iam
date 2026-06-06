# Feishu IAM v0.14.1 应用详情 Tab 化 QA 记录

日期：2026-05-28
状态：通过

## QA 范围

本轮 QA 聚焦 GitLab issue `#17`：应用详情页需要 Tab 化，避免独立详情页内容过长。

覆盖路径：

- `/admin/applications/crm?from=/admin/applications`
- `/admin/applications/crm?from=/admin/applications&tab=roles`
- `/admin/applications/crm?from=/admin/applications&tab=development`
- `/admin/applications/crm?from=/admin/applications&tab=danger`
- 旧抽屉兼容入口 `sheet=app:*`

覆盖视口：

- mobile：390x844
- narrow：768x900
- desktop：1280x900
- wide：1440x900

## Playwright 浏览器自检

当前环境没有可调用的 Browser 工具，且本机未接入真实飞书管理员 session；因此按 harness 第 9 步使用 Playwright fallback，并沿用仓库响应式检查里的 API mock 方式验证真实 Vite 页面。

验证结果：

- 默认进入应用详情时选中 `详细资料`。
- `tab=roles` 选中 `角色管理`，并展示角色列表。
- `tab=development` 选中 `开发信息`，并展示回调地址、OAuth credential、Developer credential 和安全版接入提示词。
- `tab=danger` 选中 `危险操作`，并展示停用应用操作。
- 390px 移动视口下 `开发信息` 可用，长回调地址换行显示。
- Playwright 自检未发现 console error、request failed 或页面级横向溢出。

截图证据：

- `design/exports/v0.14.1-application-detail-tabs/browser-qa/details-desktop.png`
- `design/exports/v0.14.1-application-detail-tabs/browser-qa/roles-desktop.png`
- `design/exports/v0.14.1-application-detail-tabs/browser-qa/development-desktop.png`
- `design/exports/v0.14.1-application-detail-tabs/browser-qa/danger-desktop.png`
- `design/exports/v0.14.1-application-detail-tabs/browser-qa/development-mobile.png`

## 自动化验证

已执行：

```bash
pnpm --filter @feishu-iam/admin-web test -- src/features/applications/ApplicationManagementView.test.tsx src/App.test.tsx
pnpm --filter @feishu-iam/admin-web build
pnpm check
ADMIN_WEB_URL=http://127.0.0.1:5173 pnpm --filter @feishu-iam/admin-web test:responsive
```

结果：

- 前端定向测试：2 个测试文件、59 个测试通过。
- `pnpm --filter @feishu-iam/admin-web build`：通过，仅保留既有 Vite chunk size warning。
- `pnpm check`：通过，API 40 个测试文件 436 个测试通过，admin-web 13 个测试文件 144 个测试通过。
- 响应式检查：12 条后台路由 x 4 个视口全部通过，`failures: []`；其中包含应用详情默认页和 `roles`、`development`、`danger` 三个 Tab 深链。

## 发现与处理

| 编号   | 严重级别 | 问题                                                 | 处理                                                                |
| ------ | -------- | ---------------------------------------------------- | ------------------------------------------------------------------- |
| QA-001 | 轻微     | 接入提示词复制测试受 `userEvent` clipboard stub 影响 | 已改为在 `userEvent.setup()` 后 spy `navigator.clipboard.writeText` |
| QA-002 | 轻微     | responsive 脚本此前只覆盖默认应用详情页              | 已补充 `roles`、`development`、`danger` 三个应用详情 Tab 深链       |

## 结论

本轮 QA 未发现剩余阻塞问题。当前实现可进入落地前代码审查、版本元数据和发布阶段。
