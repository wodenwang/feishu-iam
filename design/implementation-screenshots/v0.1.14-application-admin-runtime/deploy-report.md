# v0.1.14 部署记录

## 发布对象

- 版本：`v0.1.14`
- 发布主题：应用管理员 Runtime
- 合并 PR：`https://github.com/wodenwang/feishu-iam/pull/15`
- 发布提交：`8e5eb6ce1941882bf8b3f88b0623b02e23e32819`
- GitHub Release：`https://github.com/wodenwang/feishu-iam/releases/tag/v0.1.14`
- 部署时间：`2026-05-26 20:44 CST`

## 部署环境

- 目标主机：`bpmt-120`
- 目标目录：`/home/bpmt/feishu-iam`
- Compose 服务：`feishu-iam`、`postgres`
- 应用镜像：`feishu-iam:v0.1.14`
- 对外端口：`8002 -> 4100`

## 部署动作

1. 使用 `git archive --format=tar HEAD` 将仓库受控文件同步到远端部署目录。
2. 保留远端 `.env` 与 `data/postgres`，并创建 `.env.backup-v0.1.14-20260526204244`。
3. 将远端 `.env` 中的 `FEISHU_IAM_IMAGE_TAG` 更新为 `v0.1.14`。
4. 在远端执行 `docker compose up -d --build` 完成镜像构建、容器重建和启动。

## 验证证据

- 远端 Compose 状态：

```text
feishu-iam            feishu-iam:v0.1.14    Up (healthy)    0.0.0.0:8002->4100/tcp
feishu-iam-postgres   postgres:16-alpine    Up (healthy)    5432/tcp
```

- 远端本机健康检查：

```json
{"ok":true}
```

- 公网健康检查：

```json
{"ok":true}
```

- 已应用数据库迁移：

```text
001_runtime
002_access_loop
003_thirdparty_oauth
004_oauth_pending_requests
005_application_admins
```

## 边界确认

- 本版本没有重开 `v0.1.13` OAuth 小收口边界。
- 应用管理员绑定继续以飞书用户为唯一身份来源，没有引入本地 username/password。
- 远端 `.env`、飞书应用凭证、tokens 和 PostgreSQL 数据目录未纳入仓库同步。
