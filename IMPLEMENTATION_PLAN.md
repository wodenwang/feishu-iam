# Feishu IAM v0.16.1 追踪闭环、组织用户选择器与按钮治理实施计划

本文件是当前分支的执行入口。详细工程计划见：

```text
docs/superpowers/plans/2026-05-29-feishu-iam-v0.16.1-trace-selector-buttons.md
```

## 目标

发布 `v0.16.1`，收口 GitLab `#35/#26/#32/#33/#34`：

1. 后台未登录、非法 session、过期 session、管理员不可用、权限不足的 request id 可在追踪页查到。
2. 追踪页支持本地粘贴问题信息并提取 request id，不上传、不保存原文。
3. 组织用户选择器按 `v0.16.1` Pencil 原型展示根级组织、下钻、同列表、已选展示、搜索、390px 和状态矩阵。
4. 按钮治理收口为轻量规则和自动检查。

## 当前版本不做

- 不新增 DDL，不改变管理员 session 校验机制。
- 不上传或保存整页问题信息原文。
- 不做全站 UI 重构，不扩展 SSO 协议面。
- 不暴露 access token、client secret、developer API token、cookie、authorization header、授权码、token hash、state hash 或飞书 raw payload。

## 第一 vertical slice

本版本的第一切片是“后台认证/授权失败 request id 追踪闭环”：

1. `AdminDomainError` 的后台认证/授权失败 best-effort 写入 `security_events`。
2. `AdminTraceService` 把 `admin_auth_failure` 映射为独立 `admin_auth` 阶段。
3. 操作审计「追踪」Tab 可通过统一问题页 request id 查到后台失败事件。
4. 安全事件写入失败时，原始 401/403 响应保持不变。

## 验证命令

```bash
pnpm --filter @feishu-iam/api test -- test/admin-error.filter.spec.ts test/admin-trace.service.spec.ts test/admin.controller.e2e-spec.ts test/iam-role.service.spec.ts test/version.controller.e2e-spec.ts
pnpm --filter @feishu-iam/admin-web test -- src/features/records/trace-format.test.ts src/features/records/RecordQueryView.test.tsx src/features/permissions/PermissionManagementView.test.tsx src/features/settings/SystemSettingsView.test.tsx
pnpm --filter @feishu-iam/admin-web test:buttons
pnpm --filter @feishu-iam/admin-web test:responsive
pnpm check
```

## 完成标准

- `#35/#26/#32/#33/#34` 全部有实现、测试和验收证据。
- 后台认证/授权失败 request id 可在追踪页查到，且记录失败不影响 401/403。
- 问题信息粘贴解析只在前端本地提取 request id，不上传、不保存原文。
- 组织用户选择器已选区展示名称、头像/图标、主体类型、路径和 orphaned 状态，桌面和 390px 均符合 Pencil 原型。
- 飞书同步页组织浏览保持只读，不出现角色绑定选择和保存语义。
- 按钮治理有轻量自动检查，Browser 自检、gstack design-review、qa、review、GitLab release 和 `192.168.2.112` 部署证据齐全。
