# Feishu IAM v0.5.1 内网部署说明

本文档用于把 Feishu IAM `v0.5.1` 通过 Docker Compose 部署到内网服务器 `192.168.2.112:3000`。文档只记录部署步骤、配置项名称和安全原则，不记录真实密钥、token、cookie、密码或 client secret。

## 部署目标

- 服务器地址：`192.168.2.112`
- 部署用户：`dev`
- 部署目录：`~/feishu-iam`
- 访问地址：`http://192.168.2.112:3000`
- 部署方式：Docker Compose
- 版本要求：`/version` 返回 `0.5.1`

当前阶段不配置 HTTPS、域名或反向代理。后续如需证书、网关或统一入口，应作为独立版本处理。

由于 `v0.5.1` 明确使用内网 IP 验收，Feishu IAM 的 `dev` 环境允许 RFC1918 私有 IPv4 的 HTTP 应用回调；`test` 和 `prod` 环境仍必须使用 HTTPS。

## 服务器前置条件

服务器需要具备以下命令：

- Git：用于同步 `git@github.com:wodenwang/feishu-iam.git`。
- Docker：用于运行 PostgreSQL 和 API 容器。
- Docker Compose：使用 Docker CLI 的 `docker compose` 子命令。
- Node.js、Corepack 和 pnpm：用于执行 `pnpm db:migrate`。如果服务器不准备安装 pnpm，也可以直接执行项目脚本 `bash deploy/apply-migrations.sh`。

建议先在服务器上检查：

```bash
git --version
docker --version
docker compose version
node --version
corepack --version
pnpm --version
```

如果服务器没有 pnpm，但已有 Bash、Docker 和 Docker Compose，可以跳过 pnpm 命令，使用 `bash deploy/apply-migrations.sh` 执行迁移。

## 飞书回调地址

在飞书开放平台的 Feishu IAM 企业自建应用中登记以下 OAuth 回调地址：

```text
http://192.168.2.112:3000/admin/auth/feishu/callback
http://192.168.2.112:3000/oauth/feishu/callback
```

两类回调不要混用：

- 管理后台飞书登录使用 `FEISHU_ADMIN_OAUTH_REDIRECT_URI`。
- 第三方应用 SSO 流程使用 `FEISHU_OAUTH_REDIRECT_URI`。

Feishu IAM 仍然只配置一个企业级飞书自建应用，第三方应用不单独保存飞书应用凭证。

## 首次部署

从本机登录服务器并准备目录：

```bash
ssh dev@192.168.2.112
mkdir -p ~/feishu-iam
cd ~/feishu-iam
```

如果 `~/feishu-iam` 还不是 Git 仓库，执行首次克隆：

```bash
git clone git@github.com:wodenwang/feishu-iam.git .
git checkout release/v0.5.1
git pull --ff-only
```

如果 `~/feishu-iam` 已经是 Git 仓库，执行安全更新：

```bash
git fetch --all --prune
git checkout release/v0.5.1
git pull --ff-only
```

准备服务器本地环境文件：

```bash
cp deploy/server.env.example .env
chmod 600 .env
vi .env
```

编辑 `.env` 时只在服务器本地填写真实值，不要把 `.env`、`deploy/.env` 或任何真实凭证提交到仓库、文档、截图、聊天消息或会话归档。

需要重点确认的配置项：

- `FEISHU_IAM_PUBLIC_URL` 使用 `http://192.168.2.112:3000`。
- `ADMIN_WEB_BASE_URL` 使用 `http://192.168.2.112:3000`。
- `FEISHU_OAUTH_REDIRECT_URI` 使用第三方 SSO 飞书回调地址。
- `FEISHU_ADMIN_OAUTH_REDIRECT_URI` 使用管理后台飞书回调地址。
- `APP_VERSION` 使用 `0.5.1`。
- 数据库密码、平台管理凭证、破窗账号哈希和飞书应用凭证只写入服务器本地 `.env`。

## 环境加载规则

`deploy/compose.sh` 是当前版本的 Compose 入口。它按以下顺序加载环境：

1. 仓库根目录 `.env`。
2. `deploy/.env`。
3. Compose 文件中的默认值。

根目录 `.env` 优先级最高。服务器部署建议使用根目录 `.env`，也可以使用 `deploy/.env`；两者都不能提交。启动、日志、重启和排障命令应优先通过 `bash deploy/compose.sh` 执行，避免手写不同的 Compose 参数。

## 启动服务

首次部署或版本更新后执行迁移并启动服务。如果服务器已安装 pnpm：

```bash
pnpm db:migrate
bash deploy/compose.sh up -d --build api
```

如果服务器未安装 pnpm，直接执行迁移脚本：

```bash
bash deploy/apply-migrations.sh
bash deploy/compose.sh up -d --build api
```

说明：

- `pnpm db:migrate` 会按项目脚本启动 PostgreSQL 并执行版本化迁移。
- `bash deploy/apply-migrations.sh` 是迁移脚本的直接入口，适用于不通过 pnpm scripts 的服务器环境。
- `bash deploy/compose.sh up -d --build api` 会按环境加载规则构建并启动 API，PostgreSQL 依赖由 Compose 处理。

## 健康检查

服务启动后执行：

```bash
curl -fsS http://192.168.2.112:3000/health
curl -fsS http://192.168.2.112:3000/ready
curl -fsS http://192.168.2.112:3000/version
```

通过标准：

- `/health` 返回服务健康。
- `/ready` 返回数据库和迁移就绪。
- `/version` 返回版本号 `0.5.1`。
- 浏览器访问 `http://192.168.2.112:3000` 可以打开 Feishu IAM 管理后台。

## 日志、状态和重启

查看 Compose 服务状态：

```bash
bash deploy/compose.sh ps
```

查看 API 日志：

```bash
bash deploy/compose.sh logs -f api
```

重启 API：

```bash
bash deploy/compose.sh restart api
```

重新构建并启动 API：

```bash
bash deploy/compose.sh up -d --build api
```

## 数据保留

PostgreSQL 数据保存在 Compose 逻辑 volume `feishu_iam_pgdata`。由于 `deploy/server.env.example` 中 `COMPOSE_PROJECT_NAME` 使用 `feishu-iam`，Docker 实际创建的 volume 名通常是 `feishu-iam_feishu_iam_pgdata`。排障时如果 `docker volume ls` 看不到裸名 `feishu_iam_pgdata`，应查找带 Compose 项目前缀的实际 volume。

常规重启、重新构建 API 或执行迁移不应删除该 volume。不要执行带 volume 删除语义的 Compose 清理命令，除非用户明确要求清空数据并已确认备份、影响范围和回滚方案。

## 部署检查清单

- 已在服务器本地创建 `.env`，权限为 `600`。
- `.env` 中真实凭证未写入仓库。
- 飞书开放平台已登记两个回调地址。
- 已执行 `pnpm db:migrate` 或 `bash deploy/apply-migrations.sh`。
- 已执行 `bash deploy/compose.sh up -d --build api`。
- `bash deploy/compose.sh ps` 显示 PostgreSQL 和 API 正常运行。
- `/health`、`/ready`、`/version` 检查通过。
- `/version` 返回 `0.5.1`。
- 未执行会删除 `feishu_iam_pgdata` 逻辑 volume 或 `feishu-iam_feishu_iam_pgdata` 实际 volume 的清理命令。
