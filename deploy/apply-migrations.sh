#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

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

if [ -f "${ROOT_DIR}/.env" ]; then
  load_env_file "${ROOT_DIR}/.env"
elif [ -f "${ROOT_DIR}/deploy/.env" ]; then
  load_env_file "${ROOT_DIR}/deploy/.env"
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "docker command not found" >&2
  exit 1
fi

POSTGRES_USER="${POSTGRES_USER:-feishu_iam}"
POSTGRES_DB="${POSTGRES_DB:-feishu_iam}"

wait_for_db() {
  echo "==> Waiting for database to become healthy"
  for i in {1..60}; do
    if "${ROOT_DIR}/deploy/compose.sh" exec -T db pg_isready -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" >/dev/null 2>&1; then
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

echo "==> Starting database"
"${ROOT_DIR}/deploy/compose.sh" up -d db

wait_for_db

echo "==> Applying database migrations from web image"
"${ROOT_DIR}/deploy/compose.sh" run --rm --no-deps web bash /app/deploy/apply-migrations-in-container.sh
