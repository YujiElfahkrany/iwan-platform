#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$ROOT_DIR/.env.local"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Error: .env.local not found at $ROOT_DIR"
  exit 1
fi

echo "Using: $(grep '^MONGODB_URI=' "$ENV_FILE" | sed 's/=.*@/=***@/')"
echo ""

node --env-file="$ENV_FILE" "$SCRIPT_DIR/seed.mjs"
