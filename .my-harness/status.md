# Feishu IAM my-harness 状态

## v1.0.7 当前接续

当前目标：推进 `v1.0.7 - 权限管理信息架构收敛`，一个版本完成 S1 角色工作台减负和 S2 权限矩阵 MVP。

当前阶段：Step 15 `gstack /land-and-deploy` 已完成。`v1.0.7` 已完成本地实现、验证、浏览器响应式检查、视觉 QA、系统化 QA、代码 review、ship preflight、GitHub Release、镜像构建上传和生产停机升级。当前 SOP 已闭环。

关键证据：

- PRD：`docs/superpowers/specs/2026-06-21-feishu-iam-v1.0.7-permission-management-prd.md`
- 线上审计：`docs/design-audits/2026-06-21-permission-management-next-prd/audit-notes.md`
- Step 2 评审：`docs/design-audits/2026-06-21-permission-management-next-prd/step2-product-design-planning-review.md`
- my-harness run：`.my-harness/runs/2026-06-21-v1.0.7-permission-planning-review.md`
- Step 3 视觉方向：`design/product-design-v1.0.7-permission-management/visual-directions.md`
- Step 3 run：`.my-harness/runs/2026-06-21-v1.0.7-permission-visual-directions.md`
- Step 4 视觉评审：`design/product-design-v1.0.7-permission-management/selected-visual-target-review.md`
- Step 4 run：`.my-harness/runs/2026-06-21-v1.0.7-permission-selected-visual-review.md`
- Step 5 工程评审：`docs/superpowers/reviews/2026-06-21-feishu-iam-v1.0.7-permission-management-plan-eng-review.md`
- Step 5 run：`.my-harness/runs/2026-06-21-v1.0.7-permission-plan-eng-review.md`
- Step 6 实施计划：`docs/superpowers/plans/2026-06-21-feishu-iam-v1.0.7-permission-management.md`
- Step 6 run：`.my-harness/runs/2026-06-21-v1.0.7-permission-writing-plan.md`
- Step 7 首个切片 run：`.my-harness/runs/2026-06-21-v1.0.7-permission-executing-plan-slice1.md`
- Step 7 首个切片会话归档：`docs/codex-sessions/2026-06-21-1645-v1.0.7-executing-plan-slice1.md`
- Step 7 完整实现 run：`.my-harness/runs/2026-06-21-v1.0.7-permission-executing-plan-complete.md`
- Step 7 完整实现会话归档：`docs/codex-sessions/2026-06-21-1725-v1.0.7-permission-implementation-verification.md`
- Step 10 实现后视觉 QA：`docs/design-audits/2026-06-21-permission-management-next-prd/step10-implemented-visual-qa.md`
- Step 10 run：`.my-harness/runs/2026-06-21-v1.0.7-permission-step10-visual-qa.md`
- Step 10 视觉证据：`output/playwright/v1.0.7-permission-management-design-qa/10-role-workbench-title-final-1440.png`、`output/playwright/v1.0.7-permission-management-design-qa/11-manage-role-applications-dialog-final-1440.png`
- Step 11 QA 报告：`.gstack/qa-reports/2026-06-21-v1.0.7-permission-qa.md`
- Step 11 run：`.my-harness/runs/2026-06-21-v1.0.7-permission-step11-qa.md`
- Step 12 review 报告：`.gstack/reviews/2026-06-21-v1.0.7-permission-review.md`
- Step 12 run：`.my-harness/runs/2026-06-21-v1.0.7-permission-step12-review.md`
- Step 13 ship preflight：`.my-harness/runs/2026-06-21-v1.0.7-permission-step13-ship-preflight.md`
- Step 14 ship：`.my-harness/runs/2026-06-21-v1.0.7-permission-step14-ship.md`
- Step 15 land-and-deploy：`.my-harness/runs/2026-06-21-v1.0.7-permission-step15-land-and-deploy.md`
- GitHub Release：`https://github.com/wodenwang/feishu-iam/releases/tag/v1.0.7`
- 生产版本：`/version` 返回 `1.0.7 / 3ab1790`

流程执行情况一览：

| 状态 | 步骤 | Harness 动作 | 判断 | 证据/原因 |
|---|---:|---|---|---|
| ✅ | 1 | Discovery / Brainstorm gate | 前置已完成 | PRD、线上审计、GitHub issues `#6-#9`、用户确认 B |
| ✅ | 2 | Product Design planning review | 前置已完成 | `step2-product-design-planning-review.md` |
| ✅ | 3 | Design artifact / visual target | 前置已完成 | 用户确认 D1/D，视觉目标已选定 |
| ✅ | 4 | Product Design review of selected design artifact | 前置已完成 | `selected-visual-target-review.md`，无关键设计阻塞 |
| ✅ | 5 | gstack `/plan-eng-review` | 已完成 | `plan-eng-review.md`，确认一个版本可控，需新增矩阵服务和软解除 API |
| ✅ | 6 | Superpowers `writing-plans` | 已完成 | `2026-06-21-feishu-iam-v1.0.7-permission-management.md` |
| ✅ | 7 | Superpowers `executing-plans` | 已完成本地实现 | 已完成权限管理二级导航、创建角色根因修复、角色工作台减负、管理关联应用 Dialog、软解除 API、权限矩阵 API/UI、版本文档 |
| ✅ | 8 | Verification before completion | 已完成 | `pnpm check`、前后端 build、focused tests、`git diff --check` 均通过 |
| ✅ | 9 | Browser verification | 已完成 | `ADMIN_WEB_URL=http://localhost:4173 pnpm --filter @feishu-iam/admin-web test:responsive` 覆盖 14 条后台路由 x 4 视口，`failures: []` |
| ✅ | 10 | Product Design visual QA / design review | 已完成 | `step10-implemented-visual-qa.md`；修正页面模式重复标题和状态徽标拉伸；无关键设计阻塞 |
| ✅ | 11 | gstack `/qa` | 已完成 | `.gstack/qa-reports/2026-06-21-v1.0.7-permission-qa.md`；未发现 P0/P1/P2 |
| ✅ | 12 | gstack `/review` | 已完成 | `.gstack/reviews/2026-06-21-v1.0.7-permission-review.md`；P1/P2 已修复并复验 |
| ✅ | 13 | Git closeout / `/ship` preflight | 已完成 | `.my-harness/runs/2026-06-21-v1.0.7-permission-step13-ship-preflight.md`；提交边界、版本号、敏感信息和产物排除已检查 |
| ✅ | 14 | gstack `/ship` | 已完成 | commit `3ab1790`；tag `v1.0.7`；GitHub Release `https://github.com/wodenwang/feishu-iam/releases/tag/v1.0.7` |
| ✅ | 15 | gstack `/land-and-deploy` | 已完成 | 生产运行 `feishu-iam:v1.0.7`；`/ready` ready；`/version` 返回 `1.0.7 / 3ab1790`；备份目录 `/home/bpmt/feishu-iam/backups/20260621-180240` |

当前 SOP 已闭环。可选后续是发布后 canary 观察窗口。

---

# Feishu IAM v1.0.6 历史状态

## 当前目标

推进 `v1.0.6 - 权限管理 UI/UX 小版本`，修复生产权限管理模块中已标注和本地调研发现的前端体验问题。

本版本目标：

- `组织与用户` 待选区不再被右侧内容撑高。
- `应用权限` 可选权限组区域不再被右侧内容撑高。
- 当前应用切换使用纵向 tab，而不是下拉框。
- 角色工作台减少重复标题。
- `绑定结果预览` 和权限点对比有稳定滚动边界。

## 当前阶段

已完成 step1-step15。`v1.0.6` 已 push 到 GitHub，tag 和 GitHub Release 已创建，`linux/amd64` 离线镜像已上传并完成生产停机升级。

最后更新时间：2026-06-21 03:29 CST。

## 版本号

本次迭代版本号：`v1.0.6`。

## 关键决策

- D1：本版本只做前端 UI/UX 修复，不新增 DDL。
- D2：Product Design 专用工具当前不可用，使用用户生产标注、`DESIGN.md`、v1.0.5 定稿规格和 Playwright 三视口审计作为替代设计证据。
- D3：应用切换采用纵向 tab，并保留添加应用下拉作为次级动作。
- D4：权限点对比保留在主界面，不降级为弹窗。
- D5：`v1.0.6` README / CHANGELOG / package version 已按 release 和生产部署事实更新。
- D6：Step14 只授权 push、tag 和 GitHub Release；Step15 已另获授权执行镜像上传和生产 deploy。
- D7：生产部署沿用单机 Docker Compose 停机升级，使用 `FEISHU_IAM_PULL_POLICY=never` 和离线 tar 导入，不输出 `.env` 敏感配置。

## 流程执行情况一览

| 状态 | 步骤 | Harness 动作 | 判断 | 证据/原因 |
|---|---:|---|---|---|
| ✅ | 1 | Discovery / Brainstorm gate | 已完成 | 用户给出生产截图标注并要求权限管理 UI/UX 小版本 |
| ✅ | 2 | Product Design planning review | 已完成 | `docs/design-audits/2026-06-21-permission-management-uiux/v1.0.6-product-design-audit.md` |
| ✅ | 3 | Design artifact / visual target | 已完成 | 以生产标注和 Playwright 三视口截图作为视觉目标 |
| ✅ | 4 | Product Design review of selected design artifact | 已完成 | P0/P1 范围已锁定，不扩大到模型和后端 |
| ✅ | 5 | gstack `/plan-eng-review` | 已完成 | 工程边界锁定为前端布局、可访问 tab、标题层级和预览滚动 |
| ✅ | 6 | Superpowers `writing-plans` | 已完成 | `docs/superpowers/plans/2026-06-21-feishu-iam-v1.0.6-permission-uiux.md` |
| ✅ | 7 | Superpowers `executing-plans` | 已完成 | 已修改权限管理相关前端组件和 focused tests |
| ✅ | 8 | Superpowers `verification-before-completion` | 已完成 | Focused tests、typecheck、lint、build、`git diff --check` 均通过 |
| ✅ | 9 | Browser verification | 已完成 | `output/playwright/v1.0.6-permission-uiux-audit/uiux-audit.json`；5 条权限管理路径 x 3 个视口通过 |
| ✅ | 10 | Product Design visual QA / design review | 已完成 | 生产标注项和追加发现均在截图/report 中复核；无横向溢出、无 console error、无失败请求 |
| ✅ | 11 | gstack `/qa` | 已完成 | 本小版本执行 focused QA：权限管理路径、布局、可访问 tab、滚动边界 |
| ✅ | 12 | gstack `/review` | 已完成 | diff 仅涉及权限管理前端、测试、计划和验证证据；未发现需继续修复的 P0/P1 |
| ✅ | 13 | Git closeout / `/ship` preflight | 已完成 | `.my-harness/step13-v1.0.6-git-closeout-preflight.md`；已整理提交边界、版本文档缺口和授权动作，未 stage/commit/push |
| ✅ | 14 | gstack `/ship` | Release 已创建 | commit `31db6aa`；tag `v1.0.6`；GitHub Release `https://github.com/wodenwang/feishu-iam/releases/tag/v1.0.6`；未上传镜像、未 deploy |
| ✅ | 15 | gstack `/land-and-deploy` | 已完成 | 线上运行 `feishu-iam:v1.0.6`；`/ready` ready；`/version` 返回 `1.0.6 / 31db6aa`；备份目录 `/home/bpmt/feishu-iam/backups/20260621-032848` |

## 当前验证证据

已通过：

```bash
pnpm --filter @feishu-iam/admin-web test -- src/features/permissions/PermissionRoleDetailSheet.test.tsx src/features/org-browser/org-user-selector.test.tsx
pnpm --filter @feishu-iam/api test -- test/version.controller.e2e-spec.ts
pnpm --filter @feishu-iam/admin-web typecheck
pnpm --filter @feishu-iam/admin-web lint
pnpm --filter @feishu-iam/admin-web build
git diff --check
docker buildx build --platform linux/amd64 -f deploy/api.Dockerfile -t feishu-iam:v1.0.6 --load .
docker save feishu-iam:v1.0.6 -o /tmp/feishu-iam-v1.0.6-linux-amd64.tar
scp /tmp/feishu-iam-v1.0.6-linux-amd64.tar bpmt@120.24.236.92:/home/bpmt/feishu-iam/
ssh bpmt@120.24.236.92 'cd /home/bpmt/feishu-iam && docker load -i feishu-iam-v1.0.6-linux-amd64.tar && FEISHU_IAM_GIT_SYNC=false FEISHU_IAM_PULL_POLICY=never FEISHU_IAM_IMAGE_TAG=v1.0.6 APP_VERSION=1.0.6 GIT_COMMIT=31db6aa ./upgrade.sh'
curl -fsS https://feishu-iam.riversoft.com.cn/ready
curl -fsS https://feishu-iam.riversoft.com.cn/version
```

浏览器证据：

- `output/playwright/v1.0.6-permission-uiux-audit/uiux-audit.json`
- `output/playwright/v1.0.6-permission-uiux-audit/role-subjects-1440.png`
- `output/playwright/v1.0.6-permission-uiux-audit/role-permissions-1440.png`
- `output/playwright/v1.0.6-permission-uiux-audit/role-overview-1440.png`

浏览器报告关键结果：

```json
{
  "consoleErrors": [],
  "failedRequests": []
}
```

关键复核数据：

- `组织与用户` 桌面待选区：`content-start`，高度 470px；右侧已选区高度 406px，未被异常撑开。
- `应用权限` 当前应用：`aria-orientation="vertical"`，tab 数 2，当前应用下拉框不存在。
- `绑定结果预览` 桌面高度 788px，包含 `lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto`。
- `权限点对比` 包含 `max-h-[420px] overflow-auto`。
- `总览` 桌面 `角色配置工作台` 标题计数为 1，存在 `角色上下文` 和 `基础信息概览`。
- 生产 `/ready`：`{"status":"ready","checks":{"database":"ok"}}`。
- 生产 `/version`：`{"name":"feishu-iam-api","version":"1.0.6","commit":"31db6aa","node_env":"production"}`。
- 生产权限管理路由 smoke：`/admin/permissions`、角色 `tab=subjects`、角色 `tab=permissions` 均返回 HTTP 200。
- 镜像证据：本地 `feishu-iam:v1.0.6` 为 `linux/amd64`，本地镜像 ID `sha256:1bf04b6ec9c7c04c331dce7ff3e3bc09ef370d989099d1e2ee9616aad65624b5`；远端运行镜像 ID `sha256:58e6f5dbb5ee00564995595b25d06545d4e49f602007597c65dc4fd8c6b29abc`；tar SHA-256 `0e79ad15c748318769d372c6d98131340410dc589c7df98c2a86da2a48709e08`。
- 回滚基线：上一版镜像 `feishu-iam:v1.0.5`，上一版线上 `/version` 为 `1.0.5 / ed98409`；本次升级备份目录 `/home/bpmt/feishu-iam/backups/20260621-032848`。

## 关键制品

- v1.0.6 设计调研：`docs/design-audits/2026-06-21-permission-management-uiux/v1.0.6-product-design-audit.md`
- v1.0.6 规格：`docs/superpowers/specs/2026-06-21-feishu-iam-v1.0.6-permission-uiux.md`
- v1.0.6 实施计划：`docs/superpowers/plans/2026-06-21-feishu-iam-v1.0.6-permission-uiux.md`
- v1.0.6 run：`.my-harness/runs/2026-06-21-v1.0.6-permission-uiux.md`
- v1.0.6 step13 preflight：`.my-harness/step13-v1.0.6-git-closeout-preflight.md`
- v1.0.6 step14 ship prep：`.my-harness/step14-v1.0.6-ship-prep.md`
- v1.0.6 step15 land-and-deploy：`.my-harness/step15-v1.0.6-land-and-deploy.md`
- v1.0.6 CHANGELOG：`CHANGELOG.md`
- v1.0.6 README：`README.md`
- v1.0.6 ship prep 会话归档：`docs/codex-sessions/2026-06-21-0301-v1.0.6-ship-prep.md`
- v1.0.6 land-and-deploy 会话归档：`docs/codex-sessions/2026-06-21-0329-v1.0.6-land-and-deploy.md`
- v1.0.6 GitHub Release：`https://github.com/wodenwang/feishu-iam/releases/tag/v1.0.6`
- v1.0.6 release commit：`31db6aa`
- v1.0.6 tag：`v1.0.6`
- v1.0.6 生产镜像：`feishu-iam:v1.0.6`
- v1.0.6 生产部署目录：`bpmt@120.24.236.92:/home/bpmt/feishu-iam`
- v1.0.6 升级备份目录：`/home/bpmt/feishu-iam/backups/20260621-032848`

## 下一步

`v1.0.6` 已完成 Step15 `gstack /land-and-deploy`。下一步建议执行发布后 canary/观察窗口，继续只读复核关键登录、权限管理页面和第三方 SSO Demo 链路。

推荐提示词：

```text
请继续完成 Feishu IAM v1.0.6 发布后 canary 观察：基于当前已部署的 `https://feishu-iam.riversoft.com.cn/`、GitHub Release `https://github.com/wodenwang/feishu-iam/releases/tag/v1.0.6`、生产镜像 `feishu-iam:v1.0.6`、部署目录 `bpmt@120.24.236.92:/home/bpmt/feishu-iam`，只读复核 `/ready`、`/version`、权限管理关键页面、角色配置工作台 `组织与用户` 和 `应用权限` 两个 tab、以及第三方 SSO Demo 基础链路；不要修改代码、不要上传镜像、不要 deploy，除非我另行明确授权。执行完毕后，请按照 my-harness 规定的流程输出 `流程执行情况一览：` 15 步进度表，并在末尾继续给出下一步可直接复制执行的 `推荐提示词`。如果项目已经在使用 my-harness，请创建或更新 `.my-harness/` 快速索引，记录步骤状态、关键决策、证据链接、验证命令和下一步提示词。Superpowers、gstack、Product Design、Pencil 等第三方技能生成的文档必须继续保留在其规范目录中，`.my-harness/` 只保存链接和简短摘要。这个末尾提示词必须同时包含本句要求，让用户后续只需要复制末尾提示词继续推进，不需要重新询问 next action。
```
