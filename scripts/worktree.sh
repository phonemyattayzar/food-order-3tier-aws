#!/usr/bin/env bash
# scripts/worktree.sh — Fetch tags and manage release worktrees.
#
# Usage:
#   sudo ./scripts/worktree.sh <tag>
#   sudo ./scripts/worktree.sh --list
#   sudo ./scripts/worktree.sh --remove <tag>

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
source "${SCRIPT_DIR}/scripts/lib/common.sh"

SRC_BASE="/opt/src/food-order-3tier-aws"
BARE_DIR="${SRC_BASE}/.bare"
OPERATOR_USER="${SUDO_USER:-ubuntu}"

if [ "$(id -u)" -ne 0 ]; then
  log_error "This script must be run as root: sudo ./scripts/worktree.sh <tag>"
  exit 1
fi

if [ ! -f "${BARE_DIR}/HEAD" ]; then
  log_error "Bare repository not found at ${BARE_DIR}."
  log_info "Run initial server setup first: sudo ./scripts/setup-server.sh"
  exit 1
fi

ACTION="add"
VERSION=""

for arg in "$@"; do
  case "$arg" in
    --list|-l)
      ACTION="list"
      ;;
    --remove=*)
      ACTION="remove"
      VERSION="${arg#--remove=}"
      ;;
    -h|--help)
      printf "Usage:\n"
      printf "  sudo ./scripts/worktree.sh <tag>          # Fetch tag & create worktree\n"
      printf "  sudo ./scripts/worktree.sh --list         # List existing worktrees\n"
      printf "  sudo ./scripts/worktree.sh --remove=<tag> # Remove a worktree\n"
      exit 0
      ;;
    *)
      if [ -z "$VERSION" ]; then
        VERSION="$arg"
      else
        log_error "Unexpected argument: $arg"
        exit 1
      fi
      ;;
  esac
done

if [ "$ACTION" = "list" ]; then
  log_step "Current Git worktrees in ${SRC_BASE}"
  git -C "${BARE_DIR}" worktree list
  exit 0
fi

if [ "$ACTION" = "remove" ]; then
  validate_version "$VERSION"
  TARGET_DIR="${SRC_BASE}/${VERSION}"
  if [ ! -d "$TARGET_DIR" ]; then
    log_warn "Worktree directory ${TARGET_DIR} does not exist."
    exit 0
  fi
  log_step "Removing worktree ${VERSION}"
  git -C "${BARE_DIR}" worktree remove "$TARGET_DIR" --force || rm -rf "$TARGET_DIR"
  git -C "${BARE_DIR}" worktree prune
  log_success "Removed worktree: ${TARGET_DIR}"
  exit 0
fi

if [ -z "$VERSION" ]; then
  log_error "Release tag is required."
  printf "Usage: sudo ./scripts/worktree.sh <tag>  (e.g. sudo ./scripts/worktree.sh v1.1.0)\n"
  exit 1
fi

validate_version "$VERSION"

log_step "1/3 Fetching latest branches and tags from origin"
git -C "${BARE_DIR}" fetch origin --prune --tags
log_success "Fetch completed."

log_step "2/3 Verifying tag '${VERSION}'"
if ! git -C "${BARE_DIR}" rev-parse --verify "refs/tags/${VERSION}" >/dev/null 2>&1; then
  log_error "Tag '${VERSION}' was not found in the remote repository."
  log_info "Available remote tags:"
  git -C "${BARE_DIR}" tag -l 'v*' | sed 's/^/    /' || true
  exit 1
fi
log_success "Tag '${VERSION}' found."

WORKTREE_DIR="${SRC_BASE}/${VERSION}"
log_step "3/3 Setting up worktree at ${WORKTREE_DIR}"
if [ -d "${WORKTREE_DIR}" ]; then
  log_info "Worktree directory already exists at ${WORKTREE_DIR}."
else
  git -C "${BARE_DIR}" worktree add "${WORKTREE_DIR}" "${VERSION}"
  log_success "Created worktree for ${VERSION}."
fi

chown -R "${OPERATOR_USER}:${OPERATOR_USER}" "${SRC_BASE}"
chmod 755 "${WORKTREE_DIR}"

printf "\n${C_BOLD}${C_GREEN}Worktree ready: %s${C_RESET}\n" "${WORKTREE_DIR}"
printf "To build and deploy:\n"
printf "  cd %s\n" "${WORKTREE_DIR}"
printf "  make build VERSION=%s\n" "${VERSION}"
printf "  sudo ./scripts/deploy.sh --version=%s\n\n" "${VERSION}"
