# 2026-06-13 线上前端 UI/UX 审计记录

## 审计范围

- 线上地址：`https://feishu-iam.riversoft.com.cn/`
- 审计时间：2026-06-13 13:37-14:08（Asia/Shanghai）
- 审计方式：Product Design `audit` 工作流 + Codex 内置 Browser 截图。
- 登录方式：从首页点击 `飞书登录`，经飞书确认后进入 Feishu IAM 管理后台。
- 登录页截图可能包含一次性二维码和 `state`，未保存入库。

范围更新：后续设计重新确认本项目需要考虑移动端自适应，系统管理也纳入 `v1.0.2` 移动端硬门禁。因此本文中操作审计 390px Tab 溢出的 P0 标注继续有效；公开问题页、应用管理、权限管理、应用详情、角色详情、飞书同步、管理员授权、操作审计和系统信息均需按移动端自适应要求验收。

## 截图证据

| 步骤 | 截图 | 状态 |
|---|---|---|
| 1 | `01-live-home-1440.png` | 1440px 未登录管理后台问题提示页。 |
| 2 | `02-live-home-768.png` | 768px 未登录管理后台问题提示页。 |
| 3 | `03-live-home-390.png` | 390px 未登录管理后台问题提示页。 |
| 4 | `04-oauth-authorize-missing-1440.png` | 1440px OAuth 参数缺失错误页。 |
| 5 | `05-oauth-authorize-missing-390.png` | 390px OAuth 参数缺失错误页。 |
| 6 | `06-legacy-feishu-callback-1440.png` | 旧 `/api/auth/feishu/callback` 兼容入口错误页。 |
| 7 | `07-console-workspace-1440.png` | 1440px 工作台。 |
| 8 | `08-console-applications-1440.png` | 1440px 应用管理列表。 |
| 9 | `09-console-permissions-1440.png` | 1440px 权限管理列表。 |
| 10 | `10b-console-feishu-sync-stable-1440.png` | 1440px 飞书同步稳定态。 |
| 11 | `11-console-admins-1440.png` | 1440px 管理员授权列表。 |
| 12 | `12-console-audit-1440.png` | 1440px 操作审计追踪页。 |
| 13 | `13-console-system-info-1440.png` | 1440px 系统信息页。 |
| 14 | `14-console-app-detail-default-1440.png` | 1440px 应用详情默认 Tab。 |
| 15 | `15-console-app-detail-roles-tab-1440.png` | 1440px 应用详情角色管理 Tab。 |
| 16 | `16-console-app-detail-development-tab-1440.png` | 1440px 应用详情开发信息 Tab。 |
| 17 | `17-console-app-detail-danger-tab-1440.png` | 1440px 应用详情危险操作 Tab。 |
| 18 | `18-console-role-detail-default-1440.png` | 1440px 角色详情总览 Tab。 |
| 19 | `19-console-role-detail-subjects-tab-1440.png` | 1440px 角色详情组织与用户绑定 Tab。 |
| 20 | `20-console-role-detail-groups-tab-1440.png` | 1440px 角色详情权限组绑定 Tab。 |
| 21 | `21-console-role-detail-info-tab-1440.png` | 1440px 角色详情基础信息 Tab。 |
| 22 | `22-console-role-detail-help-tab-1440.png` | 1440px 角色详情操作说明 Tab。 |
| 23 | `23-mobile-workspace-390.png` | 390px 工作台。 |
| 24 | `24-mobile-applications-390.png` | 390px 应用管理列表。 |
| 25 | `25-mobile-app-detail-development-390.png` | 390px 应用详情开发信息 Tab。 |
| 26 | `26-mobile-role-subjects-390.png` | 390px 角色组织与用户绑定 Tab。 |
| 27 | `27-mobile-audit-390.png` | 390px 操作审计追踪页。 |
| 28 | `28-mobile-system-info-390.png` | 390px 系统信息页。 |
| 29 | `29-mobile-nav-sheet-390.png` | 390px 移动端主菜单 Sheet。 |

## 当前优点

- 后台主导航层级清楚，`系统管理` 二级菜单在桌面和移动 Sheet 中都可理解。
- 桌面端工作台、应用管理、权限管理、飞书同步、管理员授权、操作审计、系统信息、应用详情和角色详情均可进入。
- 登录后控制台主要页面 console 未观察到 error / warn 日志。
- 行内详情按钮具备 `aria-label` 和 `title`，比纯图标裸按钮更可靠。
- 飞书同步稳定态已经形成比较完整的运维控制台：组织与用户、同步历史、字段诊断、高级操作分层明确。
- 角色详情移动端已尝试把组织与用户绑定拆为 `待选 / 已选 / 摘要` 分步，方向正确。
- 未登录管理后台页和旧回调入口已经不再展示裸 JSON、框架默认错误或堆栈。

## 主要问题

### P0：390px 应用管理列表表格被压碎

证据：`24-mobile-applications-390.png`。

页面没有形成页面级横向溢出，但表格列在容器内被强行压缩，`app_key` 变成逐字竖排，负责人、更新时间和操作按钮挤在同一行，已经不可扫描。下一版本必须为移动端列表提供专门行卡片、关键列模式或明确横向滚动表格，不能让 DataTable 自然压缩到不可读。

### P0：390px 操作审计 Tab 超出视口

证据：`27-mobile-audit-390.png` 和 DOM 测量。

390px 下 `操作审计` Tablist 宽度约 441px，超出视口，`登录与 Token 记录` 右侧被截断。下一版本应统一处理超过 3-4 项的 Tab：移动端改为横向可滚动并显示滚动提示，或改为 Select / overflow menu。

### P0：OAuth 错误页仍复制整段问题信息

证据：`04-oauth-authorize-missing-1440.png`、`05-oauth-authorize-missing-390.png`、`06-legacy-feishu-callback-1440.png`。

OAuth 错误页仍展示 `问题信息` 和 `复制问题信息`，与当前阶段“request id 精简”和已登记 GitHub issue `#5` 的目标不一致。下一版本应统一为只展示、输入和复制 `request id`，错误摘要只用于用户理解，不作为复制对象。

### P1：应用详情开发信息在移动端过长

证据：`25-mobile-app-detail-development-390.png`。

开发信息 Tab 在 390px 下完整展示回调地址、OAuth credential、Developer credential 和接入提示词，但信息纵向过长，复制按钮、状态块、凭证块和提示词卡片重复堆叠，用户难以快速定位“回调地址 / OAuth / Developer API / 接入提示词”四类任务。下一版本应在移动端增加二级锚点、折叠分组或任务化入口。

### P1：角色组织与用户绑定桌面端右侧摘要压迫主工作区

证据：`19-console-role-detail-subjects-tab-1440.png`。

1440px 下待选区、已选区和变更摘要并列，右侧 sticky 摘要区靠近主工作区。当前数据量少时可用，但组织树、用户和已选主体变多后，会影响选择和复核。下一版本应明确桌面端的工作区比例、摘要折叠策略和底部保存栏边界。

### P1：工作台和系统信息桌面信息密度偏低

证据：`07-console-workspace-1440.png`、`13-console-system-info-1440.png`。

工作台健康态首屏大量空白，系统信息页在桌面端也偏稀疏。它们都可用，但不像正式控制台的运营面板。下一版本可把健康、同步、版本、审计和风险入口做成更紧凑的可扫描面板，减少空卡片和空白区域。

### P1：OAuth 错误页与管理后台问题提示页视觉体系不一致

证据：`01-live-home-1440.png` 对比 `04-oauth-authorize-missing-1440.png`。

管理后台问题提示页有品牌小标题、图标、字段容器和主操作；OAuth 错误页是更基础的白卡结构，缺少统一品牌识别、图标层级、字段定义列表和清晰恢复动作。第三方用户会感觉进入了另一套错误模板。

### P2：操作审计默认追踪页对 request id 认知依赖较强

证据：`12-console-audit-1440.png`、`27-mobile-audit-390.png`。

追踪页文案已经说明优先粘贴 request id，但默认空态没有示例、最近 request id 或从应用详情跳转的上下文提示。对排障人员可用，对低频管理员仍有理解成本。下一版本可以提供“从哪里获得 request id”的短提示和最近查询入口，但不能恢复整段问题信息粘贴。

## 可访问性风险

- 本轮只能从截图和 DOM snapshot 判断，不能声明 WCAG 完整合规。
- OAuth 错误页复制目标仍是“问题信息”，不利于最小信息披露，也可能让支持沟通复制过多上下文。
- 权限管理列表的详情图标按钮有 `aria-label` 和 `title`，但 DOM 文本仍读到“详情”，需要复核视觉隐藏文本是否造成重复朗读。
- 移动端操作审计 Tab 溢出会影响触控和键盘可达性。
- 应用列表 390px 下虽然没有页面级横向溢出，但信息被压缩到不可读，属于响应式可用性失败。
- 需要补测键盘焦点顺序、复制按钮反馈是否会被屏幕阅读器感知、移动端 200% zoom 下长 ID 是否仍可读。

## 验收建议

- 移动端列表：应用管理、权限管理、管理员授权不允许出现逐字竖排、列头错位或操作按钮挤压；应使用移动端行卡片或明确横向滚动策略。
- 移动端 Tab：超过 4 项的 Tab 不得静态撑破视口；必须可滚动、折行或收纳。
- 复杂授权：角色组织与用户绑定在 1440px、768px、390px 下都应明确待选、已选、摘要和保存入口，保存区不得遮挡主选择区。
- 公开问题页：所有 OAuth、后台认证失败、旧回调兼容入口只复制 `request id`。
- 工作台和系统信息：桌面端首屏应更像运营控制台，减少空白，强化健康、同步、版本、审计和风险入口。
