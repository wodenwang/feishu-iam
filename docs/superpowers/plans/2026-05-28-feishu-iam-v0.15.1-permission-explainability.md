# Feishu IAM v0.15.1 Permission Explainability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 发布 `v0.15.1`，收口 GitLab issue `#21/#25`，并修复应用详情角色管理启停用按钮变形回归。

**Architecture:** 后端在现有 admin 角色列表响应中扩展权限组内权限点和直接权限点字段，不新增 DDL、不改变授权判定语义。前端在角色详情权限组绑定 Tab 中聚合最终权限点并提供搜索；导航和应用详情角色操作列只做局部 UI 修复。

**Tech Stack:** NestJS、Prisma、React、Vite、shadcn/ui、Tailwind、lucide-react、Vitest、Playwright responsive checker、Docker Compose。

---

## File Map

- Modify: `apps/api/src/permission/iam-role.service.ts`
  - 扩展 `IamRoleWithBindings`，让 `listRoles()` 返回直接权限点和权限组内权限点。
- Modify: `apps/admin-web/src/api/permission.ts`
  - 扩展 `PermissionGroup` 和 `IamRole` 类型，兼容 snake_case 字段。
- Modify: `apps/admin-web/src/features/permissions/PermissionRoleDetailSheet.tsx`
  - 在 `权限组绑定` Tab 展示权限组内权限点和最终权限点搜索一览。
- Modify: `apps/admin-web/src/features/applications/ApplicationDetailSheet.tsx`
  - 把角色启停用按钮改成 `Power / PowerOff` 图标按钮。
- Modify: `apps/admin-web/src/components/admin/AppShell.tsx`
  - 统一普通一级菜单和分组父级菜单的整行 hover / active / focus-visible 宽度。
- Modify: `apps/api/test/admin.controller.e2e-spec.ts`
  - 覆盖 admin 角色列表响应中的权限点说明字段。
- Modify: `apps/admin-web/src/features/permissions/PermissionManagementView.test.tsx`
  - 覆盖权限组内权限点查看、最终权限点搜索和来源合并。
- Modify: `apps/admin-web/src/features/applications/ApplicationManagementView.test.tsx`
  - 覆盖应用详情角色管理启停用图标按钮。
- Modify: `apps/admin-web/src/App.test.tsx`
  - 覆盖左侧导航一级菜单 hover 行宽 class。
- Modify: `package.json`、`apps/api/package.json`、`apps/admin-web/package.json`、`apps/api/src/version/version.controller.ts`、`apps/api/test/version.controller.e2e-spec.ts`
  - 更新版本到 `0.15.1`。
- Modify: `deploy/docker-compose.yml`、`deploy/install.sh`、`deploy/server.env.example`
  - 更新默认镜像 tag 和 APP_VERSION。
- Modify: `README.md`、`CHANGELOG.md`、`AGENTS.md`
  - 更新版本历史、当前阶段、发布说明和文档索引。
- Add/Modify: `docs/codex-sessions/YYYY-MM-DD-HHMM-v0.15.1权限可解释性发布.md`
  - 记录实施、验证、发布和部署证据。

## Task 1: 后端角色响应扩展

**Files:**
- Modify: `apps/api/src/permission/iam-role.service.ts`
- Modify: `apps/api/test/admin.controller.e2e-spec.ts`

- [ ] **Step 1: 写失败测试**

在 `apps/api/test/admin.controller.e2e-spec.ts` 中定位 `GET /api/v1/admin/applications/finance/iam-roles` 相关测试，增加断言：

```ts
expect(role.permissionGroups[0].permissionPoints).toEqual(
  expect.arrayContaining([
    expect.objectContaining({
      key: "finance.invoice.read",
      name: "查看发票",
      status: "active",
    }),
  ]),
);
expect(role.permissionPoints).toEqual(
  expect.arrayContaining([
    expect.objectContaining({
      key: "finance.invoice.export",
      name: "导出发票",
      status: "active",
    }),
  ]),
);
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
pnpm --filter @feishu-iam/api test -- test/admin.controller.e2e-spec.ts
```

Expected: 失败，原因是 `permissionPoints` 字段不存在或为空。

- [ ] **Step 3: 扩展 `IamRoleWithBindings` 类型**

在 `apps/api/src/permission/iam-role.service.ts` 中增加轻量类型：

```ts
type PermissionPointSummary = {
  id: string;
  applicationId: string;
  key: string;
  name: string;
  description: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};
```

并把 `IamRoleWithBindings` 扩为：

```ts
permissionGroups: Array<PermissionGroup & { permissionPoints?: PermissionPointSummary[] }>;
permissionPoints: PermissionPointSummary[];
```

- [ ] **Step 4: 扩展 Prisma include**

在 `listRoles()` 的 `permissionGroups.include.permissionGroup` 中 include 组内权限点：

```ts
permissionGroup: {
  include: {
    permissionPoints: {
      include: { permissionPoint: true },
      orderBy: { permissionPointId: "asc" },
    },
  },
},
```

同时 include 直接绑定权限点：

```ts
permissionPoints: {
  include: { permissionPoint: true },
  orderBy: { permissionPointId: "asc" },
},
```

- [ ] **Step 5: 映射返回字段**

把角色映射改为：

```ts
permissionGroups: role.permissionGroups.map((binding) => ({
  ...binding.permissionGroup,
  permissionPoints: binding.permissionGroup.permissionPoints.map((pointBinding) => pointBinding.permissionPoint),
})),
permissionPoints: role.permissionPoints.map((binding) => binding.permissionPoint),
```

- [ ] **Step 6: 运行 API 测试**

Run:

```bash
pnpm --filter @feishu-iam/api test -- test/admin.controller.e2e-spec.ts
```

Expected: PASS。

## Task 2: 前端权限可解释性 UI

**Files:**
- Modify: `apps/admin-web/src/api/permission.ts`
- Modify: `apps/admin-web/src/features/permissions/PermissionRoleDetailSheet.tsx`
- Modify: `apps/admin-web/src/features/permissions/PermissionManagementView.test.tsx`

- [ ] **Step 1: 写失败测试**

在 `PermissionManagementView.test.tsx` 增加测试：打开角色详情 `权限组绑定` Tab 后，能看到权限组内权限点、最终权限点一览和来源；搜索 `导出` 后只保留匹配权限点。

关键断言：

```ts
expect(within(detail).getByText("最终权限点")).toBeInTheDocument();
expect(within(detail).getByText("crm.customer.read")).toBeInTheDocument();
expect(within(detail).getByText("直接 + 权限组")).toBeInTheDocument();
await user.type(within(detail).getByLabelText("搜索最终权限点"), "导出");
expect(within(detail).queryByText("crm.customer.read")).not.toBeInTheDocument();
expect(within(detail).getByText("crm.customer.export")).toBeInTheDocument();
```

- [ ] **Step 2: 运行前端定向测试确认失败**

Run:

```bash
pnpm --filter @feishu-iam/admin-web test -- src/features/permissions/PermissionManagementView.test.tsx
```

Expected: FAIL，原因是最终权限点 UI 和类型字段尚不存在。

- [ ] **Step 3: 扩展前端类型**

在 `apps/admin-web/src/api/permission.ts` 中让 `PermissionGroup` 支持：

```ts
permissionPoints?: PermissionPoint[];
permission_points?: PermissionPoint[];
```

让 `IamRole` 支持：

```ts
permissionPoints?: PermissionPoint[];
permission_points?: PermissionPoint[];
```

在 `normalizeIamRole()` 中归一化：

```ts
permissionGroups: (role.permissionGroups ?? role.permission_groups)?.map(normalizePermissionGroup),
permissionPoints: role.permissionPoints ?? role.permission_points ?? [],
```

- [ ] **Step 4: 增加聚合 helper**

在 `PermissionRoleDetailSheet.tsx` 增加 `buildEffectivePermissionPoints()`，按权限点 `id ?? key` 合并直接绑定和权限组来源，返回 `sourceLabel`、`sourceGroups` 和权限点基础字段。

- [ ] **Step 5: 改造 `GroupsTab` props**

给 `GroupsTab` 增加：

```ts
role: IamRole;
```

并在组件内维护：

```ts
const [expandedGroupIds, setExpandedGroupIds] = useState<string[]>([]);
const [effectiveQuery, setEffectiveQuery] = useState("");
```

- [ ] **Step 6: 展示权限组内权限点**

在每个权限组卡片中增加 `查看权限点` 按钮。展开后展示该权限组 `permissionPoints`，覆盖空状态“该权限组暂无权限点”。

- [ ] **Step 7: 展示最终权限点一览**

在 `GroupsTab` 右侧或下方增加 `最终权限点` 区块，包含搜索输入、数量摘要、权限点列表、来源标签和空状态。

- [ ] **Step 8: 运行前端定向测试**

Run:

```bash
pnpm --filter @feishu-iam/admin-web test -- src/features/permissions/PermissionManagementView.test.tsx
```

Expected: PASS。

## Task 3: 后台 UI 回归修复

**Files:**
- Modify: `apps/admin-web/src/features/applications/ApplicationDetailSheet.tsx`
- Modify: `apps/admin-web/src/components/admin/AppShell.tsx`
- Modify: `apps/admin-web/src/features/applications/ApplicationManagementView.test.tsx`
- Modify: `apps/admin-web/src/App.test.tsx`

- [ ] **Step 1: 写应用详情图标按钮失败测试**

在 `ApplicationManagementView.test.tsx` 的角色管理测试中断言启停用按钮：

```ts
const disableButton = within(roleTable).getByRole("button", { name: "停用 crm.admin" });
expect(disableButton).toHaveClass("h-8", "w-8", "p-0");
expect(disableButton).toHaveAttribute("title", "停用");
expect(disableButton).not.toHaveTextContent("停用");
```

- [ ] **Step 2: 写导航 hover 行宽失败测试**

在 `App.test.tsx` 增加或调整左侧导航测试，断言普通一级菜单链接包含 `w-full flex-1 text-left`，和分组父级按钮一致。

- [ ] **Step 3: 运行测试确认失败**

Run:

```bash
pnpm --filter @feishu-iam/admin-web test -- src/features/applications/ApplicationManagementView.test.tsx src/App.test.tsx
```

Expected: FAIL。

- [ ] **Step 4: 应用详情启停用改图标按钮**

在 `ApplicationDetailSheet.tsx` 引入 `Power`、`PowerOff`，把角色启停用按钮改成 `h-8 w-8 p-0`，按钮内容只放图标。

- [ ] **Step 5: 统一 AppShell 一级菜单行宽**

在普通一级菜单 `Link` 分支中补 `w-full flex-1 text-left`，保持 collapsed 分支仍能居中。

- [ ] **Step 6: 运行 UI 定向测试**

Run:

```bash
pnpm --filter @feishu-iam/admin-web test -- src/features/applications/ApplicationManagementView.test.tsx src/App.test.tsx
```

Expected: PASS。

## Task 4: 版本材料和发布准备

**Files:**
- Modify: `package.json`
- Modify: `apps/api/package.json`
- Modify: `apps/admin-web/package.json`
- Modify: `apps/api/src/version/version.controller.ts`
- Modify: `apps/api/test/version.controller.e2e-spec.ts`
- Modify: `deploy/docker-compose.yml`
- Modify: `deploy/install.sh`
- Modify: `deploy/server.env.example`
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Modify: `AGENTS.md`
- Add: `docs/codex-sessions/YYYY-MM-DD-HHMM-v0.15.1权限可解释性发布.md`

- [ ] **Step 1: 更新版本号**

把 `0.15.0` 更新为 `0.15.1`，把 `v0.15.0` 默认部署 tag 更新为 `v0.15.1`。历史版本记录中的 `v0.15.0` 不做替换。

- [ ] **Step 2: 更新 README 和 CHANGELOG**

新增 `v0.15.1` 版本历史，说明范围锁定 `#21/#25` 和应用详情角色管理启停用图标化回归修复。镜像 digest 和 112 验收结果在发布后回填。

- [ ] **Step 3: 更新 AGENTS 当前阶段**

把当前阶段更新为 `v0.15.1` 实施中或已发布，保留 `v0.15.0` 不回退要求，并增加 `v0.15.1` 不回退项。

- [ ] **Step 4: 增加会话归档**

记录目标、范围、修改文件、验证命令、发布和部署证据。发布前可先写“待回填”，发布后必须回填真实 digest、MR、release、112 结果。

## Task 5: 验证、发布和部署

**Files:**
- Modify after release evidence: `README.md`
- Modify after release evidence: `CHANGELOG.md`
- Modify after release evidence: `docs/codex-sessions/YYYY-MM-DD-HHMM-v0.15.1权限可解释性发布.md`

- [ ] **Step 1: 运行定向测试**

Run:

```bash
pnpm --filter @feishu-iam/api test -- test/admin.controller.e2e-spec.ts
pnpm --filter @feishu-iam/admin-web test -- src/features/permissions/PermissionManagementView.test.tsx src/features/applications/ApplicationManagementView.test.tsx src/App.test.tsx
```

Expected: PASS。

- [ ] **Step 2: 运行构建和全量检查**

Run:

```bash
pnpm --filter @feishu-iam/admin-web build
pnpm check
```

Expected: PASS，允许保留既有 Vite chunk size warning。

- [ ] **Step 3: Browser 自检**

启动本地服务后使用 Browser 检查：

- `/admin/permissions/crm/roles/role-1?tab=groups`
- `/admin/applications/crm?tab=roles`
- 左侧导航桌面展开态、收缩态和 390px 移动态

Expected: 无明显错位、遮挡、溢出、异常空白；console 无新增错误；Network 无非预期失败。

- [ ] **Step 4: GitLab MR 和合并**

创建 MR，合并到 `main`。合并前确认 diff 只包含 `v0.15.1` 范围。

- [ ] **Step 5: tag、release、镜像**

创建 `v0.15.1` tag 和 GitLab release。构建并推送：

```bash
docker buildx build --platform linux/amd64,linux/arm64 --provenance=false --sbom=false -f deploy/api.Dockerfile -t feishu-iam:v0.15.1 -t feishu-iam:latest --push .
```

- [ ] **Step 6: 112 停机升级和验收**

在 `192.168.2.112:~/feishu-iam` 使用 amd64 离线 tar 和 `FEISHU_IAM_PULL_POLICY=never` 升级到 `v0.15.1`，验证 `/ready` 和 `/version`，并做生产未登录态页面冒烟。

- [ ] **Step 7: 回填证据和关闭 issue**

回填 README、CHANGELOG、会话归档中的镜像 digest、MR、release 和 112 验收证据。关闭 GitLab issue `#21/#25`；应用详情角色管理启停用图标化如未单独建 issue，在 release 说明中列为用户新增回归修复。
