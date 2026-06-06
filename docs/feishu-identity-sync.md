# 飞书身份镜像同步

本文说明 Feishu IAM `v0.2.0` 的飞书组织与用户同步能力。

## 同步范围

Feishu IAM 只同步飞书部门、用户和用户部门关系。系统不同步飞书角色，不同步飞书用户组，也不会写入飞书通讯录。

同步后的本地镜像表包括：

- `feishu_departments`：飞书部门镜像。
- `feishu_users`：飞书用户镜像，业务主键使用飞书 `user_id`，并保留 `open_id`、`union_id` 和 `raw_payload`。
- `feishu_user_departments`：飞书用户和部门关系。
- `feishu_sync_runs`：每次同步的运行记录、统计数量和错误摘要。

缺失、禁用或离职相关数据只在本地标记为失效，不会物理删除飞书通讯录数据。

## 只读安全边界

Feishu IAM 调用飞书通讯录时只使用只读接口：

- 获取自建应用 `tenant_access_token`。
- 查询子部门列表。
- 查询部门直属用户列表。

代码不封装创建、更新、删除飞书用户或部门的接口。飞书应用也只应授予只读权限，形成权限侧和代码侧双保险。

## 环境变量

```dotenv
DATABASE_URL=<postgresql_database_url>
PLATFORM_ADMIN_TOKEN=replace-with-local-admin-token
FEISHU_APP_ID=cli_replace_me
FEISHU_APP_SECRET=replace_me
```

不要把真实 `FEISHU_APP_SECRET`、平台 token、cookie 或密码提交到仓库。`VITE_PLATFORM_ADMIN_TOKEN` 只能作为 `v0.2.0` 内网临时管理桥接使用，因为 Vite 环境变量会被打入前端产物，不能作为生产密钥边界。

## 飞书应用权限

建议只申请以下只读权限：

- 获取通讯录基本信息：`contact:contact.base:readonly`。
- 获取通讯录部门组织架构信息：`contact:department.organize:readonly`。
- 以应用身份读取通讯录：`contact:contact:readonly_as_app`。
- 获取部门基础信息：`contact:department.base:readonly`，用于读取部门 `name`、`department_id`、`status`。
- 获取用户基本信息：`contact:user.base:readonly`，用于读取用户 `name`、头像等基础展示字段。
- 获取用户组织架构信息：`contact:user.department:readonly`，用于读取 `department_ids`、`orders`、主管等组织关系字段。
- 获取用户 user ID：`contact:user.employee_id:readonly`。
- 获取用户受雇信息：`contact:user.employee:readonly`，用于读取 `status`、`employee_type`、入职和在职相关字段。
- 获取用户邮箱信息：`contact:user.email:readonly`。
- 获取用户手机号：`contact:user.phone:readonly`。
- 查看成员工号：`contact:user.employee_number:read`。

如果当前阶段希望减少逐项字段授权成本，可以先申请 `contact:contact:readonly_as_app` 或 `contact:contact:access_as_app` 之一；这两个权限能覆盖多数通讯录基础字段，但仍建议保留最小只读权限原则，禁止申请通讯录写权限。

禁止申请或使用通讯录写权限，包括创建、更新、删除用户或部门。真实飞书应用也应限制通讯录可见范围，只暴露 IAM 需要镜像的组织数据。

## 字段映射

部门字段主要映射：

- `department_id` 或 `open_department_id` -> `feishu_departments.department_id`
- `open_department_id` -> `feishu_departments.open_department_id`
- `parent_department_id` -> `feishu_departments.parent_department_id`
- `name` -> `feishu_departments.name`
- `i18n_name`、`leader_user_id`、`order`、`status` 保留同名含义。
- 原始部门响应保存到 `raw_payload`。

说明：部分飞书租户或应用身份只返回 `open_department_id`，不会返回自定义 `department_id` 或部门名称。Feishu IAM 的本地部门主键优先使用 `department_id`，缺失时使用 `open_department_id`；部门名称缺失时使用该稳定部门 ID 占位。后续补齐字段权限或飞书返回更多字段后，同步会通过 upsert 自动刷新本地镜像。

用户字段主要映射：

- `user_id` -> `feishu_users.user_id`
- `open_id` -> `feishu_users.open_id`
- `union_id` -> `feishu_users.union_id`
- `name`、`en_name`、`email`、`mobile`、`employee_no`、`employee_type`、`job_title` 保留同名含义。
- `status` 用于计算本地 `is_active`。
- 原始用户响应保存到 `raw_payload`。

如果飞书只返回 `user_id`、`open_id`、`union_id` 等 ID 字段，`name` 会先使用 `user_id` 占位，`status` 缺失时本地 `is_active=false`，避免未来登录能力误放行状态未知的用户。

用户部门关系根据用户响应中的 `department_ids` 和 `orders` 写入 `feishu_user_departments`，包含 `is_primary`、`user_order` 和 `department_order`。

同步服务会读取飞书根部门 `0` 的直属用户，避免根部门直属用户被误标记为删除。但 `feishu_departments` 只保存飞书部门接口实际返回的部门，`0` 和其他未同步到本地的未知部门不会写入用户部门关系，避免产生无效外键。

## 平台 API

所有平台 API 请求需要携带：

```text
Authorization: Bearer <PLATFORM_ADMIN_TOKEN>
```

接口：

- `POST /api/v1/platform/feishu/sync-runs`：触发一次手动同步。
- `GET /api/v1/platform/feishu/sync-runs`：查询最近 50 条同步历史。
- `GET /api/v1/platform/feishu/sync-runs/:id`：查询单次同步详情。
- `GET /api/v1/platform/feishu/status`：查询配置状态、运行状态、最近同步和镜像数据统计。
- `GET /api/v1/platform/feishu/field-diagnostics`：诊断飞书字段完整性，不写入数据库。

`PLATFORM_ADMIN_TOKEN` 是 `v0.2.0` 的临时内部管理保护。完整管理员登录和权限体系放到后续版本。

## 字段完整性诊断

`v0.2.1` 增加字段完整性诊断接口，用于在执行完整同步前快速判断飞书只读权限、通讯录可见范围和字段返回情况。

```text
GET /api/v1/platform/feishu/field-diagnostics
Authorization: Bearer <PLATFORM_ADMIN_TOKEN>
```

诊断接口只调用现有只读飞书接口，不写入数据库，不创建同步 run，也不会返回真实手机号、邮箱或 token。

核心结论包括：

- `passed`：关键字段满足后续 SSO 准备要求。
- `warning`：没有阻断项，但姓名、部门名称、邮箱或手机号等展示字段不完整。
- `failed`：存在阻断项，例如用户 `status` 字段缺失、抽样不到用户或飞书权限不足。
- `not_configured`：缺少飞书应用配置。

字段分级：

- 用户 `status` 字段缺失是阻断项。Feishu IAM 依赖它计算 `is_active`，缺失时必须保守判断为不可登录。
- 用户 `department_ids` 字段缺失是阻断项。Feishu IAM 依赖它建立用户和部门关系，缺失时无法可靠支撑后续按部门授权。
- 用户 `name` 和部门 `name` 缺失是强警告。系统仍可同步，但管理端会使用 ID 占位，不建议进入权限分配体验开发。
- `email`、`mobile`、`employee_no`、`job_title` 等展示字段缺失是普通警告，不阻断 SSO 核心登录。

`v0.2.1` 的真实发布门槛是：补齐字段权限后重新执行真实同步，`GET /api/v1/platform/feishu/status` 返回的 `counts.activeUsers` 必须大于 0。

## 本地验证

自动化测试默认使用 mock 飞书客户端，不依赖真实飞书凭证。

运行自动化检查：

```bash
pnpm check
```

校验 Docker Compose 配置：

```bash
docker compose -f deploy/docker-compose.yml config --quiet
```

如果 Docker Desktop 可用，可以启动本地服务：

```bash
pnpm compose:up
curl -s http://localhost:3000/health
curl -s http://localhost:3000/ready
pnpm compose:down
```

## 真实飞书手动验证

1. 在本地环境配置真实 `FEISHU_APP_ID` 和 `FEISHU_APP_SECRET`。
2. 确认飞书应用只授予只读通讯录权限。
3. 启动 API 和数据库。
4. 调用 `POST /api/v1/platform/feishu/sync-runs`。
5. 查询 `GET /api/v1/platform/feishu/status`。
6. 确认数据库中存在 `feishu_departments`、`feishu_users`、`feishu_user_departments` 数据。

`v0.2.1` 真实字段验收步骤：

1. 调用字段诊断接口。
2. 如果返回 `failed`，先按 `nextActions` 检查飞书应用只读权限、字段权限和通讯录可见范围。
3. 确认用户 `status` 字段已返回，因为 Feishu IAM 依赖它计算 `is_active`。
4. 确认用户 `department_ids` 字段已返回，因为 Feishu IAM 依赖它建立用户部门关系。
5. 触发一次真实同步。
6. 查询同步状态，确认 `counts.activeUsers > 0`。
7. 如果用户姓名或部门名称仍缺失，可以继续同步，但不建议进入权限分配体验开发。

示例：

```bash
curl -X POST http://localhost:3000/api/v1/platform/feishu/sync-runs \
  -H "Authorization: Bearer ${PLATFORM_ADMIN_TOKEN}"

curl http://localhost:3000/api/v1/platform/feishu/status \
  -H "Authorization: Bearer ${PLATFORM_ADMIN_TOKEN}"

curl http://localhost:3000/api/v1/platform/feishu/field-diagnostics \
  -H "Authorization: Bearer ${PLATFORM_ADMIN_TOKEN}"
```

## 常见错误

- `FEISHU_CONFIG_MISSING`：缺少 `FEISHU_APP_ID` 或 `FEISHU_APP_SECRET`。
- `FEISHU_PERMISSION_DENIED`：飞书应用缺少通讯录只读权限或通讯录可见范围不足。
- `FEISHU_SYNC_ALREADY_RUNNING`：已有同步 run 正在执行。
- `FEISHU_API_ERROR`：飞书接口返回非成功响应。
- `FEISHU_NETWORK_ERROR`：无法访问飞书接口或飞书接口网络异常。
