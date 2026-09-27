.DEFAULT_GOAL := help
SHELL := /bin/bash

# Determine VERSION from git tag or short commit hash, default to 'dev'
VERSION ?= $(shell git describe --tags --exact-match 2>/dev/null || git rev-parse --short HEAD 2>/dev/null || echo "dev")

.PHONY: help dev build build-api build-ui test clean

help: ## Show available commands
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'

dev: ## Run local development environment (with hot reload)
	docker compose up --build

build: build-api build-ui ## Build all Docker images (VERSION=...)
	@printf "\nSuccessfully built images for version: %s\n" "$(VERSION)"
	@docker images --filter "reference=food-api:$(VERSION)" --filter "reference=food-ui:$(VERSION)" --format "  {{.Repository}}:{{.Tag}} ({{.Size}})"

build-api: ## Build backend API Docker image
	@printf "Building food-api:%s...\n" "$(VERSION)"
	docker build \
	  -t "food-api:$(VERSION)" \
	  -t "food-api:latest" \
	  ./backend

build-ui: ## Build frontend UI Docker image
	@printf "Building food-ui:%s...\n" "$(VERSION)"
	docker build \
	  -t "food-ui:$(VERSION)" \
	  -t "food-ui:latest" \
	  ./frontend

test: ## Run test suite / code validation
	python3 -m compileall ./backend/app

clean: ## Remove dangling docker build images and cache
	docker image prune -f
