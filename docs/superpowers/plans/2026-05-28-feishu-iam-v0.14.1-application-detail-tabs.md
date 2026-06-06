# Feishu IAM v0.14.1 应用详情 Tab 化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 发布 `v0.14.1`，收口 GitLab issue `#17`，把应用详情页改为 Tab 化工作区并完成 GitLab 发布和 112 部署。

**Architecture:** 前端保持现有应用详情数据流和 API 不变，只在 `ApplicationDetailPage` 增加 URL Tab 状态，并在 `ApplicationDetailSheet` 中把现有区块重组为 `详细资料`、`角色管理`、`开发信息`、`危险操作` 四个 Tab。旧抽屉兼容入口使用组件内部 Tab 状态，独立详情页使用 URL 受控状态。

**Tech Stack:** React、React Router、Radix Tabs、shadcn/ui wrapper、Vite、Vitest、Playwright responsive check、Docker Compose。

---

## 文件结构

- Modify: `apps/admin-web/src/features/applications/ApplicationDetailPage.tsx`：解析和维护应用详情 `tab` query。
- Modify: `apps/admin-web/src/features/applications/ApplicationDetailSheet.tsx`：引入 Tabs，重组现有详情区块。
- Modify: `apps/admin-web/src/features/applications/ApplicationManagementView.test.tsx`：覆盖旧抽屉兼容入口和 Tab 展示。
- Modify: `apps/admin-web/src/App.test.tsx`：覆盖独立详情页 URL Tab、刷新和无效 query。
- Modify: `package.json`、`apps/api/package.json`、`apps/admin-web/package.json`、`deploy/*`：发布阶段更新版本号。
- Modify: `README.md`、`CHANGELOG.md`、`AGENTS.md`：发布阶段更新版本说明。
- Create/Modify: `docs/superpowers/reviews/2026-05-28-feishu-iam-v0.14.1-application-detail-tabs-*.md`：记录 design-review、QA、pre-landing review。
- Create: `docs/codex-sessions/YYYY-MM-DD-HHMM-v0.14.1应用详情Tab化.md`：会话归档。

## Task 1: 应用详情 URL Tab 状态测试

**Files:**

- Modify: `apps/admin-web/src/App.test.tsx`

- [ ] **Step 1: 写失败测试**

在 `apps/admin-web/src/App.test.tsx` 的应用详情路由测试附近增加用例：

```tsx
it("应用详情页支持 Tab query 并保留返回上下文", async () => {
  const user = userEvent.setup();
  installFetchMock();
  window.history.pushState(
    {},
    "",
    "/admin/applications/demo?from=%2Fadmin%2Fapplications%3Fq%3Ddemo&tab=development",
  );

  render(<App />);

  expect(
    await screen.findByRole("main", { name: "应用详情" }),
  ).toBeInTheDocument();
  expect(
    await screen.findByRole("tab", { name: "开发信息", selected: true }),
  ).toBeInTheDocument();

  await user.click(screen.getByRole("tab", { name: "角色管理" }));

  expect(window.location.pathname).toBe("/admin/applications/demo");
  expect(window.location.search).toContain("tab=roles");
  expect(window.location.search).toContain(
    "from=%2Fadmin%2Fapplications%3Fq%3Ddemo",
  );
});

it("应用详情页遇到无效 Tab query 时降级到详细资料", async () => {
  installFetchMock();
  window.history.pushState({}, "", "/admin/applications/demo?tab=unknown");

  render(<App />);

  expect(
    await screen.findByRole("tab", { name: "详细资料", selected: true }),
  ).toBeInTheDocument();
});
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
pnpm --filter @feishu-iam/admin-web test -- src/App.test.tsx
```

Expected: FAIL，因为应用详情页尚未渲染 Tab。

## Task 2: 实现应用详情 URL Tab 状态

**Files:**

- Modify: `apps/admin-web/src/features/applications/ApplicationDetailPage.tsx`
- Modify: `apps/admin-web/src/features/applications/ApplicationDetailSheet.tsx`

- [ ] **Step 1: 在详情组件中定义 Tab 类型**

在 `ApplicationDetailSheet.tsx` 中增加：

```tsx
export const applicationDetailTabs = [
  "details",
  "roles",
  "development",
  "danger",
] as const;

export type ApplicationDetailTab = (typeof applicationDetailTabs)[number];

export function isApplicationDetailTab(
  value: string | null,
): value is ApplicationDetailTab {
  return applicationDetailTabs.some((item) => item === value);
}
```

- [ ] **Step 2: 让应用详情页解析和更新 query**

在 `ApplicationDetailPage.tsx` 中使用 `isApplicationDetailTab` 校验 `searchParams.get("tab")`。默认值为 `details`。切换 Tab 时复制当前 `searchParams`，`details` 删除 `tab`，其他值写入 `tab`，然后 `navigate({ search }, { replace: true })`。

- [ ] **Step 3: 把受控 Tab 传给详情组件**

`ApplicationDetailWorkspace` 渲染 `ApplicationDetailSheet` 时传入：

```tsx
activeTab = { activeTab };
onActiveTabChange = { handleTabChange };
```

- [ ] **Step 4: 运行测试确认仍失败在视图层**

Run:

```bash
pnpm --filter @feishu-iam/admin-web test -- src/App.test.tsx
```

Expected: 仍可能 FAIL，因为 `ApplicationDetailSheet` 尚未渲染 Tab 内容。

## Task 3: 重组应用详情为四个 Tab

**Files:**

- Modify: `apps/admin-web/src/features/applications/ApplicationDetailSheet.tsx`

- [ ] **Step 1: 导入 Tabs 组件**

在 `ApplicationDetailSheet.tsx` 增加：

```tsx
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../../components/ui/tabs";
```

- [ ] **Step 2: 增加受控或非受控 Tab 状态**

给 `ApplicationDetailSheetProps` 增加：

```tsx
activeTab?: ApplicationDetailTab;
onActiveTabChange?: (tab: ApplicationDetailTab) => void;
```

组件内部增加：

```tsx
const [localActiveTab, setLocalActiveTab] =
  useState<ApplicationDetailTab>("details");
const resolvedActiveTab = activeTab ?? localActiveTab;

function setResolvedActiveTab(value: string) {
  if (!isApplicationDetailTab(value)) {
    return;
  }
  if (onActiveTabChange) {
    onActiveTabChange(value);
    return;
  }
  setLocalActiveTab(value);
}
```

- [ ] **Step 3: 用 Tabs 包裹现有区块**

把现有内容重组为：

```tsx
<Tabs value={resolvedActiveTab} onValueChange={setResolvedActiveTab}>
  <TabsList className="h-auto flex-wrap justify-start">
    <TabsTrigger value="details">详细资料</TabsTrigger>
    <TabsTrigger value="roles">角色管理</TabsTrigger>
    <TabsTrigger value="development">开发信息</TabsTrigger>
    <TabsTrigger value="danger">危险操作</TabsTrigger>
  </TabsList>
  <TabsContent value="details">基础信息编辑和 `app_key` 复制</TabsContent>
  <TabsContent value="roles">`RoleSection`</TabsContent>
  <TabsContent value="development">
    回调地址、OAuth credential、Developer credential、接入提示词
  </TabsContent>
  <TabsContent value="danger">应用启停和审计入口</TabsContent>
</Tabs>
```

保持所有现有提交函数、确认弹窗和错误提示不变。

- [ ] **Step 4: 运行定向测试**

Run:

```bash
pnpm --filter @feishu-iam/admin-web test -- src/App.test.tsx
```

Expected: 新增应用详情 Tab 测试 PASS。

## Task 4: 旧抽屉兼容和应用管理测试

**Files:**

- Modify: `apps/admin-web/src/features/applications/ApplicationManagementView.test.tsx`

- [ ] **Step 1: 更新旧抽屉测试断言**

把仍检查 `应用详情` dialog 的测试补充为：打开后能看到 `详细资料`、`角色管理`、`开发信息`、`危险操作` 四个 tab。

- [ ] **Step 2: 增加旧抽屉 Tab 切换测试**

新增用例：

```tsx
it("旧应用详情抽屉入口也展示 Tab 化工作区", async () => {
  const user = userEvent.setup();
  renderApplicationManagementView();

  await openApplicationDetail(user);
  const dialog = await screen.findByRole("dialog", { name: /应用详情/ });

  expect(
    within(dialog).getByRole("tab", { name: "详细资料", selected: true }),
  ).toBeInTheDocument();
  await user.click(within(dialog).getByRole("tab", { name: "角色管理" }));
  expect(
    within(dialog).getByRole("tab", { name: "角色管理", selected: true }),
  ).toBeInTheDocument();
  expect(
    within(dialog).getByRole("button", { name: "新增角色" }),
  ).toBeInTheDocument();
});
```

如果当前测试 helper 名称不同，使用文件内已有打开详情 helper，不新增全局 helper。

- [ ] **Step 3: 运行应用管理定向测试**

Run:

```bash
pnpm --filter @feishu-iam/admin-web test -- src/features/applications/ApplicationManagementView.test.tsx
```

Expected: PASS。

## Task 5: 完成门禁和 Browser 自检

**Files:**

- Create: `docs/superpowers/reviews/2026-05-28-feishu-iam-v0.14.1-application-detail-tabs-qa.md`
- Create: `docs/superpowers/reviews/2026-05-28-feishu-iam-v0.14.1-application-detail-tabs-design-review.md`

- [ ] **Step 1: 运行验证命令**

Run:

```bash
pnpm --filter @feishu-iam/admin-web test -- src/features/applications/ApplicationManagementView.test.tsx src/App.test.tsx
pnpm --filter @feishu-iam/admin-web build
ADMIN_WEB_URL=http://127.0.0.1:5173 pnpm --filter @feishu-iam/admin-web test:responsive
pnpm check
```

Expected: 全部 PASS。Vite chunk size warning 可以记录为非阻塞。

- [ ] **Step 2: 启动本地服务并用 Browser 自检**

Run:

```bash
pnpm compose:up
```

Browser 覆盖：

- `/admin/applications`
- `/admin/applications/<真实 app_key>`
- `/admin/applications/<真实 app_key>?tab=roles`
- `/admin/applications/<真实 app_key>?tab=development`

检查 console、Network、桌面和窄屏布局。

- [ ] **Step 3: 写 QA 和设计复审记录**

记录：

- 验证路径。
- 自动化命令和结果。
- Browser 自检结果。
- 发现的问题和修复后的重新验证。

## Task 6: 发布材料和版本号

**Files:**

- Modify: `package.json`
- Modify: `apps/api/package.json`
- Modify: `apps/admin-web/package.json`
- Modify: `deploy/install.sh`
- Modify: `deploy/docker-compose.yml`
- Modify: `deploy/server.env.example`
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Modify: `AGENTS.md`
- Create: `docs/codex-sessions/YYYY-MM-DD-HHMM-v0.14.1应用详情Tab化.md`

- [ ] **Step 1: 更新版本元数据**

把 `0.14.0` 更新为 `0.14.1`，把部署默认 tag 从 `v0.14.0` 更新为 `v0.14.1`。

- [ ] **Step 2: 更新 README / CHANGELOG / AGENTS**

新增 `v0.14.1` 版本历史，说明范围锁定 GitLab issue `#17`，部署信息在镜像发布后补 digest 和 112 验收。

- [ ] **Step 3: 写会话归档**

归档内容必须包含目标、关键要求、使用的 harness 步骤、修改文件、验证命令和结果、发布部署结果。

## Task 7: GitLab 发布和 112 部署

**Files:**

- Modify after build evidence: `README.md`
- Modify after deploy evidence: `docs/codex-sessions/YYYY-MM-DD-HHMM-v0.14.1应用详情Tab化.md`

- [ ] **Step 1: Git closeout**

Run:

```bash
git status --short
git diff --stat
git diff --check
```

Expected: 只包含 `v0.14.1` intended diff，`git diff --check` PASS。

- [ ] **Step 2: 提交并推送分支**

Run:

```bash
git add <v0.14.1 intended files>
git commit -m "feat: release v0.14.1 application detail tabs"
git push -u origin codex/v0.14.1-application-detail-tabs
```

- [ ] **Step 3: 创建并合并 GitLab MR**

创建 MR 到 `main`，等待或确认检查结果，合并后确认 `origin/main` 包含提交。

- [ ] **Step 4: tag、release、镜像**

创建 `v0.14.1` tag 和 GitLab release。构建并推送：

```bash
docker buildx build --platform linux/amd64,linux/arm64 --provenance=false --sbom=false -f deploy/api.Dockerfile -t dockerhub.it.tangtring.com:80/ai/feishu-iam:v0.14.1 --push .
```

记录 manifest digest。

- [ ] **Step 5: 112 停机升级和验收**

在 `192.168.2.112:~/feishu-iam` 升级到 `v0.14.1`。如果 pull 受限，使用 amd64 tar、`docker load` 和 `FEISHU_IAM_PULL_POLICY=never`。验证：

```bash
curl -fsS http://192.168.2.112:8000/ready
curl -fsS http://192.168.2.112:8000/version
```

Browser 验证生产应用详情 Tab。关闭 GitLab issue `#17`，更新 README digest 和归档。

## Self-Review

- Spec coverage：`#17` 的 Tab 导航、详细资料、角色管理、开发信息、URL Tab、返回上下文、响应式和 Browser 自检均有任务覆盖。
- Placeholder scan：本文不包含 `TBD`、`TODO`、`implement later` 或未定义占位任务。
- Type consistency：应用详情 Tab 值统一为 `details`、`roles`、`development`、`danger`，独立页和详情组件共享同一类型。
