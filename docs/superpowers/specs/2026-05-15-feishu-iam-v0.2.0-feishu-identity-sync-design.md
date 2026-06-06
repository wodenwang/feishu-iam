# Feishu IAM v0.2.0 飞书身份镜像同步设计

日期：2026-05-15
状态：已确认，可进入实施计划阶段

## 1. 版本目标

`v0.2.0` 是飞书组织与用户镜像闭环版本。目标不是先做 SSO，也不是先做权限管理，而是先把后续 IAM 能力依赖的飞书身份镜像层做扎实。

本版本完成后，Feishu IAM 应该能够配置统一的飞书企业自建应用，使用真实飞书只读 OpenAPI 同步部门、用户和用户部门关系到 PostgreSQL，并留下可追溯的同步记录。管理端和平台 API 能展示同步状态、触发手动同步、查看同步历史和失败原因。

## 2. 范围

### 2.1 纳入范围

- 真实飞书 API 对接：获取 `tenant_access_token`，使用应用身份调用通讯录只读 API。
- 飞书部门镜像：同步部门树和部门基础字段。
- 飞书用户镜像：同步用户基础字段、状态字段和原始响应。
- 用户部门关系镜像：同步用户所属部门关系。
- 同步服务：手动全量同步、分页拉取、幂等 upsert、失效标记、同步 run log。
- 飞书客户端边界：建立 `FeishuClient` 抽象、真实客户端和 mock 客户端。
- 平台 API：提供触发同步、查询同步历史、查询同步详情、查询飞书同步状态的最小接口。
- 管理端：增加飞书同步状态页，展示配置状态、最近同步、手动触发、同步历史和错误摘要。
- 文档：补充飞书只读权限清单、环境变量说明、同步字段映射、开发测试说明和真实飞书手动验证说明。

### 2.2 排除范围

- 飞书角色同步。
- 飞书用户组同步。
- IAM 内部角色管理。
- 权限组、权限点和权限绑定。
- 飞书 OAuth/SSO 登录流程。
- 第三方应用管理。
- 定时同步、事件订阅和增量同步。
- 管理端编辑飞书配置密钥。
- 完整审计日志体系。本版本只做同步 run log。

## 3. 安全红线：只读飞书通讯录

Feishu IAM 在 `v0.2.0` 获取飞书通讯录数据时只能使用只读接口。系统设计需要形成两层防护：

1. 飞书应用权限侧只授予通讯录和字段读取权限，不授予任何通讯录创建、更新、删除权限。
2. Feishu IAM 代码侧只封装和调用读取接口，不提供任何飞书通讯录写接口调用路径。

硬性要求：

- `FeishuClient` 只能暴露读取方法，例如获取 token、查询子部门、查询部门直属用户。
- 代码库不得封装飞书通讯录创建、修改、删除用户或部门的接口。
- 自动化测试不得依赖真实飞书凭证，默认使用 mock 客户端。
- 静态检查需要确认代码中没有通讯录写接口路径，例如用户、部门、用户组、角色的 create、patch、update、delete、batch_add、batch_remove 等调用路径。
- 文档明确禁止给 Feishu IAM 飞书应用授予通讯录写权限。
- 即使飞书后台误授予写权限，Feishu IAM 代码也不能具备写飞书通讯录的能力。

## 4. 数据模型

### 4.1 `feishu_departments`

保存飞书部门镜像。

关键字段：

- `department_id`：主键，使用飞书自定义部门 ID。
- `open_department_id`：飞书系统生成部门 ID，非空时唯一。
- `parent_department_id`：父部门 ID，根部门使用 `0`。
- `name`：部门名称。
- `i18n_name`：国际化名称，`jsonb`。
- `leader_user_id`：部门主管用户 ID。
- `order`：同级部门排序。
- `status`：部门状态，`jsonb`。
- `raw_payload`：飞书原始响应，`jsonb`。
- `last_synced_at`：最近同步时间。
- `is_deleted`：本地失效标记。
- `created_at`、`updated_at`：本地时间戳。

### 4.2 `feishu_users`

保存飞书用户镜像。用户业务主键优先使用飞书 `user_id`。

关键字段：

- `user_id`：主键。
- `open_id`：应用内用户 ID，非空时唯一。
- `union_id`：开放平台用户 ID，非空时唯一。
- `name`、`en_name`：姓名。
- `email`：邮箱。
- `mobile`：手机号。
- `mobile_visible`：手机号是否可见。
- `avatar`：头像信息，`jsonb`。
- `employee_no`：工号。
- `employee_type`：员工类型。
- `job_title`：职务。
- `leader_user_id`：直接主管用户 ID。
- `status`：飞书用户状态，`jsonb`。
- `raw_payload`：飞书原始响应，`jsonb`。
- `last_synced_at`：最近同步时间。
- `is_active`：根据飞书状态计算的本地可用状态。
- `is_deleted`：本地失效标记。
- `created_at`、`updated_at`：本地时间戳。

`is_active` 的计算规则为：未冻结、未离职、已激活、未主动退出、非未加入时为 true。该字段在 `v0.2.0` 不参与登录判断，只为后续 SSO 和权限计算准备。

### 4.3 `feishu_user_departments`

保存用户和部门的多对多关系。

关键字段：

- `user_id`：飞书用户 ID。
- `department_id`：飞书部门 ID。
- `is_primary`：是否主部门。
- `user_order`：用户在部门内排序。
- `department_order`：用户所属多个部门之间的排序。
- `last_synced_at`：最近同步时间。
- `is_deleted`：本地失效标记。
- `created_at`、`updated_at`：本地时间戳。

唯一键为 `(user_id, department_id)`。

### 4.4 `feishu_sync_runs`

保存每次同步记录。

关键字段：

- `id`：同步 run ID。
- `triggered_by`：触发者标识。
- `trigger_source`：触发来源，例如 `platform_api`、`admin_web`、`test`。
- `status`：`running`、`success`、`failed`。
- `started_at`、`finished_at`：开始和结束时间。
- `department_created_count`、`department_updated_count`、`department_deleted_count`。
- `user_created_count`、`user_updated_count`、`user_deleted_count`。
- `relation_created_count`、`relation_updated_count`、`relation_deleted_count`。
- `error_code`、`error_message`、`error_detail`：失败摘要，不记录密钥、token 或 cookie。
- `request_id`：请求 ID 或 run 关联 ID。
- `created_at`、`updated_at`：本地时间戳。

## 5. 同步流程

同步采用单 run 全量快照模式。第一版不支持并发同步。如果已有 `running` run，新的触发请求返回 `FEISHU_SYNC_ALREADY_RUNNING`。

流程：

1. 读取环境变量：`FEISHU_APP_ID`、`FEISHU_APP_SECRET`、`PLATFORM_ADMIN_TOKEN`。
2. `FeishuClient` 调用飞书自建应用 token 接口获取 `tenant_access_token`，并在本进程内缓存 token。
3. 从根部门 `0` 开始，分页读取子部门并遍历部门树。
4. 对根部门 `0` 和每个可见部门分页读取直属用户。
5. 部门、用户和用户部门关系按飞书 ID 幂等 upsert。
6. 用户部门关系只写入本次已同步到本地的真实部门，`0` 和其他未知部门不写关系。
7. 记录本次 run 见到的部门 ID、用户 ID 和关系键。
8. 同步成功后，将历史存在但本次未见到的数据标记为 `is_deleted=true`。
9. 更新 run 统计、结束时间和状态。

ID 类型约定：

- 部门同步使用 `department_id_type=department_id`。
- 用户同步使用 `user_id_type=user_id`。
- 用户所属部门关系使用 `department_id`。
- `open_department_id`、`open_id`、`union_id` 仍然保留，便于排查和后续扩展。

失败处理：

- 配置缺失时，状态接口返回 `not_configured`，触发同步返回 `FEISHU_CONFIG_MISSING`。
- 飞书返回非 0 `code` 时，封装为稳定错误，保存飞书 `code`、`msg`、接口路径和 request id 摘要。
- 权限不足时，返回 `FEISHU_PERMISSION_DENIED`，文档提示检查通讯录权限范围和字段权限。
- 分页中途失败时，run 标记为 `failed`。已经 upsert 的数据不回滚，但失败 run 不执行失效标记，避免半截同步误伤历史数据。
- 任何错误记录都不得包含 `app_secret`、`tenant_access_token`、平台 token 或其他敏感凭证。

## 6. 飞书客户端边界

`FeishuClient` 是同步服务依赖的唯一飞书访问抽象。

建议接口：

- `getTenantAccessToken()`：获取应用身份 token。
- `listDepartmentChildren(params)`：分页读取子部门。
- `listDepartmentUsers(params)`：分页读取部门直属用户。

真实客户端职责：

- 管理 token 获取和刷新。
- 封装飞书 HTTP 请求。
- 解析飞书响应和错误码。
- 处理分页参数和飞书 request id。

同步服务职责：

- 编排全量同步。
- 控制并发 run。
- 计算 upsert、恢复、失效数量。
- 写入 `feishu_sync_runs`。

mock 客户端职责：

- 模拟分页。
- 模拟字段缺失。
- 模拟用户状态变化。
- 模拟删除后恢复。
- 模拟飞书接口失败和权限失败。

## 7. 平台 API

平台 API 使用 `PLATFORM_ADMIN_TOKEN` 做最小保护，请求需要携带：

```text
Authorization: Bearer <token>
```

接口：

- `POST /api/v1/platform/feishu/sync-runs`：触发一次手动全量同步。
- `GET /api/v1/platform/feishu/sync-runs`：分页查询同步历史。
- `GET /api/v1/platform/feishu/sync-runs/:id`：查询单次同步详情。
- `GET /api/v1/platform/feishu/status`：查询飞书配置状态、连接状态、最近一次同步、当前是否运行中和镜像数据统计。

错误响应使用项目统一结构：

```json
{
  "error": {
    "code": "FEISHU_CONFIG_MISSING",
    "message": "飞书应用配置缺失",
    "request_id": "req_..."
  }
}
```

## 8. 管理端页面

管理端在 `v0.2.0` 增加飞书同步状态页。当前不做完整导航系统，可将 `v0.1.0` 的状态骨架升级为“系统状态 + 飞书同步”工作台。

页面展示：

- 飞书配置状态：未配置、已配置但未验证、连接成功、连接失败。
- 最近一次同步：状态、开始时间、结束时间、耗时、部门数量、用户数量、关系数量、错误摘要。
- 手动同步按钮：触发后刷新状态和历史。
- 同步历史表：展示状态、触发来源、开始时间、结束时间、统计和失败摘要。
- 错误详情：展示可排查信息和 request id。

页面限制：

- 不展示明文 `app_secret`。
- 不展示 `tenant_access_token` 或平台 token。
- 不展示手机号等敏感用户字段。
- 不提供编辑飞书配置的入口。
- 不提供任何修改飞书通讯录的入口。

## 9. 环境变量

核心变量：

- `DATABASE_URL`：PostgreSQL 连接字符串。
- `FEISHU_APP_ID`：飞书企业自建应用 ID。
- `FEISHU_APP_SECRET`：飞书企业自建应用密钥。
- `PLATFORM_ADMIN_TOKEN`：平台 API 临时管理 token。

安全要求：

- 文档和归档不得记录真实 `FEISHU_APP_SECRET` 或 `PLATFORM_ADMIN_TOKEN`。
- Docker Compose 示例只能使用占位值。
- 真实凭证只允许通过本地 `.env`、部署环境变量或安全运行时配置注入。

## 10. 飞书权限清单

本版本只申请只读权限。建议权限包括：

- 获取通讯录基本信息。
- 获取通讯录部门组织架构信息。
- 以应用身份读取通讯录。
- 获取部门基础信息。
- 获取用户基本信息。
- 获取用户组织架构信息。
- 获取用户 user ID。
- 获取用户受雇信息。
- 获取用户邮箱信息。
- 获取用户手机号。
- 查看成员工号。

如果手机号、邮箱、工号等敏感字段没有授权，系统仍应能同步基础身份数据，但状态页和 run log 需要提示字段不完整。

禁止申请或使用：

- 创建、更新、删除用户的权限。
- 创建、更新、删除部门的权限。
- 用户组写权限。
- 飞书角色管理权限。
- 任何与通讯录写入相关的权限。

## 11. 测试策略

自动化测试默认使用 mock 飞书客户端，不依赖真实飞书凭证。

需要覆盖：

- 成功全量同步部门、用户和用户部门关系。
- 分页同步。
- 重复同步幂等。
- 用户状态变化后更新 `is_active`。
- 历史数据本次未见时同步成功后标记失效。
- 失败 run 不执行失效标记。
- 配置缺失。
- 飞书权限不足。
- 飞书接口返回非 0 code。
- 并发同步拒绝。
- 平台 API token 校验。
- 管理端状态和历史渲染。
- 静态检查确认没有飞书通讯录写接口路径。

真实飞书手动验证：

- 配置真实 `FEISHU_APP_ID` 和 `FEISHU_APP_SECRET`。
- 确认应用只授予只读通讯录权限。
- 手动触发一次同步。
- 确认数据库存在部门、用户和用户部门关系。
- 确认管理端展示最近同步和统计。

## 12. 验收标准

- `pnpm check` 通过。
- Prisma schema 校验通过。
- Docker Compose 可以启动 API 和 PostgreSQL，并完成数据库迁移。
- mock 自动化测试可以完成一次全量同步，数据库中出现部门、用户和用户部门关系。
- 同步失败时有清晰 run log 和管理端错误反馈。
- 管理端可以看到配置状态、最近同步和同步历史。
- 不配置真实飞书凭证也能完成本地自动化验证。
- 配置真实飞书凭证后，可以手动完成真实只读同步。
- 静态检查确认不存在飞书通讯录写接口调用路径。
- 代码、文档和归档均不记录明文密钥、token、cookie 或密码。

## 13. 后续版本关系

`v0.2.0` 完成后，`v0.3.0` 可以在稳定身份镜像之上继续设计第三方应用、IAM 内部角色、权限组、权限点和权限映射。IAM 内部角色可以关联本地镜像的飞书用户和部门，但不依赖飞书角色或飞书用户组。
