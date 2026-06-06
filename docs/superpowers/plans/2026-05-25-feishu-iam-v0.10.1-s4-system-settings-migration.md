# Feishu IAM v0.10.1-S4 系统设置页面迁移实施计划

本计划的执行事实源为仓库根目录 `IMPLEMENTATION_PLAN.md`。该文件保留长期文档索引，便于后续版本盘点和会话追溯。

## 目标

`v0.10.1-S4` 只迁移管理后台 `/admin/settings` 系统设置页面：设置项清单、飞书同步、系统运行、版本信息、同步历史 DataTable、同步记录 DetailSheet 和 `tab` / `sheet=sync:<id>` URL 状态。

## 非目标

- 不新增后端 API、Prisma、DDL 或部署拓扑。
- 不迁移工作台，不清理全部旧 CSS。
- 不发布 Docker 镜像，不部署远端。
- 不把触发同步确认框、字段诊断刷新中状态、Sheet 宽度或临时错误写入 URL。

## 执行入口

请直接读取并执行：

```text
IMPLEMENTATION_PLAN.md
```

## 验收摘要

- `/admin/settings` 使用 `PageHeader`、`DataTable`、`StatusBadge`、`DetailSheet`、`ConfirmDialog` 等 S1 新后台组件体系。
- 同步历史可打开详情 Sheet，深链为 `sheet=sync:<id>`。
- `tab=runtime` 和 `tab=version` 可刷新、可复制、可关闭详情后保留。
- 字段诊断失败时同步历史仍可查看。
- `audit_viewer` 可查看但不能触发同步，`platform_admin` / `sync_admin` 可触发。
- `pnpm check`、admin-web 测试、构建、lint、响应式检查和 Browser 自检均通过。
