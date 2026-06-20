# Feishu IAM v1.0.3 Base Portal 接入包与完整提示词实施计划

## 目标

完成 `v1.0.3` 的第一个可运行 vertical slice：管理员在应用详情中确认刷新凭证后，获得包含 OAuth `client_secret` 和 `developer_api_token` 的完整接入提示词；Base Portal 获得专用接入约束和 iframe 无感验收说明。

## 不可变边界

- 不新增 DDL。
- 不实现完整 OIDC、refresh token、SAML、ABAC、资源级权限或 deny 规则。
- 不长期明文保存 developer API token。
- 不放宽 `redirect_uri` 精确匹配。
- 不改变管理员 session、权限裁剪、平台管理员初始化或部署拓扑。
- 审计、安全事件、文档、截图和会话归档不得记录真实 secret、token、cookie、authorization、授权码、hash 或 ciphertext。

## 文件清单

- Modify `IMPLEMENTATION_PLAN.md`：同步当前 v1.0.3 计划。
- Create `docs/superpowers/specs/2026-06-20-feishu-iam-v1.0.3-base-portal-integration-prompt.md`。
- Create `docs/superpowers/plans/2026-06-20-feishu-iam-v1.0.3-base-portal-integration-prompt.md`。
- Create `.my-harness/status.md`：记录 15 步状态和下一步。
- Modify `apps/api/src/oauth/developer-credential.service.ts`。
- Modify `apps/api/src/oauth/integration-prompt.service.ts`。
- Modify `apps/api/src/admin/admin-oauth-config.controller.ts`。
- Modify `apps/api/test/developer-credential.service.spec.ts`。
- Modify `apps/api/test/admin.controller.e2e-spec.ts`。
- Modify `apps/api/test/integration-prompt.service.spec.ts`。
- Modify `apps/admin-web/src/api/oauth.ts`。
- Modify `apps/admin-web/src/features/applications/ApplicationDetailSheet.tsx`。
- Modify `apps/admin-web/src/features/applications/ApplicationManagementView.test.tsx`。
- Modify `README.md`、`CHANGELOG.md`、`docs/sso-provider.md`、`docs/oauth-troubleshooting.md`。
- Create `docs/acceptance/v1.0.3-base-portal-integration-prompt.md`。
- Create `docs/codex-sessions/2026-06-20-0215-v1.0.3-base-portal-integration-prompt.md`。

## Task 1: 后端刷新完整提示词

- [x] `DeveloperCredentialService` 新增 `rotatePrimaryCredential`。
- [x] `IntegrationPromptService` 支持 Base Portal preset 和完整提示词主路径。
- [x] `AdminOauthConfigController` 新增 `POST /integration-prompt/refresh`。
- [x] 后端测试覆盖 token 轮换、完整提示词、敏感值不进入审计。

## Task 2: 管理后台主流程

- [x] `apps/admin-web/src/api/oauth.ts` 新增 `refreshApplicationIntegrationPrompt`。
- [x] 应用详情 `开发信息` Tab 移除安全版提示词主展示。
- [x] 新增接入预检、强确认、刷新完整提示词、复制完整提示词。
- [x] 前端测试覆盖刷新和复制。

## Task 3: 文档和版本

- [x] README、CHANGELOG、SSO Provider、排障文档同步 v1.0.3。
- [x] 验收记录和 Codex 会话归档使用中文，不记录真实 secret。
- [x] `.my-harness/status.md` 更新 15 步证据账本。

## Task 4: 验证

- [x] `pnpm --filter @feishu-iam/api test -- test/developer-credential.service.spec.ts test/integration-prompt.service.spec.ts test/admin.controller.e2e-spec.ts`
- [x] `pnpm --filter @feishu-iam/admin-web test -- src/features/applications/ApplicationManagementView.test.tsx`
- [x] `pnpm check`
- [x] `pnpm build`
- [x] Browser/Playwright 检查应用详情 `开发信息` Tab。

## 完成标准

- 管理员可通过一次确认生成完整提示词。
- OAuth `client_secret` 和 developer API token 在同一个数据库事务中轮换。
- 完整提示词包含 Base Portal preset。
- developer API token 不可长期回看，只在轮换响应提示词中出现。
- 旧安全版提示词不再作为前端主入口。
- 所有验证命令有新鲜证据。
