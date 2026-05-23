# 更新日志

## 0.1.1 - 2026-05-24

- 现在可以启动本地 Fastify + PostgreSQL runtime，完成 mock 飞书登录、当前 session 查询、首位平台管理员绑定、应用创建和审计日志查询闭环。
- 现在可以用 `server:dev`、`server:build`、`server:test` 和 Playwright runtime API smoke 验证后端切片。
- 现在应用 secret 只在创建响应中一次性返回，数据库只保存 hash，审计日志不会写入 secret 明文。
- 修复初始化绑定、应用创建、迁移执行和边界 payload 的权限、并发、事务和错误处理问题。
- 继续保持生产环境禁止 `FEISHU_AUTH_MODE=mock`，并要求真实飞书模式提供专用自建应用配置。

## 0.1.0 - 2026-05-23

- 现在可以本地启动一个可测试的飞书 IAM Admin Console 原型。
- 现在可以从产品规格、Pencil 原型、实现截图和 QA 记录追溯 v0.1 接入闭环。
- 现在可以查看应用管理、应用详情、接入向导、角色授权、组织用户、同步中心、审计日志、登录、初始化、403 和全局错误页面。
- 现在可以通过集中式权限 helper、route metadata、`PermissionGuard`、`SearchForm`、`AppTable` 和 `FormDrawer` 复用后台管理模式。
- 现在可以用 mock IAM service、TanStack Query hooks、组件测试和 Playwright 三视口 E2E 验证前端闭环。
- 继续保持飞书唯一身份源边界，不新增本地 username / password 登录或本地超级管理员体系。
