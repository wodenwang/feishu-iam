# 更新日志

## v0.1.13 - OAuth 小收口

- 新增 pending OAuth request 机制：未登录用户从第三方 Demo 发起 IAM OAuth 后，登录成功可恢复原始 authorize 请求并回到 Demo callback。
- 新增 `application_oauth_pending_requests` 运行时表，pending token 只保存 hash，浏览器只持有短期 HttpOnly cookie。
- 登录成功后的 redirect 决策保留初始化优先级：IAM 未初始化时仍进入 `/initialize`，不会绕过首次平台管理员绑定。
- 新增过期 OAuth artifact cleanup，清理过期 authorization code、OAuth bearer session 和 pending request；仅实际清理到数据时写 `oauth.cleanup` 审计。
- 补齐 pending create、pending resume success/failure 审计，便于排查第三方登录断链、过期和应用配置错误。
- 新增 pending OAuth 恢复、初始化保护、过期 pending、cleanup 幂等和 migration 覆盖测试。

## v0.1.12 - 第三方 OAuth Demo Runtime

- 新增最小第三方 OAuth Authorization Code runtime，支持 `/api/oauth/authorize` 和 `/api/oauth/token`。
- 新增应用 OAuth redirect URI、authorization code 和第三方 bearer session 运行时表，authorization code 短期有效且一次性消费。
- Application API 权限查询支持第三方 OAuth bearer token，并限制 token 只能用于所属应用。
- `examples/thirdparty-demo` 默认切换到 OAuth mode，可完成 IAM 登录、token exchange 和权限查询；历史 mock mode 仅作为本地 fallback。
- 新增第三方 OAuth runtime 后端测试，覆盖 code exchange、防重放、redirect URI、client secret 和跨应用 token 边界。
- 新增第三方 Demo README、`.env.example` 和接入说明文档，继续禁止提交真实 secret。

## v0.1.11 - 应用接入配置闭环

- 新增应用详情 HTTP runtime，可查看应用基础信息、创建人、权限组/权限点数量、最近 Application API 调用和 secret 签发状态。
- 新增应用权限注册结果接口，Admin Console 可展示第三方系统通过 Application API 注册的权限组和权限点。
- 新增应用 secret copy 审计事件，复制运行时配置或 Agent Prompt 时记录动作但不保存 secret 明文。
- 应用详情和接入向导 HTTP mode 不再依赖 mock-only 方法，Agent Prompt 和 `.env` 模板只使用 secret 占位符。
- 审计日志支持按应用 target 过滤，便于在应用详情中查看应用相关接入事件。
- README 重构为公开项目入口文档，突出项目价值、快速本地启动、快速 Docker Compose 部署、第三方接入路径和安全边界，并移除机器私有部署信息。

## v0.1.10 - Admin Console 前端重构

- 按 Ant Design Pro 风格重构 Admin Shell、Header 右上角 UserMenu、品牌 logo、登录页和退出登录流程。
- 新增 `feishu-iam` 原创盾牌 logo 与 JoyBell 参考色系的 Ant Design token 主题，保持企业后台高密度、表格优先和视觉克制。
- 拆分生产飞书登录页与本地 DEV Mock 登录页，继续禁止 username/password 登录体系。
- 新增退出登录确认、处理中、失败重试和成功回到登录页的前后端闭环。
- 补齐应用列表 loading、empty、error、search-empty 状态，稳定表格容器和分页占位，降低页面抖动。
- 覆盖 1440 / 1280 / 768 响应式布局、UserMenu 长 open_id 截断、键盘可访问性和横向表格滚动规则。

## v0.1.9 - 部署 migration 元数据过滤

- 修复 macOS AppleDouble 元数据文件 `._*.sql` 被打包到 `dist-server/migrations` 后误当 migration 执行的问题。
- migration loader 现在只执行 `001_name.sql` 这类编号 SQL 文件，避免部署包中的点文件或说明文件触发 PostgreSQL 协议错误。
- 新增 migration 文件过滤回归测试，覆盖 `._001_runtime.sql`、`.DS_Store` 和非编号 `.sql` 文件。

## v0.1.8 - 真实飞书 Admin Console 登录

- 新增 `GET /api/auth/feishu/start` 和 `GET /api/auth/feishu/callback`，支持真实飞书 OAuth 登录 Admin Console。
- 新增 `RealFeishuAuthAdapter`，通过飞书授权码换取 `user_access_token` 并获取登录用户信息。
- 登录 callback 使用短期 HttpOnly state cookie 防伪，成功后创建 IAM session 并写入最小飞书用户投影。
- 前端 HTTP mode 的 `/login` 主按钮现在会跳转真实飞书登录入口，本地开发 mock 登录按钮仍只在 DEV 模式显示。
- 增加真实飞书登录、adapter 解析、state 校验、失败审计和 mock 登录回归测试。

## v0.1.7 - 部署镜像源兼容

- Dockerfile 支持通过 `NODE_IMAGE` build arg 覆盖 Node base image。
- Docker Compose 支持通过 `FEISHU_IAM_NODE_IMAGE` 和 `POSTGRES_IMAGE` 使用 Docker Hub 镜像代理。
- 补充 `bpmt-120` 无法直连 Docker Hub 时的镜像源配置说明。

## v0.1.6 - 最小部署基础设施

- 新增 Dockerfile 和 Docker Compose 部署入口，常驻容器为 `feishu-iam` 与 `postgres`。
- `feishu-iam` 生产 runtime 现在可以同源服务 Vite 静态资源和 Fastify API，保留 `/api/*` API 语义。
- Compose 持久化 PostgreSQL 数据到 `./data/postgres`，应用日志默认通过 `docker compose logs` 查看。
- 新增 GitHub Actions CI，覆盖 server build、server tests、frontend tests、frontend build 和 Docker image build。
- 明确 `bpmt-120:/home/bpmt/feishu-iam` 部署约定、端口递增策略和 `/api/health` 健康检查闭环。

## v0.1.5 - Roles HTTP runtime

- Admin Console 新增 `/roles` HTTP runtime mode，可通过真实 Fastify API 查看角色列表、创建/编辑角色、停用角色和保存授权。
- 后端角色列表返回前端所需 projection：应用名、权限数量、授权对象数量、permission keys、department ids 和 user ids。
- 新增只读 `GET /api/roles/permission-tree`，用于角色授权 Drawer 展示 runtime 已注册权限点。
- HTTP mode 角色错误反馈保留 requestId，覆盖 401、403、409 和普通 API error。
- 本切片不扩大 `/directory` 只读浏览边界，只复用既有部门和用户读取接口作为授权对象选择来源。

## v0.1.3 - Admin Console HTTP service 切换

- Admin Console 新增 HTTP runtime mode，可通过真实 Fastify API 完成本地 mock 飞书登录、初始化、应用列表/创建和审计日志查看。
- 新增 `iamService` facade、HTTP client、DTO/error mapping 和 `VITE_IAM_API_MODE=mock|http` 边界。
- HTTP mode 下错误展示保留 requestId，应用创建返回 one-time appSecret/apiSecret，审计日志不记录 secret 明文。
- HTTP mode 应用列表筛选已接入 runtime keyword/status/createdAt 过滤，避免可见筛选控件静默无效。
- HTTP mode 入口收敛到应用管理和审计日志；后续切片页面直达会回到应用管理，避免进入未接入 runtime 的页面。
- v0.1.3 Playwright E2E 新增显式 `E2E_RESET_DATABASE=true` 数据库重置门槛，避免本地测试残留 platform admin 影响验收。

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
