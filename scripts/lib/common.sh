# scripts/lib/common.sh — shared helpers sourced by build.sh and deploy.sh.
# Do not execute this file directly; source it from a bash script.

[ "${BASH_SOURCE[0]}" = "$0" ] && { printf 'common.sh must be sourced, not executed\n' >&2; exit 1; }

# validate_version VERSION
#   Accepts semver tags (v1.2.3, v1.2.3-rc.1) or git short hashes (7-12 hex chars).
validate_version() {
  local version="${1:-}"
  if [[ -z "$version" ]]; then
    printf 'ERROR: version string is empty\n' >&2
    return 1
  fi
  if [[ "$version" =~ ^v[0-9]+\.[0-9]+\.[0-9]+[-+a-zA-Z0-9._-]*$ ]] \
      || [[ "$version" =~ ^[0-9a-f]{7,12}$ ]]; then
    return 0
  fi
  printf 'ERROR: invalid version format: %s\n' "$version" >&2
  printf '  Expected: semver tag (e.g. v1.2.3) or git short hash (7-12 hex chars)\n' >&2
  return 1
}

# check_required_env ENV_FILE
#   Verifies that every KEY=VALUE entry in ENV_FILE has a non-empty value.
#   Skips comment lines, blank lines, and the APP_VERSION key.
check_required_env() {
  local env_file="${1:-}"
  if [[ ! -f "$env_file" ]]; then
    printf 'ERROR: env file not found: %s\n' "$env_file" >&2
    return 1
  fi
  local failed=0 key value line
  while IFS= read -r line || [[ -n "$line" ]]; do
    case "$line" in
      ''|'#'*) continue ;;
    esac
    [[ "$line" != *=* ]] && continue
    key="${line%%=*}"
    value="${line#*=}"
    [[ "$key" = "APP_VERSION" ]] && continue
    if [[ -z "$value" ]]; then
      printf 'ERROR: %s has no value in %s\n' "$key" "$env_file" >&2
      failed=1
    fi
  done < "$env_file"
  return "$failed"
}

# env_get KEY ENV_FILE
#   Reads KEY from ENV_FILE and prints its raw value (empty string if not found).
env_get() {
  local key="${1:-}" env_file="${2:-}"
  if [[ ! -f "$env_file" ]]; then
    printf 'ERROR: env file not found: %s\n' "$env_file" >&2
    return 1
  fi
  local line
  while IFS= read -r line || [[ -n "$line" ]]; do
    if [[ "$line" == "${key}="* ]]; then
      printf '%s' "${line#"${key}="}"
      return 0
    fi
  done < "$env_file"
  return 0
}
