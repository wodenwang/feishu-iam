# Feishu IAM v0.15.0 Org Tree Selector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 发布 `v0.15.0`，收口 GitLab issue `#19/#20/#24`：飞书同步页组织浏览下钻化，角色授权支持组织/用户主体选择器，应用详情角色管理操作列稳定化。

**Architecture:** 不新增 DDL，复用本地飞书镜像表和 `iam_role_subjects`。后端扩展应用级飞书候选接口和角色主体保存 parser；前端新增项目内 `OrgBrowser` / `OrgUserSelector` 封装，分别接入飞书同步页和角色详情页。#24 在应用详情角色管理 Tab 内独立修复，不与组织选择器耦合。

**Tech Stack:** NestJS + Prisma + PostgreSQL；React + Vite + shadcn/ui 风格组件 + Tailwind；Vitest、Testing Library、Playwright responsive checks、Docker Compose。

---

## 文件结构

- Modify: `apps/api/src/admin/admin-permission.controller.ts`
  - 扩展应用级飞书用户/部门候选接口，补分页、父级/部门过滤、状态字段。
  - `PUT .../subjects` 接受 `org_subjects` / `user_subjects`，兼容 legacy `subjects`。
- Modify: `apps/api/src/permission/iam-role.service.ts`
  - 批量检查主体存在性，保留 orphaned 语义。
- Test: `apps/api/test/iam-role.service.spec.ts`
  - 覆盖主体保存和 orphaned 语义。
- Create: `apps/admin-web/src/features/org-browser/org-browser.tsx`
  - 组织下钻、搜索、空态、无权限、错误隔离、加载更多。
- Create: `apps/admin-web/src/features/org-browser/org-user-selector.tsx`
  - 组织/用户主体草稿、已选、摘要、保存中、保存失败、390px 三步面板。
- Create: `apps/admin-web/src/features/org-browser/org-browser-types.ts`
  - 共享节点、选择、摘要类型和工具函数。
- Modify: `apps/admin-web/src/api/feishu.ts`
  - 补应用级分页查询函数和候选字段类型。
- Modify: `apps/admin-web/src/api/permission.ts`
  - `replaceIamRoleSubjects` 改用 `org_subjects` / `user_subjects` payload。
- Modify: `apps/admin-web/src/features/settings/SystemSettingsView.tsx`
  - `mode="feishu"` 移除重复内部 IA，接入只读 `OrgBrowser`，保留健康摘要、字段诊断、同步历史和危险区全量同步。
- Modify: `apps/admin-web/src/features/permissions/PermissionRoleDetailSheet.tsx`
  - `subjects` Tab 改用 `OrgUserSelector`，移除旧三列分散搜索和 `min-w-[760px]` 主流程。
- Modify: `apps/admin-web/src/features/applications/ApplicationDetailPage.tsx` 或其角色管理子组件所在文件
  - #24：停用角色补确认、tooltip/aria label 和稳定操作列。
- Test: `apps/admin-web/src/features/settings/SystemSettingsView.test.tsx`
- Test: `apps/admin-web/src/features/permissions/PermissionManagementView.test.tsx`
- Test: `apps/admin-web/src/features/applications/ApplicationManagementView.test.tsx`
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Modify: `AGENTS.md`
- Add: `docs/codex-sessions/YYYY-MM-DD-HHMM-v0.15.0组织树选择器发布.md`

## Task 1: 后端 API 契约和主体保存语义

**Files:**
- Modify: `apps/api/src/admin/admin-permission.controller.ts`
- Modify: `apps/api/src/permission/iam-role.service.ts`
- Test: `apps/api/test/iam-role.service.spec.ts`

- [ ] **Step 1: 写 API payload parser 测试**

覆盖新 payload：

```json
{
  "org_subjects": ["od-sales"],
  "user_subjects": ["ou_1"]
}
```

期望映射为：

```ts
[
  { type: "feishu_department", id: "od-sales" },
  { type: "feishu_user", id: "ou_1" },
]
```

同时保留 legacy `{ subjects: [...] }`，重复主体返回 `IAM_ROLE_SUBJECT_DUPLICATED`。

- [ ] **Step 2: 扩展 `readRoleSubjects`**

在 `AdminPermissionController.replaceRoleSubjects()` 中读取整个 body。优先解析 `org_subjects` / `user_subjects`；如果二者都不存在，再解析 legacy `subjects`。

- [ ] **Step 3: 扩展应用级候选接口**

`GET /:appKey/feishu/departments` 支持：

```text
keyword
parent_department_id
page
page_size
```

`GET /:appKey/feishu/users` 支持：

```text
keyword
department_id
page
page_size
```

响应返回 `{ items, page, pageSize, total }`，并补 `parentDepartmentId`、`isDeleted`、`isActive`。

- [ ] **Step 4: 批量检查主体存在性**

把 `IamRoleService.replaceRoleSubjects()` 中逐个 `subjectExists()` 改为一次查用户、一次查部门，仍然对不存在或已删除主体设置 `isOrphaned: true`。

- [ ] **Step 5: 运行后端定向测试**

```bash
pnpm --filter @feishu-iam/api test -- test/iam-role.service.spec.ts test/feishu-mirror-query.service.spec.ts
```

Expected: PASS。

## Task 2: 前端 API 类型和共享组织浏览模型

**Files:**
- Modify: `apps/admin-web/src/api/feishu.ts`
- Modify: `apps/admin-web/src/api/permission.ts`
- Create: `apps/admin-web/src/features/org-browser/org-browser-types.ts`

- [ ] **Step 1: 定义共享类型**

定义 `OrgBrowserDepartmentNode`、`OrgBrowserUserNode`、`OrgBrowserSelection`、`OrgBrowserSummary`，工具函数 `toRoleSubjects()`、`splitRoleSubjects()`、`buildSelectionSummary()`。

- [ ] **Step 2: 扩展飞书 API 函数**

新增 `fetchApplicationFeishuUsers()` 和 `fetchApplicationFeishuDepartments()`，支持分页、父级/部门过滤。

- [ ] **Step 3: 调整角色主体保存函数**

`replaceIamRoleSubjects(appKey, roleId, selection)` 发送：

```json
{
  "org_subjects": ["od-sales"],
  "user_subjects": ["ou_1"]
}
```

保留 `IamRoleSubject` 类型用于 role response normalize。

## Task 3: `OrgBrowser` 只读组织浏览器

**Files:**
- Create: `apps/admin-web/src/features/org-browser/org-browser.tsx`
- Test through: `apps/admin-web/src/features/settings/SystemSettingsView.test.tsx`

- [ ] **Step 1: 实现桌面下钻模型**

组件 props：

```ts
type OrgBrowserProps = {
  title: string;
  description?: string;
  loadDepartments(input: { keyword?: string; parentDepartmentId?: string; page: number; pageSize: number }): Promise<PageResult<Department>>;
  loadUsers(input: { keyword?: string; departmentId?: string; page: number; pageSize: number }): Promise<PageResult<User>>;
  onSelectDepartment?(departmentId: string): void;
  onSelectUser?(userId: string): void;
  readonly?: boolean;
};
```

- [ ] **Step 2: 实现状态**

覆盖 loading、empty、search empty、error、forbidden 文案。错误卡片只替换当前列表，不清空右侧详情或外部草稿。

- [ ] **Step 3: 实现加载更多**

当 `items.length < total` 时显示“加载更多”，不得依赖部门详情接口 50 条截断。

## Task 4: 飞书同步页接入组织浏览器

**Files:**
- Modify: `apps/admin-web/src/features/settings/SystemSettingsView.tsx`
- Test: `apps/admin-web/src/features/settings/SystemSettingsView.test.tsx`

- [ ] **Step 1: 移除 Feishu mode 内部重复 IA**

`mode="feishu"` 不再渲染系统设置内部 aside；保留页面标题、健康摘要、组织用户浏览、字段诊断和同步历史。

- [ ] **Step 2: 替换旧组织/用户列表**

把旧镜像查询列表替换为只读 `OrgBrowser`。用户或部门点击后仍使用现有详情面板和轻量同步动作。

- [ ] **Step 3: 保留全量同步危险区**

顶部只保留刷新诊断、同步用户等轻量操作；全量同步继续在高级/危险区并保留强确认。

- [ ] **Step 4: 更新测试**

覆盖重复 IA 消失、组织浏览出现、全量同步不在主操作区、字段诊断/同步历史仍可见。

## Task 5: `OrgUserSelector` 和角色绑定页

**Files:**
- Create: `apps/admin-web/src/features/org-browser/org-user-selector.tsx`
- Modify: `apps/admin-web/src/features/permissions/PermissionRoleDetailSheet.tsx`
- Test: `apps/admin-web/src/features/permissions/PermissionManagementView.test.tsx`

- [ ] **Step 1: 实现桌面双栏**

左侧待选组织/用户浏览，右侧已选组织/用户分组、移除按钮、选择语义说明、差异摘要。

- [ ] **Step 2: 实现 390px 三步面板**

窄屏使用“待选 / 已选 / 摘要”Tabs 或 segmented control，底部保存区稳定。

- [ ] **Step 3: 实现保存状态**

保存中禁用按钮；保存失败显示错误但保留草稿；保存成功刷新 role subjects。

- [ ] **Step 4: 明确选择语义**

UI 文案必须说明：部门主体不等于展开保存全部用户；用户可单独选择；重复覆盖只影响展示和摘要，不重复保存。

- [ ] **Step 5: 替换角色详情 subjects Tab**

移除旧三列候选搜索和 `min-w-[760px]` 主流程，接入 `OrgUserSelector`。

## Task 6: #24 应用详情角色管理操作列

**Files:**
- Modify: `apps/admin-web/src/features/applications/ApplicationDetailPage.tsx`
- Modify if needed: `apps/admin-web/src/features/applications/ApplicationManagementView.tsx`
- Test: `apps/admin-web/src/features/applications/ApplicationManagementView.test.tsx`

- [ ] **Step 1: 固定操作列**

保持 `132px` 或更合适的固定宽度，按钮不换行、不变形。

- [ ] **Step 2: 停用角色确认**

停用角色必须用 `AlertDialog`，说明停用后不再参与授权计算并写入审计。

- [ ] **Step 3: 补 tooltip / aria label**

查看、编辑、启用、停用都要有 `aria-label`，图标按钮有 tooltip。

- [ ] **Step 4: 更新测试**

覆盖停用确认、tooltip/aria label 和操作列宽度。

## Task 7: 验证、文档、版本和发布收口

**Files:**
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Modify: `AGENTS.md`
- Add: `docs/codex-sessions/YYYY-MM-DD-HHMM-v0.15.0组织树选择器发布.md`

- [ ] **Step 1: 运行自动化验证**

```bash
pnpm --filter @feishu-iam/api test -- test/iam-role.service.spec.ts test/feishu-mirror-query.service.spec.ts
pnpm --filter @feishu-iam/admin-web test -- src/features/settings/SystemSettingsView.test.tsx src/features/permissions/PermissionManagementView.test.tsx src/features/applications/ApplicationManagementView.test.tsx
pnpm --filter @feishu-iam/admin-web build
pnpm check
```

- [ ] **Step 2: Browser / responsive 自检**

启动本地服务，使用 Browser 或 Playwright 覆盖桌面和 390px：

```bash
pnpm --filter @feishu-iam/admin-web test:responsive
```

- [ ] **Step 3: 设计 review / QA / prelanding review**

对实现界面做 design-review、qa、review；发现问题则修复并重跑。

- [ ] **Step 4: 更新版本材料**

README、CHANGELOG、AGENTS 当前阶段和会话归档更新到 `v0.15.0`。确认 #21 仍排除。

- [ ] **Step 5: GitLab / release / deploy**

提交、push、创建/合并 MR、创建 tag/release，构建并推送 Docker 镜像，升级 `192.168.2.112:~/feishu-iam`，最终检查 `/health`、`/ready`、`/version` 和管理后台主路径。

## 完成标准

- #19：飞书同步页没有重复内部 IA；组织/用户浏览首屏为下钻组织浏览器；健康摘要、字段诊断、同步历史和危险区全量同步保留。
- #20：角色绑定页使用 `OrgUserSelector`；桌面双栏可用；390px 待选/已选/摘要完整；保存 payload 语义区分 `org_subjects` 和 `user_subjects`。
- #24：应用详情角色管理操作列稳定；停用有确认；tooltip/aria label 完整。
- 无新增 DDL；#21 明确排除到后续小版本。
- 自动化测试、构建、响应式检查、Browser 自检、design-review、qa、review 均有新鲜证据。
- GitLab MR/tag/release、Docker 镜像和 `192.168.2.112` 部署验证闭环。
