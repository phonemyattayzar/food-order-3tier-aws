#!/usr/bin/env bash
# scripts/lib/common.sh — Shared helpers for deployment and operations.
# Must be sourced from bash scripts.

[ "${BASH_SOURCE[0]}" = "$0" ] && { printf 'common.sh must be sourced, not executed\n' >&2; exit 1; }

# Colors
C_RESET='\033[0m'
C_RED='\033[0;31m'
C_GREEN='\033[0;32m'
C_YELLOW='\033[0;33m'
C_BLUE='\033[0;34m'
C_CYAN='\033[0;36m'
C_BOLD='\033[1m'

log_step() {
  printf "\n${C_BOLD}${C_BLUE}==>${C_RESET} ${C_BOLD}%s${C_RESET}\n" "$*"
}

log_info() {
  printf "  ${C_CYAN}[INFO]${C_RESET} %s\n" "$*"
}

log_success() {
  printf "  ${C_GREEN}[SUCCESS]${C_RESET} %s\n" "$*"
}

log_warn() {
  printf "  ${C_YELLOW}[WARNING]${C_RESET} %s\n" "$*" >&2
}

log_error() {
  printf "  ${C_RED}[ERROR]${C_RESET} %s\n" "$*" >&2
}

validate_version() {
  local version="${1:-}"
  if [[ -z "$version" ]]; then
    log_error "Version string is required."
    return 1
  fi
  # Allow semver tags like v1.0.0, v1.0.0-rc1, or git commit hashes (7-40 hex chars)
  if [[ "$version" =~ ^v[0-9]+\.[0-9]+\.[0-9]+[-+a-zA-Z0-9._-]*$ ]] || [[ "$version" =~ ^[0-9a-f]{7,40}$ ]]; then
    return 0
  fi
  log_error "Invalid version format: '$version'. Expected semver (e.g. v1.1.0) or git commit hash."
  return 1
}

atomic_symlink_switch() {
  local target="${1:-}"    # Relative or absolute target path (e.g., releases/v1.1.0)
  local link_path="${2:-}" # The symlink to create/replace (e.g., /opt/food-order-3tier-aws/current)

  if [ -z "$target" ] || [ -z "$link_path" ]; then
    log_error "atomic_symlink_switch requires TARGET and LINK_PATH"
    return 1
  fi

  local link_dir
  link_dir="$(dirname "$link_path")"
  local tmp_link="${link_dir}/.current_tmp_$$"

  # Create temporary symlink pointing to the target
  ln -sfn "$target" "$tmp_link"

  # Atomically rename temporary symlink over link_path using POSIX rename system call
  if mv -Tf "$tmp_link" "$link_path" 2>/dev/null; then
    return 0
  else
    # Fallback if -T flag is not supported (e.g. macOS / BSD)
    rm -f "$link_path" 2>/dev/null || true
    mv -f "$tmp_link" "$link_path"
  fi
}
