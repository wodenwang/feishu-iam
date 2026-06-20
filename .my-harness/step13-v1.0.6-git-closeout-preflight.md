# Feishu IAM v1.0.6 step13 Git closeout / ship preflight

## 结论

结论：`READY_FOR_STEP14_SHIP_WITH_NOTES`。

当前分支：`main`，状态为 `main...origin/main`，没有 ahead/behind 标记。

本步骤只做 Git closeout / `/ship` preflight。未执行 stage、commit、push、tag、release、上传镜像或 deploy。

## 当前工作区状态

Tracked modified files:

- `.my-harness/status.md`
- `IMPLEMENTATION_PLAN.md`
- `apps/admin-web/src/features/org-browser/org-browser.tsx`
- `apps/admin-web/src/features/org-browser/org-user-selector.tsx`
- `apps/admin-web/src/features/permissions/PermissionRoleDetailSheet.tsx`

Untracked files:

- `.my-harness/runs/2026-06-21-v1.0.6-permission-uiux.md`
- `apps/admin-web/src/features/org-browser/org-user-selector.test.tsx`
- `apps/admin-web/src/features/permissions/PermissionRoleDetailSheet.test.tsx`
- `docs/codex-sessions/2026-06-21-0111-role-subjects-layout-fix.md`
- `docs/codex-sessions/2026-06-21-0234-v1.0.6-permission-uiux.md`
- `docs/design-audits/2026-06-21-permission-management-uiux/v1.0.6-product-design-audit.md`
- `docs/superpowers/plans/2026-06-21-feishu-iam-v1.0.6-permission-uiux.md`
- `docs/superpowers/specs/2026-06-21-feishu-iam-v1.0.6-permission-uiux.md`
- `output/playwright/v1.0.6-permission-uiux-audit/`

`git diff --check` 通过。

## Intended Commit Boundary

建议作为一个 v1.0.6 release commit 收口，提交主题可使用：

```text
fix: polish permission workbench ui v1.0.6
```

应纳入提交的源码和测试：

- `apps/admin-web/src/features/org-browser/org-browser.tsx`
- `apps/admin-web/src/features/org-browser/org-user-selector.tsx`
- `apps/admin-web/src/features/org-browser/org-user-selector.test.tsx`
- `apps/admin-web/src/features/permissions/PermissionRoleDetailSheet.tsx`
- `apps/admin-web/src/features/permissions/PermissionRoleDetailSheet.test.tsx`

应纳入提交的计划、设计和过程证据：

- `.my-harness/status.md`
- `.my-harness/runs/2026-06-21-v1.0.6-permission-uiux.md`
- `.my-harness/step13-v1.0.6-git-closeout-preflight.md`
- `IMPLEMENTATION_PLAN.md`
- `docs/design-audits/2026-06-21-permission-management-uiux/v1.0.6-product-design-audit.md`
- `docs/superpowers/specs/2026-06-21-feishu-iam-v1.0.6-permission-uiux.md`
- `docs/superpowers/plans/2026-06-21-feishu-iam-v1.0.6-permission-uiux.md`
- `docs/codex-sessions/2026-06-21-0111-role-subjects-layout-fix.md`
- `docs/codex-sessions/2026-06-21-0234-v1.0.6-permission-uiux.md`

应纳入提交的浏览器证据：

- `output/playwright/v1.0.6-permission-uiux-audit/uiux-audit.json`
- `output/playwright/v1.0.6-permission-uiux-audit/*.png`

理由：仓库已跟踪 `output/playwright/v1.0.5-permission-workbench/`，本轮 `v1.0.6` 截图和 JSON 报告是 UI/UX 修复的可复核证据，不属于 `dist/`、`node_modules/` 或本地密钥一类临时产物。

## 不应纳入提交

本次检查未发现以下不应入库内容：

- `node_modules/`
- `dist/`
- `.env`
- 明文 secret、token、cookie、authorization、授权码
- `.gstack/` 原始报告

当前 `.gstack/` 未出现在 `git status --short` 中；若后续需要引用 gstack 原始报告，优先继续由 `.my-harness/`、会话归档和 `output/playwright/` 做摘要和证据链接，不强制提交 `.gstack/`。

## README / CHANGELOG / Version Preflight

当前版本文件仍是 `1.0.5`：

- `package.json`：`1.0.5`
- `apps/api/package.json`：`1.0.5`
- `apps/admin-web/package.json`：`1.0.5`
- `apps/api/src/version/version.controller.ts` fallback：`1.0.5-dev`

README / CHANGELOG 当前只记录到 `v1.0.5`：

- `README.md` Quick Start、镜像 tag、`/version` 示例、版本历史和文档索引仍指向 `v1.0.5`。
- `CHANGELOG.md` 顶部版本仍是 `v1.0.5`。

进入 step14 `/ship` 前建议补齐：

- 更新 `package.json`、`apps/api/package.json`、`apps/admin-web/package.json` 到 `1.0.6`。
- 更新 `apps/api/src/version/version.controller.ts` fallback 到 `1.0.6-dev`。
- 在 `CHANGELOG.md` 顶部新增 `v1.0.6 - 权限管理 UI/UX 小版本` 条目。
- 更新 `README.md` 的当前版本说明、版本历史和相关文档索引。
- 如果准备发布 Docker 镜像和部署，再同步 deploy 默认 tag / env 示例；如果只做本地候选提交，step14 应明确跳过部署默认值更新的原因。

## Validation Preflight

已通过：

```bash
pnpm --filter @feishu-iam/admin-web test -- src/features/permissions/PermissionRoleDetailSheet.test.tsx src/features/org-browser/org-user-selector.test.tsx
pnpm --filter @feishu-iam/admin-web typecheck
pnpm --filter @feishu-iam/admin-web lint
pnpm --filter @feishu-iam/admin-web build
git diff --check
```

浏览器报告：

```json
{
  "results": 15,
  "consoleErrors": 0,
  "failedRequests": 0,
  "failures": 0
}
```

报告路径：

- `output/playwright/v1.0.6-permission-uiux-audit/uiux-audit.json`

## 风险和注意事项

- 这是前端 UI/UX 小版本，不新增后端 DDL，不改变权限模型和权限计算。
- 当前代码和证据已经满足 step13 进入 step14 的基本条件，但正式 `/ship` 前必须补齐版本号、README 和 CHANGELOG。
- 如果 step14 选择同时发布 release/tag，应重新运行必要验证，并在 commit 后再做 tag / GitHub Release。
- 如果 step15 选择部署到生产，还需要构建镜像、远端升级和 `/ready`、`/version` 线上读回；当前 step13 未触碰部署。

## 建议 stage 命令

仅在用户授权进入 step14 后执行：

```bash
git add \
  .my-harness/status.md \
  .my-harness/runs/2026-06-21-v1.0.6-permission-uiux.md \
  .my-harness/step13-v1.0.6-git-closeout-preflight.md \
  IMPLEMENTATION_PLAN.md \
  apps/admin-web/src/features/org-browser/org-browser.tsx \
  apps/admin-web/src/features/org-browser/org-user-selector.tsx \
  apps/admin-web/src/features/org-browser/org-user-selector.test.tsx \
  apps/admin-web/src/features/permissions/PermissionRoleDetailSheet.tsx \
  apps/admin-web/src/features/permissions/PermissionRoleDetailSheet.test.tsx \
  docs/codex-sessions/2026-06-21-0111-role-subjects-layout-fix.md \
  docs/codex-sessions/2026-06-21-0234-v1.0.6-permission-uiux.md \
  docs/design-audits/2026-06-21-permission-management-uiux/v1.0.6-product-design-audit.md \
  docs/superpowers/specs/2026-06-21-feishu-iam-v1.0.6-permission-uiux.md \
  docs/superpowers/plans/2026-06-21-feishu-iam-v1.0.6-permission-uiux.md \
  output/playwright/v1.0.6-permission-uiux-audit
```

注意：若 step14 补齐 README / CHANGELOG / version 文件，上述 stage 列表需要一并加入对应文件。
