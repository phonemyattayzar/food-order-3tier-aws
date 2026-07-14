#!/usr/bin/env bash
# One-time server git repository setup for Food Ordering Application.
#
# Creates /opt/src/food-order-3tier-aws/ with a bare clone, .git pointer,
# and a main-branch worktree. Safe to re-run — skips steps already done.
#
# Usage: sudo bash scripts/setup-server.sh

set -euo pipefail

REPO_URL="git@github.com:phonemyattayzar/food-order-3tier-aws.git"
SRC_DIR="/opt/src/food-order-3tier-aws"
BARE_DIR="${SRC_DIR}/.bare"

if [ "$(id -u)" -ne 0 ]; then
  printf 'ERROR: run as root: sudo bash scripts/setup-server.sh\n' >&2
  exit 1
fi

command -v git >/dev/null || { printf 'ERROR: git is not installed\n' >&2; exit 1; }

# ─── [1/5] Create source directory ───────────────────────────────────────────

printf '[1/5] Creating %s...\n' "${SRC_DIR}"
mkdir -p "${SRC_DIR}"

# ─── [2/5] Bare clone ─────────────────────────────────────────────────────────

if [ -f "${BARE_DIR}/HEAD" ]; then
  printf '[2/5] Bare repo already exists — skipping clone.\n'
else
  printf '[2/5] Cloning bare repo from %s...\n' "${REPO_URL}"
  git clone --bare "${REPO_URL}" "${BARE_DIR}"
fi

# ─── [3/5] Fix remote fetch refspec and fetch ─────────────────────────────────

printf '[3/5] Configuring fetch refspec and fetching...\n'
git -C "${BARE_DIR}" config remote.origin.fetch "+refs/heads/*:refs/remotes/origin/*"
git -C "${BARE_DIR}" fetch

# ─── [4/5] Create .git pointer file ──────────────────────────────────────────

GIT_FILE="${SRC_DIR}/.git"
if [ -e "${GIT_FILE}" ]; then
  printf '[4/5] .git pointer already exists — skipping.\n'
else
  printf '[4/5] Creating .git pointer...\n'
  printf 'gitdir: ./.bare\n' > "${GIT_FILE}"
fi

# ─── [5/5] Add worktree for main branch ──────────────────────────────────────

WORKTREE_DIR="${SRC_DIR}/main"
if [ -d "${WORKTREE_DIR}" ]; then
  printf '[5/5] Worktree already exists — skipping.\n'
else
  printf '[5/5] Adding worktree for main...\n'
  git -C "${BARE_DIR}" worktree add "${WORKTREE_DIR}" main
fi

# Ensure service user exists
if ! id food-order-3tier &>/dev/null; then
  useradd -r -m -s /bin/bash -d /opt/food-order-3tier-aws food-order-3tier || true
fi

chown -R food-order-3tier:food-order-3tier "${SRC_DIR}" || true

printf '\nServer git setup complete.\n'
printf '  Bare repo : %s\n' "${BARE_DIR}"
printf '  Worktree  : %s\n' "${WORKTREE_DIR}"
