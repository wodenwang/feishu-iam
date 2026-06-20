# Feishu IAM 部署说明

本文档是当前版本的部署入口。详细历史部署记录仍保留在 `docs/deploy-v0.5.1.md`、`docs/deploy-v0.6.0.md` 和 `docs/codex-sessions/`。

## 当前版本

- 当前版本：`v1.0.4`
- 默认镜像：`feishu-iam:v1.0.4`
- 部署模型：单机 Docker Compose 停机升级
- 生产入口：`https://feishu-iam.riversoft.com.cn`

## 关键配置

生产 `.env` 必须只保存在服务器本地，不得提交仓库。至少确认：

```text
FEISHU_IAM_IMAGE_TAG=v1.0.4
APP_VERSION=1.0.4
FEISHU_IAM_PUBLIC_URL=https://feishu-iam.riversoft.com.cn
FEISHU_IAM_HEALTHCHECK_URL=https://feishu-iam.riversoft.com.cn
ADMIN_WEB_BASE_URL=https://feishu-iam.riversoft.com.cn
TRUST_PROXY=1
FEISHU_OAUTH_REDIRECT_URI=https://feishu-iam.riversoft.com.cn/oauth/feishu/callback
FEISHU_ADMIN_OAUTH_REDIRECT_URI=https://feishu-iam.riversoft.com.cn/admin/auth/feishu/callback
```

不要在文档、提交、日志或会话归档中记录真实数据库密码、飞书密钥、OAuth `client_secret`、developer API token、cookie、authorization code 或 access token。

## v1.0.4 silent SSO 部署注意

- 新增迁移 `migrations/V1_0_4__oauth_silent_sso.sql`。
- 迁移会新增 `oauth_browser_sessions`，并为 `applications` 增加 `silent_sso_enabled` 和 `silent_sso_allowed_origins`。
- 迁移会为 `feishu-iam-sso-demo` 预置生产 silent SSO origin：`https://feishu-iam-sso-demo.riversoft.com.cn`。
- 生产反向代理下必须保持 `TRUST_PROXY=1`，确保 Secure cookie 场景可正确运行。
- Base Portal 不需要、也不允许传递 token、cookie、authorization code 或 secret。

## 升级命令

```bash
cd /home/bpmt/feishu-iam
FEISHU_IAM_IMAGE_TAG=v1.0.4 APP_VERSION=1.0.4 ./upgrade.sh
```

升级完成后检查：

```bash
curl -fsS https://feishu-iam.riversoft.com.cn/ready
curl -fsS https://feishu-iam.riversoft.com.cn/version
```

`/ready` 应返回 ready，`/version` 应返回 `1.0.4` 和本次部署 commit。
