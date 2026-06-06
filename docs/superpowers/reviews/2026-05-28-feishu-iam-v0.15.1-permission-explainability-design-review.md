# Feishu IAM v0.15.1 权限可解释性与后台操作一致性设计评审

日期：2026-05-28
状态：通过，允许进入工程评审和实施计划

## 评审方式说明

本轮按 `my-harness-next-action` 要求位于 brainstorming 之后，原则上应执行 gstack `/plan-design-review`。当前 Codex 环境没有该技能要求的 AskUserQuestion 交互工具，因此采用项目内可审计降级：基于规格、`DESIGN.md`、现有代码和 GitLab issue 内容完成设计评审，并把结论写入本文。

## 输入

- `docs/superpowers/specs/2026-05-28-feishu-iam-v0.15.1-permission-explainability.md`
- `DESIGN.md`
- `AGENTS.md`
- GitLab issue `#21/#25`
- 用户新增反馈：应用详情 `角色管理` 列表停用按钮变形，需要统一成图标形式。
- 现有代码：
  - `apps/admin-web/src/features/permissions/PermissionRoleDetailSheet.tsx`
  - `apps/admin-web/src/features/applications/ApplicationDetailSheet.tsx`
  - `apps/admin-web/src/components/admin/AppShell.tsx`

## 设计完整度评分

初始评分：`7/10`。

规格已明确目标、范围、排除项、状态和验收，但仍需要把三个界面决策锁死，避免实现时自由发挥：

1. 角色详情的最终权限点应该放在现有 `权限组绑定` Tab 内，而不是新增一级 Tab。
2. 权限组内权限点查看应优先使用列表内展开详情，不引入新的抽屉或嵌套弹窗。
3. 应用详情角色管理启停用必须变成图标按钮，并复用管理员授权列表的 `Power / PowerOff` 语义。

补齐上述决策后，最终评分：`9/10`。剩余 1 分来自未做视觉 mockup；本轮改动以后台数据表和现有组件为主，按现有 shadcn/tweakcn 模式实现即可。

## 信息架构

`v0.15.1` 不新增独立页面，不改变左侧导航结构。主信息架构如下：

```text
权限管理
└── 角色详情
    ├── 总览
    ├── 组织与用户绑定
    ├── 权限组绑定
    │   ├── 可选权限组列表
    │   │   └── 单个权限组内权限点展开查看
    │   ├── 绑定结果预览
    │   └── 最终权限点一览与搜索
    ├── 基础信息
    └── 操作说明

应用管理
└── 应用详情
    └── 角色管理
        └── 角色列表操作列：查看 / 编辑 / 启用或停用图标按钮
```

决策：

- 最终权限点一览放在 `权限组绑定` Tab 的右侧或下方，和权限组选择同屏可见。管理员修改权限组时，可以立即理解最终权限变化。
- 不新增 `最终权限点` 一级 Tab。新增 Tab 会把原因和结果拆开，增加跳转成本。
- 权限组内权限点查看采用权限组列表内展开区域。它是核对动作，不是独立管理流程。

## 状态覆盖

| 区域 | 加载 | 空状态 | 错误 | 成功 | 部分状态 |
| --- | --- | --- | --- | --- | --- |
| 权限组内权限点 | 跟随权限组列表加载 | 展示“该权限组暂无权限点” | 权限组接口失败时展示既有错误 | 展示 key、名称、状态、描述 | 禁用权限点用 muted 状态 |
| 最终权限点一览 | 跟随角色详情加载 | 展示“当前角色暂无最终权限点” | 角色详情失败时展示既有错误 | 展示聚合后的权限点和来源 | 搜索无结果展示中文空态 |
| 左侧导航 hover | 不适用 | 不适用 | 不适用 | hover/active/focus-visible 行宽一致 | 收缩态保持 tooltip |
| 应用详情角色操作 | 不适用 | 角色空态沿用现有 | 启停失败沿用确认弹窗错误 | 图标按钮稳定展示 | 只读时禁用按钮 |

## 交互要求

- 权限组列表的每一项增加 `查看权限点` 图标或小按钮，展开后展示组内权限点。
- 展开区域最多展示当前权限组全部权限点；当前版本不新增组内分页。
- 最终权限点搜索输入固定在最终权限点列表顶部，支持 key、名称和来源权限组名称匹配。
- 来源展示使用短标签：`直接绑定`、`权限组`、`直接 + 权限组`。
- 多个来源权限组用可换行短文本展示，不允许撑破表格。
- 应用详情角色管理启停用按钮不显示文字，只保留图标、`aria-label`、`title` 和确认弹窗。

## 响应式与可访问性

- 390px 下，权限组列表、最终权限点一览上下堆叠。
- 搜索框宽度为容器宽度，不和按钮挤在一行。
- 权限点 key 使用 `break-all` 或截断加 `title`，不能撑破表格。
- 图标按钮触达尺寸保持 `h-8 w-8`，可访问名称包含角色 key。
- 导航普通一级菜单和分组父级都使用整行可点击区域，focus-visible 背景宽度与 hover 一致。

## 不在本轮设计范围

- 不做权限点 CRUD 新入口。
- 不做权限组树形勾选。
- 不改变权限判定语义。
- 不做全局表格操作列重构。
- 不新增营销式视觉或 dashboard 卡片布局。

## Implementation Tasks

- [ ] **T1 (P1, human: ~2h / CC: ~20min)** — 权限组绑定 Tab — 把最终权限点一览放入权限组绑定主流程。
  - Surfaced by: 信息架构 — 原因和结果必须同屏核对。
  - Files: `apps/admin-web/src/features/permissions/PermissionRoleDetailSheet.tsx`
  - Verify: `pnpm --filter @feishu-iam/admin-web test -- src/features/permissions/PermissionManagementView.test.tsx`
- [ ] **T2 (P1, human: ~1h / CC: ~15min)** — 应用详情角色操作列 — 启停用统一成图标按钮。
  - Surfaced by: 交互要求 — 文字按钮会在窄操作列中变形。
  - Files: `apps/admin-web/src/features/applications/ApplicationDetailSheet.tsx`
  - Verify: `pnpm --filter @feishu-iam/admin-web test -- src/features/applications/ApplicationManagementView.test.tsx`
- [ ] **T3 (P2, human: ~45min / CC: ~10min)** — 左侧导航 — 统一一级菜单和分组父级 hover 行宽。
  - Surfaced by: 响应式与可访问性 — 普通一级菜单不能只包裹文字和图标。
  - Files: `apps/admin-web/src/components/admin/AppShell.tsx`
  - Verify: `pnpm --filter @feishu-iam/admin-web test -- src/App.test.tsx`

## 结论

设计门禁通过。下一步进入工程评审，重点确认后端是否通过最小响应扩展返回权限组内权限点和直接权限点绑定，避免前端多次请求或新增 DDL。
