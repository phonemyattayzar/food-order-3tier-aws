# scripts/lib/git-src.sh — shared helpers for the server git worktree tree.
# Source from setup-server.sh / add-release-worktree.sh. Do not execute directly.

[ "${BASH_SOURCE[0]}" = "$0" ] && { printf 'git-src.sh must be sourced, not executed\n' >&2; exit 1; }

REPO_URL="${REPO_URL:-git@github.com:phonemyattayzar/food-order-3tier-aws.git}"
SRC_DIR="${SRC_DIR:-/opt/src/food-order-3tier-aws}"
BARE_DIR="${BARE_DIR:-${SRC_DIR}/.bare}"
# Who has (or should have) the GitHub SSH key: the operator who ran sudo.
GIT_OWNER="${SUDO_USER:-ubuntu}"

# git_ensure_safe_directory PATH
#   Adds PATH to the system gitconfig so root can operate on a repo owned by
#   another user (avoids "fatal: detected dubious ownership").
git_ensure_safe_directory() {
  local path="${1:-}"
  [ -n "$path" ] || return 1
  if git config --system --get-all safe.directory 2>/dev/null | grep -Fxq "$path"; then
    return 0
  fi
  git config --system --add safe.directory "$path"
}

git_mark_src_safe() {
  git_ensure_safe_directory "${SRC_DIR}"
  git_ensure_safe_directory "${BARE_DIR}"
}

# git_deploy_ssh_key
#   Prints the first deploy key found. Root used during clone; ubuntu owns the
#   lasting key. food-order-3tier does not have a GitHub key.
git_deploy_ssh_key() {
  local candidate
  for candidate in \
    /root/.ssh/id_ed25519 \
    /root/.ssh/id_rsa \
    "/home/${GIT_OWNER}/.ssh/id_ed25519" \
    "/home/${GIT_OWNER}/.ssh/id_rsa" \
    /home/ubuntu/.ssh/id_ed25519 \
    /home/ubuntu/.ssh/id_rsa
  do
    if [ -f "$candidate" ]; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done
  return 1
}

# git_export_ssh
#   Point Git's SSH at a deploy key so `sudo git fetch` works even when root
#   has no key of its own.
git_export_ssh() {
  local key
  key="$(git_deploy_ssh_key)" || return 1
  export GIT_SSH_COMMAND="ssh -i ${key} -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new"
  printf 'Using SSH key: %s\n' "$key"
}

# git_configure_bare_fetch
#   Map remote heads to refs/remotes/origin/* so fetch never conflicts with
#   locally checked-out worktrees (e.g. main). Tags map directly to refs/tags/*.
git_configure_bare_fetch() {
  git -C "${BARE_DIR}" config --unset-all remote.origin.fetch 2>/dev/null || true
  git -C "${BARE_DIR}" config --add remote.origin.fetch "+refs/heads/*:refs/remotes/origin/*"
  git -C "${BARE_DIR}" config --add remote.origin.fetch "+refs/tags/*:refs/tags/*"
}

git_fetch_all() {
  git_mark_src_safe
  git_export_ssh || printf 'WARNING: no GitHub SSH key found; fetch may fail\n' >&2
  git_configure_bare_fetch
  git -C "${BARE_DIR}" fetch origin --prune --tags
}
