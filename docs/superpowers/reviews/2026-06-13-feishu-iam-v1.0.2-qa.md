# Feishu IAM v1.0.2 功能 QA

日期：2026-06-13

## QA 范围

- 应用管理、权限管理、管理员授权、操作审计的移动端列表可读性和操作入口。
- 应用详情、角色详情、操作审计 Tabs 的窄屏可用性。
- OAuth 错误页只复制 `request id` 的安全边界。

## 验证结果

- `pnpm --filter @feishu-iam/admin-web test -- src/components/admin/DataTable.test.tsx src/components/admin/ResponsiveTabsList.test.tsx src/features/applications/ApplicationManagementView.test.tsx src/features/permissions/PermissionManagementView.test.tsx src/features/admin-users/AdminAuthorizationView.test.tsx src/features/records/RecordQueryView.test.tsx`：通过，48 tests。
- `pnpm --filter @feishu-iam/api test -- test/oauth-error.filter.spec.ts`：通过，7 tests。
- `pnpm check`：通过，API 41 files / 465 tests，Admin Web 17 files / 160 tests。
- `ADMIN_WEB_URL=http://localhost:5173 pnpm --filter @feishu-iam/admin-web test:responsive`：通过，覆盖 13 条后台路由的 390 / 768 / 1280 / 1440 视口。

## 风险与限制

- 本地 API Browser 启动需要真实 `DATABASE_URL`；本次不读取、不猜测本地数据库连接，因此公开 OAuth 错误页的真实浏览器复核推迟到生产 canary。
- 本版本不新增 DDL，不改变权限模型、OAuth 协议、管理员 session 或审计语义。

## QA 结论

通过。可以进入 release、远端部署和生产 canary。
