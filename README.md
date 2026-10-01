# 🍽️ AWS 3-Tier Web Application Infrastructure (Terraform)

A simple, production-ready, and maintainable AWS 3-tier infrastructure deployment for an outsource client using Terraform. 

This repository provisions an internet-facing **Application Load Balancer (ALB)**, an **EC2 Auto Scaling Group (ASG)** running containerized application services pulled from **AWS ECR** across private subnets, and an isolated **Multi-AZ RDS PostgreSQL** database tier, backed by remote state management using **Amazon S3** and **DynamoDB**.

---

## 🏗️ 1. Architecture Overview

```mermaid
flowchart TD
    subgraph Internet["Public Internet"]
        Users["Client Users / Web Traffic"]
    end

    subgraph AWS["AWS Cloud (VPC: 10.0.0.0/16 across 2 Availability Zones)"]
        IGW["Internet Gateway (IGW)"]

        subgraph Tier1["Tier 1: Presentation / Public Subnets"]
            subgraph AZ1_Pub["AZ-a (10.0.1.0/24)"]
                ALB_A["ALB Node A"]
                NAT_A["NAT Gateway A"]
            end
            subgraph AZ2_Pub["AZ-b (10.0.2.0/24)"]
                ALB_B["ALB Node B"]
                NAT_B["NAT Gateway B (Prod)"]
            end
        end

        subgraph Tier2["Tier 2: Application / Private Subnets"]
            subgraph AZ1_App["AZ-a (10.0.11.0/24)"]
                EC2_1["EC2 Instance (Docker Engine)"]
            end
            subgraph AZ2_App["AZ-b (10.0.12.0/24)"]
                EC2_2["EC2 Instance (Docker Engine)"]
            end
            ASG["Auto Scaling Group (Min: 2, Max: 4)"]
        end

        subgraph Tier3["Tier 3: Database / Isolated Subnets"]
            subgraph AZ1_DB["AZ-a (10.0.21.0/24)"]
                RDS_Primary[("RDS PostgreSQL (Primary)")]
            end
            subgraph AZ2_DB["AZ-b (10.0.22.0/24)"]
                RDS_Standby[("RDS Standby (Synchronous Replica)")]
            end
        end

        subgraph Supporting["Supporting AWS Services"]
            ECR["AWS ECR (Docker Repositories)"]
            SSM["AWS SSM Session Manager (No SSH Port 22)"]
            S3_Backend["S3 Remote State Bucket"]
            DDB_Lock["DynamoDB State Lock Table"]
            SM["AWS Secrets Manager / KMS"]
        end
    end

    Users -->|HTTPS 443 / HTTP 80| IGW
    IGW --> ALB_A & ALB_B
    ALB_A & ALB_B -->|Port 80/8080 Target Group| EC2_1 & EC2_2
    EC2_1 & EC2_2 -->|Egress via NAT| ECR
    EC2_1 & EC2_2 -->|Egress via NAT| SSM
    EC2_1 & EC2_2 -->|Port 5432 (Chained SG)| RDS_Primary
    RDS_Primary -.->|Multi-AZ Sync| RDS_Standby
```

### Network Topology & Traffic Routing

| Subnet Tier | CIDR Blocks (Example) | Route Target | Components | Public Access |
|-------------|-----------------------|--------------|------------|---------------|
| **Public Subnets** | `10.0.1.0/24`, `10.0.2.0/24` | Internet Gateway (`igw-*`) | ALB, NAT Gateways | Yes (Direct Internet) |
| **Private App Subnets** | `10.0.11.0/24`, `10.0.12.0/24` | NAT Gateway (`nat-*`) | EC2 Auto Scaling Group (Docker) | Egress only (No Public IP) |
| **Private DB Subnets** | `10.0.21.0/24`, `10.0.22.0/24` | Local VPC Only (No IGW / No NAT) | Multi-AZ RDS PostgreSQL | None (Completely Isolated) |

---

## 📂 2. Recommended Terraform Folder Directory Structure

```text
terraform/
├── README.md                            # Documentation and deployment runbook
│
├── bootstrap/                           # Phase 1: One-time setup for remote state backend
│   ├── main.tf                          # S3 bucket (versioning, encryption, public block) & DynamoDB table
│   ├── variables.tf                     # Bucket naming, DynamoDB table name, region
│   ├── outputs.tf                       # Exports state bucket name and lock table name
│   └── terraform.tfvars                 # Project prefix and region variables
│
├── modules/                             # Reusable, modular building blocks
│   │
│   ├── vpc/                             # Networking module
│   │   ├── main.tf                      # VPC, Subnets (Public, Private App, Private DB), IGW, NAT GW, Route Tables
│   │   ├── variables.tf                 # CIDRs, AZs, single_nat_gateway flag
│   │   └── outputs.tf                   # vpc_id, public_subnets, private_app_subnets, db_subnets
│   │
│   ├── security/                        # Security Groups module (chained rules)
│   │   ├── main.tf                      # ALB SG, EC2 App SG, RDS DB SG definitions
│   │   ├── variables.tf                 # vpc_id, application_port, database_port
│   │   └── outputs.tf                   # alb_sg_id, app_sg_id, db_sg_id
│   │
│   ├── ecr/                             # Container Registry module
│   │   ├── main.tf                      # ECR repository, lifecycle policy, vulnerability scanning
│   │   ├── variables.tf                 # repository_name, image_retention_count
│   │   └── outputs.tf                   # repository_url, repository_arn
│   │
│   ├── alb/                             # Application Load Balancer module
│   │   ├── main.tf                      # ALB, Target Group, HTTP/HTTPS Listeners, Health Checks
│   │   ├── variables.tf                 # vpc_id, public_subnet_ids, security_group_id, health_check_path
│   │   └── outputs.tf                   # alb_dns_name, alb_arn, target_group_arn
│   │
│   ├── asg/                             # Compute / Auto Scaling module
│   │   ├── main.tf                      # Launch Template, IAM Instance Profile (SSM + ECR), ASG (Min: 2, Max: 4)
│   │   ├── variables.tf                 # instance_type, min/max/desired size, subnet_ids, target_group_arn
│   │   ├── outputs.tf                   # asg_name, asg_arn, iam_role_name
│   │   └── templates/
│   │       └── user_data.sh.tpl         # Cloud-init: installs Docker, authenticates to ECR, pulls image & runs container
│   │
│   └── rds/                             # Multi-AZ Database module
│       ├── main.tf                      # DB Subnet Group, RDS Instance (Multi-AZ, KMS encrypted), Secrets Manager
│       ├── variables.tf                 # engine, engine_version, instance_class, db_name, subnet_ids, db_sg_id
│       └── outputs.tf                   # db_endpoint, db_name, db_secret_arn
│
└── environments/                        # Environment-specific root configurations
    ├── dev/                             # Development / Staging environment
    │   ├── backend.tf                   # Remote S3 backend configuration (key: dev/terraform.tfstate)
    │   ├── providers.tf                 # AWS provider configuration & default tags
    │   ├── main.tf                      # Root module instantiating modules with dev sizing
    │   ├── variables.tf                 # Environment input variable declarations
    │   ├── terraform.tfvars             # Dev values (e.g., single NAT, t3.micro, db.t4g.micro)
    │   └── outputs.tf                   # Outputs: ALB DNS URL, ECR URL, RDS Endpoint
    │
    └── prod/                            # Production environment
        ├── backend.tf                   # Remote S3 backend configuration (key: prod/terraform.tfstate)
        ├── providers.tf                 # AWS provider configuration & default tags
        ├── main.tf                      # Root module instantiating modules with prod sizing
        ├── variables.tf                 # Environment input variable declarations
        ├── terraform.tfvars             # Production values (multi-AZ, 2 NAT GWs, t3.small, db.t4g.small)
        └── outputs.tf                   # Outputs: ALB DNS URL, ECR URL, RDS Endpoint
```

---

## 🔍 3. Purpose & Breakdown of Each File

### A. Remote State Bootstrap (`terraform/bootstrap/`)
> [!IMPORTANT]
> **The State Dependency Dilemma**: You cannot configure an S3 backend inside Terraform before that S3 bucket and DynamoDB table exist. The `bootstrap/` folder solves this by running first with local state to provision the remote backend resources.

- **`bootstrap/main.tf`**:
  - `aws_s3_bucket`: Dedicated S3 bucket for storing `.tfstate` files.
  - `aws_s3_bucket_versioning`: Protects against accidental state deletion or corruption by maintaining a version history of every state file.
  - `aws_s3_bucket_server_side_encryption_configuration`: Enforces AES-256 or AWS KMS encryption at rest (state files can contain sensitive resource metadata).
  - `aws_s3_bucket_public_access_block`: Blocks all public ACLs and bucket policies.
  - `aws_dynamodb_table`: Creates a DynamoDB table with partition key `LockID` (String) to provide distributed state locking and prevent race conditions.
- **`bootstrap/variables.tf` & `terraform.tfvars`**: Declares and assigns the bucket prefix, DynamoDB table name, and target AWS region.
- **`bootstrap/outputs.tf`**: Outputs the bucket name and DynamoDB table name to copy into `environments/*/backend.tf`.

---

### B. Infrastructure Modules (`terraform/modules/`)

#### 1. Networking (`modules/vpc/`)
- **`main.tf`**:
  - `aws_vpc`: Sets up a VPC (default `10.0.0.0/16`) with DNS support and DNS hostnames enabled.
  - `aws_subnet` (Public x2): Spread across 2 Availability Zones for the ALB and NAT Gateways.
  - `aws_subnet` (Private App x2): Spread across 2 Availability Zones for EC2 Auto Scaling instances.
  - `aws_subnet` (Private DB x2): Spread across 2 Availability Zones for isolated database workloads.
  - `aws_internet_gateway`: Provides inbound/outbound connectivity for public subnets.
  - `aws_nat_gateway` & `aws_eip`: Provides outbound internet connectivity for private EC2 instances. Configurable via `enable_single_nat_gateway` to save costs in dev.
  - `aws_route_table` & associations:
    - Public subnets route `0.0.0.0/0` to the Internet Gateway.
    - Private app subnets route `0.0.0.0/0` to the NAT Gateway(s).
    - Database subnets have **no** default `0.0.0.0/0` route, keeping them completely unreachable from the outside.
- **`variables.tf`**: Input CIDRs, AZ list, and NAT gateway redundancy flags.
- **`outputs.tf`**: Exports `vpc_id`, `public_subnet_ids`, `private_app_subnet_ids`, and `db_subnet_ids`.

#### 2. Security Groups (`modules/security/`)
- **`main.tf`**:
  - **ALB Security Group**: Allows ingress on port `80` (HTTP) and `443` (HTTPS) from `0.0.0.0/0`. Restricts outbound egress to the EC2 App Security Group.
  - **EC2 App Security Group**: Allows ingress **only** from the ALB Security Group on the target application port (e.g., `80` or `8080`). No direct public ingress. Egress allows `0.0.0.0/0` to access the NAT Gateway for ECR and SSM.
  - **RDS DB Security Group**: Allows ingress on database port `5432` (PostgreSQL) or `3306` (MySQL) **only** from the EC2 App Security Group using `source_security_group_id`. No direct access from the internet or ALB.
- **`variables.tf` & `outputs.tf`**: Takes `vpc_id` and application ports; exports the created Security Group IDs.

#### 3. Container Registry (`modules/ecr/`)
- **`main.tf`**:
  - `aws_ecr_repository`: Private Docker registry for storing backend and frontend images.
  - `aws_ecr_lifecycle_policy`: Automatically purges untagged images and retains only the last 15 images to prevent unnecessary storage costs.
  - `image_scanning_configuration`: Enables scan-on-push for automatic container vulnerability discovery.
- **`variables.tf` & `outputs.tf`**: Configures repository name; exports the repository URL for build pipelines and EC2 user data.

#### 4. Load Balancer (`modules/alb/`)
- **`main.tf`**:
  - `aws_lb`: Internet-facing Application Load Balancer deployed across public subnets.
  - `aws_lb_target_group`: Target group configured with HTTP health checks (`/api/v1` or `/`), healthy threshold (3), interval (30s), and timeout (5s).
  - `aws_lb_listener`: Listens on HTTP port 80 (or HTTPS 443 with ACM certificate) and forwards traffic to the Target Group.
- **`variables.tf` & `outputs.tf`**: Takes VPC, public subnets, and SG; exports `alb_dns_name` and `target_group_arn`.

#### 5. Compute & Auto Scaling (`modules/asg/`)
- **`main.tf`**:
  - `aws_iam_role` & `aws_iam_instance_profile`: Attaches:
    - `AmazonSSMManagedInstanceCore`: Enables AWS Systems Manager Session Manager (secure terminal access without open SSH port 22 or bastion hosts).
    - `AmazonEC2ContainerRegistryReadOnly`: Allows EC2 instances to authenticate and pull Docker images from AWS ECR.
  - `aws_launch_template`:
    - Specifies AMI (Amazon Linux 2023 or Ubuntu 22.04 LTS) and EC2 instance type.
    - Enforces **IMDSv2** (`http_tokens = "required"`, `http_put_response_hop_limit = 1`) for cloud security compliance.
    - Injects base64-encoded `user_data.sh.tpl`.
  - `aws_autoscaling_group`:
    - Configured with `min_size = 2`, `max_size = 4`, and `desired_capacity = 2`.
    - Spans the 2 private app subnets across distinct AZs for high availability.
    - Integrated with the ALB target group using `health_check_type = "ELB"` and `health_check_grace_period = 300`.
    - `instance_refresh`: Automatically performs rolling zero-downtime instance recycling whenever the Launch Template changes (e.g. updating container versions).
- **`templates/user_data.sh.tpl`**:
  - Startup cloud-init script:
    1. Installs Docker Engine and AWS CLI.
    2. Logs into AWS ECR using instance IAM credentials (`aws ecr get-login-password`).
    3. Pulls application image(s) from ECR.
    4. Runs container(s) with restart policies and binds application ports.
- **`variables.tf` & `outputs.tf`**: Manages instance sizing, capacity limits, and exports the ASG name.

#### 6. Database (`modules/rds/`)
- **`main.tf`**:
  - `aws_db_subnet_group`: Groups the private DB subnets across 2 AZs.
  - `random_password`: Generates a high-entropy master database password automatically.
  - `aws_secretsmanager_secret` & version: Stores the generated database credentials securely in AWS Secrets Manager.
  - `aws_db_instance`:
    - Engine: PostgreSQL (e.g., version 15) or MySQL (version 8.0).
    - `multi_az = true`: Provisions an active primary in AZ-a and a synchronous standby replica in AZ-b with automatic failover.
    - `storage_encrypted = true`: Enables KMS storage encryption at rest.
    - `publicly_accessible = false`: Completely isolated from the internet.
    - `deletion_protection = true` & `skip_final_snapshot = false`: Production safety guardrails.
- **`variables.tf` & `outputs.tf`**: Configures database engine, instance sizing, and exports the RDS endpoint and secret ARN.

---

### C. Environments (`terraform/environments/dev/` and `prod/`)

- **`backend.tf`**: Connects to the bootstrap remote state:
  ```hcl
  terraform {
    backend "s3" {
      bucket         = "client-project-tfstate-123456789012"
      key            = "prod/terraform.tfstate"  # Or "dev/terraform.tfstate"
      region         = "us-east-1"
      dynamodb_table = "client-project-tfstate-locks"
      encrypt        = true
    }
  }
  ```
- **`providers.tf`**: Configures the AWS provider and enforces **Default Tags** across all resources:
  ```hcl
  provider "aws" {
    region = var.aws_region

    default_tags {
      tags = {
        Project     = "FoodOrderingApp"
        Environment = var.environment
        ManagedBy   = "Terraform"
      }
    }
  }
  ```
- **`main.tf`**: The orchestrator root module calling `vpc`, `security`, `ecr`, `alb`, `asg`, and `rds`, wiring module outputs into downstream module inputs.
- **`variables.tf`**: Declares variable names and types for that specific environment.
- **`terraform.tfvars`**: Concrete parameters:
  - **Dev**: `instance_type = "t3.micro"`, `single_nat_gateway = true`, `multi_az_rds = false` (cost-optimized).
  - **Prod**: `instance_type = "t3.small"`, `single_nat_gateway = false` (2 NAT GWs across AZs), `multi_az_rds = true` (fault-tolerant).
- **`outputs.tf`**: Displays the final ALB DNS URL, ECR registry URL, and RDS host.

---

## 🚀 4. Step-by-Step Deployment Runbook

### Phase 1: Deploy Remote State Backend (One-Time Setup)

```bash
cd terraform/bootstrap

# Initialize and create S3 bucket + DynamoDB table
terraform init
terraform plan -out=tfplan
terraform apply tfplan

# Note the output bucket and DynamoDB table names
```

Update `environments/dev/backend.tf` and `environments/prod/backend.tf` with the S3 bucket and DynamoDB table names from the bootstrap output.

---

### Phase 2: Build & Push Docker Image to ECR

Before the EC2 instances launch, build and push your application image to ECR so the instances can pull the container on boot:

```bash
# Authenticate local Docker daemon to AWS ECR
aws ecr get-login-password --region <region> | docker login --username AWS --password-stdin <account_id>.dkr.ecr.<region>.amazonaws.com

# Build and tag application image
docker build -t <account_id>.dkr.ecr.<region>.amazonaws.com/food-order-api:latest ./backend

# Push image
docker push <account_id>.dkr.ecr.<region>.amazonaws.com/food-order-api:latest
```

---

### Phase 3: Deploy the 3-Tier Infrastructure

```bash
cd terraform/environments/dev   # Or terraform/environments/prod

# Initialize with remote S3 backend and DynamoDB locking
terraform init

# Review changes
terraform plan -out=tfplan

# Apply infrastructure
terraform apply tfplan
```

---

### Phase 4: Verification & Operations

1. **Verify Web Traffic**:
   Copy the `alb_dns_url` from the Terraform outputs and verify in your browser or via curl:
   ```bash
   curl -I http://<alb-dns-name>/api/v1
   ```
2. **Access Instances via AWS Systems Manager (No SSH Key needed)**:
   ```bash
   # List active instances in the ASG
   aws ec2 describe-instances --filters "Name=tag:aws:autoscaling:groupName,Values=<asg-name>" --query "Reservations[*].Instances[*].InstanceId" --output text

   # Start an interactive shell session without port 22 open
   aws ssm start-session --target <instance-id>
   ```

---

## 🛡️ 5. Senior Cloud Engineer Best Practices & Guardrails

1. **Security Group Chaining**:
   Never use open CIDR blocks (`0.0.0.0/0`) between tiers. Ingress rules must reference `source_security_group_id`:
   - ALB SG allows traffic from the internet (`0.0.0.0/0`).
   - App EC2 SG allows traffic **only** from the ALB SG.
   - RDS DB SG allows traffic **only** from the App EC2 SG.
2. **Zero SSH / Bastionless Management**:
   Never create AWS key pairs or open port 22 in security groups. Using `AmazonSSMManagedInstanceCore` allows full CLI and console access through AWS Systems Manager, logged to CloudTrail.
3. **IMDSv2 Enforcement**:
   All Launch Templates configure `http_tokens = "required"` and `http_put_response_hop_limit = 1` to prevent SSRF vulnerabilities from accessing EC2 instance metadata.
4. **Accidental Destruction Protection**:
   Protect state and database resources from accidental deletion:
   ```hcl
   lifecycle {
     prevent_destroy = true
   }
   ```
5. **Cost vs High-Availability Optimization**:
   - NAT Gateways cost ~$32/month each plus data processing fees.
   - For **Development/Staging**, set `single_nat_gateway = true` to share 1 NAT Gateway across both AZs (saves ~$384/year).
   - For **Production**, set `single_nat_gateway = false` so each AZ has its own independent NAT Gateway, ensuring complete AZ fault isolation.
6. **Secrets Handling**:
   Never commit `.tfvars` files containing plaintext passwords to version control. Passwords should be generated via Terraform `random_password`, stored in AWS Secrets Manager, and read by the application at startup.
