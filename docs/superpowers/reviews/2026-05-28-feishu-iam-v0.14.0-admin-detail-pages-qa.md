# Feishu IAM v0.14.0 后台详情页重构 QA 记录

日期：2026-05-28
范围：GitLab issue `#16/#6/#7/#9`

## 结论

本地 QA 通过。`v0.14.0` 已把 `v0.13.2` 原本过窄的导航补丁合并到后台体验版本中，一起覆盖系统管理导航、应用详情独立页和角色详情独立页。

## 已验证路径

- `系统管理` 父级整行展开 / 收起，且二级入口带图标。
- `/admin/system/info`、`/admin/system/audit` 等二级页能正确高亮当前入口。
- 应用列表点击 `详情` 进入 `/admin/applications/:appKey`，默认不再打开右侧抽屉。
- 角色列表点击 `详情` 进入 `/admin/permissions/:appKey/roles/:roleId`，默认不再打开右侧抽屉。
- 角色详情 `tab=groups` 可恢复到“权限组绑定”Tab。
- 旧 `sheet=app:*` 和 `sheet=role:*` 深链仍兼容旧抽屉入口。
- 权限管理首页未恢复角色元数据新增、编辑或启停入口。

## 验证命令

```bash
pnpm --filter @feishu-iam/admin-web test -- src/components/admin/admin-components.test.tsx src/App.test.tsx src/routes/admin-url-state.test.ts src/features/applications/ApplicationManagementView.test.tsx src/features/permissions/PermissionManagementView.test.tsx
pnpm --filter @feishu-iam/admin-web build
pnpm check
ADMIN_WEB_URL=http://127.0.0.1:5173 pnpm --filter @feishu-iam/admin-web test:responsive
```

## 结果

- 前端定向测试：96 个测试通过。
- `pnpm --filter @feishu-iam/admin-web build`：通过，仅保留既有 Vite chunk size warning。
- `pnpm check`：通过，API 40 个测试文件 436 个测试通过，admin-web 13 个测试文件 142 个测试通过。
- 响应式检查：通过，覆盖 9 条后台路由和 390、768、1280、1440 宽度视口，`failures: []`。

## 未完成

- GitLab MR、tag、release、镜像发布和 `192.168.2.112` 停机升级仍待发布阶段执行。
