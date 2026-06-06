# Feishu IAM v0.13.0 飞书同步运维控制台工程评审

日期：2026-05-27
状态：工程方案已锁定，可进入实施计划

> 本评审承接 `docs/superpowers/specs/2026-05-27-feishu-iam-v0.13.0-feishu-sync-console.md`、`design/v0.13.0-feishu-sync-console-prototype.md` 和 GitLab issue `#13`。当前会话无法使用 gstack Plan mode 的交互式 `AskUserQuestion`，因此本文件以普通 Codex 工程审查方式固化 `plan-eng-review` 结论，不跳过权限、审计、安全错误和生产验收边界。

## 1. 结论

`v0.13.0` 可以进入实施计划，但必须按以下工程边界执行：

- 不新增 DDL。复用 `FeishuDepartment`、`FeishuUser`、`FeishuUserDepartment`、`FeishuSyncRun` 和 `AuditLog`。
- 飞书同步运维控制台拆成“本地镜像查询”和“同步触发/诊断”两类后端能力，不能继续把候选人搜索接口伪装成本地组织查询。
- 用户级和部门级轻量同步必须真实调用飞书通讯录只读接口或当前同步服务可验证的局部刷新路径，不得伪造成功。
- 轻量同步不得执行全局 stale cleanup，不能因为局部刷新缺失某个对象就把全局部门、用户或关系标记删除。
- 全量同步必须从普通日常入口移入高级操作，并增加后端二次确认；只靠前端弹窗不算安全边界。
- 写操作和触发类操作必须写入 `AuditLog`，包括成功、失败、权限拒绝和运行中互斥拒绝。
- 生产验收默认不触发真实全量同步，只验证预确认、权限、查询、详情、历史、轻量同步和审计链路。

## 2. 当前代码事实

### 2.1 数据模型

现有 Prisma 模型已覆盖本版本核心数据：

- `FeishuDepartment`：部门镜像、父部门、状态、原始 payload、删除标记、最近同步时间。
- `FeishuUser`：用户镜像、`user_id`、`open_id`、`union_id`、邮箱、手机号、状态、原始 payload、启用和删除标记。
- `FeishuUserDepartment`：用户与部门关系、主部门、排序、删除标记。
- `FeishuSyncRun`：同步 run id、触发人、触发来源、状态、统计、错误码、错误摘要、错误详情和 request id。
- `AuditLog`：操作者、来源、资源、动作、before/after、结果、IP、User-Agent、request id。

因此本版本不需要用 migration 引入新的镜像表或运行记录表。轻量同步的目标对象和触发来源可通过 `FeishuSyncRun.triggerSource`、`FeishuSyncRun.errorDetail` 和 `AuditLog.resourceType/resourceId/after` 记录；前端详情以稳定字段展示，不直接暴露 `rawPayload`。

### 2.2 同步服务

`FeishuSyncService.runFullSync()` 已具备：

- 创建 `running` 同步记录。
- 基于唯一约束和 stale running 释放做单运行互斥。
- 遍历部门、用户和关系。
- 全量成功后执行全局 stale cleanup。
- 失败时记录稳定错误码、错误摘要、阶段和 request id。

但当前服务只支持全量同步。`upsertDepartment`、`upsertUser`、`upsertUserDepartments` 是局部刷新可以复用的核心能力，但目前为 private。实施时应重构出内部可复用方法，或者在同一服务内新增轻量同步方法，避免复制一套字段映射逻辑。

### 2.3 飞书客户端

当前 `FeishuClient` 已支持：

- `getTenantAccessToken()`
- `listDepartmentChildren()`
- `listDepartmentUsers()`
- OAuth 登录相关方法

当前没有用户详情或部门详情直读方法。实施用户级轻量同步时，必须先确认可用的飞书只读 OpenAPI；如果新增 `getUser` 或 `getDepartment`，接口实现和测试必须只返回同步所需字段，并复用现有 `FeishuClientError` 稳定错误模型。若官方接口或权限不满足，允许降级为“基于本地用户所属部门逐部门刷新并过滤目标用户”的真实刷新路径，但失败时必须返回“无法通过当前通讯录权限定位该用户”的稳定错误，不能标记同步成功。

### 2.4 管理端 API

当前 `AdminFeishuController` 已有：

- `GET /api/v1/admin/feishu/status`
- `GET /api/v1/admin/feishu/sync-runs`
- `GET /api/v1/admin/feishu/sync-runs/:id`
- `GET /api/v1/admin/feishu/field-diagnostics`
- `GET /api/v1/admin/feishu/users`
- `GET /api/v1/admin/feishu/departments`
- `POST /api/v1/admin/feishu/sync-runs`

其中 `/users` 和 `/departments` 当前是权限管理候选人搜索形态，字段过少且只允许 `platform_admin`。`v0.13.0` 需要把它们升级为本地镜像查询接口，或者新增清晰命名的镜像查询 service，避免继续只返回 `{userId,name}` / `{departmentId,name}`。

当前 `POST /sync-runs` 会直接触发全量同步，且没有审计写入和后端确认口令。本版本必须修改。

### 2.5 前端

当前 `SystemSettingsView` 仍是旧系统设置页形态：

- 侧栏设置项 + 内容区。
- 飞书同步页偏状态卡片和同步历史。
- “触发同步”仍是较显眼的操作。
- 没有四标签、部门树、用户详情工作区、字段诊断高级操作和窄屏钻取。

前端实现应按 Pencil 原型重构 `系统管理 / 飞书同步` 这一路由，不应在旧设置页上继续堆卡片。

## 3. API 契约锁定

### 3.1 只读查询

建议实施以下管理端契约，响应必须是已脱敏的稳定 DTO：

```text
GET /api/v1/admin/feishu/overview
GET /api/v1/admin/feishu/departments?parent_department_id=&keyword=&page=&page_size=
GET /api/v1/admin/feishu/departments/:department_id
GET /api/v1/admin/feishu/users?department_id=&keyword=&page=&page_size=
GET /api/v1/admin/feishu/users/:user_id
GET /api/v1/admin/feishu/sync-runs?status=&source=&page=&page_size=
GET /api/v1/admin/feishu/sync-runs/:run_id
GET /api/v1/admin/feishu/field-diagnostics
```

响应要求：

- 用户详情返回 `userId`、`openId`、`unionId`、姓名、邮箱脱敏、手机号脱敏、状态、所属部门、最近同步时间、是否可登录、阻塞原因。
- 部门详情返回 `departmentId`、`openDepartmentId`、父部门、直属子部门、直属用户摘要、状态、最近同步时间。
- 同步历史详情返回统计、阶段、稳定错误码、稳定错误摘要、request id、诊断建议和审计摘要。
- 不返回 `rawPayload`、token、secret、cookie、堆栈或飞书原始错误对象。

### 3.2 轻量同步

新增触发接口：

```text
POST /api/v1/admin/feishu/sync-users/:user_id
POST /api/v1/admin/feishu/sync-departments/:department_id
POST /api/v1/admin/feishu/diagnostics/refresh
```

工程要求：

- 每个触发接口都必须先检查运行锁，已有 `running` 时返回稳定错误 `FEISHU_SYNC_ALREADY_RUNNING`。
- 触发成功后创建 `FeishuSyncRun`，`triggerSource` 使用可读稳定值，例如 `admin_web_user_light`、`admin_web_department_light`、`admin_web_diagnostics`。
- 目标对象写入 `errorDetail.target` 或审计日志 `resourceType/resourceId/after`，供详情页展示。
- 成功和失败都要关闭 run 并写入统计。
- 局部刷新只更新目标用户、目标部门、目标部门直属子部门、目标部门直属用户和相关关系。
- 局部刷新只能按目标范围标记关系失效，不得全局清理所有未出现部门、用户或关系。

### 3.3 全量同步强确认

保留但收紧：

```text
POST /api/v1/admin/feishu/sync-runs/preflight
POST /api/v1/admin/feishu/sync-runs
```

建议流程：

1. `preflight` 返回当前是否有 running、最近一次 run、当前镜像统计、二次确认需要输入的 `requiredLatestRunId`。
2. 前端要求管理员输入当前 `requiredLatestRunId`，按钮默认禁用。
3. `POST /sync-runs` 必须携带 `confirmLatestRunId`。
4. 后端重新读取最近 run 并校验一致，不一致则拒绝并要求刷新确认。
5. 后端再次校验权限和运行锁，再触发全量同步。

这样不引入新表，也避免只靠前端弹窗造成误触发。

## 4. 权限矩阵

建议把当前 `canTriggerFeishuSync` 拆成更细的能力：

| 能力 | platform_admin | sync_admin | audit_viewer | 其他管理员 |
| --- | --- | --- | --- | --- |
| 查看同步总览 | 是 | 是 | 是 | 否 |
| 查看同步历史和详情 | 是 | 是 | 是 | 否 |
| 查看字段诊断 | 是 | 是 | 是 | 否 |
| 查询用户/部门镜像详情 | 是 | 是 | 否 | 否 |
| 刷新字段诊断 | 是 | 是 | 否 | 否 |
| 用户级轻量同步 | 是 | 是 | 否 | 否 |
| 部门级轻量同步 | 是 | 是 | 否 | 否 |
| 全量同步预确认和触发 | 是 | 否 | 否 | 否 |

关键决策：

- `sync_admin` 可以执行本版本承诺的用户级和部门级轻量同步。
- 全量同步比轻量同步风险更高，`v0.13.0` 收紧为仅 `platform_admin` 可触发。
- `audit_viewer` 可查看同步历史、字段诊断和审计链路，但默认不查看用户/部门详情中的 PII。
- 前端不得通过“隐藏按钮”替代后端权限校验；所有新接口必须由后端校验。

## 5. 审计和错误

所有触发类接口必须记录审计：

- `feishu_sync_run/full_sync_preflight`
- `feishu_sync_run/full_sync_start`
- `feishu_sync_run/user_light_sync`
- `feishu_sync_run/department_light_sync`
- `feishu_diagnostics/refresh`

审计内容：

- actor：管理员 ID。
- source：`admin_web`。
- resourceType：`feishu_sync_run`、`feishu_user`、`feishu_department` 或 `feishu_diagnostics`。
- resourceId：run id、user id、department id 或 `field_diagnostics`。
- action：稳定动作名。
- result：`success` 或 `failed`。
- requestId、IP、User-Agent。
- after：目标、run id、统计、稳定错误码；不得写入 secret、token、cookie 或飞书原始敏感 payload。

错误展示要求：

- 403：稳定说明当前管理员无权执行对应操作。
- 404：稳定说明用户、部门或同步记录不存在。
- 409：已有同步运行中，展示当前 run id。
- 400：确认 run id 缺失或不匹配，提示刷新预确认。
- 飞书 API 错误：只展示稳定错误码、阶段、request id 和中文排查建议。

## 6. 测试策略

### 6.1 后端

必须补充或改造测试：

- 本地用户查询、详情、邮箱和手机号脱敏、无权限。
- 本地部门查询、详情、直属子部门和直属用户、无权限。
- 同步历史分页、详情错误阶段和 request id。
- 权限矩阵：`platform_admin`、`sync_admin`、`audit_viewer`、无关管理员。
- 用户级轻量同步成功、目标不存在、飞书接口失败、已有运行中。
- 部门级轻量同步成功、局部关系失效、不触发全局 cleanup、已有运行中。
- 全量同步 `preflight`、缺少确认、确认 run id 不匹配、权限拒绝、成功触发。
- 触发成功和失败都写入审计。
- DTO 不返回 `rawPayload`、secret、token、cookie 或堆栈。

### 6.2 前端

必须补充或改造测试：

- 四标签渲染和 URL 状态。
- 紧凑同步总览不展示日常“全量同步”主按钮。
- 部门树、部门详情、用户详情、空/错/加载状态。
- 同步历史列表和详情。
- 字段诊断、轻量同步运行中状态和权限不足。
- 全量同步预确认输入、按钮禁用、确认不匹配错误。
- 窄屏单列钻取下无遮挡、无横向塞满桌面三栏。

### 6.3 验证

实现完成后至少运行：

```text
pnpm --filter @feishu-iam/api test -- feishu
pnpm --filter @feishu-iam/api test -- admin
pnpm --filter @feishu-iam/admin-web test -- src/features/settings
pnpm --filter @feishu-iam/admin-web typecheck
pnpm --filter @feishu-iam/admin-web build
pnpm check
```

如全量 `pnpm check` 因环境或时间不可行，必须说明原因，并提供后端和前端受影响范围的替代验证证据。

## 7. 发布和生产验收边界

生产验收默认覆盖：

- `/ready` 返回 ready。
- `/version` 返回 `0.13.0 / v0.13.0`。
- 管理后台可以打开 `系统管理 / 飞书同步`。
- 可以查询至少一个真实本地飞书用户和一个真实本地飞书部门。
- 可以打开用户详情、部门详情、最近同步详情和字段诊断。
- 可以执行用户级或部门级轻量同步，并能在审计和同步历史看到记录。
- 可以进入全量同步预确认，但默认不提交真实全量同步。

只有在用户部署时再次明确授权后，才触发生产真实全量同步。

## 8. 进入实施计划前必须修正的问题

以下问题已经在本工程评审中给出约束，实施计划必须逐条落地：

- 将 `sync_admin` 的全量同步权限拆出，收紧为只允许 `platform_admin` 执行全量同步。
- 将当前 `/users` 和 `/departments` 从候选搜索扩展成本地镜像查询 DTO，或新增明确的镜像查询服务，避免字段不足。
- 为触发类接口补审计封装，不能只返回同步结果。
- 为全量同步增加后端二次确认，不能只依赖前端弹窗。
- 为局部同步抽取可复用 upsert 逻辑，禁止复制字段映射和全局 cleanup。
- 明确用户级轻量同步的真实飞书读取路径；若直读接口不可用，采用局部部门刷新 fallback，并把不可定位作为失败结果展示。

结论：无剩余设计或工程阻塞；下一步进入 Superpowers `writing-plans`，生成可执行实施计划。
