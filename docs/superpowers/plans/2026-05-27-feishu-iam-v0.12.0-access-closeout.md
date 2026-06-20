# Feishu IAM v0.12.0 Access Closeout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 收口 `v0.12.0` 真实第三方接入验收，沉淀 `feishu-iam-sso-demo`，并修复两个接入相关后台生产体验问题。

**Architecture:** 复用现有管理后台路由、表单、API 和审计链路，不新增 DDL 或后端接口。应用负责人创建时由前端从当前管理员上下文自动传入，管理员创建成功后只更新本地列表和状态反馈，不再依赖详情 URL 跳转。

**Tech Stack:** React + Vite + Vitest + Testing Library；NestJS 现有管理 API；Docker Compose 发布链路。

---

## 范围锁定

纳入：

- `feishu-iam-sso-demo` 独立仓库和 `v0.12.0` 接入验收结论写入 README、验收文档、CHANGELOG、AGENTS 和会话归档。
- GitLab issue `#15`：新增应用接入包不应手填负责人 `user_id`。
- GitLab issue `#14`：创建平台管理员保存成功后不能跳转空白页。

排除：

- `#13` 飞书同步运维控制台。
- `#12` 导航组件重做。
- 完整 OIDC、SAML、ABAC、资源级权限、HTTPS、高可用、滚动升级。
- 人员选择器或负责人长期维护能力。

## 文件结构

- Modify: `IMPLEMENTATION_PLAN.md`，切换当前分支执行入口到 `v0.12.0`。
- Modify: `apps/admin-web/src/features/applications/ApplicationCreateDialog.tsx`，移除负责人输入框，默认提交当前管理员。
- Modify: `apps/admin-web/src/features/applications/ApplicationManagementView.tsx`，向创建弹窗传入当前管理员 `feishuUserId`。
- Modify: `apps/admin-web/src/features/applications/ApplicationDetailSheet.tsx`，负责人只读展示，不再允许手填编辑。
- Modify: `apps/admin-web/src/features/applications/application-form.ts`，收窄创建草稿类型。
- Modify: `apps/admin-web/src/features/applications/ApplicationManagementView.test.tsx`，覆盖负责人输入移除和默认负责人提交。
- Modify: `apps/admin-web/src/features/admin-users/AdminAuthorizationView.tsx`，创建成功后回到列表并展示成功状态。
- Modify: `apps/admin-web/src/features/admin-users/AdminAuthorizationView.test.tsx`，覆盖创建成功不打开详情和筛选排除场景。
- Modify: `README.md`、`CHANGELOG.md`、`AGENTS.md`，更新 `v0.12.0` 版本状态。
- Create: `docs/acceptance/v0.12.0-third-party-sso-demo.md`，记录不含敏感值的接入验收结论。
- Create: `docs/codex-sessions/YYYY-MM-DD-HHMM-v0.12.0接入验收收口.md`，记录本次会话和验证证据。

## Task 1: 写失败测试

**Files:**

- Modify: `apps/admin-web/src/features/applications/ApplicationManagementView.test.tsx`
- Modify: `apps/admin-web/src/features/admin-users/AdminAuthorizationView.test.tsx`

- [x] **Step 1: 新增应用创建测试**

在 `shows one-time secrets after create without serializing them into url` 附近补断言：

```tsx
expect(screen.queryByLabelText("负责人 user_id")).not.toBeInTheDocument();
expect(screen.queryByText("负责人 user_id")).not.toBeInTheDocument();
```

并在提交后断言：

```tsx
expect(createApplication).toHaveBeenCalledWith({
  appKey: "erp",
  name: "ERP 系统",
  description: undefined,
  ownerUserId: "ou_admin",
  redirectUris: ["https://erp.example.com/callback"],
});
```

- [x] **Step 2: 更新应用基础信息测试**

把基础信息保存期望从：

```tsx
ownerUserId: "ou_owner",
```

改为不包含 `ownerUserId`，并断言详情里只读展示：

```tsx
expect(within(dialog).queryByLabelText("负责人 user_id")).not.toBeInTheDocument();
expect(within(dialog).getByText("飞书 user_id: ou_owner")).toBeInTheDocument();
```

- [x] **Step 3: 更新管理员创建成功测试**

把 `新增平台管理员不提交应用范围并打开新详情` 改为 `新增平台管理员成功后回到列表并展示成功反馈`，断言：

```tsx
expect(window.location.search).not.toContain("sheet=admin");
expect(screen.queryByRole("dialog", { name: "管理员详情" })).not.toBeInTheDocument();
expect(await screen.findByRole("status")).toHaveTextContent("已新增平台管理员：新增管理员");
expect(await screen.findByText("新增管理员")).toBeInTheDocument();
```

- [x] **Step 4: 新增筛选排除回归测试**

新增用例：当前 URL 为 `?q=not-match`，创建 `ou_new` 成功后仍展示成功反馈，页面不打开详情，不出现空白页。

- [x] **Step 5: 运行定向测试确认失败**

Run:

```bash
pnpm --filter @feishu-iam/admin-web test -- src/features/applications/ApplicationManagementView.test.tsx src/features/admin-users/AdminAuthorizationView.test.tsx
```

Expected: FAIL，原因是当前仍展示负责人输入框、仍提交手填 owner、创建管理员仍打开详情。

## Task 2: 修复应用负责人输入

**Files:**

- Modify: `apps/admin-web/src/features/applications/application-form.ts`
- Modify: `apps/admin-web/src/features/applications/ApplicationCreateDialog.tsx`
- Modify: `apps/admin-web/src/features/applications/ApplicationManagementView.tsx`
- Modify: `apps/admin-web/src/features/applications/ApplicationDetailSheet.tsx`

- [x] **Step 1: 收窄创建草稿类型**

从 `ApplicationCreateDraft` 删除 `ownerUserId?: string`。

- [x] **Step 2: 创建弹窗增加默认负责人属性**

给 `ApplicationCreateDialogProps` 增加：

```ts
defaultOwnerUserId?: string | null;
```

创建请求中使用：

```ts
ownerUserId: cleanOptional(defaultOwnerUserId ?? undefined),
```

删除负责人输入框和 `emptyDraft.ownerUserId`。

- [x] **Step 3: 页面传入当前管理员**

在 `ApplicationManagementView` 渲染 `ApplicationCreateDialog` 时传入：

```tsx
defaultOwnerUserId={admin.feishuUserId}
```

- [x] **Step 4: 应用详情负责人只读**

从 `BasicDraft` 删除 `ownerUserId`，基础信息保存不再提交 `ownerUserId`。展示项改为：

```tsx
["负责人", formatOwnerUserId(application.ownerUserId)]
```

其中 `formatOwnerUserId` 返回 `飞书 user_id: ${value}` 或 `未配置`。

- [x] **Step 5: 运行应用管理测试**

Run:

```bash
pnpm --filter @feishu-iam/admin-web test -- src/features/applications/ApplicationManagementView.test.tsx
```

Expected: PASS。

## Task 3: 修复管理员创建成功空白页

**Files:**

- Modify: `apps/admin-web/src/features/admin-users/AdminAuthorizationView.tsx`
- Modify: `apps/admin-web/src/features/admin-users/AdminAuthorizationView.test.tsx`

- [x] **Step 1: 增加成功状态**

在 `AdminAuthorizationView` 增加：

```ts
const [successMessage, setSuccessMessage] = useState<string | null>(null);
```

- [x] **Step 2: 创建成功后回到列表**

create 分支改为：

```ts
const created = await createAdminUser(toCreateAdminUserPayload(dialogState.draft));
upsertAdminUser(created);
setDialogState(null);
updateSearch({ sheet: undefined });
setSuccessMessage(`已新增${formatAdminRoleLabel(created.roles)}：${created.displayName || created.feishuUserId}`);
```

不要设置 `sheet=admin:${created.id}`。

- [x] **Step 3: 展示成功反馈**

在列表区域表单上方展示：

```tsx
{successMessage ? (
  <div role="status" className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
    {successMessage}
  </div>
) : null}
```

打开创建弹窗、提交筛选、重置、行操作时清理旧成功反馈。

- [x] **Step 4: 运行管理员授权测试**

Run:

```bash
pnpm --filter @feishu-iam/admin-web test -- src/features/admin-users/AdminAuthorizationView.test.tsx
```

Expected: PASS。

## Task 4: 文档和版本材料

**Files:**

- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Modify: `AGENTS.md`
- Create: `docs/acceptance/v0.12.0-third-party-sso-demo.md`
- Create: `docs/codex-sessions/YYYY-MM-DD-HHMM-v0.12.0接入验收收口.md`

- [x] **Step 1: README**

确认 README 包含：

- `feishu-iam-sso-demo` 独立仓库链接。
- `v0.12.0` 版本历史。
- `v0.12.0` 部署镜像和 digest 在 ship 后补齐。

- [x] **Step 2: CHANGELOG**

在顶部新增 `## v0.12.0`，覆盖新增、修复、约束和验收。

- [x] **Step 3: AGENTS**

当前阶段改为 `v0.12.0` 收口中或已发布，保留下一阶段建议：生产体验补丁或 `#13` 飞书同步运维控制台。

- [x] **Step 4: 验收文档**

新增 `docs/acceptance/v0.12.0-third-party-sso-demo.md`，只记录仓库、端点、验证项和安全原则，不记录 secret、token、cookie、密码。

## Task 5: 全量验证和浏览器自检

- [x] **Step 1: 定向测试**

```bash
pnpm --filter @feishu-iam/admin-web test -- src/features/applications/ApplicationManagementView.test.tsx src/features/admin-users/AdminAuthorizationView.test.tsx
```

- [x] **Step 2: 前端类型和构建**

```bash
pnpm --filter @feishu-iam/admin-web typecheck
pnpm --filter @feishu-iam/admin-web build
```

- [x] **Step 3: 全仓检查**

```bash
pnpm check
```

- [x] **Step 4: Browser/Playwright 自检**

启动本地页面后覆盖：

- `/admin/applications?sheet=create`
- `/admin/system/admins`
- 桌面和窄屏无明显错位、遮挡、横向溢出。
- console 无非预期错误，Network 无非预期失败。

## Task 6: Git、ship、land、deploy

- [x] **Step 1: Git 收口**

检查 `git status --short`、`git diff`，只纳入 v0.12.0 intended diff。

- [x] **Step 2: Ship**

更新版本号、README 镜像信息、CHANGELOG，提交、push、创建 MR 或按项目既有流程直接合并。

- [x] **Step 3: Release 和 tag**

创建 `v0.12.0` tag/release，发布镜像 `feishu-iam:v0.12.0` 和 `latest`。

- [x] **Step 4: Deploy**

在 `192.168.2.112:~/feishu-iam` 停机升级并验证：

```bash
curl -fsS http://feishu-iam.example.com/ready
curl -fsS http://feishu-iam.example.com/version
```

Expected: `/ready` 返回 ready，`/version` 返回 `0.12.0 / v0.12.0`。
