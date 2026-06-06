# Feishu IAM v0.2.1 飞书字段完整性与发布收口设计

日期：2026-05-15
状态：已确认，可进入实施计划阶段

## 1. 版本目标

`v0.2.1` 是飞书身份镜像的字段完整性和发布收口版本。`v0.2.0` 已经验证真实飞书只读同步闭环成立，但真实租户返回的数据存在用户状态缺失、部门和用户展示名称不完整的问题，导致 `active_users=0`，暂时不能支撑后续 SSO 和权限分配体验。

本版本目标是把真实飞书同步结果从“能同步”推进到“可解释、可修正、可验收”：

- 在同步前提供不落库的字段完整性诊断。
- 明确用户状态、姓名、邮箱、手机号、部门名称等字段是否返回。
- 真实同步后 `active_users > 0`，作为进入后续 SSO 设计和实现的硬门槛。
- 管理端能清楚提示字段缺失、权限不足、通讯录可见范围不足和只读范围正常。
- 保持飞书通讯录只读红线，不增加任何飞书写接口。

## 2. 范围

### 2.1 纳入范围

- 新增飞书字段诊断平台 API。
- 诊断接口实时调用现有只读飞书客户端，不写数据库。
- 诊断部门字段和用户字段返回情况。
- 根据诊断结果计算登录准备度和发布门槛状态。
- 管理端增加字段完整性诊断卡片。
- 手动同步后刷新同步状态和字段诊断结果。
- 更新飞书同步文档、README 和版本号。
- 补充自动化测试和真实飞书验收 checklist。
- 发布收尾建议：从 `main` 开 `release/v0.2.1`，完成 MR 后打 `v0.2.1` tag。

### 2.2 排除范围

- 不新增 IAM 应用、角色、权限组、权限点和授权关系。
- 不实现 SSO 端点。
- 不同步飞书角色或飞书用户组。
- 不把诊断结果落库。
- 不新增飞书通讯录写接口。
- 不实现完整管理员登录体系。
- 不把远端分支删除作为版本功能的一部分。

## 3. 发布门槛

`v0.2.1` 的核心发布门槛是：配置真实飞书凭证和只读通讯录权限后，完成一次真实同步，`GET /api/v1/platform/feishu/status` 返回的 `counts.activeUsers` 必须大于 0。

如果 `activeUsers=0`，版本不能进入后续 SSO 实施阶段。常见原因包括：

- 飞书用户 `status` 字段未返回，Feishu IAM 无法判断用户是否可登录。
- 通讯录可见范围没有覆盖真实用户。
- 同步还没有在补齐字段权限后重新执行。

字段分级：

- 阻断项：用户 `status` 缺失、抽样不到任何用户、飞书权限不足或配置缺失。
- 强警告：用户 `name` 缺失、部门 `name` 缺失。这类问题不一定阻断同步，但会影响管理后台和后续授权体验。
- 普通警告：`email`、`mobile`、`employee_no`、`job_title` 等展示字段缺失。它们不阻断 SSO 核心登录，但需要在文档中说明影响。

## 4. 后端诊断接口

新增平台 API：

```text
GET /api/v1/platform/feishu/field-diagnostics
```

接口沿用 `PLATFORM_ADMIN_TOKEN` 保护：

```text
Authorization: Bearer <PLATFORM_ADMIN_TOKEN>
```

诊断接口复用现有 `FeishuClient` 只读边界，只允许调用：

- 获取 `tenant_access_token`。
- 查询部门子节点。
- 查询部门直属用户。

诊断流程：

1. 检查 `FEISHU_APP_ID` 和 `FEISHU_APP_SECRET`。
2. 读取根部门 `0` 的子部门第一页。
3. 抽样根部门和若干已返回部门的直属用户。
4. 统计部门字段和用户字段的返回情况。
5. 基于字段矩阵生成登录准备度、阻断项、警告项和下一步建议。

诊断接口不创建 `feishu_sync_runs`，不修改任何飞书镜像表，也不缓存真实字段值。

## 5. 诊断响应模型

响应建议结构：

```json
{
  "status": "failed",
  "loginReadiness": {
    "ready": false,
    "reason": "用户 status 字段未返回，无法判断可登录用户"
  },
  "sampleCounts": {
    "departments": 3,
    "users": 20
  },
  "departmentFields": [
    {
      "field": "name",
      "status": "missing",
      "presentCount": 0,
      "missingCount": 3,
      "requiredLevel": "strong_warning"
    }
  ],
  "userFields": [
    {
      "field": "status",
      "status": "missing",
      "presentCount": 0,
      "missingCount": 20,
      "requiredLevel": "blocking"
    }
  ],
  "blockingIssues": ["用户 status 字段未返回"],
  "warnings": ["部门 name 字段未返回"],
  "nextActions": ["检查飞书应用通讯录字段权限，确认已授权用户状态字段读取"]
}
```

字段状态取值：

- `present`：抽样数据中字段有返回且至少存在一个非空值。
- `empty`：字段键存在，但抽样值为空。
- `missing`：字段键未返回。
- `not_sampled`：没有抽样到对应对象，无法判断字段。

整体 `status` 取值：

- `passed`：阻断项不存在，关键字段满足后续 SSO 准备要求。
- `warning`：没有阻断项，但存在展示字段缺失。
- `failed`：存在阻断项。
- `not_configured`：飞书应用配置缺失。

## 6. 管理端设计

管理端在现有“飞书组织与用户同步”区域增加“字段完整性诊断”卡片，不新增导航。

卡片展示三层信息：

- 顶层结论：`可进入后续 SSO`、`不可进入后续 SSO`、`字段不完整但可继续同步`。
- 发布门槛：展示 `active_users > 0` 是否满足；如果不满足，说明可能是 `status` 未返回、通讯录范围不足或补齐权限后尚未重跑同步。
- 字段矩阵：按部门字段和用户字段分组展示 `已返回`、`未返回`、`空值`、`未抽样到数据`。

管理端只展示字段状态和计数，不展示真实手机号、邮箱或其他敏感字段值。

交互要求：

- 页面加载时读取同步状态和字段诊断。
- 保留现有手动同步按钮。
- 新增刷新诊断按钮。
- 手动同步成功或失败后重新读取同步状态和字段诊断。
- 诊断接口失败时展示安全错误摘要和 request id，不展示堆栈、token 或密钥。

## 7. 错误处理

诊断接口复用现有飞书错误结构，并保持安全输出：

```json
{
  "error": {
    "code": "FEISHU_PERMISSION_DENIED",
    "message": "飞书应用缺少只读通讯录权限或可见范围不足",
    "request_id": "req_..."
  }
}
```

错误分类：

- `FEISHU_CONFIG_MISSING`：缺少 `FEISHU_APP_ID` 或 `FEISHU_APP_SECRET`。
- `FEISHU_PERMISSION_DENIED`：飞书只读通讯录权限不足。
- `FEISHU_NETWORK_ERROR`：访问飞书接口失败。
- `FEISHU_API_ERROR`：飞书接口返回其他错误。

诊断过程不得记录或返回：

- `FEISHU_APP_SECRET`
- `tenant_access_token`
- `PLATFORM_ADMIN_TOKEN`
- cookie、密码或其他敏感凭证

## 8. 文档更新

需要更新：

- `docs/feishu-identity-sync.md`：增加字段诊断接口、字段完整性解释、飞书后台配置 checklist、真实飞书验收步骤。
- `README.md`：把下一步调整为“先完成 `v0.2.1` 字段完整性收口，再进入 `v0.3.0` 权限模型”。
- `package.json`：版本号升级为 `0.2.1`。
- `docs/codex-sessions/`：归档本次设计和后续实施会话。

文档需要明确：`email` 和 `mobile` 可能涉及更敏感的字段权限，它们缺失不阻断 SSO 核心登录；用户 `status` 缺失会阻断，因为 Feishu IAM 必须保守判断用户不可登录。

## 9. 测试策略

自动化测试默认使用 mock 飞书客户端，不依赖真实飞书凭证。

后端测试覆盖：

- 诊断接口成功返回字段矩阵。
- 飞书配置缺失返回 `not_configured` 或稳定错误。
- 权限不足返回安全错误。
- 抽样不到用户时返回阻断项。
- 用户 `status` 缺失时返回阻断项。
- 用户和部门 `name` 缺失时返回强警告。
- `email`、`mobile` 等可选展示字段缺失时返回普通警告。
- 只读静态检查确认没有新增飞书通讯录写接口路径。

管理端测试覆盖：

- 诊断通过态渲染。
- 阻断态渲染。
- 警告态渲染。
- 诊断接口失败态渲染。
- 手动同步后刷新诊断和同步状态。

基础验收命令：

```bash
pnpm check
```

真实飞书验收：

1. 配置真实 `FEISHU_APP_ID` 和 `FEISHU_APP_SECRET`。
2. 确认飞书应用只授予只读通讯录权限。
3. 调用 `GET /api/v1/platform/feishu/field-diagnostics`。
4. 根据诊断提示补齐字段权限或通讯录可见范围。
5. 触发 `POST /api/v1/platform/feishu/sync-runs`。
6. 查询 `GET /api/v1/platform/feishu/status`，确认 `counts.activeUsers > 0`。
7. 确认管理端展示字段诊断结论、同步状态和历史记录。

## 10. 后续版本关系

`v0.2.1` 完成后，Feishu IAM 才进入 `v0.3.0` 权限模型设计和实现。`v0.3.0` 聚焦 IAM 内部应用、角色、权限组、权限点和用户/部门授权关系，不依赖飞书角色或飞书用户组。

`v0.2.1` 不解决同步性能问题。真实同步耗时约 8 分钟这一点可以在后续版本评估并发分页、限速、进度展示和超时控制。
