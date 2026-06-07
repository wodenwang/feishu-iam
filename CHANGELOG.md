# 变更日志

## v1.0.1 - 第三方 SSO 内部飞书回调兼容补丁

`v1.0.1` 是 `v1.0.0` 后的小补丁版本，范围锁定 GitHub issue `#2`。本版本不新增 DDL，不扩大 OAuth/OIDC 协议面，不改变第三方应用 `redirect_uri` 精确匹配规则，不记录敏感凭证。

### 修复

- 新增旧路径兼容入口 `/api/auth/feishu/callback`，复用现有 `/oauth/feishu/callback` 的 OAuth 回调处理，避免旧 `FEISHU_OAUTH_REDIRECT_URI` 配置直接落到框架默认 `Cannot GET ...`。
- OAuth 错误页渲染覆盖旧回调路径，回调 state 无效、缺少 code 或飞书登录失败时继续展示统一 HTML 问题提示页和 request id。
- 发起第三方 SSO 授权和飞书 code exchange 时统一校验 `FEISHU_OAUTH_REDIRECT_URI`，只允许 `/oauth/feishu/callback` 和兼容旧路径 `/api/auth/feishu/callback`，配置漂移时返回稳定 OAuth 错误。
- 部署模板、install 默认版本、README、AGENTS 和版本号同步到 `1.0.1`。

### 安全与边界

- 第三方应用回调地址仍只读取 `application_redirect_uris` 并保持精确匹配；不会把第三方 Demo 回调地址误用为 Feishu IAM 内部飞书平台回调地址。
- 兼容旧路径只解决内部飞书平台回调配置漂移，不新增完整 OIDC、refresh token、SAML、ABAC、资源级权限或 deny 规则。
- 错误页、测试和文档不记录 secret、token、cookie、authorization code、token hash、state hash、飞书 `app_secret` 或原始飞书 payload。

### 本地验收

- 已通过定向 OAuth 检查：`pnpm --filter @feishu-iam/api test -- --run test/oauth.service.spec.ts test/oauth-error.filter.spec.ts test/oauth.controller.e2e-spec.ts`，3 个测试文件 55 个用例通过。
- 已通过 API 类型检查和 lint：`pnpm --filter @feishu-iam/api typecheck`、`pnpm --filter @feishu-iam/api lint`。
- 已通过完整检查：`pnpm check`，API 41 个测试文件 465 个测试通过，Admin Web 15 个测试文件 156 个测试通过。
- 已通过生产构建：`pnpm build`，前端构建仅保留既有 Vite chunk size warning。

### 线上验收

- 待发布后补齐：GitHub Release、线上 `/ready`、`/version`、`/oauth/feishu/callback`、`/api/auth/feishu/callback`、第三方 Demo SSO 和 my-harness canary 证据。

## v1.0.0 - Riversoft 正式版 UI 翻新与平台管理员初始化

`v1.0.0` 是内部正式版发布收口版本，范围限定为前端 UI 翻新和 IAM 管理权限初始化。本版本不改变 UX 流程、信息架构、路由、表单流程、数据契约、CRUD 行为、权限逻辑或业务逻辑。

### 调整

- 管理后台视觉切换为 Riversoft 正式版主题，Riversoft token 集中落到 shadcn/ui + tweakcn + Tailwind CSS variables，避免页面内散落品牌色硬编码。
- 项目级组件完成正式版质感升级，覆盖 AppShell、DataTable、StatusBadge、PageState、FormDialog、DetailSheet、Confirm/Danger Zone、统一问题提示页和追踪页。
- 工作台、应用管理/应用详情、统一问题提示/追踪页作为第一个 vertical slice 的证明页面，覆盖 1440、768、390 响应式表现。
- Logo、favicon 和 Sidebar 品牌区已替换为 Riversoft 完整圆形图形，移除旧品牌误导。
- 390px 移动端 Sheet 导航点击真实导航入口后会自动关闭菜单，保持路由、导航项和权限逻辑不变。

### 数据初始化

- 新增 `migrations/V1_0_0__platform_admin_initialization.sql`，通过 `INITIAL_PLATFORM_ADMIN_FEISHU_USER_ID` 幂等确保“王文哲”拥有 `platform_admin`。
- 初始化迁移只写入 `admin_users`、`admin_user_roles`、`audit_logs` 和 `schema_versions`。
- 不初始化第三方应用权限、demo client、回调地址、权限点、权限组或业务角色，也不撤销其他管理员。

### 安全与边界

- 应用详情页不展示 `sk-` 形态、飞书 `app_secret`、数据库密码、生产导出数据或真实 secret、token、cookie。
- 凭证相关 UI 保留既有查看/轮换流程，只使用“凭证”安全表达，不改变后端接口或 CRUD 行为。
- 统一问题提示页和追踪页继续围绕 request id 排障主旅程，不恢复整段问题信息复制、粘贴或本地提取。

### 验收

- 已通过完整检查：`pnpm check`，API 41 个测试文件 460 个测试通过，Admin Web 15 个测试文件 156 个测试通过。
- 已通过按钮治理检查：`pnpm --filter @feishu-iam/admin-web test:buttons`。
- 已通过响应式浏览器验证：`ADMIN_WEB_URL=http://localhost:5173 pnpm --filter @feishu-iam/admin-web test:responsive` 覆盖 390、768、1280、1440 视口和关键后台路由，结果 `failures: []`。
- 已通过 390px Playwright 移动导航定点复测：点击移动 Sheet 内 `应用管理` 后跳转到 `/admin/applications`，Sheet 自动关闭，页面无横向溢出。
- 已合并 GitHub PR `#1`，merge commit 为 `a8aca2e156656af581eb1bb1dfb3a05989a526bf`。
- 已完成 amd64 离线镜像构建和远端停机部署：线上运行 `dockerhub.it.tangtring.com:80/ai/feishu-iam:v1.0.0`，部署目录为 `bpmt@120.24.236.92:/home/bpmt/feishu-iam`，旧 `v0.4.0` 部署目录已备份为 `/home/bpmt/feishu-iam-v0.4.0-backup-20260606-225509`。
- 已完成线上健康检查：`https://feishu-iam.riversoft.com.cn/ready` 返回 ready，`https://feishu-iam.riversoft.com.cn/version` 返回 `1.0.0 / a8aca2e`。
- 已完成线上数据边界核查：只有“王文哲”具备 `platform_admin`；第三方应用、client、回调地址和 IAM 业务角色计数均为 0。
- 已完成线上浏览器检查：未登录后台入口、应用详情深链和 390px 追踪入口均展示统一问题提示页、可复制 request id、无旧品牌和敏感文本；Riversoft logo 静态资源返回 `image/png`。
- 内网 HTTP Registry 多架构 push 在 HTTPS 探测阶段返回 `EOF`，本次未形成可公开拉取的 `v1.0.0` manifest digest；后续恢复 registry insecure push 后应补发多架构 manifest。
- 验收材料见 [v1.0.0 Riversoft UI 与管理员初始化验收清单](docs/acceptance/v1.0.0-riversoft-ui-init.md) 和 [v1.0.0 浏览器证据](docs/acceptance/v1.0.0-riversoft-browser/)。

## v0.16.2 - 根组织、详情按钮与 request id 精简

`v0.16.2` 是 `v0.16.1` 后的小补丁版本，范围锁定 GitLab issue `#36/#37/#38`。本版本不新增 DDL，不扩大 SSO 协议面，不改变管理员 session 机制，不记录敏感凭证，也不做全站 UI 重构。

### 修复

- 角色组织与用户选择器顶层入口只加载根级组织，不再无条件拉取全量用户；搜索和下钻到组织后仍可选择用户。
- 组织查询兼容飞书镜像中根级父节点为 `0` 的数据，避免 `192.168.2.112` 这类生产数据在顶层入口显示为空。
- 飞书同步页继续使用只读组织浏览语义，根级组织查询与角色选择器保持一致，但不出现角色绑定、草稿或保存语义。
- 应用清单行内详情操作改为固定尺寸图标按钮，保留稳定 `aria-label` 和 `title`，避免文本按钮破坏操作列一致性。
- 问题提示页和操作审计追踪页只保留 request id 输入、展示和复制；移除整段问题信息复制、粘贴和本地提取能力。

### 安全与边界

- request id 精简后不再生成或处理包含页面、时间、错误码等字段的整段问题信息，进一步降低用户转发上下文时夹带敏感信息的概率。
- 组织与用户选择器仍只提交组织和用户主体 ID，不保存展示快照，不改变权限模型。
- 本版本只处理小范围回归和控件一致性，不新增飞书角色同步、飞书用户组同步、完整 OIDC、SAML、ABAC、资源级权限或外部链路追踪基础设施。

### 验收

- 已通过后端定向测试：`pnpm --filter @feishu-iam/api test -- test/admin.controller.e2e-spec.ts`。
- 已通过前端定向测试：`pnpm --filter @feishu-iam/admin-web test -- src/features/permissions/PermissionManagementView.test.tsx`、`pnpm --filter @feishu-iam/admin-web test -- src/features/applications/ApplicationManagementView.test.tsx`、`pnpm --filter @feishu-iam/admin-web test -- src/components/admin/ProblemFeedbackPage.test.tsx src/features/records/RecordQueryView.test.tsx src/features/records/trace-format.test.ts`。
- 已通过按钮轻治理检查：`pnpm --filter @feishu-iam/admin-web test:buttons`。
- 已通过类型检查和构建：`pnpm --filter @feishu-iam/api typecheck`、`pnpm --filter @feishu-iam/admin-web typecheck`、`pnpm --filter @feishu-iam/admin-web build`；前端构建仅保留既有 Vite chunk size warning。
- 已通过完整检查：`pnpm check`，API 41 个测试文件 460 个测试通过，Admin Web 15 个测试文件 156 个测试通过。
- 已通过本地浏览器自检：`ADMIN_WEB_URL=http://localhost:4173 pnpm --filter @feishu-iam/admin-web test:responsive` 覆盖 13 条后台路由和 4 组视口无溢出；额外交互检查确认应用清单详情按钮为 32px 图标按钮、组织用户选择器顶层不拉取全量用户、追踪页不再展示整段问题信息操作，且无 console/network 失败。
- GitLab MR `!41` 已合并，GitLab issue `#36/#37/#38` 已关闭。
- 已发布镜像 `dockerhub.it.tangtring.com:80/ai/feishu-iam:v0.16.2` 和 `latest`，多架构 manifest digest 为 `sha256:09cef06e3adfbbde7cf60124ef4e23b347b27184f0393cce11bd77e242eef5c5`，amd64 与 arm64 `docker pull --platform` 均通过。
- 已创建 GitLab release `v0.16.2`。
- 已在 `192.168.2.112:~/feishu-iam` 通过 amd64 离线 tar 和 `FEISHU_IAM_PULL_POLICY=never` 完成停机升级，备份目录为 `/home/dev/feishu-iam/backups/20260529-231412`，`/ready` 返回 ready，`/version` 返回 `0.16.2 / v0.16.2`。
- 已在线上核查飞书组织镜像：活跃组织 317 个，根级父节点 `0` 的一级组织 4 个，递归可达活跃组织 317 个，最大深度 7 层。

## v0.16.1 - 追踪闭环、组织用户选择器与按钮治理

`v0.16.1` 是 `v0.16.0` 后的补丁版本，范围锁定 GitLab issue `#35/#26/#32/#33/#34`。本版本不新增 DDL，不扩大 SSO 协议面，不改变管理员 session 机制，也不做全站 UI 重构。

### 新增与修复

- 后台未登录、非法 session、过期 session、管理员不可用和权限不足会 best-effort 写入 `admin_auth_failure` 安全事件，request id 可在操作审计追踪页查询；写入失败不改变原始 401/403 响应。
- 操作审计追踪页支持在浏览器本地粘贴问题信息并提取 request id；粘贴原文不上传、不保存、不记录。
- 角色组织与用户绑定的已选区展示名称、头像/图标、主体类型、路径和 orphaned 状态，避免刷新后退化为只显示 ID。
- 飞书同步页继续使用只读 `OrgBrowser`，不出现角色绑定的选择、已选、保存或草稿语义。
- 按钮轻治理补齐基础不换行类和图标按钮可访问标签检查，范围限于关键后台页面。

### 安全与边界

- 追踪和问题信息解析不得记录或展示 cookie、token、authorization、raw payload、secret、授权码、token hash、state hash。
- 角色主体保存接口仍只提交组织和用户主体 ID，不把展示快照写入数据库。
- `#32/#33/#34` 只作为按钮形态、可访问标签、不换行和轻量检查纳入补丁，不做组件体系迁移。

### 验收

- 已通过后端定向测试：`pnpm --filter @feishu-iam/api test -- test/admin-error.filter.spec.ts test/admin-trace.service.spec.ts test/admin.controller.e2e-spec.ts test/iam-role.service.spec.ts test/version.controller.e2e-spec.ts`。
- 已通过前端定向测试：`pnpm --filter @feishu-iam/admin-web test -- src/features/records/trace-format.test.ts src/features/records/RecordQueryView.test.tsx src/features/permissions/PermissionManagementView.test.tsx src/features/settings/SystemSettingsView.test.tsx`。
- 已通过类型检查：`pnpm --filter @feishu-iam/api typecheck`、`pnpm --filter @feishu-iam/admin-web typecheck`。
- 已通过按钮轻治理检查：`pnpm --filter @feishu-iam/admin-web test:buttons`。
- 已通过完整检查：`pnpm check`，API 41 个测试文件 459 个测试通过，Admin Web 15 个测试文件 159 个测试通过。
- GitLab MR `!40` 已合并，GitLab issue `#35/#26/#32/#33/#34` 已关闭。
- 已发布镜像 `dockerhub.it.tangtring.com:80/ai/feishu-iam:v0.16.1` 和 `latest`，多架构 manifest digest 为 `sha256:c382b674a9581c7066ae92e0114b3abcf46c026772f360bf4c27b524ce9cfe52`，amd64 与 arm64 `docker pull --platform` 均通过。
- 已创建 GitLab release `v0.16.1`。
- 已在 `192.168.2.112:~/feishu-iam` 通过 amd64 离线 tar 和 `FEISHU_IAM_PULL_POLICY=never` 完成停机升级，备份目录为 `/home/dev/feishu-iam/backups/20260529-192428`，`/ready` 返回 ready，`/version` 返回 `0.16.1 / v0.16.1`。
- 已在线上复现未登录后台请求，返回的 request id 可在 `security_events` 中查到 `admin_auth_failure / ADMIN_SESSION_REQUIRED`。

## v0.16.0 - 生产追踪与接入排障

`v0.16.0` 是生产追踪与接入排障版本，范围锁定 GitLab issue `#27/#28/#29/#30/#31`。本版本聚焦 request id 排障主旅程，不扩大 SSO 协议面，不实现完整 OIDC、refresh token、SAML、ABAC、资源级权限、通用 BI 报表或外部链路追踪基础设施。

### 新增

- 新增只读追踪聚合接口 `/api/v1/admin/traces`，支持按 request id、应用、client、飞书 user_id、时间窗口和结果聚合审计日志、安全事件、OAuth token 与飞书同步 run。
- OAuth token exchange、`/oauth/userinfo` 和应用权限查询补齐最小安全事件，便于把 authorize、token、userinfo、权限查询和飞书同步串成诊断时间线。
- 操作审计新增「追踪」Tab，展示诊断摘要、覆盖阶段、部分命中、无结果、权限不足、时间线和事件详情。
- 统一问题提示页覆盖未登录、会话过期、无权限和 OAuth 接入失败，可复制 request id 与结构化问题信息。
- 应用详情和飞书同步 run 支持跳转到追踪视角，并保留应用、client 或 request id 上下文。
- 新增 [Feishu IAM 接入排障指南](docs/oauth-troubleshooting.md)，明确终端用户、接入开发者和管理员分别需要收集的字段。

### 安全与边界

- 追踪接口服务端完成权限裁剪：平台管理员和审计查看者可查全局，应用管理员只查授权应用，同步管理员只查同步相关事件。
- 追踪详情和问题提示页不记录、不展示、不要求转发 secret、token、cookie、authorization、授权码、token hash、state hash 或 raw payload。
- 本版本只新增追踪查询索引，不改变权限模型、管理员 session、生产部署拓扑或破窗登录边界。

### 验收

- 已通过 Prisma schema 校验：`DATABASE_URL=postgresql://feishu_iam:feishu_iam@127.0.0.1:5432/feishu_iam pnpm --filter @feishu-iam/api prisma:validate`。
- 已通过后端定向测试：`pnpm --filter @feishu-iam/api test -- test/admin-trace.service.spec.ts test/admin.controller.e2e-spec.ts test/oauth.service.spec.ts test/oauth.controller.e2e-spec.ts test/app-permissions.e2e-spec.ts test/oauth-error.filter.spec.ts`，6 个测试文件 192 个测试通过。
- 已通过前端定向测试：`pnpm --filter @feishu-iam/admin-web test -- src/routes/admin-url-state.test.ts src/components/admin/ProblemFeedbackPage.test.tsx src/features/records/trace-format.test.ts src/features/records/RecordQueryView.test.tsx src/features/applications/ApplicationManagementView.test.tsx src/features/settings/SystemSettingsView.test.tsx src/App.test.tsx`，7 个测试文件 102 个测试通过。
- 已通过类型检查和构建：`pnpm --filter @feishu-iam/api typecheck`、`pnpm --filter @feishu-iam/admin-web build`。前端构建仅保留既有 Vite chunk size warning。
- 已通过完整检查：`pnpm check`，API 41 个测试文件 449 个测试通过，admin-web 15 个测试文件 154 个测试通过，typecheck 和 lint 通过。
- GitLab MR `!39` 已合并，GitLab issue `#27/#28/#29/#30/#31` 已关闭。
- 已发布镜像 `dockerhub.it.tangtring.com:80/ai/feishu-iam:v0.16.0` 和 `latest`，多架构 manifest digest 为 `sha256:e4c469ce15223d05d7d241adb48325a54b8da8828c0e9d10d30f4228d5f1e43d`，amd64 与 arm64 `docker pull --platform` 均通过。
- 已创建 GitLab release `v0.16.0`。
- 已在 `192.168.2.112:~/feishu-iam` 通过 amd64 离线 tar 和 `FEISHU_IAM_PULL_POLICY=never` 完成停机升级，`/ready` 返回 ready，`/version` 返回 `0.16.0 / v0.16.0`。

## v0.15.2

`v0.15.2` 是组织与用户选择组件重构小版本，范围锁定 GitLab issue `#26`。本版本不新增 DDL、不改变 SSO 协议面，也不扩大权限模型。

### 调整

- 权限管理角色详情 `组织与用户绑定` Tab 的待选区改为组织和用户同列表展示，组织使用组织图标，用户使用用户图标，并保留主体类型标签。
- 组织浏览根级加载明确请求真实顶层组织，不再依赖未传父组织参数时的全量部门列表。
- 组织下钻、返回上级、搜索和加载更多不会清空右侧已选组织与用户草稿。
- 飞书同步页继续复用 `OrgBrowser` 只读浏览本地飞书镜像，排障主旅程不回退。

### 约束

- 保存结构仍使用 `feishu_department` 和 `feishu_user` 主体类型，不改变 `iam_role_subjects` 数据结构。
- 组织主体不等于自动展开全部用户；用户主体继续可以单独选择。
- 本版本不新增 Prisma schema、数据库迁移、资源级权限、ABAC、飞书角色同步或飞书用户组同步。
- 不在文档、测试、日志或会话归档中记录 secret、token、cookie、密码或其他敏感凭证。

### 验收

- 已通过前端定向测试：`pnpm --filter @feishu-iam/admin-web test -- PermissionManagementView.test.tsx`，9 个测试通过。
- 已通过前端全量测试：`pnpm --filter @feishu-iam/admin-web test`，13 个测试文件 145 个测试通过。
- 已通过类型检查：`pnpm --filter @feishu-iam/admin-web typecheck`、`pnpm --filter @feishu-iam/api typecheck`。
- 已通过 lint：`pnpm --filter @feishu-iam/admin-web lint`、`pnpm --filter @feishu-iam/api lint`。
- 已通过 `ADMIN_WEB_URL=http://localhost:5173 pnpm --filter @feishu-iam/admin-web test:responsive`，覆盖 12 条后台路由和 390、768、1280、1440 宽度视口，`failures: []`。
- 已使用 Playwright 打开本地 `http://localhost:5173/admin/permissions/crm/roles/role-1?tab=subjects`，确认根级组织请求包含 `parent_department_id=__root__`，下钻请求包含 `parent_department_id=od-root`，组织和用户同列表展示，下钻后已选组织与用户保留，console、Network 无错误。
- 已创建 GitLab MR：`http://gitlab.it.tangtring.com/ai/feishu-iam/-/merge_requests/38`。
- 已发布 `dockerhub.it.tangtring.com:80/ai/feishu-iam:v0.15.2` 和 `latest` 多架构镜像，manifest digest 为 `sha256:864d87d79384a9cce763c189198c03352edc5255a35f9eb3107e275ebd4147ab`。
- 已分别拉取验证 `linux/amd64` 和 `linux/arm64` 架构镜像；112 使用重新 `--platform linux/amd64 --load` 生成的 amd64 离线包升级。
- 已在 `192.168.2.112:~/feishu-iam` 通过 amd64 离线 tar 和 `FEISHU_IAM_PULL_POLICY=never` 完成停机升级，备份目录为 `/home/dev/feishu-iam/backups/20260528-221028`。
- 线上内网和域名入口 `/ready` 均返回 `ready`，`/version` 均返回 `0.15.2 / v0.15.2`。

## v0.15.1

`v0.15.1` 是权限可解释性小版本，范围锁定 GitLab issue `#21`，并纳入本轮发现的应用详情 `角色管理` 停用按钮变形修复。本版本不新增 DDL、不改变 SSO 协议面，也不恢复权限管理中的角色元数据管理。

### 新增

- 角色列表接口返回角色直接绑定的权限点，以及已绑定权限组内的权限点摘要，供后台展示最终权限来源。
- 权限管理角色详情 `权限组绑定` Tab 支持展开权限组内权限点，权限点展示名称、key、状态和描述。
- 权限管理角色详情新增 `最终权限点` 汇总区，合并直接绑定和权限组带来的有效权限点，展示来源为 `直接绑定`、`权限组` 或 `直接 + 权限组`，并支持按 key、名称、描述和来源搜索。

### 修复

- 应用详情 `角色管理` 列表中的启用/停用按钮统一为固定尺寸图标按钮，保留 `aria-label`、`title` 和危险确认流程，避免窄屏或列宽变化时文字按钮变形。
- 左侧导航普通一级入口和分组父级使用一致的可点击宽度，减少 hover 面积不一致的问题。

### 约束

- 本版本只做权限可解释性和后台控件稳定性增强，不新增 Prisma schema、数据库迁移、资源级权限、ABAC、飞书角色同步或飞书用户组同步。
- 权限管理继续只承载角色授权绑定，不恢复角色元数据新增、编辑或启停入口。
- 不在文档、测试、日志或会话归档中记录 secret、token、cookie、密码或其他敏感凭证。

### 验收

- 已通过后端定向测试：`pnpm --filter @feishu-iam/api test -- test/iam-role.service.spec.ts test/admin.controller.e2e-spec.ts`，2 个测试文件 134 个测试通过。
- 已通过前端定向测试：`pnpm --filter @feishu-iam/admin-web test -- src/features/permissions/PermissionManagementView.test.tsx src/features/applications/ApplicationManagementView.test.tsx src/components/admin/admin-components.test.tsx`，3 个测试文件 31 个测试通过。
- 已通过前后端类型检查：`pnpm --filter @feishu-iam/api typecheck`、`pnpm --filter @feishu-iam/admin-web typecheck`。
- 已通过 `pnpm --filter @feishu-iam/admin-web build`，仅保留既有 Vite chunk size warning。
- 已通过 `pnpm check`，其中 API 40 个测试文件 436 个测试通过，admin-web 13 个测试文件 145 个测试通过。
- 已通过 `ADMIN_WEB_URL=http://127.0.0.1:5173 pnpm --filter @feishu-iam/admin-web test:responsive`，覆盖 12 条后台路由和 390、768、1280、1440 宽度视口，`failures: []`，并确认应用详情角色停用按钮为 32px 图标按钮、角色详情最终权限点可展示 `直接 + 权限组` 来源。
- 已发布 `dockerhub.it.tangtring.com:80/ai/feishu-iam:v0.15.1` 和 `latest` 多架构镜像，manifest digest 为 `sha256:83adf0dd0c37f939645c11404c0a169be2207b18fa9131166cff3dee4380ff93`。
- 已分别拉取验证 `linux/amd64` 和 `linux/arm64` 架构镜像；112 使用重新 `--platform linux/amd64 --load` 生成的 amd64 离线包升级。
- 已创建 GitLab MR：`http://gitlab.it.tangtring.com/ai/feishu-iam/-/merge_requests/37`。
- 已在 `192.168.2.112:~/feishu-iam` 通过 amd64 离线 tar 和 `FEISHU_IAM_PULL_POLICY=never` 完成停机升级，备份目录为 `/home/dev/feishu-iam/backups/20260528-193359`。
- 线上内网和域名入口 `/ready` 均返回 `ready`，`/version` 均返回 `0.15.1 / v0.15.1`。
- 已使用 Playwright 打开生产 `http://feishu-iam.dev.tangtring.com/admin/applications/crm?tab=roles`、`/admin/permissions/crm/roles/role-1?tab=groups` 和 `/admin/system/info` 的 390px 与 1280px 视口，确认未登录态正常、无横向溢出、无请求失败或 5xx；未登录管理端身份接口返回预期 401。

## v0.15.0

`v0.15.0` 是组织树与组织用户选择器版本，范围锁定 GitLab issue `#19/#20/#24`。本版本不纳入 GitLab issue `#21`，不实现权限组树形勾选或最终权限点查看器。

### 新增

- 新增项目内封装的 `OrgBrowser`，用于本地飞书组织与用户镜像下钻浏览，支持搜索、分页加载、空态、错误态和区域隔离失败说明。
- 新增 `OrgUserSelector`，用于 IAM 角色绑定组织主体和用户主体，桌面使用双栏选择器，390px 窄屏使用 `待选 / 已选 / 摘要` 分步面板。
- 后端组织/用户候选接口补齐分页元信息和组织父子关系字段，角色主体保存接口支持 `{ org_subjects, user_subjects }` 的显式语义。

### 调整

- `系统管理 / 飞书同步` 首屏保留健康摘要、组织用户浏览、字段诊断和同步历史；全量同步继续降级到高级/危险操作区，排障主旅程不回退。
- 权限管理角色绑定明确“选择部门表示绑定组织主体，不等于自动绑定全部用户；用户可单独选择；重复覆盖不重复保存；移除摘要按主体类型展示”。
- 应用详情 `角色管理` 操作列继续使用稳定宽度、tooltip / aria label 和停用确认，避免窄屏换行或危险操作误触。

### 约束

- GitLab issue `#21` 明确排除到后续小版本。
- 本版本不新增 DDL、Prisma schema、SSO 协议面、飞书实时通讯录树、飞书角色同步、飞书用户组同步、资源级权限或 ABAC。
- 不在文档、测试、日志或会话归档中记录 secret、token、cookie、密码或其他敏感凭证。

### 验收

- 已通过后端定向测试：`pnpm --filter @feishu-iam/api test -- test/iam-role.service.spec.ts test/feishu-mirror-query.service.spec.ts`。
- 已通过前端定向测试：`pnpm --filter @feishu-iam/admin-web test -- src/features/settings/SystemSettingsView.test.tsx src/App.test.tsx`、`pnpm --filter @feishu-iam/admin-web test -- src/features/permissions/PermissionManagementView.test.tsx src/features/settings/SystemSettingsView.test.tsx`、`pnpm --filter @feishu-iam/admin-web test -- src/features/applications/ApplicationManagementView.test.tsx`。
- 已通过 `pnpm --filter @feishu-iam/admin-web build`，仅保留既有 Vite chunk size warning。
- 已通过 `pnpm check`，其中 API 40 个测试文件 436 个测试通过，admin-web 13 个测试文件 144 个测试通过。
- 已通过 `ADMIN_WEB_URL=http://127.0.0.1:5173 pnpm --filter @feishu-iam/admin-web test:responsive`，覆盖后台关键路由和 390、768、1280、1440 宽度视口，`failures: []`。
- 已发布 `dockerhub.it.tangtring.com:80/ai/feishu-iam:v0.15.0` 和 `latest` 多架构镜像，manifest digest 为 `sha256:94ab39ed247f3e8129cab62a91a78bf7bbbbff3017f6a66b74a1e09e099eab79`。
- 已分别拉取验证 `linux/amd64` 和 `linux/arm64` 架构镜像；112 使用重新 `--platform linux/amd64 --load` 生成的 amd64 离线包升级。
- 已创建 GitLab release：`http://gitlab.it.tangtring.com/ai/feishu-iam/-/releases/v0.15.0`。
- 已在 `192.168.2.112:~/feishu-iam` 通过 amd64 离线 tar 和 `FEISHU_IAM_PULL_POLICY=never` 完成停机升级，备份目录为 `/home/dev/feishu-iam/backups/20260528-171434`。
- 线上内网和域名入口 `/ready` 均返回 `ready`，`/version` 均返回 `0.15.0 / v0.15.0`。
- 已使用 Playwright 打开生产 `http://feishu-iam.dev.tangtring.com/admin/system/feishu`、`/admin/permissions/crm/roles/role-1?tab=subjects` 和 `/admin/applications/crm?tab=roles` 的 390px 与 1280px 视口，确认未登录态正常、无横向溢出、无请求 5xx；未登录管理端身份接口返回预期 401。

## v0.14.2

`v0.14.2` 是后台信息密度与控件稳定性修复小版本，范围锁定 GitLab issue `#18/#22/#23`。本版本只修改管理后台前端、设计规范和版本材料，不新增后端 API、DDL、权限模型或 SSO 协议面。

### 修复

- 修复应用详情 `开发信息` Tab 中新增回调地址按钮在窄屏下被挤压换行的问题，输入框和按钮组合改为稳定操作区。
- 移除权限管理筛选区下方重复的应用快捷查询按钮区域，保留应用下拉筛选作为唯一筛选入口。
- 将应用详情 `角色管理` Tab 的角色卡片堆叠改为普通表格/高密度列表，保留新增、查看、编辑和启停确认能力。

### 调整

- `DESIGN.md` 增补按钮文字、工具栏、表单操作区、表格操作列和 390px / 768px 响应式检查规则。
- 权限管理集成测试改为通过应用下拉筛选选择应用，不再依赖已移除的快捷应用列表。
- 部署默认版本、package 版本和 README Quick Start 更新到 `v0.14.2`。

### 约束

- 本版本明确排除 GitLab issue `#19/#20/#21`：不实现组织树选择器、权限组树形勾选、最终权限点查看器或权限点扩展。
- 本版本不新增后端 API、DDL、Prisma schema、权限模型、SSO 协议面或生产部署拓扑变更。
- 不在文档、测试、日志或会话归档中记录 secret、token、cookie、密码或其他敏感凭证。

### 验收

- 已通过前端定向测试：`pnpm --filter @feishu-iam/admin-web test -- src/features/applications/ApplicationManagementView.test.tsx src/features/permissions/PermissionManagementView.test.tsx`，2 个测试文件 20 个测试通过。
- 已通过 `pnpm --filter @feishu-iam/admin-web build`，仅保留既有 Vite chunk size warning。
- 已通过 `ADMIN_WEB_URL=http://127.0.0.1:5173 pnpm --filter @feishu-iam/admin-web test:responsive`，覆盖 12 条后台路由和 390、768、1280、1440 宽度视口，`failures: []`。
- 已使用 Playwright fallback 检查 390px 和 1280px 下应用详情 `开发信息`、`角色管理` 以及权限管理页面，确认新增回调按钮 `nowrap`、角色表格可见、快捷应用区不存在，且无 console error 或 request failed。
- 已通过 `pnpm check`，其中 API 40 个测试文件 436 个测试通过，admin-web 13 个测试文件 144 个测试通过。
- 已发布 `dockerhub.it.tangtring.com:80/ai/feishu-iam:v0.14.2` 和 `latest` 多架构镜像，manifest digest 为 `sha256:754fab751d132100c8f6fc2b990918d212b53ae7c21fef94e69320dd74289b27`。
- 已分别拉取验证 `linux/amd64` 和 `linux/arm64` 架构镜像。
- 已在 `192.168.2.112:~/feishu-iam` 通过 amd64 离线 tar 和 `FEISHU_IAM_PULL_POLICY=never` 完成停机升级，备份目录为 `/home/dev/feishu-iam/backups/20260528-110024`。
- 线上内网和域名入口 `/ready` 均返回 `ready`，`/version` 均返回 `0.14.2 / v0.14.2`。
- 已使用 Playwright 打开生产 `http://feishu-iam.dev.tangtring.com/admin/applications/crm?tab=development`、`/admin/applications/crm?tab=roles` 移动视口和 `/admin/permissions?appKey=crm`，确认未登录态正常、无横向溢出、无请求失败或 5xx；未登录管理端身份接口返回预期 401。

## v0.14.1

`v0.14.1` 是 GitLab issue `#17` 修复小版本，范围锁定应用详情页 Tab 化。它继承 `v0.14.0` 的独立应用详情页，不新增后端 API、DDL、权限模型或 SSO 协议面。

### 新增

- 应用详情页新增 `详细资料`、`角色管理`、`开发信息`、`危险操作` 四个 Tab，降低独立详情页的信息密度。
- 应用详情 Tab 状态进入 URL，支持通过 `tab=roles`、`tab=development`、`tab=danger` 直达对应分区。
- `tab` 切换保留 `from` 等已有查询参数，返回应用列表时继续保留来源上下文。
- 响应式检查新增应用详情三个 Tab 深链，覆盖 390、768、1280、1440 宽度视口。

### 调整

- 基础信息编辑留在 `详细资料`。
- 角色元数据管理留在 `角色管理`，权限管理继续只承载授权绑定。
- 回调地址、OAuth credential、Developer credential 和安全版接入提示词归入 `开发信息`。
- 应用启停、审计入口和只读说明归入 `危险操作`。
- 旧 `sheet=app:*` 抽屉深链继续兼容，使用本地 Tab 状态，不依赖 URL Tab。

### 约束

- 本版本不新增后端 API、DDL、Prisma schema、权限模型或 SSO 协议面。
- 本版本不实现完整 OIDC、SAML、ABAC、资源级权限、飞书角色同步、飞书用户组同步、HTTPS、高可用或滚动升级。
- 不在文档、测试、日志或会话归档中记录 secret、token、cookie、密码或其他敏感凭证。

### 验收

- 已通过前端定向测试：`pnpm --filter @feishu-iam/admin-web test -- src/features/applications/ApplicationManagementView.test.tsx src/App.test.tsx`，2 个测试文件 59 个测试通过。
- 已通过 `pnpm --filter @feishu-iam/admin-web build`，仅保留既有 Vite chunk size warning。
- 已通过 `pnpm check`，其中 API 40 个测试文件 436 个测试通过，admin-web 13 个测试文件 144 个测试通过。
- 已通过 `ADMIN_WEB_URL=http://127.0.0.1:5173 pnpm --filter @feishu-iam/admin-web test:responsive`，覆盖 12 条后台路由和 390、768、1280、1440 宽度视口，`failures: []`。
- 已使用 Playwright fallback 打开本地应用详情默认页和 `roles`、`development`、`danger` 三个 Tab 深链，确认无 console error、request failed 或横向溢出。
- 已发布 `dockerhub.it.tangtring.com:80/ai/feishu-iam:v0.14.1` 和 `latest` 多架构镜像，manifest digest 为 `sha256:b46fe5fb59cebe1aa54a02afd0cfaa347895ce9421dbdcd16b32e1fff3a54621`。
- 已分别拉取验证 `linux/amd64` 和 `linux/arm64` 架构镜像。
- 已创建 GitLab release：`http://gitlab.it.tangtring.com/ai/feishu-iam/-/releases/v0.14.1`。
- 已在 `192.168.2.112:~/feishu-iam` 通过 amd64 离线 tar 和 `FEISHU_IAM_PULL_POLICY=never` 完成停机升级，备份目录为 `/home/dev/feishu-iam/backups/20260528-044841`。
- 线上内网和域名入口 `/ready` 均返回 `ready`，`/version` 均返回 `0.14.1 / v0.14.1`。
- 已使用 Playwright 打开生产 `http://feishu-iam.dev.tangtring.com/admin/applications/crm?tab=development` 桌面和移动视口，以及 `/admin/system/info` 移动视口，确认未登录态正常、无横向溢出、无请求失败或 5xx；未登录管理端身份接口返回预期 401。

## v0.14.0

`v0.14.0` 是后台体验版本，合并处理 GitLab issue `#16/#6/#7/#9`。本版本不再单独拆 `v0.13.2`，而是把系统管理导航补齐、应用详情独立页和角色详情独立页放在同一发布范围内收口。

### 新增

- 新增 `/admin/applications/:appKey` 独立应用详情页，应用列表点击 `详情` 默认进入页面路由，并通过 `from` 参数保留返回列表上下文。
- 新增 `/admin/permissions/:appKey/roles/:roleId` 独立角色详情页，角色列表点击 `详情` 默认进入页面路由，并通过 `from` 参数保留应用、查询、状态、分页和排序上下文。
- 角色详情 Tab 状态进入 URL，刷新或复制链接后可恢复到 `总览`、`组织与用户绑定`、`权限组绑定`、`基础信息` 或 `操作说明`。
- `系统管理` 二级入口补充图标，桌面展开态、桌面收缩态和移动 Sheet 继续保留清晰层级。

### 调整

- `系统管理` 父级从“链接 + 独立 chevron”调整为单一整行展开/收起按钮，减少重复可访问控件。
- 应用详情和角色详情继续复用既有业务表单、确认弹框、凭证展示和绑定工作区，避免重写后端契约。
- 旧 `sheet=app:*` 和 `sheet=role:*` 深链继续兼容，便于历史链接或刷新状态过渡。
- 权限管理仍不暴露角色元数据新增、编辑或启停入口；这些能力继续归应用详情中的角色元数据工作区。

### 约束

- 本版本不新增后端 API、DDL、Prisma schema、权限模型或 SSO 协议面。
- 本版本不实现完整 OIDC、SAML、ABAC、资源级权限、飞书角色同步、飞书用户组同步、HTTPS、高可用或滚动升级。
- 不在文档、测试、日志或会话归档中记录 secret、token、cookie、密码或其他敏感凭证。

### 验收

- 已通过前端定向测试：`pnpm --filter @feishu-iam/admin-web test -- src/components/admin/admin-components.test.tsx src/App.test.tsx src/routes/admin-url-state.test.ts src/features/applications/ApplicationManagementView.test.tsx src/features/permissions/PermissionManagementView.test.tsx`。
- 已通过 `pnpm --filter @feishu-iam/admin-web build`，仅保留既有 Vite chunk size warning。
- 已通过 `pnpm check`，其中 API 40 个测试文件 436 个测试通过，admin-web 13 个测试文件 142 个测试通过。
- 已通过 `ADMIN_WEB_URL=http://127.0.0.1:5173 pnpm --filter @feishu-iam/admin-web test:responsive`，覆盖 9 条后台路由和 390、768、1280、1440 宽度视口，`failures: []`，并验证应用详情和角色详情默认入口不打开抽屉。
- 已发布 `dockerhub.it.tangtring.com:80/ai/feishu-iam:v0.14.0` 和 `latest` 多架构镜像，manifest digest 为 `sha256:ef1056f1ec36e223b2b71f08d5f119b3e2a718abef7aa239514f9ac14bc36582`。
- 已分别拉取验证 `linux/amd64` 和 `linux/arm64` 架构镜像。
- 已创建 GitLab release：`http://gitlab.it.tangtring.com/ai/feishu-iam/-/releases/v0.14.0`。
- 已在 `192.168.2.112:~/feishu-iam` 通过 amd64 离线 tar 和 `FEISHU_IAM_PULL_POLICY=never` 完成停机升级，备份目录为 `/home/dev/feishu-iam/backups/20260528-032802`。
- 线上内网和域名入口 `/ready` 均返回 `ready`，`/version` 均返回 `0.14.0 / v0.14.0`。
- 已使用 Playwright 打开生产 `http://feishu-iam.dev.tangtring.com/admin/applications/crm`、`/admin/permissions/crm/roles/role-1?tab=groups` 和 `/admin/system/info` 移动视口，确认未登录态正常、无横向溢出、无请求失败或 5xx；未登录管理端身份接口返回预期 401。

## v0.13.1

`v0.13.1` 是 GitLab issue `#12` 修复小版本，范围锁定后台左侧导航层级表达：让 `系统管理` 明确作为一级分组承载 `飞书同步 / 管理员授权 / 操作审计 / 系统信息` 四个二级入口。

### 修复

- 左侧导航支持带 children 的一级分组，`系统管理` 父级保留默认页链接，同时提供独立 chevron 展开/收起按钮。
- 当前处于系统管理二级页时，父级强制展开并禁用折叠按钮，避免刷新或切换后丢失当前位置上下文。
- 父级链接不再抢占 `aria-current`，当前页只标记到具体二级菜单项。
- 桌面收缩态隐藏二级 link，并通过 tooltip 内容展示二级入口摘要。
- 移动端 Sheet 使用完整层级，并修复浅色抽屉中二级菜单文字可读性不足的问题。
- 移动主菜单 Sheet 补充 sr-only 描述，避免无障碍告警。

### 约束

- 本版本不新增后端 API、DDL、Prisma schema、权限模型或部署拓扑。
- 本版本不改变生产管理员 session、管理员权限校验、SSO 协议面或飞书同步运维控制台能力边界。
- 不在文档、测试、日志或会话归档中记录 secret、token、cookie、密码或其他敏感凭证。

### 验收

- 已通过组件和 App 路由定向测试：`pnpm --filter @feishu-iam/admin-web test -- src/components/admin/admin-components.test.tsx src/App.test.tsx`，共 55 个测试通过。
- 已通过 `pnpm --filter @feishu-iam/admin-web lint`。
- 已通过 `pnpm --filter @feishu-iam/admin-web build`，仅保留既有 Vite chunk size warning。
- 已通过 `ADMIN_WEB_URL=http://localhost:5173 pnpm --filter @feishu-iam/admin-web test:responsive`，覆盖 7 条后台路由和 390、768、1280、1440 宽度视口，`failures: []`。
- 已使用 `@Browser` 打开本地 `http://localhost:3000/admin/system/audit`，通过 mock API 验证桌面展开、桌面收缩、移动 Sheet、当前二级页父级强制展开和无横向溢出。
- 已通过 `pnpm check`，其中 API 40 个测试文件 436 个测试通过，admin-web 13 个测试文件 142 个测试通过。
- 已发布 `dockerhub.it.tangtring.com:80/ai/feishu-iam:v0.13.1` 和 `latest` 多架构镜像，manifest digest 为 `sha256:77b0ae687635428ab611cd77bb67cb79ea92557b0f46e4a9d71fa7f1b8dcf055`。
- 已分别拉取验证 `linux/amd64` 和 `linux/arm64` 架构镜像。
- 已在 `192.168.2.112:~/feishu-iam` 通过 amd64 离线 tar 和 `FEISHU_IAM_PULL_POLICY=never` 完成停机升级，备份目录为 `/home/dev/feishu-iam/backups/20260528-022657`。
- 线上内网和域名入口 `/ready` 均返回 `ready`，`/version` 均返回 `0.13.1 / v0.13.1`。

## v0.13.0

`v0.13.0` 是飞书同步运维控制台版本，范围锁定 GitLab issue `#13`，把 `系统管理 / 飞书同步` 从状态页升级为面向排障定位的运维控制台。

### 新增

- 飞书同步控制台采用同步总览、组织与用户、同步历史、字段诊断和高级操作工作区，默认优先支持排障定位。
- 新增本地飞书部门和用户镜像查询接口，支持按部门、姓名、邮箱、手机号和状态查询，并在详情中展示脱敏联系方式、同步时间和 raw payload 诊断摘要。
- 新增用户级和部门级轻量同步入口，使用真实飞书通讯录同步能力补齐单个用户或单个部门范围的数据，不触发全局清理。
- 新增全量同步 preflight 和最新 run id 强确认，生产验收默认不会直接触发真实全量同步。
- 新增飞书同步相关权限拆分，区分查看同步状态、查询本地镜像、触发轻量同步和触发全量同步。

### 调整

- 管理后台 `系统管理 / 飞书同步` 不再只展示状态页，改为紧凑总览加多标签运维工作区。
- 前端飞书用户和部门搜索复用新的本地镜像查询契约，同时保持新增应用负责人等历史入口兼容。
- 全量同步入口改为高级操作，并要求先读取 preflight 后输入当前确认口令。

### 约束

- 本版本不新增后端 DDL，不改变飞书作为身份和组织主数据唯一来源的约定。
- 本版本不实现飞书组织树级联选择、飞书用户组同步、飞书角色同步、完整 OIDC、SAML、ABAC、资源级权限、HTTPS、高可用或滚动升级。
- 轻量同步失败时返回稳定错误信息，不在前端、日志或文档中展示 secret、token、cookie、密码或飞书原始敏感响应。

### 验收

- 已通过 API 定向测试：`admin.controller.e2e-spec.ts`、`admin-permission.service.spec.ts`、`feishu-mirror-query.service.spec.ts`、`feishu-sync.service.spec.ts`，共 152 个测试通过。
- 已通过 admin-web 定向测试：`App.test.tsx`、`SystemSettingsView.test.tsx`、`settings-format.test.ts`，共 58 个测试通过。
- 已通过 `pnpm --filter @feishu-iam/api typecheck`、`pnpm --filter @feishu-iam/admin-web typecheck`、`pnpm --filter @feishu-iam/api lint`、`pnpm --filter @feishu-iam/admin-web lint` 和 `pnpm --filter @feishu-iam/admin-web build`。
- 已通过 `ADMIN_WEB_URL=http://localhost:5173 pnpm --filter @feishu-iam/admin-web test:responsive`，覆盖 390、768、1280 和 1440 宽度下的主要后台页面。
- 已使用 Playwright mock API 打开本地飞书同步控制台，完成组织与用户查询、用户详情、用户轻量同步、全量同步 preflight 和确认弹框主流程，确认默认路径未发起真实全量同步请求。
- 已通过 `pnpm check`，其中 API 40 个测试文件 436 个测试通过，admin-web 13 个测试文件 140 个测试通过。
- 已发布 `dockerhub.it.tangtring.com:80/ai/feishu-iam:v0.13.0` 和 `latest` 多架构镜像，manifest digest 为 `sha256:657b5697e32a4e138a07cb95b9414a09341ec932ab7e8f3c09d0bac8ffd99b76`。
- 已分别拉取验证 `linux/amd64` 和 `linux/arm64` 架构镜像。
- 已在 `192.168.2.112:~/feishu-iam` 通过 amd64 离线 tar 和 `FEISHU_IAM_PULL_POLICY=never` 完成停机升级，备份目录为 `/home/dev/feishu-iam/backups/20260528-013004`。
- 线上内网和域名入口 `/ready` 均返回 `ready`，`/version` 均返回 `0.13.0 / v0.13.0`。
- 已使用 Playwright 打开生产 `http://feishu-iam.dev.tangtring.com/admin/system/feishu` 移动视口，确认未登录态正常、无横向溢出、无请求失败或 5xx；未登录管理端身份接口返回预期 401。

## v0.12.0

`v0.12.0` 是真实第三方接入验收收口版本，范围锁定为 `feishu-iam-sso-demo` 独立仓库验收沉淀、接入文档收口，以及两个影响接入配置生产体验的 GitLab issue 修复。

### 新增

- 将第三方接入 demo 独立仓库 [feishu-iam-sso-demo](http://gitlab.it.tangtring.com/ai/feishu-iam-sso-demo) 纳入 Feishu IAM README 和验收材料。
- 新增 `docs/acceptance/v0.12.0-third-party-sso-demo.md`，记录 OAuth 登录、授权码换 token、`/oauth/userinfo`、应用权限查询、前端权限展示和权限控制验收结论。

### 修复

- 修复 GitLab issue `#15`：新增应用接入包不再展示或允许手填 `负责人 user_id`，创建请求默认使用当前登录管理员的飞书 `user_id`。
- 修复 GitLab issue `#14`：创建平台管理员保存成功后关闭弹窗并留在有效列表状态，展示稳定成功反馈，不再跳转到可能为空白的详情页。
- 应用基础信息编辑不再允许手填负责人 `user_id`，负责人改为只读展示。

### 约束

- 本版本不新增后端 DDL，不改变 SSO Provider、权限计算、管理员 session 或审计日志后端契约。
- 本版本明确排除 `#13` 飞书同步运维控制台、完整 OIDC、SAML、ABAC、资源级权限、HTTPS、高可用和滚动升级。
- 不在 Feishu IAM 文档、测试或会话归档中记录 `client_secret`、developer token、cookie、密码或其他敏感凭证。

### 验收

- 已通过第三方接入 demo 独立仓库验收：demo 已部署到 `http://feishu-iam-sso-demo.dev.tangtring.com`，覆盖 Feishu IAM OAuth 登录、token、userinfo、权限读取和前端权限控制。
- 已通过应用管理和管理员授权前端定向测试，覆盖 22 个用例。
- 已通过 `pnpm check`，其中 API 39 个测试文件 419 个测试通过，admin-web 13 个测试文件 139 个测试通过。
- 已通过 `pnpm --filter @feishu-iam/admin-web build` 和 `ADMIN_WEB_URL=http://localhost:4173 pnpm --filter @feishu-iam/admin-web test:responsive`。
- 已使用 Playwright mock API 打开本地新增应用接入包和管理员授权页面，确认负责人输入框移除、创建应用请求默认携带当前管理员 `ownerUserId`、新增平台管理员成功后不打开详情空白页，console 和 request failure 均为空。
- 已发布 `dockerhub.it.tangtring.com:80/ai/feishu-iam:v0.12.0` 和 `latest` 多架构镜像，manifest digest 为 `sha256:be56fdc2d59841d52c8904acdb906353a07fc580ba912c8f5ca87ad5742942e0`。
- 已分别拉取验证 `linux/amd64` 和 `linux/arm64` 架构镜像。
- 已在 `192.168.2.112:~/feishu-iam` 通过 amd64 离线 tar 和 `FEISHU_IAM_PULL_POLICY=never` 完成停机升级，备份目录为 `/home/dev/feishu-iam/backups/20260527-195326`。
- 线上内网和域名入口 `/ready` 均返回 `ready`，`/version` 均返回 `0.12.0 / v0.12.0`。

## v0.11.3

`v0.11.3` 是权限管理角色授权工作区版本，范围限定为权限管理角色列表、按应用筛选和搜索角色、角色详情 Tab、组织与用户绑定、权限组绑定、保存前变更摘要、空/错/加载/无权限状态。

### 新增

- 权限管理角色清单聚焦授权工作区，只保留角色详情入口；角色元数据新增、编辑和启停继续归应用管理维护。
- 角色详情抽屉新增 Tab 工作区，覆盖总览、组织与用户绑定、权限组绑定、基础信息和保存说明。
- 组织与用户绑定支持按当前应用搜索飞书用户和飞书部门，草稿区区分已选组织和已选用户。
- 权限组绑定支持从当前应用的权限组中搜索、选择和移除，禁止跨应用绑定。
- 保存前通过确认弹框展示新增和移除摘要；保存失败保留草稿，便于管理员修正后重试。

### 调整

- 权限管理页标题和说明明确“角色元数据在应用管理维护”，避免同一角色在两个模块重复管理。
- 角色清单移动端只展示角色摘要和操作列，角色 key 收敛到角色摘要中，避免窄屏列挤压。
- 角色详情在应用或角色停用时进入只读授权状态，继续展示已有绑定和基础信息。

### 约束

- 本版本不新增后端 DDL，不改变 IAM 角色、主体绑定、权限组绑定和审计日志的后端契约。
- 本版本不实现飞书组织树级联选择、飞书用户组同步、飞书角色同步、ABAC、资源级权限或 deny 规则。
- 本版本不实现完整 OIDC、SAML、HTTPS、反向代理、高可用或滚动升级。

### 验收

- 已通过权限管理前端定向测试，覆盖角色清单、URL 详情状态、角色元数据入口移除、组织与用户绑定、权限组绑定和 403 无权限状态。
- 已通过 `pnpm check`，其中 API 39 个测试文件 419 个测试通过，admin-web 13 个测试文件 138 个测试通过。
- 已通过 `pnpm --filter @feishu-iam/admin-web build` 和响应式 overflow 检查。
- 已使用 Playwright mock API 打开本地权限管理页，完成详情抽屉、主体绑定、权限组绑定和保存前确认主流程；移动端截图确认无横向溢出。
- 已发布 `dockerhub.it.tangtring.com:80/ai/feishu-iam:v0.11.3` 和 `latest` 多架构镜像，manifest digest 为 `sha256:33385133b16cee506376975855a5a3f7044e3c4a5903c81f06e1f26abbce0af6`。
- 已分别拉取验证 `linux/amd64` 和 `linux/arm64` 架构镜像。
- 已在 `192.168.2.112:~/feishu-iam` 通过 amd64 离线 tar 和 `FEISHU_IAM_PULL_POLICY=never` 完成停机升级，备份目录为 `/home/dev/feishu-iam/backups/20260526-225056`。
- 线上内网和域名入口 `/ready` 均返回 `ready`，`/version` 均返回 `0.11.3 / v0.11.3`。
- 生产 Playwright 自检通过：权限管理入口在未登录态展示稳定的 Feishu IAM 管理后台登录页，仅出现预期 401 登录探测；未出现 5xx、非预期 console error 或横向溢出。

## v0.11.2

`v0.11.2` 是应用管理生产闭环版本，范围限定为应用清单、应用详情、基础信息编辑、回调地址维护、安全版接入提示词、应用启停确认和应用内角色元数据管理。

### 新增

- 应用清单返回并展示接入摘要，覆盖回调地址、OAuth client、developer credential 和角色元数据数量。
- 应用详情支持基础信息编辑、回调地址新增和停用、安全版接入提示词复制。
- 应用详情内新增角色元数据清单，支持新增角色、编辑角色基础信息、启用和停用角色。
- 角色授权入口明确标注为 `v0.11.3` 后续能力，不进入组织树授权和权限组绑定。

### 调整

- 应用管理员可以编辑和启停自己被授权管理的应用，不能创建新应用或管理未授权应用。
- 应用停用确认明确影响：阻断 OAuth 授权、换取 token、userinfo、权限查询和 developer API；配置、凭证摘要和角色元数据保留可读。
- 应用启用和停用审计动作调整为 `enable` / `disable`，回调地址停用审计动作调整为 `disable`。
- 安全版接入提示词不包含 client secret、developer token、cookie 或平台凭证，完整提示词仍只允许在创建或轮换凭证时一次性生成。

### 约束

- 本版本不实现 `#7` 的角色授权组织树、成员绑定和权限组绑定。
- 本版本不实现 `#13` 飞书同步控制台。
- 本版本不扩展完整 OIDC、ABAC、资源级权限、HTTPS、反向代理、高可用或滚动升级。
- 本版本不新增 DDL。

### 验收

- 已通过应用管理前端定向测试，覆盖清单摘要、基础信息编辑、回调地址维护、安全版提示词复制、停用确认和角色元数据状态。
- 已通过后端管理端和权限服务定向测试，覆盖应用摘要、应用管理员授权范围、回调地址停用、应用启停审计动作和 developer API 停用语义。
- 已发布 `dockerhub.it.tangtring.com:80/ai/feishu-iam:v0.11.2` 和 `latest` 多架构镜像，manifest digest 为 `sha256:252b60decca1021baea685e0abd024c8d54ae07d42df840920880596248a1f88`。
- 已在 `192.168.2.112:~/feishu-iam` 通过 amd64 离线 tar 和 `FEISHU_IAM_PULL_POLICY=never` 完成停机升级，备份目录为 `/home/dev/feishu-iam/backups/20260526-192549`。
- 线上 `/health` 返回 `ok`，`/ready` 返回 `ready`，`/version` 返回 `0.11.2 / v0.11.2`。
- 生产 Browser 自检通过：管理后台首页 200，未登录态展示飞书登录入口；仅出现预期的 `/api/v1/admin/me` 401，未出现非预期 network failure 或横向溢出。

## v0.11.1

`v0.11.1` 是飞书同步可信诊断版本，范围限定为 112 当前飞书同步失败、运行锁恢复、用户身份迁移和失败诊断展示。

### 修复

- 自动释放进程重启后遗留的超时 `running` 同步记录，避免后续触发同步一直被运行锁阻挡。
- 修复飞书 `open_id` 或 `union_id` 已存在但 `user_id` 变化时的本地用户主键迁移，避免同步因 `open_id` 唯一约束冲突失败。
- 同步失败时记录安全的失败阶段 `sync_stage` 和 request id，便于定位是锁、部门、用户还是清理阶段失败。
- 管理后台 `系统管理 / 飞书同步` 的同步历史和详情展示诊断摘要、失败阶段和 request id。

### 约束

- 本版本不新增飞书角色同步或飞书用户组同步。
- 本版本不改变飞书作为唯一身份主数据来源的架构。
- 本版本不新增 DDL，不记录明文 secret、token、cookie、密码或一次性凭证。

### 验收

- 已通过后端飞书同步和状态服务定向测试，覆盖 stale running、用户主键迁移和失败诊断字段。
- 已通过管理后台飞书同步页定向测试，覆盖失败阶段和 request id 展示。
- 已通过 `pnpm check`、`pnpm --filter @feishu-iam/admin-web build`、响应式检查和 Playwright 浏览器自检。
- 已发布多架构镜像 `dockerhub.it.tangtring.com:80/ai/feishu-iam:v0.11.1` 和 `latest`，manifest digest 为 `sha256:802e0691e86b2d94f0237099b1f738484968b967bf18af1fe3183cc2ab817654`。
- 已在 `192.168.2.112:~/feishu-iam` 使用 `linux/amd64` 离线镜像 tar 和 `FEISHU_IAM_PULL_POLICY=never` 停机升级验证，`/ready` 正常，`/version` 返回 `0.11.1 / v0.11.1`。
- 已在 112 触发真实飞书同步，旧 stale `running` 记录自动标记为 `FEISHU_SYNC_STALE_RUNNING`，新同步成功完成，最新状态接口显示 `configStatus=connected`、`running=false`。

## v0.11.0

`v0.11.0` 是系统管理 IA 与通用体验基线版本，范围限定为后台壳层、系统类入口、身份字段展示、列表列宽和详情底部遮挡规则。

### 调整

- 后台一级导航调整为 `工作台 / 应用管理 / 权限管理 / 系统管理`。
- `系统管理` 下沉 `飞书同步 / 管理员授权 / 操作审计 / 系统信息` 二级菜单。
- 原 `记录查询` 对外展示名称统一为 `操作审计`。
- 保留 `/admin/records`、`/admin/admins`、`/admin/settings` 等旧路由兼容，避免深链断掉。
- 管理员、审计、详情和顶部用户区中的身份字段统一展示清晰标签，例如 `飞书 user_id: xxx`。
- `DataTable` 默认优先填满容器宽度，状态列、时间列和操作列保持稳定宽度。
- `DetailSheet` 内容区增加底部留白，避免详情最后一项被底部区域遮挡。
- `AGENTS.md` 当前阶段更新为 `v0.11.0`，避免后续 Agent 误判为 `v0.8.1` 阶段。

### 约束

- 本版本不重做应用管理完整流程、角色详情、组织树选择或权限组绑定。
- 本版本不处理 112 飞书同步失败根因，该事项归入后续 `v0.11.1` 飞书同步可信诊断版本。
- 本版本不新增后端 DDL、完整 OIDC、SAML、ABAC、资源级权限、HTTPS、反向代理、高可用或滚动升级。

### 验收

- 已通过 `pnpm check`，其中 API 39 个测试文件 412 个测试通过，admin-web 13 个测试文件 134 个测试通过。
- 已通过 `pnpm --filter @feishu-iam/admin-web build`。
- 已通过 `ADMIN_WEB_URL=http://127.0.0.1:5173 pnpm --filter @feishu-iam/admin-web test:responsive`，覆盖工作台、应用管理、权限管理、系统管理二级菜单及 390、768、1280、1440 四类宽度。
- 已使用 Playwright 打开本地 `/admin/system/info`、`/admin/system/feishu`、`/admin/system/audit?tab=security` 和旧 `/admin/records?tab=security`，确认新菜单、旧路由跳转、页面级无横向溢出、console 和 network 无非预期错误。

### 发布

- 已发布多架构镜像 `dockerhub.it.tangtring.com:80/ai/feishu-iam:v0.11.0` 和 `latest`，manifest digest 为 `sha256:9ff7baefbb426a8ccafdfc377a4e6a8287b303af8c72e58c51c629294afb0e6e`。
- 已分别拉取验证 `linux/amd64` 和 `linux/arm64` 架构镜像。
- 已在 `192.168.2.112:~/feishu-iam` 使用 Docker Compose 停机升级验证，远端 Registry 拉取受访问权限限制时采用 `linux/amd64` 离线包导入，`/ready` 正常，`/version` 返回 `0.11.0` 和 `v0.11.0`。
- 已使用 Playwright 打开生产入口 `http://feishu-iam.dev.tangtring.com/admin/system/audit?tab=security`，页面正常展示未登录态，未登录访问管理端身份接口返回预期 401，页面无横向溢出；截图保存到 `/tmp/feishu-iam-v0.11.0-prod-system-audit-login.png`。

## v0.10.4

`v0.10.4` 是管理后台 GitLab issue 修复小版本，范围限定为权限管理 IAM 角色清单操作列样式和换行问题。

### 修复

- 修复权限管理 IAM 角色清单操作列按钮样式不一致的问题。
- 将 `详情 / 编辑 / 权限组 / 成员 / 停用或启用` 改为稳定的 icon button 组，参考管理员授权模块的操作列实现。
- 移除角色清单操作列中的 `flex-wrap`，避免常见桌面宽度下按钮拆成两行并抬高表格行高。

### 验收

- 已通过 `pnpm --filter @feishu-iam/admin-web exec vitest run src/features/permissions/PermissionManagementView.test.tsx`。
- 已通过 `pnpm --filter @feishu-iam/admin-web exec vitest run src/features/admin-users/AdminAuthorizationView.test.tsx src/components/admin/admin-components.test.tsx`。
- 已通过 `pnpm check` 和 `pnpm --filter @feishu-iam/admin-web build`。
- 已通过 `ADMIN_WEB_URL=http://localhost:5173 pnpm --filter @feishu-iam/admin-web test:responsive`，覆盖工作台、应用管理、权限管理、管理员授权、记录查询、系统设置及 390、768、1280、1440 四类宽度。
- 已使用 Playwright 打开权限管理页面，确认操作列单行展示、无明显溢出、按钮可点击，console 和 network 无非预期错误；截图保存到 `/tmp/feishu-iam-v0.10.4-permissions-actions-desktop.png` 和 `/tmp/feishu-iam-v0.10.4-permissions-actions-wide.png`。

### 发布

- 已发布多架构镜像 `dockerhub.it.tangtring.com:80/ai/feishu-iam:v0.10.4` 和 `latest`，manifest digest 为 `sha256:15a6470aa5c748be2e5488dfa88aaf1bab588e0f7ef8711a37266f65eeb95cdf`。
- 已在 `192.168.2.112:~/feishu-iam` 使用 Docker Compose 停机升级验证，`/ready` 正常，`/version` 返回 `0.10.4` 和 `v0.10.4`。
- 已使用 Playwright 打开生产入口 `http://feishu-iam.dev.tangtring.com/admin/permissions?appKey=ssoaccept223013`，页面正常展示未登录态，未登录访问管理端身份接口返回预期 401，无页面溢出或非预期失败请求；截图保存到 `/tmp/feishu-iam-v0.10.4-prod-admin-permissions.png`。

## v0.10.3

`v0.10.3` 是管理后台 GitLab issue 修复小版本，范围限定为顶部栏、右上角用户状态区域和管理员授权操作按钮布局。

### 修复

- 修复顶部栏右侧区域缺少收缩约束时可能被长用户信息撑破的问题。
- 将右上角用户状态改为用户按钮和下拉菜单，桌面端直接展示当前登录人的 `user_id`，退出登录入口收拢到菜单中。
- 修复管理员授权表格操作列按钮换行和列宽不稳定的问题，操作按钮改为固定宽度 icon button 组。
- 修复用户菜单下拉层级低于页面主操作按钮时的短暂遮挡问题。

### 验收

- 已通过 `pnpm --filter admin-web test -- --run App.test.tsx AdminAuthorizationView.test.tsx admin-components.test.tsx`。
- 已通过 `pnpm check` 和 `pnpm --filter @feishu-iam/admin-web build`。
- 已通过 `ADMIN_WEB_URL=http://localhost:5173 pnpm --filter @feishu-iam/admin-web test:responsive`，覆盖工作台、应用管理、权限管理、管理员授权、记录查询、系统设置及 390、768、1280、1440 四类宽度。
- 已用 Playwright 针对 `/admin/admins` 检查顶部栏、用户菜单、菜单层级和管理员授权操作列；截图保存到 `/tmp/feishu-iam-v0.10.3-admins-design-review-fixed-settled.png`。
- 已发布多架构镜像 `dockerhub.it.tangtring.com:80/ai/feishu-iam:v0.10.3` 和 `latest`，manifest digest 为 `sha256:0e1d2709e9fe5fbeb734ad556aca1ba14bb28a505554d74f4d9f3cd95a4cfe8e`。
- 已分别拉取验证 `linux/amd64` 和 `linux/arm64` 架构镜像。
- 已在 `192.168.2.112:~/feishu-iam` 使用 Docker Compose 停机升级验证，`/ready` 正常，`/version` 返回 `0.10.3` 和 `v0.10.3`。
- 已使用 Playwright 打开生产入口 `http://feishu-iam.dev.tangtring.com/admin/admins`，页面静态资源加载正常，未登录访问管理端身份接口返回预期 401，无请求失败或 5xx 响应；截图保存到 `/tmp/feishu-iam-v0.10.3-prod-admin-admins.png`。

## v0.10.1

`v0.10.1` 是管理后台 shadcn/tweakcn 运行时的阶段性收口版本，完成 S1-S6 切片后把工作台、应用管理、权限管理、管理员授权、记录查询和系统设置统一到新后台组件体系，并发布可部署镜像。

### 新增

- 新增 S6 CSS 清理与版本发布实施计划，明确 `v0.10.1` 正式发布边界和 `v0.10.2` 后续候选事项。
- 新增 `v0.10.1` 部署默认版本、镜像 tag 和 `/version` 运行时版本元数据。

### 调整

- 移除旧 `App.css`，把后台认证加载、失败和错误态迁移到 Tailwind/shadcn 基线。
- 删除 S1-S5 迁移后不再被引用的旧后台根组件、旧通用表格/弹窗/抽屉组件和旧应用详情子组件。
- 清理 `App.test.tsx` 中针对旧组件体系的跳过测试，当前管理后台测试不再保留迁移期 `it.skip`。
- README Quick Start、镜像下载信息、版本历史和部署说明更新到 `v0.10.1`。

### 验收

- 已通过 `pnpm --filter @feishu-iam/admin-web typecheck`、`pnpm --filter @feishu-iam/admin-web test`、`pnpm --filter @feishu-iam/admin-web build`、`pnpm --filter @feishu-iam/admin-web test -- src/App.test.tsx` 和 `pnpm check`。
- 已通过 `ADMIN_WEB_URL=http://localhost:5173 pnpm --filter @feishu-iam/admin-web test:responsive`，覆盖 `/admin/workspace`、`/admin/applications`、`/admin/permissions`、`/admin/admins`、`/admin/records?tab=security`、`/admin/settings` 及 390、768、1280、1440 四类宽度。
- 已使用 gstack browse 检查本地管理端入口和生产 `http://feishu-iam.dev.tangtring.com/admin/workspace`。生产入口静态资源加载正常，未登录访问管理端身份接口返回预期 401。
- 已完成本地 Docker 镜像构建验证：`docker build -f deploy/api.Dockerfile -t dockerhub.it.tangtring.com:80/ai/feishu-iam:v0.10.1-local .`。

### 发布

- 已发布多架构镜像 `dockerhub.it.tangtring.com:80/ai/feishu-iam:v0.10.1` 和 `latest`，manifest digest 为 `sha256:461780bb56a2e641d8dc4fad2f5994c575a064e750514b9842fd01c78ba0b917`。
- 已分别拉取验证 `linux/amd64` 和 `linux/arm64` 架构镜像。内网 HTTP Registry 对 `docker buildx imagetools inspect` 的 HTTPS 默认探测返回预期协议错误，因此以 `docker pull --platform` 和远端升级作为发布证据。
- 已在 `192.168.2.112:~/feishu-iam` 使用 Docker Compose 停机升级验证，`/ready` 正常，`/version` 返回 `0.10.1` 和 `v0.10.1`。远端 Registry 拉取受访问权限限制时，采用已发布镜像的 `linux/amd64` 离线包导入后以 `FEISHU_IAM_PULL_POLICY=never` 完成升级。

## v0.10.0

`v0.10.0` 是管理后台前端运行时重建的第一可信切片发布版本，重点把“记录查询 + 应用管理”切到 react-router + shadcn/tweakcn/Tailwind 基线。

### 新增

- 新增 react-router 路由与 query 深链 schema，覆盖 `/admin/records` 和 `/admin/applications` 的页签、分页、筛选和详情抽屉状态。
- 新增 shadcn/tweakcn/Tailwind 基础组件和后台组合组件，包括 AppShell、PageHeader、DataTable、FilterBar、DetailSheet、FormDialog、ConfirmDialog、CopyField 和 SecretRevealPanel。
- 新增记录查询 v0.10 切片，覆盖审计日志、安全事件、飞书同步记录、登录与 Token 记录、详情抽屉、403 no-permission、空状态、错误状态和敏感字段脱敏。
- 新增应用管理 v0.10 切片，覆盖应用清单、筛选、分页、新增接入包、一次性 `client_secret`/`developer_api_token` 展示、应用详情、Redirect URI、OAuth credential、developer credential、接入提示词和启停确认。

### 调整

- 管理后台入口切换为 BrowserRouter + AppShell 信息架构，`/admin` 默认重定向到 `/admin/records`。
- 旧 `apps/admin-web` 页面和组件层没有一次性删除；本切片仅替换记录查询与应用管理入口，其余权限管理、管理员授权、系统设置和工作台继续保留旧实现，等待后续切片迁移。
- 响应式溢出检查脚本更新为新 AppShell 验收规则，检查移动端菜单按钮、桌面端左侧主菜单、当前导航项和页面级横向溢出。
- 包版本、部署默认镜像 tag 和 `/version` 开发兜底版本更新为 `0.10.0`。

### 验收

- 已通过 `pnpm --filter @feishu-iam/admin-web typecheck`、`pnpm --filter @feishu-iam/admin-web test`、`pnpm --filter @feishu-iam/admin-web build`、`pnpm check`。
- 已使用 gstack browse 打开本地构建产物和 mock API，验证记录查询深链、敏感字段脱敏、Token 页签 URL 不泄密、应用详情、接入包创建成功、停用确认弹框和 390px 移动端无页面级横向溢出。
- 前端测试当前为 73 个通过、13 个旧 `App.test.tsx` 细节断言跳过；跳过项对应尚未迁移到 v0.10 shadcn/tweakcn 运行时的旧模块细节，不作为本切片完成范围。

### 发布

- 已发布多架构镜像 `dockerhub.it.tangtring.com:80/ai/feishu-iam:v0.10.0` 和 `latest`，manifest digest 为 `sha256:2e594d8d0b2c10cd6ae826d500eadf96c49aacbd1800f94115c6410197a81846`。
- 已在 `192.168.2.112:~/feishu-iam` 使用 Docker Compose 停机升级验证，`/ready` 正常，`/version` 返回 `0.10.0` 和部署提交 `05cb117`。
- 已使用 Chrome + Playwright 打开 `http://feishu-iam.dev.tangtring.com/admin/records`，页面正常渲染未登录态；未登录访问管理端 API 返回预期 401，无请求失败。

## v0.9.1

`v0.9.1` 是管理后台 shadcn/tweakcn 重构的设计基线与第一切片收口版本。

### 新增

- 新增 `DESIGN.md`，明确后续管理后台以 shadcn/ui + tweakcn 作为可持续设计基线，并保留 Feishu IAM 后台的克制制造业技术风格。
- 新增 `design/admin-console-v0.9.1.pen` 和 `design/pencil-input-v0.9.1.md`，沉淀 v0.9.1 管理后台原型与 Pencil 输入。
- 新增 v0.9.1 管理后台重构设计、再架构计划和第一切片执行计划，限定本轮只收口基础壳层与应用接入包主路径。
- 新增多份 `docs/codex-sessions/` 归档，记录设计评审、Pencil 修改、执行计划、QA、代码评审和验证结果。

### 调整

- 包版本和 `/version` 开发兜底版本更新为 `0.9.1`。
- 变基到 `v0.9.0` 主线后保留已发布的完整后台实现，避免旧 first-slice worktree 回退应用管理、权限管理、管理员授权、记录查询和系统设置能力。
- 数据库 schema 就绪版本继续沿用 `0.9.0`，因为本轮没有新增 DDL 或迁移。

### 发布

- 已发布多架构镜像 `dockerhub.it.tangtring.com:80/ai/feishu-iam:v0.9.1`，manifest digest 为 `sha256:e21a8c1e4ab92c46604e6d9587ee32017f69a7e47eaf886580393975a8b658a0`。
- 已在 `192.168.2.112:~/feishu-iam` 使用 Docker Compose 停机升级验证，`/ready` 正常，`/version` 返回 `0.9.1` 和 merge commit `4088f50`。

## v0.9.0

`v0.9.0` 是管理后台 Pencil 风格完整重构版本。

### 新增

- 新增 `design/admin-console.pen` 作为管理后台视觉权威源，并新增中文设计系统契约，约束颜色、字体、间距、表格密度、抽屉、确认弹框、状态页和响应式规则。
- 新增 v0.8.1 应用接入包在后台的完整管理表达，应用详情固定包含基础信息、Redirect URI、OAuth 凭证、开发者凭证、接入提示和操作记录。
- 新增开发者凭证与应用侧权限 API 的后台闭环，支持第三方系统用应用凭证读取自身权限目录。
- 新增记录查询四个真实 tab：审计日志、安全事件、同步记录、登录与 Token 记录，均提供列表、筛选、状态页和详情抽屉。
- 新增管理后台响应式回归脚本，覆盖 390、760、960、1280 等宽度下的导航、表格、抽屉和溢出检查。

### 调整

- 六个一级模块统一为“清单 -> 右侧详情抽屉”交互契约，筛选、分页、操作列、确认弹框和状态页使用同一套前端基础组件。
- 工作台首屏改为风险优先，优先展示待处理风险、同步异常、接入问题和快捷动作，再展示应用数、用户数、权限点数等指标。
- 窄屏导航改为顶部品牌区和横向滚动模块栏，保留当前模块可见，不使用汉堡菜单。
- 应用管理不再把旧环境模型作为主 UI，主界面改为应用级 Redirect URI、OAuth 凭证、开发者凭证和接入提示。
- 部署默认版本、包版本和运行时兜底版本更新为 `0.9.0`。

### 修复

- 修复 v0.9.0 迁移中 OAuth client 与应用接入包字段准备顺序问题，避免新字段就绪检查缺失。
- 修复管理后台表格、操作列、窄屏导航、抽屉、记录查询和 secret 操作在设计审查与 QA 中发现的可用性问题。
- 移除移动端表格宽度的 `!important` 覆盖，改为 CSS 变量驱动列宽，避免后续组件扩展时样式不可控。

### 发布

- 必跑门禁包括 `pnpm check`、管理端生产构建和真实浏览器响应式自检。
- 已发布多架构镜像 `dockerhub.it.tangtring.com:80/ai/feishu-iam:v0.9.0`，manifest digest 为 `sha256:8d6fc671a9de55347ee023cf3617db50beb69483a7b211b4b89549cd7691e03f`。
- 已在 `192.168.2.112:~/feishu-iam` 使用 Docker Compose 升级验证，`/ready` 正常，`/version` 返回 `0.9.0` 和 merge commit `ad3f598`。

## v0.6.0

`v0.6.0` 是生产化 Docker Compose 部署与停机升级闭环版本。

### 新增

- 新增单机 `db` + `web` Compose 部署形态，Web 默认映射宿主机 `8000` 端口。
- 新增镜像内 DDL 执行器和停机静态升级脚本。
- 新增服务器目录规范、部署说明和验收清单。
- 新增“王文哲”作为首个 `platform_admin` 的初始化 DDL。

### 调整

- PostgreSQL 不再映射宿主机端口，避免和其他 Compose 项目冲突。
- Web 服务使用 GitLab Docker Registry 镜像，不在服务器上构建源码。
- 生产路径移除破窗 Web 登录和 `BOOTSTRAP_SUPER_ADMIN_*` 配置。
- 部署根目录收敛为 `docker-compose.yaml`、`.env`、`upgrade.sh` 和必要运行目录。

### 约束

- 本版本不引入 HTTPS、域名、反向代理、高可用、完整 OIDC、SAML、refresh token、ABAC、资源级权限、飞书角色同步或飞书用户组同步。
- 真实服务器密码、飞书应用密钥、client secret、授权码、access token 和 cookie 均不进入仓库文档或会话归档。

## v0.5.1

`v0.5.1` 是内网 Docker Compose 部署与真实飞书 SSO 验证闭环版本。

### 新增

- 新增同源托管管理端静态资源的 API 容器部署路径，便于内网服务器只暴露 `3000` 端口完成后台和 API 验收。
- 新增 `/acceptance/oauth/callback` 验收辅助页，用于接收第三方应用授权码和 state；页面不保存授权码、不换 token、不展示 client secret。
- 新增 `deploy/compose.sh`、服务器环境模板、部署说明和真实飞书验收清单，支持 `192.168.2.112:3000` 的 Docker Compose 部署。
- `dev` 环境回调校验放行 RFC1918 私有 IPv4 的 HTTP callback，保留 `test`、`prod` 必须 HTTPS 的约束。
- Compose 服务补充 `restart: unless-stopped`，避免 Docker daemon 重启后内网验收服务不自动恢复。

### 修复

- 修复飞书 OAuth 用户信息仅返回 `open_id` 或 `sub` 时，本地用户匹配失败的问题。
- 修复飞书 `/authen/v2/oauth/token` 成功响应中 `access_token` 位于顶层时被误判为缺少 token 的问题。
- OAuth 飞书客户端错误现在记录稳定错误码和脱敏诊断字段，便于按 request id 排查，不记录授权码、token 或密钥。

### 验收

- 内网服务器 `192.168.2.112:3000` 已完成 `/ready` 和 `/version` 检查。
- 真实飞书 OAuth 授权已成功回调到 Feishu IAM 验收页，并签发 Feishu IAM 授权码。
- 已完成授权码换取 Feishu IAM access token、`/oauth/userinfo`、`/api/v1/apps/{app_key}/me/permissions` 和 `/oauth/revoke` 主链路验收。
- revoke 后再次访问 `/oauth/userinfo` 返回认证失败，确认 token 撤销生效。
- 当前验收用户在验收应用下未授予权限组或权限点，因此权限接口返回空清单；这是授权数据状态，不是链路故障。

### 约束

- 本版本不引入 HTTPS、域名、反向代理、完整 OIDC、SAML、refresh token、资源级权限、ABAC、飞书角色同步或飞书用户组同步。
- 真实服务器密码、飞书应用密钥、client secret、授权码、access token 和 cookie 均不进入仓库文档或会话归档。

## v0.5.0

`v0.5.0` 是管理后台与管理员体系最小闭环版本。

### 新增

- 新增管理员、后台角色、应用管理范围和后台 session 数据模型。
- 新增 `/admin/auth/login` 和 `/admin/auth/feishu/callback`，支持飞书管理员登录并写入 HttpOnly 后台 session cookie。
- 新增环境变量破窗超级管理员入口，用于首次绑定平台管理员和紧急恢复。
- 新增当时的破窗 Web 登录页，支持 localhost 或应急场景下进入管理员授权工作区。
- 新增 `/api/v1/admin/*` Web 管理端 API，使用管理员 session 和固定角色权限校验。
- 新增审计日志和安全事件查询能力。
- 管理端从平台 token 工具页升级为传统后台控制台。
- 管理端视觉参考唐群座椅深蓝、青绿和制造业技术风格。
- 管理端 logo 和 favicon 使用用户确认的 Feishu IAM 图标。

### 约束

- 保留 `/api/v1/platform/*` 给自动化和运维脚本。
- 破窗 Web 登录仅开放管理员授权工作区，不作为日常管理入口。
- 不实现完整 OIDC、SAML、refresh token、ABAC、资源级权限、飞书角色或飞书用户组同步。

## v0.4.0

`v0.4.0` 是 SSO Provider 最小可用闭环版本。

### 新增

- 新增应用环境、精确回调地址、应用 client、授权登录 state、授权码、access token 和安全事件数据模型。
- 新增 `/oauth/authorize`、`/oauth/feishu/callback`、`/oauth/token`、`/oauth/userinfo` 和 `/oauth/revoke`，实现授权码流程子集。
- 新增 `/api/v1/apps/{app_key}/me/permissions`，供第三方应用用 Feishu IAM access token 查询当前用户权限组和权限点。
- 新增平台 API 和管理端“接入配置”区域，支持环境、回调地址、client 创建、secret 一次性展示、secret 轮换和 client 禁用。
- 新增 SSO 统一错误页、稳定 OAuth 错误码、安全事件记录和 SSO 接入指南。

### 约束

- 本版本只实现授权码流程最小闭环，不实现完整 OIDC Discovery、JWKS、ID Token、SAML 或 refresh token 默认启用。
- access token 是服务端不透明 token，不在 token 中固化权限清单。
- 回调地址必须精确匹配，生产环境必须使用 HTTPS。
- 不扩展资源级权限、deny 规则、数据范围权限、ABAC、飞书角色或飞书用户组同步。

### 验收

- 自动化验证覆盖后端、管理端、Prisma schema 和 Docker Compose 配置。
- 本地 Docker 环境已完成 `0.4.0` 启动、健康检查、OAuth 路由检查、验收应用与 SSO client demo 配置准备、未登记 `redirect_uri` 统一错误页和安全事件验证。
- 真实浏览器 SSO client demo 登录链路因当前网络联通条件暂未执行；该项不是系统功能阻塞，正式服务器部署前需要在服务器网络环境中补验。

## v0.3.0

`v0.3.0` 是应用与权限模型底座版本。

### 新增

- 新增应用、权限组、权限点、IAM 角色、角色主体绑定、角色权限组绑定、角色权限点绑定和审计日志表。
- 新增权限领域校验、稳定错误响应、审计写入、应用服务、权限目录服务、IAM 角色服务和权限计算服务。
- 新增平台 API，覆盖应用、权限组、权限点、IAM 角色、绑定替换和用户权限预览。
- 新增管理端“应用与权限”区域，支持查看应用详情、权限组、权限点、IAM 角色和按 `user_id` 预览权限。
- 新增权限模型说明文档和 Agent 验收 checklist。

### 约束

- 本版本不实现 SSO/OAuth，不同步飞书角色或飞书用户组。
- 权限计算只使用飞书用户与直接部门镜像，不递归父部门。
- 禁用应用、角色、权限组和权限点不参与权限计算。

## v0.2.2

`v0.2.2` 是飞书身份镜像阶段的真实验收补丁版本。

### 修复

- 统一运行时和 Docker Compose 版本元数据为 `0.2.2`。
- 字段诊断接口补充飞书字段权限 scope 提示，便于真实租户补齐只读权限。
- 修复飞书返回自定义 `department_id` 后，后续查询仍按 `open_department_id` 调用导致的同步失败。
- 修复旧镜像曾用 `open_department_id` 作为本地部门主键时，权限补齐后返回自定义 `department_id` 触发的 `open_department_id` 唯一约束冲突。

### 验收

- 真实字段诊断已通过，无阻断项和警告。
- 真实同步 run `78ea128f-8ed1-4540-8dc3-5ac385bf96bf` 已成功。
- 当前真实镜像统计：`departments=316`、`activeDepartments=316`、`users=899`、`activeUsers=891`、`relations=1040`。

### 后续

- `v0.2.x` 身份镜像阶段收口后，下一阶段进入 `v0.3.0` IAM 内部应用、角色、权限组、权限点和授权关系设计。
