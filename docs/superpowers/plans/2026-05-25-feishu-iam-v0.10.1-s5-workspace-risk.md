# Feishu IAM v0.10.1-S5 工作台风险控制台实施计划

本计划的执行事实源为仓库根目录 `IMPLEMENTATION_PLAN.md`。该文件保留长期文档索引，便于后续版本盘点和会话追溯。

## 目标

`v0.10.1-S5` 只迁移管理后台 `/admin/workspace` 工作台：将旧指标型首页改为风险优先控制台，让管理员打开后台后先看到会阻断登录、同步、数据库就绪和有效用户的事项，并可跳转到可复制、可刷新的处置 URL。

## 非目标

- 不新增后端 API、Prisma、DDL 或部署拓扑。
- 不发布 Docker 镜像，不部署远端。
- 不重新设计飞书同步、系统设置或记录查询页面。
- 不把工作台做成营销页、门户页或装饰型 dashboard。

## 执行入口

请直接读取并执行：

```text
IMPLEMENTATION_PLAN.md
```

## 验收摘要

- `/admin` 默认进入 `/admin/workspace`。
- 工作台使用 `features/workspace` 聚合风险模型，路由文件保持薄封装。
- 风险来源限定为现有 `/health`、`/ready`、`/version` 和飞书状态数据。
- 飞书配置风险进入 `/admin/settings`，同步风险进入 `/admin/records?tab=sync&sheet=sync:<id>`，系统运行风险进入 `/admin/settings?tab=runtime`。
- 工作台包含待处理风险、系统健康、最近飞书同步、最近记录和当前管理员信息。
- admin-web focused tests、typecheck、lint、build、响应式检查、浏览器自检和 `pnpm check` 均需通过。
