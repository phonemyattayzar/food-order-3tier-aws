# 🏗️ AWS 3-Tier Architecture Native Deployment Guide: Sar Mel

This guide details how to deploy the **Sar Mel (Food Ordering System)** on AWS using a classic 3-tier architecture. All services are deployed natively on EC2 (without Docker) using Nginx, systemd, Python virtual environments, Node.js, and Amazon RDS PostgreSQL.

It is customized to support a **single-Availability Zone (Single-AZ)** setup with **one instance per tier** (1 Frontend EC2 instance, 1 Backend EC2 instance, and 1 RDS PostgreSQL database instance) behind an Application Load Balancer (ALB).

---

## 📋 Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Prerequisites](#2-prerequisites)
3. [Network Infrastructure Setup](#3-network-infrastructure-setup)
4. [Security Groups Configuration](#4-security-groups-configuration)
5. [Database Tier (RDS PostgreSQL)](#5-database-tier-rds-postgresql)
6. [Secrets Management (AWS SSM Parameter Store)](#6-secrets-management-aws-ssm-parameter-store)
7. [IAM Roles and Policies](#7-iam-roles-and-policies)
8. [Application Load Balancer (ALB) Setup](#8-application-load-balancer-alb-setup)
9. [Frontend Tier Deployment (React on EC2)](#9-frontend-tier-deployment-react-on-ec2)
10. [Backend Tier Deployment (FastAPI on EC2)](#10-backend-tier-deployment-fastapi-on-ec2)
11. [Database Migrations (Alembic)](#11-database-migrations-alembic)
12. [Automating with GitLab CI/CD](#12-automating-with-gitlab-cicd)
13. [Testing and Troubleshooting](#13-testing-and-troubleshooting)

---

## 1. Architecture Overview

### Infrastructure Components

```
                     Internet (Port 80)
                              │
                              ▼
              Application Load Balancer (ALB)
                 ├── "/" -> Frontend TG (Port 80)
                 └── "/api/v1/*" -> Backend TG (Port 8000)
                              │
              ┌──────────────┴──────────────┐
              ▼                             ▼
      [Frontend EC2 Server]         [Backend EC2 Server]
      (Nginx serving React, 80)     (FastAPI Backend, 8000)
              │                             │
              └──────────────┬──────────────┘
                             ▼ (PostgreSQL Port 5432)
                   [RDS PostgreSQL Database]
```

### Flow of Traffic
1. **Frontend Assets:** Users query `http://[alb-dns-name]/` → ALB routes port 80 traffic to the Frontend EC2 instance → Nginx serves static assets from `/usr/share/nginx/html`.
2. **Backend API Requests:** Users trigger API calls via `http://[alb-dns-name]/api/v1/*` → ALB intercepts and routes the traffic directly to the Backend EC2 instance on port `8000`.
3. **Database Access:** The FastAPI app on the Backend EC2 instance connects to RDS PostgreSQL in the private DB subnet on port `5432`.

### Cost-Optimized Subnet Design
To eliminate the high cost of NAT Gateways (~$32/month) while maintaining a strict 3-tier security model:
*   We place both the Frontend and Backend EC2 instances in a **Public Subnet**. This gives them outbound internet connectivity to download dependencies and pull updates directly.
*   We use **AWS Security Groups** to enforce logical tier separation:
    *   The **Frontend EC2** only accepts traffic from the ALB.
    *   The **Backend EC2** only accepts traffic from the ALB.
    *   The **RDS Database** is kept inside a **Private DB Subnet** and only accepts traffic from the Backend EC2.

---

## 2. Prerequisites

Before starting, ensure you have:
*   [ ] AWS Account with appropriate administrative permissions.
*   [ ] AWS CLI installed and configured locally.
*   [ ] SSH key pair created in AWS EC2 (e.g. `sarmel-key.pem`).
*   [ ] A GitHub or GitLab repository containing your application code.

---

## 3. Network Infrastructure Setup

Although we deploy our instances in a single AZ, ALB and RDS require subnets spanning at least **two Availability Zones** to be created. We set up a VPC spanning two AZs in Singapore (e.g., `ap-southeast-1a` and `ap-southeast-1b`). Note that your active instances (EC2 and RDS) will reside strictly in `ap-southeast-1a`, while the subnets in `ap-southeast-1b` serve as standby configurations required by AWS and cost $0.

### 3.1 Create VPC
1. Navigate to AWS Console → **VPC** → **Create VPC**.
2. VPC settings:
    *   **VPC type:** VPC only
    *   **Name tag:** `sarmel-vpc`
    *   **IPv4 CIDR block:** `10.0.0.0/16`
3. Click **Create VPC**.
4. Select the VPC → **Actions** → **Edit VPC settings**:
    *   ✅ **Enable DNS resolution**
    *   ✅ **Enable DNS hostnames**
5. Click **Save**.

### 3.2 Create Internet Gateway
1. Go to **Internet Gateways** → **Create internet gateway**.
    *   **Name tag:** `sarmel-igw`
2. Select `sarmel-igw` → **Actions** → **Attach to VPC** → Choose `sarmel-vpc`.

### 3.3 Create Subnets
Create **4 subnets** across **2 Availability Zones**:

| Subnet Name | Availability Zone | CIDR Block | Type |
| :--- | :--- | :--- | :--- |
| `sarmel-public-subnet-1a` | `ap-southeast-1a` | `10.0.1.0/24` | Public (for Frontend EC2, Backend EC2, ALB) |
| `sarmel-public-subnet-1b` | `ap-southeast-1b` | `10.0.2.0/24` | Public (Standby for ALB - Empty, costs $0) |
| `sarmel-db-subnet-1a` | `ap-southeast-1a` | `10.0.11.0/24` | Private (for RDS Primary Database) |
| `sarmel-db-subnet-1b` | `ap-southeast-1b` | `10.0.12.0/24` | Private (Standby for RDS Subnet Group - Empty, costs $0) |

**Enable Auto-assign Public IP for Public Subnets:**
*   Select each public subnet → **Actions** → **Edit subnet settings** → Check ✅ **Enable auto-assign public IPv4 address** → Click **Save**.

### 3.4 Create Route Tables
Create **2 route tables**:

#### Public Route Table (`sarmel-public-rt`)
1. Go to **Route Tables** → **Create route table**.
    *   **Name:** `sarmel-public-rt`
    *   **VPC:** `sarmel-vpc`
2. Select the route table → **Routes** tab → **Edit routes** → Add:
    *   `0.0.0.0/0` → `Internet Gateway` (`sarmel-igw`)
3. Go to **Subnet associations** → **Edit subnet associations** → Select `sarmel-public-subnet-1a` and `sarmel-public-subnet-1b`.

#### Private Database Route Table (`sarmel-db-rt`)
1. Create another route table:
    *   **Name:** `sarmel-db-rt`
    *   **VPC:** `sarmel-vpc`
2. No internet route is added here (keeps the database secure).
3. Go to **Subnet associations** → **Edit subnet associations** → Select `sarmel-db-subnet-1a` and `sarmel-db-subnet-1b`.

---

## 4. Security Groups Configuration

Create **4 security groups** with least-privilege access rules:

### 4.1 ALB Security Group (`sarmel-alb-sg`)
*   **VPC:** `sarmel-vpc`
*   **Inbound Rules:**
    *   `HTTP` (TCP `80`): Source `0.0.0.0/0` (Allows web access from internet)
    *   `HTTPS` (TCP `443`): Source `0.0.0.0/0` (Optional - for SSL setup)
*   **Outbound Rules:**
    *   `All Traffic` to `0.0.0.0/0`

### 4.2 Frontend Security Group (`sarmel-frontend-sg`)
*   **VPC:** `sarmel-vpc`
*   **Inbound Rules:**
    *   `HTTP` (TCP `80`): Source `sarmel-alb-sg` (Allows HTTP traffic only from the Load Balancer)
    *   `SSH` (TCP `22`): Source `Your-IP/32` (Allows SSH from your IP only)

### 4.3 Backend Security Group (`sarmel-backend-sg`)
*   **VPC:** `sarmel-vpc`
*   **Inbound Rules:**
    *   `Custom TCP` (TCP `8000`): Source `sarmel-alb-sg` (Allows API calls only from the Load Balancer)
    *   `SSH` (TCP `22`): Source `Your-IP/32` (Allows SSH from your IP only)

### 4.4 RDS Database Security Group (`sarmel-rds-sg`)
*   **VPC:** `sarmel-vpc`
*   **Inbound Rules:**
    *   `PostgreSQL` (TCP `5432`): Source `sarmel-backend-sg` (Allows queries only from the Backend EC2 server)

---

## 5. Database Tier (RDS PostgreSQL)

### 5.1 Create DB Subnet Group
1. Go to **RDS Console** → **Subnet groups** → **Create DB subnet group**.
2. Details:
    *   **Name:** `sarmel-db-subnet-group`
    *   **VPC:** `sarmel-vpc`
    *   **Add subnets:** Choose AZs (`ap-southeast-1a` and `ap-southeast-1b`) and select the DB subnets: `10.0.11.0/24` and `10.0.12.0/24`.
3. Click **Create**.

### 5.2 Create RDS PostgreSQL Instance
1. Go to **RDS Console** → **Databases** → **Create database**.
2. Configuration:
    *   **Engine options:** PostgreSQL (Choose version **15.x**)
    *   **Templates:** Free tier
    *   **DB instance identifier:** `sarmel-db`
    *   **Master username:** `postgres`
    *   **Master password:** Choose a password and save it securely.
    *   **Instance configuration:** `db.t3.micro`
    *   **Storage type:** gp3 (Allocated storage: 20 GB)
    *   **Connectivity:**
        *   **VPC:** `sarmel-vpc`
        *   **DB subnet group:** `sarmel-db-subnet-group`
        *   **Public access:** No
        *   **VPC security group:** Select existing → `sarmel-rds-sg` (remove default)
    *   **Additional Configuration:**
        *   **Initial database name:** `food_db`
3. Click **Create database**.
4. Once active (~10 minutes), copy the **Endpoint** (e.g. `sarmel-db.xxxxxxxxx.ap-southeast-1.rds.amazonaws.com`).

### 5.3 Manual Database Creation (If food_db does not exist)
If the database was created without specifying an initial database name, the `food_db` database will not exist. Create it manually from your backend EC2 server:
```bash
# Connect using default postgres database and run CREATE DATABASE command
source /home/ec2-user/app/backend/.env
PGPASSWORD="$POSTGRES_PASSWORD" psql -h [RDS-ENDPOINT] -U postgres -d postgres -c "CREATE DATABASE food_db;"
```

---

## 6. Secrets Management (AWS SSM Parameter Store)

Store your environment configurations in Systems Manager Parameter Store.

Navigate to **Systems Manager** → **Parameter Store** → **Create Parameter**:

| Parameter Name | Type | Value / Description |
| :--- | :--- | :--- |
| `/sarmel/production/POSTGRES_USER` | String | `postgres` |
| `/sarmel/production/POSTGRES_PASSWORD` | SecureString | `[Your RDS master password]` |
| `/sarmel/production/POSTGRES_DB` | String | `food_db` |
| `/sarmel/production/DATABASE_URL` | SecureString | `postgresql://postgres:[PASSWORD]@[RDS-ENDPOINT]:5432/food_db` |
| `/sarmel/production/SECRET_KEY` | SecureString | `[Generate a secure 64-character hex string]` |
| `/sarmel/production/ALGORITHM` | String | `HS256` |

---

## 7. IAM Roles and Policies

Create an IAM Role for your EC2 instances so they can securely download parameters from SSM.

1. Go to **IAM Console** → **Roles** → **Create role**.
2. Select **AWS service** → Choose **EC2** as the service.
3. Attach policies:
    *   `AmazonSSMManagedInstanceCore` (Allows SSH-less terminal access via Systems Manager Session Manager)
4. Click **Create inline policy** → Select the **JSON** tab and paste:
    ```json
    {
      "Version": "2012-10-17",
      "Statement": [
        {
          "Effect": "Allow",
          "Action": [
            "ssm:GetParameter",
            "ssm:GetParameters",
            "ssm:GetParametersByPath"
          ],
          "Resource": "arn:aws:ssm:ap-southeast-1:*:parameter/sarmel/*"
        }
      ]
    }
    ```
    *   *Name this inline policy `SSMSarMelAccess`.*
5. Name the Role: **`sarmel-ec2-role`** and click **Create role**.

---

## 8. Application Load Balancer (ALB) Setup

The ALB acts as the single entrypoint for traffic, routing requests to the respective frontend and backend instances.

### 8.1 Create Target Groups

#### 1. Frontend Target Group (`sarmel-frontend-tg`)
1. Go to **EC2** → **Target Groups** → **Create target group**.
2. Configuration:
    *   **Target type:** Instances
    *   **Target group name:** `sarmel-frontend-tg`
    *   **Protocol:** HTTP (Port `80`)
    *   **VPC:** `sarmel-vpc`
    *   **Health check protocol:** HTTP
    *   **Health check path:** `/`
    *   **Advanced health check settings:**
        *   Healthy threshold: `2`
        *   Unhealthy threshold: `3`
        *   Timeout: `5 seconds`
        *   Interval: `30 seconds`
        *   Success codes: `200`
3. Click **Create**.

#### 2. Backend Target Group (`sarmel-backend-tg`)
1. Create another target group:
    *   **Target type:** Instances
    *   **Target group name:** `sarmel-backend-tg`
    *   **Protocol:** HTTP (Port `8000`)
    *   **VPC:** `sarmel-vpc`
    *   **Health check protocol:** HTTP
    *   **Health check path:** `/api/v1/`
    *   **Advanced health check settings:** Same as above
2. Click **Create**.

### 8.2 Create Application Load Balancer
1. Go to **EC2** → **Load Balancers** → **Create Load Balancer** → **Application Load Balancer**.
2. Settings:
    *   **Name:** `sarmel-alb`
    *   **Scheme:** Internet-facing
    *   **IP address type:** IPv4
    *   **VPC:** `sarmel-vpc`
    *   **Mappings:** Select both Availability Zones:
        *   `ap-southeast-1a` → `sarmel-public-subnet-1a`
        *   `ap-southeast-1b` → `sarmel-public-subnet-1b`
    *   **Security groups:** Choose `sarmel-alb-sg` (remove default)
    *   **Listeners and routing:**
        *   Protocol: `HTTP` (Port `80`) → Default action: Forward to `sarmel-frontend-tg`
3. Click **Create Load Balancer**.
4. Note down the **DNS Name** (e.g. `sarmel-alb-440804868.ap-southeast-1.elb.amazonaws.com`).

### 8.3 Configure Listener Routing Rules
1. Select `sarmel-alb` → **Listeners** tab → Click **HTTP:80** listener.
2. Click **Manage rules** → **Add rule**:
    *   **Condition:** Path matches **either** `/api/v1/*` or `/api/v1`
    *   **Action:** Forward to target group `sarmel-backend-tg`
3. Save the rule.

---

## 9. Frontend Tier Deployment (React on EC2)

The Frontend Tier EC2 instance compiles your React code and hosts it via Nginx on port 80.

### 9.1 Launch Frontend EC2 Instance
1. Go to **EC2** → **Instances** → **Launch instances**.
2. Configuration:
    *   **Name:** `sarmel-frontend-server`
    *   **OS:** Amazon Linux 2023 AMI
    *   **Instance Type:** `t3.small` (Vite compilation requires at least 2GB of RAM; `t3.micro` might fail during build)
    *   **Key pair:** Select your SSH key pair
    *   **Network settings:**
        *   **VPC:** `sarmel-vpc`
        *   **Subnet:** `sarmel-public-subnet-1a`
        *   **Security group:** Select `sarmel-frontend-sg`
    *   **IAM instance profile:** `sarmel-ec2-role`
3. Click **Launch instance**.

### 9.2 Frontend Provisioning & Server Setup
Connect to `sarmel-frontend-server` via SSH:

```bash
# Update packages
sudo dnf update -y

# Install Git and Nginx
sudo dnf install git nginx -y

# Install Node.js 20 (LTS) on Amazon Linux 2023
sudo dnf install -y nodejs20
sudo alternatives --set node /usr/bin/node-20

# Clone repo
cd /home/ec2-user
git clone https://gitlab.com/phonemyattayzarkyaw/sar-mel.git app
cd app/frontend

# Install dependencies
npm install

# Note: If you run into native binding errors (e.g. "@rolldown/binding-linux-x64-gnu missing"),
# clean the node_modules directory and reinstall dependencies:
# rm -rf node_modules package-lock.json && npm install

# Build project
VITE_API_BASE="/api/v1" npm run build

# Deploy built static files to Nginx directory
sudo rm -rf /usr/share/nginx/html/*
sudo cp -r dist/* /usr/share/nginx/html/
sudo chown -R nginx:nginx /usr/share/nginx/html
```

Create Nginx configuration file `/etc/nginx/conf.d/sarmel.conf` to enable clean routing for React SPA:
```nginx
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    # Enable gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    # SPA routing - serve index.html for all paths
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```
*Note: Save file using `sudo nano /etc/nginx/conf.d/sarmel.conf`.*

Enable and start Nginx:
```bash
sudo systemctl enable nginx
sudo systemctl restart nginx
```

### 9.3 Register Target
1. Go to **EC2** → **Target Groups** → Select `sarmel-frontend-tg`.
2. Go to **Targets** tab → **Register targets** → Select `sarmel-frontend-server` → Click **Include as pending below** → Click **Register pending targets**.

---

## 10. Backend Tier Deployment (FastAPI on EC2)

The Backend Tier EC2 instance runs the FastAPI application using virtualenv and systemd on port 8000.

### 10.1 Launch Backend EC2 Instance
1. Go to **EC2** → **Instances** → **Launch instances**.
2. Configuration:
    *   **Name:** `sarmel-backend-server`
    *   **OS:** Amazon Linux 2023 AMI
    *   **Instance Type:** `t3.micro`
    *   **Key pair:** Select your SSH key pair
    *   **Network settings:**
        *   **VPC:** `sarmel-vpc`
        *   **Subnet:** `sarmel-public-subnet-1a`
        *   **Security group:** Select `sarmel-backend-sg`
    *   **IAM instance profile:** `sarmel-ec2-role`
3. Click **Launch instance**.

### 10.2 Backend Setup
Connect to `sarmel-backend-server` via SSH:

```bash
# Update packages
sudo dnf update -y

# Install Python 3.11, pip, virtualenv, git, and Postgres CLI
sudo dnf install python3.11 python3.11-pip python3.11-devel git postgresql15 -y

# Clone repo
cd /home/ec2-user
git clone https://gitlab.com/phonemyattayzarkyaw/sar-mel.git app
cd app/backend

# Create virtualenv and install requirements
python3.11 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

Create a parameter fetching script `/home/ec2-user/app/backend/get-params.sh` to extract secrets from SSM and save them in `.env`:
```bash
cat > /home/ec2-user/app/backend/get-params.sh << 'EOF'
#!/bin/bash
AWS_REGION="ap-southeast-1"

echo "Fetching environment variables from SSM..."
DB_URL=$(aws ssm get-parameter --name "/sarmel/production/DATABASE_URL" --with-decryption --region $AWS_REGION --query "Parameter.Value" --output text)
DB_USER=$(aws ssm get-parameter --name "/sarmel/production/POSTGRES_USER" --region $AWS_REGION --query "Parameter.Value" --output text)
DB_PASS=$(aws ssm get-parameter --name "/sarmel/production/POSTGRES_PASSWORD" --with-decryption --region $AWS_REGION --query "Parameter.Value" --output text)
DB_NAME=$(aws ssm get-parameter --name "/sarmel/production/POSTGRES_DB" --region $AWS_REGION --query "Parameter.Value" --output text)
SEC_KEY=$(aws ssm get-parameter --name "/sarmel/production/SECRET_KEY" --with-decryption --region $AWS_REGION --query "Parameter.Value" --output text)
ALG=$(aws ssm get-parameter --name "/sarmel/production/ALGORITHM" --region $AWS_REGION --query "Parameter.Value" --output text)

cat > /home/ec2-user/app/backend/.env << ENV_EOF
DATABASE_URL="$DB_URL"
POSTGRES_USER="$DB_USER"
POSTGRES_PASSWORD="$DB_PASS"
POSTGRES_DB="$DB_NAME"
SECRET_KEY="$SEC_KEY"
ALGORITHM="$ALG"
ENV_EOF

chmod 600 /home/ec2-user/app/backend/.env
echo ".env file generated successfully."
EOF

chmod +x /home/ec2-user/app/backend/get-params.sh
# Run the script to generate .env
/home/ec2-user/app/backend/get-params.sh
```

Create the Systemd service configuration `/etc/systemd/system/sarmel-backend.service`:
```ini
[Unit]
Description=Sar Mel FastAPI Backend Service
After=network.target

[Service]
User=ec2-user
WorkingDirectory=/home/ec2-user/app/backend
EnvironmentFile=/home/ec2-user/app/backend/.env
ExecStart=/home/ec2-user/app/backend/venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```
*Note: Save file using `sudo nano /etc/systemd/system/sarmel-backend.service`.*

Start and enable the FastAPI backend:
```bash
sudo systemctl daemon-reload
sudo systemctl enable sarmel-backend
sudo systemctl start sarmel-backend
```

### 10.3 Register Target
1. Go to **EC2** → **Target Groups** → Select `sarmel-backend-tg`.
2. Go to **Targets** tab → **Register targets** → Select `sarmel-backend-server` → Click **Include as pending below** → Click **Register pending targets**.

---

## 11. Database Migrations (Alembic)

Database schemas are initialized and run using Alembic directly from the backend server environment.

Run migrations manually from the virtual environment:
```bash
cd /home/ec2-user/app/backend
source venv/bin/activate
alembic upgrade head
```

---

## 12. Automating with GitLab CI/CD

To support continuous deployment to separate servers, we configure deployment scripts on both EC2 servers and invoke them via GitLab CI/CD when updates are merged into the `main` branch.

### 12.1 Deploy Scripts on EC2 Servers

#### 1. On `sarmel-frontend-server` (`/home/ec2-user/app/deploy-frontend.sh`):
```bash
cat > /home/ec2-user/app/deploy-frontend.sh << 'EOF'
#!/bin/bash
set -e
cd /home/ec2-user/app
git pull origin main
cd frontend
npm install
VITE_API_BASE="/api/v1" npm run build
sudo rm -rf /usr/share/nginx/html/*
sudo cp -r dist/* /usr/share/nginx/html/
sudo chown -R nginx:nginx /usr/share/nginx/html
sudo systemctl reload nginx
echo "Frontend deployment complete!"
EOF
chmod +x /home/ec2-user/app/deploy-frontend.sh
```

#### 2. On `sarmel-backend-server` (`/home/ec2-user/app/deploy-backend.sh`):
```bash
cat > /home/ec2-user/app/deploy-backend.sh << 'EOF'
#!/bin/bash
set -e
cd /home/ec2-user/app
git pull origin main
./backend/get-params.sh
cd backend
source venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
sudo systemctl restart sarmel-backend
echo "Backend deployment complete!"
EOF
chmod +x /home/ec2-user/app/deploy-backend.sh
```

### 12.2 Configure GitLab Variables
In GitLab project **Settings** → **CI/CD** → **Variables**, register:
*   `SSH_PRIVATE_KEY`: Private Key (`.pem` string) used to SSH into both servers.
*   `EC2_FRONTEND_HOST`: The Public IP of `sarmel-frontend-server`.
*   `EC2_BACKEND_HOST`: The Public IP of `sarmel-backend-server`.

### 12.3 Update `.gitlab-ci.yml`
Add the following `deploy` stage jobs to execute updates on both instances:

```yaml
stages:
  - deploy

.deploy-base:
  image: alpine:latest
  only:
    refs:
      - main
  before_script:
    - apk add --no-cache openssh-client bash
    - eval $(ssh-agent -s)
    - echo "$SSH_PRIVATE_KEY" | tr -d '\r' | ssh-add -
    - mkdir -p ~/.ssh
    - chmod 700 ~/.ssh
    - echo -e "Host *\n\tStrictHostKeyChecking no\n\n" > ~/.ssh/config

deploy:frontend:
  extends: .deploy-base
  stage: deploy
  script:
    - echo "Deploying frontend..."
    - ssh ec2-user@$EC2_FRONTEND_HOST "bash /home/ec2-user/app/deploy-frontend.sh"

deploy:backend:
  extends: .deploy-base
  stage: deploy
  script:
    - echo "Deploying backend..."
    - ssh ec2-user@$EC2_BACKEND_HOST "bash /home/ec2-user/app/deploy-backend.sh"
```

---

## 13. Testing and Troubleshooting

### 13.1 Verification Steps
1.  **Web Client Access:** In a browser, open `http://[ALB-DNS-NAME]/`. The user interface should load successfully.
2.  **API Routing Check:** In a browser, open `http://[ALB-DNS-NAME]/api/v1/`. It should return:
    ```json
    {"message": "Mingalaba! Food API is running"}
    ```
3.  **End-to-end Integration:** Complete a registration or add a category/restaurant in the UI to confirm the Frontend can query the Backend through the ALB, and that the Backend successfully stores data in RDS.

### 13.2 Troubleshooting Commands

*   **FastAPI Logs (on Backend Server):**
    ```bash
    sudo journalctl -u sarmel-backend -f
    ```
*   **Nginx Error Logs (on Frontend Server):**
    ```bash
    sudo tail -f /var/log/nginx/error.log
    ```
*   **Verify Health Check Status on ALB:**
    *   Check AWS Console → EC2 → Target Groups.
    *   Verify both targets show **Healthy**. If backend shows unhealthy, check that port `8000` is active and the security group allows incoming TCP 8000 from the ALB.

### 13.3 Common Errors & How to Fix

#### 1. `502 Bad Gateway` when accessing ALB
*   **Cause 1:** The target server's application service is not running (e.g. Nginx on frontend or Uvicorn on backend).
    *   *Fix:* Check services status using `systemctl status nginx` or `systemctl status sarmel-backend`.
*   **Cause 2:** Security Groups are blocking communications between the ALB and the EC2 instances.
    *   *Fix:* Verify `sarmel-frontend-sg` and `sarmel-backend-sg` allow inbound traffic on port 80/8000 respectively, with the source set to `sarmel-alb-sg`.
*   **Cause 3:** ALB routing rules are forwarding requests to unhealthy target groups.
    *   *Fix:* Verify Target Group health status in the AWS Console.

#### 2. `/api/v1` routes to the Frontend instead of the Backend
*   **Cause:** The ALB path rule `/api/v1/*` does not match `/api/v1` without a trailing slash, falling back to the default rule.
    *   *Fix:* Update the ALB listener rule to include both `/api/v1/*` and `/api/v1` path patterns.

#### 3. `/api/v1/` or `/api/v1/docs` returns `{"detail":"Not Found"}`
*   **Cause:** FastAPI defaults the API docs to `/docs` instead of `/api/v1/docs`, and the root endpoint is `/` instead of `/api/v1`.
    *   *Fix:* In `app/main.py`, configure FastAPI with:
        ```python
        app = FastAPI(
            title="Food Ordering API",
            docs_url="/api/v1/docs",
            redoc_url="/api/v1/redoc",
            openapi_url="/api/v1/openapi.json"
        )
        ```
        And add `@app.get("/api/v1")` and `@app.get("/api/v1/")` decorators to the root health endpoint.

#### 4. `ValidationError: Field required` when running Alembic migrations
*   **Cause:** Pydantic v2 ignores `class Config` for base settings, causing it to ignore the `.env` file when running manually in the shell.
    *   *Fix:* Import `SettingsConfigDict` and change class settings in `app/core/config.py` to:
        ```python
        model_config = SettingsConfigDict(env_file=".env", extra="ignore")
        ```
*   **Cause 2:** The `.env` file does not exist.
    *   *Fix:* Run `/home/ec2-user/app/backend/get-params.sh` to fetch the parameters from SSM.

#### 5. Native Binding Error (`Cannot find native binding`) during Vite build
*   **Cause:** Dependencies were installed under Node 18, and building is run under Node 20, or npm failed to install platform-specific optional dependencies.
    *   *Fix:* Remove `node_modules` and `package-lock.json`, verify Node 20 is active, and run `npm install` again.

#### 6. Database `food_db` does not exist
*   **Cause:** The initial database name was not specified during RDS setup.
    *   *Fix:* Connect to default `postgres` database and create the database:
        ```bash
        source /home/ec2-user/app/backend/.env
        PGPASSWORD="$POSTGRES_PASSWORD" psql -h [RDS-ENDPOINT] -U postgres -d postgres -c "CREATE DATABASE food_db;"
        ```
