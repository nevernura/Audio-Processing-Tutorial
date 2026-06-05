#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 is required but was not found on PATH." >&2
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is required but was not found on PATH." >&2
  exit 1
fi

echo "Using Node: $(node --version 2>/dev/null || echo 'node not found')"
echo "Using npm: $(npm --version)"
echo "Using Python: $(python3 --version)"

echo "Installing npm dependencies..."
npm install

echo "Installing Python audio dependencies..."
python3 -m pip install --user -r requirements.txt

echo "Running validation checks..."
npm run typecheck
npm run check:python
npm run build

echo "Development environment is ready."
