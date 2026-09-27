# 🍽️ Food Ordering Application (3-Tier): Production-Style Atomic Deployment

A production-style deployment architecture for a 3-tier application (PostgreSQL + FastAPI + React/Nginx) demonstrating **Git worktrees, on-server image builds via Makefile, immutable versioned releases, shared environment isolation, atomic symlink switching, and instant zero-rebuild rollback**.

---

## 🏗️ Architecture & Deployment Flow

```text
Developer / Workstation
        │
        │ git tag -a v1.1.0 -m "Release v1.1.0" && git push origin v1.1.0
        ▼
Production EC2 Server
        │
        ├── [1] Git Worktree (/opt/src/food-order-3tier-aws/v1.1.0)
        │       Fetch tag and check out exact release source
        │
        ├── [2] Makefile Build (make build VERSION=v1.1.0)
        │       Builds food-api:v1.1.0 and food-ui:v1.1.0 directly into local Docker engine
        │
        ├── [3] Create Release Directory (/opt/food-order-3tier-aws/releases/v1.1.0)
        │       Stages compose file + release .env (shared secrets + VERSION)
        │
        ├── [4] Launch & Health Check (docker compose up -d)
        │       Starts PostgreSQL, FastAPI backend, and Nginx frontend
        │       Validates /api/v1 (FastAPI) and / (Nginx) health endpoints
        │
        ├── [5] Atomic Symlink Cutover (releases/v1.1.0 -> current)
        │       Switches symlink atomically via POSIX rename (mv -Tf) ONLY after health passes
        │
        ├── [6] Post-Cutover Database Migration
        │       Executes Alembic migrations inside the active container
        │
        └── [7] Instant Rollback (sudo ./scripts/rollback.sh)
                Flips symlink back to previous release without rebuilding Docker images
```

---

## 📂 Server Directory Layout

The deployment separates the **source code tree** from the **runtime release tree**:

```text
/opt/
├── src/food-order-3tier-aws/               # Source Tree (Git bare repository + worktrees)
│   ├── .bare/                              # Shared Git object store (bare clone)
│   ├── .git                                # Pointer file (gitdir: ./.bare)
│   ├── main/                               # Worktree tracking main branch
│   ├── v1.0.0/                             # Worktree tracking tag v1.0.0
│   └── v1.1.0/                             # Worktree tracking tag v1.1.0
│
└── food-order-3tier-aws/                   # Runtime Tree (Versioned releases & current symlink)
    ├── .deploy.lock                        # Lockfile preventing concurrent deployments
    ├── shared/
    │   └── .env                            # Persistent production credentials (chmod 600)
    ├── releases/
    │   ├── v1.0.0/                         # Immutable previous release (kept for rollback)
    │   │   ├── docker-compose.yml
    │   │   ├── .env                        # Merged shared config + VERSION=v1.0.0
    │   │   └── .release-meta
    │   └── v1.1.0/                         # Immutable current release
    │       ├── docker-compose.yml
    │       ├── .env                        # Merged shared config + VERSION=v1.1.0
    │       └── .release-meta
    │
    └── current -> releases/v1.1.0          # Atomic symlink pointing to active release
```

---

## 🚀 Step-by-Step Operations Guide

### 1. Initial Server Setup (One-Time)

Log into your EC2 instance and run the server setup script:

```bash
# Clone the repository to the operator's workspace or run setup directly
sudo ./scripts/setup-server.sh
```

**What this script does:**
1. Installs required system packages: `curl`, `git`, `make`, `openssl`, `ca-certificates`.
2. Installs Docker Engine and the Docker Compose plugin; enables and starts the `docker` service.
3. Adds the `ubuntu` operator to the `docker` group (allowing non-root docker access).
4. Initializes the Git source tree at `/opt/src/food-order-3tier-aws` with a bare clone and a `main` branch worktree.
5. Initializes the runtime tree at `/opt/food-order-3tier-aws` with `releases/` and `shared/` directories.
6. Generates `/opt/food-order-3tier-aws/shared/.env` from `.env.example` with a cryptographically secure random `SECRET_KEY` (`openssl rand -hex 32`).
7. Installs and enables the `food-order-3tier.service` systemd unit pointing to `/opt/food-order-3tier-aws/current`.

---

### 2. Creating a Release Tag (Developer Machine)

Tag your release commit and push the tag to the remote repository:

```bash
# Example: Tagging version v1.1.0
git tag -a v1.1.0 -m "Release v1.1.0"
git push origin v1.1.0
```

---

### 3. Creating a Release Worktree (On Server)

On the server, fetch the tag and create an isolated worktree for the release:

```bash
sudo ./scripts/worktree.sh v1.1.0
```

This fetches all remote tags and checks out the exact release into `/opt/src/food-order-3tier-aws/v1.1.0`.

To inspect all existing worktrees:
```bash
sudo ./scripts/worktree.sh --list
```

---

### 4. Building Docker Images on the Server

Navigate to the release worktree and build the images using the `Makefile`:

```bash
cd /opt/src/food-order-3tier-aws/v1.1.0

# Build both backend (food-api:v1.1.0) and frontend (food-ui:v1.1.0)
make build VERSION=v1.1.0
```

*Note: You can also build individual images with `make build-api VERSION=v1.1.0` or `make build-ui VERSION=v1.1.0`.*

---

### 5. Deploying the Release

Execute the deployment script:

```bash
sudo ./scripts/deploy.sh --version=v1.1.0
```

**Deployment Lifecycle Execution:**
1. **Concurrency Lock:** Acquires exclusive `flock` on `/opt/food-order-3tier-aws/.deploy.lock`.
2. **Image Verification:** Confirms `food-api:v1.1.0` and `food-ui:v1.1.0` exist in the local Docker engine.
3. **Release Staging:** Creates `/opt/food-order-3tier-aws/releases/v1.1.0`, copies `docker-compose.yml`, and builds release-scoped `.env` with shared credentials and `VERSION=v1.1.0`.
4. **Container Launch:** Runs `docker compose -p food-order-3tier --project-directory ... up -d --remove-orphans`.
5. **Health Checks:** Validates PostgreSQL connection, backend endpoint (`http://localhost:8000/api/v1`), and frontend endpoint (`http://localhost:8080/`).
6. **Atomic Cutover:** If healthy, atomically updates symlink `/opt/food-order-3tier-aws/current -> releases/v1.1.0` using POSIX atomic rename (`mv -Tf`).
7. **Database Migrations:** Runs `docker exec food_api alembic upgrade head`.
8. **Retention Pruning:** Keeps the 3 latest releases for rollback and cleans up older directories.

---

### 6. Verifying the Deployment

Run these commands on the server to verify the release:

```bash
# Check running containers and health status
docker ps

# Check the active release symlink target
readlink -f /opt/food-order-3tier-aws/current

# Check container status via Docker Compose from the current directory
cd /opt/food-order-3tier-aws/current && docker compose ps

# Test HTTP endpoints
curl -fsSL http://localhost:8000/api/v1
curl -fsSL http://localhost:8080/
```

---

### 7. Instant Zero-Rebuild Rollback

If an issue occurs in production, roll back immediately:

```bash
# Roll back to the previous release
sudo ./scripts/rollback.sh

# Or roll back to a specific existing release
sudo ./scripts/rollback.sh --version=v1.0.0

# List available releases for rollback
sudo ./scripts/rollback.sh --list
```

**How Rollback Works:**
1. Identifies the previous release directory (e.g., `releases/v1.0.0`).
2. Starts containers directly from the previous release directory using its already-built images (`food-api:v1.0.0` and `food-ui:v1.0.0`).
3. Runs health checks to ensure the rolled-back service is healthy.
4. Atomically switches the symlink `current -> releases/v1.0.0`.
5. No Docker image build or network downloads take place; cutover completes in seconds.

---

## 🛠️ Local Development

For day-to-day development on a local workstation:

```bash
# 1. Copy local environment variables
cp .env.example .env

# 2. Start all services with live reload
make dev
# or: docker compose up --build
```

- Backend API: `http://localhost:8000` (docs at `http://localhost:8000/docs`)
- Frontend Dev Server: `http://localhost:5173` (with Vite hot-module replacement)
- PostgreSQL Database: `localhost:5432`

---

## 🛡️ Failure Scenarios & Self-Healing

| Failure Scenario | How the System Handles It | Outcome |
|------------------|---------------------------|---------|
| **Docker image missing** | `deploy.sh` verifies local image existence before touching the filesystem or containers. | Aborts at Step 1; no release directory created; no downtime. |
| **Build fails on server** | `make build` stops immediately via bash `set -euo pipefail`. | Images are not created; deployment is not invoked. |
| **Compose fails to start** | Docker Compose reports container failure during `up -d`. | `deploy.sh` catches error, prints container logs, and aborts. |
| **Health check fails** | Backend or Frontend does not return HTTP 200 within timeout. | `deploy.sh` dumps recent backend logs, automatically restores previous release containers, leaves `current` symlink unchanged, and exits with error code 1. |
| **Deployment interrupted halfway** | `flock` ensures only one deployment script runs. Releases are staged in isolated directories. | The `current` symlink is NEVER switched until after health checks succeed. The running production service remains untouched. |
| **Crash after deployment** | Run `sudo ./scripts/rollback.sh`. | Swaps containers and symlink back to previous version in seconds without rebuilding. |

---

## 💡 Production Architecture Rationale

1. **Why Git worktrees?**
   Git worktrees share a single `.bare` repository object store while allowing multiple releases or branches (`main`, `v1.1.0`, `v1.2.0`) to coexist on disk simultaneously without re-cloning.
2. **Why build images on the server via Makefile?**
   Eliminates complex CI registry credentials and eliminates brittle `.tar.gz` image archive transfers. The Makefile standardizes commands across both dev and production.
3. **Why atomic symlink switching (`mv -Tf`)?**
   A standard `ln -sfn` is not atomic on all filesystems and can briefly expose a missing link during deletion. Creating a temporary symlink (`.current_tmp_$$`) and renaming it over `current` using `mv -Tf` relies on the kernel's `rename()` system call, which is guaranteed to be instantaneous and atomic.
4. **Why isolated release directories?**
   Every release (`/opt/food-order-3tier-aws/releases/<version>`) has its own immutable `docker-compose.yml` and `.env`. Rolling back never relies on rebuilding, pulling images, or git checkout.
