# Feishu IAM v0.3.0 应用与权限模型设计

日期：2026-05-16
状态：已确认，可进入实施计划阶段

## 1. 版本目标

`v0.3.0` 是 Feishu IAM 的权限底座版本。本版本建立 IAM 内部应用、IAM 角色、权限组、权限点和授权关系，让系统可以在已有飞书用户与部门镜像之上计算用户在指定应用下拥有的权限。

本版本完成后，管理员应该可以：

1. 创建一个内部应用并设置全局唯一 `app_key`。
2. 为该应用维护权限组和权限点。
3. 创建 IAM 角色。
4. 将 IAM 角色绑定到飞书用户或飞书部门。
5. 将 IAM 角色授权到权限组和权限点。
6. 查询指定飞书用户在指定应用下最终拥有的权限组和权限点。
7. 通过审计日志追溯权限模型写操作。

本版本不实现 SSO/OAuth 登录闭环。`v0.3.0` 的职责是先把权限模型和权限计算做扎实，供后续 `v0.4.0` SSO Provider 直接消费。

## 2. 设计原则

- 飞书仍然是身份和组织主数据的唯一来源。
- IAM 角色在 Feishu IAM 内部建模，不依赖飞书角色或飞书用户组。
- 授权主体第一版只支持飞书用户和飞书部门。
- 权限数据必须按应用隔离。
- 权限点 key 必须以 `${app_key}.` 开头。
- 管理后台和平台 API 必须复用同一套后端校验逻辑。
- 禁止跨应用绑定权限组、权限点或角色授权。
- 禁用对象不参与权限计算。
- 所有写操作必须写入审计日志。
- 删除操作默认使用软删除或禁用，不提供常规硬删除能力。

## 3. 范围

### 3.1 纳入范围

- 应用管理基础模型：创建、查询、更新、禁用应用。
- 权限组管理：创建、查询、更新、禁用权限组。
- 权限点管理：创建、查询、更新、禁用权限点。
- 权限组和权限点关系管理。
- IAM 角色管理：创建、查询、更新、禁用角色。
- IAM 角色主体绑定：绑定飞书用户和飞书部门。
- IAM 角色权限绑定：绑定权限组和权限点。
- 权限计算服务：按 `app_key` 和飞书 `user_id` 计算权限结果。
- 平台 API：提供应用、权限模型、角色授权和权限计算接口。
- 管理端最小闭环页面：应用、权限组、权限点、角色授权和权限预览。
- 审计日志基础表和写入能力，覆盖本版本所有写操作。
- 自动化测试、中文文档和 Codex 会话归档。

### 3.2 排除范围

- 不实现 `/oauth/authorize`、`/oauth/token`、`/oauth/userinfo`。
- 不实现第三方应用登录跳转闭环。
- 不实现完整 OIDC 协议。
- 不实现完整管理员登录体系。
- 不同步飞书角色或飞书用户组。
- 不支持把 IAM 角色绑定到飞书角色或飞书用户组。
- 不实现 deny 规则、资源级权限、数据范围权限或 ABAC 表达式。
- 不实现应用环境、回调地址、client secret 的完整管理闭环。
- 不实现权限计算缓存。先保证计算正确，缓存放入后续性能或 SSO 版本。
- 不提供硬删除能力。

## 4. 核心概念

### 4.1 应用

应用表示一个接入 Feishu IAM 的内部系统，例如 `finance`、`oa`、`crm`。每个应用拥有全局唯一 `app_key`。

`app_key` 规则：

```text
^[a-z][a-z0-9_-]{1,31}$
```

应用状态：

- `active`：可维护权限模型并参与权限计算。
- `disabled`：不可参与权限计算，相关权限查询返回空结果或稳定错误。

### 4.2 权限点

权限点是第三方应用可消费的最小权限单元，例如 `finance.invoice.read`。

权限点 key 规则：

```text
^${app_key}\.[a-z0-9][a-z0-9._-]{0,127}$
```

规则说明：

- 权限点必须属于一个应用。
- 权限点 key 必须以当前应用 `app_key` 加英文句点开头。
- 不能创建缺少应用前缀的权限点。
- 不能在一个应用下创建另一个应用前缀的权限点。
- 禁用权限点不进入权限计算结果。

### 4.3 权限组

权限组是权限点集合，例如 `finance.invoice_manager`。第三方应用可以直接使用权限组控制粗粒度菜单，也可以使用展开后的权限点控制按钮和接口。

权限组 key 也按应用隔离，建议使用与权限点相同的前缀规则：

```text
^${app_key}\.[a-z0-9][a-z0-9._-]{0,127}$
```

禁用权限组不进入权限计算结果。禁用权限组后，其包含的权限点不会通过该组授予用户。

### 4.4 IAM 角色

IAM 角色是 Feishu IAM 内部的授权载体。角色属于单个应用，用于把飞书主体映射到权限组和权限点。

角色可以：

- 绑定多个飞书用户。
- 绑定多个飞书部门。
- 绑定多个权限组。
- 直接绑定少量权限点。

角色状态：

- `active`：参与权限计算。
- `disabled`：不参与权限计算。

### 4.5 授权主体

`v0.3.0` 支持两类授权主体：

- `feishu_user`：主体 ID 为 `feishu_users.user_id`。
- `feishu_department`：主体 ID 为 `feishu_departments.department_id`。

主体不存在、已删除或已被飞书同步标记为删除时，角色绑定保留但标记为不可用，不参与权限计算。这样可以保留审计追溯，不因为飞书侧变化丢失历史配置。

## 5. 数据模型

### 5.1 `applications`

字段建议：

- `id`：内部主键。
- `app_key`：全局唯一应用 key。
- `name`：应用名称。
- `description`：应用说明。
- `owner_user_id`：负责人飞书 `user_id`，可为空。
- `status`：`active` 或 `disabled`。
- `created_at`、`updated_at`。

约束：

- `app_key` 唯一。
- `app_key` 创建后不可修改。
- `owner_user_id` 可关联已有飞书用户，但不阻断应用创建。

### 5.2 `permission_groups`

字段建议：

- `id`：内部主键。
- `application_id`：所属应用。
- `key`：权限组 key。
- `name`：权限组名称。
- `description`：权限组说明。
- `status`：`active` 或 `disabled`。
- `created_at`、`updated_at`。

约束：

- 同一应用下 `key` 唯一。
- `key` 必须通过当前应用 `app_key` 前缀校验。

### 5.3 `permission_points`

字段建议：

- `id`：内部主键。
- `application_id`：所属应用。
- `key`：权限点 key。
- `name`：权限点名称。
- `description`：权限点说明。
- `status`：`active` 或 `disabled`。
- `created_at`、`updated_at`。

约束：

- 同一应用下 `key` 唯一。
- `key` 必须通过当前应用 `app_key` 前缀校验。

### 5.4 `permission_group_points`

字段建议：

- `permission_group_id`：权限组 ID。
- `permission_point_id`：权限点 ID。
- `created_at`。

约束：

- 复合唯一：`permission_group_id` 和 `permission_point_id`。
- 权限组和权限点必须属于同一应用。

### 5.5 `iam_roles`

字段建议：

- `id`：内部主键。
- `application_id`：所属应用。
- `key`：角色 key。
- `name`：角色名称。
- `description`：角色说明。
- `status`：`active` 或 `disabled`。
- `created_at`、`updated_at`。

约束：

- 同一应用下 `key` 唯一。
- 角色不能绑定其他应用的权限组或权限点。

角色 key 建议规则：

```text
^[a-z0-9][a-z0-9._-]{0,127}$
```

角色 key 不强制加 `app_key` 前缀，因为角色天然从属于单个应用。但 API 响应中必须同时返回 `app_key` 和角色 `key`，避免跨应用阅读时产生歧义。

### 5.6 `iam_role_subjects`

字段建议：

- `id`：内部主键。
- `iam_role_id`：角色 ID。
- `subject_type`：`feishu_user` 或 `feishu_department`。
- `subject_id`：飞书 `user_id` 或部门 `department_id`。
- `is_orphaned`：主体在飞书镜像中不存在或已删除时标记为 `true`。
- `created_at`、`updated_at`。

约束：

- 同一角色下 `subject_type` 和 `subject_id` 唯一。
- 主体类型必须在枚举范围内。

### 5.7 `iam_role_permission_groups`

字段建议：

- `iam_role_id`：角色 ID。
- `permission_group_id`：权限组 ID。
- `created_at`。

约束：

- 复合唯一：`iam_role_id` 和 `permission_group_id`。
- 角色和权限组必须属于同一应用。

### 5.8 `iam_role_permission_points`

字段建议：

- `iam_role_id`：角色 ID。
- `permission_point_id`：权限点 ID。
- `created_at`。

约束：

- 复合唯一：`iam_role_id` 和 `permission_point_id`。
- 角色和权限点必须属于同一应用。

### 5.9 `audit_logs`

字段建议：

- `id`：内部主键。
- `actor_type`：`platform_token`、`system`、`admin_user`。
- `actor_id`：操作者标识。
- `source`：来源，例如 `platform_api` 或 `admin_web`。
- `application_id`：关联应用，可为空。
- `resource_type`：资源类型。
- `resource_id`：资源 ID。
- `action`：操作类型。
- `before`：变更前 JSON。
- `after`：变更后 JSON。
- `result`：`success` 或 `failed`。
- `ip`：请求 IP，可为空。
- `user_agent`：请求 User-Agent，可为空。
- `request_id`：请求 ID。
- `created_at`。

审计日志不记录明文 secret、token、cookie 或密码。

## 6. 权限计算

### 6.1 输入

权限计算服务输入：

```json
{
  "app_key": "finance",
  "user_id": "ou_xxx"
}
```

前置检查：

1. 应用存在且状态为 `active`。
2. 飞书用户存在、未删除且 `is_active=true`。
3. 用户所属部门关系来自 `feishu_user_departments`，只使用未删除关系。

### 6.2 命中角色

用户命中角色的方式：

1. 角色直接绑定该用户。
2. 角色绑定该用户所属部门。

`v0.3.0` 的部门命中规则使用直接部门关系，不向上递归父部门。父部门继承会显著影响授权范围，后续如需支持，必须单独设计并在管理端明确展示。

被排除的角色：

- 角色状态不是 `active`。
- 角色所属应用不是当前应用。
- 角色主体绑定已标记 `is_orphaned=true`。

### 6.3 展开权限

权限结果由两部分合并：

1. 命中角色直接绑定的权限点。
2. 命中角色绑定的权限组，以及这些权限组包含的权限点。

过滤规则：

- 禁用权限组不进入 `permission_groups`。
- 禁用权限点不进入 `permission_points`。
- 禁用权限组包含的权限点不通过该组授予。
- 同时通过多个角色命中同一权限组或权限点时去重。
- 不计算 deny、条件表达式或资源范围。

### 6.4 响应

示例响应：

```json
{
  "app_key": "finance",
  "user_id": "ou_xxx",
  "permission_groups": [
    {
      "key": "finance.invoice_manager",
      "name": "发票管理员"
    }
  ],
  "permission_points": [
    {
      "key": "finance.invoice.read",
      "name": "查看发票"
    },
    {
      "key": "finance.invoice.approve",
      "name": "审批发票"
    }
  ],
  "matched_roles": [
    {
      "key": "invoice_manager",
      "name": "发票管理员"
    }
  ],
  "computed_at": "2026-05-16T00:00:00.000Z"
}
```

权限计算接口可以供管理端预览使用。后续 `v0.4.0` 实现 SSO 后，第三方应用使用 OAuth token 调用正式的用户权限接口。

## 7. 平台 API

平台 API 沿用现有 `PLATFORM_ADMIN_TOKEN` 保护。

### 7.1 应用接口

- `POST /api/v1/platform/applications`
- `GET /api/v1/platform/applications`
- `GET /api/v1/platform/applications/{app_key}`
- `PATCH /api/v1/platform/applications/{app_key}`
- `POST /api/v1/platform/applications/{app_key}/disable`
- `POST /api/v1/platform/applications/{app_key}/enable`

### 7.2 权限组接口

- `POST /api/v1/platform/applications/{app_key}/permission-groups`
- `GET /api/v1/platform/applications/{app_key}/permission-groups`
- `PATCH /api/v1/platform/applications/{app_key}/permission-groups/{group_id}`
- `POST /api/v1/platform/applications/{app_key}/permission-groups/{group_id}/disable`
- `POST /api/v1/platform/applications/{app_key}/permission-groups/{group_id}/enable`
- `PUT /api/v1/platform/applications/{app_key}/permission-groups/{group_id}/points`

`PUT .../points` 使用全量替换语义，便于管理端保存勾选结果。请求中的权限点必须全部属于当前应用。

### 7.3 权限点接口

- `POST /api/v1/platform/applications/{app_key}/permission-points`
- `GET /api/v1/platform/applications/{app_key}/permission-points`
- `PATCH /api/v1/platform/applications/{app_key}/permission-points/{point_id}`
- `POST /api/v1/platform/applications/{app_key}/permission-points/{point_id}/disable`
- `POST /api/v1/platform/applications/{app_key}/permission-points/{point_id}/enable`

### 7.4 IAM 角色接口

- `POST /api/v1/platform/applications/{app_key}/iam-roles`
- `GET /api/v1/platform/applications/{app_key}/iam-roles`
- `PATCH /api/v1/platform/applications/{app_key}/iam-roles/{role_id}`
- `POST /api/v1/platform/applications/{app_key}/iam-roles/{role_id}/disable`
- `POST /api/v1/platform/applications/{app_key}/iam-roles/{role_id}/enable`
- `PUT /api/v1/platform/applications/{app_key}/iam-roles/{role_id}/subjects`
- `PUT /api/v1/platform/applications/{app_key}/iam-roles/{role_id}/permission-groups`
- `PUT /api/v1/platform/applications/{app_key}/iam-roles/{role_id}/permission-points`

主体绑定请求示例：

```json
{
  "subjects": [
    {
      "type": "feishu_user",
      "id": "ou_xxx"
    },
    {
      "type": "feishu_department",
      "id": "od_xxx"
    }
  ]
}
```

### 7.5 权限计算接口

- `GET /api/v1/platform/applications/{app_key}/users/{user_id}/permissions`

该接口用于管理端预览和自动化验收。后续正式应用侧接口仍按主设计文档规划为：

- `GET /api/v1/apps/{app_key}/me/permissions`

## 8. 管理端设计

管理端在现有页面基础上增加“应用与权限”区域，先做最小可用闭环。

页面结构：

1. 应用列表：展示应用名称、`app_key`、状态、负责人和更新时间。
2. 应用详情：展示权限组、权限点、IAM 角色三个页签。
3. 权限组页签：维护权限组基础信息，并勾选该组包含的权限点。
4. 权限点页签：维护权限点 key、名称、说明和状态。
5. IAM 角色页签：维护角色基础信息、主体绑定、权限组绑定和直接权限点绑定。
6. 权限预览：输入飞书 `user_id`，查看该用户在当前应用下的计算结果。

体验要求：

- 表单错误必须具体说明原因，例如“权限点 key 必须以 finance. 开头”。
- 禁用操作需要二次确认。
- 权限点、权限组和角色列表支持按 key 或名称搜索。
- 选择飞书用户或部门时，`v0.3.0` 可以先使用输入框输入 `user_id` 或 `department_id`，不要求实现复杂通讯录选择器。
- 不展示手机号、邮箱等敏感字段，除非后续管理员体系明确授权。

## 9. 错误处理

错误响应沿用稳定结构：

```json
{
  "error": {
    "code": "PERMISSION_POINT_KEY_INVALID",
    "message": "权限点 key 必须以 finance. 开头",
    "request_id": "req_..."
  }
}
```

核心错误码：

- `APPLICATION_NOT_FOUND`：应用不存在。
- `APPLICATION_DISABLED`：应用已禁用。
- `APPLICATION_KEY_INVALID`：应用 key 不符合规则。
- `APPLICATION_KEY_CONFLICT`：应用 key 已存在。
- `PERMISSION_GROUP_NOT_FOUND`：权限组不存在。
- `PERMISSION_GROUP_KEY_INVALID`：权限组 key 不符合规则。
- `PERMISSION_POINT_NOT_FOUND`：权限点不存在。
- `PERMISSION_POINT_KEY_INVALID`：权限点 key 不符合规则。
- `IAM_ROLE_NOT_FOUND`：IAM 角色不存在。
- `IAM_ROLE_KEY_INVALID`：角色 key 不符合规则。
- `IAM_SUBJECT_NOT_FOUND`：授权主体不存在。
- `CROSS_APPLICATION_BINDING_FORBIDDEN`：跨应用绑定被拒绝。
- `FEISHU_USER_NOT_ACTIVE`：飞书用户不可用。

## 10. 审计要求

以下写操作必须写审计日志：

- 创建、更新、启用、禁用应用。
- 创建、更新、启用、禁用权限组。
- 创建、更新、启用、禁用权限点。
- 修改权限组与权限点关系。
- 创建、更新、启用、禁用 IAM 角色。
- 修改 IAM 角色主体绑定。
- 修改 IAM 角色权限组绑定。
- 修改 IAM 角色权限点绑定。

审计日志必须包含：

- 操作者。
- 来源。
- 应用。
- 资源类型和资源 ID。
- 操作类型。
- before/after diff。
- 结果。
- request id。
- 时间。

审计失败不能静默吞掉。如果审计日志写入失败，本次写操作应失败并返回稳定错误，避免出现不可追溯的权限变更。

## 11. 测试策略

后端测试覆盖：

- 应用 key 校验、唯一约束和禁用状态。
- 权限组 key 前缀校验。
- 权限点 key 前缀校验。
- 权限组只能绑定同应用权限点。
- IAM 角色只能绑定同应用权限组和权限点。
- IAM 角色主体只接受飞书用户和飞书部门。
- 不存在或已删除的飞书主体不会参与权限计算。
- 禁用应用、角色、权限组、权限点不会参与权限计算。
- 用户直接授权命中权限。
- 用户通过部门授权命中权限。
- 用户命中多个角色时权限组和权限点去重。
- 写操作生成审计日志。
- 审计日志失败时写操作失败。

管理端测试覆盖：

- 应用列表和详情渲染。
- 创建应用表单校验。
- 权限点 key 错误提示。
- 权限组绑定权限点。
- 角色绑定主体、权限组和权限点。
- 权限预览结果展示。
- API 错误安全展示。

基础验收命令：

```bash
pnpm check
```

手动验收流程：

1. 启动本地 Docker Compose 环境。
2. 确认已有飞书用户和部门镜像数据。
3. 创建 `finance` 应用。
4. 创建 `finance.invoice_manager` 权限组。
5. 创建 `finance.invoice.read` 和 `finance.invoice.approve` 权限点。
6. 将两个权限点加入 `finance.invoice_manager` 权限组。
7. 创建 `invoice_manager` IAM 角色。
8. 将角色绑定到一个飞书用户或该用户所在部门。
9. 将角色绑定到 `finance.invoice_manager` 权限组。
10. 调用权限计算接口，确认返回权限组和两个权限点。
11. 禁用其中一个权限点，再次计算确认该权限点不返回。
12. 查看审计日志，确认上述写操作均可追溯。

## 12. 文档更新

本版本需要更新：

- `README.md`：说明 `v0.3.0` 版本目标和当前状态。
- `docs/permission-model.md`：新增权限模型、人类使用说明、Agent 使用说明和 API 示例。
- `docs/codex-sessions/`：归档设计、实施和验收会话。
- 后续 OpenAPI 文档：在实施阶段补充平台 API schema。

文档必须明确：

- `v0.3.0` 只做 IAM 内部权限底座，不做 SSO。
- 权限点和权限组必须按应用隔离。
- 飞书角色和飞书用户组不进入本版本。
- 第三方应用仍然不能直接对接飞书。

## 13. 后续版本关系

`v0.3.0` 完成后，`v0.4.0` 可以基于权限底座实现 SSO Provider：

- `/oauth/authorize`
- `/oauth/token`
- `/oauth/userinfo`
- `/api/v1/apps/{app_key}/me/permissions`
- 应用环境、回调地址和 client secret 管理
- 统一登录错误页

`v0.3.0` 的权限计算服务应设计为可被 `v0.4.0` 直接复用，避免在 SSO 阶段重写权限模型。
