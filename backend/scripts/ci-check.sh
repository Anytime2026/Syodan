#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

find_python() {
  for cmd in python3.12 python3.11 python3; do
    if command -v "$cmd" >/dev/null 2>&1; then
      if "$cmd" -c 'import sys; exit(0 if sys.version_info >= (3, 12) else 1)' 2>/dev/null; then
        echo "$cmd"
        return 0
      fi
    fi
  done
  return 1
}

PYTHON="$(find_python)" || {
  echo "ERROR: Python 3.12+ required (CI uses 3.12)."
  echo "Install: brew install python@3.12"
  exit 1
}

echo "==> Using $PYTHON ($("$PYTHON" --version))"
echo "==> pip install"
"$PYTHON" -m pip install -q -r requirements.txt -r requirements-dev.txt

echo "==> pytest"
APP_ENV=test \
DATABASE_URL=sqlite+aiosqlite:// \
AWS_STUB_MODE=true \
HULFT_STUB_MODE=true \
INTERNAL_API_KEY=test-internal-key \
CORS_ORIGINS=http://localhost:5173 \
"$PYTHON" -m pytest tests/ -q

echo "Backend CI checks passed."
