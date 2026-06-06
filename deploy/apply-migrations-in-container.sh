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

PSQL_DATABASE_URL="$(
  printf '%s' "${DATABASE_URL}" \
    | sed -E 's/[?&]schema=[^&]*&?/?/; s/[?&]$//; s/\\?&/?/'
)"

schema_versions_exists() {
  psql "${PSQL_DATABASE_URL}" -tAc "select to_regclass('public.schema_versions') is not null;" | tr -d '[:space:]'
}

validate_migration_version() {
  local version="$1"
  if [[ ! "${version}" =~ ^[0-9]+(\.[0-9]+)*$ ]]; then
    echo "invalid migration version: ${version}" >&2
    exit 1
  fi
}

migration_applied() {
  local version="$1"
  local applied
  if [ "$(schema_versions_exists)" != "t" ]; then
    return 1
  fi
  applied="$(
    psql -v migration_version="${version}" "${PSQL_DATABASE_URL}" -tA <<'SQL' | tr -d '[:space:]'
select exists(select 1 from schema_versions where version = :'migration_version');
SQL
  )"
  [ "${applied}" = "t" ]
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
  validate_migration_version "${version}"

  if migration_applied "${version}"; then
    echo "==> Skipping ${filename}; version ${version} already applied"
    continue
  fi

  echo "==> Applying ${filename}"
  psql \
    -v ON_ERROR_STOP=1 \
    -v initial_platform_admin_feishu_user_id="${INITIAL_PLATFORM_ADMIN_FEISHU_USER_ID:-}" \
    "${PSQL_DATABASE_URL}" < "${migration}"
done

echo "==> Database migrations applied"
