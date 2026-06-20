# 角色配置工作台布局修复

## 会话目标

修复生产页面 `/admin/permissions/roles/:roleId` 中“待选组织与用户”和“可选权限组”区域被右侧内容撑开后出现异常高度间隙的问题，并把应用权限页的当前应用切换从下拉改为纵向 tab。

## 用户关键要求

- 用户在 Browser 评论中指出 `tab=subjects` 的“待选组织与用户”区域疑似被右侧撑开，高度间隙完全不对。
- 用户随后在 Browser 评论中指出 `tab=permissions` 的“可选权限组”区域也存在同样高度间距问题，并要求切换应用使用纵向 tab，而不是下拉切换。
- 目标生产页面包括：
  - `https://feishu-iam.riversoft.com.cn/admin/permissions/roles/a5dac1d8-7e54-4571-870f-4b191908b7cd?appKey=base-portal&from=%2Fadmin%2Fpermissions&tab=subjects`
  - `https://feishu-iam.riversoft.com.cn/admin/permissions/roles/a5dac1d8-7e54-4571-870f-4b191908b7cd?appKey=base-portal&from=%2Fadmin%2Fpermissions&tab=permissions`

## 关键约束

- 保持 `v0.15.x/v0.16.x` 组织用户选择器语义不回退：组织和用户仍在同一列表中展示，组织主体不自动展开为全部用户。
- 保持应用权限保存、添加应用、权限组搜索和权限点差异核对逻辑不变。
- 不记录 token、cookie、secret 或生产会话信息。

## 根因和决策

- 桌面双栏容器使用 CSS grid，默认 `align-items: stretch` 会把左侧面板拉伸到与右侧栏同高。
- 左侧面板自身也是 grid，拉伸后的额外高度会被内部 grid 行分配，导致标题说明、当前应用、搜索区之间出现大段空白。
- 修复方式：
  - 双栏容器增加 `items-start`，避免左右栏等高拉伸。
  - 左侧面板根 section 增加 `content-start`，避免在外部高度变化时内部行被拉开。
  - “当前应用”从 `select` 改成 `role="tablist"` 且 `aria-orientation="vertical"` 的已绑定应用列表；选中应用保留可聚焦，不使用 `disabled`。
  - 新增组件级布局回归测试，锁住组织用户和应用权限两处 UI 契约。

## 修改文件

- `apps/admin-web/src/features/org-browser/org-browser.tsx`
- `apps/admin-web/src/features/org-browser/org-user-selector.tsx`
- `apps/admin-web/src/features/org-browser/org-user-selector.test.tsx`
- `apps/admin-web/src/features/permissions/PermissionRoleDetailSheet.tsx`
- `apps/admin-web/src/features/permissions/PermissionRoleDetailSheet.test.tsx`
- `docs/codex-sessions/2026-06-21-0111-role-subjects-layout-fix.md`

## 关键命令和验证结果

- `git status --short`：初始无输出，工作区干净。
- `pnpm --filter @feishu-iam/admin-web test -- src/features/permissions/PermissionRoleDetailSheet.test.tsx src/features/org-browser/org-user-selector.test.tsx`：通过，2 个测试通过。
- `pnpm --filter @feishu-iam/admin-web typecheck`：通过。
- `pnpm --filter @feishu-iam/admin-web lint`：通过。
- `pnpm --filter @feishu-iam/admin-web build`：通过；Vite 仍提示既有 chunk size warning。
- `ADMIN_WEB_URL=http://localhost:5173 pnpm --filter @feishu-iam/admin-web test:responsive`：未完成，卡在既有脚本的应用详情 `tab=roles` 检查，等待“角色管理”tab 超时；该失败点与本次 `subjects` / `permissions` 布局修复无直接关系，未作为通过证据。
- 专门 Playwright 检查 `tab=subjects`：通过。1620×751 视口下：
  - active tab 为“组织与用户”。
  - 左侧待选面板 class 包含 `content-start`。
  - 桌面双栏容器 class 包含 `items-start`。
  - 左侧待选面板高度 470px，右侧已选面板高度 770px，左侧未被右侧等高拉伸。
  - 标题说明到搜索框间距 12px。
  - 页面无横向溢出、console error 或失败请求。
- 专门 Playwright 检查 `tab=permissions`：通过。1620×748 视口下：
  - active tab 为“应用权限”。
  - 左侧可选权限组面板 class 包含 `content-start`。
  - 双栏父容器 class 包含 `items-start`。
  - 当前应用使用纵向 tablist，`aria-orientation="vertical"`。
  - 当前应用不再存在 `select[aria-label="当前应用"]` 或 combobox。
  - 当前选中应用为“基础门户 / base-portal”，且选中 tab 未被禁用。
  - 左侧可选权限组面板高度 544px，右侧绑定结果预览高度 4476px，左侧未被右侧等高拉伸。
  - 页面无横向溢出、console error 或失败请求。

## 未完成事项

- 尚未提交、发布或部署。
- 现有 `test:responsive` 脚本在应用详情 `tab=roles` 检查处超时，建议后续单独排查脚本 mock 数据或页面路由状态。
