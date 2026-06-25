#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "======== Frontend ========"
bash "$ROOT/frontend/scripts/ci-check.sh"

echo ""
echo "======== Backend ========"
bash "$ROOT/backend/scripts/ci-check.sh"

echo ""
echo "All CI checks passed."
