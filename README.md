# 🏗️ Hybrid Docker/Systemd Release Deployment Guide: Sar Mel

This branch implements a **versioned release directory layout with atomic symlink cutovers** for the **Sar Mel (Food Ordering System)**. It utilizes containerized services managed by Docker Compose and controlled via a host `systemd` service.

This approach ensures zero-downtime cutovers, fail-safe environment variable validation, and instant rollback capabilities. It is optimized for single-server production deployments and works perfectly in airgapped environments (with no external internet access).

---

## 📋 Table of Contents

1. [Architecture & Server Layout](#1-architecture--server-layout)
2. [Prerequisites](#2-prerequisites)
3. [Local Development](#3-local-development)
4. [Build Workflow (On Developer/Build Machine)](#4-build-workflow-on-developerbuild-machine)
5. [First-Time Server Provisioning](#5-first-time-server-provisioning)
6. [Git Worktree Setup (On Production Server)](#6-git-worktree-setup-on-production-server)
7. [Deployment Workflow (On Production Server)](#7-deployment-workflow-on-production-server)
8. [Rollback Strategy](#8-rollback-strategy)
9. [Day-to-Day Server Operations](#9-day-to-day-server-operations)

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

- **Build Machine**: Docker installed (to build images and compile resources).
- **Target Production Server**:
  - Ubuntu 24.04 LTS (or compatible Debian/Ubuntu system).
  - Docker CE installed and running.
  - `rsync` and `git` installed.
  - SSH key configured to pull from your git repository (for server setup).

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

## 4. Build Workflow (On Developer/Build Machine)

This phase creates a fully self-contained release package, including the compiled docker images, ready to be transferred to an airgapped or secure production environment.

### 1. Tag the Release
```bash
git tag -a v1.1.0 -m "Release v1.1.0"
git push origin v1.1.0
```

### 2. Build and Package
```bash
make release
```

This triggers the `scripts/build.sh` script, which:
1. Detects the version tag from Git.
2. Builds the `food-api:v1.1.0` and `food-ui:v1.1.0` images.
3. Saves these images as compressed tarballs under `docker-images/`.
4. Packages everything into a deployable archive: `food-order-3tier-v1.1.0.tar.gz`.

### 3. Transfer Archive to the Server
```bash
scp food-order-3tier-v1.1.0.tar.gz user@production-server:/tmp/
```

---

## 5. First-Time Server Provisioning

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

## 6. Git Worktree Setup (On Production Server)

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

### 6.1 Add a tagged release (recommended)

The tag must already exist on GitHub (see [section 4](#4-build-workflow-on-developerbuild-machine)). Then on the server:

```bash
sudo bash scripts/add-release-worktree.sh v1.1.0
```

The script:

1. Marks `/opt/src/food-order-3tier-aws` and `.bare` as `safe.directory` for root.
2. Uses the operator's (or root's) SSH key via `GIT_SSH_COMMAND`.
3. Fetches **branches and tags** into the bare repo (`refs/heads/*` and `refs/tags/*`).
4. Fails with `git tag -l` and `git ls-remote --tags origin` if `v1.1.0` still does not exist.
5. Adds `/opt/src/food-order-3tier-aws/v1.1.0`.
6. `chown`s the git tree back to `ubuntu` (not `food-order-3tier`).

Then:

```bash
ls -la /opt/src/food-order-3tier-aws
# .bare/  .git  main/  v1.1.0/
cd /opt/src/food-order-3tier-aws/v1.1.0
```

### 6.2 Existing servers (already chowned to `food-order-3tier`)

If an older `setup-server.sh` already ran `chown -R food-order-3tier` on the git tree, fix ownership once, then use the helper:

```bash
sudo chown -R ubuntu:ubuntu /opt/src/food-order-3tier-aws
sudo git config --system --add safe.directory /opt/src/food-order-3tier-aws
sudo git config --system --add safe.directory /opt/src/food-order-3tier-aws/.bare
sudo bash scripts/add-release-worktree.sh v1.1.0
```

Leave `/opt/food-order-3tier-aws/` owned by `food-order-3tier`.

### 6.3 Inspect worktrees and update `main`

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

### 6.4 If `invalid reference: v1.1.0` still happens

Fetch succeeded but the tag is not in this bare repo. Check local vs remote:

```bash
sudo git -C /opt/src/food-order-3tier-aws/.bare tag -l
sudo git -C /opt/src/food-order-3tier-aws/.bare ls-remote --tags origin
```

- Remote has `refs/tags/v1.1.0` but local does not → run `sudo bash scripts/add-release-worktree.sh v1.1.0` again (it fetches tags explicitly).
- Remote has a **different** name (`v1.1`, `v1.0.0`) → use that tag, or push `v1.1.0` from the build machine.
- Remote has nothing → tag was never pushed:

```bash
git tag -a v1.1.0 -m "Release v1.1.0"
git push origin v1.1.0
```

### 6.5 Build and compare env from the release worktree

```bash
cd /opt/src/food-order-3tier-aws/v1.1.0
make
make build
ls -al
diff .env.template /opt/food-order-3tier-aws/shared/.env
```

`shared/.env` is never overwritten by a deploy. If the template has new keys, edit `/opt/food-order-3tier-aws/shared/.env`, then continue with [section 7](#7-deployment-workflow-on-production-server).

`current` under `/opt/food-order-3tier-aws/` is the runtime symlink systemd uses as `WorkingDirectory`. Flipping it is the cutover (see [section 8](#8-rollback-strategy)).

### 6.6 Useful worktree commands

| Task | Command |
|------|---------|
| Add a tagged release | `sudo bash scripts/add-release-worktree.sh v1.1.0` |
| List worktrees | `git -C /opt/src/food-order-3tier-aws worktree list` |
| Update `main` | `git -C /opt/src/food-order-3tier-aws/main pull` |
| Remove an old worktree | `git -C /opt/src/food-order-3tier-aws worktree remove v1.0.0` |
| Prune stale worktree metadata | `git -C /opt/src/food-order-3tier-aws worktree prune` |

Do **not** delete a release directory with `rm -rf` while it is still a worktree. Use `git worktree remove` so git metadata stays consistent.

---

## 7. Deployment Workflow (On Production Server)

### 1. Extract the Archive
```bash
cd /tmp
tar -xzf food-order-3tier-v1.1.0.tar.gz
cd food-order-3tier-v1.1.0
```

### 2. Run the Initial Deploy (Fails intentionally to prompt env set)
```bash
sudo bash scripts/deploy.sh --load-images --version=v1.1.0
```
On the first execution, this script creates the shared credentials file `/opt/food-order-3tier-aws/shared/.env` and exits.

### 3. Configure the Production Credentials
```bash
sudo nano /opt/food-order-3tier-aws/shared/.env
```
Fill in the database username, password, and security keys:
```ini
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_secure_db_password
POSTGRES_DB=food_db
SECRET_KEY=your_64_character_hex_secret_key
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=11520
```

### 4. Resume Deployment
Re-run the deployment script:
```bash
sudo bash scripts/deploy.sh --load-images --version=v1.1.0
```

The script will:
1. Load the Docker image tarballs using `docker load`.
2. Compare the variables in `shared/.env` with `.env.template` to detect any missing keys.
3. Set up `/opt/food-order-3tier-aws/releases/v1.1.0/` and copy configurations.
4. Atomically point the `current` symlink to `/opt/food-order-3tier-aws/releases/v1.1.0`.
5. Install and enable the `food-order-3tier` systemd service.
6. Start/restart the containers.

### 5. Verify the Deployment
```bash
sudo systemctl status food-order-3tier

# Verify endpoints
curl -s http://localhost:8000/api/v1
curl -s http://localhost:8080/
```

---

## 8. Rollback Strategy

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

## 9. Day-to-Day Server Operations

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
