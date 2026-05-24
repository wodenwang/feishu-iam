# 更新日志

## v0.1.3 - Admin Console HTTP service 切换

- Admin Console 新增 HTTP runtime mode，可通过真实 Fastify API 完成本地 mock 飞书登录、初始化、应用列表/创建和审计日志查看。
- 新增 `iamService` facade、HTTP client、DTO/error mapping 和 `VITE_IAM_API_MODE=mock|http` 边界。
- HTTP mode 下错误展示保留 requestId，应用创建返回 one-time appSecret/apiSecret，审计日志不记录 secret 明文。

## 0.1.2 - 2026-05-24

- 现在可以用独立 Application API credential 和 `appKey + HMAC` 注册权限组、权限点，并通过 raw body hash、timestamp、nonce 防重放完成验签。
- 现在可以创建角色、授权飞书用户或部门，并用 IAM session cookie 查询当前飞书用户在指定应用下的权限点 code。
- 现在可以通过 mock directory 投影、thin third-party demo 和 `scripts/verify-v0.1.2-access-loop.sh` 验证内部接入闭环。
- 新增完整后端测试、迁移约束测试、Playwright API smoke 和审计泄密检查，覆盖 HMAC 失败、重复 code、disabled 状态、allow/deny 权限查询等关键路径。
- 修复目录投影 API 权限边界，组织用户和部门列表现在仅平台管理员可读取。

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
