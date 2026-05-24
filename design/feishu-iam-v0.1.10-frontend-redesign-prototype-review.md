# feishu-iam v0.1.10 Admin Console 原型设计审阅

日期：2026-05-24
分支：`main`
审阅对象：

- `design/feishu-iam-v0.1.10-frontend-redesign.pen`
- `design/feishu-iam-v0.1.10-frontend-redesign-notes.md`
- `design/implementation-screenshots/v0.1.10-frontend-redesign/*.png`

## 结论

原型总体评分：**8/10**。

方向正确：已经从“默认 Ant Design 页面”推进到有品牌识别、稳定 Admin Shell、飞书唯一登录入口、右上角 UserMenu 和退出确认的后台产品形态。视觉上也基本符合 `DESIGN.md` 对企业后台的要求：表格优先、克制、低装饰、Ant Design 可实现。

但还不能无修改直接进入实现。需要先修正 3 个会影响实现一致性的设计问题：

1. 登录页生产态与本地 Mock 态没有拆开，容易让正式系统看起来仍是 demo。
2. `1440 / 1280 / 768` 三档 Admin Shell 的工具栏结构不一致，工程实现会不知道以哪一版为准。
3. 主表格只展示 data state，缺少 loading / empty / error / search-empty 的抗抖动状态，无法支撑“修复页面抖动”的目标。

## What Already Exists

- `DESIGN.md` 已存在，明确项目是企业级 Admin Console，要求表格优先、状态完整、视觉克制。
- v0.1.10 Pencil 源文件已存在，并已导出 8 张关键截图。
- 当前原型已覆盖 Admin Shell、Header UserMenu、原创 logo、飞书登录页、退出确认、登录处理中、登录错误状态和 1440/1280/768 响应式。
- 既有前端已有 `AdminLayout`、`LoginPage`、`theme.ts`、`PermissionGuard`、`SearchForm`、`AppTable`、`FormDrawer` 等可复用基础，不应引入新 UI 框架。

## Not In Scope

- 第三方 OAuth Demo 闭环：留到 `v0.2.*`。
- username / password 登录体系：项目硬性禁止。
- 营销官网式首页：登录页可以品牌化，但不能变成落地页。
- 复杂动效、插画系统、玻璃拟态、大面积渐变：不符合本项目后台定位。
- 真实飞书通讯录同步体验重设计：不是本轮 Shell / Login 重构范围。

## 评分明细

| 维度 | 评分 | 判断 |
|---|---:|---|
| 信息架构 | 8/10 | Shell、Header、Sider、Content 层级清楚，但工具栏位置三档不一致。 |
| 交互状态 | 7/10 | Auth 状态覆盖较好，主表格缺少 loading / empty / error / search-empty。 |
| 主路径体验 | 8/10 | 飞书登录、身份验证、进入后台、退出登录路径可理解。 |
| AI Slop 风险 | 9/10 | 没有卡片堆砌和营销化 hero，后台气质正确。 |
| 设计系统一致性 | 8/10 | token 方向清楚，但生产/开发状态和表格状态还需 token 化。 |
| 响应式与可访问性 | 7/10 | 768 折叠方向正确，但横向滚动、键盘焦点、ARIA 还未落到原型说明。 |
| 未决设计决策 | 7/10 | 大方向已定，仍需明确生产登录态、工具栏 canonical layout、表格状态。 |

## Blocking Findings

### B1. 登录页把生产态和 Mock 开发态混在同一主状态

截图：`login-normal.png`

问题：主登录页同时显示 `Runtime: HTTP • Mock 模式` 和 `Mock 开发登录（仅本地）`。这对本地开发有价值，但对正式部署会削弱可信度，也容易违反“飞书是唯一身份源”的产品边界感。

修改建议：

- Pencil 增加两个登录页状态：`Login Production` 和 `Login Local Dev`。
- `Login Production` 只保留 `使用飞书登录`、部署环境、飞书 OAuth 2.0 runtime 信息。
- `Mock 开发登录（仅本地）` 仅在 `Login Local Dev` 出现，且标注 `DEV ONLY`。
- 实现时必须由环境变量控制，生产构建不渲染 Mock 入口。

### B2. Admin Shell 三个视口的工具栏结构不一致

截图：`admin-shell-1440.png`、`admin-shell-1280.png`、`admin-shell-768.png`

问题：1440 中 `新建应用` 位于筛选区下方工具栏，1280 和 768 中 `新增应用` 更靠近 PageHeader 右侧。两种模式都合理，但不能同时作为实现依据，否则页面切换和响应式断点会产生跳动。

修改建议：

- 选择 canonical layout：`PageHeader` 右侧放主操作按钮，筛选区只放查询控件。
- 三档视口保持同一信息顺序：`Breadcrumb -> PageHeader + PrimaryAction -> SearchForm -> Table`。
- 768 下主操作按钮仍位于 PageHeader 右侧，空间不足时缩为 icon + text 或进入 overflow menu。

### B3. 主表格缺少抗抖动状态原型

截图：当前仅有 data state。

问题：本版本明确要修复页面抖动，但原型没有展示表格 loading、empty、error、search-empty。实现阶段如果只按 data state 写，loading 与错误态仍可能改变容器高度，抖动问题会复发。

修改建议：

- Pencil 补 4 个小状态画板或在说明中补状态矩阵：`Table Loading`、`Table Empty`、`Table Error`、`Search No Results`。
- 明确表格容器 `min-height`、分页区域固定占位、错误态保留表头或使用固定高度 `ErrorState`。
- `ErrorState` 继续展示 `requestId` 和 `Retry`，与历史 QA 习惯一致。

## Important Findings

### I1. UserMenu 展示完整 `ou_...` 有溢出和信息暴露风险

截图：`user-menu-dropdown.png`

建议：默认只显示用户名、主角色、环境。飞书 open_id 放到次级说明中并截断，例如 `ou_f3a1...b8c9`，旁边提供复制按钮或 tooltip。这样既能排障，又不会让菜单第一眼显得像调试面板。

### I2. 768 表格需要明确横向滚动和列裁剪规则

截图：`admin-shell-768.png`

建议：实现说明补充 `scroll.x`、保留列、隐藏列、详情入口。768 下至少保留：应用名称、状态、操作；`App ID` 和创建时间可以保留在横向滚动区域或详情 Drawer。

### I3. 错误状态画板适合说明，不适合直接作为运行时页面

截图：`login-error-states.png`

建议：实现时每次只渲染一个 active error，不要把三个错误卡并排展示给终端用户。三卡并排可以作为设计说明页保留。

### I4. 退出确认需要补 loading 和失败恢复

截图：`logout-confirm.png`

建议：确认按钮点击后进入 loading；API 失败时不应直接吞掉错误，应显示 `message.error` 或 Modal 内错误提示，并允许重试或取消。

### I5. Logo 方向可用，但需要输出工程资产规范

建议：补 `BrandLogo` 尺寸表：Sider 展开、Sider 折叠、Login 大尺寸、favicon。实现优先 SVG，避免只把 Pencil 截图切成位图。

### I6. 可访问性还停留在说明层

建议：在实现计划里加入键盘与 ARIA 验收：UserMenu 可 Tab 打开，退出按钮可键盘触发，登录按钮高度不低于 44px，错误状态不只靠颜色表达。

## Optional Findings

### O1. 1440 页面内容下方留白较大

数据少时留白正常，但建议实现时不要为了填满页面增加装饰卡片。保持表格容器稳定即可。

### O2. 环境标签可以增加 tooltip

顶部 `生产环境` 标签有价值。可选增强：hover 或点击展示当前 base URL、runtime、版本号，避免登录页以外缺少部署识别信息。

### O3. Logo 还可以更有 Feishu 关联

当前盾牌偏 IAM 安全，Feishu 关联主要靠文案。可选增强：在盾牌内加入轻微“连接/门禁”负形，但保持极简，避免复制任何第三方品牌资产。

## 需要修改的原型清单

- [ ] 增加 `Login Production` 与 `Login Local Dev` 两个状态，明确 Mock 入口只在本地出现。
- [ ] 统一三档 Admin Shell 的 canonical layout：主操作按钮固定归属 PageHeader。
- [ ] 补主表格 `loading / empty / error / search-empty` 状态。
- [ ] 修改 UserMenu：open_id 默认截断，提供复制或 tooltip。
- [ ] 在说明中补 768 表格横向滚动、列裁剪和详情可达性规则。
- [ ] 补退出确认 loading / error 恢复说明。
- [ ] 补 `BrandLogo` 工程资产尺寸和 SVG 输出要求。

## Implementation Tasks

Synthesized from this review's findings. Each task derives from a specific finding above.

- [ ] **T1 (P1, human: ~45min / CC: ~10min)** — Design — Split login production and local dev states
  - Surfaced by: B1 — production login must not look like a Mock demo.
  - Files: `design/feishu-iam-v0.1.10-frontend-redesign.pen`, `design/feishu-iam-v0.1.10-frontend-redesign-notes.md`
  - Verify: exported screenshots include separate production and local-dev login states.

- [ ] **T2 (P1, human: ~45min / CC: ~10min)** — Design — Normalize Admin Shell toolbar hierarchy across viewports
  - Surfaced by: B2 — inconsistent primary action placement will create responsive jitter.
  - Files: `design/feishu-iam-v0.1.10-frontend-redesign.pen`, `design/feishu-iam-v0.1.10-frontend-redesign-notes.md`
  - Verify: 1440/1280/768 all use `Breadcrumb -> PageHeader action -> SearchForm -> Table`.

- [ ] **T3 (P1, human: ~1h / CC: ~15min)** — Design — Add table loading, empty, error, and search-empty states
  - Surfaced by: B3 — anti-jitter goal cannot be implemented from data state only.
  - Files: `design/feishu-iam-v0.1.10-frontend-redesign.pen`, `design/feishu-iam-v0.1.10-frontend-redesign-notes.md`
  - Verify: screenshots show stable table container dimensions across all four states.

- [ ] **T4 (P2, human: ~30min / CC: ~10min)** — Design — Tighten UserMenu identity display
  - Surfaced by: I1 — full open_id in the menu is noisy and can overflow.
  - Files: `design/feishu-iam-v0.1.10-frontend-redesign.pen`, `design/feishu-iam-v0.1.10-frontend-redesign-notes.md`
  - Verify: menu shows username, role, environment first; open_id is truncated or secondary.

- [ ] **T5 (P2, human: ~30min / CC: ~10min)** — Design — Add responsive and a11y implementation notes
  - Surfaced by: I2 and I6 — 768 table and keyboard behavior need explicit acceptance rules.
  - Files: `design/feishu-iam-v0.1.10-frontend-redesign-notes.md`
  - Verify: notes include `scroll.x`, retained columns, keyboard access, ARIA labels, and 44px touch target requirements.

## Completion Summary

```text
+====================================================================+
|         DESIGN PLAN REVIEW — COMPLETION SUMMARY                    |
+====================================================================+
| System Audit         | DESIGN.md exists; UI scope is v0.1.10 shell  |
| Step 0               | Prototype exists; review used exported PNGs   |
| Pass 1  (Info Arch)  | 8/10, but toolbar hierarchy must be unified   |
| Pass 2  (States)     | 7/10, table non-data states missing           |
| Pass 3  (Journey)    | 8/10, Feishu-only path is understandable      |
| Pass 4  (AI Slop)    | 9/10, admin UI avoids generic SaaS patterns   |
| Pass 5  (Design Sys) | 8/10, token direction aligns with DESIGN.md   |
| Pass 6  (Responsive) | 7/10, 768 table/a11y rules need detail        |
| Pass 7  (Decisions)  | 3 blocking decisions before implementation    |
+--------------------------------------------------------------------+
| NOT in scope         | written (5 items)                            |
| What already exists  | written                                      |
| TODOS.md updates     | 0 items proposed                             |
| Approved Mockups     | 8 Pencil screenshots reviewed                 |
| Decisions made       | 5 implementation tasks synthesized            |
| Decisions deferred   | 0, but prototype edits required               |
| Overall design score | 8/10                                          |
+====================================================================+
```

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|---|---|---|---:|---|---|
| Design Review | `/plan-design-review` | UI/UX gaps before implementation | 1 | issues_open | score: 8/10, 3 blocking findings, 5 tasks |

- **UNRESOLVED:** 3 blocking prototype edits remain before implementation.
- **VERDICT:** DESIGN NOT CLEARED — update the Pencil prototype and screenshots before `/plan-eng-review`.

