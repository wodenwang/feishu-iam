# feishu-iam v0.2.0 应用接入生产化 Pencil 原型输入

## 1. 版本目标

`v0.2.0` 的目标是把 v0.1 已经跑通的第三方 demo 接入链路，升级为可以在 Admin Console 中长期维护的应用接入配置能力。

本版本不是新的营销页面，不是新 Dashboard，也不是完整 IdP 产品化。它只围绕一个应用的接入配置维护展开。

用户必须能在应用详情页判断：

- 当前应用是否已经可安全接入。
- OAuth redirect URI 是否配置完整。
- `appSecret` 和 `apiSecret` 是否已签发、最近是否轮换。
- 是否至少有一个应用管理员。
- 最近是否有 OAuth / token / Application API 失败。
- 配置变更是否能通过审计日志回溯。

## 2. 不可协商边界

- 飞书仍然是唯一身份源。
- 不新增 username / password 登录。
- 不新增本地 root、本地超级管理员或独立账号体系。
- 不做 `/directory` 编辑、导入、导出或目录治理。
- 不做飞书 webhook、event sync、incremental sync 或同步告警。
- 不做完整 OIDC discovery、JWKS、PKCE、refresh token 或复杂 consent。
- 不做 SDK、CLI、Helm、Terraform、install/upgrade 产品化。
- 不做多租户 SaaS IdP。
- 不展示真实飞书 App Secret、tenant token、authorization code、bearer token、导出用户列表或同步快照。

## 3. 设计系统

沿用 `DESIGN.md` 和既有 Admin Console 规范：

- React + TypeScript + Vite + Ant Design。
- 企业后台高密度布局。
- 表格优先。
- 24px 页面 padding。
- Card gap 16px。
- Table 使用 middle 或 small。
- 不使用营销式 hero、渐变背景、玻璃拟态、异形卡片或装饰插画。
- 主体使用 `Layout`、`PageHeader`、`Tabs`、`Descriptions`、`Table`、`Drawer + Form`、`Modal / Popconfirm`、`Tag / Badge`。

## 4. 信息架构

v0.2 原型保留一个主页面：`/applications/:id` 应用详情。

不要新增独立“配置中心”一级菜单。应用接入配置必须留在应用上下文中，避免平台管理员在多应用环境下失去上下文。

应用详情页 Tabs：

1. 概览
2. 接入配置
3. 权限注册
4. 应用管理员
5. 审计记录

本次原型重点覆盖 `概览`、`接入配置`、`应用管理员`、`审计记录`。

## 5. 页面 A：应用详情概览第一屏

### 页面用途

让平台管理员或应用管理员一打开应用详情，就能判断这个应用是否可以安全接入。

### PageHeader

- 标题：`客户中心 CRM`
- 副标题：`app_crm_prod · 启用`
- Breadcrumb：`应用管理 / 客户中心 CRM`
- 主按钮：`运行接入检查`、`查看接入配置`

### 配置完整性摘要

使用紧凑卡片或 `Descriptions` + `Tag`，不要做装饰性 Dashboard。

| 项 | 状态 | 说明 |
|---|---|---|
| OAuth 回调 | `已配置` | 2 个启用 URI |
| appSecret | `已签发` | 最近轮换：2026-05-27 19:12 |
| API Secret | `建议轮换` | 90 天未轮换 |
| 应用管理员 | `已配置` | 3 人 |
| 最近调用 | `有失败` | 过去 24 小时 2 次 token 失败 |

配置完整性状态：

- `可接入`：所有关键项完整，无近期高风险失败。
- `部分完成`：存在缺失项但不阻断现有应用。
- `异常`：最近 OAuth / token / Application API 有失败，需要处理。

v0.2 只提示配置完整性，不自动停用应用。

### 最近风险

使用 `Alert` 或小型 Table 展示：

- `API Secret 已超过建议轮换周期`
- `https://crm.example.com/oauth/callback 已停用，仍有最近 authorize 请求命中`
- `最近 24 小时 token exchange 失败 2 次`

### 最近审计摘要

展示最近 5 条配置相关审计：

- `oauth.redirect_uri.create`
- `secret.rotate`
- `application.admin.add`
- `application.admin.remove`
- `oauth.redirect_uri.disable`

## 6. 页面 B：接入配置 Tab

### 页面用途

集中维护 OAuth redirect URI、Application API 配置和 secret 状态。

### 布局

顶部使用两个紧凑区域：

1. OAuth 配置
2. Application API 配置

下方为 OAuth redirect URI Table。

### OAuth 配置区域

| 字段 | 展示 |
|---|---|
| Client ID | `app_crm_prod`，等宽，可复制 |
| appSecret 状态 | `已签发`，最近轮换时间 |
| 授权端点 | `/api/oauth/authorize`，可复制 |
| Token 端点 | `/api/oauth/token`，可复制 |

操作：`轮换 appSecret`。

### Application API 配置区域

| 字段 | 展示 |
|---|---|
| appKey | 等宽，可复制 |
| API Secret 状态 | `建议轮换` 或 `已签发` |
| API Endpoint | `/api/application/*`，可复制 |
| 签名方式 | `HMAC-SHA256` |

操作：`轮换 API Secret`。

### OAuth redirect URI Table

| 列 | 展示 |
|---|---|
| URI | 等宽字体，长文本省略，可复制 |
| 环境 | `生产` / `测试` / `本地开发` |
| 状态 | `启用` / `停用` |
| 最近命中 | 时间或 `-` |
| 创建人 | 飞书姓名 |
| 更新时间 | 时间 |
| 操作 | `停用` / `恢复` |

Toolbar：`新增 redirect URI`、`刷新`。

空状态：

- 标题：`还没有 OAuth redirect URI`
- 说明：`第三方应用无法完成 OAuth 回调。请先添加一个 HTTPS 回调地址。`
- 主按钮：`新增 redirect URI`

搜索无结果：

- 标题：`没有匹配的 redirect URI`
- 操作：`重置筛选`

## 7. Drawer：新增 redirect URI

使用右侧 Drawer + vertical Form。

| 字段 | 控件 | 校验 |
|---|---|---|
| URI | `Input` | 必填，必须是 URL；生产建议 HTTPS；本地允许 `http://127.0.0.1` |
| 环境 | `Select` | 生产 / 测试 / 本地开发 |
| 备注 | `Input.TextArea` | 可选，最多 100 字 |

校验和错误：

- URL 格式错误：`请输入合法 URL`
- 重复 URI：`该 redirect URI 已存在`
- 无权限：`你没有权限维护该应用的 OAuth 配置`
- 保存失败：展示 requestId

提交成功：

- Drawer 关闭。
- Table 刷新。
- 写入 `oauth.redirect_uri.create` 审计。

## 8. Popconfirm：URI 停用 / 恢复

第一版只支持停用和恢复，不做硬删除，便于审计回溯。

停用文案：

- 标题：`停用该 redirect URI？`
- 说明：`停用后，第三方应用不能再使用该 URI 完成 OAuth authorize。已有 bearer token 不受影响。`
- 确认按钮：`确认停用`

恢复文案：

- 标题：`恢复该 redirect URI？`
- 说明：`恢复后，该 URI 可再次用于 OAuth authorize。`
- 确认按钮：`确认恢复`

## 9. Modal：secret 轮换确认

统一使用 `轮换 secret`，不使用 `重置` 作为主按钮文案。

原因：轮换表达“生成新 secret 并让旧 secret 失效”的安全语义，比重置更准确。

确认 Modal 字段：

- 标题：`轮换 appSecret` 或 `轮换 API Secret`
- 影响说明：
  - `新 secret 生成后只显示一次。`
  - `旧 secret 将立即失效，第三方应用必须更新运行时环境变量。`
  - `本操作会写入审计日志。`
- 二次确认输入：要求输入应用编码 `app_crm_prod`
- 按钮：`取消`、`确认轮换`

Loading 状态：

- 确认按钮显示 loading。
- Modal 不允许重复提交。

失败状态：

- 展示错误信息和 requestId。
- 不关闭 Modal。

## 10. Modal：secret 一次性结果

轮换成功后展示一次性结果 Modal。

内容：

- Alert：`请立即保存。关闭后无法再次查看明文。`
- Secret 类型：`appSecret` 或 `API Secret`
- 明文值：等宽、可复制、默认可见，但不进入截图或文档示例。
- 推荐环境变量：
  - `IAM_APP_SECRET=...`
  - `IAM_API_SECRET=...`
- 操作：`复制 secret`、`复制 .env 片段`、`我已保存，关闭`

关闭确认：

- 点击关闭时，如果未复制过，二次确认：`确认关闭？关闭后无法再次查看该 secret。`

审计：

- `secret.rotate`
- `secret.copy`

## 11. 页面 C：应用管理员 Tab

### 页面用途

维护一个应用的多个飞书用户管理员。

### Table columns

| 列 | 展示 |
|---|---|
| 管理员 | 飞书姓名 + feishu user id |
| 角色 | `主要管理员` / `应用管理员` |
| 状态 | `在职` / `停用` / `离职` |
| 添加人 | 飞书姓名 |
| 添加时间 | 时间 |
| 最近登录 | 时间 |
| 操作 | `移除` |

Toolbar：`新增应用管理员`、`刷新`。

空状态：

- 标题：`还没有应用管理员`
- 说明：`至少保留一个应用管理员，便于业务系统自行维护授权和接入配置。`
- 主按钮：`新增应用管理员`

权限：

- 平台管理员可以增删应用管理员。
- 应用管理员只能查看本应用管理员列表，不能移除自己或其他管理员。

## 12. Drawer：新增应用管理员

| 字段 | 控件 | 校验 |
|---|---|---|
| 飞书用户 | `Select` / `TreeSelect` | 必填，只能选择已同步飞书用户 |
| 角色 | `Radio.Group` | 应用管理员 / 主要管理员 |
| 备注 | `Input.TextArea` | 可选 |

错误：

- 用户不存在：`该飞书用户尚未同步到 IAM`
- 重复添加：`该用户已经是应用管理员`
- 无权限：`你没有权限维护该应用管理员`

成功：

- Drawer 关闭。
- Table 刷新。
- 写入 `application.admin.add` 审计。

## 13. Popconfirm：移除应用管理员

普通移除：

- 标题：`移除该应用管理员？`
- 说明：`移除后，该用户将不能继续维护本应用接入配置和角色授权。`
- 确认按钮：`确认移除`

最后一个管理员保护错误：

- 使用 `Alert` 或 Modal 错误状态。
- 标题：`不能移除最后一个应用管理员`
- 说明：`请先添加另一个应用管理员，再移除当前管理员。`
- 操作：`新增应用管理员`

## 14. 页面 D：审计记录 Tab

### 页面用途

在应用上下文里回溯配置变更。

### 筛选

- 动作类型：全部 / redirect URI / secret / 应用管理员 / Application API / OAuth
- 结果：成功 / 失败
- 时间范围
- 关键词

### Table columns

| 列 | 展示 |
|---|---|
| 时间 | 精确到秒 |
| 动作 | `Tag` + action |
| 操作人 | 飞书姓名 / 系统 / Application API |
| 对象 | URI / secret 类型 / 管理员 |
| 结果 | 成功 / 失败 |
| Request ID | 等宽，可复制 |
| 操作 | 查看详情 |

### 详情 Drawer

展示脱敏 metadata JSON。

禁止展示：

- `appSecret`
- `apiSecret`
- 飞书 App Secret
- tenant access token
- authorization code
- bearer token
- refresh token

## 15. 768px 响应式要求

- Sidebar 可以折叠，但内容不能与菜单重叠。
- Tabs 可横向滚动或自动折叠，但不能遮挡操作区。
- 长 redirect URI 必须省略显示，并提供复制。
- 危险操作按钮可以换行，但不能挤压文字。
- Drawer 宽度使用接近全屏，表单仍保持垂直布局。
- Modal 按钮在窄屏下保持可点击，不允许文本溢出。

## 16. Pencil 输出要求

必须保存：

- `design/feishu-iam-v0.2.0-application-onboarding.pen`
- 关键页面截图到 `design/exports/v0.2.0-application-onboarding/`

原型至少包含以下画板：

1. `V020 Application Overview`
2. `V020 Integration Config`
3. `V020 Add Redirect URI Drawer`
4. `V020 Redirect URI Disable Confirm`
5. `V020 Secret Rotate Confirm`
6. `V020 Secret One Time Result`
7. `V020 Application Admins`
8. `V020 Add Admin Drawer`
9. `V020 Last Admin Protection`
10. `V020 Audit Config Changes`
11. `V020 Tablet 768`

每个画板必须附带简短注释，说明用途、组件映射、状态和权限规则。

## 17. 进入下一步的完成标准

- `.pen` 文件存在并可由 Pencil 打开。
- 导出图覆盖上面 11 个画板或等价内容。
- `snapshot_layout` 不出现明显重叠、裁切或布局异常。
- 设计说明和截图足以进入下一轮 `gstack /plan-design-review on prototype`。

## 18. 本次 Pencil 产出记录

生成时间：2026-05-27

复审修订：

- 已关闭应用管理员表格超出边界的 `编辑` 操作，管理员维护在 v0.2.0 中只保留新增和移除。
- 已将 secret 一次性结果 Modal 中的示例明文改为明确的非真实占位值，避免截图被误读为真实凭证。
- 已重新导出 `C5ltro.png` 和 `r43rt.png`。
- 已从 Pencil 自动备份恢复 `.pen` 源文件，恢复后用 Pencil MCP 重新验证关键画板内容和布局。

Pencil 源文件：

- `design/feishu-iam-v0.2.0-application-onboarding.pen`

导出目录：

- `design/exports/v0.2.0-application-onboarding/`

画板与导出文件：

| # | 画板 | Node ID | 导出文件 | 尺寸 |
|---:|---|---|---|---|
| 1 | V020 Application Overview | `kmP8k` | `kmP8k.png` | 1440 x 960 |
| 2 | V020 Integration Config | `LN1RO` | `LN1RO.png` | 1440 x 900 |
| 3 | V020 Add Redirect URI Drawer | `Df8I7` | `Df8I7.png` | 520 x 640 |
| 4 | V020 Redirect URI Disable Confirm | `mcev0` | `mcev0.png` | 424 x 204 |
| 5 | V020 Secret Rotate Confirm | `x3PF4u` | `x3PF4u.png` | 504 x 452 |
| 6 | V020 Secret One Time Result | `r43rt` | `r43rt.png` | 544 x 464 |
| 7 | V020 Application Admins | `C5ltro` | `C5ltro.png` | 1440 x 900 |
| 8 | V020 Add Admin Drawer | `KQ5KB` | `KQ5KB.png` | 520 x 580 |
| 9 | V020 Last Admin Protection | `gAeZo` | `gAeZo.png` | 424 x 204 |
| 10 | V020 Audit Config Changes | `OHUfG` | `OHUfG.png` | 1440 x 900 |
| 11 | V020 Tablet 768 | `i2nPxQ` | `i2nPxQ.png` | 768 x 1024 |

整体画布预览：

- `overview.png`

验证记录：

- Pencil 生成后已运行 `snapshot_layout problemsOnly`，结果：`No layout problems.`
- 导出文件尺寸已用 `sips -g pixelWidth -g pixelHeight` 核对。
