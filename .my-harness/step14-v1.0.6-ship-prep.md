# Feishu IAM v1.0.6 step14 gstack /ship prep

时间：2026-06-21 02:58 CST

## 结论

结论：`READY_FOR_LOCAL_COMMIT`。

本步骤按 gstack `/ship` 口径执行最终收口准备，但遵守本次 Codex 兼容要求：不进入 Plan mode，不调用交互式选择工具。本轮已获得 stage / commit 授权；push、tag、GitHub Release、上传镜像或 deploy 仍未授权。

## 本次补齐的 ship 前缺口

- `package.json`：版本号更新到 `1.0.6`。
- `apps/api/package.json`：版本号更新到 `1.0.6`。
- `apps/admin-web/package.json`：版本号更新到 `1.0.6`。
- `apps/api/src/version/version.controller.ts`：fallback 更新到 `1.0.6-dev`。
- `CHANGELOG.md`：顶部新增 `v1.0.6 - 权限管理 UI/UX 小版本` 条目。
- `README.md`：更新当前源码版本、v1.0.6 部署口径、版本历史和文档索引；明确 GitHub Release、镜像上传和生产部署仍待授权。

## 本次 intended commit boundary

应纳入同一个 v1.0.6 release commit 的源码和测试：

- `apps/admin-web/src/features/org-browser/org-browser.tsx`
- `apps/admin-web/src/features/org-browser/org-user-selector.tsx`
- `apps/admin-web/src/features/org-browser/org-user-selector.test.tsx`
- `apps/admin-web/src/features/permissions/PermissionRoleDetailSheet.tsx`
- `apps/admin-web/src/features/permissions/PermissionRoleDetailSheet.test.tsx`
- `apps/api/src/version/version.controller.ts`
- `apps/api/test/version.controller.e2e-spec.ts`
- `package.json`
- `apps/api/package.json`
- `apps/admin-web/package.json`

应纳入提交的文档、计划、harness 索引和会话归档：

- `README.md`
- `CHANGELOG.md`
- `IMPLEMENTATION_PLAN.md`
- `.my-harness/status.md`
- `.my-harness/runs/2026-06-21-v1.0.6-permission-uiux.md`
- `.my-harness/step13-v1.0.6-git-closeout-preflight.md`
- `.my-harness/step14-v1.0.6-ship-prep.md`
- `docs/design-audits/2026-06-21-permission-management-uiux/v1.0.6-product-design-audit.md`
- `docs/superpowers/specs/2026-06-21-feishu-iam-v1.0.6-permission-uiux.md`
- `docs/superpowers/plans/2026-06-21-feishu-iam-v1.0.6-permission-uiux.md`
- `docs/codex-sessions/2026-06-21-0111-role-subjects-layout-fix.md`
- `docs/codex-sessions/2026-06-21-0234-v1.0.6-permission-uiux.md`
- `docs/codex-sessions/2026-06-21-0301-v1.0.6-ship-prep.md`

应纳入提交的浏览器证据：

- `output/playwright/v1.0.6-permission-uiux-audit/uiux-audit.json`
- `output/playwright/v1.0.6-permission-uiux-audit/*.png`

不应纳入提交：

- `node_modules/`
- `dist/`
- `.env`
- 明文 secret、token、cookie、authorization、授权码
- `.gstack/` 原始报告
- 与 v1.0.6 权限管理 UI/UX 无关的临时文件

## 验证命令

已重新运行：

```bash
pnpm --filter @feishu-iam/admin-web test -- src/features/permissions/PermissionRoleDetailSheet.test.tsx src/features/org-browser/org-user-selector.test.tsx
pnpm --filter @feishu-iam/api test -- test/version.controller.e2e-spec.ts
pnpm --filter @feishu-iam/admin-web typecheck
pnpm --filter @feishu-iam/admin-web lint
pnpm --filter @feishu-iam/admin-web build
git diff --check
```

结果：

- Admin Web focused tests 通过：2 个测试文件、3 个用例。
- API `/version` focused test 通过：1 个测试文件、1 个用例。
- Admin Web typecheck 通过。
- Admin Web lint 通过。
- Admin Web build 通过；Vite chunk size warning 为既有提示。
- `git diff --check` 通过。

## 建议 stage 命令

用户已明确授权执行：

```bash
git add \
  package.json \
  apps/api/package.json \
  apps/admin-web/package.json \
  apps/api/src/version/version.controller.ts \
  apps/api/test/version.controller.e2e-spec.ts \
  README.md \
  CHANGELOG.md \
  .my-harness/status.md \
  .my-harness/runs/2026-06-21-v1.0.6-permission-uiux.md \
  .my-harness/step13-v1.0.6-git-closeout-preflight.md \
  .my-harness/step14-v1.0.6-ship-prep.md \
  IMPLEMENTATION_PLAN.md \
  apps/admin-web/src/features/org-browser/org-browser.tsx \
  apps/admin-web/src/features/org-browser/org-user-selector.tsx \
  apps/admin-web/src/features/org-browser/org-user-selector.test.tsx \
  apps/admin-web/src/features/permissions/PermissionRoleDetailSheet.tsx \
  apps/admin-web/src/features/permissions/PermissionRoleDetailSheet.test.tsx \
  docs/codex-sessions/2026-06-21-0111-role-subjects-layout-fix.md \
  docs/codex-sessions/2026-06-21-0234-v1.0.6-permission-uiux.md \
  docs/codex-sessions/2026-06-21-0301-v1.0.6-ship-prep.md \
  docs/design-audits/2026-06-21-permission-management-uiux/v1.0.6-product-design-audit.md \
  docs/superpowers/specs/2026-06-21-feishu-iam-v1.0.6-permission-uiux.md \
  docs/superpowers/plans/2026-06-21-feishu-iam-v1.0.6-permission-uiux.md \
  output/playwright/v1.0.6-permission-uiux-audit
```

建议提交信息：

```text
fix: polish permission workbench ui v1.0.6
```

## 下一步推荐提示词

```text
请继续完成 Feishu IAM v1.0.6 的远端发布准备：我授权你在当前本地 commit 基础上执行必要的 push、tag 和 GitHub Release 创建，但不要上传镜像或 deploy，除非我另行明确授权。执行前请复核 `git status`、当前 commit、tag 是否已存在、GitHub Release 是否已存在、README/CHANGELOG 口径和敏感信息边界；执行后输出 release URL、tag、commit hash 和下一步 Step 15 land-and-deploy 所需的推荐提示词。执行完毕后，请按照 my-harness 规定的流程输出 `流程执行情况一览：` 15 步进度表，并在末尾继续给出下一步可直接复制执行的 `推荐提示词`。如果项目已经在使用 my-harness，请创建或更新 `.my-harness/` 快速索引，记录步骤状态、关键决策、证据链接、验证命令和下一步提示词。Superpowers、gstack、Product Design、Pencil 等第三方技能生成的文档必须继续保留在其规范目录中，`.my-harness/` 只保存链接和简短摘要。这个末尾提示词必须同时包含本句要求，让用户后续只需要复制末尾提示词继续推进，不需要重新询问 next action。
```
