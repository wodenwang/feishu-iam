#!/usr/bin/env bash
set -euo pipefail
umask 077

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ -f "${SCRIPT_DIR}/docker-compose.yml" ] && [ "$(basename "${SCRIPT_DIR}")" = "deploy" ]; then
  ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
  DEFAULT_COMPOSE_FILE="${SCRIPT_DIR}/docker-compose.yml"
else
  ROOT_DIR="${SCRIPT_DIR}"
  if [ -f "${ROOT_DIR}/docker-compose.yaml" ]; then
    DEFAULT_COMPOSE_FILE="${ROOT_DIR}/docker-compose.yaml"
  else
    DEFAULT_COMPOSE_FILE="${ROOT_DIR}/docker-compose.yml"
  fi
fi

COMPOSE_FILE="${COMPOSE_FILE:-${DEFAULT_COMPOSE_FILE}}"
case "${COMPOSE_FILE}" in
  /*) ;;
  *) COMPOSE_FILE="${ROOT_DIR}/${COMPOSE_FILE}" ;;
esac

if [ ! -f "${COMPOSE_FILE}" ]; then
  echo "compose file not found: ${COMPOSE_FILE}" >&2
  exit 1
fi

load_env_file() {
  local env_file="$1"
  local line key value

  [ -f "${env_file}" ] || return 0

  while IFS= read -r line || [ -n "${line}" ]; do
    line="${line%$'\r'}"
    [[ "${line}" =~ ^[[:space:]]*($|#) ]] && continue
    [[ "${line}" =~ ^[[:space:]]*([A-Za-z_][A-Za-z0-9_]*)[[:space:]]*=(.*)$ ]] || continue

    key="${BASH_REMATCH[1]}"
    value="${BASH_REMATCH[2]}"
    [ "${!key+x}" = "x" ] && continue

    value="${value#"${value%%[![:space:]]*}"}"
    if [[ "${value}" =~ ^\"(.*)\"[[:space:]]*(#.*)?$ ]]; then
      value="${BASH_REMATCH[1]}"
    elif [[ "${value}" =~ ^\'(.*)\'[[:space:]]*(#.*)?$ ]]; then
      value="${BASH_REMATCH[1]}"
    else
      value="${value%%[[:space:]]#*}"
      value="${value%"${value##*[![:space:]]}"}"
    fi

    export "${key}=${value}"
  done < "${env_file}"
}

require_env() {
  local name="$1"
  if [ -z "${!name:-}" ]; then
    echo "${name} is required" >&2
    exit 1
  fi
}

ENV_FILE=""
if [ -f "${ROOT_DIR}/.env" ]; then
  ENV_FILE="${ROOT_DIR}/.env"
elif [ -f "${ROOT_DIR}/deploy/.env" ]; then
  ENV_FILE="${ROOT_DIR}/deploy/.env"
fi

if [ -n "${ENV_FILE}" ]; then
  load_env_file "${ENV_FILE}"
fi

require_env DATABASE_URL
require_env FEISHU_IAM_IMAGE_TAG
require_env INITIAL_PLATFORM_ADMIN_FEISHU_USER_ID

EXPECTED_VERSION="${APP_VERSION:-${FEISHU_IAM_IMAGE_TAG}}"
EXPECTED_VERSION_PATTERN="$(printf '%s\n' "${EXPECTED_VERSION}" | sed 's/[][(){}.^$*+?|\\]/\\&/g')"
POSTGRES_USER="${POSTGRES_USER:-feishu_iam}"
POSTGRES_DB="${POSTGRES_DB:-feishu_iam}"
BACKUP_ROOT="${FEISHU_IAM_BACKUP_DIR:-${ROOT_DIR}/backups}"
BACKUP_DIR="${BACKUP_ROOT}/$(date +%Y%m%d-%H%M%S)"
BACKUP_FILE="${BACKUP_DIR}/${POSTGRES_DB}.sql"
VERSION_FILE="${BACKUP_DIR}/version.json"
PUBLIC_URL="${FEISHU_IAM_HEALTHCHECK_URL:-${FEISHU_IAM_PUBLIC_URL:-http://localhost:${HOST_WEB_PORT:-8000}}}"
GIT_REMOTE_URL="${FEISHU_IAM_GIT_REMOTE:-git@github.com:wodenwang/feishu-iam.git}"
GIT_REF="${FEISHU_IAM_GIT_REF:-}"
GIT_SYNC="${FEISHU_IAM_GIT_SYNC:-auto}"
PULL_POLICY="${FEISHU_IAM_PULL_POLICY:-always}"
WEB_IMAGE="${FEISHU_IAM_IMAGE:-feishu-iam}:${FEISHU_IAM_IMAGE_TAG}"

compose() {
  local args=(--project-directory "${ROOT_DIR}")

  if [ -n "${ENV_FILE}" ]; then
    args+=(--env-file "${ENV_FILE}")
  fi

  docker compose "${args[@]}" -f "${COMPOSE_FILE}" "$@"
}

mkdir -p "${BACKUP_DIR}"
chmod 700 "${BACKUP_ROOT}" "${BACKUP_DIR}"

git_sync_enabled() {
  case "${GIT_SYNC}" in
    0|false|FALSE|no|NO|off|OFF)
      return 1
      ;;
    auto|AUTO)
      [ -d "${ROOT_DIR}/.git" ]
      return
      ;;
    *)
      return 0
      ;;
  esac
}

current_git_branch() {
  git -C "${ROOT_DIR}" symbolic-ref --quiet --short HEAD 2>/dev/null || true
}

sync_git_repository() {
  local branch current_remote

  if ! git_sync_enabled; then
    echo "==> Git sync skipped"
    return 0
  fi

  if ! command -v git >/dev/null 2>&1; then
    echo "git command not found" >&2
    exit 1
  fi

  if [ ! -d "${ROOT_DIR}/.git" ]; then
    echo "FEISHU_IAM_GIT_SYNC is enabled, but ${ROOT_DIR} is not a Git repository" >&2
    exit 1
  fi

  echo "==> Synchronizing deployment repository from ${GIT_REMOTE_URL}"
  current_remote="$(git -C "${ROOT_DIR}" remote get-url origin 2>/dev/null || true)"
  if [ -z "${current_remote}" ]; then
    git -C "${ROOT_DIR}" remote add origin "${GIT_REMOTE_URL}"
  elif [ "${current_remote}" != "${GIT_REMOTE_URL}" ]; then
    git -C "${ROOT_DIR}" remote set-url origin "${GIT_REMOTE_URL}"
  fi

  git -C "${ROOT_DIR}" fetch origin --prune

  if [ -n "${GIT_REF}" ]; then
    git -C "${ROOT_DIR}" checkout "${GIT_REF}"
    if branch="$(current_git_branch)" && [ -n "${branch}" ]; then
      git -C "${ROOT_DIR}" pull --ff-only origin "${branch}"
    fi
    return 0
  fi

  branch="$(current_git_branch)"
  if [ -z "${branch}" ]; then
    echo "Git repository is in detached HEAD; set FEISHU_IAM_GIT_REF to enable automatic Git sync" >&2
    exit 1
  fi

  git -C "${ROOT_DIR}" pull --ff-only origin "${branch}"
}

wait_for_db() {
  echo "==> Waiting for database to become healthy"
  for i in {1..60}; do
    if compose exec -T db pg_isready -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" >/dev/null 2>&1; then
      echo "==> Database is healthy"
      return 0
    fi
    if [ "${i}" -eq 60 ]; then
      echo "database did not become healthy" >&2
      exit 1
    fi
    sleep 2
  done
}

echo "==> Feishu IAM upgrade started"
echo "==> Compose file: ${COMPOSE_FILE}"
echo "==> Backup directory: ${BACKUP_DIR}"

for command_name in docker curl; do
  if ! command -v "${command_name}" >/dev/null 2>&1; then
    echo "${command_name} command not found" >&2
    exit 1
  fi
done

sync_git_repository

case "${PULL_POLICY}" in
  never)
    echo "==> Skipping image pull because FEISHU_IAM_PULL_POLICY=never"
    if ! docker image inspect "${WEB_IMAGE}" >/dev/null 2>&1; then
      echo "local image not found: ${WEB_IMAGE}" >&2
      exit 1
    fi
    ;;
  always|missing|if-not-present)
    echo "==> Running docker compose pull web"
    compose pull web
    ;;
  *)
    echo "unsupported FEISHU_IAM_PULL_POLICY: ${PULL_POLICY}" >&2
    exit 1
    ;;
esac

echo "==> Running docker compose stop web"
compose stop web || true

echo "==> Starting database"
compose up -d db

wait_for_db

echo "==> Creating database backup"
compose exec -T db pg_dump -U "${POSTGRES_USER}" "${POSTGRES_DB}" > "${BACKUP_FILE}"
chmod 600 "${BACKUP_FILE}"

echo "==> Applying database migrations"
compose run --rm --no-deps web bash /app/deploy/apply-migrations-in-container.sh

echo "==> Starting web"
compose up -d web

echo "==> Checking readiness at ${PUBLIC_URL}/ready"
for i in {1..60}; do
  if curl -fsS "${PUBLIC_URL}/ready" | grep -Eq '"status"[[:space:]]*:[[:space:]]*"ready"'; then
    echo "==> Feishu IAM is ready"
    break
  fi
  if [ "${i}" -eq 60 ]; then
    echo "Feishu IAM did not become ready. Backup is at ${BACKUP_DIR}" >&2
    exit 1
  fi
  sleep 2
done

echo "==> Checking version at ${PUBLIC_URL}/version"
curl -fsS "${PUBLIC_URL}/version" > "${VERSION_FILE}"
chmod 600 "${VERSION_FILE}"
if ! grep -Eq "\"version\"[[:space:]]*:[[:space:]]*\"${EXPECTED_VERSION_PATTERN}\"" "${VERSION_FILE}"; then
  echo "version response does not match expected version ${EXPECTED_VERSION}. Response is at ${VERSION_FILE}" >&2
  exit 1
fi

echo "==> Feishu IAM upgrade completed"
