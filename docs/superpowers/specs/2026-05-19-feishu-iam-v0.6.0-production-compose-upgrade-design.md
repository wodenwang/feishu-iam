# Feishu IAM v0.6.0 生产化 Compose 部署与停机升级设计

日期：2026-05-19
状态：已确认设计方向，待用户审阅书面规格

## 1. 版本目标

`v0.6.0` 的目标是把 `v0.5.1` 已验证的内网服务，从“可验收运行”升级为“可长期部署、可升级、可备份、可交接”的单机 Docker Compose 部署形态。

一句话边界：

`v0.6.0 = 内网 HTTP 下的生产化 Docker Compose 部署与停机升级闭环`。

版本完成后，应能证明：

1. Feishu IAM 可以部署在 `192.168.2.112` 的 `~/feishu-iam` 目录下。
2. 服务器部署目录结构清晰，根目录只保留运行入口文件和少量必要配置。
3. Docker Compose 只运行 `db` 和 `web` 两类服务，不考虑高可用。
4. PostgreSQL 不映射宿主机端口，避免和其他 Compose 项目冲突。
5. Web 服务端口由 `.env` 配置，默认使用宿主机 `8000` 端口。
6. Web 服务使用 GitLab Docker Registry 镜像，不在服务器上构建源码。
7. `upgrade.sh` 可以完成停机静态升级：拉取镜像、停止 Web、备份数据库、执行未应用 DDL、启动 Web、检查健康状态和版本。
8. 数据库初始化后，真实飞书用户“王文哲”是首个 `platform_admin`。
9. 生产路径不再依赖破窗 Web 登录或 `BOOTSTRAP_SUPER_ADMIN_*` 环境变量。

## 2. 不纳入范围

`v0.6.0` 不做以下能力：

- HTTPS、域名、反向代理或网关接入。
- 高可用、滚动升级、蓝绿发布或多 Web 实例。
- 完整 OIDC Discovery、JWKS、ID Token。
- SAML。
- refresh token。
- 资源级权限、ABAC、deny 规则或数据范围权限。
- 飞书角色同步或飞书用户组同步。
- 多租户 SaaS 化。
- 平台 API token 的完整 scope 化。

这些能力如需继续推进，应进入后续独立版本。

## 3. 服务器目录结构

服务器部署目录固定为：

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

目录职责：

- `docker-compose.yaml`：服务器实际使用的 Compose 文件。
- `.env`：服务器本地环境变量，包含端口、镜像 tag、数据库密码、飞书应用配置等；不进入仓库。
- `upgrade.sh`：服务器本地升级入口脚本。
- `config/`：应用运行配置挂载目录，预留给后续配置文件。
- `logs/`：Web 容器日志挂载目录，便于服务器侧查看和归档。
- `data/postgres/`：PostgreSQL 数据目录。
- `backups/`：`upgrade.sh` 每次升级前生成的数据库备份。

根目录不放完整源码仓库，不放构建产物，不放临时排障文件。部署目录只保留运行 Feishu IAM 所需的 Compose、配置、脚本和挂载目录。

## 4. Compose 形态

`v0.6.0` 使用单 Compose 项目：

```text
COMPOSE_PROJECT_NAME=feishu-iam
```

服务名保持短而稳定：

- `db`
- `web`

这样 `docker ps` 中容器名会带项目前缀，例如：

```text
feishu-iam-db-1
feishu-iam-web-1
```

同时，Compose 内部命令仍保持简洁：

```bash
docker compose exec db psql -U feishu_iam -d feishu_iam
docker compose logs -f web
```

不显式设置 `container_name`。原因是 Compose 默认命名已经满足可读性，同时避免同机临时测试栈、恢复演练或排障时出现固定容器名冲突。

## 5. 服务配置

### 5.1 `db`

`db` 使用 PostgreSQL 16 Alpine 镜像。

关键规则：

- 不配置 `ports`，不把 `5432` 映射到宿主机。
- 数据目录映射到 `./data/postgres:/var/lib/postgresql/data`。
- 通过 healthcheck 暴露数据库就绪状态。
- PostgreSQL 用户、密码和数据库名来自 `.env`。

### 5.2 `web`

`web` 使用 GitLab Docker Registry 中的 Feishu IAM 镜像：

```text
192.168.2.73:5050/ai/feishu-iam:${FEISHU_IAM_IMAGE_TAG}
```

关键规则：

- 不在服务器上执行源码 build。
- 宿主机端口由 `HOST_WEB_PORT` 控制，默认 `8000`。
- 容器端口由 `CONTAINER_WEB_PORT` 控制，默认 `3000`。
- `web` 依赖 `db` healthy 后启动。
- `./config` 映射到容器配置目录。
- `./logs` 映射到容器日志目录。

建议端口配置：

```text
HOST_WEB_PORT=8000
CONTAINER_WEB_PORT=3000
FEISHU_IAM_PUBLIC_URL=http://192.168.2.112:8000
ADMIN_WEB_BASE_URL=http://192.168.2.112:8000
```

当前版本仍使用内网 HTTP 地址。飞书管理后台回调和第三方 SSO 中转回调应同步登记为 `8000` 端口下的地址。

## 6. 服务器 `.env` 约定

服务器 `.env` 至少包含：

```text
COMPOSE_PROJECT_NAME=feishu-iam
HOST_WEB_PORT=8000
CONTAINER_WEB_PORT=3000
FEISHU_IAM_IMAGE_TAG=v0.6.0
FEISHU_IAM_PUBLIC_URL=http://192.168.2.112:8000
ADMIN_WEB_BASE_URL=http://192.168.2.112:8000

POSTGRES_DB=feishu_iam
POSTGRES_USER=feishu_iam
POSTGRES_PASSWORD=<服务器本地强密码>
DATABASE_URL=postgresql://feishu_iam:<服务器本地强密码>@db:5432/feishu_iam?schema=public

FEISHU_APP_ID=<飞书企业自建应用 app_id>
FEISHU_APP_SECRET=<飞书企业自建应用 app_secret>
FEISHU_OAUTH_REDIRECT_URI=http://192.168.2.112:8000/oauth/feishu/callback
FEISHU_ADMIN_OAUTH_REDIRECT_URI=http://192.168.2.112:8000/admin/auth/feishu/callback
```

说明：

- 上述尖括号内容是说明性占位，不应提交真实值。
- `PLATFORM_ADMIN_TOKEN` 如仍用于平台自动化脚本，可以保留在服务器 `.env`，但 Web 管理端不得依赖它。
- 不再配置 `BOOTSTRAP_SUPER_ADMIN_USERNAME` 和 `BOOTSTRAP_SUPER_ADMIN_PASSWORD_HASH`。
- 真实 `.env`、密码、飞书密钥、平台 token、client secret、cookie 不进入仓库、文档和会话归档。

## 7. 升级脚本

服务器根目录的 `upgrade.sh` 是唯一升级入口。

升级流程：

1. 读取 `.env`。
2. 校验 Docker、Docker Compose 和必需环境变量。
3. 使用 `docker compose pull web` 拉取目标镜像。
4. 停止 Web 服务：`docker compose stop web`。
5. 启动或保持数据库运行：`docker compose up -d db`。
6. 等待 `db` healthcheck 通过。
7. 备份数据库到 `backups/YYYYMMDD-HHMMSS/feishu_iam.sql`。
8. 执行目标镜像内未应用的 DDL。
9. 启动 Web 服务：`docker compose up -d web`。
10. 检查 `FEISHU_IAM_PUBLIC_URL/ready`。
11. 检查 `FEISHU_IAM_PUBLIC_URL/version`，确认版本符合目标镜像。
12. 输出升级结果、备份路径和当前镜像 digest。

升级是停机静态更新。脚本不做滚动升级、双实例切换或自动回滚。

如果 DDL 执行失败：

- 不启动新 Web。
- 输出失败 DDL 文件名、备份路径和排障提示。
- 保留数据库现场，等待人工处理。

## 8. 版本 DDL 策略

仓库继续使用版本化 SQL：

```text
migrations/V0_6_0__production_compose_upgrade.sql
```

规则：

- 每个发布版本如有数据库变化，必须提供对应 DDL。
- 即使版本没有结构变化，也可以提供轻量 DDL 写入 `schema_versions`，让升级记录完整。
- DDL 必须通过 `schema_versions` 或 `IF NOT EXISTS` 等方式保持可重跑安全。
- `upgrade.sh` 只执行目标镜像内未应用的 DDL，不执行服务器手写临时 SQL。
- 迁移脚本从目标镜像内读取 `/app/migrations`，服务器部署目录不需要保存源码仓库。
- DDL 文件中不得写入真实密钥、token、cookie、密码或 client secret。

## 9. 首个平台管理员初始化

`v0.6.0` 改为使用真实飞书用户“王文哲”作为首个平台管理员。

设计规则：

1. 实施阶段使用 `lark-cli` 查询“王文哲”的飞书用户信息，并人工确认唯一匹配。
2. 初始化绑定以飞书 `user_id` 为准，不以姓名作为长期主键。
3. 需要确认该用户在飞书中为可用、未删除、未离职或未停用状态。
4. 若 `feishu_users` 镜像表中尚无该用户，升级初始化应失败并提示先完成飞书同步。
5. 若该用户已存在于 `admin_users`，则确保其拥有 `platform_admin` 角色。
6. 若该用户尚未绑定管理员，则创建 `admin_users` 并绑定 `platform_admin`。
7. 初始化写入审计日志，actor 使用 `system`，source 使用 `deployment_init`。

建议实现方式：

- 在服务器 `.env` 中配置 `INITIAL_PLATFORM_ADMIN_FEISHU_USER_ID`。
- 该值由实施阶段通过 `lark-cli` 查询“王文哲”后写入服务器本地 `.env`。
- DDL 或初始化脚本读取该变量完成绑定。
- 仓库文档只说明配置项用途，不记录真实 `user_id` 之外的敏感凭证。

“王文哲”完成飞书管理员登录后，应可以：

- 进入管理后台。
- 查看自己的 `platform_admin` 角色。
- 创建应用管理员。
- 管理应用、权限、SSO client 和回调地址。
- 查看审计日志和安全事件。

## 10. 破窗入口退出策略

`v0.6.0` 的生产路径不再使用破窗 Web 登录。

需要移除或关闭：

- 管理端“破窗登录”入口。
- 后端 `/admin/auth/bootstrap` 生产入口。
- `BOOTSTRAP_SUPER_ADMIN_USERNAME`。
- `BOOTSTRAP_SUPER_ADMIN_PASSWORD_HASH`。
- 破窗模式下只开放管理员授权工作区的生产逻辑。

如果本地开发仍需应急入口，应单独通过开发开关控制，例如：

```text
ENABLE_BOOTSTRAP_LOGIN=true
NODE_ENV=development
```

生产默认必须关闭。`v0.6.0` 验收应覆盖生产环境下破窗入口不可访问。

## 11. 安全要求

- 数据库端口不暴露到宿主机。
- 服务器 `.env` 权限建议设置为 `600`。
- `upgrade.sh` 生成的备份目录权限建议设置为 `700`。
- 所有密钥、token、cookie、密码和 client secret 只保存在服务器本地 `.env` 或安全介质中。
- 日志、审计、文档和会话归档不得记录明文 secret。
- 初始化管理员审计只记录管理员 ID、飞书 `user_id`、角色 key、结果和 request id。
- `client_secret`、飞书 `app_secret`、平台 token 不得出现在审计 `before`、`after`、错误响应和日志中。

## 12. 验收标准

`v0.6.0` 完成时应提供以下证据：

1. `docker compose config --quiet` 通过。
2. `docker compose up -d` 后，`docker compose ps` 显示 `db` 和 `web` 正常运行。
3. `docker ps` 中容器名带 `feishu-iam` 前缀。
4. 宿主机没有暴露 PostgreSQL `5432` 端口。
5. `http://192.168.2.112:8000/ready` 返回 ready。
6. `http://192.168.2.112:8000/version` 返回 `v0.6.0` 对应版本信息。
7. `upgrade.sh` 完成一次停机升级演练，并在 `backups/` 下生成数据库备份。
8. `schema_versions` 中存在 `0.6.0` 记录。
9. “王文哲”可通过飞书登录管理后台，角色包含 `platform_admin`。
10. “王文哲”可以创建应用管理员并管理应用配置。
11. 生产环境 `/admin/auth/bootstrap` 不可作为破窗入口使用。
12. 文档、脚本和会话归档不包含真实密钥、token、cookie、密码或 client secret。

## 13. 发布流程建议

1. 创建 `release/v0.6.0` 分支。
2. 实现 Compose、升级脚本、迁移执行、管理员初始化和破窗退出。
3. 补充 `migrations/V0_6_0__production_compose_upgrade.sql`。
4. 更新部署说明、验收清单、README、CHANGELOG 和 AGENTS 当前阶段。
5. 本地运行 `pnpm check`、Prisma 校验、Compose config 校验和脚本语法检查。
6. 构建并推送 `192.168.2.73:5050/ai/feishu-iam:v0.6.0` 镜像。
7. 在 `192.168.2.112` 执行停机升级演练。
8. 完成真实飞书管理员登录和管理后台验收。
9. 合并回 `main`。
10. 创建 `v0.6.0` tag。

## 14. 风险与处理

- 如果服务器没有登录 GitLab Registry，`upgrade.sh` 应在拉取镜像前失败，并提示先执行 `docker login`。
- 如果 `INITIAL_PLATFORM_ADMIN_FEISHU_USER_ID` 未配置，初始化应失败，避免创建不明确的超级管理员。
- 如果飞书镜像中没有“王文哲”，应先触发飞书同步，再重跑初始化。
- 如果 DDL 失败，不自动回滚数据库，保留备份并停止 Web，等待人工排查。
- 如果 `8000` 端口被占用，可通过 `.env` 修改 `HOST_WEB_PORT`，同步更新飞书回调地址和 `FEISHU_IAM_PUBLIC_URL`。
