# Feishu IAM v1.0.3 my-harness 状态

## 当前目标

完成 `v1.0.3 - Base Portal 接入包与完整提示词收敛`。

## 流程执行情况一览

| 状态 | 步骤 | Harness 动作 | 判断 | 证据/原因 |
|---|---:|---|---|---|
| ✅ | 1 | Discovery / Brainstorm gate | 前置已完成 | 已确认 Base Portal 是首个真实第三方接入场景，目标是完整提示词和按需轮换凭证 |
| ✅ | 2 | Product Design planning review | 前置已完成 | 本版本是应用详情开发信息区的小范围后台流程，不新建视觉体系，沿用 `DESIGN.md` |
| ⏭️ | 3 | Design artifact / visual target | 前置无需进行 | 无新页面或新视觉方向，只改既有开发信息 Tab 的任务流 |
| ⏭️ | 4 | Product Design review | 前置无需进行 | 无独立视觉制品 |
| ✅ | 5 | gstack `/plan-eng-review` | 前置已完成 | 架构决策记录在 v1.0.3 spec：不新增 DDL、不长期明文保存 developer token、不扩大 OAuth |
| ✅ | 6 | Superpowers `writing-plans` | 已完成 | `IMPLEMENTATION_PLAN.md` 和版本化计划已同步 v1.0.3 范围、文件、验证和完成标准 |
| ✅ | 7 | Superpowers `executing-plans` | 已完成 | 已落地后端刷新完整提示词、同事务凭证轮换、前端开发信息 Tab 主流程、接入预检和文档同步 |
| ✅ | 8 | Superpowers `verification-before-completion` | 已完成 | `pnpm check`、`pnpm build`、定向测试和 Playwright 自检均已通过 |
| ✅ | 9 | gstack `/browse` verification | 已完成 | Playwright 覆盖 390px / 1280px 刷新完整提示词点击流，并运行 responsive overflow 检查 |
| ✅ | 10 | Product Design visual QA / design review | 已完成 | 本版本为既有开发信息 Tab 小范围后台任务流，浏览器自检未发现横向溢出、遮挡或导航回退 |
| ✅ | 11 | gstack `/qa` | 已完成 | 覆盖后端 471 个用例、前端 160 个用例、13 个路由多视口响应式检查 |
| ✅ | 12 | gstack `/review` | 已完成 | 已复核 secret 边界、审计脱敏、长期明文 token 禁止、README 不越权声明生产部署 |
| ✅ | 13 | Git closeout / `/ship` preflight | 已完成 | 用户已选择 D1，只提交 v1.0.3 候选版改动，不包含并行域名清理改动 |
| ✅ | 14 | gstack `/ship` | 已授权执行 | 范围为 commit、tag `v1.0.3`、push 和 GitHub Release；不包含生产部署 |
| 🎯 | 15 | gstack `/land-and-deploy` | 待授权 | 未获 deploy 授权前不执行镜像发布、生产部署或 canary |

## 关键制品

- 规格：`docs/superpowers/specs/2026-06-20-feishu-iam-v1.0.3-base-portal-integration-prompt.md`
- 计划：`docs/superpowers/plans/2026-06-20-feishu-iam-v1.0.3-base-portal-integration-prompt.md`
- 当前执行计划：`IMPLEMENTATION_PLAN.md`

## 下一步

等待用户明确 ship preflight 的 D1/D2/D3，并授权是否进入 `/ship`。生产镜像发布、部署和 canary 属于 `/land-and-deploy`，需要单独授权。
