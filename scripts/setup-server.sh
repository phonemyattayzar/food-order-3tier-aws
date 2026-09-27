#!/usr/bin/env bash
# scripts/setup-server.sh — Complete one-time server preparation script.
#
# Sets up packages, Docker, Git bare repo + main worktree, runtime directories,
# shared configuration, permissions, and systemd service.
#
# Usage:
#   sudo ./scripts/setup-server.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
source "${SCRIPT_DIR}/scripts/lib/common.sh"

if [ "$(id -u)" -ne 0 ]; then
  log_error "This script must be run as root: sudo ./scripts/setup-server.sh"
  exit 1
fi

OPERATOR_USER="${SUDO_USER:-ubuntu}"
SRC_BASE="/opt/src/food-order-3tier-aws"
RUNTIME_BASE="/opt/food-order-3tier-aws"
REPO_URL="${REPO_URL:-$(git -C "${SCRIPT_DIR}" config --get remote.origin.url 2>/dev/null || echo "https://github.com/phonemyattayzar/food-order-3tier-aws.git")}"

printf "${C_BOLD}======================================================${C_RESET}\n"
printf "${C_BOLD}  Food Ordering 3-Tier — Server Environment Setup     ${C_RESET}\n"
printf "${C_BOLD}======================================================${C_RESET}\n"

# ─── 1. Package Installation ────────────────────────────────────────────────
log_step "1/6 Installing system dependencies and Docker"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq

PKGS=(curl git make openssl ca-certificates)
for pkg in "${PKGS[@]}"; do
  if ! dpkg -s "$pkg" &>/dev/null; then
    log_info "Installing $pkg..."
    apt-get install -y -qq "$pkg"
  fi
done

if ! command -v docker &>/dev/null; then
  log_info "Installing Docker Engine..."
  curl -fsSL https://get.docker.com | sh
fi

if ! docker compose version &>/dev/null; then
  log_info "Installing Docker Compose plugin..."
  apt-get install -y -qq docker-compose-plugin || true
fi

systemctl enable --now docker
usermod -aG docker "${OPERATOR_USER}" || true
log_success "System packages and Docker are ready."

# ─── 2. Git System Configuration ───────────────────────────────────────────
log_step "2/6 Configuring Git safe directories"
git config --system --add safe.directory "*" 2>/dev/null || true
log_success "Git configured."

# ─── 3. Source Tree & Git Worktree Setup ─────────────────────────────────────
log_step "3/6 Setting up Git bare repository & main worktree"
mkdir -p "${SRC_BASE}"

BARE_DIR="${SRC_BASE}/.bare"
if [ ! -f "${BARE_DIR}/HEAD" ]; then
  log_info "Cloning bare repository from ${REPO_URL}..."
  # If running from inside a local clone, use it as a reference or clone directly
  git clone --bare "${REPO_URL}" "${BARE_DIR}"
  git -C "${BARE_DIR}" config --unset-all remote.origin.fetch 2>/dev/null || true
  git -C "${BARE_DIR}" config --add remote.origin.fetch "+refs/heads/*:refs/remotes/origin/*"
  git -C "${BARE_DIR}" config --add remote.origin.fetch "+refs/tags/*:refs/tags/*"
  git -C "${BARE_DIR}" fetch origin --prune --tags
else
  log_info "Bare repository already exists at ${BARE_DIR}."
fi

# Pointer file so standard git commands work in /opt/src/food-order-3tier-aws
printf 'gitdir: ./.bare\n' > "${SRC_BASE}/.git"

MAIN_WORKTREE="${SRC_BASE}/main"
if [ ! -d "${MAIN_WORKTREE}" ]; then
  log_info "Creating worktree for main branch at ${MAIN_WORKTREE}..."
  git -C "${BARE_DIR}" worktree add "${MAIN_WORKTREE}" main 2>/dev/null || \
  git -C "${BARE_DIR}" worktree add "${MAIN_WORKTREE}" origin/main 2>/dev/null || \
  git -C "${BARE_DIR}" worktree add -b main "${MAIN_WORKTREE}" HEAD
else
  log_info "Main worktree already exists at ${MAIN_WORKTREE}."
fi

chown -R "${OPERATOR_USER}:${OPERATOR_USER}" "${SRC_BASE}"
chmod 755 "${SRC_BASE}"
log_success "Source tree configured at ${SRC_BASE}."

# ─── 4. Runtime Directories ─────────────────────────────────────────────────
log_step "4/6 Setting up runtime release directories"
mkdir -p "${RUNTIME_BASE}/releases"
mkdir -p "${RUNTIME_BASE}/shared"
chmod 755 "${RUNTIME_BASE}" "${RUNTIME_BASE}/releases" "${RUNTIME_BASE}/shared"
chown -R "${OPERATOR_USER}:docker" "${RUNTIME_BASE}"
log_success "Runtime directory configured at ${RUNTIME_BASE}."

# ─── 5. Production Shared Configuration ─────────────────────────────────────
log_step "5/6 Initializing production shared environment"
SHARED_ENV="${RUNTIME_BASE}/shared/.env"
if [ ! -f "${SHARED_ENV}" ]; then
  log_info "Creating initial ${SHARED_ENV} from template..."
  if [ -f "${SCRIPT_DIR}/.env.example" ]; then
    cp "${SCRIPT_DIR}/.env.example" "${SHARED_ENV}"
  else
    cat << 'ENVEOF' > "${SHARED_ENV}"
POSTGRES_USER=postgres
POSTGRES_PASSWORD=password123
POSTGRES_DB=food_db
SECRET_KEY=change_this_to_a_secure_random_key_in_production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=11520
ENVEOF
  fi

  # Generate random production secret key
  RAND_SECRET=$(openssl rand -hex 32)
  sed -i "s/change_this_to_a_secure_random_key_in_production/${RAND_SECRET}/" "${SHARED_ENV}"
  chmod 600 "${SHARED_ENV}"
  chown "${OPERATOR_USER}:docker" "${SHARED_ENV}"
  log_success "Created ${SHARED_ENV} with generated SECRET_KEY."
else
  log_info "${SHARED_ENV} already exists — keeping existing credentials."
fi

# ─── 6. Systemd Service ─────────────────────────────────────────────────────
log_step "6/6 Installing systemd service"
tee /etc/systemd/system/food-order-3tier.service > /dev/null << 'SVCEOF'
[Unit]
Description=Food Ordering Application (3-Tier)
Requires=docker.service
After=docker.service network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/food-order-3tier-aws/current
ExecStart=/usr/bin/docker compose up -d
ExecStop=/usr/bin/docker compose down
ExecReload=/usr/bin/docker compose restart
TimeoutStartSec=120

[Install]
WantedBy=multi-user.target
SVCEOF

systemctl daemon-reload
systemctl enable food-order-3tier.service
log_success "Systemd service 'food-order-3tier' enabled."

printf "\n${C_BOLD}${C_GREEN}Server setup completed successfully!${C_RESET}\n"
printf "Next steps:\n"
printf "  1. Review credentials in: ${C_CYAN}%s${C_RESET}\n" "${SHARED_ENV}"
printf "  2. Create a release worktree: ${C_CYAN}sudo ./scripts/worktree.sh <tag>${C_RESET}\n"
printf "  3. Build images: ${C_CYAN}make build VERSION=<tag>${C_RESET}\n"
printf "  4. Deploy release: ${C_CYAN}sudo ./scripts/deploy.sh --version=<tag>${C_RESET}\n\n"
