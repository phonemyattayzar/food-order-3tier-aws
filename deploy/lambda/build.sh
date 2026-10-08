#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

BUILD_DIR="$ROOT_DIR/build"
PACKAGE_DIR="$BUILD_DIR/lambda-package"
rm -rf "$PACKAGE_DIR" "$BUILD_DIR/frontend-dist" "$BUILD_DIR/lambda.zip" "$BUILD_DIR/deployment-bundle.tar.gz"
mkdir -p "$PACKAGE_DIR" "$BUILD_DIR"

python3 -m pip install \
  --platform manylinux2014_x86_64 \
  --implementation cp \
  --python-version 3.12 \
  --only-binary=:all: \
  --upgrade \
  -r deploy/lambda/requirements.txt \
  -t "$PACKAGE_DIR"
cp -R backend/app "$PACKAGE_DIR/app"
cp -R backend/alembic "$PACKAGE_DIR/migrations"
find "$PACKAGE_DIR/migrations" -type d -name __pycache__ -prune -exec rm -rf {} +
find "$PACKAGE_DIR/migrations" -type f -name '*.pyc' -delete
cp backend/alembic.ini lambda_handler.py migrate_handler.py "$PACKAGE_DIR/"
(cd "$PACKAGE_DIR" && zip -qr "$BUILD_DIR/lambda.zip" .)

npm --prefix frontend ci
VITE_API_BASE=/api/v1 npm --prefix frontend run build
cp -R frontend/dist "$BUILD_DIR/frontend-dist"
(cd "$BUILD_DIR" && tar -czf deployment-bundle.tar.gz lambda.zip frontend-dist)
