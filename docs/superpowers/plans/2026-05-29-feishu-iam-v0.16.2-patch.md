# Feishu IAM v0.16.2 Patch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复 GitLab issue `#36/#37/#38`，完成 `v0.16.2` 补丁版本的组织用户选择器、按钮治理和 request id 排障交互收敛。

**Architecture:** 复用现有 `OrgBrowser`、应用内飞书候选接口、应用管理列表和操作审计追踪页。顶层组织语义仍由前端用 `null` 表达，经 API 编码为 `__root__`，后端集中兼容 `parent_department_id = '0'` 与 `null`；顶层无关键词时前端不再加载全量用户第一页。

**Tech Stack:** NestJS、React + Vite、Vitest、Testing Library、Prisma、Docker Compose。

---

## File Structure

- Modify: `apps/admin-web/src/features/org-browser/org-browser.tsx`
  - 在顶层无关键词时跳过用户候选请求并返回空分页；保留下钻和搜索用户行为。
- Modify: `apps/api/src/admin/admin-permission.controller.ts`
  - 应用内飞书部门候选接口把 `__root__` 转换为根级组织查询，兼容 `parentDepartmentId = '0'` 和 `null`。
- Modify: `apps/admin-web/src/features/applications/ApplicationManagementView.tsx`
  - 应用管理列表详情操作改为纯 `Eye` icon 按钮。
- Modify: `apps/admin-web/src/components/admin/ProblemFeedbackPage.tsx`
  - 删除整段问题信息构造和复制，只保留复制 request id。
- Modify: `apps/admin-web/src/features/records/RecordQueryView.tsx`
  - 删除“粘贴问题信息 / 提取 request id”区域。
- Modify: `apps/admin-web/src/features/records/TraceResultPanel.tsx`
  - 删除“复制问题信息”按钮，保留 `CopyField` 的 request id 复制。
- Modify: `apps/admin-web/src/features/records/trace-format.ts`
  - 删除不再使用的整段排障文本构造和粘贴解析函数。
- Test: `apps/admin-web/src/features/permissions/PermissionManagementView.test.tsx`
- Test: `apps/api/test/admin.controller.e2e-spec.ts`
- Test: `apps/admin-web/src/features/applications/ApplicationManagementView.test.tsx`
- Test: `apps/admin-web/src/components/admin/ProblemFeedbackPage.test.tsx`
- Test: `apps/admin-web/src/features/records/RecordQueryView.test.tsx`
- Test: `apps/admin-web/src/features/records/trace-format.test.ts`
- Modify: `README.md`, `CHANGELOG.md`, `AGENTS.md`, `package.json`, `apps/api/package.json`, `apps/admin-web/package.json`
- Create: `docs/codex-sessions/YYYY-MM-DD-HHMM-v0.16.2发布收口.md`

## Task 1: 修复组织用户选择器顶层口径

**Files:**
- Modify: `apps/admin-web/src/features/org-browser/org-browser.tsx`
- Modify: `apps/api/src/admin/admin-permission.controller.ts`
- Test: `apps/admin-web/src/features/permissions/PermissionManagementView.test.tsx`
- Test: `apps/api/test/admin.controller.e2e-spec.ts`

- [ ] **Step 1: 写前端回归测试**

在 `PermissionManagementView.test.tsx` 中新增或调整组织与用户绑定测试：

```ts
expect(fetchApplicationFeishuDepartments).toHaveBeenCalledWith(
  "crm",
  expect.objectContaining({ parentDepartmentId: null, page: 1, pageSize: 20 }),
);
expect(fetchApplicationFeishuUsers).not.toHaveBeenCalledWith(
  "crm",
  expect.objectContaining({ departmentId: undefined, keyword: undefined }),
);
```

补充下钻和搜索断言：

```ts
await user.click(within(detail).getByRole("button", { name: "进入组织 惠州唐群" }));
await waitFor(() => {
  expect(fetchApplicationFeishuUsers).toHaveBeenCalledWith(
    "crm",
    expect.objectContaining({ departmentId: "od_huizhou", page: 1, pageSize: 20 }),
  );
});

await user.type(within(detail).getByLabelText("搜索组织或用户"), "王文哲");
await user.click(within(detail).getByRole("button", { name: "搜索" }));
await waitFor(() => {
  expect(fetchApplicationFeishuUsers).toHaveBeenCalledWith(
    "crm",
    expect.objectContaining({ keyword: "王文哲", departmentId: undefined }),
  );
});
```

- [ ] **Step 2: 写后端回归测试**

在 `admin.controller.e2e-spec.ts` 的应用内部门候选接口测试附近新增：

```ts
await request(httpServer)
  .get("/api/v1/admin/applications/finance/feishu/departments?parent_department_id=__root__")
  .set("Cookie", ["feishu_iam_admin_session=bias_app"])
  .expect(200);

expect(prisma.feishuDepartment.findMany).toHaveBeenCalledWith(
  expect.objectContaining({
    where: expect.objectContaining({
      OR: [{ parentDepartmentId: "0" }, { parentDepartmentId: null }],
      isDeleted: false,
    }),
  }),
);
```

- [ ] **Step 3: 实现前端加载策略**

在 `OrgBrowser` 内增加空分页 helper，并在无关键词且未进入组织时跳过用户请求：

```ts
function emptyPage<T>(page: number): PageResult<T> {
  return { items: [], total: 0, page, pageSize: PAGE_SIZE };
}

const shouldLoadUsers = Boolean(keywordText || activeDepartment);
const usersPromise = shouldLoadUsers
  ? props.loadUsers({ departmentId: keywordText ? undefined : activeDepartment?.departmentId, keyword: keywordText || undefined, page, pageSize: PAGE_SIZE })
  : Promise.resolve(emptyPage<OrgBrowserUser>(page));
```

- [ ] **Step 4: 实现后端根级查询兼容**

在 `admin-permission.controller.ts` 中把部门 where 构造改为显式 helper：

```ts
function buildDepartmentParentWhere(parentDepartmentId: string | null | undefined) {
  if (parentDepartmentId === undefined) return {};
  if (parentDepartmentId === null) {
    return { OR: [{ parentDepartmentId: "0" }, { parentDepartmentId: null }] };
  }
  return { parentDepartmentId };
}
```

并合并进 `where`。

- [ ] **Step 5: 运行定向测试**

Run:

```bash
pnpm --filter @feishu-iam/api test -- test/admin.controller.e2e-spec.ts
pnpm --filter @feishu-iam/admin-web test -- src/features/permissions/PermissionManagementView.test.tsx
```

Expected: PASS。

## Task 2: 应用管理列表行操作改为纯 icon

**Files:**
- Modify: `apps/admin-web/src/features/applications/ApplicationManagementView.tsx`
- Test: `apps/admin-web/src/features/applications/ApplicationManagementView.test.tsx`

- [ ] **Step 1: 写前端测试**

在列表测试中断言应用管理列表操作列按钮：

```ts
const table = await screen.findByRole("table", { name: "应用清单" });
const detailButton = within(table).getByRole("button", { name: "查看 crm 详情" });
expect(detailButton).toHaveAttribute("title", "详情");
expect(detailButton).toHaveClass("h-8", "w-8", "p-0");
expect(detailButton).not.toHaveTextContent("详情");
```

- [ ] **Step 2: 实现 icon 按钮**

在 `ApplicationManagementView.tsx` 引入 `Eye`：

```ts
import { Eye } from "lucide-react";
```

并把按钮内容改为：

```tsx
<Button aria-label={`查看 ${application.appKey} 详情`} title="详情" size="icon" type="button" variant="outline" ...>
  <Eye aria-hidden="true" size={16} />
</Button>
```

- [ ] **Step 3: 运行定向测试和按钮检查**

Run:

```bash
pnpm --filter @feishu-iam/admin-web test -- src/features/applications/ApplicationManagementView.test.tsx
pnpm --filter @feishu-iam/admin-web test:buttons
```

Expected: PASS。

## Task 3: 简化 request id 排障交互

**Files:**
- Modify: `apps/admin-web/src/components/admin/ProblemFeedbackPage.tsx`
- Modify: `apps/admin-web/src/features/records/RecordQueryView.tsx`
- Modify: `apps/admin-web/src/features/records/TraceResultPanel.tsx`
- Modify: `apps/admin-web/src/features/records/trace-format.ts`
- Test: `apps/admin-web/src/components/admin/ProblemFeedbackPage.test.tsx`
- Test: `apps/admin-web/src/features/records/RecordQueryView.test.tsx`
- Test: `apps/admin-web/src/features/records/trace-format.test.ts`

- [ ] **Step 1: 更新测试**

`ProblemFeedbackPage.test.tsx`：

```ts
expect(screen.queryByRole("button", { name: "复制问题信息" })).not.toBeInTheDocument();
await userEvent.click(screen.getByRole("button", { name: "复制 request id" }));
expect(writeText).toHaveBeenCalledWith("req-admin-401");
```

`RecordQueryView.test.tsx`：

```ts
expect(screen.queryByLabelText("粘贴问题信息")).not.toBeInTheDocument();
expect(screen.queryByRole("button", { name: "提取 request id" })).not.toBeInTheDocument();
expect(screen.queryByRole("button", { name: "复制问题信息" })).not.toBeInTheDocument();
```

`trace-format.test.ts` 保留 `stageLabel` 和 `resultLabel` 测试，删除已移除函数测试。

- [ ] **Step 2: 删除问题提示页整段复制**

删除 `buildFeedbackText`、`feedbackText` 和 `copied === "feedback"` 状态，只保留 request id 复制按钮。

- [ ] **Step 3: 删除追踪页粘贴解析区域**

在 `RecordQueryView.tsx` 删除 `problemText`、`problemTextError`、`Textarea` 和“提取 request id”按钮；保留 request id 输入框、查询和 URL 参数序列化。

- [ ] **Step 4: 删除追踪结果整段复制**

在 `TraceResultPanel.tsx` 删除 `buildTraceFeedbackText` 引用、`copied` 状态和“复制问题信息”按钮；保留 `CopyField label="request id"`。

- [ ] **Step 5: 清理 trace-format**

删除 `extractTraceRequestIdFromText`、`buildTraceFeedbackText` 和对应常量；保留 `stageLabel`、`resultLabel`。

- [ ] **Step 6: 运行定向测试**

Run:

```bash
pnpm --filter @feishu-iam/admin-web test -- src/components/admin/ProblemFeedbackPage.test.tsx src/features/records/RecordQueryView.test.tsx src/features/records/trace-format.test.ts
```

Expected: PASS。

## Task 4: 版本材料和发布准备

**Files:**
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Modify: `AGENTS.md`
- Modify: `package.json`
- Modify: `apps/api/package.json`
- Modify: `apps/admin-web/package.json`
- Create: `docs/codex-sessions/YYYY-MM-DD-HHMM-v0.16.2发布收口.md`

- [ ] **Step 1: 更新版本号**

把 package 版本从 `0.16.1` 更新为 `0.16.2`。

- [ ] **Step 2: 更新 README 和 CHANGELOG**

README Quick Start、升级命令、镜像列表和当前版本说明指向 `v0.16.2`；CHANGELOG 增加 `v0.16.2` 条目，描述 `#36/#37/#38`、非目标和验收。

- [ ] **Step 3: 更新 AGENTS 当前阶段**

追加 `v0.16.2` 已完成项和保持项，不删除历史版本边界。

- [ ] **Step 4: 运行文档检查**

Run:

```bash
rg -n "《|》|TBD|TODO|PLACEHOLDER|password\\s*=|secret\\s*=|token\\s*=|cookie\\s*=" README.md CHANGELOG.md AGENTS.md docs/superpowers/plans/2026-05-29-feishu-iam-v0.16.2-patch.md
```

Expected: no unintended placeholders or plaintext secrets.

## Task 5: 完整验证、Browser 自检、发布和部署

**Files:**
- No direct implementation files beyond Task 1-4.

- [ ] **Step 1: 完整本地检查**

Run:

```bash
pnpm check
pnpm --filter @feishu-iam/admin-web test:buttons
```

Expected: PASS。

- [ ] **Step 2: Browser 自检**

启动本地服务后使用 Browser 打开后台页面，覆盖：

```text
/admin/permissions/crm/roles/role-1?tab=subjects
/admin/applications
/admin/records?requestId=req-1
```

检查无明显布局错位、内容溢出、元素遮挡；console 和 Network 无非预期错误。

- [ ] **Step 3: GitLab 收口**

创建 `codex/v0.16.2-patch` 分支，提交、推送、创建 MR，等待或确认合并。

- [ ] **Step 4: 版本发布**

合并后创建 tag/release `v0.16.2`，构建并推送多架构镜像：

```text
dockerhub.it.tangtring.com:80/ai/feishu-iam:v0.16.2
dockerhub.it.tangtring.com:80/ai/feishu-iam:latest
```

- [ ] **Step 5: 112 部署验收**

沿用既有 112 稳定路径：本地构建 `linux/amd64` 离线 tar，上传到 `192.168.2.112`，`docker load` 后用 `FEISHU_IAM_PULL_POLICY=never FEISHU_IAM_IMAGE_TAG=v0.16.2 APP_VERSION=0.16.2 ./upgrade.sh` 停机升级。验收 `/ready` 和 `/version`，并验证顶层组织默认显示 4 个一级组织。

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | 小补丁版本，不需要 CEO review |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | — | 尚未进入 diff review |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | clean | 13 个测试缺口已转为实施任务，0 critical gaps |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | skipped | 当前为既有 UI 的补丁修复，无新原型 |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | 不涉及开发者体验新流程 |

- **UNRESOLVED:** 0
- **VERDICT:** ENG CLEARED — ready to implement.
