# Feishu IAM v1.0.5 step13 Git closeout / ship preflight

## 结论

结论：`READY_FOR_STEP14_SHIP_WITH_NOTES`。

当前分支：`codex/v1.0.5-permission-workbench`。

当前 `HEAD` 与 `origin/main` 一致，v1.0.5 所有实现和过程制品仍处于未提交工作区。step13 未执行 commit、push、tag、release 或 deploy。

## Intended Diff

主要变更范围：

- 数据模型和迁移：`iam_role_applications`、角色全局化、角色-应用多对多绑定。
- 后端权限服务：角色列表、创建、状态、主体绑定、应用权限绑定、权限计算和审计语义。
- 管理后台：权限管理角色列表、独立角色配置工作台、统一组织用户选择器、应用权限工作区、权限点对比。
- 应用管理：移除角色管理 Tab、入口和角色 CRUD，保留权限资产查看、查询和比对。
- 路由和 URL：新角色工作台路由、旧角色路径和 `tab=subjects` / `tab=groups` / `tab=permissions` 兼容。
- 文档和流程：README、CHANGELOG、权限模型文档、设计/SOP/计划/QA/会话归档和 my-harness 索引。

`git diff --stat` 显示 tracked diff 约 37 个文件，当前还存在 v1.0.5 设计、计划、截图、迁移和会话归档等未跟踪文件，需要在 step14 `/ship` 中统一纳入提交边界。

## Untracked Files

应纳入 release commit 的未跟踪文件：

- `.my-harness/runs/2026-06-20-v1.0.5-permission-workbench.md`
- `design/prototypes/v1.0.5-permission-management/`
- `design/v1.0.5-permission-management-sop.md`
- `docs/codex-sessions/2026-06-20-1437-permission-management-ux.md`
- `docs/codex-sessions/2026-06-20-2059-v1.0.5-permission-workbench-plan.md`
- `docs/codex-sessions/2026-06-20-2213-v1.0.5-permission-workbench-step10.md`
- `docs/codex-sessions/2026-06-20-2242-v1.0.5-permission-workbench-step11-qa.md`
- `docs/codex-sessions/2026-06-20-2312-v1.0.5-permission-workbench-step12-review.md`
- `docs/design-audits/2026-06-20-permission-management-ux/`
- `docs/superpowers/plans/2026-06-20-feishu-iam-v1.0.5-permission-workbench.md`
- `docs/superpowers/specs/2026-06-20-feishu-iam-v1.0.5-permission-workbench.md`
- `migrations/V1_0_5__role_application_bindings.sql`
- `output/playwright/v1.0.5-permission-workbench/`

`.gstack/` 被 `.gitignore` 忽略。step11/step12 的 gstack 原始报告保留在本地 native 目录；如需要纳入 release commit，step14 必须显式 `git add -f .gstack/qa-reports/v1.0.5-step11 .gstack/review-reports/v1.0.5-step12-review.md`。当前建议不强制提交 `.gstack/`，由 `.my-harness/`、会话归档和 `output/playwright/` 提供可追溯证据。

## Version Preflight

已确认：

- `package.json`：`1.0.5`
- `apps/api/package.json`：`1.0.5`
- `apps/admin-web/package.json`：`1.0.5`
- `deploy/docker-compose.yml` 默认 tag：`v1.0.5`
- `deploy/server.env.example`：`FEISHU_IAM_IMAGE_TAG=v1.0.5`、`APP_VERSION=1.0.5`
- `apps/api/src/version/version.controller.ts` fallback：`1.0.5-dev`
- `README.md` 和 `CHANGELOG.md` 已记录 v1.0.5 本地收口状态；正式 release 后 step14/step15 需要改写为已发布和已部署证据。

## Validation Preflight

本轮新跑：

```bash
git diff --check
rg -n "角色属于单个应用|权限组、权限点和 IAM 角色都必须归属于某一个应用|删除和配置入口|点击应用后查看该应用的权限组、权限点和 IAM 角色" docs/permission-model.md README.md
```

结果：

- `git diff --check` 通过。
- 旧文案搜索无命中。

既有验证证据：

- step8：`prisma:validate`、focused tests、`pnpm check`、`pnpm build`。
- step9：Playwright browser report。
- step10：Product Design visual QA。
- step11：`pnpm check`、临时 PostgreSQL 迁移复跑、浏览器 QA。
- step12：落地前 review，2 个文档一致性问题已修复。

## Security Preflight

敏感信息扫描命中了测试假 secret、示例占位符和历史文档中的本地测试连接串；未发现应阻止提交的真实 secret、token、cookie、authorization、授权码或敏感 raw payload。

提交前仍需在 step14 再做一次 `git diff --cached` 级别复查。

## 下一步

进入 step14 `gstack /ship`。

建议 step14 执行动作：

1. 重新运行必要验证：至少 `pnpm check`、`pnpm build`、`git diff --check`。
2. 复查 `git status --short`、`git diff --stat`、`git diff --cached --stat`。
3. 决定是否强制纳入 `.gstack/` 原始报告。
4. `git add` intended diff。
5. commit v1.0.5。
6. push 分支 / main、创建 tag 和 GitHub Release，按项目授权执行。
7. 完成后进入 step15 `land-and-deploy`。
