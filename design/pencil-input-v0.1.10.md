# feishu-iam v0.1.10 Admin Console 前端重构 Pencil 输入

## 目标

为 `feishu-iam v0.1.10` 产出 Ant Design 风格 Admin Console 原型。本版本只做前端重构、品牌化、登录页、退出登录和布局稳定性修复，不进入第三方 OAuth Demo 闭环。

## 产品边界

- 飞书是唯一身份源。
- 不出现 username / password 登录框。
- 登录主路径只能是“使用飞书登录”。
- 本地 mock 登录只作为开发环境次要入口。
- 不复制 JoyBell logo，只参考 JoyBell 的企业蓝色气质和橙色强调。
- UI 是企业后台，不是营销官网。

## 主题方向

参考 JoyBell 公开站点主题色，形成原创 `feishu-iam` 风格：

- 主品牌蓝：`#0f4c81`
- 深品牌蓝：`#0b2e4f`
- 信息蓝：`#1f67b2`
- 强调橙：`#f28c28`
- 页面背景：`#eef4f8`
- 正文深色：`#122230`
- 卡片/表面：`#ffffff`
- 表格头背景：`#f6f9fb`

Ant Design token 方向：

```ts
colorPrimary: '#0f4c81'
colorInfo: '#1f67b2'
colorWarning: '#f28c28'
colorBgLayout: '#eef4f8'
colorTextBase: '#122230'
borderRadius: 6
fontSize: 14
```

## 原创 Logo 方向

设计一个原创 `feishu-iam` 标识，不使用 JoyBell 图形或“金”字。

建议：

- 图形元素表达“飞书身份 + IAM 权限网关”。
- 可以使用抽象盾牌、节点、权限网关、字母 `fi` 的组合。
- 后台 Sider 使用紧凑横向 logo。
- 登录页使用完整横向 logo。
- Logo 必须适合 32px、40px、56px 高度场景。

## 画板要求

产出一个 `.pen` 文件，包含以下画板或页面：

1. `Admin Shell 1440`
   - 1440px desktop。
   - 左侧 Sider 224px，白底，56px logo 区。
   - Header 56px，白底，右侧 Avatar + 用户名 + 角色 Tag + Dropdown trigger。
   - 内容区 24px padding，浅蓝灰背景。
   - 当前页面使用 `/applications` 表格页作为示例。
   - 表格固定操作列，展示 loading/data 稳定容器思路。

2. `Admin Shell 1280`
   - 1280px laptop。
   - 与 desktop 同结构，但右上角隐藏 feishu user id，仅在 dropdown 中展示。
   - 内容区不抖动，表格横向滚动可见。

3. `Admin Shell 768`
   - 768px tablet。
   - Sider collapsed 或 Drawer 化，二选一但必须明确。
   - Header 右侧只显示 Avatar + Dropdown。
   - 角色、feishu user id、退出登录放入 Dropdown。
   - 内容 padding 16px。

4. `User Menu Dropdown`
   - 展示右上角下拉打开态。
   - 包含用户头像、显示名、feishu user id、角色、当前环境、退出登录。
   - 退出登录是危险操作但不要过度吓人。

5. `Logout Confirm`
   - 展示退出登录确认 Popconfirm 或 Modal。
   - 文案说明将结束当前 IAM session，重新进入需要再次通过飞书登录。

6. `Login Normal`
   - 登录页正式状态。
   - 左侧品牌面板：原创 logo、产品名、飞书唯一身份源说明、部署/环境信息。
   - 右侧登录卡片：使用飞书登录主按钮、当前部署 URL、HTTP runtime 标记。
   - 不出现用户名、密码、验证码等本地账号元素。
   - 开发 mock 登录作为次要入口，弱化展示。

7. `Login Callback Processing`
   - 飞书回调处理中。
   - 固定布局，不闪白，不改变卡片尺寸。
   - 显示“正在验证飞书身份”。

8. `Login Error States`
   - 至少展示配置缺失、飞书登录失败、无后台访问权限三类错误。
   - 错误状态保留重新登录主动作。
   - 不泄露 secret、token、App Secret。

## Admin Shell 信息架构

```text
AdminShell
├── Sider 224px fixed
│   ├── BrandLogo 56px high
│   └── Menu fixed item height
└── Main
    ├── Header 56px fixed
    │   ├── Left: page context / environment tag
    │   └── Right: avatar + username + role + dropdown
    └── Content
        ├── Breadcrumb 32px area
        └── Page content 24px padding
```

## Login 信息架构

```text
LoginShell
├── Left panel: brand, product promise, Feishu-only identity statement
└── Right panel: login card
    ├── BrandLogo
    ├── 使用飞书登录 primary button
    ├── deployment/runtime info
    ├── error/callback state
    └── dev-only mock entry
```

## 状态要求

| Feature | Loading | Empty | Error | Success | Partial |
|---|---|---|---|---|---|
| AdminLayout session | 固定全屏骨架，不改变 Header/Sider 宽度 | 不适用 | Alert + 重新登录 | 显示 Shell | 会话过期但路由保留 |
| Header user menu | Avatar skeleton | 不适用 | 隐藏敏感信息，只保留重试/登录 | 用户名 + 角色 + 下拉 | 长用户名省略 |
| Login page | Callback processing panel | 不适用 | config/auth/access 状态卡 | 飞书登录入口 | DEV mock 入口弱化 |
| Logout | 按钮 loading | 不适用 | message + 不清除页面 | 清 cookie 后跳 `/login` | API 失败仍允许本地跳转需评估 |
| Main tables | 表格骨架或固定高度 Spin | EmptyState + primary action | ErrorState + requestId + Retry | 数据表格 | search empty |

## 响应式规则

| Viewport | Shell behavior | Header right behavior | Content behavior |
|---|---|---|---|
| 1440 | 224px Sider，56px Header | Avatar + username + role + dropdown | 24px padding，表格可横向滚动 |
| 1280 | 同 1440 | feishu user id 不直接展示，放入 dropdown | 24px padding |
| 768 | Sider collapsed 或 drawer 化 | 只显示 Avatar + dropdown，角色放下拉 | 16px padding，表格固定 `scroll.x` |

## 视觉约束

- 企业后台，密度适中，信息清晰。
- 使用 Ant Design 组件语言：Layout、Menu、Breadcrumb、Table、Tag、Avatar、Dropdown、Modal/Popconfirm、Button、Alert、Spin。
- 避免大面积渐变、玻璃拟态、装饰性图标圆圈、三栏营销卡片。
- 卡片只用于登录面板、错误状态或必要的独立信息块。
- 表格页不要做卡片网格。
- body text 对比度不低于 4.5:1。
- 按钮触控高度不低于 44px。

## 导出要求

- 保存 `.pen` 源文件：`design/feishu-iam-v0.1.10-frontend-redesign.pen`
- 导出关键截图到：`design/implementation-screenshots/v0.1.10-frontend-redesign/`
- 至少导出：
  - Admin Shell 1440
  - Admin Shell 1280
  - Admin Shell 768
  - User Menu Dropdown
  - Logout Confirm
  - Login Normal
  - Login Callback Processing
  - Login Error States
