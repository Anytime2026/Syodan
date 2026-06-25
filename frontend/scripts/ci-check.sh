#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

# CI_FIX=0 で自動修正を無効化（GitHub Actions と同じ厳格チェックのみ）
AUTO_FIX="${CI_FIX:-1}"

run_format_check() {
  npm run format:check
}

run_lint() {
  npm run lint
}

echo "==> npm ci"
npm ci

echo "==> format:check"
if ! run_format_check; then
  if [[ "$AUTO_FIX" == "1" ]]; then
    echo "==> format:check failed; auto-fixing with prettier --write"
    npm run format
    run_format_check
  else
    exit 1
  fi
fi

echo "==> lint"
if ! run_lint; then
  if [[ "$AUTO_FIX" == "1" ]]; then
    echo "==> lint failed; auto-fixing with eslint --fix"
    npx eslint . --fix
    run_lint
  else
    exit 1
  fi
fi

echo "Frontend CI checks passed."
