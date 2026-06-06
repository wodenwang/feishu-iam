#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="${COMPOSE_FILE:-${ROOT_DIR}/deploy/docker-compose.yml}"

case "${COMPOSE_FILE}" in
  /*) ;;
  *) COMPOSE_FILE="${ROOT_DIR}/${COMPOSE_FILE}" ;;
esac

if [ -f "${ROOT_DIR}/.env" ]; then
  exec docker compose --project-directory "${ROOT_DIR}" --env-file "${ROOT_DIR}/.env" -f "${COMPOSE_FILE}" "$@"
fi

if [ -f "${ROOT_DIR}/deploy/.env" ]; then
  exec docker compose --project-directory "${ROOT_DIR}" --env-file "${ROOT_DIR}/deploy/.env" -f "${COMPOSE_FILE}" "$@"
fi

exec docker compose --project-directory "${ROOT_DIR}" -f "${COMPOSE_FILE}" "$@"
