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

  # Cloud-init User Data Script: Installs Docker, authenticates to ECR, and launches container
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

    if [ -n "$ECR_URL" ]; then
      echo "==> Authenticating Docker to AWS ECR..."
      aws ecr get-login-password --region "$REGION" | docker login --username AWS --password-stdin "$ECR_URL" || true

      echo "==> Attempting to pull application image: $ECR_URL:$IMAGE_TAG..."
      if docker pull "$ECR_URL:$IMAGE_TAG"; then
        echo "==> Running application container on port $APP_PORT..."
        docker run -d \
          --name food_api \
          --restart unless-stopped \
          -p $APP_PORT:8000 \
          "$ECR_URL:$IMAGE_TAG"
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
