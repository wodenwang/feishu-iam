# feishu-iam v0.1.10 Admin Console 原型设计审阅 R2

日期：2026-05-24
分支：`main`
审阅对象：

- `design/feishu-iam-v0.1.10-frontend-redesign.pen`
- `design/feishu-iam-v0.1.10-frontend-redesign-notes.md`
- `design/implementation-screenshots/v0.1.10-frontend-redesign/*.png`

## 结论

原型总体评分：**9/10**。

上一轮 3 个阻塞项已经解决，可以进入 `/plan-eng-review` 和后续实现计划阶段。

- 生产登录页和本地开发登录页已拆分，生产态不再出现 Mock 入口。
- `1440 / 1280 / 768` 三档 Admin Shell 已统一为 `Breadcrumb -> PageHeader + PrimaryAction -> SearchForm -> Table`。
- 表格已补齐 `loading / empty / error / search-empty` 状态，并保持固定容器和分页占位。
- UserMenu 已把完整 `open_id` 改成截断展示，并补了复制与键盘可访问性说明。
- Logout 已补处理中和失败恢复状态。
- Pencil `snapshot_layout` 检查结果为 `No layout problems.`。

本轮只剩 2 个非阻塞修正建议。它们不影响进入工程评审，但实现时必须按建议处理。

## What Already Exists

- `DESIGN.md` 已存在，明确本项目是企业级 Admin Console，要求表格优先、状态完整、视觉克制。
- v0.1.10 Pencil 源文件已更新，并已导出 14 张关键页面和状态截图。
- `design/feishu-iam-v0.1.10-frontend-redesign-notes.md` 已补充登录态拆分、UserMenu、退出、响应式、表格状态矩阵和抗抖动要求。
- Pencil 变量已包含 `--brand-primary`、`--brand-deep`、`--brand-accent`、`--bg-layout`、`--table-header-bg`、字号、间距和圆角 token。

## Not In Scope

- 第三方 OAuth Demo 闭环：留到 `v0.2.*`。
- username / password 登录体系：项目硬性禁止。
- 营销官网式首页：登录页只负责可信登录和环境识别。
- 复杂动效、插画系统、玻璃拟态、大面积渐变：不符合本项目后台定位。
- 真实通讯录同步体验重设计：不是本轮 Shell / Login 重构范围。

## 评分明细

| 维度 | 评分 | 判断 |
|---|---:|---|
| 信息架构 | 9/10 | Shell、Header、Sider、Content 和主操作层级清楚，三档一致。 |
| 交互状态 | 9/10 | Auth、Logout、Table 关键状态完整，表格占位稳定。 |
| 主路径体验 | 9/10 | 登录、回调、进入后台、用户菜单、退出流程闭环清楚。 |
| AI Slop 风险 | 9/10 | 没有营销化 hero、卡片堆砌或装饰性 dashboard。 |
| 设计系统一致性 | 8/10 | token 方向正确，查询按钮图标和个别状态 Tag 需实现时修正。 |
| 响应式与可访问性 | 9/10 | 768 横向滚动、列优先级、键盘和 ARIA 要求已写入说明。 |
| 未决设计决策 | 10/10 | 进入实现所需设计决策已明确。 |

## Blocking Findings

No blocking findings.

上一轮阻塞项关闭情况：

| 上轮阻塞 | R2 结果 | 证据 |
|---|---|---|
| 生产登录页与 Mock 本地开发态混在一起 | 已解决 | `login-production.png`、`login-local-dev.png` |
| 三档 Admin Shell 工具栏结构不一致 | 已解决 | `admin-shell-1440.png`、`admin-shell-1280.png`、`admin-shell-768.png` |
| 主表格缺少 loading / empty / error / search-empty | 已解决 | `table-loading.png`、`table-empty.png`、`table-error.png`、`table-search-no-results.png` |

## Important Findings

### I1. 查询按钮图标不应使用 `+`

截图：`admin-shell-1440.png`、`admin-shell-1280.png`、`admin-shell-768.png`

问题：查询按钮当前显示 `+ 查询`。这会把“查询”误读为“新增”，和 PageHeader 右侧 `+ 新增应用` 的动作语义冲突。

实现建议：

- 查询按钮使用 `SearchOutlined` 或不带图标。
- `+` 只保留给新增类动作。
- Playwright 截图验收时检查 SearchForm 中没有新增语义图标。

### I2. `停用` 状态 Tag 不建议使用黑底黄字

截图：`admin-shell-1440.png`、`admin-shell-1280.png`、`admin-shell-768.png`

问题：黑底黄字在企业后台里过重，容易被读成严重故障或危险状态。`停用` 应是状态字段，不是告警横幅。

实现建议：

- `启用` 使用 green Tag。
- `停用` 使用 orange / default / gray Tag，优先 Ant Design `Tag color="orange"` 或项目 `StatusTag`。
- `草稿` 使用 default / processing 弱状态。
- 不为普通状态字段引入高对比黑色块。

## Optional Findings

### O1. 生产登录页左侧橙色 logo 底块可在实现时弱化

当前视觉可接受，但橙色块面积比后台其他橙色强调更重。实现时如果读起来偏促销，可以把左侧 logo 底块改为描边或深蓝底白盾牌。

### O2. 顶部同步状态是好设计，但需要接真实状态

`同步正常` 标签有助于运维判断系统状态。实现时如果后端暂时没有同步健康接口，建议先隐藏或显示 `Mock` / `未知`，不要假装真实健康状态。

## 通过标准

进入实现阶段时按以下标准执行：

- `Login Production` 不渲染任何 Mock 入口。
- `Login Local Dev` 仅本地可见，Mock 入口视觉弱于飞书登录。
- `AdminLayout` 使用固定 Header、Sider、Content 尺寸约束。
- `PageHeader` 右侧放主操作按钮，SearchForm 只放查询控件。
- Table 在 data / loading / empty / error / search-empty 状态下容器高度和分页占位稳定。
- 768 下仍使用 Table，允许 horizontal scroll，不改为卡片流。
- UserMenu 支持键盘打开，`open_id` 默认截断，复制完整值。
- Logout 支持确认、处理中、失败重试、成功回登录页。

## Implementation Tasks

Synthesized from this review's findings. Each task derives from a specific finding above.

- [ ] **T1 (P2, human: ~10min / CC: ~5min)** — SearchForm — Replace query button plus icon with search icon
  - Surfaced by: I1 — `+ 查询` conflicts with `+ 新增应用`.
  - Files: `src/components/SearchForm/*`, affected page files if SearchForm is inline.
  - Verify: Playwright screenshots show query button uses search icon or no icon at 1440/1280/768.

- [ ] **T2 (P2, human: ~15min / CC: ~5min)** — StatusTag — Normalize application status tag colors
  - Surfaced by: I2 — black disabled tag is too heavy for a normal status field.
  - Files: `src/components/StatusTag/*`, application table column definitions.
  - Verify: enabled uses green, disabled uses orange/default/gray, draft uses weak default state.

## Completion Summary

```text
+====================================================================+
|         DESIGN PLAN REVIEW — COMPLETION SUMMARY                    |
+====================================================================+
| System Audit         | DESIGN.md exists; UI scope is v0.1.10 shell  |
| Step 0               | R2 prototype includes all required screens    |
| Pass 1  (Info Arch)  | 8/10 -> 9/10 after unified shell hierarchy    |
| Pass 2  (States)     | 7/10 -> 9/10 after table/logout states        |
| Pass 3  (Journey)    | 8/10 -> 9/10 after prod/dev login split       |
| Pass 4  (AI Slop)    | 9/10 -> 9/10, still admin-first               |
| Pass 5  (Design Sys) | 8/10 -> 8/10, two implementation nits remain  |
| Pass 6  (Responsive) | 7/10 -> 9/10 after 768 scroll/a11y rules      |
| Pass 7  (Decisions)  | 3 blocking decisions resolved, 0 deferred     |
+--------------------------------------------------------------------+
| NOT in scope         | written (5 items)                            |
| What already exists  | written                                      |
| TODOS.md updates     | 0 items proposed                             |
| Approved Mockups     | 14 Pencil screenshots reviewed                |
| Decisions made       | 2 implementation tasks synthesized            |
| Decisions deferred   | 0                                             |
| Overall design score | 8/10 -> 9/10                                  |
+====================================================================+
```

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|---|---|---|---:|---|---|
| Design Review | `/plan-design-review` | UI/UX gaps before implementation | 2 | clean | score: 8/10 -> 9/10, 0 unresolved, 2 P2 implementation tasks |

- **UNRESOLVED:** 0.
- **VERDICT:** DESIGN CLEARED — run `/plan-eng-review` next before implementation.

