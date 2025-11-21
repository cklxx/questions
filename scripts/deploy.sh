#!/usr/bin/env bash
set -euo pipefail

IMAGE_NAME=${IMAGE_NAME:-prompt-template-platform}
CONTAINER_NAME=${CONTAINER_NAME:-prompt-template-platform}
PORT=${PORT:-3000}

command_exists() {
  command -v "$1" >/dev/null 2>&1
}

start_with_docker() {
  echo "[deploy] Docker detected. Building image '${IMAGE_NAME}'..."
  docker build -t "$IMAGE_NAME" .

  if docker ps -a --format '{{.Names}}' | grep -Eq "^${CONTAINER_NAME}$"; then
    echo "[deploy] Removing existing container '${CONTAINER_NAME}'..."
    docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
  fi

  echo "[deploy] Starting container '${CONTAINER_NAME}' on port ${PORT}..."
  docker run -d --name "$CONTAINER_NAME" -e PORT="$PORT" -p "${PORT}:${PORT}" "$IMAGE_NAME"
  echo "[deploy] Done. Service should be reachable at http://localhost:${PORT}"
}

start_with_bun() {
  if ! command_exists bun; then
    echo "[deploy] Neither Docker nor Bun is available. Please install one of them to deploy." >&2
    exit 1
  fi

  echo "[deploy] Docker not found; falling back to Bun local run."
  echo "[deploy] Installing dependencies..."
  bun install

  echo "[deploy] Building TypeScript..."
  PORT="$PORT" bun run build

  echo "[deploy] Starting server directly from TypeScript via Bun (Ctrl+C to stop)..."
  PORT="$PORT" bun run start:bun:ts
}

main() {
  if command_exists docker; then
    start_with_docker
  else
    start_with_bun
  fi
}

main "$@"
