# Feishu IAM v1.0.2 预落地代码 Review

日期：2026-06-13

## Findings

未发现阻塞发布的问题。

## 已检查风险

- 敏感信息边界：公开错误页不复制整段问题信息；测试断言不出现 `复制问题信息` 和 `data-feedback`。
- 权限边界：移动端卡片只复用已有字段和已有行操作，不新增后端接口、不绕过后端权限校验。
- 响应式风险：`DataTable` 小视口渲染卡片，大视口保留表格；多 Tab 页面横向滚动限制在 Tab 列表内。
- 回归风险：旧 `/api/auth/feishu/callback` 继续走统一 OAuth 错误页，不恢复框架默认 404。

## 验证证据

- `pnpm check`：通过。
- `ADMIN_WEB_URL=http://localhost:5173 pnpm --filter @feishu-iam/admin-web test:responsive`：通过。
- `pnpm --filter @feishu-iam/api test -- test/oauth-error.filter.spec.ts`：通过。

## 结论

可以提交、打 tag、发布并部署到远端环境。部署后必须执行生产 canary，重点复核公开 OAuth 错误页、移动端后台入口和版本号。
