# feishu-iam v0.1.0 Pencil 原型输入文档

状态：DRAFT_FOR_PENCIL
日期：2026-05-23
适用版本：v0.1.0
设计对象：IAM Admin Console
界面类型：企业级后台管理系统 / Admin Console

## 1. 设计目标

v0.1.0 的 UI 目标不是做完整 IAM 平台，而是支撑“第三方系统接入闭环”。

原型必须让使用者清楚完成这条链路：

```text
平台管理员登录
  |
  v
同步飞书组织与用户
  |
  v
创建第三方应用
  |
  v
复制接入配置与 Agent Prompt
  |
  v
第三方系统注册权限组/权限点
  |
  v
平台管理员或应用管理员创建角色并授权
  |
  v
第三方系统查询用户权限点
  |
  v
审计日志可回溯全链路
```

设计重点：

- 高信息密度，不做营销页。
- 以 Ant Design 组件为蓝图。
- 权限、审计、同步状态必须可信。
- 操作路径清晰，避免装饰性 Dashboard。
- 页面必须能指导第一次部署后的平台管理员跑通 demo 应用接入。

## 2. 用户角色

### 平台管理员

权限范围：

- 登录 Admin Console。
- 查看全局工作台。
- 创建、查看、停用应用。
- 管理应用管理员。
- 触发飞书组织用户同步。
- 查看同步结果和失败原因。
- 创建和管理角色。
- 给角色绑定权限组、权限点、飞书组织、飞书用户。
- 查看全局审计日志。
- 复制应用接入配置和运行时密钥。

### 应用管理员

权限范围：

- 只能查看自己所属应用。
- 查看应用接入信息。
- 复制本应用 Agent Prompt。
- 复制本应用运行时密钥。
- 查看本应用注册的权限组和权限点。
- 管理本应用下的角色授权。
- 查看本应用相关审计日志。

限制：

- 不能创建或停用应用。
- 不能触发飞书全局同步。
- 不能查看其他应用。
- 不能查看全局审计日志。

### 第三方系统开发人员

不一定登录 Admin Console。主要通过应用管理员或平台管理员导出的 Agent Prompt、`.env` 配置和 API 文档完成接入。

## 3. 原型范围

v0.1.0 Pencil 原型必须覆盖以下页面：

1. 飞书登录页 / 登录回调状态
2. 首次初始化状态页
3. 工作台
4. 应用管理列表
5. 应用详情
6. 应用接入向导
7. 角色授权
8. 组织与用户只读浏览
9. 飞书同步中心
10. 审计日志
11. 无权限页
12. 全局错误页

不在 v0.1.0 原型范围：

- SAML 配置。
- 多租户管理。
- 本地账号密码登录。
- 权限点和权限组的手工编辑 UI。
- 复杂审计报表。
- 权限审批流。
- 权限矩阵导入/导出。
- 高级系统设置。

## 4. 全局布局

### 页面骨架

Ant Design 映射：

- 整体布局：`Layout`
- 左侧导航：`Layout.Sider + Menu`
- 顶部栏：`Layout.Header`
- 内容区：`Layout.Content`
- 面包屑：`Breadcrumb`
- 页面标题：项目级 `PageHeader`
- 列表容器：不要做大面积浮动卡片，使用 full-width content band + 表格区域。

桌面布局：

```text
+--------------------------------------------------------------------------------+
| Header: feishu-iam / 当前租户 / 当前登录用户 / 帮助 / 退出                     |
+----------------------+---------------------------------------------------------+
| Sider                | Breadcrumb                                              |
| - 工作台             | PageHeader                                              |
| - 应用管理           | SearchForm / Toolbar / Main Content                     |
| - 角色授权           |                                                         |
| - 组织与用户         |                                                         |
| - 飞书同步           |                                                         |
| - 审计日志           |                                                         |
+----------------------+---------------------------------------------------------+
```

默认尺寸：

- 左侧导航宽度：208px。
- 页面 padding：24px。
- 内容最大宽度：不强制居中，后台页面默认占满可用宽度。
- Table size：`middle`，信息密度较高页面可用 `small`。
- Drawer 宽度：简单表单 520px，复杂接入向导 720px。

### 左侧导航

菜单项：

| 菜单 | 路由 | 平台管理员 | 应用管理员 |
|---|---|---:|---:|
| 工作台 | `/dashboard` | 可见 | 可见 |
| 应用管理 | `/applications` | 可见 | 可见，仅显示所属应用 |
| 角色授权 | `/roles` | 可见 | 可见，仅所属应用 |
| 组织与用户 | `/directory` | 可见 | 可见，只读 |
| 飞书同步 | `/sync` | 可见 | 不可见 |
| 审计日志 | `/audit-logs` | 可见 | 可见，仅所属应用 |

### 顶部栏

内容：

- 左侧：产品名 `feishu-iam`，不要做大 logo。
- 中间：当前环境标签，例如 `本地部署` / `生产`。
- 右侧：当前用户姓名、飞书用户 ID、角色标签、帮助链接、退出。

状态：

- 如果飞书同步失败，顶部可显示 `Badge` 提示，但不要用红色大面积警告条长期占位。
- 如果当前用户没有平台管理员权限，顶部角色标签显示 `应用管理员`。

## 5. 页面 1：飞书登录页 / 登录回调状态

### 页面用途

让平台管理员和应用管理员通过飞书登录。不得出现 username/password 表单。

### 信息层级

第一眼看到：

1. `feishu-iam`
2. “使用飞书登录”
3. 当前部署地址 / 环境标识

### Ant Design 映射

- `Result`：登录失败或回调失败。
- `Button`：使用飞书登录。
- `Spin`：回调处理中。
- `Alert`：配置缺失提示。

### 主要状态

| 状态 | 用户看到 |
|---|---|
| 未登录 | 单一主按钮“使用飞书登录” |
| 回调处理中 | “正在验证飞书身份...” |
| 飞书配置缺失 | “当前部署未配置飞书应用，请检查 FEISHU_APP_ID / FEISHU_APP_SECRET” |
| 用户未同步 | “已通过飞书认证，但 IAM 中还没有该用户，请联系平台管理员同步通讯录” |
| 无后台权限 | “你已登录，但没有 Admin Console 访问权限” |

### 设计注意

- 不做营销 hero。
- 不放 username/password 输入框。
- 不使用大面积渐变背景。
- 登录页可以比后台页面更简洁，但仍保持企业后台风格。

## 6. 页面 2：首次初始化状态页

### 页面用途

首次部署后，帮助运维确认系统是否已经绑定首个飞书平台管理员。

### 进入条件

- `FEISHU_INITIAL_ADMIN_USER_ID` 缺失、无效，或尚未完成 bootstrap。

### 页面结构

```text
PageHeader: 系统初始化
Alert: 当前系统尚未完成平台管理员绑定
Descriptions:
  - 飞书应用配置状态
  - 初始管理员 User ID
  - 数据库连接状态
  - 最近一次 bootstrap 尝试
Result / Steps:
  1. 配置飞书自建应用
  2. 设置 FEISHU_INITIAL_ADMIN_USER_ID
  3. 重启服务
  4. 使用飞书登录
```

### Ant Design 映射

- `Result`
- `Steps`
- `Descriptions`
- `Alert`
- `Button`

### 操作

- `重新检测配置`
- `查看部署文档`

## 7. 页面 3：工作台

### 页面用途

让管理员知道当前 IAM 是否能跑通 v0.1 接入闭环。

### 信息层级

只显示 4 个关键指标，不做复杂 Dashboard：

1. 应用数量
2. 已注册权限点数量
3. 最近一次飞书同步状态
4. 近 24 小时审计事件数量

### 页面结构

```text
PageHeader: 工作台
Metrics Row:
  应用数量 | 权限点数量 | 最近同步 | 近 24 小时审计

Main Two-column:
  Left: 接入闭环进度
  Right: 最近审计事件

Bottom:
  最近同步摘要
```

### Ant Design 映射

- `Card + Statistic`：指标卡片，但保持紧凑。
- `Steps`：接入闭环进度。
- `Table`：最近审计事件。
- `Alert`：同步失败提示。

### 接入闭环进度

步骤：

1. 完成飞书同步
2. 创建应用
3. 导出接入配置
4. 第三方系统注册权限点
5. 创建角色授权
6. 第三方系统查询权限

每一步有状态：`未开始`、`进行中`、`已完成`、`异常`。

### 空状态

如果没有应用：

- 标题：“还没有接入应用”
- 说明：“创建第一个应用后，可以导出 Agent Prompt 让第三方系统完成接入。”
- 主按钮：“创建应用”

## 8. 页面 4：应用管理列表

### 页面用途

管理第三方系统应用。平台管理员可创建和停用应用；应用管理员只能查看自己所属应用。

### 标准结构

```text
PageHeader: 应用管理
SearchForm
Toolbar
Table
Pagination
```

### Filter fields

| 字段 | 控件 | 说明 |
|---|---|---|
| 关键词 | `Input` | 应用名称 / appkey |
| 状态 | `Select` | 启用 / 停用 |
| 管理员 | `Select` 或 `TreeSelect` | 平台管理员可用 |
| 创建时间 | `DatePicker.RangePicker` | 可折叠高级筛选 |

默认展示关键词、状态、创建时间。

### Toolbar actions

| 操作 | 权限 | 组件 |
|---|---|---|
| 创建应用 | 平台管理员 | `Button type="primary"` |
| 批量停用 | 平台管理员 | `Button + Modal` |
| 刷新 | 平台管理员 / 应用管理员 | `Button` |

### Table columns

| 列 | 展示 |
|---|---|
| 应用名称 | 名称 + 简短描述 |
| appkey | 等宽字体，默认部分遮罩 |
| 状态 | `Tag`：启用 / 停用 |
| 权限组 | 数量 |
| 权限点 | 数量 |
| 应用管理员 | 头像/姓名摘要，超出显示 `+N` |
| 最近 API 调用 | 时间 |
| 创建时间 | 时间 |
| 操作 | 查看 / 接入配置 / 停用 |

### Row actions

- 查看：进入应用详情。
- 接入配置：进入应用接入向导页或打开 Drawer。
- 停用：`Popconfirm`，仅平台管理员。

### Create Drawer

字段：

| 字段 | 控件 | 校验 |
|---|---|---|
| 应用名称 | `Input` | 必填，2-50 字 |
| 应用编码 | `Input` | 必填，小写字母数字中划线 |
| 描述 | `Input.TextArea` | 可选，最多 200 字 |
| 回调地址 | `Input.TextArea` 或动态列表 | 至少 1 个，必须为 URL |
| 应用管理员 | `Select` / `TreeSelect` | 可选，飞书用户 |

提交成功后：

- 显示成功反馈。
- 跳转到应用详情或接入向导。
- 显示“复制运行时配置”引导，但不自动展示 secret。

## 9. 页面 5：应用详情

### 页面用途

展示应用接入信息、权限注册结果、应用管理员、审计摘要。

### 页面结构

```text
PageHeader: 应用详情
Tabs:
  - 概览
  - 接入配置
  - 权限注册
  - 应用管理员
  - 审计记录
```

### Tab：概览

使用 `Descriptions` 展示：

- 应用名称
- appkey
- 状态
- OIDC 回调地址
- API key 状态
- 创建人
- 创建时间
- 最近 API 调用

危险操作区：

- 停用应用
- 轮换 appsecret
- 轮换 API secret

危险操作必须二次确认。

### Tab：权限注册

只读展示第三方系统通过 API 注册的权限组和权限点。

表格列：

| 列 | 展示 |
|---|---|
| 权限组 Code | 等宽字体 |
| 权限组名称 | 文本 |
| 权限点 Code | 等宽字体 |
| 权限点名称 | 文本 |
| 状态 | `Tag` |
| 最近注册/更新时间 | 时间 |

空状态：

- 标题：“该应用还没有注册权限点”
- 说明：“第三方系统需要调用 Application API 注册权限组和权限点。”
- 操作：“查看接入文档”

## 10. 页面 6：应用接入向导

### 页面用途

这是 v0.1 的关键页面。它必须让开发人员能拿着输出去接入 `feishu-iam-thirdpart-demo` 或真实业务系统。

### 页面结构

```text
PageHeader: 应用接入向导
Steps:
  1. 配置回调地址
  2. 复制运行时环境变量
  3. 导出 Agent Prompt
  4. 注册权限组和权限点
  5. 验证登录和权限查询

Content Area:
  当前步骤详情

Right Side:
  接入检查清单
```

### Ant Design 映射

- `Steps`
- `Descriptions`
- `Alert`
- `Typography.Paragraph copyable`
- `Code block` 样式容器
- `Button`
- `Modal`
- `Tabs`

### 关键设计规则

Agent Prompt 中不得显示真实 secret。

运行时密钥复制与 Agent Prompt 导出必须拆开：

```text
Agent Prompt:
  - IAM base URL
  - appkey
  - callback URL 规则
  - OIDC endpoint
  - API docs URL
  - 权限点命名规范
  - IAM_APP_SECRET=<通过 IAM 控制台单独复制>
  - IAM_API_SECRET=<通过 IAM 控制台单独复制>

.env 运行时配置:
  - IAM_APP_KEY=...
  - IAM_APP_SECRET=真实值
  - IAM_API_KEY=...
  - IAM_API_SECRET=真实值
```

### 操作

| 操作 | 规则 |
|---|---|
| 复制 Agent Prompt | 不含真实 secret，允许直接复制 |
| 复制 `.env` 配置 | 含真实 secret，必须二次确认 |
| 轮换密钥 | 二次确认，成功后旧密钥失效 |
| 查看 API 文档 | 新窗口打开 |
| 运行接入检查 | 检查回调地址、API 调用、权限注册状态 |

### Modal：复制运行时密钥

内容：

- 标题：“复制运行时密钥”
- 警告：“以下内容包含 secret。只允许写入运行时环境变量，不得提交到 Git、AGENTS.md、CLAUDE.md、README 或测试日志。”
- 展示 `.env` 格式代码块。
- 操作按钮：“我已理解风险，复制配置”。

成功后写审计，UI 显示：“已复制，并记录审计事件。”

## 11. 页面 7：角色授权

### 页面用途

让平台管理员或应用管理员把“权限组/权限点”授予“飞书组织/用户”。

### 页面结构

```text
PageHeader: 角色授权
SearchForm
Toolbar
Table: 角色列表
Drawer: 新增/编辑角色
Drawer or Split Panel: 配置授权
```

### Filter fields

| 字段 | 控件 |
|---|---|
| 关键词 | `Input` |
| 应用 | `Select`，应用管理员锁定为所属应用 |
| 状态 | `Select` |
| 创建时间 | `DatePicker.RangePicker` |

### Toolbar actions

- 新建角色
- 批量停用
- 刷新

### Table columns

| 列 | 展示 |
|---|---|
| 角色名称 | 名称 + 描述 |
| 所属应用 | 应用名称 |
| 权限数量 | 组/点数量 |
| 授权对象 | 组织数 / 用户数 |
| 状态 | `Tag` |
| 更新时间 | 时间 |
| 操作 | 编辑 / 配置授权 / 停用 |

### Role Drawer fields

| 字段 | 控件 | 校验 |
|---|---|---|
| 所属应用 | `Select` | 必填，应用管理员不可改 |
| 角色名称 | `Input` | 必填 |
| 角色编码 | `Input` | 必填，小写字母数字中划线 |
| 描述 | `Input.TextArea` | 可选 |
| 状态 | `Switch` | 启用 / 停用 |

### 授权配置交互

推荐使用左右结构：

```text
+------------------------------+--------------------------------+
| 左：权限选择                  | 右：授权对象选择                |
| Tree: 权限组 -> 权限点         | TreeSelect: 飞书组织            |
| Checkbox 支持组/点             | Select: 飞书用户                |
+------------------------------+--------------------------------+
| 底部：保存 / 取消 / 最近保存状态                                |
+----------------------------------------------------------------+
```

规则：

- 勾选权限组代表包含该组下全部权限点。
- 勾选单个权限点代表细粒度授权。
- 同时授予组织和用户时，最终权限点去重。
- 保存前显示变更摘要。

### 变更摘要

使用 `Modal`：

- 新增权限：N 个
- 移除权限：N 个
- 新增授权对象：N 个
- 移除授权对象：N 个

按钮：“确认保存授权”。

## 12. 页面 8：组织与用户只读浏览

### 页面用途

查看从飞书同步来的组织和用户投影，辅助授权时确认对象。

v0.1 不在此页面直接编辑飞书组织或用户。

### 页面结构

```text
PageHeader: 组织与用户
Left: Department Tree
Right: User Table
```

### Ant Design 映射

- `Tree`
- `Table`
- `Tag`
- `Descriptions`
- `Drawer`

### User Table columns

| 列 | 展示 |
|---|---|
| 姓名 | 姓名 + 飞书 user_id |
| 部门 | 主部门 |
| 状态 | 在职 / 离职 / 停用 |
| 邮箱 | 可为空 |
| 手机 | 默认遮罩 |
| 最近同步时间 | 时间 |
| 操作 | 查看详情 |

### 用户详情 Drawer

展示：

- 基础信息
- 所属部门
- 飞书状态
- 本地角色绑定摘要
- 最近登录时间
- 最近权限查询时间

## 13. 页面 9：飞书同步中心

### 页面用途

让平台管理员查看同步状态、手动触发同步、理解失败原因。

应用管理员不可见。

### 页面结构

```text
PageHeader: 飞书同步
Status Summary
Toolbar: 手动同步
Table: sync_run 列表
Drawer: sync_run 详情
```

### Status Summary

展示：

- 最近同步状态
- 最近成功同步时间
- 用户数量
- 部门数量
- 最近同步差异：新增 / 更新 / 离职 / 失败

### Table columns

| 列 | 展示 |
|---|---|
| Run ID | 短 ID |
| 触发方式 | 手动 / 定时 |
| 状态 | Running / Succeeded / Failed |
| 开始时间 | 时间 |
| 耗时 | 秒 |
| 用户变化 | 新增 / 更新 / 离职 |
| 部门变化 | 新增 / 更新 |
| 操作人 | 手动同步时展示 |
| 操作 | 查看详情 |

### sync_run 详情 Drawer

展示：

- 基本信息
- 请求批次数
- 成功数量
- 失败数量
- 差异摘要
- 错误信息
- 关联审计日志入口

### 状态设计

| 状态 | 用户看到 |
|---|---|
| Running | 顶部 `Progress`，按钮禁用，文案“同步进行中” |
| Succeeded | 绿色 `Tag`，展示差异摘要 |
| Failed | 红色 `Tag`，展示失败原因和“重试同步” |
| No runs | Empty state：“还没有同步记录”，主按钮“立即同步” |

## 14. 页面 10：审计日志

### 页面用途

回溯管理员操作、用户登录、应用 API 调用、权限查询、同步任务。

### 页面结构

```text
PageHeader: 审计日志
SearchForm
Toolbar
Table
Drawer: 日志详情
```

### Filter fields

| 字段 | 控件 |
|---|---|
| 时间范围 | `DatePicker.RangePicker` |
| 应用 | `Select` |
| 动作类型 | `Select` |
| 操作人 | `Input` / `Select` |
| 结果 | `Select`：成功 / 失败 |
| 关键词 | `Input` |

默认展示时间范围、应用、动作类型、结果。

### Toolbar actions

- 刷新
- 导出当前筛选结果，v0.1 可先 disabled，并标注“后续版本支持”

### Table columns

| 列 | 展示 |
|---|---|
| 时间 | 精确到秒 |
| 动作 | `Tag` + 动作名 |
| 应用 | 应用名称，可为空 |
| 操作人 | 飞书姓名 / 系统 / 应用 API |
| 对象 | 被操作对象 |
| 结果 | 成功 / 失败 |
| IP | 可为空 |
| Request ID | 短 ID |
| 操作 | 查看详情 |

### 日志详情 Drawer

展示：

- 动作类型
- actor
- target
- application
- request ID
- IP / user agent
- 结果
- 错误码
- 脱敏 details JSON

禁止展示：

- appsecret
- API secret
- 飞书 app secret
- tenant access token
- authorization code
- refresh token

## 15. 页面 11：无权限页

### 页面用途

当用户已通过飞书登录，但没有后台访问权限或访问了不可见模块时展示。

### Ant Design 映射

- `Result status="403"`
- `Button`

### 文案

标题：“没有访问权限”

说明：“你已通过飞书身份认证，但当前账号没有访问此页面的 IAM 管理权限。”

操作：

- 返回工作台
- 退出登录

不要显示“联系管理员创建本地账号”这类违背项目边界的文案。

## 16. 页面 12：全局错误页

### 页面用途

处理系统异常、网络异常、后端不可用、飞书配置异常。

### 状态

| 场景 | 用户看到 |
|---|---|
| 后端不可用 | “IAM 服务暂时不可用，请稍后重试” |
| 飞书配置异常 | “飞书应用配置异常，请检查部署环境变量” |
| 网络超时 | “请求超时，请重试” |
| 未知错误 | “发生未知错误”，展示 request ID |

每个错误必须给出下一步动作：重试、返回、查看部署文档、复制 request ID。

## 17. 全局交互状态矩阵

| 功能 | Loading | Empty | Error | Success | Partial |
|---|---|---|---|---|---|
| 应用列表 | Table skeleton | 引导创建应用 | 显示错误和重试 | 列表刷新 | 部分字段为空显示 `-` |
| 创建应用 | 按钮 loading | 不适用 | 表单项内展示 | message + 跳转详情 | 回调地址部分非法时定位字段 |
| 接入向导 | Step 内容 loading | 未注册权限点时给 API 引导 | 复制失败可重试 | 复制成功 + 审计提示 | 接入检查部分通过 |
| 角色授权 | Tree/Table loading | 引导创建角色 | 保存失败保留输入 | 保存成功，刷新摘要 | 部分授权对象失效时提示 |
| 组织用户 | Tree/Table loading | 未同步时引导同步 | 同步数据读取失败 | 不适用 | 用户缺少邮箱/手机时脱敏为空 |
| 同步中心 | Progress | 引导立即同步 | 失败原因 + 重试 | 差异摘要 | run 失败但保留上次成功状态 |
| 审计日志 | Table skeleton | 无审计记录说明原因 | 查询失败 + request ID | 不适用 | details 字段脱敏或部分为空 |

## 18. 用户旅程 Storyboard

### Journey A：平台管理员首次接入 demo 应用

| Step | 用户做什么 | 用户感受 | 原型必须支持 |
|---|---|---|---|
| 1 | 使用飞书登录 | 想确认系统安全可信 | 无密码登录，显示飞书身份来源 |
| 2 | 查看工作台 | 想知道下一步做什么 | 接入闭环 Steps |
| 3 | 手动同步飞书 | 担心同步失败 | 同步进度和失败原因清晰 |
| 4 | 创建应用 | 想快速完成配置 | Drawer 表单，字段少而明确 |
| 5 | 打开接入向导 | 想把信息交给开发人员 | Agent Prompt 和 `.env` 分离 |
| 6 | demo 注册权限点 | 想确认第三方系统真的接入 | 权限注册只读表格自动出现 |
| 7 | 创建角色授权 | 想少出错 | 左权限右组织/用户，保存前摘要 |
| 8 | 查看审计日志 | 想证明过程可回溯 | 审计筛选能找到关键事件 |

### Journey B：应用管理员维护自身应用授权

| Step | 用户做什么 | 用户感受 | 原型必须支持 |
|---|---|---|---|
| 1 | 登录后台 | 只想看到自己的应用 | 导航和数据按所属应用收敛 |
| 2 | 查看应用接入配置 | 想确认开发配置 | 只显示所属应用 |
| 3 | 查看权限注册 | 想知道业务系统声明了哪些权限 | 权限组/点只读清晰 |
| 4 | 调整角色授权 | 想完成授权但不碰全局配置 | 应用范围锁定 |
| 5 | 查看审计 | 想追踪本应用变更 | 审计默认过滤本应用 |

## 19. 反 AI Slop 规则

本项目是 APP UI，不是 landing page。

禁止：

- 大 hero。
- 三列 feature card。
- 紫蓝渐变背景。
- 装饰性图标圆圈。
- 大面积卡片拼贴 Dashboard。
- 居中排版占主导。
- 玻璃拟态。
- 过度圆角。
- “欢迎使用 xxx 一站式平台”这种营销文案。

必须：

- 第一屏直接是工作台或列表，不是宣传页。
- 表格优先，数据可扫读。
- 操作用 Ant Design 标准按钮、Drawer、Modal、Table。
- 页面标题说明当前区域是什么，不做情绪化 slogan。
- 卡片只用于指标、重复项或明确容器，不做装饰。

## 20. 设计系统约束

当前没有 `DESIGN.md`。Pencil 原型应先遵守以下临时约束，后续可沉淀为 `DESIGN.md`。

### 颜色

- Primary：Ant Design blue。
- Success：green。
- Warning：orange。
- Error：red。
- 页面背景：浅灰。
- 内容背景：white。
- 不使用多套高饱和色。

### 字体

- 使用 Ant Design 默认字体栈即可。
- 数字、appkey、API key、权限 code 使用等宽字体。
- 正文字号 14px。
- 表格和表单遵守 Ant Design 默认密度。

### 间距

- 页面 padding：24px。
- 区块间距：16px 或 24px。
- Drawer 内表单字段间距遵守 Ant Design。
- 不做超大留白。

### 圆角

- 使用 Ant Design 默认 token。
- 不要做大圆角卡片风格。

## 21. 响应式与无障碍

### Desktop 1440

- 左侧 Sider 固定。
- 列表页表格完整展示。
- 操作列固定右侧。

### Laptop 1280

- 保持 Sider。
- 表格可横向滚动，但页面整体不能出现无意义横向滚动。
- 次要筛选项收起到高级筛选。

### Tablet 768

- Sider 可折叠。
- Table 保留关键列，次要列可隐藏或通过详情 Drawer 查看。
- Drawer 宽度使用 `min(720px, 100vw)`。

### Mobile 375

v0.1 Admin Console 不以手机高频操作为主，但必须可用：

- Sider 折叠为顶部菜单或抽屉导航。
- 表格转为紧凑列表或只展示关键列。
- 触控目标不小于 44px。
- 表单字段单列。

### Accessibility

- 所有按钮可键盘聚焦。
- `focus-visible` 清晰可见。
- 危险操作需要确认。
- 状态不能只靠颜色表达，必须有文字。
- 表单错误显示在对应字段附近。
- 审计、同步等表格支持键盘 tab 到操作按钮。
- 对话框打开后焦点进入 Modal/Drawer，关闭后返回触发按钮。

## 22. Pencil 输出要求

Pencil 原型需要输出以下内容：

1. 桌面 1440px：全部 v0.1 页面。
2. Laptop 1280px：应用管理、角色授权、应用接入向导。
3. Tablet 768px：应用管理、角色授权、审计日志。
4. 关键 Drawer / Modal：
   - 创建应用 Drawer
   - 应用接入向导
   - 复制运行时密钥 Modal
   - 创建/编辑角色 Drawer
   - 授权变更确认 Modal
   - 同步详情 Drawer
   - 审计详情 Drawer
5. 状态页：
   - Empty
   - Loading
   - Error
   - No permission
   - Sync failed

每个 Pencil 页面必须附带：

- 页面名称
- 页面用途
- Ant Design component mapping
- Table columns
- Filter fields
- Toolbar actions
- Row actions
- Drawer / Modal interactions
- Form fields
- Permission rules
- Loading / Empty / Error states
- Implementation notes

## 23. 未决设计决策

### Decision 1：工作台是否保留

推荐：保留轻量工作台。

理由：v0.1 需要帮助第一次部署者理解“下一步做什么”。但它只能是接入进度页，不是装饰性 Dashboard。

### Decision 2：应用接入向导是独立页面还是 Drawer

推荐：独立页面。

理由：接入向导包含 Steps、Prompt、`.env`、API 文档、检查清单，Drawer 会太挤。

### Decision 3：组织与用户是否作为独立菜单

推荐：v0.1 保留只读独立菜单。

理由：角色授权时需要确认飞书组织/用户投影是否正确。只读浏览能减少误解。

### Decision 4：应用管理员是否看到工作台

推荐：看到应用范围工作台。

理由：应用管理员登录后需要知道自己应用的接入状态、权限注册状态和最近审计，不应该看到全局数据。

## 24. 设计评分

当前设计计划初始评分：4/10。

原因：

- 之前的工程计划定义了功能和架构，但没有定义用户看到的页面层级、状态、权限可见性、响应式行为和 Pencil 输出格式。

补齐本文档后评分：8/10。

仍未到 10/10 的原因：

- 还没有真实 Pencil 视觉稿。
- 还没有 `DESIGN.md` 设计系统基线。
- 还没有对关键页面做视觉 QA。

达到 10/10 需要：

- 基于本文档制作 Pencil 原型。
- 确认 1440 / 1280 / 768 三档布局。
- 把确认后的视觉规则沉淀到 `DESIGN.md`。
- 实现后运行 `/design-review` 做真实浏览器视觉 QA。

## 25. GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | — |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | — | — |
| Eng Review | `/plan-eng-review` | Architecture & tests | 1 | CLEAR | 6 architecture decisions resolved |
| Design Review | `/plan-design-review` | UI/UX gaps | 1 | CLEAR | score: 4/10 -> 8/10, Pencil input created |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | — |

VERDICT：设计计划已具备 Pencil 输入条件。实现前仍需要确认 Pencil 原型。
