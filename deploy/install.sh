#!/usr/bin/env bash
set -euo pipefail
umask 077

FEISHU_IAM_VERSION="${FEISHU_IAM_VERSION:-v1.0.2}"
FEISHU_IAM_DEPLOY_DIR="${FEISHU_IAM_DEPLOY_DIR:-${HOME}/feishu-iam}"
FEISHU_IAM_RAW_BASE="${FEISHU_IAM_RAW_BASE:-https://raw.githubusercontent.com/wodenwang/feishu-iam/${FEISHU_IAM_VERSION}}"

mkdir -p "${FEISHU_IAM_DEPLOY_DIR}"
cd "${FEISHU_IAM_DEPLOY_DIR}"

download() {
  local source_path="$1"
  local target_path="$2"
  curl -fsSL "${FEISHU_IAM_RAW_BASE}/${source_path}" -o "${target_path}"
}

download "deploy/docker-compose.yml" "docker-compose.yaml"
download "deploy/server.env.example" ".env.example"
download "deploy/upgrade.sh" "upgrade.sh"
chmod 700 upgrade.sh

if [ ! -f ".env" ]; then
  cp .env.example .env
  chmod 600 .env
fi

echo "Feishu IAM deployment files are ready in ${FEISHU_IAM_DEPLOY_DIR}"
echo "Edit ${FEISHU_IAM_DEPLOY_DIR}/.env on this server, then run:"
echo "  cd ${FEISHU_IAM_DEPLOY_DIR} && FEISHU_IAM_IMAGE_TAG=${FEISHU_IAM_VERSION} ./upgrade.sh"
