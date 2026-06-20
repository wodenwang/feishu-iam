# Feishu IAM v0.6.0 生产化 Compose 部署说明

本文档用于把 Feishu IAM `v0.6.0` 部署到内网服务器 `192.168.2.112`，对外访问域名为 `http://feishu-iam.example.com`。本文只记录部署步骤、配置项名称和安全原则，不记录真实密钥、token、cookie、密码或 client secret。

## 部署目标

- 服务器地址：`192.168.2.112`
- 部署用户：`dev`
- 部署目录：`~/feishu-iam`
- 对外访问地址：`http://feishu-iam.example.com`
- Web 直连地址：`http://192.168.2.112:8000`
- 部署方式：Docker Compose
- 版本要求：`/version` 返回 `0.6.0`

当前阶段不配置 HTTPS，也不做高可用。域名到 `80` 的入口由服务器现有 nginx 承接，本版本不维护 nginx 或反向代理配置；后续如需证书、网关调整或多副本部署，应作为独立版本处理。

## 目录结构

服务器部署目录为 `~/feishu-iam`。根目录只保留运行入口文件和少量必要配置，运行数据放入清晰的子目录：

```text
~/feishu-iam
├── docker-compose.yaml
├── .env
├── upgrade.sh
├── config/
├── logs/
├── data/
│   └── postgres/
└── backups/
```

说明：

- `docker-compose.yaml` 来自仓库的 `deploy/docker-compose.yml`。
- `upgrade.sh` 来自仓库的 `deploy/upgrade.sh`。
- `.env` 来自仓库的 `deploy/server.env.example`，真实值只保存在服务器本地。
- `config/`、`logs/`、`data/postgres/` 和 `backups/` 映射到容器或升级脚本使用的宿主机目录。

## 核心规则

- PostgreSQL 不映射宿主机端口，避免和其他 Compose 项目冲突。
- Web 默认映射到宿主机 `8000` 端口，可通过 `.env` 的 `HOST_WEB_PORT` 调整。
- Web 镜像从 `feishu-iam` 拉取，服务器不构建源码镜像。
- 升级使用 `./upgrade.sh` 停机静态更新：拉镜像、停 `web`、备份数据库、执行 DDL、启动 `web`、检查 `/ready` 和 `/version`。
- 首个平台管理员通过 `INITIAL_PLATFORM_ADMIN_FEISHU_USER_ID` 指向真实飞书用户“王文哲”。
- 生产环境不再使用破窗 Web 登录，也不再配置 `BOOTSTRAP_SUPER_ADMIN_*`。

## 飞书回调地址

在飞书开放平台的 Feishu IAM 企业自建应用中登记以下 OAuth 回调地址：

```text
http://feishu-iam.example.com/admin/auth/feishu/callback
http://feishu-iam.example.com/oauth/feishu/callback
```

两类回调不要混用：

- 管理后台飞书登录使用 `FEISHU_ADMIN_OAUTH_REDIRECT_URI`。
- 第三方应用 SSO 流程使用 `FEISHU_OAUTH_REDIRECT_URI`。

Feishu IAM 仍然只配置一个企业级飞书自建应用，第三方应用不单独保存飞书应用凭证。

## 首次部署

从本机登录服务器并准备目录：

```bash
ssh dev@192.168.2.112
mkdir -p ~/feishu-iam/config ~/feishu-iam/logs ~/feishu-iam/data/postgres ~/feishu-iam/backups
cd ~/feishu-iam
chmod 700 backups
```

准备运行入口文件。可以从发布包、仓库或运维分发目录复制以下文件：

```bash
cp /path/to/deploy/docker-compose.yml ./docker-compose.yaml
cp /path/to/deploy/upgrade.sh ./upgrade.sh
cp /path/to/deploy/server.env.example ./.env
chmod +x ./upgrade.sh
chmod 600 .env
```

编辑 `.env` 时只在服务器本地填写真实值，不要把 `.env`、真实凭证、截图或终端输出提交到仓库、文档、聊天消息或会话归档。

需要重点确认的配置项：

- `COMPOSE_PROJECT_NAME=feishu-iam`，便于 `docker ps` 中看到 `feishu-iam-db-1` 和 `feishu-iam-web-1`。
- `FEISHU_IAM_IMAGE=feishu-iam`。
- `FEISHU_IAM_IMAGE_TAG=v0.6.0`。
- `APP_VERSION=0.6.0`。
- `FEISHU_IAM_GIT_REMOTE=git@github.com:wodenwang/feishu-iam.git`。
- `FEISHU_IAM_GIT_SYNC=auto`，部署目录是 Git 仓库时自动同步当前分支；三文件部署目录会跳过。
- `FEISHU_IAM_GIT_REF` 默认留空，表示跟随当前分支；如需固定升级分支或 tag 再显式填写。
- `HOST_WEB_PORT=8000`。
- `FEISHU_IAM_PUBLIC_URL=http://feishu-iam.example.com`。
- `FEISHU_IAM_HEALTHCHECK_URL=http://192.168.2.112:8000`，用于服务器本机升级自检。
- `ADMIN_WEB_BASE_URL=http://feishu-iam.example.com`。
- `POSTGRES_DATA_DIR=/home/dev/feishu-iam/data/postgres`。
- `FEISHU_IAM_CONFIG_DIR=/home/dev/feishu-iam/config`。
- `FEISHU_IAM_LOG_DIR=/home/dev/feishu-iam/logs`。
- `FEISHU_IAM_BACKUP_DIR=/home/dev/feishu-iam/backups`。
- `INITIAL_PLATFORM_ADMIN_FEISHU_USER_ID` 填写“王文哲”的飞书 `user_id`。

`POSTGRES_PASSWORD` 与 `DATABASE_URL` 中的密码必须一致。如果密码包含特殊字符，`DATABASE_URL` 中需要按 URL 规则编码。

登录镜像仓库并执行首次启动：

```bash
docker login registry.example.com
docker compose pull web
./upgrade.sh
```

`./upgrade.sh` 会先判断部署目录是否为 Git 仓库：如果是，会把 `origin` 调整为 `git@github.com:wodenwang/feishu-iam.git` 并执行 `fetch` 与 `pull --ff-only`；如果只是 `docker-compose.yaml`、`.env`、`upgrade.sh` 三文件部署目录，会跳过 Git 同步。随后脚本会启动 `db`、备份数据库、执行镜像内 `/app/migrations` 目录中的 DDL、启动 `web` 并检查版本。首次部署时 `backups/` 下会生成初始备份文件；如果数据库为空，备份仍然是升级闭环的一部分。

## 日常命令

查看服务状态：

```bash
docker compose ps
docker ps --filter name=feishu-iam
```

查看 Web 日志：

```bash
docker compose logs -f web
```

进入数据库容器：

```bash
docker compose exec db psql -U feishu_iam -d feishu_iam
```

执行升级：

```bash
./upgrade.sh
```

## 健康检查

服务启动后执行：

```bash
curl -fsS http://192.168.2.112:8000/health
curl -fsS http://192.168.2.112:8000/ready
curl -fsS http://192.168.2.112:8000/version
curl -fsS http://feishu-iam.example.com/version
```

通过标准：

- `/health` 返回服务健康。
- `/ready` 返回数据库和迁移就绪。
- `/version` 返回版本号 `0.6.0`。
- 浏览器访问 `http://feishu-iam.example.com` 可以打开 Feishu IAM 管理后台。

## 数据和备份

PostgreSQL 数据保存在宿主机 `~/feishu-iam/data/postgres/`。常规重启、重新拉取 Web 镜像或执行升级不应删除该目录。

`./upgrade.sh` 每次执行都会在 `~/feishu-iam/backups/` 下创建时间戳目录，并写入升级前数据库备份和版本检查结果。不要删除备份，除非已经确认保留周期、恢复策略和影响范围。

## 部署检查清单

- 已创建 `~/feishu-iam` 目录和 `config/`、`logs/`、`data/postgres/`、`backups/` 子目录。
- 根目录只保留 `docker-compose.yaml`、`.env`、`upgrade.sh` 和运行数据目录。
- `.env` 权限为 `600`，真实凭证未写入仓库。
- 飞书开放平台已登记两个 `8000` 端口回调地址。
- 已执行 `docker login registry.example.com`。
- 已执行 `./upgrade.sh`。
- `docker compose ps` 显示 `db` 和 `web` 正常运行。
- `docker ps` 中容器名带 `feishu-iam` 前缀。
- 宿主机未暴露 PostgreSQL `5432` 端口。
- `/health`、`/ready`、`/version` 检查通过。
- `/version` 返回 `0.6.0`。
- “王文哲”可以通过飞书登录管理后台，并具备 `platform_admin` 角色。
