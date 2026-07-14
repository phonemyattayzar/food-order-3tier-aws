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
6. [Deployment Workflow (On Production Server)](#6-deployment-workflow-on-production-server)
7. [Rollback Strategy](#7-rollback-strategy)
8. [Day-to-Day Server Operations](#8-day-to-day-server-operations)

---

## 1. Architecture & Server Layout

### Host Directory Layout

All releases on the target server are organized under `/opt/food-order-3tier-aws/`:

```
/opt/food-order-3tier-aws/
  releases/
    v1.0.0/            ← Previous release (kept for rollback safety)
    v1.1.0/            ← Current active release directory
  current              → releases/v1.1.0   (symlink; systemd WorkingDirectory)
  shared/
    .env               ← Production secrets (never overwritten by deploys)
```

Each version folder in `releases/` contains only what is required to orchestrate the containers (Compose files, scripts, env configurations). The source code and runtime dependencies live inside the Docker images themselves.

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

Run this command once on a newly provisioned server to set up the repository directories:

```bash
sudo bash scripts/setup-server.sh
```

This creates `/opt/src/food-order-3tier-aws/` using a Git worktree model, preparing the repository on the server.

---

## 6. Deployment Workflow (On Production Server)

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

> ⚠️ **Caution**: Never run `docker compose down -v`. The `-v` flag will destroy the named Docker volume `postgres_data`, resulting in permanent database loss. Use `docker compose down` instead.
