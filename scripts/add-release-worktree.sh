#!/usr/bin/env bash
# Fetch a Git tag into the server bare repo and add a worktree for it.
#
# Usage:
#   sudo bash scripts/add-release-worktree.sh v1.1.0
#
# This avoids the two-user trap:
#   ubuntu            → has the GitHub SSH key, but used to lack write on .bare
#   food-order-3tier  → owns runtime files, has no GitHub SSH key
#
# Git operations run as root with the operator's (or root's) deploy key, then
# the worktree is chowned back to GIT_OWNER (typically ubuntu).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=scripts/lib/git-src.sh
source "${SCRIPT_DIR}/lib/git-src.sh"
# shellcheck source=scripts/lib/common.sh
source "${SCRIPT_DIR}/lib/common.sh"

VERSION="${1:-}"

if [ "$(id -u)" -ne 0 ]; then
  printf 'ERROR: run as root: sudo bash scripts/add-release-worktree.sh v1.1.0\n' >&2
  exit 1
fi

if [ -z "$VERSION" ]; then
  printf 'Usage: sudo bash scripts/add-release-worktree.sh <tag>\n' >&2
  exit 1
fi

validate_version "$VERSION" || exit 1

if [ ! -f "${BARE_DIR}/HEAD" ]; then
  printf 'ERROR: bare repo not found at %s\n' "${BARE_DIR}" >&2
  printf '  Run: sudo bash scripts/setup-server.sh\n' >&2
  exit 1
fi

WORKTREE_DIR="${SRC_DIR}/${VERSION}"

printf '[1/4] Fetching origin (branches + tags)...\n'
git_fetch_all

printf '[2/4] Checking that tag %s exists locally...\n' "${VERSION}"
if ! git -C "${BARE_DIR}" rev-parse --verify "refs/tags/${VERSION}" >/dev/null 2>&1; then
  printf 'ERROR: tag %s is not in the local bare repo after fetch.\n' "${VERSION}" >&2
  printf '\nLocal tags:\n' >&2
  git -C "${BARE_DIR}" tag -l 'v*' >&2 || true
  printf '\nRemote tags:\n' >&2
  git -C "${BARE_DIR}" ls-remote --tags origin >&2 || true
  printf '\nIf the tag is missing remotely, create and push it from the build machine:\n' >&2
  printf '  git tag -a %s -m "Release %s"\n' "${VERSION}" "${VERSION}" >&2
  printf '  git push origin %s\n' "${VERSION}" >&2
  exit 1
fi

printf '[3/4] Adding worktree %s...\n' "${WORKTREE_DIR}"
if [ -d "${WORKTREE_DIR}" ]; then
  printf 'Worktree already exists — skipping add.\n'
else
  git -C "${BARE_DIR}" worktree add "${WORKTREE_DIR}" "${VERSION}"
fi

printf '[4/4] Restoring git tree owner to %s...\n' "${GIT_OWNER}"
chown -R "${GIT_OWNER}:${GIT_OWNER}" "${SRC_DIR}"

printf '\nWorktree ready: %s\n' "${WORKTREE_DIR}"
printf 'Next:\n'
printf '  cd %s\n' "${WORKTREE_DIR}"
printf '  ls -la\n'
printf '  diff .env.template /opt/food-order-3tier-aws/shared/.env\n'
