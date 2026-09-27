# 🏗️ Hybrid Docker/Systemd Release Deployment Guide: Sar Mel

This branch implements a **versioned release directory layout with atomic symlink cutovers** for the **Sar Mel (Food Ordering System)**. It utilizes containerized services managed by Docker Compose and controlled via a host `systemd` service.

This approach ensures zero-downtime cutovers, fail-safe environment variable validation, and instant rollback capabilities. All builds and deployments are performed directly on the production server.

---

## 📋 Table of Contents

1. [Architecture & Server Layout](#1-architecture--server-layout)
2. [Prerequisites](#2-prerequisites)
3. [Local Development](#3-local-development)
4. [First-Time Server Provisioning](#4-first-time-server-provisioning)
5. [Git Worktree Setup (On Production Server)](#5-git-worktree-setup-on-production-server)
6. [Build & Deployment Workflow (On Production Server)](#6-build--deployment-workflow-on-production-server)
7. [Rollback Strategy](#7-rollback-strategy)
8. [Day-to-Day Server Operations](#8-day-to-day-server-operations)
9. [Troubleshooting & Common Deployment Errors](#9-troubleshooting--common-deployment-errors)

---

## 1. Architecture & Server Layout

### Host Directory Layout

Two directories work together: a **git worktree tree** (source) and a **runtime tree** (Compose + symlink cutover).

**Git worktree (source) — `/opt/src/food-order-3tier-aws/`**

```
/opt/src/food-order-3tier-aws/
  .bare/                 ← bare clone (shared git objects for all worktrees)
  .git                   → gitdir: ./.bare
  main/                  ← worktree tracking the main branch
```

**Runtime (release cutover) — `/opt/food-order-3tier-aws/`**

```
/opt/food-order-3tier-aws/
  releases/
    v1.0.0/              ← Previous release (kept for rollback)
    v1.1.0/              ← Current active release directory
  current                → /opt/food-order-3tier-aws/releases/v1.1.0
  shared/
    .env                 ← Production secrets (never overwritten by deploys)
```

Each version folder in `releases/` contains what is required to orchestrate the containers (Compose files, scripts, env). The application code and runtime dependencies live inside the Docker images.

This is the same pattern as a typical production layout (`current` symlink + `releases/<version>` + `shared/.env`). Git worktrees live under `/opt/src/food-order-3tier-aws/` (`main`, `v1.1.0`, …). `deploy.sh` copies Compose files into `/opt/food-order-3tier-aws/releases/<version>/` and flips `current`.

### Compose Configuration Roles

We divide the Docker Compose configuration into three roles:

| File | When Used | Purpose |
|------|-----------|---------|
| `docker-compose.yml` | Always (Base) | Base service configurations, ports, healthchecks, networks, and persistent volume definitions. |
| `docker-compose.override.yml` | Dev Only | Local development volume mounts (hot-reload for backend/frontend) and dev builds (`Dockerfile.dev`). |
| `docker-compose.prod.yml` | Production | Pins specific versioned image tags (`food-api:<version>`, `food-ui:<version>`). |

---

## 2. Prerequisites

- **Target Production Server**:
  - Ubuntu 24.04 LTS (or compatible Debian/Ubuntu system).
  - Docker CE and Docker Compose plugin installed and running.
  - `rsync` and `git` installed.
  - SSH key configured to access the GitHub repository (to clone and fetch release tags).

---

## 3. Local Development

To run the complete 3-tier stack locally with hot-reloading enabled for both the FastAPI backend and React frontend:

```bash
make dev
```

This merges `docker-compose.yml` and `docker-compose.override.yml` automatically. 
- **Frontend URL**: `http://localhost:5173`
- **Backend API Docs**: `http://localhost:8000/api/v1/docs`
- **Database**: PostgreSQL exposed on `localhost:5432`

---

## 4. First-Time Server Provisioning

Run this once on a newly provisioned server. It creates the bare clone and the `main` worktree:

```bash
sudo bash scripts/setup-server.sh
```

This creates `/opt/src/food-order-3tier-aws/` using a git worktree model:

| Path | Role |
|------|------|
| `/opt/src/food-order-3tier-aws/.bare` | Bare clone of the GitHub repo |
| `/opt/src/food-order-3tier-aws/.git` | Pointer file: `gitdir: ./.bare` |
| `/opt/src/food-order-3tier-aws/main` | Worktree for the `main` branch |

Ownership is split on purpose:

| Path | Owner | Why |
|------|------|-----|
| `/opt/src/food-order-3tier-aws/` | `$SUDO_USER` (usually `ubuntu`) | This user has the GitHub SSH key and must be able to `git fetch` and add worktrees |
| `/opt/food-order-3tier-aws/` | `food-order-3tier` | Runtime tree (`releases/`, `shared/.env`, `current`) |

The script also writes **system** `safe.directory` entries so `sudo git` does not fail with `detected dubious ownership`. After it finishes you should see:

```
Server git setup complete.
  Bare repo     : /opt/src/food-order-3tier-aws/.bare
  Worktree      : /opt/src/food-order-3tier-aws/main
  Git owner     : ubuntu  (has GitHub SSH key; run fetch as this user)
  Runtime owner : food-order-3tier (/opt/food-order-3tier-aws)
```

---

## 5. Git Worktree Setup (On Production Server)

Use git worktrees so each tagged release is a separate checkout. You never clone the repo again; you fetch tags, then add a worktree for that version.

### Why `ubuntu` and `food-order-3tier` cannot each do the whole job

| User | GitHub SSH key | Can write `.bare` | Result |
|------|----------------|-------------------|--------|
| `ubuntu` | Yes | Only if it owns `/opt/src/...` | Fetch works; worktree add works |
| `food-order-3tier` | No | Yes (on older setups) | `Permission denied (publickey)` on fetch, so the tag never arrives |
| `root` via `sudo git` | Only if `/root/.ssh/id_ed25519` exists | Yes | Also needs **system** `safe.directory` (root's gitconfig, not ubuntu's) |

Do **not** run:

```bash
sudo -u food-order-3tier git fetch --tags
sudo -u food-order-3tier git worktree add v1.1.0 v1.1.0
```

That user has no GitHub key, so the tag is never fetched and worktree add fails with `fatal: invalid reference: v1.1.0`.

`git config --global --add safe.directory ...` as `ubuntu` does **not** fix `sudo git`, because sudo uses `/root/.gitconfig`. The scripts write **system** config instead (`/etc/gitconfig`).

### 5.1 Add a tagged release (recommended)

Ensure the tag is pushed to GitHub:
```bash
git tag -a v1.1.0 -m "Release v1.1.0"
git push origin v1.1.0
```

Then on the server:

```bash
sudo bash scripts/add-release-worktree.sh v1.1.0
```

The script:

1. Marks `/opt/src/food-order-3tier-aws` and `.bare` as `safe.directory` for root.
2. Uses the operator's (or root's) SSH key via `GIT_SSH_COMMAND`.
3. Fetches **branches and tags** into the bare repo (`refs/remotes/origin/*` and `refs/tags/*`).
4. Fails with `git tag -l` and `git ls-remote --tags origin` if `v1.1.0` still does not exist.
5. Adds `/opt/src/food-order-3tier-aws/v1.1.0`.
6. `chown`s the git tree back to `ubuntu` (not `food-order-3tier`).

Then:

```bash
ls -la /opt/src/food-order-3tier-aws
# .bare/  .git  main/  v1.1.0/
cd /opt/src/food-order-3tier-aws/v1.1.0
```

### 5.2 Existing servers (already chowned to `food-order-3tier`)

If an older `setup-server.sh` already ran `chown -R food-order-3tier` on the git tree, fix ownership once, then use the helper:

```bash
sudo chown -R ubuntu:ubuntu /opt/src/food-order-3tier-aws
sudo git config --system --add safe.directory /opt/src/food-order-3tier-aws
sudo git config --system --add safe.directory /opt/src/food-order-3tier-aws/.bare
sudo bash scripts/add-release-worktree.sh v1.1.0
```

Leave `/opt/food-order-3tier-aws/` owned by `food-order-3tier`.

### 5.3 Inspect worktrees and update `main`

Work from the git root:

```bash
cd /opt/src/food-order-3tier-aws
git worktree list
git -C main status
git -C main pull
git log --oneline -n 10
```

Expected first-time `git worktree list`:

```
/opt/src/food-order-3tier-aws/.bare  (bare)
/opt/src/food-order-3tier-aws/main   <commit>  [main]
```

After adding `v1.1.0`:

```
/opt/src/food-order-3tier-aws/.bare     (bare)
/opt/src/food-order-3tier-aws/main      <commit>  [main]
/opt/src/food-order-3tier-aws/v1.1.0    <commit>  (detached at v1.1.0)
```

### 5.4 If `invalid reference: v1.1.0` still happens

Fetch succeeded but the tag is not in this bare repo. Check local vs remote:

```bash
sudo git -C /opt/src/food-order-3tier-aws/.bare tag -l
sudo git -C /opt/src/food-order-3tier-aws/.bare ls-remote --tags origin
```

- Remote has `refs/tags/v1.1.0` but local does not → run `sudo bash scripts/add-release-worktree.sh v1.1.0` again (it fetches tags explicitly).
- Remote has a **different** name (`v1.1`, `v1.0.0`) → use that tag, or push `v1.1.0` from your repository.
- Remote has nothing → tag was never pushed:

```bash
git tag -a v1.1.0 -m "Release v1.1.0"
git push origin v1.1.0
```

### 5.5 Useful worktree commands

| Task | Command |
|------|---------|
| Add a tagged release | `sudo bash scripts/add-release-worktree.sh v1.1.0` |
| List worktrees | `git -C /opt/src/food-order-3tier-aws worktree list` |
| Update `main` | `git -C /opt/src/food-order-3tier-aws/main pull` |
| Remove an old worktree | `git -C /opt/src/food-order-3tier-aws worktree remove v1.0.0` |
| Prune stale worktree metadata | `git -C /opt/src/food-order-3tier-aws worktree prune` |

Do **not** delete a release directory with `rm -rf` while it is still a worktree. Use `git worktree remove` so git metadata stays consistent.

---

## 6. Build & Deployment Workflow (On Production Server)

All container builds and release deployments run directly on the production server.

Follow these step-by-step instructions directly on your production server:

#### Step 1: Connect to the Production Server
Log in to your Ubuntu production server:
```bash
ssh ubuntu@<production-server-ip>
```

#### Step 2: Fetch and Create the Release Worktree
Ensure your desired tag (e.g. `v1.1.0`) is pushed to GitHub. Then fetch the tag and create the worktree:
```bash
sudo bash /opt/src/food-order-3tier-aws/main/scripts/add-release-worktree.sh v1.1.0
```
Navigate into the newly created release worktree:
```bash
cd /opt/src/food-order-3tier-aws/v1.1.0
ls -la
```
*You should see `docker-compose.yml`, `docker-compose.prod.yml`, `.env.template`, `Makefile`, and `scripts/`.*

#### Step 3: Build Docker Images Directly on the Server
Build the versioned Docker images (`food-api:v1.1.0` and `food-ui:v1.1.0`) directly on the server:
```bash
make build
```
*(This triggers `scripts/build.sh`, auto-detects version `v1.1.0` from Git, and builds `food-api:v1.1.0` and `food-ui:v1.1.0` into the server's Docker engine).*

Verify the built images in Docker:
```bash
docker images | grep -E "food-api|food-ui"
```

#### Step 4: Configure Production Secrets (`shared/.env`)
All production secrets are stored persistently in `/opt/food-order-3tier-aws/shared/.env`. This file is **never overwritten** by future deployments.

1. Create the shared directory if it does not exist:
   ```bash
   sudo mkdir -p /opt/food-order-3tier-aws/shared
   ```

2. If `/opt/food-order-3tier-aws/shared/.env` does not exist, copy the template:
   ```bash
   sudo cp .env.template /opt/food-order-3tier-aws/shared/.env
   sudo chmod 600 /opt/food-order-3tier-aws/shared/.env
   ```

3. Edit the file with your production credentials:
   ```bash
   sudo nano /opt/food-order-3tier-aws/shared/.env
   ```
   **Required Variables:**
   ```ini
   POSTGRES_USER=postgres
   POSTGRES_PASSWORD=your_secure_db_password
   POSTGRES_DB=food_db
   SECRET_KEY=your_64_character_hex_secret_key
   ALGORITHM=HS256
   ACCESS_TOKEN_EXPIRE_MINUTES=11520
   ```
   > [!TIP]
   > Generate a secure `SECRET_KEY` using:
   > ```bash
   > openssl rand -hex 32
   > ```

4. **Verify your environment variables**:
   Run this command to verify that all 6 required keys are defined without exposing secret values:
   ```bash
   sudo awk -F= '/^[A-Z_][A-Z0-9_]*=/{print $1}' /opt/food-order-3tier-aws/shared/.env | sort
   ```
   Output must contain:
   ```
   ACCESS_TOKEN_EXPIRE_MINUTES
   ALGORITHM
   POSTGRES_DB
   POSTGRES_PASSWORD
   POSTGRES_USER
   SECRET_KEY
   ```

#### Step 5: Execute the Deployment Script
Run the automated deployment script from your release worktree:
```bash
sudo bash scripts/deploy.sh --version=v1.1.0
```

The deployment script executes seven automated stages:
| Stage | Description |
|-------|-------------|
| `[1/7] Loading Docker images` | Skipped because images were already built directly on the server. |
| `[2/7] Service user` | Ensures the dedicated service user `food-order-3tier` exists and has `docker` group membership. |
| `[3/7] Release directory` | Creates `/opt/food-order-3tier-aws/releases/v1.1.0/` and syncs Compose files, `.env.template`, and scripts. |
| `[4/7] Shared directory + .env` | Combines persistent secrets from `shared/.env` with `APP_VERSION=v1.1.0` into `releases/v1.1.0/.env`. |
| `[5/7] env-check` | Compares `.env.template` against `shared/.env` to guarantee no required secrets are missing, and verifies all values are non-empty. |
| `[6/7] Ownership + atomic cutover` | Updates file ownership to `food-order-3tier:food-order-3tier`, flips `/opt/food-order-3tier-aws/current -> releases/v1.1.0`, and creates/reloads the systemd service. |
| `[7/7] Start & Prune` | Starts (or restarts) `food-order-3tier.service`, confirms container health, and prunes older releases (keeps the 3 latest). |

#### Step 6: Apply Database Migrations
On the initial deployment or whenever new database migrations are introduced, run Alembic migrations inside the backend container:
```bash
cd /opt/food-order-3tier-aws/current
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec web alembic upgrade head
```

#### Step 7: Verify the Deployment
Verify the service, containers, and HTTP endpoints:
```bash
# 1. Check systemd unit status
sudo systemctl status food-order-3tier

# 2. Check running Docker containers and health checks
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps

# 3. Test Backend API health endpoint
curl -s http://localhost:8000/api/v1
# Expected output: {"message":"Mingalaba! Food API is running"}

# 4. Test Frontend HTTP endpoint
curl -I http://localhost:8080/
# Expected output: HTTP/1.1 200 OK
```

---

## 7. Rollback Strategy

If an issue is detected in the new release, you can roll back to the previous version within seconds:

### 1. Check Available Releases
```bash
sudo bash scripts/deploy.sh --rollback
```

### 2. Perform Rollback
Re-point the symlink and restart systemd:
```bash
sudo ln -sfn /opt/food-order-3tier-aws/releases/v1.0.0 /opt/food-order-3tier-aws/current
sudo systemctl restart food-order-3tier
```
Because the older Docker images are already loaded in the Docker engine, the rollback takes place immediately with no download time.

---

## 8. Day-to-Day Server Operations

Always run docker compose commands from the `current` symlink directory, as it contains the correct version contexts:

```bash
cd /opt/food-order-3tier-aws/current
```

| Task | Command |
|------|---------|
| Start service | `sudo systemctl start food-order-3tier` |
| Stop service | `sudo systemctl stop food-order-3tier` |
| Restart all services | `sudo systemctl restart food-order-3tier` |
| View service logs | `journalctl -u food-order-3tier -f` |
| View API logs | `docker logs -f food_api --tail 100` |
| View Frontend logs | `docker logs -f food_ui --tail 100` |
| List running containers | `docker compose -f docker-compose.yml -f docker-compose.prod.yml ps` |
| List release history | `ls -lt /opt/food-order-3tier-aws/releases/` |
| List git worktrees | `git -C /opt/src/food-order-3tier-aws worktree list` |

> ⚠️ **Caution**: Never run `docker compose down -v`. The `-v` flag will destroy the named Docker volume `postgres_data`, resulting in permanent database loss. Use `docker compose down` instead.

---

## 9. Troubleshooting & Common Deployment Errors

### 1. `rsync: link_stat ".../.env.template" failed: No such file or directory`
- **Cause**: Step `[3/7]` requires `.env.template` to copy into the release directory and validate production variables. If this file was missing from older Git commits (historically masked by a `.gitignore` rule ignoring `.env.*`), the deployment stops here.
- **Fix**: Ensure `!.env.template` is whitelisted in `.gitignore` and committed. On an existing server worktree, you can immediately create it with placeholder keys:
  ```bash
  cat << 'EOF' > .env.template
  POSTGRES_USER=postgres
  POSTGRES_PASSWORD=your_secure_db_password
  POSTGRES_DB=food_db
  SECRET_KEY=your_64_character_hex_secret_key
  ALGORITHM=HS256
  ACCESS_TOKEN_EXPIRE_MINUTES=11520
  EOF
  ```

### 2. `ERROR: variables required by <version> but missing from shared/.env`
- **Cause**: Step `[5/7]` compares the variable keys found in `.env.template` against `/opt/food-order-3tier-aws/shared/.env`. One or more required keys are missing or blank.
- **Fix**: Inspect the missing keys with:
  ```bash
  comm -23 \
    <(grep -E '^[A-Z_][A-Z0-9_]*=' .env.template | cut -d= -f1 | sort) \
    <(sudo grep -E '^[A-Z_][A-Z0-9_]*=' /opt/food-order-3tier-aws/shared/.env | cut -d= -f1 | sort)
  ```
  Edit `/opt/food-order-3tier-aws/shared/.env` and add the missing keys with valid production values, then re-run `deploy.sh`.

### 3. `fatal: detected dubious ownership in repository`
- **Cause**: The repository is owned by user `ubuntu`, but `git` commands are being executed under `sudo` (as `root`).
- **Fix**: Register system-wide safe directory exceptions in `/etc/gitconfig`:
  ```bash
  sudo git config --system --add safe.directory /opt/src/food-order-3tier-aws
  sudo git config --system --add safe.directory /opt/src/food-order-3tier-aws/.bare
  ```

### 4. `Permission denied (publickey)` when fetching Git tags
- **Cause**: The service user `food-order-3tier` or `root` does not possess your GitHub SSH key.
- **Fix**: Use `scripts/add-release-worktree.sh`, which automatically passes the operator's SSH key via `GIT_SSH_COMMAND`. Never run `sudo -u food-order-3tier git fetch`.

### 5. Backend Container Fails Health Check (`unhealthy`)
- **Cause**: Database is still starting, credentials in `shared/.env` don't match PostgreSQL, or migrations have not been applied.
- **Fix**: Inspect the application logs and container status:
  ```bash
  docker logs food_api --tail 100
  docker logs food_db --tail 100
  cd /opt/food-order-3tier-aws/current
  docker compose -f docker-compose.yml -f docker-compose.prod.yml exec web alembic upgrade head
  ```

