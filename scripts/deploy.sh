#!/usr/bin/env bash
# Deploy Food Ordering Application using versioned release directories + atomic symlink cutover.
#
# Release layout on the server:
#   /opt/food-order-3tier-aws/
#     releases/<version>/    ← compose files, scripts, assets
#     current -> releases/<version>   ← systemd WorkingDirectory (symlink)
#     shared/
#       .env                 ← never overwritten; symlinked into each release
#
# Usage:
#   sudo bash deploy.sh [--version=<ver>] [--load-images]
#   sudo bash deploy.sh --rollback

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=scripts/lib/common.sh
source "${SCRIPT_DIR}/scripts/lib/common.sh"
PROJECT_DIR="/opt/food-order-3tier-aws"
LOAD_IMAGES=false
ROLLBACK=false
VERSION=""

if [ "$(id -u)" -ne 0 ]; then
  printf 'ERROR: run as root: sudo bash scripts/deploy.sh ...\n' >&2
  exit 1
fi

# ─── Argument parsing ─────────────────────────────────────────────────────────

for arg in "$@"; do
  case "$arg" in
    --version=*) VERSION="${arg#--version=}" ;;
    --load-images) LOAD_IMAGES=true ;;
    --rollback) ROLLBACK=true ;;
    -h|--help)
      printf 'Usage: sudo bash deploy.sh [OPTIONS]\n\n'
      printf 'Options:\n'
      printf '  --version=<ver>   Deploy a specific version (default: auto-detect from git)\n'
      printf '  --load-images     Load image tarballs from docker-images/ before deploying\n'
      printf '  --rollback        Print rollback instructions and list available releases\n'
      printf '  -h, --help        Show this help\n'
      exit 0
      ;;
    *) printf 'Unknown option: %s\n' "$arg" >&2; exit 1 ;;
  esac
done

# ─── Rollback instructions ────────────────────────────────────────────────────

if [ "$ROLLBACK" = true ]; then
  current_target=$(readlink "${PROJECT_DIR}/current" 2>/dev/null) \
    && current_target=$(basename "${current_target}") \
    || current_target="(none)"
  printf 'Current release: %s\n\n' "${current_target}"
  release_dirs=$(ls -dt "${PROJECT_DIR}/releases"/*/ 2>/dev/null || true)
  if [ -z "$release_dirs" ]; then
    printf 'No releases found under %s/releases/\n\n' "${PROJECT_DIR}"
  else
    printf 'Available releases:\n'
    printf '%s\n' "$release_dirs" | xargs -n1 basename | nl -ba
    printf '\n'
  fi
  printf 'To roll back to a previous release:\n'
  printf '  sudo ln -sfn %s/releases/<version> %s/current\n' "${PROJECT_DIR}" "${PROJECT_DIR}"
  printf '  sudo systemctl restart food-order-3tier\n\n'
  exit 0
fi

# ─── Determine version ────────────────────────────────────────────────────────

if [ -z "$VERSION" ]; then
  VERSION=$(cd "${SCRIPT_DIR}" && \
    git describe --tags --exact-match 2>/dev/null || \
    git rev-parse --short HEAD 2>/dev/null) || {
      printf 'ERROR: cannot determine VERSION — pass --version=<ver>\n' >&2
      exit 1
    }
fi

validate_version "$VERSION"

RELEASE_DIR="${PROJECT_DIR}/releases/${VERSION}"
SHARED_DIR="${PROJECT_DIR}/shared"

printf '═══════════════════════════════════════════════════\n'
printf '  Food Ordering Application — Deploy %s\n' "${VERSION}"
printf '═══════════════════════════════════════════════════\n'

# ─── [1/7] Load images (opt-in) ───────────────────────────────────────────────

if [ "$LOAD_IMAGES" = true ]; then
  printf '[1/7] Loading Docker images...\n'
  bash "${SCRIPT_DIR}/scripts/load-images.sh" --version="${VERSION}"
else
  printf '[1/7] Loading Docker images... skipped (pass --load-images to enable)\n'
fi

# ─── [2/7] Service user ───────────────────────────────────────────────────────

printf '[2/7] Service user...\n'
if ! id food-order-3tier &>/dev/null; then
  useradd -r -m -s /bin/bash -d /opt/food-order-3tier-aws food-order-3tier
  usermod -aG docker food-order-3tier
fi

# ─── [3/7] Release directory ──────────────────────────────────────────────────

printf '[3/7] Creating release %s...\n' "${VERSION}"
mkdir -p "${RELEASE_DIR}"

if [ -f "${RELEASE_DIR}/.version" ]; then
  printf '  Release %s already exists — stopping service before in-place file update\n' "${VERSION}"
  if systemctl is-active --quiet food-order-3tier 2>/dev/null; then
    systemctl stop food-order-3tier
  fi
fi

cd "${SCRIPT_DIR}"

# Copy top-level configuration files
rsync -a \
  docker-compose.yml \
  docker-compose.prod.yml \
  .env.template \
  "${RELEASE_DIR}/"

# Copy supporting scripts
rsync -a scripts/  "${RELEASE_DIR}/scripts/"

# Stamp version
printf 'APP_VERSION=%s\n' "${VERSION}" > "${RELEASE_DIR}/.version"

# ─── [4/7] Shared directory + .env ────────────────────────────────────────────

printf '[4/7] Setting up shared directory...\n'
mkdir -p "${SHARED_DIR}"

if [ ! -f "${SHARED_DIR}/.env" ]; then
  cp "${RELEASE_DIR}/.env.template" "${SHARED_DIR}/.env"
  chmod 600 "${SHARED_DIR}/.env"
  printf '\n  *** IMPORTANT: Edit %s/.env with real credentials, then re-run deploy ***\n\n' "${SHARED_DIR}"
  printf '  sudo nano %s/.env\n\n' "${SHARED_DIR}"
  exit 1
fi

# Merge shared credentials + release version into a real .env for compose.
{ cat "${SHARED_DIR}/.env"; printf '\nAPP_VERSION=%s\n' "${VERSION}"; } \
  > "${RELEASE_DIR}/.env"
chmod 600 "${RELEASE_DIR}/.env"

# ─── [5/7] env-check ──────────────────────────────────────────────────────────

printf '[5/7] Checking environment variables...\n'
template_vars=$(grep -E '^[A-Z_][A-Z0-9_]*=' "${RELEASE_DIR}/.env.template" \
  | cut -d= -f1 | grep -v '^APP_VERSION$' | sort)
deployed_vars=$(grep -E '^[A-Z_][A-Z0-9_]*=' "${SHARED_DIR}/.env" \
  | cut -d= -f1 | grep -v '^APP_VERSION$' | sort)

if [ -n "${template_vars}" ] && [ -n "${deployed_vars}" ]; then
  missing=$(comm -23 <(printf '%s\n' "${template_vars}") <(printf '%s\n' "${deployed_vars}") || true)
  deprecated=$(comm -13 <(printf '%s\n' "${template_vars}") <(printf '%s\n' "${deployed_vars}") || true)
else
  missing="${template_vars}"
  deprecated="${deployed_vars}"
fi

if [ -n "$missing" ]; then
  printf 'ERROR: variables required by %s but missing from %s/.env:\n' "${VERSION}" "${SHARED_DIR}"
  printf '%s\n' "${missing}" | sed 's/^/  /'
  exit 1
fi

if [ -n "$deprecated" ]; then
  printf 'WARNING: variables in %s/.env not used by %s (safe to remove):\n' "${SHARED_DIR}" "${VERSION}"
  printf '%s\n' "${deprecated}" | sed 's/^/  /'
fi

check_required_env "${SHARED_DIR}/.env"

# ─── [6/7] Ownership + atomic cutover ────────────────────────────────────────

printf '[6/7] Setting ownership and cutting over...\n'
chown -R food-order-3tier:food-order-3tier "${PROJECT_DIR}"
ln -sfn "${PROJECT_DIR}/releases/${VERSION}" "${PROJECT_DIR}/current"
printf '  current → releases/%s\n' "${VERSION}"

# ─── Systemd service (idempotent) ─────────────────────────────────────────────

tee /etc/systemd/system/food-order-3tier.service > /dev/null << 'SVCEOF'
[Unit]
Description=Food Ordering Application (3-Tier)
Requires=docker.service
After=docker.service network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
User=food-order-3tier
Group=docker
WorkingDirectory=/opt/food-order-3tier-aws/current
EnvironmentFile=/opt/food-order-3tier-aws/current/.version
ExecStart=/usr/bin/docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
ExecStop=/usr/bin/docker compose -f docker-compose.yml -f docker-compose.prod.yml down
ExecReload=/usr/bin/docker compose -f docker-compose.yml -f docker-compose.prod.yml restart web frontend
TimeoutStartSec=120

[Install]
WantedBy=multi-user.target
SVCEOF

systemctl daemon-reload
systemctl enable food-order-3tier.service

# ─── [7/7] Start ──────────────────────────────────────────────────────────────

printf '[7/7] Starting version %s...\n' "${VERSION}"
if systemctl is-active --quiet food-order-3tier; then
  systemctl restart food-order-3tier
else
  systemctl start food-order-3tier
fi

# ─── Prune old releases (keep last 3) ────────────────────────────────────────

current_release=$(readlink -f "${PROJECT_DIR}/current" 2>/dev/null || true)

{ ls -dt "${PROJECT_DIR}/releases"/*/ 2>/dev/null || true; } | tail -n +4 | while read -r dir; do
  dir=$(readlink -f "$dir" 2>/dev/null) || continue
  if [ -n "$current_release" ] && [ "$dir" = "$current_release" ]; then
    continue
  fi
  case "$dir" in
    "${PROJECT_DIR}/releases/"*)
      printf 'Pruning old release: %s\n' "$(basename "$dir")"
      rm -rf "$dir" ;;
    *)
      printf 'WARNING: refusing to prune unexpected path: %s\n' "$dir" ;;
  esac
done

printf '═══════════════════════════════════════════════════\n'
printf '  Deployment complete: %s\n' "${VERSION}"
printf '═══════════════════════════════════════════════════\n\n'
printf '  Verify:\n'
printf '    curl -s http://localhost:8000/api/v1\n'
printf '    curl -s http://localhost:8080/\n\n'
printf '  Rollback: sudo bash scripts/deploy.sh --rollback\n\n'
