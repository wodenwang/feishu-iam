# feishu-iam v0.1.17 Access Loop Verification Pack Implementation Plan

## Goal

交付 `v0.1.17 接入闭环验收包` 的第一个 vertical slice：

1. 新增当前版本验收脚本 `scripts/verify-v0.1-access-loop.sh`。
2. 脚本通过当前 runtime API 跑通 v0.1 接入闭环：mock Feishu 登录、初始化、同步状态/预检、应用创建、Application API 注册权限、角色授权、OAuth authorize/token、权限查询、审计回溯。
3. 更新 README 和第三方 Demo 文档，给出当前版本验收入口。
4. 归档 QA/review 证据到 `design/implementation-screenshots/v0.1.17-access-loop-verification/`。

本计划不实现任何新的 IAM runtime 产品能力。

## Source Inputs

- Office-hours design: `/Users/wenzhewang/.gstack/projects/wodenwang-feishu-iam/wenzhewang-main-design-20260527-192722.md`
- Eng review: `docs/superpowers/plans/2026-05-27-v0.1.17-access-loop-verification-eng-review.md`
- Product spec: `docs/v0.1-product-spec.md`
- Existing verification script: `scripts/verify-v0.1.2-access-loop.sh`
- Existing OAuth test shape: `server/tests/oauth.test.ts`
- Project rules: `AGENTS.md`, `CLAUDE.md`

## Version Scope

### In Scope

- `scripts/verify-v0.1-access-loop.sh`
- README v0.1 验收入口
- `examples/thirdparty-demo/README.md`
- `docs/integration/thirdparty-demo.md`
- `design/implementation-screenshots/v0.1.17-access-loop-verification/v0.1.17-qa-report.md`
- `design/implementation-screenshots/v0.1.17-access-loop-verification/v0.1.17-review-report.md`

### Out Of Scope

- `/directory` 编辑、导入、导出、删除或目录治理 UI
- 飞书 webhook、event sync、incremental sync 或同步告警
- OIDC discovery、JWKS、PKCE、refresh token、复杂 consent
- redirect URI 管理 UI
- secret rotation、secret reset、多 secret 生命周期
- 多人应用管理员维护 UI
- SDK、CLI、Helm、Terraform、install.sh/upgrade.sh 产品化
- 第三方 Demo UI 视觉重构
- push、PR、tag、GitHub Release、deploy

## Engineering Decisions

1. 验收脚本是 API black-box，不直接写数据库。
2. 自动验收要求本地 mock Feishu runtime；真实飞书验收在 README 中作为手动外部配置说明。
3. OAuth 主路径必须覆盖 `/api/oauth/authorize` 和 `/api/oauth/token`，权限查询必须使用 bearer token + Application API HMAC。
4. 脚本输出不得打印 `appSecret`、`apiSecret`、bearer token、cookie、HMAC signature 或飞书凭证。
5. 同步子系统只做 `GET /api/sync/status` 和 mock `POST /api/sync/preflight` 检查，不触发真实 full sync。
6. 审计断言只检查动作存在和本次唯一 suffix 相关内容，不暴露 secret。

## File Tasks

### Verification Script

- `scripts/verify-v0.1-access-loop.sh`
  - Copy safe helper shape from `scripts/verify-v0.1.2-access-loop.sh`.
  - Add `redirect: 'manual'` OAuth authorize helper.
  - Add token exchange helper.
  - Add bearer + HMAC permission query helper.
  - Add sync status and preflight checks.
  - Add audit action checks.
  - Print only safe summary fields.

### Docs

- `README.md`
  - Add `v0.1 接入闭环验收` section.
  - Show runtime start command, script command and Demo manual check path.
  - Keep public README free of private deploy details.
- `examples/thirdparty-demo/README.md`
  - Clarify OAuth mode is the default current verification path.
  - Clarify `.env` values come from application creation and must stay local.
  - Clarify allow/deny expected pages.
- `docs/integration/thirdparty-demo.md`
  - Update wording from v0.1.13-only description to current v0.1.17 verification context.
  - Add automatic script vs manual browser verification split.

### Evidence

- `design/implementation-screenshots/v0.1.17-access-loop-verification/v0.1.17-qa-report.md`
  - Record commands run and results.
- `design/implementation-screenshots/v0.1.17-access-loop-verification/v0.1.17-review-report.md`
  - Record local review findings and risk status.

## First Vertical Slice Steps

1. Add the new verification script.
2. Run it against a local mock runtime.
3. Fix script/runtime-documentation issues found by the script.
4. Update README and Demo docs with the final command path.
5. Run targeted syntax checks and full local verification commands.
6. Write QA/review reports.
7. Stop before Git remote, tag, release or deploy unless explicit authorization is provided.

## Verification Commands

```bash
bash scripts/verify-v0.1-access-loop.sh
node --check examples/thirdparty-demo/src/server.js
npm run server:test
npm test
npm run build
npm run server:build
git diff --check
```

Runtime needed for script:

```bash
DATABASE_URL=postgres://postgres:postgres@127.0.0.1:55432/feishu_iam_v017 \
SESSION_SECRET=local-session-secret-at-least-32-bytes \
FEISHU_AUTH_MODE=mock \
npm run server:dev
```

## Completion Criteria For Current Slice

- `scripts/verify-v0.1-access-loop.sh` exists and is executable.
- Script passes against a fresh local mock runtime.
- Script verifies OAuth authorize/token and Application API permission query with bearer token.
- Script verifies allow/deny permission results.
- Script verifies sync status/preflight in mock mode.
- Script verifies key audit actions.
- README and Demo docs describe how to rerun the verification without leaking secret values.
- QA and review reports exist under `design/implementation-screenshots/v0.1.17-access-loop-verification/`.
- Fresh verification evidence is recorded.
- No push, PR, tag, release or deploy is performed without explicit authorization.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|---|---|---:|---:|---|---|
| Office Hours | `my-harness-autopilot-slice`前置 | 锁定 `v0.1.17 接入闭环验收包` | 1 | clear | 不新增产品能力，只做验收包。 |
| Eng Review | local `/plan-eng-review` equivalent | 脚本、OAuth、sync、audit、secret 输出边界 | 1 | clear-with-limits | 自动验收使用 mock Feishu；真实飞书和 v0.2 能力不进入本 slice。 |
| Writing Plans | Superpowers `writing-plans` equivalent | 明确文件路径、任务、测试和完成标准 | 1 | ready | 可进入第一个 vertical slice 实现。 |
