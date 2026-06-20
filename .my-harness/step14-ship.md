# v1.0.5 step14 gstack /ship 记录

时间：2026-06-20 23:30 CST

## 范围

本步骤对应 my-harness step14：`gstack /ship`。

目标：

- 完成 release commit 前最终验证。
- 审计覆盖率、计划完成度和 pre-landing 风险。
- 整理 intended diff，准备提交、推送、tag 和 GitHub Release。

## 输入证据

- `.my-harness/status.md`
- `.my-harness/runs/2026-06-20-v1.0.5-permission-workbench.md`
- `.my-harness/step13-git-closeout-preflight.md`
- `docs/superpowers/plans/2026-06-20-feishu-iam-v1.0.5-permission-workbench.md`
- `docs/superpowers/specs/2026-06-20-feishu-iam-v1.0.5-permission-workbench.md`
- `output/playwright/v1.0.5-permission-workbench/browser-report.json`
- `.gstack/qa-reports/v1.0.5-step11/report.md`
- `.gstack/review-reports/v1.0.5-step12-review.md`

`.gstack/` 为 gstack native 目录且被 `.gitignore` 忽略；本索引只记录链接和摘要，不强制纳入 release commit。

## 覆盖率审计

子代理只读审计给出基线：`72%`，10 个缺口，过默认最低线 `60%`，低于目标线 `80%`。

已按推荐路径补充 4 个 focused tests，覆盖 3 个关键缺口：

- `apps/admin-web/src/api/permission.test.ts`：跨应用同一全局角色合并。
- `apps/admin-web/src/api/permission.test.ts`：应用权限保存使用新 `groupIds` 请求体。
- `apps/admin-web/src/features/permissions/PermissionManagementView.test.tsx`：角色列表批量停用确认、后端调用和刷新。
- `apps/api/test/permission-calculation.service.spec.ts`：权限计算只查询绑定当前应用且绑定启用的角色授权，并按当前应用过滤权限组和权限点。

更新后 ship 覆盖率估算约 `80%`，达到目标线。剩余风险：

- 迁移 duplicate role key 阻断只在 SQL 审阅中确认，未新增自动化失败路径。
- 真实后端、真实管理员 session 和 112 停机升级验收留到 step15。

## 计划完成审计

子代理结论：PASS。

- total_items：44
- done：44
- changed：10
- deferred：0
- unverifiable：0

未发现真正 NOT DONE 或需要用户决策的 UNVERIFIABLE；生产部署属于 step15，不阻塞 step14。

## Pre-Landing Review

由于当前 gstack vendor 未暴露 `.agents/skills/gstack/review/checklist.md`，本次按 `/review` 核心口径手动审查：

- SQL / 数据安全：`migrations/V1_0_5__role_application_bindings.sql` 包含 duplicate role key 阻断、role-application 复合外键、权限组/权限点复合外键和幂等 schema_versions 写入。
- 权限计算：`PermissionCalculationService` 要求应用 active、用户 active、角色 active、角色-应用绑定 active，并按当前应用过滤权限组和权限点。
- 写操作权限：角色新增、编辑、应用绑定和启停均要求 platform_admin；组织 / 用户绑定和应用权限绑定仍要求可管理当前应用。
- 安全边界：敏感词扫描命中均为既有凭证管理代码、测试假值或文档安全说明，未发现真实 secret、token、cookie、authorization、授权码或 raw payload 泄漏。
- 前端 UX：角色工作台为独立页面；应用详情角色管理入口移除；旧 deep link 保持兼容；新增补测覆盖批量停用和 API payload。

结论：未发现 P0/P1 阻塞项。

## 新鲜验证

已执行：

```bash
pnpm --filter @feishu-iam/admin-web test -- src/api/permission.test.ts src/features/permissions/PermissionManagementView.test.tsx
pnpm --filter @feishu-iam/api test -- test/permission-calculation.service.spec.ts
pnpm check
pnpm build
git diff --check
```

结果：

- focused tests 通过：Admin Web 2 个文件 10 个用例；API 1 个文件 11 个用例。
- `pnpm check` 通过：类型检查、lint、后端 41 个测试文件 484 个用例、前端 18 个测试文件 159 个用例。
- `pnpm build` 通过：后端 NestJS 构建完成，前端 Vite 构建完成；Vite chunk size warning 为既有构建提示。
- `git diff --check` 通过。

## 下一步

继续完成 step14 剩余动作：

- stage intended files。
- 检查 staged diff 和敏感信息。
- 创建 release commit。
- 推送分支 / 进入 main release 流程。
- 创建 `v1.0.5` tag 和 GitHub Release。
- 然后进入 step15 `gstack /land-and-deploy`。
