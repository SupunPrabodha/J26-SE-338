#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
python3.12 scripts/bootstrap_dev.py
