#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=scripts/lib/common.sh
source "${SCRIPT_DIR}/scripts/lib/common.sh"

VERSION=$(cd "${SCRIPT_DIR}" && \
  git describe --tags --exact-match 2>/dev/null || \
  git rev-parse --short HEAD 2>/dev/null) || {
    printf 'ERROR: cannot determine version from git\n' >&2
    exit 1
  }

validate_version "$VERSION"

printf '%s\n' "${VERSION}" > "${SCRIPT_DIR}/.release-version"
printf 'Building version: %s\n' "${VERSION}"

docker build \
  -t "food-api:${VERSION}" \
  -t "food-api:latest" \
  "${SCRIPT_DIR}/backend"

docker build \
  -t "food-ui:${VERSION}" \
  -t "food-ui:latest" \
  "${SCRIPT_DIR}/frontend"

mkdir -p "${SCRIPT_DIR}/docker-images"
printf 'Saving images to docker-images/...\n'

docker save "food-api:${VERSION}" \
  | gzip > "${SCRIPT_DIR}/docker-images/food-api-${VERSION}.tar.gz.tmp" \
  && mv "${SCRIPT_DIR}/docker-images/food-api-${VERSION}.tar.gz.tmp" \
        "${SCRIPT_DIR}/docker-images/food-api-${VERSION}.tar.gz"

docker save "food-ui:${VERSION}" \
  | gzip > "${SCRIPT_DIR}/docker-images/food-ui-${VERSION}.tar.gz.tmp" \
  && mv "${SCRIPT_DIR}/docker-images/food-ui-${VERSION}.tar.gz.tmp" \
        "${SCRIPT_DIR}/docker-images/food-ui-${VERSION}.tar.gz"

printf 'Done. Built images:\n'
docker images --filter "reference=food-api" --filter "reference=food-ui" \
  --format "  {{.Repository}}:{{.Tag}}"
