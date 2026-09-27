#!/usr/bin/env bash
# scripts/deploy.sh — Production-style atomic release deployment script.
#
# Workflow:
#   1. Lock deployment to prevent concurrent runs.
#   2. Validate version and verify pre-built Docker images exist.
#   3. Create isolated release directory: /opt/food-order-3tier-aws/releases/<version>
#   4. Prepare release configuration (.env with shared secrets + VERSION).
#   5. Start containers via Docker Compose with the new release directory.
#   6. Perform rigorous health checks (Postgres, Backend API, Frontend).
#   7. If healthy: ATOMICALLY switch /opt/food-order-3tier-aws/current symlink.
#   8. If unhealthy: abort, retain previous release symlink, and restore containers.
#   9. Run Alembic database migrations inside the healthy container.
#  10. Prune obsolete releases (retaining the 3 latest for rollback).
#
# Usage:
#   sudo ./scripts/deploy.sh --version=v1.1.0

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
source "${SCRIPT_DIR}/scripts/lib/common.sh"

RUNTIME_BASE="/opt/food-order-3tier-aws"
RELEASES_DIR="${RUNTIME_BASE}/releases"
SHARED_DIR="${RUNTIME_BASE}/shared"
CURRENT_LINK="${RUNTIME_BASE}/current"
LOCK_FILE="${RUNTIME_BASE}/.deploy.lock"
OPERATOR_USER="${SUDO_USER:-ubuntu}"

if [ "$(id -u)" -ne 0 ]; then
  log_error "This script must be run as root: sudo ./scripts/deploy.sh --version=<version>"
  exit 1
fi

VERSION=""
for arg in "$@"; do
  case "$arg" in
    --version=*)
      VERSION="${arg#--version=}"
      ;;
    -h|--help)
      printf "Usage: sudo ./scripts/deploy.sh --version=<version>\n"
      printf "Example: sudo ./scripts/deploy.sh --version=v1.1.0\n"
      exit 0
      ;;
    *)
      log_error "Unknown option: $arg"
      exit 1
      ;;
  esac
done

# If VERSION not passed, attempt auto-detection from git
if [ -z "$VERSION" ]; then
  VERSION=$(cd "${SCRIPT_DIR}" && git describe --tags --exact-match 2>/dev/null || git rev-parse --short HEAD 2>/dev/null || true)
fi

if [ -z "$VERSION" ]; then
  log_error "Missing version. Pass --version=<version> (e.g. --version=v1.1.0)"
  exit 1
fi

validate_version "$VERSION"

# ─── Deployment Concurrency Lock ─────────────────────────────────────────────
mkdir -p "${RUNTIME_BASE}"
exec 200>"${LOCK_FILE}"
if ! flock -n 200; then
  log_error "Another deployment is currently in progress. Exiting."
  exit 1
fi

printf "${C_BOLD}======================================================${C_RESET}\n"
printf "${C_BOLD}  Deploying Food Ordering Application — Release %s${C_RESET}\n" "${VERSION}"
printf "${C_BOLD}======================================================${C_RESET}\n"

# ─── 1. Verify Local Pre-built Docker Images ────────────────────────────────
log_step "1/8 Verifying pre-built Docker images for ${VERSION}"

for img in "food-api:${VERSION}" "food-ui:${VERSION}"; do
  if ! docker image inspect "$img" >/dev/null 2>&1; then
    log_error "Required image '$img' does not exist in the local Docker engine."
    log_info "Please build the images on the server first:"
    log_info "  make build VERSION=${VERSION}"
    exit 1
  fi
  log_success "Found image: $img"
done

# ─── 2. Verify Shared Environment ───────────────────────────────────────────
log_step "2/8 Verifying shared production configuration"

if [ ! -f "${SHARED_DIR}/.env" ]; then
  log_error "Shared environment file '${SHARED_DIR}/.env' was not found."
  log_info "Run initial server setup or create it: sudo ./scripts/setup-server.sh"
  exit 1
fi
log_success "Found ${SHARED_DIR}/.env"

# ─── 3. Create Release Directory ────────────────────────────────────────────
RELEASE_DIR="${RELEASES_DIR}/${VERSION}"
log_step "3/8 Preparing release directory at ${RELEASE_DIR}"

mkdir -p "${RELEASE_DIR}"

# Copy compose specification for this release
cp "${SCRIPT_DIR}/docker-compose.yml" "${RELEASE_DIR}/docker-compose.yml"

# Generate release-scoped .env (combining shared credentials + version)
cat "${SHARED_DIR}/.env" > "${RELEASE_DIR}/.env"
printf "\n# Release Version\nVERSION=%s\n" "${VERSION}" >> "${RELEASE_DIR}/.env"
chmod 600 "${RELEASE_DIR}/.env"

# Stamp release metadata
cat << METADATA > "${RELEASE_DIR}/.release-meta"
VERSION=${VERSION}
DEPLOYED_AT=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
DEPLOYED_BY=${OPERATOR_USER}
SOURCE_COMMIT=$(cd "${SCRIPT_DIR}" && git rev-parse HEAD 2>/dev/null || echo "unknown")
METADATA

chmod 755 "${RELEASE_DIR}"
chown -R "${OPERATOR_USER}:docker" "${RELEASE_DIR}"
log_success "Release directory staged successfully."

# Record currently active release before making changes (for rollback on failure)
PREVIOUS_RELEASE=""
if [ -L "${CURRENT_LINK}" ]; then
  PREVIOUS_RELEASE=$(readlink -f "${CURRENT_LINK}" || true)
fi

# ─── 4. Launch Release Containers ───────────────────────────────────────────
log_step "4/8 Starting application containers for release ${VERSION}"

docker compose -p food-order-3tier --project-directory "${RELEASE_DIR}" up -d --remove-orphans
log_success "Containers launched."

# ─── 5. Health Checks ───────────────────────────────────────────────────────
log_step "5/8 Performing health checks"

wait_for_health() {
  local service_name="$1"
  local url="$2"
  local max_attempts="${3:-30}"
  local delay="${4:-2}"

  log_info "Checking ${service_name} endpoint at ${url}..."
  local attempt=1
  while [ "$attempt" -le "$max_attempts" ]; do
    if curl -fsSL -o /dev/null "$url" 2>/dev/null; then
      log_success "${service_name} is healthy (responded 200 OK)."
      return 0
    fi
    sleep "$delay"
    attempt=$((attempt + 1))
  done

  log_error "${service_name} failed health check after $((max_attempts * delay)) seconds."
  return 1
}

health_failed=0

# Verify PostgreSQL is ready
log_info "Verifying database readiness..."
db_attempts=15
while [ "$db_attempts" -gt 0 ]; do
  if docker exec food_db pg_isready -U postgres >/dev/null 2>&1; then
    log_success "PostgreSQL database is ready."
    break
  fi
  sleep 2
  db_attempts=$((db_attempts - 1))
done

if [ "$db_attempts" -eq 0 ]; then
  log_error "PostgreSQL database failed readiness check."
  health_failed=1
fi

# Verify Backend API (FastAPI)
if ! wait_for_health "Backend API" "http://localhost:8000/api/v1" 25 2; then
  health_failed=1
fi

# Verify Frontend UI (Nginx)
if ! wait_for_health "Frontend UI" "http://localhost:8080/" 15 2; then
  health_failed=1
fi

# ─── Handling Health Check Failure ──────────────────────────────────────────
if [ "$health_failed" -ne 0 ]; then
  log_error "Health checks failed for release ${VERSION}!"
  log_info "Printing recent backend logs for diagnosis:"
  docker logs food_api --tail 40 2>&1 || true

  if [ -n "$PREVIOUS_RELEASE" ] && [ -d "$PREVIOUS_RELEASE" ]; then
    log_warn "Restoring previous release at ${PREVIOUS_RELEASE}..."
    docker compose -p food-order-3tier --project-directory "${PREVIOUS_RELEASE}" up -d --remove-orphans
    log_info "Symlink '${CURRENT_LINK}' was preserved pointing to previous release."
  fi

  log_error "Deployment of ${VERSION} aborted. System remains on previous working release."
  exit 1
fi

# ─── 6. Atomic Symlink Cutover ──────────────────────────────────────────────
log_step "6/8 Release is healthy! Performing atomic symlink switch"

# Use relative path so the directory structure is self-contained and portable
atomic_symlink_switch "releases/${VERSION}" "${CURRENT_LINK}"
log_success "Symlink switched atomically: ${CURRENT_LINK} -> releases/${VERSION}"

# Sync systemd service state
if systemctl is-active --quiet food-order-3tier 2>/dev/null; then
  systemctl reload food-order-3tier 2>/dev/null || true
else
  systemctl start food-order-3tier 2>/dev/null || true
fi

# ─── 7. Database Migrations (Post-Cutover) ──────────────────────────────────
log_step "7/8 Applying database migrations"
if docker exec food_api alembic upgrade head; then
  log_success "Database migrations applied successfully."
else
  log_error "Database migration failed! Check alembic logs."
  exit 1
fi

# ─── 8. Prune Obsolete Releases ─────────────────────────────────────────────
log_step "8/8 Pruning old releases (retaining 3 latest)"

CURRENT_TARGET=$(readlink -f "${CURRENT_LINK}" || true)

# Find all releases, sort by modification time descending, skip the first 3
{ ls -dt "${RELEASES_DIR}"/*/ 2>/dev/null || true; } | tail -n +4 | while read -r old_release; do
  old_release=$(readlink -f "$old_release" 2>/dev/null) || continue
  # Never delete the active release
  if [ "$old_release" = "$CURRENT_TARGET" ]; then
    continue
  fi
  case "$old_release" in
    "${RELEASES_DIR}/"*)
      log_info "Pruning obsolete release: $(basename "$old_release")"
      rm -rf "$old_release"
      ;;
  esac
done

printf "\n${C_BOLD}${C_GREEN}======================================================${C_RESET}\n"
printf "${C_BOLD}${C_GREEN}  Deployment Successful: ${VERSION}${C_RESET}\n"
printf "${C_BOLD}${C_GREEN}======================================================${C_RESET}\n\n"
printf "Active Release: %s -> %s\n" "${CURRENT_LINK}" "$(readlink "${CURRENT_LINK}")"
printf "\nVerification Endpoints:\n"
printf "  API Docs : http://localhost:8000/docs\n"
printf "  API Root : http://localhost:8000/api/v1\n"
printf "  Frontend : http://localhost:8080/\n\n"
printf "To rollback if needed: sudo ./scripts/rollback.sh\n\n"
