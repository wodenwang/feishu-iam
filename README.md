# feishu-iam

`feishu-iam` 是一个以飞书作为身份、组织结构、登录入口和授权数据源的 IAM 系统。

## 项目边界

- 飞书是组织结构和用户的唯一来源。
- 不维护独立的 username / password 登录系统。
- 所有用户认证流程依赖飞书。
- 系统超级管理员身份必须绑定到飞书用户。
- 系统绑定一个专用自建飞书应用。
- 所有飞书 API 权限来自该专用自建飞书应用。

## 当前状态

当前仓库已经进入 `v0.1.0` Admin Console 原型收口阶段：

- 已提供 React + TypeScript + Vite + Ant Design 前端骨架。
- 已提供基于 TanStack Query 的 mock IAM service，用于验证页面、权限、同步和审计闭环。
- 已保留 Pencil 原型、实现截图、QA 记录和 E2E 测试。
- `v0.1.1` 已新增本地 Fastify + PostgreSQL runtime slice，用于验证 mock 飞书登录、平台管理员绑定、应用创建和审计日志闭环。
- 真实飞书 OAuth、第三方 Demo、前端 HTTP service 切换和交付部署仍在后续独立切片中。

## 本地运行

```bash
npm install
npm run dev
```

## v0.1.1 Runtime Slice

本切片提供本地 mock Feishu 登录、平台管理员绑定、应用创建和审计日志闭环。

```bash
cp .env.example .env
npm install
npm run server:dev
```

另一个终端运行：

```bash
npm run server:test
npm run e2e -- tests/e2e/runtime-api.spec.ts
```

`FEISHU_AUTH_MODE=mock` 只允许本地开发和测试使用，生产环境必须使用真实飞书认证配置。

发布前检查：

```bash
npm run build
npm test
npm run e2e
```

## 项目文档

- [架构说明](docs/architecture.md)
- [v0.1 产品规格说明](docs/v0.1-product-spec.md)
- [Agent 协作规范](AGENTS.md)
- [v0.1 Access Loop 实施计划](docs/superpowers/plans/2026-05-23-v0.1-access-loop.md)

## 安全说明

不要提交飞书应用 secret、tenant access token、private key、本地 `.env`、导出的用户数据或同步快照。
