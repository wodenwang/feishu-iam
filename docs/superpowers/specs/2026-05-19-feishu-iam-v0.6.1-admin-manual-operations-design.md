# Feishu IAM v0.6.1 管理后台手工配置闭环设计

日期：2026-05-19
状态：已确认设计方向，待用户审阅书面规格

## 1. 版本目标

`v0.6.1` 是 `v0.6.0` 之后的生产管理后台可用性补丁。`v0.6.0` 已经完成 `http://feishu-iam.example.com/` 的生产化 Docker Compose 部署和真实管理员登录；`v0.6.1` 聚焦解决登录后台后可见按钮无真实动作、无法通过页面创建应用和配置权限的问题。

一句话边界：

`v0.6.1 = 生产管理后台手工创建应用、权限组、权限点和应用管理员的可用闭环`。

版本完成后，平台管理员“王文哲”应能在管理后台手工完成：

1. 创建 demo 应用。
2. 在 demo 应用下创建权限点。
3. 在 demo 应用下创建权限组。
4. 把权限点加入权限组。
5. 通过姓名查找本地已同步飞书用户，找到“禹笑”和“鄢景松”。
6. 把“禹笑”和“鄢景松”创建为 demo 应用的 `application_admin`。
7. 确认后台可见按钮不会出现“点击无效”：要么有真实动作，要么有加载和错误反馈，要么被明确禁用。

## 2. 不纳入范围

`v0.6.1` 不做以下能力：

- HTTPS、反向代理、高可用或多 Web 实例。
- 完整 OIDC Discovery、JWKS、ID Token、refresh token 或 SAML。
- 资源级权限、ABAC、deny 规则或数据范围权限。
- 飞书角色同步或飞书用户组同步。
- 一键初始化 demo 样例按钮。
- 完整组织通讯录选择器。
- 应用接入向导重构。
- 平台 API token 的完整 scope 化。

本版本只补齐现有后台、现有权限模型和现有部署形态下的生产可用性，不扩大核心架构边界。

## 3. 推荐验收样例

系统不自动创建 demo 数据。文档和验收步骤提供推荐样例，由管理员在页面手工录入：

- 应用 `app_key`：`demo`
- 应用名称：`Demo 应用`
- 应用描述：用于验证 Feishu IAM 手工配置闭环

权限点和权限组可以按验收需要手工创建，但 key 必须遵循现有规则：

```text
^demo\.[a-z0-9][a-z0-9._-]{0,127}$
```

例如：

- 权限点：`demo.view.all`
- 权限点名称：查看 Demo
- 权限组：`demo.default`
- 权限组名称：Demo 默认权限组

## 4. 后端 API 设计

`v0.6.1` 主要补齐 `/api/v1/admin/*` 写接口，不改变底层权限模型。现有 `/api/v1/platform/*` 已提供应用、权限组、权限点和绑定关系的写能力，但它依赖 `PLATFORM_ADMIN_TOKEN`，不应作为 Web 管理后台的生产路径。

后台 API 继续使用管理员 session cookie，复用现有领域服务，并把审计 actor 写成真实管理员。

### 4.1 应用管理

新增：

```text
POST /api/v1/admin/applications
```

规则：

- 仅 `platform_admin` 可创建应用。
- 复用 `ApplicationService.createApplication`。
- `app_key` 沿用现有校验规则。
- 应用 key 冲突返回稳定错误 `APPLICATION_KEY_CONFLICT`。
- 审计 actor 使用当前管理员。

可作为同批补齐的接口：

```text
PATCH /api/v1/admin/applications/:appKey
POST /api/v1/admin/applications/:appKey/enable
POST /api/v1/admin/applications/:appKey/disable
```

这些接口用于避免页面存在状态或编辑按钮但无真实动作。若前端暂不提供编辑或状态按钮，对应接口可以不暴露，但不能保留无反馈按钮。

### 4.2 权限点管理

新增：

```text
POST /api/v1/admin/applications/:appKey/permission-points
```

规则：

- `platform_admin` 可操作全部应用。
- `application_admin` 只能操作自己被授权的应用。
- 权限点 key 必须以 `${app_key}.` 开头。
- 复用 `PermissionCatalogService.createPermissionPoint`。
- 重复 key、非法 key、应用不存在等错误保持稳定响应。

### 4.3 权限组管理

新增：

```text
POST /api/v1/admin/applications/:appKey/permission-groups
```

规则：

- 权限边界同权限点管理。
- 权限组 key 必须以 `${app_key}.` 开头。
- 复用 `PermissionCatalogService.createPermissionGroup`。

### 4.4 权限组绑定权限点

新增：

```text
PUT /api/v1/admin/applications/:appKey/permission-groups/:groupId/points
```

规则：

- 权限边界同权限点管理。
- 请求体使用当前已有平台接口语义，提交当前权限组完整权限点 ID 列表。
- 必须拒绝跨应用权限点。
- 空数组表示清空该权限组下的权限点绑定。
- 复用 `PermissionCatalogService.replacePermissionGroupPoints`。

### 4.5 飞书用户本地搜索

新增：

```text
GET /api/v1/admin/feishu-users/search?query=...
```

规则：

- 只查询本地 `feishu_users` 镜像表。
- 不直连飞书开放接口。
- 支持按姓名、英文名、`user_id`、邮箱等已同步字段做关键词搜索。
- 返回字段限于安全展示字段，例如 `user_id`、姓名、邮箱、手机号可见时的手机号、头像 key、状态、是否可用。
- 不返回 `raw_payload`。
- 未找到时返回空列表，由前端提示先确认飞书同步状态。

该接口用于在管理员授权时查找“禹笑”和“鄢景松”，不做完整组织通讯录选择器。

### 4.6 管理员授权

保留现有：

```text
POST /api/v1/admin/admin-users
GET /api/v1/admin/admin-users
```

调整重点在前端交互：

- 通过飞书用户搜索结果选择 `feishu_user_id`。
- 角色选择 `application_admin`。
- 应用范围从应用列表选择 demo 应用，不再要求手填 `applicationId`。
- 后端继续要求 `platform_admin` 才能创建管理员。

## 5. 审计和安全

所有新增写接口必须写入 `audit_logs`。

审计字段约定：

- `actor_type`：`admin_user`
- `actor_id`：当前 `adminUserId`
- `source`：`admin_web`
- `resource_type`：`application`、`permission_point`、`permission_group` 或 `admin_user`
- `resource_id`：被操作资源 ID
- `action`：`create`、`update`、`set_status` 或 `replace_permission_points`
- `result`：成功写 `success`
- `request_id`、`ip`、`user_agent`：来自当前请求上下文

安全规则：

- 前端、后端日志、文档和会话归档都不得显示 secret、token、cookie、真实 `.env` 或密码。
- `client_secret` 的一次性展示规则不在本版本改变。
- 错误响应不透出堆栈、框架默认错误或内部 SQL。
- 权限校验必须在后端完成，前端隐藏按钮只是体验优化。

## 6. 前端交互设计

`v0.6.1` 不重做后台信息架构，继续沿用当前传统后台布局，在“应用与权限”和“管理员授权”两个区域补齐真实操作。

### 6.1 应用与权限区域

应用列表顶部增加“创建应用”入口。可以使用紧凑表单或弹窗，字段包括：

- `app_key`
- 应用名称
- 描述
- owner 飞书 `user_id`

交互规则：

- 仅 `platform_admin` 可见可用。
- 非 `platform_admin` 不显示创建按钮，或显示只读说明。
- 创建成功后，应用立即进入左侧列表并自动选中。
- 自动加载该应用下的权限组、权限点、IAM 角色和 SSO 接入配置。

权限组卡片增加“创建权限组”入口：

- 字段：key、名称、描述。
- key 输入时提示必须以 `${app_key}.` 开头。
- 成功后刷新当前应用的权限组列表。

权限点卡片增加“创建权限点”入口：

- 字段：key、名称、描述。
- key 输入时提示必须以 `${app_key}.` 开头。
- 成功后刷新当前应用的权限点列表。

权限组详情增加“绑定权限点”入口：

- 从当前应用已有权限点中多选。
- 保存时提交完整权限点 ID 列表。
- 不做跨应用选择。
- 不做拖拽排序。

### 6.2 管理员授权区域

管理员授权区域保留平台管理员才能创建管理员的规则。

新增“查找飞书用户”能力：

- 输入姓名或关键词。
- 调用本地飞书用户搜索接口。
- 搜索结果展示姓名、`user_id`、状态和可用性。
- 选择用户后自动填入管理员授权表单。

管理员创建表单调整：

- 角色选择支持 `application_admin`。
- 应用范围从当前应用列表中选择，不再手填 `applicationId`。
- 创建“禹笑”和“鄢景松”时选择 demo 应用。
- 创建成功后刷新管理员列表，并显示“应用管理员 / demo 应用”。

### 6.3 按钮和反馈规则

后台所有可见按钮必须满足以下任一条件：

1. 有真实后端动作。
2. 有明确加载、成功和失败反馈。
3. 因权限或前置条件不足被禁用，并展示原因。
4. 暂无后端能力时不显示为可点击按钮。

当前已有的刷新、同步、创建环境、创建回调地址、创建 client、轮换 secret、停用 client 等按钮，需要保留现有功能并补齐必要反馈，避免无声失败。

## 7. 权限数据流

1. 王文哲登录后台。
2. 前端调用 `/api/v1/admin/me` 获取 `platform_admin` 身份。
3. 前端加载应用列表。
4. 王文哲创建 `demo` 应用。
5. 后端写入 `applications` 和 `audit_logs`。
6. 前端自动选中 `demo` 并加载详情。
7. 王文哲创建权限点和权限组。
8. 王文哲把权限点绑定到权限组。
9. 王文哲搜索“禹笑”和“鄢景松”。
10. 后端查询本地 `feishu_users`，返回已同步且可展示的用户候选。
11. 王文哲选择对应用户，创建两个 `application_admin`，应用范围为 demo 应用。
12. 禹笑或鄢景松登录后台后，只能看到和管理 demo 应用，不能创建新应用、不能授权管理员、不能管理其他应用。

## 8. 错误处理

统一错误体验：

- 未登录：提示“需要登录 Feishu IAM 管理后台”，引导飞书登录。
- 权限不足：提示“当前管理员无权执行该操作”。
- 应用 key 冲突：提示“应用 key 已存在”。
- 权限 key 不符合前缀：提示“权限 key 必须以当前 app_key 加点号开头”。
- 搜索不到飞书用户：提示“未找到已同步飞书用户，请先确认飞书同步状态”。
- 请求失败：展示稳定中文错误和 request id。

前端做即时校验，后端做最终校验。任何前端校验都不能替代后端权限和数据完整性校验。

## 9. 验收标准

### 9.1 本地自动化

后端测试覆盖：

- `POST /api/v1/admin/applications` 仅 `platform_admin` 可创建应用。
- `application_admin` 不能创建应用。
- `platform_admin` 和授权应用的 `application_admin` 可创建权限点、权限组。
- 未授权应用的 `application_admin` 被拒绝。
- 权限组绑定权限点拒绝跨应用绑定。
- 飞书用户搜索只返回本地镜像安全字段。
- 新增写接口写入管理员审计上下文。

前端测试覆盖：

- 创建应用并自动选中。
- 创建权限点。
- 创建权限组。
- 绑定权限点到权限组。
- 搜索飞书用户并选择。
- 创建 demo 应用管理员。
- 无权限用户看不到或不能使用对应按钮。
- 提交失败时展示稳定错误和 request id。

全仓检查：

```bash
pnpm check
```

必须通过，或记录明确阻塞原因。

### 9.2 本地手工验收

- 登录后台后，逐项点击所有可见按钮。
- 每个按钮都应有真实动作、加载反馈、错误反馈或明确禁用状态。
- 不允许出现无声点击、页面无变化且无提示的交互。

### 9.3 远端验收

发布 `v0.6.1` 镜像并在 `192.168.2.112` 执行：

```bash
./upgrade.sh
```

验收项目：

- `/ready` 通过。
- `/version` 返回 `0.6.1`。
- 王文哲可以在 `http://feishu-iam.example.com/` 登录后台。
- 王文哲可以手工创建 demo 应用。
- 王文哲可以在 demo 应用下手工创建权限点。
- 王文哲可以在 demo 应用下手工创建权限组。
- 王文哲可以把权限点绑定到权限组。
- 王文哲可以搜索“禹笑”和“鄢景松”。
- 王文哲可以把二人创建为 demo 应用的 `application_admin`。
- 禹笑或鄢景松登录后仅能看到和管理 demo 应用。
- 审计日志能看到相关创建和绑定操作。

## 10. 剩余风险

- 如果“禹笑”或“鄢景松”尚未被飞书同步到本地镜像，需要先触发飞书同步。
- 如果远端反向代理对 cookie、请求体或 HTTP 方法有限制，部署验收时需要现场诊断；`v0.6.1` 不负责反向代理改造。
- 如果现有前端 `App.tsx` 继续膨胀，实施时应在当前范围内拆出小组件，但不做无关重构。

## 11. 后续版本建议

`v0.6.1` 收口后，如需继续提升接入体验，可以另起版本规划“应用接入向导”，把创建应用、环境、回调地址、client、权限模型和应用管理员授权串成一步步流程。该能力不应混入本补丁版本。
