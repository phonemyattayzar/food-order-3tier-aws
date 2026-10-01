# ==============================================================================
# AWS Provider & Remote State Backend Configuration
# ==============================================================================
# Architecture Standard:
# - Enforces minimum Terraform and AWS provider versions for syntax stability.
# - Stores state remotely in an S3 bucket with server-side encryption enabled.
# - Leverages DynamoDB for distributed state locking to prevent race conditions.
# - Injects standard organizational tags across all provisioned AWS resources.
# ==============================================================================

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.5"
    }
  }

  # ----------------------------------------------------------------------------
  # Remote State Backend (S3 + DynamoDB)
  # ----------------------------------------------------------------------------
  # Note: The S3 bucket and DynamoDB table must be created prior to initializing
  # this backend. You can supply backend values via a backend config file or CLI:
  # terraform init -backend-config="bucket=<your-bucket>" ...
  # ----------------------------------------------------------------------------
  backend "s3" {
    bucket         = "food-order-tfstate-ap-southeast-1"
    key            = "networking/terraform.tfstate"
    region         = "ap-southeast-1"
    dynamodb_table = "food-order-tflocks"
    encrypt        = true
  }
}

# ------------------------------------------------------------------------------
# Primary AWS Provider Configuration
# ------------------------------------------------------------------------------
provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "Terraform"
      Tier        = "Networking"
    }
  }
}
