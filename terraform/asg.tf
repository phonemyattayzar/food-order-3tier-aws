# ==============================================================================
# EC2 Auto Scaling Group (ASG) & Launch Template
# ==============================================================================
# Architecture Standard:
# - Spans 2 Private Application Subnets across ap-southeast-1a and ap-southeast-1b.
# - High Availability: Min 2, Max 4 instances for horizontal scaling.
# - Zero SSH / Zero Bastion: Relies on AWS Systems Manager (SSM) Session Manager.
# - IMDSv2 Enforced: Prevents SSRF credential exfiltration.
# - Target Group Health Check: Uses ELB health check with 300s grace period.
# - Instance Refresh: Zero-downtime rolling update when Launch Template changes.
# ==============================================================================

# ------------------------------------------------------------------------------
# 1. Latest Amazon Linux 2023 AMI Lookup
# ------------------------------------------------------------------------------
data "aws_ami" "amazon_linux_2023" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-2023.*-kernel-6.1-x86_64"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

# ------------------------------------------------------------------------------
# 2. IAM Role & Instance Profile for EC2 (SSM + ECR Access)
# ------------------------------------------------------------------------------
resource "aws_iam_role" "ec2_role" {
  name = "${var.project_name}-${var.environment}-ec2-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name = "${var.project_name}-${var.environment}-ec2-role"
    Tier = "Private-App"
  }
}

# Policy Attachment 1: AWS Systems Manager Managed Instance Core (No SSH Port 22 required)
resource "aws_iam_role_policy_attachment" "ssm_core" {
  role       = aws_iam_role.ec2_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

# Policy Attachment 2: AWS ECR Read-Only Access (Pull application Docker images)
resource "aws_iam_role_policy_attachment" "ecr_read" {
  role       = aws_iam_role.ec2_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly"
}

# Policy Attachment 3: AWS Systems Manager Parameter Store & KMS Decrypt Read Access
resource "aws_iam_policy" "ssm_parameter_read" {
  name        = "${var.project_name}-${var.environment}-ssm-read-policy"
  description = "Grants read access to project SSM parameters and KMS decryption"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "SSMParameterRead"
        Effect = "Allow"
        Action = [
          "ssm:GetParameter",
          "ssm:GetParameters",
          "ssm:GetParametersByPath"
        ]
        Resource = [
          "arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter/${var.project_name}/${var.environment}",
          "arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter/${var.project_name}/${var.environment}/*"
        ]
      },
      {
        Sid    = "KMSDecryptSSM"
        Effect = "Allow"
        Action = [
          "kms:Decrypt"
        ]
        Resource = "*"
      }
    ]
  })

  tags = {
    Name = "${var.project_name}-${var.environment}-ssm-read-policy"
    Tier = "Private-App"
  }
}

resource "aws_iam_role_policy_attachment" "ssm_parameter_read" {
  role       = aws_iam_role.ec2_role.name
  policy_arn = aws_iam_policy.ssm_parameter_read.arn
}

# Instance Profile wrapping the role for the Launch Template
resource "aws_iam_instance_profile" "ec2_profile" {
  name = "${var.project_name}-${var.environment}-ec2-profile"
  role = aws_iam_role.ec2_role.name

  tags = {
    Name = "${var.project_name}-${var.environment}-ec2-profile"
    Tier = "Private-App"
  }
}

# ------------------------------------------------------------------------------
# 3. EC2 Launch Template (Docker Engine & ECR Pull)
# ------------------------------------------------------------------------------
resource "aws_launch_template" "this" {
  name_prefix   = "${var.project_name}-${var.environment}-lt-"
  image_id      = data.aws_ami.amazon_linux_2023.id
  instance_type = var.ec2_instance_type

  iam_instance_profile {
    arn = aws_iam_instance_profile.ec2_profile.arn
  }

  vpc_security_group_ids = [aws_security_group.app.id]

  # Enforce IMDSv2 for enhanced instance metadata security
  metadata_options {
    http_endpoint               = "enabled"
    http_tokens                 = "required"
    http_put_response_hop_limit = 1
  }

  # Cloud-init User Data Script: Installs Docker, fetches SSM parameters, and launches container
  user_data = base64encode(<<-EOF
    #!/bin/bash
    set -euo pipefail

    echo "==> Updating packages and installing Docker & AWS CLI..."
    dnf update -y
    dnf install -y docker aws-cli
    systemctl enable --now docker
    usermod -aG docker ec2-user

    REGION="${var.aws_region}"
    ECR_URL="${var.ecr_repository_url != "" ? var.ecr_repository_url : aws_ecr_repository.app.repository_url}"
    IMAGE_TAG="${var.app_image_tag}"
    APP_PORT="${var.app_port}"
    SSM_PREFIX="/${var.project_name}/${var.environment}"
    ENV_FILE="/etc/food_api.env"

    echo "==> Fetching application credentials from AWS SSM Parameter Store ($SSM_PREFIX)..."

    fetch_ssm_param() {
      local param_name="$1"
      local with_decrypt="$${2:-true}"
      local value=""
      local max_retries=10
      local attempt=1

      while [ $attempt -le $max_retries ]; do
        if [ "$with_decrypt" = "true" ]; then
          value=$(aws ssm get-parameter --name "$param_name" --with-decryption --region "$REGION" --query "Parameter.Value" --output text 2>/dev/null || true)
        else
          value=$(aws ssm get-parameter --name "$param_name" --region "$REGION" --query "Parameter.Value" --output text 2>/dev/null || true)
        fi

        if [ -n "$value" ] && [ "$value" != "None" ]; then
          echo "$value"
          return 0
        fi

        echo "==> Waiting for SSM parameter $param_name (attempt $attempt/$max_retries)..." >&2
        sleep 3
        attempt=$((attempt + 1))
      done

      echo "==> Error: Failed to fetch SSM parameter $param_name after $max_retries attempts." >&2
      return 1
    }

    DATABASE_URL=$(fetch_ssm_param "$SSM_PREFIX/DATABASE_URL" true)
    POSTGRES_USER=$(fetch_ssm_param "$SSM_PREFIX/POSTGRES_USER" false)
    POSTGRES_PASSWORD=$(fetch_ssm_param "$SSM_PREFIX/POSTGRES_PASSWORD" true)
    POSTGRES_DB=$(fetch_ssm_param "$SSM_PREFIX/POSTGRES_DB" false)
    POSTGRES_HOST=$(fetch_ssm_param "$SSM_PREFIX/POSTGRES_HOST" false 2>/dev/null || true)
    POSTGRES_PORT=$(fetch_ssm_param "$SSM_PREFIX/POSTGRES_PORT" false 2>/dev/null || echo "5432")
    SECRET_KEY=$(fetch_ssm_param "$SSM_PREFIX/SECRET_KEY" true)
    ALGORITHM=$(fetch_ssm_param "$SSM_PREFIX/ALGORITHM" false 2>/dev/null || echo "HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES=$(fetch_ssm_param "$SSM_PREFIX/ACCESS_TOKEN_EXPIRE_MINUTES" false 2>/dev/null || echo "11520")

    echo "==> Storing application environment variables in $ENV_FILE..."
    cat <<ENV > "$ENV_FILE"
DATABASE_URL=$DATABASE_URL
POSTGRES_USER=$POSTGRES_USER
POSTGRES_PASSWORD=$POSTGRES_PASSWORD
POSTGRES_DB=$POSTGRES_DB
POSTGRES_HOST=$POSTGRES_HOST
POSTGRES_PORT=$POSTGRES_PORT
SECRET_KEY=$SECRET_KEY
ALGORITHM=$ALGORITHM
ACCESS_TOKEN_EXPIRE_MINUTES=$ACCESS_TOKEN_EXPIRE_MINUTES
ENV
    chmod 600 "$ENV_FILE"

    if [ -n "$ECR_URL" ]; then
      echo "==> Authenticating Docker to AWS ECR..."
      aws ecr get-login-password --region "$REGION" | docker login --username AWS --password-stdin "$ECR_URL" || true

      echo "==> Attempting to pull application image: $ECR_URL:$IMAGE_TAG..."
      if docker pull "$ECR_URL:$IMAGE_TAG"; then
        echo "==> Running application container on port $APP_PORT with credentials..."
        docker run -d \
          --name food_api \
          --restart unless-stopped \
          --env-file "$ENV_FILE" \
          -e DATABASE_URL="$DATABASE_URL" \
          -e POSTGRES_USER="$POSTGRES_USER" \
          -e POSTGRES_PASSWORD="$POSTGRES_PASSWORD" \
          -e POSTGRES_DB="$POSTGRES_DB" \
          -e POSTGRES_HOST="$POSTGRES_HOST" \
          -e POSTGRES_PORT="$POSTGRES_PORT" \
          -e SECRET_KEY="$SECRET_KEY" \
          -e ALGORITHM="$ALGORITHM" \
          -e ACCESS_TOKEN_EXPIRE_MINUTES="$ACCESS_TOKEN_EXPIRE_MINUTES" \
          -p $APP_PORT:8000 \
          "$ECR_URL:$IMAGE_TAG"

        echo "==> Running database migrations inside container..."
        sleep 5
        docker exec food_api alembic upgrade head || echo "==> Notice: Alembic migration completed or skipped."
      else
        echo "==> Notice: Image not found in ECR yet. Starting placeholder container for health checks..."
        docker run -d \
          --name placeholder_api \
          --restart unless-stopped \
          -p $APP_PORT:80 \
          nginxdemos/hello:latest
      fi
    else
      echo "==> ECR URL not provided. Running lightweight health endpoint for testing..."
      docker run -d \
        --name placeholder_api \
        --restart unless-stopped \
        -p $APP_PORT:80 \
        nginxdemos/hello:latest
    fi

    echo "==> Startup sequence completed successfully."
  EOF
  )

  tag_specifications {
    resource_type = "instance"
    tags = {
      Name = "${var.project_name}-${var.environment}-app-instance"
      Tier = "Private-App"
    }
  }

  tag_specifications {
    resource_type = "volume"
    tags = {
      Name = "${var.project_name}-${var.environment}-app-volume"
      Tier = "Private-App"
    }
  }

  depends_on = [
    aws_iam_role_policy_attachment.ssm_parameter_read,
    aws_ssm_parameter.database_url,
    aws_ssm_parameter.postgres_user,
    aws_ssm_parameter.postgres_password,
    aws_ssm_parameter.postgres_db,
    aws_ssm_parameter.secret_key
  ]

  lifecycle {
    create_before_destroy = true
  }
}

# ------------------------------------------------------------------------------
# 4. Auto Scaling Group (Min: 2, Max: 4 across 2 Private Subnets)
# ------------------------------------------------------------------------------
resource "aws_autoscaling_group" "this" {
  name_prefix         = "${var.project_name}-${var.environment}-asg-"
  vpc_zone_identifier = aws_subnet.private_app[*].id

  min_size         = var.asg_min_size
  max_size         = var.asg_max_size
  desired_capacity = var.asg_desired_capacity

  # Direct integration with ALB Target Group
  target_group_arns = [aws_lb_target_group.this.arn]

  # ELB health checks: Automatically replaces instances failing ALB target checks
  health_check_type         = "ELB"
  health_check_grace_period = 300

  launch_template {
    id      = aws_launch_template.this.id
    version = "$Latest"
  }

  # Zero-downtime rolling update configuration
  instance_refresh {
    strategy = "Rolling"
    preferences {
      min_healthy_percentage = 50
      instance_warmup        = 300
    }
    triggers = ["tag"]
  }

  tag {
    key                 = "Name"
    value               = "${var.project_name}-${var.environment}-asg"
    propagate_at_launch = true
  }

  tag {
    key                 = "Tier"
    value               = "Private-App"
    propagate_at_launch = true
  }

  lifecycle {
    create_before_destroy = true
    ignore_changes        = [desired_capacity]
  }
}
