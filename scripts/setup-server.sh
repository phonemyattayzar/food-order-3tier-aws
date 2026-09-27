#!/usr/bin/env bash
# One-time server git repository setup for Food Ordering Application.
#
# Creates /opt/src/food-order-3tier-aws/ with a bare clone, .git pointer,
# and a main-branch worktree. Safe to re-run — skips steps already done.
#
# The git tree is owned by the operator who has the GitHub SSH key
# (typically $SUDO_USER / ubuntu). The service user food-order-3tier owns
# only the runtime tree /opt/food-order-3tier-aws/.
#
# Usage: sudo bash scripts/setup-server.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=scripts/lib/git-src.sh
source "${SCRIPT_DIR}/lib/git-src.sh"

RUNTIME_DIR="/opt/food-order-3tier-aws"

if [ "$(id -u)" -ne 0 ]; then
  printf 'ERROR: run as root: sudo bash scripts/setup-server.sh\n' >&2
  exit 1
fi

command -v git >/dev/null || { printf 'ERROR: git is not installed\n' >&2; exit 1; }

# ─── [1/7] Create source directory ───────────────────────────────────────────

printf '[1/7] Creating %s...\n' "${SRC_DIR}"
mkdir -p "${SRC_DIR}"

# ─── [2/7] Bare clone ─────────────────────────────────────────────────────────

git_mark_src_safe
git_export_ssh || true

if [ -f "${BARE_DIR}/HEAD" ]; then
  printf '[2/7] Bare repo already exists — skipping clone.\n'
else
  printf '[2/7] Cloning bare repo from %s...\n' "${REPO_URL}"
  git clone --bare "${REPO_URL}" "${BARE_DIR}"
fi

# ─── [3/7] Fetch branches and tags into the bare repo ─────────────────────────

printf '[3/7] Configuring fetch refspec and fetching (including tags)...\n'
git_fetch_all

# ─── [4/7] Create .git pointer file ──────────────────────────────────────────

GIT_FILE="${SRC_DIR}/.git"
if [ -e "${GIT_FILE}" ]; then
  printf '[4/7] .git pointer already exists — skipping.\n'
else
  printf '[4/7] Creating .git pointer...\n'
  printf 'gitdir: ./.bare\n' > "${GIT_FILE}"
fi

# ─── [5/7] Add worktree for main branch ──────────────────────────────────────

WORKTREE_DIR="${SRC_DIR}/main"
if [ -d "${WORKTREE_DIR}" ]; then
  printf '[5/7] Worktree already exists — skipping.\n'
else
  printf '[5/7] Adding worktree for main...\n'
  git -C "${BARE_DIR}" worktree add "${WORKTREE_DIR}" main
fi

# ─── [6/7] Service user owns runtime, not the git tree ───────────────────────

printf '[6/7] Ensuring service user and runtime directory...\n'
if ! id food-order-3tier &>/dev/null; then
  useradd -r -m -s /bin/bash -d "${RUNTIME_DIR}" food-order-3tier || true
fi
mkdir -p "${RUNTIME_DIR}/releases" "${RUNTIME_DIR}/shared"
chown -R food-order-3tier:food-order-3tier "${RUNTIME_DIR}" || true

# ─── [7/7] Git tree owned by the operator with the GitHub key ────────────────

printf '[7/7] Setting git tree owner to %s...\n' "${GIT_OWNER}"
chown -R "${GIT_OWNER}:${GIT_OWNER}" "${SRC_DIR}"

printf '\nServer git setup complete.\n'
printf '  Bare repo     : %s\n' "${BARE_DIR}"
printf '  Worktree      : %s\n' "${WORKTREE_DIR}"
printf '  Git owner     : %s  (has GitHub SSH key; run fetch as this user)\n' "${GIT_OWNER}"
printf '  Runtime owner : food-order-3tier (%s)\n' "${RUNTIME_DIR}"
printf '\nAdd a tagged release worktree with:\n'
printf '  sudo bash scripts/add-release-worktree.sh v1.1.0\n'
