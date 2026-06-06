# Feishu IAM 权限模型

本文说明 `v0.3.0` 的应用与权限模型，并补充 `v0.5.0` 管理端权限化后的使用边界，供管理员、开发者和 Agent 做接入、验收和后续迭代参考。

## 版本边界

`v0.3.0` 只实现 IAM 内部权限底座：

- 内部应用。
- 权限组。
- 权限点。
- IAM 角色。
- IAM 角色与飞书用户、飞书部门的主体绑定。
- IAM 角色与权限组、权限点的授权绑定。
- 按 `app_key + user_id` 计算用户权限。
- 平台管理 API、管理端只读查看和权限预览。
- 权限模型写操作审计。

本版本不实现 SSO/OAuth 登录闭环，不实现完整 OIDC，不同步飞书角色或飞书用户组，不实现 deny 规则、资源级权限、数据范围权限或 ABAC 表达式。第三方应用仍然只应对接 Feishu IAM，不直接对接飞书。

`v0.5.0` 起，Web 管理端通过 `/api/v1/admin/*` 和管理员 session 访问应用、权限组、权限点、IAM 角色、接入配置、审计日志和安全事件；`/api/v1/platform/*` 继续保留给自动化和运维脚本。

首次绑定平台管理员或平台管理员全部不可用时，可以使用环境变量破窗超级管理员调用管理员授权接口。破窗账号只用于管理员授权恢复，不参与应用、权限、SSO client 或飞书同步的日常管理。密码哈希格式为 `sha256:<password_sha256_hex>`，真实密码和哈希不得写入仓库。

## 核心对象

### 应用

应用表示一个接入 Feishu IAM 的内部系统，例如 `finance`、`oa`、`crm`。应用拥有全局唯一 `app_key`，权限组、权限点和 IAM 角色都必须归属于某一个应用。

应用状态：

- `active`：参与维护和权限计算。
- `disabled`：不可参与权限计算。

### 权限点

权限点表示第三方应用可识别的最小权限，例如菜单、按钮或接口能力。

示例：

- `finance.invoice.read`
- `finance.invoice.approve`
- `finance.report.export`

权限点只描述能力，不判断业务资源范围。例如“是否能审批某张发票”仍由第三方应用结合业务数据判断。

### 权限组

权限组是一组权限点的集合，用于降低授权配置复杂度。

示例：

- `finance.invoice.viewer` 包含 `finance.invoice.read`
- `finance.invoice.manager` 包含 `finance.invoice.read` 和 `finance.invoice.approve`

权限组和权限点必须属于同一个应用，禁止跨应用绑定。

### IAM 角色

IAM 角色是 Feishu IAM 内部的授权载体，不依赖飞书角色或飞书用户组。角色属于单个应用，可以绑定主体，也可以绑定权限组和直接权限点。

示例：

- `invoice_manager`
- `finance_admin`
- `report_auditor`

角色 key 不强制带 `app_key` 前缀，但 API 响应会同时返回 `app_key` 和角色 `key`，避免跨应用阅读时产生歧义。

### 主体绑定

`v0.3.0` 支持两类主体：

- `feishu_user`：飞书用户，主体 ID 使用飞书 `user_id`。
- `feishu_department`：飞书部门，主体 ID 使用飞书部门 ID。

主体绑定只基于 Feishu IAM 已镜像的飞书用户和部门判断是否存在。不存在或已删除的主体可以被保存为 orphaned，但不会参与权限计算。

## key 命名规则

应用 `app_key`：

```text
^[a-z][a-z0-9_-]{1,31}$
```

合法示例：

- `finance`
- `oa`
- `crm_ops`

非法示例：

- `Finance`：包含大写字母。
- `f`：长度不足。
- `finance.app`：应用 key 不使用点号。

权限组和权限点 key 必须以当前应用 `app_key.` 开头：

```text
^${app_key}\.[a-z0-9][a-z0-9._-]{0,127}$
```

合法示例：

- `finance.invoice.read`
- `finance.invoice.viewer`

非法示例：

- `invoice.read`：缺少 `finance.` 前缀。
- `crm.customer.read`：跨应用前缀。
- `finance.Invoice.Read`：包含大写字母。

IAM 角色 key：

```text
^[a-z0-9][a-z0-9._-]{0,127}$
```

合法示例：

- `invoice_manager`
- `finance_admin`

非法示例：

- `Invoice Manager`：包含空格和大写字母。
- `_admin`：首字符不合法。

## 权限计算规则

权限计算入口是 `app_key + user_id`。

计算过程：

1. 查询应用，应用不存在返回 `APPLICATION_NOT_FOUND`，应用禁用返回 `APPLICATION_DISABLED`。
2. 查询飞书用户镜像，用户不存在、已删除或不可登录时返回 `FEISHU_USER_NOT_ACTIVE`。
3. 读取用户直接所属部门关系。`v0.3.0` 只计算直接部门，不向父部门递归。
4. 找出当前应用下 active 的 IAM 角色。
5. 命中绑定到该用户的角色。
6. 命中绑定到用户直接部门的角色。
7. 丢弃 orphaned 主体绑定。
8. 汇总角色直接授权的 active 权限点。
9. 汇总角色授权的 active 权限组，并展开组内 active 权限点。
10. 按 key 去重并排序，返回权限组、权限点和命中的角色。

禁用应用、禁用角色、禁用权限组和禁用权限点都不会参与最终权限结果。

## 平台 API 示例

所有平台 API 都需要平台管理 token：

```bash
curl -H "Authorization: Bearer <PLATFORM_ADMIN_TOKEN>" \
  http://localhost:3000/api/v1/platform/applications
```

创建应用：

```bash
curl -sS -H "Authorization: Bearer <PLATFORM_ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"appKey":"finance","name":"财务系统","description":"费用与发票"}' \
  http://localhost:3000/api/v1/platform/applications
```

创建权限点：

```bash
curl -sS -H "Authorization: Bearer <PLATFORM_ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"key":"finance.invoice.read","name":"查看发票"}' \
  http://localhost:3000/api/v1/platform/applications/finance/permission-points
```

创建权限组：

```bash
curl -sS -H "Authorization: Bearer <PLATFORM_ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"key":"finance.invoice.viewer","name":"发票查看员"}' \
  http://localhost:3000/api/v1/platform/applications/finance/permission-groups
```

把权限点加入权限组：

```bash
curl -sS -X PUT -H "Authorization: Bearer <PLATFORM_ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"pointIds":["point-uuid"]}' \
  http://localhost:3000/api/v1/platform/applications/finance/permission-groups/group-uuid/points
```

创建 IAM 角色：

```bash
curl -sS -H "Authorization: Bearer <PLATFORM_ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"key":"invoice_manager","name":"发票管理员"}' \
  http://localhost:3000/api/v1/platform/applications/finance/iam-roles
```

绑定角色主体：

```bash
curl -sS -X PUT -H "Authorization: Bearer <PLATFORM_ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"subjects":[{"type":"feishu_user","id":"ou-user-1"}]}' \
  http://localhost:3000/api/v1/platform/applications/finance/iam-roles/role-uuid/subjects
```

把角色授权到权限组：

```bash
curl -sS -X PUT -H "Authorization: Bearer <PLATFORM_ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"groupIds":["group-uuid"]}' \
  http://localhost:3000/api/v1/platform/applications/finance/iam-roles/role-uuid/permission-groups
```

预览用户权限：

```bash
curl -sS -H "Authorization: Bearer <PLATFORM_ADMIN_TOKEN>" \
  http://localhost:3000/api/v1/platform/applications/finance/users/ou-user-1/permissions
```

预览响应示例：

```json
{
  "app_key": "finance",
  "user_id": "ou-user-1",
  "permission_groups": [
    { "key": "finance.invoice.viewer", "name": "发票查看员" }
  ],
  "permission_points": [
    { "key": "finance.invoice.read", "name": "查看发票" }
  ],
  "matched_roles": [
    { "key": "invoice_manager", "name": "发票管理员" }
  ],
  "computed_at": "2026-05-16T03:00:00.000Z"
}
```

## 应用开发者 API 凭证

`v0.8.1` 起，每个应用可拥有专属开发者 API 凭证。该凭证只用于维护本应用权限点、权限组和权限组权限点绑定，不用于用户登录。

鉴权方式：

```http
Authorization: Bearer <developer_api_token>
```

该凭证可以调用：

- `GET /api/v1/developer/apps/{app_key}/permission-points`
- `POST /api/v1/developer/apps/{app_key}/permission-points`
- `PATCH /api/v1/developer/apps/{app_key}/permission-points/{point_id}`
- `POST /api/v1/developer/apps/{app_key}/permission-points/{point_id}/disable`
- `GET /api/v1/developer/apps/{app_key}/permission-groups`
- `POST /api/v1/developer/apps/{app_key}/permission-groups`
- `PATCH /api/v1/developer/apps/{app_key}/permission-groups/{group_id}`
- `POST /api/v1/developer/apps/{app_key}/permission-groups/{group_id}/disable`
- `PUT /api/v1/developer/apps/{app_key}/permission-groups/{group_id}/points`

路径中的 `{app_key}` 必须与开发者 API 凭证所属应用一致；不一致时返回 `DEVELOPER_PERMISSION_DENIED`。旧版不带 `{app_key}` 的 `/api/v1/developer/permission-*` 路径仍保留兼容，但新接入应使用应用作用域路径。

该凭证不能修改应用基础信息、回调地址、OAuth 登录凭证、IAM 角色、角色成员、管理员授权或系统设置。

## 管理端操作步骤

管理端新增“应用与权限”区域，位置在系统状态卡片之后、飞书同步区域之前。

当前管理端支持：

1. 查看应用列表。
2. 点击应用后查看该应用的权限组、权限点和 IAM 角色。
3. 输入飞书 `user_id`，调用权限预览接口查看该用户在当前应用下的权限计算结果。
4. 权限 API 失败时展示稳定错误码、中文安全文案和 request id，不展示后端 detail、secret、token、堆栈或原始错误对象。

`v0.8.1` 管理端支持创建应用接入包，并在应用详情中查看应用级接入配置和开发者 API 凭证状态。应用不再展示环境维度，回调地址按应用维护。

## Agent 验收 checklist

- `pnpm --filter @feishu-iam/api prisma:validate` 通过。
- `pnpm --filter @feishu-iam/api test -- permission` 通过。
- `pnpm --filter @feishu-iam/admin-web test -- App.test.tsx` 通过。
- `pnpm --filter @feishu-iam/api typecheck` 通过。
- `pnpm --filter @feishu-iam/admin-web typecheck` 通过。
- `pnpm --filter @feishu-iam/api lint` 通过。
- `pnpm --filter @feishu-iam/admin-web lint` 通过。
- `pnpm check` 通过。
- `pnpm db:migrate` 执行后 `schema_versions` 包含 `0.3.0`。
- 平台 API 缺少或错误 token 时返回稳定错误，不泄漏敏感信息。
- 权限点和权限组 key 缺少应用前缀时被拒绝。
- 权限组不能绑定其他应用的权限点。
- IAM 角色不能绑定其他应用的权限组或权限点。
- IAM 角色主体只接受 `feishu_user` 和 `feishu_department`。
- 禁用应用、角色、权限组、权限点不会参与权限计算。
- 管理端快速切换应用或权限预览时，旧请求不会覆盖当前应用状态。

## 后续版本

后续版本可以在当前底座上继续扩展完整 OIDC、refresh token、资源级权限、数据范围权限或 ABAC 表达式。
