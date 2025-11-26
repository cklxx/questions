#!/usr/bin/env bash
set -euo pipefail

APP_PORT=${PORT:-3000}
export PORT="$APP_PORT"

echo "[start] Starting Bun server on port ${APP_PORT}..."
bun src/server.ts &
BUN_PID=$!
NGINX_PID=""

cleanup() {
  echo "[start] Caught signal, shutting down..."
  kill "$BUN_PID" >/dev/null 2>&1 || true
  if [[ -n "$NGINX_PID" ]]; then
    kill "$NGINX_PID" >/dev/null 2>&1 || true
  fi
}

trap cleanup SIGTERM SIGINT

echo "[start] Launching nginx reverse proxy on port 80..."
nginx -g 'daemon off;' &
NGINX_PID=$!

wait -n "$BUN_PID" "$NGINX_PID"
