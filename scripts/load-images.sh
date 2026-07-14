#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=scripts/lib/common.sh
source "${SCRIPT_DIR}/scripts/lib/common.sh"
VERSION=""

for arg in "$@"; do
  case "$arg" in
    --version=*) VERSION="${arg#--version=}" ;;
    -h|--help)
      printf 'Usage: bash scripts/load-images.sh --version=<VERSION>\n'
      exit 0
      ;;
    *) printf 'Unknown option: %s\n' "$arg" >&2; exit 1 ;;
  esac
done

if [ -z "$VERSION" ]; then
  printf 'ERROR: --version=<VERSION> is required\n' >&2
  exit 1
fi

validate_version "$VERSION"

IMAGES_DIR="${SCRIPT_DIR}/docker-images"

for name in "food-api" "food-ui"; do
  tarball="${IMAGES_DIR}/${name}-${VERSION}.tar.gz"
  if [ ! -f "$tarball" ]; then
    printf 'ERROR: %s not found\n' "$tarball" >&2
    exit 1
  fi
  printf 'Loading %s...\n' "$tarball"
  gunzip -c "$tarball" | docker load
done

printf 'Loaded images:\n'
docker images --filter "reference=food-api" --filter "reference=food-ui" \
  --format "  {{.Repository}}:{{.Tag}}"
