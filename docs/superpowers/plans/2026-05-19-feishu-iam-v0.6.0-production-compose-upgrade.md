# Feishu IAM v0.6.0 Production Compose Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 Feishu IAM 从 `v0.5.1` 内网验收态升级为单机 Docker Compose 生产化部署和停机升级闭环。

**Architecture:** 保持单机、单 Web 容器和单 PostgreSQL 容器，不引入高可用、反向代理或 HTTPS。服务器只保存 `docker-compose.yaml`、`.env`、`upgrade.sh` 和挂载目录，Web 镜像从 GitLab Docker Registry 拉取，DDL 从镜像内 `/app/migrations` 执行。

**Tech Stack:** NestJS、React + Vite、PostgreSQL 16、Prisma、Docker Compose、Bash、psql、Vitest、Supertest、curl。

---

## 文件结构

新增：

- `deploy/apply-migrations-in-container.sh`：运行在 `web` 镜像内部，读取 `/app/migrations`，按 `schema_versions` 只执行未应用 DDL。
- `migrations/V0_6_0__production_compose_upgrade.sql`：登记 `0.6.0`，并按 `INITIAL_PLATFORM_ADMIN_FEISHU_USER_ID` 初始化首个平台管理员。
- `docs/deploy-v0.6.0.md`：服务器目录、Compose、`.env`、升级和排障说明。
- `docs/acceptance/v0.6.0-production-compose-upgrade.md`：单机部署和停机升级验收清单。
- `docs/codex-sessions/2026-05-19-1823-v0.6.0-实施计划.md`：本计划会话归档。

修改：

- `package.json`、`apps/api/package.json`、`apps/admin-web/package.json`：版本更新到 `0.6.0`，脚本改为 `db:migrate` 走 Compose 内部 migration runner，`compose:up` 启动 `web`。
- `deploy/api.Dockerfile`：runtime 镜像安装 `postgresql-client`，复制 `migrations/` 和 `deploy/apply-migrations-in-container.sh`。
- `deploy/docker-compose.yml`：改为 `db` + `web` 生产化 Compose；`db` 不暴露宿主机端口；`web` 使用 Registry 镜像和宿主机 `8000` 默认端口。
- `deploy/compose.sh`：默认使用 `deploy/docker-compose.yml`，保留根 `.env` 和 `deploy/.env` 加载逻辑，支持 `COMPOSE_FILE` 覆盖。
- `deploy/apply-migrations.sh`：宿主机入口改为启动 `db` 后，通过 `docker compose run --rm web bash /app/deploy/apply-migrations-in-container.sh` 执行镜像内 DDL。
- `deploy/upgrade.sh`：改为停机静态升级：pull、stop web、backup、migrate、up web、ready/version 检查。
- `deploy/server.env.example`：更新为 `v0.6.0` 生产化 `.env` 模板，移除破窗配置，新增 `INITIAL_PLATFORM_ADMIN_FEISHU_USER_ID`。
- `apps/api/src/version/version.controller.ts`：默认版本更新为 `0.6.0-dev`。
- `apps/api/src/admin/admin-auth.controller.ts`：移除 `/admin/auth/bootstrap` GET/POST 和 bootstrap cookie 清理。
- `apps/api/src/admin/admin-session.guard.ts`：移除 bootstrap context 读取。
- `apps/api/src/admin/admin.types.ts`：移除 `bootstrap` 字段，扩展审计上下文支持 `deployment_init`。
- `apps/api/src/admin/admin-user.controller.ts`：管理员创建审计不再区分 bootstrap。
- `apps/api/src/admin/admin-user.service.ts`：系统默认审计来源改为部署初始化语义。
- `apps/admin-web/src/admin-types.ts`：移除 `bootstrap?: boolean`。
- `apps/admin-web/src/App.tsx`：移除破窗登录入口和破窗模式工作区。
- `apps/admin-web/src/App.css`：删除破窗模式专用样式。
- `apps/admin-web/src/App.test.tsx`：删除破窗入口断言，新增生产登录入口断言。
- `apps/api/test/admin.controller.e2e-spec.ts`：删除破窗可用测试，新增 `/admin/auth/bootstrap` 不可访问测试和普通管理员创建审计测试。
- `README.md`、`CHANGELOG.md`、`AGENTS.md`：更新 `v0.6.0` 状态、范围和部署入口。

删除：

- `apps/api/src/admin/admin-bootstrap-auth.ts`。

## Task 1: 版本号和镜像运行内容

**Files:**
- Modify: `package.json`
- Modify: `apps/api/package.json`
- Modify: `apps/admin-web/package.json`
- Modify: `apps/api/src/version/version.controller.ts`
- Modify: `deploy/api.Dockerfile`

- [ ] **Step 1: 写失败检查**

Run:

```bash
rg -n '"version": "0.5.1"|0.5.1-dev|COPY --chown=node:node migrations|postgresql-client' package.json apps deploy
```

Expected: 输出包含 `0.5.1` 和 `0.5.1-dev`，且不包含 `postgresql-client` 或 runtime 复制 `migrations` 的配置。

- [ ] **Step 2: 更新 package 版本**

Modify root `package.json`:

```json
{
  "version": "0.6.0",
  "scripts": {
    "compose:up": "bash deploy/apply-migrations.sh && bash deploy/compose.sh up -d web",
    "compose:down": "bash deploy/compose.sh down",
    "compose:logs": "bash deploy/compose.sh logs -f",
    "db:migrate": "bash deploy/apply-migrations.sh"
  }
}
```

Modify `apps/api/package.json`:

```json
{
  "version": "0.6.0"
}
```

Modify `apps/admin-web/package.json`:

```json
{
  "version": "0.6.0"
}
```

Keep every other existing field unchanged.

- [ ] **Step 3: 更新默认版本响应**

Modify `apps/api/src/version/version.controller.ts`:

```ts
version: process.env.APP_VERSION ?? '0.6.0-dev',
```

- [ ] **Step 4: 让 runtime 镜像包含 psql、DDL 和迁移脚本**

Modify `deploy/api.Dockerfile` runtime stage:

```dockerfile
FROM base AS runtime
ENV NODE_ENV=production
RUN apt-get update -y \
  && apt-get install -y --no-install-recommends postgresql-client \
  && rm -rf /var/lib/apt/lists/*
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build --chown=node:node /app/apps/api/dist ./apps/api/dist
COPY --from=build --chown=node:node /app/apps/api/prisma ./apps/api/prisma
COPY --from=build --chown=node:node /app/apps/admin-web/dist ./apps/admin-web/dist
COPY --chown=node:node migrations ./migrations
COPY --chown=node:node deploy/apply-migrations-in-container.sh ./deploy/apply-migrations-in-container.sh
COPY --chown=node:node package.json pnpm-workspace.yaml ./
COPY --chown=node:node apps/api/package.json apps/api/package.json
EXPOSE 3000
USER node
CMD ["node", "apps/api/dist/main.js"]
```

- [ ] **Step 5: 运行验证**

Run:

```bash
pnpm --filter @feishu-iam/api typecheck
pnpm --filter @feishu-iam/admin-web typecheck
rg -n '"version": "0.6.0"|0.6.0-dev|postgresql-client|COPY --chown=node:node migrations' package.json apps deploy/api.Dockerfile
```

Expected: typecheck PASS；`rg` 输出三个 package 版本、`0.6.0-dev`、`postgresql-client` 和 runtime 复制 `migrations` 的行。

- [ ] **Step 6: 提交**

```bash
git add package.json apps/api/package.json apps/admin-web/package.json apps/api/src/version/version.controller.ts deploy/api.Dockerfile
git commit -m "chore: prepare v0.6.0 runtime image"
```

## Task 2: 生产化 Compose 和服务器环境模板

**Files:**
- Modify: `deploy/docker-compose.yml`
- Modify: `deploy/server.env.example`
- Modify: `deploy/compose.sh`

- [ ] **Step 1: 写失败检查**

Run:

```bash
docker compose --env-file deploy/server.env.example -f deploy/docker-compose.yml config | rg -n '5432:5432|build:|feishu-iam-db-1|BOOTSTRAP_SUPER_ADMIN|8000'
```

Expected: 当前输出包含 `5432:5432`、`build:` 或 `BOOTSTRAP_SUPER_ADMIN`，说明还不是 `v0.6.0` 形态。

- [ ] **Step 2: 改造 Compose**

Replace `deploy/docker-compose.yml` with:

```yaml
services:
  db:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${POSTGRES_DB:-feishu_iam}
      POSTGRES_USER: ${POSTGRES_USER:-feishu_iam}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-feishu_iam_dev}
    volumes:
      - ${POSTGRES_DATA_DIR:-./data/postgres}:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $${POSTGRES_USER:-feishu_iam} -d $${POSTGRES_DB:-feishu_iam}"]
      interval: 5s
      timeout: 3s
      retries: 20

  web:
    image: ${FEISHU_IAM_IMAGE:-192.168.2.73:5050/ai/feishu-iam}:${FEISHU_IAM_IMAGE_TAG:-v0.6.0}
    restart: unless-stopped
    depends_on:
      db:
        condition: service_healthy
    environment:
      NODE_ENV: production
      PORT: ${CONTAINER_WEB_PORT:-3000}
      DATABASE_URL: ${DATABASE_URL:-postgresql://feishu_iam:feishu_iam_dev@db:5432/feishu_iam?schema=public}
      ADMIN_WEB_BASE_URL: ${ADMIN_WEB_BASE_URL:-http://localhost:8000}
      PLATFORM_ADMIN_TOKEN: ${PLATFORM_ADMIN_TOKEN:-}
      FEISHU_APP_ID: ${FEISHU_APP_ID:-}
      FEISHU_APP_SECRET: ${FEISHU_APP_SECRET:-}
      FEISHU_OAUTH_REDIRECT_URI: ${FEISHU_OAUTH_REDIRECT_URI:-}
      FEISHU_ADMIN_OAUTH_REDIRECT_URI: ${FEISHU_ADMIN_OAUTH_REDIRECT_URI:-}
      INITIAL_PLATFORM_ADMIN_FEISHU_USER_ID: ${INITIAL_PLATFORM_ADMIN_FEISHU_USER_ID:-}
      APP_VERSION: ${APP_VERSION:-0.6.0}
      GIT_COMMIT: ${GIT_COMMIT:-local}
    ports:
      - "${HOST_WEB_PORT:-8000}:${CONTAINER_WEB_PORT:-3000}"
    volumes:
      - ${FEISHU_IAM_CONFIG_DIR:-./config}:/app/config
      - ${FEISHU_IAM_LOG_DIR:-./logs}:/app/logs
```

- [ ] **Step 3: 更新 server env 模板**

Replace `deploy/server.env.example` with:

```dotenv
# 服务器部署时复制本文件为 deploy/.env 或仓库根目录 .env，并替换所有尖括号说明值。
# 不要提交真实 .env、密钥、token、cookie、密码或其他敏感凭证。

COMPOSE_PROJECT_NAME=feishu-iam

FEISHU_IAM_IMAGE=192.168.2.73:5050/ai/feishu-iam
FEISHU_IAM_IMAGE_TAG=v0.6.0
APP_VERSION=0.6.0
GIT_COMMIT=local

HOST_WEB_PORT=8000
CONTAINER_WEB_PORT=3000
FEISHU_IAM_PUBLIC_URL=http://192.168.2.112:8000
ADMIN_WEB_BASE_URL=http://192.168.2.112:8000

POSTGRES_DB=feishu_iam
POSTGRES_USER=feishu_iam
POSTGRES_PASSWORD=<服务器本地强密码>
DATABASE_URL=postgresql://feishu_iam:<服务器本地强密码>@db:5432/feishu_iam?schema=public
POSTGRES_DATA_DIR=./data/postgres

FEISHU_IAM_CONFIG_DIR=./config
FEISHU_IAM_LOG_DIR=./logs
FEISHU_IAM_BACKUP_DIR=./backups

PLATFORM_ADMIN_TOKEN=<服务器本地平台自动化 token>

FEISHU_APP_ID=<飞书企业自建应用 app_id>
FEISHU_APP_SECRET=<飞书企业自建应用 app_secret>
FEISHU_OAUTH_REDIRECT_URI=http://192.168.2.112:8000/oauth/feishu/callback
FEISHU_ADMIN_OAUTH_REDIRECT_URI=http://192.168.2.112:8000/admin/auth/feishu/callback

INITIAL_PLATFORM_ADMIN_FEISHU_USER_ID=<王文哲的飞书 user_id>
```

- [ ] **Step 4: 允许 compose.sh 使用 COMPOSE_FILE 覆盖**

Modify `deploy/compose.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="${COMPOSE_FILE:-${ROOT_DIR}/deploy/docker-compose.yml}"

if [ -f "${ROOT_DIR}/.env" ]; then
  exec docker compose --env-file "${ROOT_DIR}/.env" -f "${COMPOSE_FILE}" "$@"
fi

if [ -f "${ROOT_DIR}/deploy/.env" ]; then
  exec docker compose --env-file "${ROOT_DIR}/deploy/.env" -f "${COMPOSE_FILE}" "$@"
fi

exec docker compose -f "${COMPOSE_FILE}" "$@"
```

- [ ] **Step 5: 运行验证**

Run:

```bash
docker compose --env-file deploy/server.env.example -f deploy/docker-compose.yml config --quiet
docker compose --env-file deploy/server.env.example -f deploy/docker-compose.yml config | rg -n 'feishu-iam|8000|192.168.2.73:5050/ai/feishu-iam|db:5432|BOOTSTRAP_SUPER_ADMIN|5432:5432|build:'
bash -n deploy/compose.sh
```

Expected: config PASS；`rg` 输出 `feishu-iam`、`8000`、registry image、`db:5432`；不输出 `BOOTSTRAP_SUPER_ADMIN`、`5432:5432` 或 `build:`。

- [ ] **Step 6: 提交**

```bash
git add deploy/docker-compose.yml deploy/server.env.example deploy/compose.sh
git commit -m "chore: harden production compose layout"
```

## Task 3: 镜像内迁移执行器和停机升级脚本

**Files:**
- Create: `deploy/apply-migrations-in-container.sh`
- Modify: `deploy/apply-migrations.sh`
- Modify: `deploy/upgrade.sh`

- [ ] **Step 1: 写失败检查**

Run:

```bash
test -f deploy/apply-migrations-in-container.sh
```

Expected: FAIL，文件不存在。

- [ ] **Step 2: 新增镜像内 DDL runner**

Create `deploy/apply-migrations-in-container.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

MIGRATIONS_DIR="${MIGRATIONS_DIR:-/app/migrations}"

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is required" >&2
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "psql command not found" >&2
  exit 1
fi

if [ ! -d "${MIGRATIONS_DIR}" ]; then
  echo "migrations directory not found: ${MIGRATIONS_DIR}" >&2
  exit 1
fi

schema_versions_exists() {
  psql "${DATABASE_URL}" -tAc "select to_regclass('public.schema_versions') is not null;" | tr -d '[:space:]'
}

migration_applied() {
  local version="$1"
  if [ "$(schema_versions_exists)" != "t" ]; then
    return 1
  fi
  [ "$(psql "${DATABASE_URL}" -tAc "select exists(select 1 from schema_versions where version = '${version}');" | tr -d '[:space:]')" = "t" ]
}

version_from_filename() {
  local filename="$1"
  local raw="${filename%%__*}"
  raw="${raw#V}"
  printf '%s\n' "${raw//_/.}"
}

echo "==> Applying database migrations from ${MIGRATIONS_DIR}"

for migration in "${MIGRATIONS_DIR}"/V*.sql; do
  if [ ! -e "${migration}" ]; then
    echo "no migration files found in ${MIGRATIONS_DIR}" >&2
    exit 1
  fi

  filename="$(basename "${migration}")"
  version="$(version_from_filename "${filename}")"

  if migration_applied "${version}"; then
    echo "==> Skipping ${filename}; version ${version} already applied"
    continue
  fi

  echo "==> Applying ${filename}"
  psql \
    -v ON_ERROR_STOP=1 \
    -v initial_platform_admin_feishu_user_id="${INITIAL_PLATFORM_ADMIN_FEISHU_USER_ID:-}" \
    "${DATABASE_URL}" < "${migration}"
done

echo "==> Database migrations applied"
```

- [ ] **Step 3: 改造宿主机迁移入口**

Replace `deploy/apply-migrations.sh` with:

```bash
#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if ! command -v docker >/dev/null 2>&1; then
  echo "docker command not found" >&2
  exit 1
fi

echo "==> Starting database"
"${ROOT_DIR}/deploy/compose.sh" up -d db

echo "==> Applying database migrations from web image"
"${ROOT_DIR}/deploy/compose.sh" run --rm --no-deps web bash /app/deploy/apply-migrations-in-container.sh
```

- [ ] **Step 4: 改造停机升级脚本**

Replace `deploy/upgrade.sh` with:

```bash
#!/usr/bin/env bash
set -euo pipefail
umask 077

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

load_env_file() {
  local env_file="$1"
  local line key value

  [ -f "${env_file}" ] || return 0

  while IFS= read -r line || [ -n "${line}" ]; do
    line="${line%$'\r'}"
    case "${line}" in
      ""|\#*) continue ;;
    esac

    key="${line%%=*}"
    value="${line#*=}"
    [ "${key}" != "${line}" ] || continue

    if [[ "${key}" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]; then
      export "${key}=${value}"
    fi
  done < "${env_file}"
}

if [ -f "${ROOT_DIR}/.env" ]; then
  load_env_file "${ROOT_DIR}/.env"
elif [ -f "${ROOT_DIR}/deploy/.env" ]; then
  load_env_file "${ROOT_DIR}/deploy/.env"
fi

POSTGRES_USER="${POSTGRES_USER:-feishu_iam}"
POSTGRES_DB="${POSTGRES_DB:-feishu_iam}"
PUBLIC_URL="${FEISHU_IAM_PUBLIC_URL:-http://localhost:${HOST_WEB_PORT:-8000}}"
BACKUP_ROOT="${FEISHU_IAM_BACKUP_DIR:-${ROOT_DIR}/backups}"
BACKUP_DIR="${BACKUP_ROOT}/$(date +%Y%m%d-%H%M%S)"
BACKUP_FILE="${BACKUP_DIR}/${POSTGRES_DB}.sql"
EXPECTED_VERSION="${APP_VERSION:-${FEISHU_IAM_IMAGE_TAG:-v0.6.0}}"

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "$1 command not found" >&2
    exit 1
  fi
}

require_env() {
  if [ -z "${!1:-}" ]; then
    echo "$1 is required" >&2
    exit 1
  fi
}

require_command docker
require_command curl
require_env DATABASE_URL
require_env FEISHU_IAM_IMAGE_TAG
require_env INITIAL_PLATFORM_ADMIN_FEISHU_USER_ID

mkdir -p "${BACKUP_DIR}"
chmod 700 "${BACKUP_ROOT}" "${BACKUP_DIR}"

echo "==> Feishu IAM upgrade started"
echo "==> Target image tag: ${FEISHU_IAM_IMAGE_TAG}"
echo "==> Backup directory: ${BACKUP_DIR}"

echo "==> Pulling web image"
"${ROOT_DIR}/deploy/compose.sh" pull web

echo "==> Stopping web"
"${ROOT_DIR}/deploy/compose.sh" stop web || true

echo "==> Starting database"
"${ROOT_DIR}/deploy/compose.sh" up -d db

echo "==> Creating database backup"
"${ROOT_DIR}/deploy/compose.sh" exec -T db pg_dump -U "${POSTGRES_USER}" "${POSTGRES_DB}" > "${BACKUP_FILE}"
chmod 600 "${BACKUP_FILE}"

echo "==> Applying database migrations"
"${ROOT_DIR}/deploy/apply-migrations.sh"

echo "==> Starting web"
"${ROOT_DIR}/deploy/compose.sh" up -d web

echo "==> Checking readiness at ${PUBLIC_URL}/ready"
for _ in {1..60}; do
  if curl -fsS "${PUBLIC_URL}/ready" | grep -Eq '"status"[[:space:]]*:[[:space:]]*"ready"'; then
    echo "==> Feishu IAM is ready"
    break
  fi
  sleep 2
done

if ! curl -fsS "${PUBLIC_URL}/ready" | grep -Eq '"status"[[:space:]]*:[[:space:]]*"ready"'; then
  echo "Feishu IAM did not become ready. Backup is at ${BACKUP_DIR}" >&2
  exit 1
fi

echo "==> Checking version at ${PUBLIC_URL}/version"
curl -fsS "${PUBLIC_URL}/version" | tee "${BACKUP_DIR}/version.json"

if ! grep -Eq "\"version\"[[:space:]]*:[[:space:]]*\"${EXPECTED_VERSION}\"" "${BACKUP_DIR}/version.json"; then
  echo "version response does not match expected version ${EXPECTED_VERSION}" >&2
  exit 1
fi

echo "==> Feishu IAM upgrade completed"
echo "==> Backup file: ${BACKUP_FILE}"
```

- [ ] **Step 5: 运行验证**

Run:

```bash
bash -n deploy/apply-migrations-in-container.sh deploy/apply-migrations.sh deploy/upgrade.sh
rg -n 'schema_versions|INITIAL_PLATFORM_ADMIN_FEISHU_USER_ID|docker compose pull|stop web|pg_dump|/version|/ready' deploy
```

Expected: shell syntax PASS；`rg` 输出迁移跳过、初始管理员变量、pull、stop、备份和健康检查逻辑。

- [ ] **Step 6: 提交**

```bash
git add deploy/apply-migrations-in-container.sh deploy/apply-migrations.sh deploy/upgrade.sh
git commit -m "feat: add static upgrade runner"
```

## Task 4: v0.6.0 DDL 和首个平台管理员初始化

**Files:**
- Create: `migrations/V0_6_0__production_compose_upgrade.sql`
- Test: `migrations/V0_6_0__production_compose_upgrade.sql`

- [ ] **Step 1: 写失败检查**

Run:

```bash
test -f migrations/V0_6_0__production_compose_upgrade.sql
```

Expected: FAIL，文件不存在。

- [ ] **Step 2: 新增 v0.6.0 DDL**

Create `migrations/V0_6_0__production_compose_upgrade.sql`:

```sql
DO $$
DECLARE
  initial_feishu_user_id text := :'initial_platform_admin_feishu_user_id';
  target_admin_user_id text;
  platform_role_id text;
BEGIN
  IF initial_feishu_user_id IS NULL OR btrim(initial_feishu_user_id) = '' THEN
    RAISE EXCEPTION 'INITIAL_PLATFORM_ADMIN_FEISHU_USER_ID is required for v0.6.0 migration';
  END IF;

  SELECT id INTO platform_role_id
  FROM admin_roles
  WHERE role_key = 'platform_admin';

  IF platform_role_id IS NULL THEN
    RAISE EXCEPTION 'platform_admin role is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM feishu_users
    WHERE user_id = initial_feishu_user_id
      AND is_active = true
      AND is_deleted = false
  ) THEN
    RAISE EXCEPTION 'initial platform admin feishu user is missing or unavailable: %', initial_feishu_user_id;
  END IF;

  SELECT id INTO target_admin_user_id
  FROM admin_users
  WHERE feishu_user_id = initial_feishu_user_id;

  IF target_admin_user_id IS NULL THEN
    target_admin_user_id := 'admin-user-initial-platform-admin';

    INSERT INTO admin_users(id, feishu_user_id, display_name, status, created_at, updated_at)
    SELECT target_admin_user_id, user_id, name, 'active', now(), now()
    FROM feishu_users
    WHERE user_id = initial_feishu_user_id;
  ELSE
    UPDATE admin_users
    SET status = 'active',
        updated_at = now()
    WHERE id = target_admin_user_id;
  END IF;

  INSERT INTO admin_user_roles(admin_user_id, admin_role_id, created_at)
  VALUES (target_admin_user_id, platform_role_id, now())
  ON CONFLICT (admin_user_id, admin_role_id) DO NOTHING;

  INSERT INTO audit_logs(
    id,
    actor_type,
    actor_id,
    source,
    resource_type,
    resource_id,
    action,
    before,
    after,
    result,
    request_id,
    created_at
  )
  VALUES (
    'audit-v0-6-0-initial-platform-admin',
    'system',
    'deployment',
    'deployment_init',
    'admin_user',
    target_admin_user_id,
    'initialize_platform_admin',
    NULL,
    jsonb_build_object(
      'adminUserId', target_admin_user_id,
      'feishuUserId', initial_feishu_user_id,
      'roleKeys', jsonb_build_array('platform_admin')
    ),
    'success',
    'deployment-init-v0.6.0',
    now()
  )
  ON CONFLICT (id) DO NOTHING;
END $$;

INSERT INTO schema_versions(version, description)
VALUES ('0.6.0', '生产化 Compose 部署与停机升级闭环')
ON CONFLICT (version) DO NOTHING;
```

- [ ] **Step 3: 用临时数据库验证 DDL 行为**

Run:

```bash
docker run --rm --name feishu-iam-v060-ddl-test -e POSTGRES_PASSWORD=feishu_iam_dev -e POSTGRES_USER=feishu_iam -e POSTGRES_DB=feishu_iam -p 18060:5432 -d postgres:16-alpine
sleep 5
for file in migrations/V0_1_0__baseline.sql migrations/V0_2_0__feishu_identity_sync.sql migrations/V0_3_0__permission_model.sql migrations/V0_4_0__sso_provider.sql migrations/V0_5_0__admin_console.sql; do
  PGPASSWORD=feishu_iam_dev psql -h localhost -p 18060 -U feishu_iam -d feishu_iam -v ON_ERROR_STOP=1 < "$file"
done
PGPASSWORD=feishu_iam_dev psql -h localhost -p 18060 -U feishu_iam -d feishu_iam -v ON_ERROR_STOP=1 -c "insert into feishu_users(id,user_id,open_id,union_id,name,is_active,is_deleted,raw_payload) values ('feishu-user-wwz','ou_wwz','open_wwz','union_wwz','王文哲',true,false,'{}'::jsonb);"
PGPASSWORD=feishu_iam_dev psql -h localhost -p 18060 -U feishu_iam -d feishu_iam -v ON_ERROR_STOP=1 -v initial_platform_admin_feishu_user_id='ou_wwz' < migrations/V0_6_0__production_compose_upgrade.sql
PGPASSWORD=feishu_iam_dev psql -h localhost -p 18060 -U feishu_iam -d feishu_iam -tAc "select au.feishu_user_id, ar.role_key from admin_users au join admin_user_roles aur on aur.admin_user_id = au.id join admin_roles ar on ar.id = aur.admin_role_id where au.feishu_user_id = 'ou_wwz';"
docker rm -f feishu-iam-v060-ddl-test
```

Expected: final query prints `ou_wwz|platform_admin`；container is removed.

- [ ] **Step 4: 验证缺少初始管理员变量会失败**

Run:

```bash
docker run --rm --name feishu-iam-v060-ddl-missing-admin-test -e POSTGRES_PASSWORD=feishu_iam_dev -e POSTGRES_USER=feishu_iam -e POSTGRES_DB=feishu_iam -p 18061:5432 -d postgres:16-alpine
sleep 5
for file in migrations/V0_1_0__baseline.sql migrations/V0_2_0__feishu_identity_sync.sql migrations/V0_3_0__permission_model.sql migrations/V0_4_0__sso_provider.sql migrations/V0_5_0__admin_console.sql; do
  PGPASSWORD=feishu_iam_dev psql -h localhost -p 18061 -U feishu_iam -d feishu_iam -v ON_ERROR_STOP=1 < "$file"
done
set +e
PGPASSWORD=feishu_iam_dev psql -h localhost -p 18061 -U feishu_iam -d feishu_iam -v ON_ERROR_STOP=1 -v initial_platform_admin_feishu_user_id='' < migrations/V0_6_0__production_compose_upgrade.sql
status=$?
set -e
docker rm -f feishu-iam-v060-ddl-missing-admin-test
test "$status" -ne 0
```

Expected: command exits 0 overall because the migration failed as expected when the variable is empty.

- [ ] **Step 5: 提交**

```bash
git add migrations/V0_6_0__production_compose_upgrade.sql
git commit -m "feat: initialize production platform admin"
```

## Task 5: 移除后端破窗入口

**Files:**
- Delete: `apps/api/src/admin/admin-bootstrap-auth.ts`
- Modify: `apps/api/src/admin/admin-auth.controller.ts`
- Modify: `apps/api/src/admin/admin-session.guard.ts`
- Modify: `apps/api/src/admin/admin.types.ts`
- Modify: `apps/api/src/admin/admin-user.controller.ts`
- Modify: `apps/api/src/admin/admin-user.service.ts`
- Test: `apps/api/test/admin.controller.e2e-spec.ts`

- [ ] **Step 1: 改测试，确认破窗生产不可访问**

Modify `apps/api/test/admin.controller.e2e-spec.ts` by replacing bootstrap success tests with:

```ts
it('GET /admin/auth/bootstrap 返回 404，生产路径不再提供破窗入口', async () => {
  await request(app.getHttpServer() as SupertestApp).get('/admin/auth/bootstrap').expect(404);
});

it('POST /admin/auth/bootstrap 返回 404，生产路径不再提供破窗登录', async () => {
  await request(app.getHttpServer() as SupertestApp)
    .post('/admin/auth/bootstrap')
    .send({ username: 'breakglass', password: 'password' })
    .expect(404);
});

it('POST /api/v1/admin/admin-users 使用真实管理员身份写入 admin_web 审计', async () => {
  const cookie = await createAdminSessionCookie({
    adminUserId: 'admin-platform',
    feishuUserId: 'feishu-platform',
    roles: ['platform_admin']
  });

  await request(app.getHttpServer() as SupertestApp)
    .post('/api/v1/admin/admin-users')
    .set('Cookie', cookie)
    .set('x-request-id', 'req-admin-create')
    .send({
      feishuUserId: 'feishu-new-admin',
      roleKeys: ['application_admin'],
      applicationIds: []
    })
    .expect(201);

  expect(auditLogService.record).toHaveBeenCalledWith(
    expect.objectContaining({
      actorType: 'admin_user',
      actorId: 'admin-platform',
      source: 'admin_web',
      requestId: 'req-admin-create'
    }),
    expect.anything()
  );
});
```

Run:

```bash
pnpm --filter @feishu-iam/api test -- admin.controller.e2e-spec.ts
```

Expected: FAIL because bootstrap endpoints still exist and guard still reads bootstrap context.

- [ ] **Step 2: 移除 controller 中的 bootstrap endpoint**

Modify `apps/api/src/admin/admin-auth.controller.ts`:

```ts
import { Body, Controller, Get, HttpCode, Inject, Post, Query, Req, Res, UseFilters, UseGuards } from '@nestjs/common';
```

becomes:

```ts
import { Controller, Get, HttpCode, Inject, Post, Query, Req, Res, UseFilters, UseGuards } from '@nestjs/common';
```

Remove imports from `./admin-bootstrap-auth`.

Delete these methods:

```ts
@Get('/admin/auth/bootstrap')
bootstrapLoginPage(@Res() response: Response): void {
  response.type('html').send(renderBootstrapLoginPage());
}

@Post('/admin/auth/bootstrap')
bootstrapLogin(
  @Body('username') username: unknown,
  @Body('password') password: unknown,
  @Res() response: Response
): void {
  ...
}
```

In `logout` and `logoutRedirect`, remove:

```ts
response.clearCookie(BOOTSTRAP_SESSION_COOKIE_NAME, CLEAR_ADMIN_SESSION_COOKIE_OPTIONS);
```

Delete helper functions:

```ts
renderBootstrapLoginPage
escapeHtml
```

- [ ] **Step 3: 移除 guard 中的 bootstrap context**

Modify `apps/api/src/admin/admin-session.guard.ts`:

```ts
import { readBootstrapAdminContext } from './admin-bootstrap-auth';
```

Remove that import and delete this block:

```ts
const bootstrapContext = readBootstrapAdminContext(request);
if (bootstrapContext) {
  setAdminContext(request, bootstrapContext);
  return true;
}
```

- [ ] **Step 4: 更新 admin 类型和审计上下文**

Modify `apps/api/src/admin/admin.types.ts`:

```ts
export type AdminContext = {
  adminUserId: string;
  feishuUserId: string;
  displayName: string;
  roles: AdminRoleKey[];
  applicationIds: string[];
};

export type AdminAuditContext = {
  actorType: 'admin_user' | 'system';
  actorId: string;
  source: 'admin_web' | 'deployment_init';
  ip?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
};
```

Modify `apps/api/src/admin/admin-user.controller.ts`:

```ts
function buildAdminUserAuditContext(request: Request, context: AdminContext): AdminAuditContext {
  return {
    actorType: 'admin_user',
    actorId: context.adminUserId,
    source: 'admin_web',
    requestId: getAdminRequestId(request),
    ip: request.ip ?? null,
    userAgent: request.header('user-agent') ?? null
  };
}
```

Modify `apps/api/src/admin/admin-user.service.ts`:

```ts
const SYSTEM_AUDIT_CONTEXT: AdminAuditContext = {
  actorType: 'system',
  actorId: 'deployment',
  source: 'deployment_init'
};
```

- [ ] **Step 5: 删除 bootstrap 文件**

Run:

```bash
git rm apps/api/src/admin/admin-bootstrap-auth.ts
```

- [ ] **Step 6: 运行验证**

Run:

```bash
pnpm --filter @feishu-iam/api test -- admin.controller.e2e-spec.ts admin-user.service.spec.ts
pnpm --filter @feishu-iam/api typecheck
rg -n 'BOOTSTRAP_SUPER_ADMIN|admin/auth/bootstrap|bootstrap_super_admin|readBootstrapAdminContext|feishu_iam_admin_bootstrap_session' apps/api
```

Expected: tests and typecheck PASS；`rg` returns no matches under `apps/api`.

- [ ] **Step 7: 提交**

```bash
git add apps/api/src/admin apps/api/test/admin.controller.e2e-spec.ts apps/api/test/admin-user.service.spec.ts
git commit -m "feat: remove production bootstrap admin path"
```

## Task 6: 移除前端破窗入口和破窗模式

**Files:**
- Modify: `apps/admin-web/src/admin-types.ts`
- Modify: `apps/admin-web/src/App.tsx`
- Modify: `apps/admin-web/src/App.css`
- Modify: `apps/admin-web/src/App.test.tsx`

- [ ] **Step 1: 写失败测试**

Modify `apps/admin-web/src/App.test.tsx`:

```tsx
it('未登录时只展示飞书登录入口，不展示破窗登录', async () => {
  mockFetchAdminMeFailure();

  render(<App />);

  expect(await screen.findByRole('heading', { name: '需要登录 Feishu IAM 管理后台' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: '飞书登录' })).toHaveAttribute('href', '/admin/auth/login');
  expect(screen.queryByRole('link', { name: '破窗登录' })).not.toBeInTheDocument();
});
```

Remove tests that construct:

```ts
bootstrap: true
```

Run:

```bash
pnpm --filter @feishu-iam/admin-web test -- App.test.tsx
```

Expected: FAIL because App still renders `破窗登录` or bootstrap work area.

- [ ] **Step 2: 更新 admin type**

Modify `apps/admin-web/src/admin-types.ts`:

```ts
export type AdminUser = {
  adminUserId: string;
  feishuUserId: string;
  displayName: string;
  roles: AdminRoleKey[];
  applicationIds: string[];
};
```

- [ ] **Step 3: 移除登录失败页的破窗链接**

Modify `apps/admin-web/src/App.tsx` failed state:

```tsx
if (adminState.status === 'failed') {
  return (
    <main className="admin-auth-state admin-auth-state-failed">
      <h1>需要登录 Feishu IAM 管理后台</h1>
      <p>{adminState.message}</p>
      <div className="auth-actions">
        <a className="text-button" href="/admin/auth/login">
          飞书登录
        </a>
      </div>
    </main>
  );
}
```

- [ ] **Step 4: 移除 bootstrap 分支和数据加载条件**

In `apps/admin-web/src/App.tsx`, remove:

```tsx
if (adminState.admin.bootstrap) {
  return (
    ...
  );
}
```

Replace all loading guards:

```ts
if (adminState.status !== 'loaded' || adminState.admin.bootstrap) {
  return;
}
```

with:

```ts
if (adminState.status !== 'loaded') {
  return;
}
```

- [ ] **Step 5: 删除破窗样式**

Modify `apps/admin-web/src/App.css` by deleting style blocks for:

```css
.bootstrap-callout
.bootstrap-callout h1
.bootstrap-callout p
```

- [ ] **Step 6: 运行验证**

Run:

```bash
pnpm --filter @feishu-iam/admin-web test -- App.test.tsx
pnpm --filter @feishu-iam/admin-web typecheck
rg -n '破窗|bootstrap|Break Glass|admin/auth/bootstrap' apps/admin-web/src
```

Expected: test and typecheck PASS；`rg` returns no production source matches, except deleted test history should not appear.

- [ ] **Step 7: 提交**

```bash
git add apps/admin-web/src/admin-types.ts apps/admin-web/src/App.tsx apps/admin-web/src/App.css apps/admin-web/src/App.test.tsx
git commit -m "feat: remove bootstrap login from admin web"
```

## Task 7: 文档、验收清单和当前阶段更新

**Files:**
- Create: `docs/deploy-v0.6.0.md`
- Create: `docs/acceptance/v0.6.0-production-compose-upgrade.md`
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Modify: `AGENTS.md`

- [ ] **Step 1: 新增部署说明**

Create `docs/deploy-v0.6.0.md` with:

````md
# Feishu IAM v0.6.0 生产化 Compose 部署说明

本文档用于把 Feishu IAM `v0.6.0` 部署到内网服务器 `192.168.2.112:8000`。本文只记录部署步骤、配置项名称和安全原则，不记录真实密钥、token、cookie、密码或 client secret。

## 目录结构

服务器目录为 `~/feishu-iam`：

```text
~/feishu-iam
├── docker-compose.yaml
├── .env
├── upgrade.sh
├── config/
├── logs/
├── data/postgres/
└── backups/
```

## 核心规则

- PostgreSQL 不映射宿主机端口。
- Web 默认映射到宿主机 `8000` 端口。
- Web 镜像从 `192.168.2.73:5050/ai/feishu-iam` 拉取。
- 升级使用 `./upgrade.sh` 停机静态更新。
- 首个平台管理员通过 `INITIAL_PLATFORM_ADMIN_FEISHU_USER_ID` 指向真实飞书用户“王文哲”。
- 生产环境不再使用破窗登录。

## 首次部署

```bash
mkdir -p ~/feishu-iam/config ~/feishu-iam/logs ~/feishu-iam/data/postgres ~/feishu-iam/backups
cd ~/feishu-iam
chmod 700 backups
chmod 600 .env
docker login 192.168.2.73:5050
docker compose pull web
docker compose up -d db
./upgrade.sh
```

## 日常命令

```bash
docker compose ps
docker compose logs -f web
docker compose exec db psql -U feishu_iam -d feishu_iam
./upgrade.sh
```
````

- [ ] **Step 2: 新增验收清单**

Create `docs/acceptance/v0.6.0-production-compose-upgrade.md` with:

```md
# Feishu IAM v0.6.0 生产化部署验收清单

## Compose 验收

- [ ] `docker compose config --quiet` 通过。
- [ ] `docker compose ps` 显示 `db` 和 `web` 正常运行。
- [ ] `docker ps` 中容器名带 `feishu-iam` 前缀。
- [ ] 宿主机未暴露 PostgreSQL `5432` 端口。
- [ ] `http://192.168.2.112:8000/ready` 返回 `ready`。
- [ ] `http://192.168.2.112:8000/version` 返回 `0.6.0`。

## 升级验收

- [ ] `./upgrade.sh` 可以拉取目标镜像。
- [ ] `./upgrade.sh` 会先停止 `web`。
- [ ] `./upgrade.sh` 在 `backups/` 下生成数据库备份。
- [ ] `schema_versions` 存在 `0.6.0`。
- [ ] DDL 重跑不会重复应用已存在版本。

## 管理员验收

- [ ] “王文哲”可通过飞书登录管理后台。
- [ ] `/api/v1/admin/me` 返回角色包含 `platform_admin`。
- [ ] “王文哲”可以创建应用管理员。
- [ ] 生产环境 `/admin/auth/bootstrap` 不可访问。

## 安全验收

- [ ] 文档和会话归档不包含真实密钥、token、cookie、密码或 client secret。
- [ ] 审计日志不记录飞书 `app_secret`、平台 token 或 client secret。
```

- [ ] **Step 3: 更新 README**

Modify `README.md` 当前状态和部署章节，加入：

```md
项目已完成 `v0.6.0` 生产化 Docker Compose 部署与停机升级闭环。当前推荐内网入口为 `http://192.168.2.112:8000`，服务器部署目录为 `~/feishu-iam`，Web 镜像从 GitLab Docker Registry 拉取，数据库端口不映射到宿主机。
```

- [ ] **Step 4: 更新 CHANGELOG**

Add top section to `CHANGELOG.md`:

```md
## v0.6.0

`v0.6.0` 是生产化 Docker Compose 部署与停机升级闭环版本。

### 新增

- 新增单机 `db` + `web` Compose 部署形态，Web 默认映射宿主机 `8000` 端口。
- 新增镜像内 DDL 执行器和停机静态升级脚本。
- 新增服务器目录规范、部署说明和验收清单。
- 新增“王文哲”作为首个 `platform_admin` 的初始化 DDL。

### 调整

- PostgreSQL 不再映射宿主机端口。
- Web 服务使用 GitLab Docker Registry 镜像，不在服务器上构建源码。
- 生产路径移除破窗 Web 登录和 `BOOTSTRAP_SUPER_ADMIN_*` 配置。

### 约束

- 本版本不引入 HTTPS、域名、反向代理、高可用、完整 OIDC、SAML、refresh token、ABAC、资源级权限、飞书角色同步或飞书用户组同步。
```

- [ ] **Step 5: 更新 AGENTS 当前阶段**

Modify `AGENTS.md` 当前阶段:

```md
当前阶段是：`v0.6.0` 已收口。该版本完成内网 HTTP 下的生产化 Docker Compose 部署与停机升级闭环，支持 `~/feishu-iam` 单机部署目录、`db` + `web` Compose 服务、PostgreSQL 不映射宿主机端口、Web 默认 `8000` 端口、GitLab Registry 镜像拉取、升级前数据库备份、版本 DDL 执行、`schema_versions` 记录和真实飞书用户“王文哲”作为首个 `platform_admin`。

当前阶段不做 HTTPS、域名、反向代理、高可用、完整 OIDC、refresh token、SAML、资源级权限、ABAC、飞书角色同步或飞书用户组同步。生产路径不再使用破窗 Web 登录或 `BOOTSTRAP_SUPER_ADMIN_*`。
```

- [ ] **Step 6: 运行文档检查**

Run:

```bash
rg -n 'BOOTSTRAP_SUPER_ADMIN|破窗登录|client_secret=.*[A-Za-z0-9]|app_secret=.*[A-Za-z0-9]|token=.*[A-Za-z0-9]|cookie=.*[A-Za-z0-9]' README.md CHANGELOG.md AGENTS.md docs/deploy-v0.6.0.md docs/acceptance/v0.6.0-production-compose-upgrade.md
```

Expected: no matches for sensitive assignment patterns. Matches for “破窗” are acceptable only when saying production path is removed.

- [ ] **Step 7: 提交**

```bash
git add README.md CHANGELOG.md AGENTS.md docs/deploy-v0.6.0.md docs/acceptance/v0.6.0-production-compose-upgrade.md
git commit -m "docs: document v0.6.0 deployment upgrade"
```

## Task 8: 全量验证、本地 Compose 配置检查和会话归档

**Files:**
- Create: `docs/codex-sessions/2026-05-19-1900-v0.6.0-实施.md`
- Modify only if verification exposes a defect: files from Tasks 1-7

- [ ] **Step 1: 运行全量检查**

Run:

```bash
pnpm check
DATABASE_URL='postgresql://feishu_iam:feishu_iam_dev@localhost:5432/feishu_iam?schema=public' pnpm --filter @feishu-iam/api prisma:validate
docker compose --env-file deploy/server.env.example -f deploy/docker-compose.yml config --quiet
bash -n deploy/compose.sh deploy/apply-migrations.sh deploy/apply-migrations-in-container.sh deploy/upgrade.sh
git diff --check
```

Expected: all commands PASS.

- [ ] **Step 2: 检查敏感信息和破窗残留**

Run:

```bash
rg -n 'BOOTSTRAP_SUPER_ADMIN|admin/auth/bootstrap|feishu_iam_admin_bootstrap_session|bootstrap_super_admin|Break Glass|破窗登录' apps deploy docs README.md CHANGELOG.md AGENTS.md
rg -n 'client_secret=.*[A-Za-z0-9]|app_secret=.*[A-Za-z0-9]|token=.*[A-Za-z0-9]|cookie=.*[A-Za-z0-9]|password=.*[A-Za-z0-9]' apps deploy docs README.md CHANGELOG.md AGENTS.md
```

Expected: first command returns no production code matches; docs may only mention that production path was removed. Second command returns no real secret assignments.

- [ ] **Step 3: 构建镜像**

Run:

```bash
docker build -f deploy/api.Dockerfile -t 192.168.2.73:5050/ai/feishu-iam:v0.6.0-local .
```

Expected: build PASS and image contains `/app/migrations` and `/app/deploy/apply-migrations-in-container.sh`.

- [ ] **Step 4: 记录实施会话归档**

Create `docs/codex-sessions/2026-05-19-1900-v0.6.0-实施.md`:

```md
# v0.6.0 生产化部署实施

## 会话目标

实现 Feishu IAM `v0.6.0` 生产化 Docker Compose 部署与停机升级闭环。

## 用户原始关键要求摘要

- 使用单机 Docker Compose。
- 数据库端口不映射到宿主机。
- Web 端口默认从 `8000` 开始。
- 关键配置、日志和数据映射到 `~/feishu-iam`。
- `upgrade.sh` 从 GitLab Docker Registry 拉镜像并执行版本 DDL。
- 初始化“王文哲”为首个 `platform_admin`。
- 移除破窗逻辑。
- 不做高可用、域名、HTTPS 或反向代理。

## 重要设计决策和原因

- Compose service 使用 `db` 和 `web`，通过 `COMPOSE_PROJECT_NAME=feishu-iam` 让容器名带项目前缀。
- 升级采用停机静态更新，符合单机部署目标。
- DDL 从目标镜像内执行，服务器不保存完整源码仓库。
- 生产路径移除破窗入口，管理员入口统一走飞书身份。

## 修改过的文件

- `package.json`
- `apps/api/package.json`
- `apps/admin-web/package.json`
- `deploy/api.Dockerfile`
- `deploy/docker-compose.yml`
- `deploy/server.env.example`
- `deploy/compose.sh`
- `deploy/apply-migrations.sh`
- `deploy/apply-migrations-in-container.sh`
- `deploy/upgrade.sh`
- `migrations/V0_6_0__production_compose_upgrade.sql`
- `apps/api/src/version/version.controller.ts`
- `apps/api/src/admin/admin-auth.controller.ts`
- `apps/api/src/admin/admin-session.guard.ts`
- `apps/api/src/admin/admin.types.ts`
- `apps/api/src/admin/admin-user.controller.ts`
- `apps/api/src/admin/admin-user.service.ts`
- `apps/admin-web/src/admin-types.ts`
- `apps/admin-web/src/App.tsx`
- `apps/admin-web/src/App.css`
- `apps/admin-web/src/App.test.tsx`
- `apps/api/test/admin.controller.e2e-spec.ts`
- `docs/deploy-v0.6.0.md`
- `docs/acceptance/v0.6.0-production-compose-upgrade.md`
- `README.md`
- `CHANGELOG.md`
- `AGENTS.md`

## 执行过的关键命令和验证结果

- `pnpm check`：通过。
- `DATABASE_URL='postgresql://feishu_iam:feishu_iam_dev@localhost:5432/feishu_iam?schema=public' pnpm --filter @feishu-iam/api prisma:validate`：通过。
- `docker compose --env-file deploy/server.env.example -f deploy/docker-compose.yml config --quiet`：通过。
- `bash -n deploy/compose.sh deploy/apply-migrations.sh deploy/apply-migrations-in-container.sh deploy/upgrade.sh`：通过。
- `git diff --check`：通过。
- 敏感信息与破窗残留检查：未发现生产代码残留破窗入口，未发现明文密钥、token、cookie、密码或 client secret。
- `docker build -f deploy/api.Dockerfile -t 192.168.2.73:5050/ai/feishu-iam:v0.6.0-local .`：通过，镜像包含 `/app/migrations` 和 `/app/deploy/apply-migrations-in-container.sh`。

## 未完成事项和下一步建议

- 在 `192.168.2.112` 完成真实 `upgrade.sh` 演练。
- 使用 `lark-cli` 查询并确认“王文哲”的飞书 `user_id`，只写入服务器本地 `.env`。
```

- [ ] **Step 5: 提交最终验证归档**

```bash
git add docs/codex-sessions/2026-05-19-1900-v0.6.0-实施.md
git commit -m "docs: archive v0.6.0 implementation"
```

## Task 9: 服务器部署和发布收口

**Files:**
- Modify if needed after real server validation: `docs/deploy-v0.6.0.md`
- Modify if needed after real server validation: `docs/acceptance/v0.6.0-production-compose-upgrade.md`
- Modify if needed after real server validation: `docs/codex-sessions/2026-05-19-2100-v0.6.0-服务器验收.md`

- [ ] **Step 1: 查询王文哲飞书信息**

Run on the operator machine with configured `lark-cli`:

```bash
lark-cli contact user search --query '王文哲'
```

Expected: exactly one active user. Record only the confirmed `user_id` in the server `.env` as `INITIAL_PLATFORM_ADMIN_FEISHU_USER_ID`; do not commit local `.env`.

- [ ] **Step 2: 推送镜像到 GitLab Registry**

Run:

```bash
docker build -f deploy/api.Dockerfile -t 192.168.2.73:5050/ai/feishu-iam:v0.6.0 .
docker push 192.168.2.73:5050/ai/feishu-iam:v0.6.0
```

Expected: push PASS. Capture digest from push output for release notes.

- [ ] **Step 3: 在服务器准备目录**

Run on `192.168.2.112`:

```bash
mkdir -p ~/feishu-iam/config ~/feishu-iam/logs ~/feishu-iam/data/postgres ~/feishu-iam/backups
cd ~/feishu-iam
chmod 700 backups
chmod 600 .env
```

Expected: directory exists and `.env` is readable only by owner.

- [ ] **Step 4: 执行停机升级**

Run on `192.168.2.112`:

```bash
cd ~/feishu-iam
./upgrade.sh
```

Expected: script pulls `v0.6.0`, stops `web`, backs up database, applies DDL, starts `web`, `/ready` returns ready, `/version` returns `0.6.0`.

- [ ] **Step 5: 验证端口和数据库隔离**

Run on `192.168.2.112`:

```bash
docker compose ps
docker ps --format '{{.Names}} {{.Ports}}' | rg 'feishu-iam|5432|8000'
curl -fsS http://192.168.2.112:8000/ready
curl -fsS http://192.168.2.112:8000/version
```

Expected: container names include `feishu-iam-db-1` and `feishu-iam-web-1`; only Web exposes `8000`; PostgreSQL does not expose `5432` to host.

- [ ] **Step 6: 验证管理员和破窗退出**

Run browser/manual checks:

```text
1. 打开 http://192.168.2.112:8000/admin/auth/login。
2. 使用“王文哲”飞书身份登录。
3. 打开管理后台，确认 /api/v1/admin/me 返回 roles 包含 platform_admin。
4. 创建一个应用管理员。
5. 访问 http://192.168.2.112:8000/admin/auth/bootstrap，确认不可作为破窗入口使用。
```

Expected: all checks pass.

- [ ] **Step 7: 归档服务器验收**

Create `docs/codex-sessions/2026-05-19-2100-v0.6.0-服务器验收.md` with:

```md
# v0.6.0 服务器部署与验收

## 会话目标

在 `192.168.2.112` 完成 Feishu IAM `v0.6.0` 停机升级和真实管理员登录验收。

## 验证结果

- `docker compose ps`：
- `/ready`：
- `/version`：
- 数据库端口暴露检查：
- `schema_versions`：
- “王文哲”管理员登录：
- 破窗入口不可访问：

## 安全说明

本归档不记录服务器密码、飞书密钥、平台 token、client secret、cookie 或真实 `.env` 内容。
```

- [ ] **Step 8: 发布收口**

Run:

```bash
pnpm check
git status --short
git tag -a v0.6.0 -m "Feishu IAM v0.6.0"
git push origin main
git push origin v0.6.0
```

Expected: checks PASS, tag created and pushed. If using release branch/MR, merge release branch before creating tag.
