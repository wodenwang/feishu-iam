# Feishu IAM v1.0.5 my-harness 状态

## 当前目标

推进 `v1.0.5 - 权限管理角色配置工作台` 到发布、release 和远端部署完成。

本版本目标：

- 角色作为独立资源，不再附属于应用。
- 角色与应用支持多对多绑定。
- `权限管理` 首屏为角色列表。
- 角色配置工作台为独立页面，不是抽屉。
- `组织与用户`、`应用权限` 拆成两个工作区，避免单页过重。
- 组织和用户必须在同一个组织树选择器中勾选。
- 应用权限工作区支持应用切换、权限组绑定、权限点查看和权限点对比。
- 原 `应用管理` 中的角色管理能力必须移除。
- 应用管理保留应用详情、密钥、回调、Codex 提示词、权限组/权限点查看、查询和比对。

## 当前阶段

已完成到 step14：gstack `/ship` release commit 前验证。

step14 已完成覆盖率审计、计划完成审计、pre-landing review、focused tests、`pnpm check`、`pnpm build` 和 `git diff --check`。当前下一步是完成 step14 剩余 Git release 动作：stage、commit、push、tag 和 GitHub Release，然后进入 step15：`gstack /land-and-deploy`。

最后更新时间：2026-06-20 23:30 CST。

## 版本号

本次迭代版本号：`v1.0.5`。

## 关键决策

- D1=A：新增显式 `iam_role_applications` / role-application binding 模型。
- D2=B：旧深链迁移到独立角色工作台，并做兼容跳转 / Tab 映射。
- D3=B：低成本干净切换，优先服务当前 demo 与 base-portal，不为尚未接入的第三方体验过度设计。

## 流程执行情况一览

| 状态 | 步骤 | Harness 动作 | 判断 | 证据/原因 |
|---|---:|---|---|---|
| ✅ | 1 | Discovery / Brainstorm gate | 已完成 | 用户明确角色独立、应用多对多、权限管理首屏角色列表、应用管理移除角色管理 |
| ✅ | 2 | Product Design planning review | 已完成 | Product Design 静态原型覆盖角色列表、组织/用户绑定、应用权限绑定和角色编辑 |
| ✅ | 3 | Design artifact / visual target | 已完成 | Pencil 弃用；锁定 `design/prototypes/v1.0.5-permission-management/index.html` |
| ✅ | 4 | Product Design review of selected design artifact | 已完成 | 用户确认“可以，就这么定稿吧” |
| ✅ | 5 | gstack `/plan-eng-review` | 已完成 | 用户确认 D1=A、D2=B、D3=B；版本号锁定为 `v1.0.5` |
| ✅ | 6 | Superpowers `writing-plans` | 已完成 | `docs/superpowers/plans/2026-06-20-feishu-iam-v1.0.5-permission-workbench.md` |
| ✅ | 7 | Superpowers `executing-plans` / `subagent-driven-development` | 已完成 | 已完成后端 role-application 绑定、权限计算、前端角色列表、独立工作台、应用详情权限资产和兼容路由 |
| ✅ | 8 | Superpowers `verification-before-completion` | 已完成 | `prisma:validate`、focused tests、`pnpm check`、`pnpm build` 已通过 |
| ✅ | 9 | Browser verification | 已完成 | `output/playwright/v1.0.5-permission-workbench/browser-report.json`；无 console error、无失败请求、无响应错误 |
| ✅ | 10 | Product Design visual QA / design review | 已完成 | `docs/design-audits/2026-06-20-permission-management-ux/v1.0.5-implementation-design-qa.md` |
| ✅ | 11 | gstack `/qa` | 已完成 | `.gstack/qa-reports/v1.0.5-step11/report.md`；`pnpm check`、临时 PostgreSQL 迁移复跑、浏览器 QA 均通过 |
| ✅ | 12 | gstack `/review` | 已完成 | `.gstack/review-reports/v1.0.5-step12-review.md`；发现 2 个文档一致性问题并已修复 |
| ✅ | 13 | Git closeout / `/ship` preflight | 已完成 | `.my-harness/step13-git-closeout-preflight.md` |
| 🎯 | 14 | gstack `/ship` | 进行中 | `.my-harness/step14-ship.md`；已完成最终验证，待提交、推送、tag 和 GitHub Release |
| ⏳ | 15 | gstack `/land-and-deploy` | 待执行 | 等 release/部署授权后执行 |

## 验证证据

已通过：

```bash
DATABASE_URL='postgresql://<user>:<password>@localhost:5432/feishu_iam' pnpm --filter @feishu-iam/api prisma:validate
pnpm --filter @feishu-iam/admin-web typecheck
pnpm --filter @feishu-iam/admin-web test -- src/features/permissions/PermissionManagementView.test.tsx src/App.test.tsx
pnpm check
pnpm build
```

浏览器证据：

- `output/playwright/v1.0.5-permission-workbench/01-role-list.png`
- `output/playwright/v1.0.5-permission-workbench/02-role-workbench-overview.png`
- `output/playwright/v1.0.5-permission-workbench/03-role-workbench-subjects.png`
- `output/playwright/v1.0.5-permission-workbench/04-role-workbench-app-permissions-compare.png`
- `output/playwright/v1.0.5-permission-workbench/05-direct-role-without-appkey.png`
- `output/playwright/v1.0.5-permission-workbench/06-application-permission-assets.png`
- `output/playwright/v1.0.5-permission-workbench/browser-report.json`

Step11 QA 证据：

- `.gstack/qa-reports/v1.0.5-step11/report.md`
- `.gstack/qa-reports/v1.0.5-step11/browser-report.json`
- `.gstack/qa-reports/v1.0.5-step11/browser-qa.cjs`
- `.gstack/qa-reports/v1.0.5-step11/screenshots/01-role-list-platform.png`
- `.gstack/qa-reports/v1.0.5-step11/screenshots/02-role-list-actions.png`
- `.gstack/qa-reports/v1.0.5-step11/screenshots/03-workbench-subjects.png`
- `.gstack/qa-reports/v1.0.5-step11/screenshots/04-workbench-app-permissions.png`
- `.gstack/qa-reports/v1.0.5-step11/screenshots/05-old-deep-links.png`
- `.gstack/qa-reports/v1.0.5-step11/screenshots/06-application-permission-assets.png`
- `.gstack/qa-reports/v1.0.5-step11/screenshots/07-application-admin-boundary.png`

Step12 review 证据：

- `.gstack/review-reports/v1.0.5-step12-review.md`
- `docs/permission-model.md`
- `README.md`

Step13 preflight 证据：

- `.my-harness/step13-git-closeout-preflight.md`

Step14 ship 证据：

- `.my-harness/step14-ship.md`
- `pnpm --filter @feishu-iam/admin-web test -- src/api/permission.test.ts src/features/permissions/PermissionManagementView.test.tsx`
- `pnpm --filter @feishu-iam/api test -- test/permission-calculation.service.spec.ts`
- `pnpm check`
- `pnpm build`
- `git diff --check`

浏览器报告关键结果：

```json
{
  "consoleErrors": [],
  "requestFailures": [],
  "responseErrors": [],
  "hasRoleManagementTab": 0
}
```

## 关键制品

- v1.0.5 设计说明：`docs/superpowers/specs/2026-06-20-feishu-iam-v1.0.5-permission-workbench.md`
- v1.0.5 实施计划：`docs/superpowers/plans/2026-06-20-feishu-iam-v1.0.5-permission-workbench.md`
- v1.0.5 SOP：`design/v1.0.5-permission-management-sop.md`
- Product Design 静态原型：`design/prototypes/v1.0.5-permission-management/index.html`
- Product Design 原型说明：`design/prototypes/v1.0.5-permission-management/README.md`
- step10 设计 QA：`docs/design-audits/2026-06-20-permission-management-ux/v1.0.5-implementation-design-qa.md`
- run 记录：`.my-harness/runs/2026-06-20-v1.0.5-permission-workbench.md`

## 下一步

下一步必须继续完成 step14 `gstack /ship` 的 Git release 动作。不要重复执行 step11-step13，也不要重新跑 step14 已完成的验证部分，除非提交前 diff 又发生代码变化。

推荐提示词：

```text
继续按 my-harness 推进 Feishu IAM v1.0.5「权限管理角色配置工作台」，继续完成 step14 gstack /ship 的 Git release 动作。

要求：
- 继续按部就班，不跳步。
- 不进入 Plan mode。
- 不调用 AskUserQuestion、request_user_input 或任何交互式选择工具。
- 执行 step14 ship 剩余动作：整理 intended diff、复查 staged diff、提交、推送、创建 Git tag 和 GitHub Release。
- 本次目标已明确要求推进到发布、release 和远端部署，因此可以继续完成 release 所需的 Git 操作；仍需避免记录或输出任何 secret、token、cookie、authorization、授权码或敏感 raw payload。
- 完成 step14 后继续进入 step15 land-and-deploy，不要在 step14 完成后停止。
- 使用现有 step8-step14 证据作为输入，并补充 release commit、tag 和 GitHub Release 记录。
```
