#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [ "${1:-}" != "--confirm-synthetic-reset" ]; then
  echo 'DEVELOPMENT ONLY: pass --confirm-synthetic-reset to erase this Compose project synthetic volumes.'
  exit 1
fi
docker compose down --volumes
