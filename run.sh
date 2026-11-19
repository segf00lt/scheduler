#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if ! command -v npm >/dev/null 2>&1; then
  echo "Error: npm is required to build and run the web app." >&2
  exit 1
fi

if [[ ! -x "$ROOT_DIR/front/node_modules/.bin/vite" ]]; then
  echo "Front end dependencies are missing. Run 'npm run web:install' first." >&2
  exit 1
fi

echo "Building front end..."
npm --prefix "$ROOT_DIR/front" run build

echo "Starting the web app (Vite also hosts the scheduler API)..."
npm --prefix "$ROOT_DIR/front" run dev -- --host 0.0.0.0 &
FRONTEND_PID=$!

cleanup() {
  kill "$FRONTEND_PID" 2>/dev/null || true
  wait "$FRONTEND_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

wait "$FRONTEND_PID"
