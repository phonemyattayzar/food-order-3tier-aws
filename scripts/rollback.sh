#!/usr/bin/env bash
# scripts/rollback.sh — Instant rollback to a previous release.
#
# Workflow:
#   1. Lock deployment to prevent concurrent operations.
#   2. Identify the active release and find the previous release.
#   3. Start containers using the previous release configuration.
#   4. Validate health checks.
#   5. Atomically switch /opt/food-order-3tier-aws/current back to the previous release.
#
# Usage:
#   sudo ./scripts/rollback.sh                 # Automatically roll back to immediately prior release
#   sudo ./scripts/rollback.sh --version=v1.0.0 # Roll back to a specific existing release
#   sudo ./scripts/rollback.sh --list          # List available releases for rollback

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
source "${SCRIPT_DIR}/scripts/lib/common.sh"

RUNTIME_BASE="/opt/food-order-3tier-aws"
RELEASES_DIR="${RUNTIME_BASE}/releases"
CURRENT_LINK="${RUNTIME_BASE}/current"
LOCK_FILE="${RUNTIME_BASE}/.deploy.lock"

if [ "$(id -u)" -ne 0 ]; then
  log_error "This script must be run as root: sudo ./scripts/rollback.sh"
  exit 1
fi

ACTION="rollback"
TARGET_VERSION=""

for arg in "$@"; do
  case "$arg" in
    --list|-l)
      ACTION="list"
      ;;
    --version=*)
      TARGET_VERSION="${arg#--version=}"
      ;;
    -h|--help)
      printf "Usage:\n"
      printf "  sudo ./scripts/rollback.sh                 # Rollback to immediately prior release\n"
      printf "  sudo ./scripts/rollback.sh --version=<ver> # Rollback to specific version\n"
      printf "  sudo ./scripts/rollback.sh --list          # List available releases\n"
      exit 0
      ;;
    *)
      log_error "Unknown option: $arg"
      exit 1
      ;;
  esac
done

if [ ! -L "${CURRENT_LINK}" ]; then
  log_error "No active release found. Symlink '${CURRENT_LINK}' does not exist."
  exit 1
fi

CURRENT_TARGET=$(readlink -f "${CURRENT_LINK}")
CURRENT_VERSION=$(basename "${CURRENT_TARGET}")

if [ "$ACTION" = "list" ]; then
  log_step "Releases currently available in ${RELEASES_DIR}"
  printf "Active release: %s\n\n" "${CURRENT_VERSION}"
  ls -dt "${RELEASES_DIR}"/*/ 2>/dev/null | while read -r dir; do
    rel_name=$(basename "$dir")
    if [ "$rel_name" = "$CURRENT_VERSION" ]; then
      printf "  * %s (ACTIVE)\n" "$rel_name"
    else
      printf "    %s\n" "$rel_name"
    fi
  done
  exit 0
fi

# ─── Deployment Concurrency Lock ─────────────────────────────────────────────
exec 200>"${LOCK_FILE}"
if ! flock -n 200; then
  log_error "Another deployment or rollback is currently in progress. Exiting."
  exit 1
fi

printf "${C_BOLD}======================================================${C_RESET}\n"
printf "${C_BOLD}  Food Ordering Application — Rollback System        ${C_RESET}\n"
printf "${C_BOLD}======================================================${C_RESET}\n"
printf "Active release: %s\n" "${CURRENT_VERSION}"

# Determine target version
if [ -n "$TARGET_VERSION" ]; then
  validate_version "$TARGET_VERSION"
  TARGET_DIR="${RELEASES_DIR}/${TARGET_VERSION}"
  if [ ! -d "$TARGET_DIR" ]; then
    log_error "Target release '${TARGET_VERSION}' not found in ${RELEASES_DIR}."
    exit 1
  fi
else
  # Find the most recent release that is NOT the current release
  TARGET_DIR=""
  while read -r candidate; do
    [ -z "$candidate" ] && continue
    cand_real=$(readlink -f "$candidate")
    if [ "$cand_real" != "$CURRENT_TARGET" ]; then
      TARGET_DIR="$cand_real"
      TARGET_VERSION=$(basename "$cand_real")
      break
    fi
  done < <(ls -dt "${RELEASES_DIR}"/*/ 2>/dev/null || true)

  if [ -z "$TARGET_DIR" ] || [ ! -d "$TARGET_DIR" ]; then
    log_error "No previous release found in ${RELEASES_DIR} to roll back to."
    exit 1
  fi
fi

if [ "$TARGET_VERSION" = "$CURRENT_VERSION" ]; then
  log_warn "Target version (${TARGET_VERSION}) is already active. Nothing to rollback."
  exit 0
fi

log_step "Initiating rollback from ${CURRENT_VERSION} -> ${TARGET_VERSION}"

# ─── 1. Verify Target Release Files ─────────────────────────────────────────
log_step "1/4 Verifying target release directory"
if [ ! -f "${TARGET_DIR}/docker-compose.yml" ] || [ ! -f "${TARGET_DIR}/.env" ]; then
  log_error "Target release ${TARGET_VERSION} is incomplete (missing docker-compose.yml or .env)."
  exit 1
fi
log_success "Target release files verified."

# ─── 2. Start Previous Release Containers ───────────────────────────────────
log_step "2/4 Starting containers for release ${TARGET_VERSION}"
docker compose -p food-order-3tier --project-directory "${TARGET_DIR}" up -d --remove-orphans
log_success "Containers switched to release ${TARGET_VERSION}."

# ─── 3. Health Checks ───────────────────────────────────────────────────────
log_step "3/4 Validating health checks on rolled-back release"

wait_for_health() {
  local service_name="$1"
  local url="$2"
  local max_attempts="${3:-20}"
  local delay="${4:-2}"

  local attempt=1
  while [ "$attempt" -le "$max_attempts" ]; do
    if curl -fsSL -o /dev/null "$url" 2>/dev/null; then
      log_success "${service_name} is healthy."
      return 0
    fi
    sleep "$delay"
    attempt=$((attempt + 1))
  done

  log_error "${service_name} failed health check."
  return 1
}

wait_for_health "Backend API" "http://localhost:8000/api/v1" 20 2
wait_for_health "Frontend UI" "http://localhost:8080/" 15 2

# ─── 4. Atomic Symlink Switch ───────────────────────────────────────────────
log_step "4/4 Health check passed! Switching symlink to ${TARGET_VERSION}"
atomic_symlink_switch "releases/${TARGET_VERSION}" "${CURRENT_LINK}"
log_success "Symlink switched: ${CURRENT_LINK} -> releases/${TARGET_VERSION}"

if systemctl is-active --quiet food-order-3tier 2>/dev/null; then
  systemctl reload food-order-3tier 2>/dev/null || true
fi

printf "\n${C_BOLD}${C_GREEN}======================================================${C_RESET}\n"
printf "${C_BOLD}${C_GREEN}  Rollback Successful: ${CURRENT_VERSION} -> ${TARGET_VERSION}${C_RESET}\n"
printf "${C_BOLD}${C_GREEN}======================================================${C_RESET}\n\n"
printf "Active Release: %s -> %s\n\n" "${CURRENT_LINK}" "$(readlink "${CURRENT_LINK}")"
