# Feishu IAM v0.5.0 管理后台与管理员体系设计

日期：2026-05-17
状态：已确认设计方向，待用户审阅书面规格

## 1. 版本目标

`v0.5.0` 的目标是让 Feishu IAM 管理后台从“内网平台 token 工具页”升级为“真实可授权、可审计、可日常使用的管理员控制台”。

`v0.4.0` 已经解决第三方系统如何接入 Feishu IAM 登录、换取 access token、读取 userinfo 和查询权限清单。`v0.5.0` 继续补齐 Feishu IAM 自身的日常管理闭环，让真实管理员可以用飞书身份登录后台，并按角色管理应用、权限、SSO 接入配置、飞书同步和审计追溯。

版本完成后，至少应支持：

1. 使用飞书用户身份进入 Feishu IAM 管理后台。
2. 把飞书用户绑定为 Feishu IAM 管理员。
3. 区分平台管理员、应用管理员、审计查看员、同步管理员。
4. Web 管理端写操作使用管理员登录态和管理员权限校验，不再依赖前端注入 `PLATFORM_ADMIN_TOKEN`。
5. 应用管理员只能管理被授权应用的权限模型、角色、client、回调地址和接入配置。
6. 审计查看员可以查询审计日志和安全事件，但不能修改业务配置。
7. 同步管理员可以查看和触发飞书同步，但不能改应用权限或 SSO client。
8. 环境变量超级管理员保留为紧急入口，用于首次绑定平台管理员和破窗恢复。
9. 平台 API token 继续保留给自动化、运维和 Agent 脚本，但不作为 Web 管理端日常权限模型。

一句话边界：`v0.5.0 = Feishu IAM 管理后台与管理员体系最小闭环`。

## 2. 不纳入范围

`v0.5.0` 不扩展以下能力：

- 完整 OIDC Discovery、JWKS、ID Token。
- SAML。
- refresh token。
- ABAC、资源级权限、deny 规则、数据范围权限。
- 飞书角色或飞书用户组同步。
- 多租户 SaaS 化。
- 平台 API token 的完整 scope 化改造。
- 可配置后台 RBAC 权限点系统。
- 把管理后台做成品牌官网或营销页面。

## 3. 管理员角色与权限矩阵

`v0.5.0` 使用固定管理员角色，不做可配置后台 RBAC。后台权限和第三方应用权限模型保持分离，避免把 Feishu IAM 自身管理权限和业务系统权限混在一起。

管理员角色：

- `platform_admin`：平台管理员，拥有全局管理能力。
- `application_admin`：应用管理员，只能管理被授权应用。
- `audit_viewer`：审计查看员，只读查看审计日志和安全事件。
- `sync_admin`：同步管理员，查看和触发飞书同步。

权限矩阵：

| 能力 | 平台管理员 | 应用管理员 | 审计查看员 | 同步管理员 |
|---|---:|---:|---:|---:|
| 查看系统状态 | 是 | 是 | 是 | 是 |
| 查看飞书同步状态 | 是 | 否 | 是 | 是 |
| 触发飞书同步 | 是 | 否 | 否 | 是 |
| 创建、编辑、禁用应用 | 是 | 否 | 否 | 否 |
| 管理应用权限组和权限点 | 是 | 仅授权应用 | 否 | 否 |
| 管理 IAM 角色和绑定 | 是 | 仅授权应用 | 否 | 否 |
| 管理 SSO 环境、回调地址、client | 是 | 仅授权应用 | 否 | 否 |
| 绑定管理员和角色 | 是 | 否 | 否 | 否 |
| 查看审计日志 | 是 | 仅授权应用相关 | 是 | 仅同步相关 |
| 查看安全事件 | 是 | 仅授权应用相关 | 是 | 否 |

关键规则：

- 应用管理员范围由 `admin_application_scopes` 控制。
- 平台管理员默认拥有全部应用范围，不需要逐个写入 scope。
- 权限校验必须在后端完成，前端隐藏按钮只是体验优化。
- 飞书用户不可用、已离职、未激活或已删除时，管理员登录和后续访问都必须失败。
- 所有 Web 管理端写操作审计 actor 使用真实管理员身份，不再写成 `platform-admin-token`。

## 4. 数据模型

新增管理员相关表：

### 4.1 `admin_users`

绑定飞书用户为 Feishu IAM 后台管理员。

字段建议：

- `id`：内部主键。
- `feishu_user_id`：飞书 `user_id`。
- `display_name`：管理员展示名，默认取飞书用户名称。
- `status`：`active` 或 `disabled`。
- `last_login_at`：最近登录时间。
- `created_at`、`updated_at`。

约束：

- `feishu_user_id` 唯一。
- 禁用管理员不可登录。
- 关联飞书用户不可用时不可登录。

### 4.2 `admin_roles`

保存固定管理员角色。

字段建议：

- `id`：内部主键。
- `role_key`：`platform_admin`、`application_admin`、`audit_viewer`、`sync_admin`。
- `name`：中文名称。
- `description`：说明。
- `created_at`、`updated_at`。

约束：

- `role_key` 唯一。
- 固定角色由迁移脚本初始化。

### 4.3 `admin_user_roles`

管理员与固定角色的绑定。

字段建议：

- `admin_user_id`。
- `admin_role_id`。
- `created_at`。

约束：

- 同一管理员同一角色只能绑定一次。

### 4.4 `admin_application_scopes`

应用管理员的应用管理范围。

字段建议：

- `admin_user_id`。
- `application_id`。
- `created_at`。

约束：

- 只对应用管理员生效。
- 同一管理员同一应用只能授权一次。

### 4.5 `admin_sessions`

后台管理端浏览器会话。

字段建议：

- `id`：内部主键。
- `session_hash`：session secret 的哈希，唯一。
- `admin_user_id`：管理员 ID。
- `expires_at`：过期时间。
- `revoked_at`：撤销时间。
- `ip`、`user_agent`。
- `created_at`、`last_used_at`。

约束：

- session secret 明文只写入 `HttpOnly` cookie，不落库。
- 默认有效期建议 8 小时。
- 退出登录时设置 `revoked_at`。

## 5. 后台登录与破窗入口

管理后台使用 Feishu IAM 自身后台登录态，不包装成第三方 SSO client。

### 5.1 管理员飞书登录

建议端点：

- `GET /admin/auth/login`
- `GET /admin/auth/feishu/callback`
- `POST /admin/auth/logout`
- `GET /api/v1/admin/me`

流程：

1. 管理员打开管理后台。
2. 无后台 session 时进入 `/admin/auth/login`。
3. Feishu IAM 使用企业级飞书自建应用跳转飞书 OAuth。
4. 飞书回调后按 `feishu_user_id` 查找 `admin_users`。
5. 管理员存在、状态为 `active` 且飞书用户可用时创建 `admin_sessions`。
6. 浏览器写入 `HttpOnly + SameSite=Lax` cookie。
7. 管理端调用 `/api/v1/admin/me` 获取当前管理员、角色和应用 scope。

错误码建议：

- `ADMIN_SESSION_REQUIRED`：未登录或 session 缺失。
- `ADMIN_SESSION_INVALID`：session 无效。
- `ADMIN_SESSION_EXPIRED`：session 已过期。
- `ADMIN_USER_NOT_BOUND`：当前飞书用户尚未被授权为管理员。
- `ADMIN_USER_DISABLED`：管理员已禁用。
- `ADMIN_USER_UNAVAILABLE`：关联飞书用户不可用。
- `ADMIN_PERMISSION_DENIED`：管理员权限不足。

### 5.2 环境变量超级管理员

保留环境变量超级管理员作为紧急入口。

配置建议：

- `BOOTSTRAP_SUPER_ADMIN_USERNAME`
- `BOOTSTRAP_SUPER_ADMIN_PASSWORD_HASH`

用途：

- 首次绑定至少一个平台管理员。
- 所有平台管理员被误禁用时恢复。
- 紧急禁用异常管理员。

约束：

- 破窗入口不参与普通应用、权限、SSO client 或飞书同步日常管理。
- 每次破窗登录、管理员绑定、角色变更和恢复操作都写高风险审计。
- 管理端必须明确提示当前处于破窗模式。
- 错误响应不暴露密码哈希、内部堆栈或 cookie。

## 6. 后端模块与 API 策略

新增 `admin` 模块，保留现有 `platform`、`permission`、`oauth`、`feishu` 模块。

### 6.1 `admin` 模块

职责：

- 管理员账号、角色、应用 scope。
- 后台 session 创建、校验、撤销。
- 管理员登录、退出、当前用户。
- `AdminSessionGuard`。
- `AdminPermissionService`。
- `AdminAuditContextFactory`。

### 6.2 审计查询服务

可以放在 `admin` 模块下：

- `AuditLogQueryService`
- `SecurityEventQueryService`

### 6.3 现有模块复用

- `permission` 模块继续承载应用、权限组、权限点、IAM 角色和权限计算领域能力。
- `oauth` 模块继续承载应用环境、回调地址、client、授权码、token 和应用侧权限接口。
- `feishu` 模块继续承载同步触发、状态和诊断。
- Web 管理端新增 `/api/v1/admin/*` controller，但底层复用现有领域服务，避免复制业务规则。

### 6.4 API 边界

保留 `/api/v1/platform/*`：

- 继续使用 `PLATFORM_ADMIN_TOKEN`。
- 面向自动化、运维、Agent 和脚本。
- actor 仍为 `platform_token`。

新增 `/api/v1/admin/*`：

- 使用后台 session cookie。
- 面向 Web 管理端。
- actor 为 `admin_user`。
- 所有写操作都执行管理员权限校验。

`v0.5.0` 必须迁移到 admin session 的 Web 操作：

- 当前管理员、角色和应用 scope 查询。
- 应用列表和详情可见性。
- 权限组、权限点、IAM 角色查看和写操作。
- SSO 环境、回调地址、client 创建、轮换和禁用。
- 飞书同步触发。
- 审计日志和安全事件查询。
- 管理员绑定、角色分配、应用 scope 分配。

`v0.5.0` 不要求删除旧平台 API，也不要求平台 token 完整 scope 化。

## 7. 审计日志和安全事件查询

`v0.5.0` 必须让管理员在后台追溯“谁在什么时间改了什么、影响哪个应用、结果如何、request id 是多少”。

### 7.1 审计日志 API

建议端点：

- `GET /api/v1/admin/audit-logs`
- `GET /api/v1/admin/audit-logs/{id}`

列表筛选：

- `actor_type`
- `actor_id`
- `source`
- `application_id` 或 `app_key`
- `resource_type`
- `resource_id`
- `action`
- `result`
- `request_id`
- `created_from`
- `created_to`

详情展示：

- 操作者。
- 来源。
- 目标资源。
- 动作。
- 结果。
- request id。
- IP、User-Agent。
- 时间。
- `before` 和 `after`。

敏感字段脱敏：

- `client_secret`
- `access_token`
- `refresh_token`
- `authorization`
- `cookie`
- `token`
- `secret`
- `password`

### 7.2 安全事件 API

建议端点：

- `GET /api/v1/admin/security-events`
- `GET /api/v1/admin/security-events/{id}`

列表筛选：

- `event_type`
- `application_id` 或 `app_key`
- `client_id`
- `feishu_user_id`
- `result`
- `reason_code`
- `request_id`
- `created_from`
- `created_to`

体验要求：

- reason code 显示中文解释。
- request id 可复制。
- 默认展示最近 24 小时或最近 100 条，避免首屏空白。
- 查询接口必须分页，不能一次性拉全表。

权限规则：

- 平台管理员：全部可查。
- 审计查看员：全部可查，但无写权限。
- 应用管理员：只能查被授权应用相关记录。
- 同步管理员：只能查同步相关审计日志，默认不查应用 client、角色授权等事件。

## 8. 管理端 UI/UX 设计

### 8.1 信息架构

管理端采用传统后台布局：

- 左上角：logo 和平台名称。
- 左侧：主菜单。
- 右上角：当前用户、角色、退出登录。
- 主区域：列表、表格、筛选、详情和表单。

一级导航：

- 工作台。
- 应用管理。
- 权限模型。
- SSO 接入。
- 飞书同步。
- 审计中心。
- 安全事件。
- 管理员授权。
- 系统状态。
- 接入文档。

首页采用“角色工作台优先”：

- 平台管理员看到全局应用、用户、client、风险和快捷操作。
- 应用管理员只看到被授权应用和相关待处理事项。
- 审计查看员看到审计、安全事件和查询入口。
- 同步管理员看到飞书同步状态、历史和触发入口。

### 8.2 唐群风格约束

UI 参考唐群座椅官网 `https://www.example.com/` 的品牌气质，但不做成官网营销页。

提炼原则：

- 主色：深蓝、青绿、白色。
- 气质：汽车零部件、制造业、品质认证、技术系统、全球布局。
- 表达：稳定、可靠、克制、可追溯。
- 不使用紫蓝大渐变、玻璃拟态、漂浮光球、空泛 AI 文案或过度装饰。
- 不堆叠大圆角卡片；卡片、表格和操作区保持 8px 以内圆角。
- 视觉重点落在真实业务对象：应用、client、权限组、IAM 角色、同步状态、审计日志、安全事件。

视觉参考依据：

- 唐群官网主视觉使用深蓝/青绿科技背景、白色标识和导航。
- 官网核心表达包括“汽车座椅舒适系统整合专家，源于1987”、舒适系统、智能座椅、合作伙伴、全球布局和品质认证。
- Feishu IAM 管理端只借鉴品牌色与制造业技术感，不复制官网动效、全屏 hero 或营销式布局。

### 8.3 操作体验

- 所有按钮、菜单和表单根据管理员权限裁剪。
- 不能操作的高风险能力优先隐藏；必须展示时禁用并说明原因。
- 高风险操作必须二次确认：
  - 禁用管理员。
  - 修改管理员角色。
  - 轮换 client secret。
  - 禁用 prod client。
  - 触发全量飞书同步。
  - 禁用应用。
- 空状态必须区分“没有权限”“没有数据”“需要平台管理员授权”。
- 错误提示必须包含稳定错误码、中文说明和 request id。
- secret、token、cookie 不在普通列表、审计详情或错误提示中展示。

### 8.4 Logo 设计

`v0.5.0` 的 UI 设计资产阶段需要使用图像生成工具生成 Feishu IAM logo 候选。

logo 约束：

- 参考唐群座椅品牌气质，不照搬唐群官网 logo。
- 表达身份、权限、可靠连接和企业内部系统。
- 适合放在传统后台左上角。
- 输出至少 2 到 3 个候选方向。
- 最终方案需要适配深蓝顶栏、浅色背景和 favicon。

## 9. 测试与验收

后端测试覆盖：

- 管理员绑定、禁用和角色分配。
- 应用管理员 scope 校验。
- 后台 session 创建、过期、撤销和用户不可用。
- `AdminSessionGuard` 和权限不足错误。
- Web 管理端写操作使用 `admin_user` actor 写审计。
- 应用管理员不能访问未授权应用数据。
- 审计查看员不能执行写操作。
- 同步管理员只能触发或查看同步相关能力。
- 审计日志查询筛选、分页和详情脱敏。
- 安全事件查询筛选、分页和详情脱敏。
- 破窗入口只能执行管理员恢复相关动作，并写高风险审计。

管理端测试覆盖：

- 登录态缺失时跳转后台登录。
- `/api/v1/admin/me` 返回不同角色时导航和按钮裁剪正确。
- 应用管理员只看到授权应用。
- 审计列表筛选、分页和详情展示。
- 安全事件列表筛选、分页和详情展示。
- 高风险操作出现二次确认。
- secret 只在创建或轮换后一次性展示，不进入普通列表和审计详情。
- 唐群风格后台布局在桌面和窄屏下不重叠。

验收命令：

```bash
pnpm check
pnpm prisma:validate
docker compose -f deploy/docker-compose.yml config --quiet
```

手工验收：

1. 用破窗入口绑定第一个平台管理员。
2. 用平台管理员登录后台。
3. 绑定一个飞书用户为应用管理员，并授权一个应用。
4. 应用管理员登录后只能看到授权应用。
5. 应用管理员修改该应用权限点或 client，审计日志记录真实 `admin_user` actor。
6. 应用管理员访问未授权应用时返回 `ADMIN_PERMISSION_DENIED`。
7. 审计查看员可以查询审计日志和安全事件，但不能修改配置。
8. 同步管理员可以触发飞书同步，但不能管理应用权限或 client。
9. 触发一次 OAuth 失败事件后，安全事件页面可按 reason code 查询。
10. 审计详情、错误提示和安全事件详情不泄露明文 secret、token、cookie 或 authorization header。

## 10. 版本交付物

`v0.5.0` 应交付：

- 管理员数据模型和迁移。
- `admin` 后端模块。
- 管理员登录、session、退出和当前用户接口。
- 管理员授权、角色和应用 scope 管理接口。
- Web 管理端 admin API 入口。
- 审计日志和安全事件查询 API。
- 管理端传统后台布局改造。
- 唐群风格 UI 主题初版。
- Feishu IAM logo 候选和选定方案。
- README、CHANGELOG、AGENTS 和管理端文档更新。
- Codex 会话归档。

## 11. 后续版本关系

`v0.5.0` 完成后，Feishu IAM 将具备“第三方系统可接入”和“平台管理员可日常使用”两个核心闭环。

后续版本可以再考虑：

- 应用团队自助接入门户。
- 平台 API token scope 化。
- 更完整的 OpenAPI 机器可读文档。
- refresh token 或完整 OIDC 兼容。
- 权限缓存和性能优化。
- 更细的后台管理员权限配置。
