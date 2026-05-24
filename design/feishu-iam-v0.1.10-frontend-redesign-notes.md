# feishu-iam v0.1.10 Admin Console 前端重构原型说明

## 1. 目标范围

本原型用于 `v0.1.10` Admin Console 前端重构，目标是先修复后台基础体验问题，再进入实现阶段：

- 参考 Ant Design Pro 的后台布局模式重构 Admin Shell。
- 修复 Header 右上角区域对齐不稳、页面抖动和用户信息布局松散的问题。
- 参考 JoyBell 官网的深蓝品牌感与橙色强调色，形成适合 Ant Design token 的主题方向。
- 补齐原创 `feishu-iam` logo、飞书登录页、Header UserMenu、退出登录确认流程。
- 覆盖 `1440 / 1280 / 768` 三档响应式状态。

本版本不引入 username / password 登录体系，不做第三方 OAuth Demo 闭环；所有登录入口仍仅允许通过飞书完成。

## 2. 设计产物

| 类型 | 路径 |
|---|---|
| Pencil 源文件 | `design/feishu-iam-v0.1.10-frontend-redesign.pen` |
| Pencil 生成输入 | `design/pencil-input-v0.1.10.md` |
| 关键截图目录 | `design/implementation-screenshots/v0.1.10-frontend-redesign/` |
| 本说明文档 | `design/feishu-iam-v0.1.10-frontend-redesign-notes.md` |

截图清单：

| 页面 / 状态 | 截图 |
|---|---|
| Admin Shell 1440 | `design/implementation-screenshots/v0.1.10-frontend-redesign/admin-shell-1440.png` |
| Admin Shell 1280 | `design/implementation-screenshots/v0.1.10-frontend-redesign/admin-shell-1280.png` |
| Admin Shell 768 | `design/implementation-screenshots/v0.1.10-frontend-redesign/admin-shell-768.png` |
| Header UserMenu | `design/implementation-screenshots/v0.1.10-frontend-redesign/user-menu-dropdown.png` |
| 退出登录确认 | `design/implementation-screenshots/v0.1.10-frontend-redesign/logout-confirm.png` |
| 退出登录处理中 / 失败 | `design/implementation-screenshots/v0.1.10-frontend-redesign/logout-processing-error.png` |
| 生产登录页 | `design/implementation-screenshots/v0.1.10-frontend-redesign/login-production.png` |
| 本地开发登录页 | `design/implementation-screenshots/v0.1.10-frontend-redesign/login-local-dev.png` |
| 登录回调处理中 | `design/implementation-screenshots/v0.1.10-frontend-redesign/login-callback-processing.png` |
| 登录错误状态 | `design/implementation-screenshots/v0.1.10-frontend-redesign/login-error-states.png` |
| 表格加载中 | `design/implementation-screenshots/v0.1.10-frontend-redesign/table-loading.png` |
| 表格空状态 | `design/implementation-screenshots/v0.1.10-frontend-redesign/table-empty.png` |
| 表格错误状态 | `design/implementation-screenshots/v0.1.10-frontend-redesign/table-error.png` |
| 搜索无结果 | `design/implementation-screenshots/v0.1.10-frontend-redesign/table-search-no-results.png` |

## 3. 主题 token 方向

建议在 Ant Design `ConfigProvider` 中集中配置，不要在页面中分散硬编码颜色。

| Token | 建议值 | 用途 |
|---|---:|---|
| `colorPrimary` | `#0f4c81` | 主按钮、选中态、主导航高亮 |
| `colorInfo` | `#1f67b2` | 次级信息、链接、辅助高亮 |
| `colorWarning` | `#f28c28` | 品牌强调线、风险提示、重点标识 |
| `colorBgLayout` | `#eef4f8` | Admin Console 页面背景 |
| `colorTextBase` | `#122230` | 主文本 |
| `colorBorderSecondary` | `#d9e2ec` | 分割线、卡片边界 |
| `borderRadius` | `6` | 保持企业后台克制圆角 |

视觉原则：

- 深蓝负责身份、安全、可信赖感。
- 橙色仅作为强调色，不作为大面积背景色。
- 内容区保持浅灰背景和白色数据容器，便于表格与筛选区长时间使用。
- 采用 Ant Design 默认字号体系和紧凑企业后台密度。

## 4. Logo 方向

原型使用原创盾牌形 `feishu-iam` 标识：

- 盾牌代表身份保护、访问控制、后台安全边界。
- 中心留白和简化线条便于在 Sider、登录页、favicon、移动端 Header 中复用。
- 不复制 JoyBell logo，仅借鉴深蓝品牌气质和橙色强调色。

实现建议：

- 新建 `BrandLogo` 组件，支持 `expanded`、`collapsed`、`login` 三种尺寸。
- Logo 图形优先用可维护的内联 SVG 或静态 SVG 文件实现。
- 文案统一为 `feishu-iam`，副标题使用 `飞书身份与访问管理`。

## 5. 页面与组件映射

| 原型对象 | Ant Design / 项目组件建议 |
|---|---|
| Admin Shell | `Layout`、`Layout.Sider`、`Layout.Header`、`Layout.Content` |
| 左侧导航 | `Menu`，固定宽度 `224px`，折叠宽度 `64px` |
| Header 右侧 | `Space`、`Dropdown`、`Avatar`、`Tag` |
| UserMenu | `Dropdown` menu items + role / environment 信息块 |
| 退出确认 | `Modal.confirm` 或受控 `Modal` |
| 登录页 | 独立 `LoginPage`，只提供飞书登录主按钮 |
| 回调处理中 | `Spin` + 状态文案，禁止刷新跳转式闪烁 |
| 错误状态 | `Result` 或统一 `AuthErrorPanel` |
| 内容列表页 | `PageHeader`、`Form`、`Table`、`Pagination`、`Tag` |

## 6. Admin Shell 结构

实现时建议优先稳定布局尺寸，避免页面抖动：

- Header 高度固定为 `56px`。
- Sider 展开宽度固定为 `224px`，折叠宽度固定为 `64px`。
- Header 右侧 UserMenu 使用固定高度和 `align-items: center`。
- 头像、用户名称、角色、环境标签放在同一水平基线上，不随页面内容加载变化改变高度。
- Content 使用 `min-height: calc(100vh - 56px)`，页面内部加载态只影响内容区，不影响 Shell。
- Table 外层容器固定边界和 padding，查询区、工具栏、表格之间使用稳定的 `16px` 间距。
- 三档视口统一信息顺序：`Breadcrumb -> PageHeader + PrimaryAction -> SearchForm -> Table`。
- `新增应用` 固定属于 PageHeader 右侧；SearchForm 只放查询控件。
- Table container 的 `min-height` 必须在 data / loading / empty / error / search-empty 之间保持稳定，分页区域保留占位。

## 7. 登录与退出流程

登录页：

- `Login Production` 仅保留主入口 `使用飞书登录`，Runtime 使用 `HTTP • 飞书 OAuth 2.0` 等生产可信表达。
- `Login Local Dev` 保持相同布局，但允许弱化显示 `Mock 开发登录（仅本地）`，并标注 `DEV ONLY`。
- `Mock 开发登录` 必须在生产环境隐藏，且不能比 `使用飞书登录` 更突出。
- 页面展示当前部署环境和 Runtime 信息，便于部署排障。
- 不出现 username、password、手机号、验证码等非飞书身份体系入口。
- 登录按钮 touch target 不低于 `44px`。

登录回调处理中：

- 展示稳定处理中状态，不刷新、不跳转闪屏。
- 明确说明正在验证飞书身份。
- 回调失败进入错误状态页，而不是停留空白页。

错误状态：

- 覆盖配置缺失、飞书登录失败、无后台访问权限。
- 每个错误都提供明确恢复动作，例如重新登录或联系超级管理员。

退出登录：

- UserMenu 中点击 `退出登录` 后先弹确认。
- 确认文案强调当前 IAM 管理会话将结束。
- 成功退出后回到飞书登录页。
- 退出过程中按钮应有 loading，避免重复点击。
- API 失败时显示 `退出失败，请重试。`，允许取消或重试；成功后回到 `Login Production`。

UserMenu：

- 第一层优先显示用户名、主角色、当前环境。
- 飞书 `open_id` 放在次级信息区域，并截断显示，例如 `ou_f3a1...b8c9`。
- 可提供复制图标或 tooltip，但不要让长 ID 撑破 Dropdown。
- Dropdown 入口必须支持键盘访问，并带可理解的 ARIA label。

## 8. 响应式要求

| 视口 | 原型状态 | 实现要求 |
|---|---|---|
| 1440 | 展开 Sider + 完整 Header 信息 | 默认桌面布局，最高信息密度 |
| 1280 | 展开 Sider + 收紧内容列宽 | 保持菜单文字完整，表格横向滚动受控 |
| 768 | 折叠 Sider + 精简 Header 信息 | Header 保留环境和头像，表格允许横向滚动 |

移动 / 平板约束：

- `768px` 下左侧菜单默认折叠为图标模式。
- Header 中隐藏次要用户描述，仅保留环境标识和头像入口。
- 不把核心表格改为卡片流；后台数据页仍以 Table 为主，必要时启用横向滚动。
- `768px` 表格使用 horizontal scroll，优先保留列为：应用名称、状态、操作。
- `App ID`、创建时间等列可通过横向滚动或详情 Drawer 查看。

## 9. 表格状态矩阵

| 状态 | 原型画板 | 实现要求 |
|---|---|---|
| Data | `Admin Shell 1440 / 1280 / 768` | 正常数据表格，主操作在 PageHeader 右侧 |
| Loading | `Table Loading` | 保留 Shell、Breadcrumb、PageHeader、SearchForm、Table header；body 使用 Skeleton rows；分页占位稳定 |
| Empty | `Table Empty` | 保留 Table header 和固定容器高度；文案 `暂无应用`；提供 `新增应用` |
| Error | `Table Error` | ErrorState 包含错误说明、Request ID、重试按钮；错误不只靠颜色表达 |
| Search Empty | `Search No Results` | 保留当前搜索条件；文案 `没有匹配的应用`；提供 `重置筛选`，不把新增应用作为唯一恢复动作 |

## 10. 实现优先级

阻塞项：

- 创建稳定 `AdminLayout`，解决 Header 右上角不对齐和页面抖动。
- 创建 `BrandLogo`，替换当前文字 logo。
- 创建 `LoginPage`，只提供飞书登录主路径。
- 创建 `UserMenu` 与退出登录确认流程。

重要项：

- 将主题 token 集中到前端 theme 配置。
- 抽象 Shell 内稳定尺寸变量，避免页面局部状态影响全局布局。
- 登录、回调、错误、无权限、退出中状态都要有可见反馈。

可选项：

- 后续为 logo 输出单独 SVG 资产和 favicon。
- 后续在更多业务页逐步统一 PageHeader、SearchForm、Table、Drawer 的密度与间距。

## 11. 原型检查记录

- Pencil 源文件已保存到 `design/feishu-iam-v0.1.10-frontend-redesign.pen`。
- 已导出 14 张关键页面和状态截图到 `design/implementation-screenshots/v0.1.10-frontend-redesign/`。
- 使用 Pencil `snapshot_layout` 检查文档，结果为 `No layout problems.`。
- Pencil 文件内存在生成过程留下的非活动重复节点；本次说明和截图均以活动画板为准。
