# 更新日志

## v0.3.1 - Admin Shell 外框与顶部栏修复

- 修复顶部栏侧边导航收缩按钮不可用的问题，collapsed 状态现在由组件交互驱动，菜单、Logo 和内容区宽度会同步更新。
- 简化右上角账户入口，首屏顶部栏只保留必要用户身份入口，角色、环境、runtime 和 open_id 迁移到用户下拉层。
- 移除首页首屏显眼的 `HTTP runtime`、`Mock data`、`生产环境`、`本地开发` 运行/调试态标签。
- 补充 Admin Shell 单元测试，覆盖首屏低干扰展示、用户下拉运行信息和侧边栏展开/收起交互。
- 本版本不新增目录编辑、事件同步 worker、OIDC/JWKS/PKCE/refresh token、SDK/CLI 或本地账号体系。

## v0.3.0 - 飞书事件同步可靠性

- 新增飞书事件订阅回调 `POST /api/feishu/events`，支持 URL verification challenge、Verification Token 校验、可选 Encrypt Key 签名校验与 AES 解密。
- 新增 `sync_events` 运行时表，记录飞书事件 id、事件类型、资源标识、处理状态、requestId、关联同步 run 和失败原因。
- 新增 `GET /api/sync/events/status`、`GET /api/sync/events`、`POST /api/sync/events/:id/retry`，平台管理员可查看事件健康、去重后的事件列表，并用 system actor 触发事件重试同步。
- `/sync` 页面新增 `飞书事件同步` 区域，展示待同步、失败、已处理、已忽略事件计数、回调地址和最近事件表格。
- 新增 `scripts/verify-v0.3-sync-events.sh`，自动验证 challenge、事件接收、幂等去重、事件列表、重试处理和敏感信息不输出。
- README、环境变量示例和 v0.3.0 验收证据补充飞书事件订阅配置边界；本版本不新增目录编辑、告警平台、OIDC/JWKS/PKCE/refresh token、SDK/CLI 或本地账号体系。

## v0.2.2 - 应用接入诊断与可观测性补强

- 应用详情新增 `接入诊断` Tab，聚合应用状态、redirect URI、secret 签发状态、权限注册、角色授权绑定、目录用户投影和最近接入事件。
- 新增 `GET /api/applications/:id/diagnostics`，复用应用详情权限边界，只返回脱敏状态、计数、端点和 requestId，不返回 secret、token、code、signature、cookie 或 hash 原文。
- 新增 `POST /api/applications/:id/diagnostics/copy`，复制诊断包时只写 `application.diagnostics.copy` 审计，后端不接收或保存诊断包正文。
- 前端新增 Markdown 诊断包生成逻辑，便于第三方系统开发者排查 redirect URI、secret、权限注册和角色授权问题。
- 新增 `scripts/verify-v0.2-access-diagnostics.sh`，自动验证 warning、healthy、failed 诊断状态、脱敏输出和复制审计。

## v0.2.1 - 应用接入闭环补缺

- 应用详情 `接入配置` 新增 `复制应用提示词`，面向 Codex / Claude Code 生成第三方项目 `AGENTS.md` / `CLAUDE.md` 接入说明。
- 应用提示词包含 IAM base URL、OAuth authorize/token endpoint、redirect URI、Application API endpoint、`appKey` 和 HMAC 鉴权规则，但不包含已保存 secret 明文。
- 角色授权新增 permission group 绑定，权限查询会把角色绑定的权限组展开为组内启用权限点，并与直接权限点绑定去重。
- 登录页新增 `loginRequired` 未登录恢复状态，优化首次进入、重新登录和无权限等状态的 Admin Console 入口表达。
- 补充 v0.2.1 后端、前端、版本和本地验证工件。

## v0.2.0 - 应用接入生产化

- 新增 OAuth redirect URI 管理：列表、新增、停用、恢复，并在 OAuth authorize 中只允许启用状态的 URI。
- 新增 `appSecret` / `apiSecret` 轮换 API；旧 secret 立即失效，新 secret 只返回一次，审计日志不保存明文。
- 新增多应用管理员维护 API 和 Admin Console 页面入口，平台管理员可新增/移除应用管理员，并保护最后 1 位管理员不能被移除。
- 应用详情页按 v0.2 Pencil 原型升级为概览、接入配置、权限注册、应用管理员和审计记录 Tab，突出接入状态、配置可追溯和只读权限边界。
- 新增 `scripts/verify-v0.2-application-onboarding.sh`，自动验证 redirect URI、OAuth、secret rotation、Application API HMAC、管理员保护和审计动作。
- README、第三方 Demo README 和接入文档补充 v0.2 验收路径与真实飞书外部配置说明。

## v0.1.17 - 接入闭环验收包

- 新增 `scripts/verify-v0.1-access-loop.sh`，用本地 mock Feishu runtime 自动验证 v0.1 接入主链路。
- 验收脚本通过公开 API 串联健康检查、mock 飞书登录、平台管理员绑定、同步状态/预检、应用创建、Application API 权限注册、角色授权、OAuth authorize/token、allow/deny 权限查询和审计回溯。
- 脚本输出仅包含 `appKey` 和权限摘要，不打印一次性 secret、cookie、bearer token 或 HMAC signature。
- README、第三方 Demo README 和接入文档补充 v0.1 接入闭环验收路径，明确自动脚本与浏览器 Demo 验收分工。
- 新增 v0.1.17 工程评审、QA 报告和 pre-landing review 证据；本版本不新增产品 runtime 能力，只锁定接入闭环可验收性。

## v0.1.16 - 同步运营 Runtime

- 新增 `GET /api/sync/status`，平台管理员可查看最近同步、最近成功/失败、运行中状态、目录投影数量和健康判断。
- 新增 `POST /api/sync/preflight`，通过专用自建飞书应用预检 tenant token、部门读取和用户读取权限；预检不创建同步 run，也不改写目录投影。
- `sync_runs` 新增 `operator_type`，scheduled run 使用 `system` actor 且 `operator_feishu_user_id = null`，不伪造飞书用户。
- 新增可配置 scheduled full sync，默认关闭，通过 `FEISHU_SYNC_SCHEDULE_ENABLED`、`FEISHU_SYNC_SCHEDULE_INTERVAL_MINUTES` 和 `FEISHU_SYNC_SCHEDULE_START_DELAY_SECONDS` 控制。
- `/sync` 页面接入同步健康状态、权限预检 Drawer、最近定时同步状态和系统任务展示。
- 新增同步运营 Runtime 的后端、前端、migration、浏览器验证和发布收口证据。

## v0.1.15 - 飞书通讯录同步 Runtime

- 新增 `sync_runs` 运行时表，记录同步触发方式、状态、操作人、requestId、差异摘要、错误和耗时。
- 新增飞书通讯录同步 adapter，生产运行时使用专用自建飞书应用的 tenant access token 读取飞书部门和用户。
- 新增 `GET /api/sync/runs`、`POST /api/sync/runs` 和 `POST /api/sync/runs/:id/retry`，平台管理员可查看、触发和重试 full sync。
- 同步结果幂等写入 `feishu_users`、`directory_departments`、`directory_users`，本次缺失的既有目录用户标记为离职。
- 同步开始、成功和失败都写入审计；失败原因展示在同步历史中。
- 前端 HTTP mode 接通现有 `飞书同步` 页面，不再调用 mock-only sync 方法。

## v0.1.14 - 应用管理员 Runtime

- 新增 `application_admins` 运行时表，用飞书用户绑定应用管理员，不引入本地账号。
- 平台管理员创建应用时可指定应用管理员飞书 User ID，绑定动作写入 `application.admin.bind` 审计。
- `/api/session/current` 支持返回 `application_admin`、应用范围权限和 scoped `applicationIds`。
- 应用管理员只能查看自己负责的应用、权限注册、接入配置复制记录和本应用审计。
- 应用管理员可管理自己负责应用下的角色和授权，跨应用角色、全局审计和同步能力继续禁止。
- 新增应用管理员 runtime 覆盖测试，包含 session projection、应用 scope、角色 scope、审计 scope 和 migration。

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
