.DEFAULT_GOAL := help
SHELL := /bin/bash

.PHONY: help dev build release clean

help:
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  %-15s %s\n", $$1, $$2}'

dev: ## Run local development setup with docker compose (auto-reload)
	docker compose up --build

build: ## Build versioned Docker images (VERSION auto-detected from git)
	bash scripts/build.sh

release: ## Build images and create a deployable tar.gz archive
	bash scripts/build.sh
	@set -euo pipefail; \
	VERSION=$$(cat .release-version); \
	STAGING="food-order-3tier-$${VERSION}"; \
	rm -rf "$${STAGING}"; \
	mkdir -p "$${STAGING}/docker-images"; \
	cp docker-compose.yml docker-compose.prod.yml .env.template "$${STAGING}/"; \
	cp -r scripts "$${STAGING}/"; \
	cp "docker-images/food-api-$${VERSION}.tar.gz" \
	   "docker-images/food-ui-$${VERSION}.tar.gz" \
	   "$${STAGING}/docker-images/"; \
	tar -czf "food-order-3tier-$${VERSION}.tar.gz" "$${STAGING}"; \
	rm -rf "$${STAGING}"; \
	printf 'Archive: food-order-3tier-%s.tar.gz\n' "$${VERSION}"

clean: ## Remove build artefacts and release packages
	rm -rf docker-images/ .release-version food-order-3tier-*/ food-order-3tier-*.tar.gz
