# feishu-iam v0.3.0 Sync Events Implementation Plan

**Goal:** 交付 `v0.3.0 飞书事件同步可靠性`，让系统可以接收飞书事件订阅回调、完成基础校验、幂等记录事件，并在同步页提供可见的处理和重试入口。

**Status:** implemented; fresh verification evidence is recorded under `design/implementation-screenshots/v0.3.0-sync-events/`.

## Scope

### In Scope

- `POST /api/feishu/events` URL verification、Verification Token、可选 Encrypt Key 签名校验和解密。
- `sync_events` migration。
- 平台管理员事件状态、列表和重试 API。
- `/sync` 页面飞书事件同步区域。
- `scripts/verify-v0.3-sync-events.sh` runtime 验收脚本。
- README、CHANGELOG、VERSION、package metadata。

### Out Of Scope

- `/directory` 编辑、导入、导出或目录治理。
- 告警平台、飞书机器人或 Slack 通知。
- 完整 incremental worker、OIDC/JWKS/PKCE/refresh token、SDK/CLI/Helm/Terraform。
- username/password、本地 root 或独立账号体系。

## Verification Commands

```bash
TEST_DATABASE_URL=postgres://postgres:postgres@127.0.0.1:55432/feishu_iam_test npm run server:test
npm test
npm run build
npm run server:build
RUNTIME_API_BASE_URL=http://127.0.0.1:4113 bash scripts/verify-v0.3-sync-events.sh
git diff --check
```
