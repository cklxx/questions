#!/usr/bin/env bash
set -euo pipefail

IMAGE_NAME=${IMAGE_NAME:-prompt-template-platform}
CONTAINER_NAME=${CONTAINER_NAME:-prompt-template-platform}
APP_PORT=${APP_PORT:-3000}
HOST_PORT=${HOST_PORT:-80}

command_exists() {
  command -v "$1" >/dev/null 2>&1
}

start_with_docker() {
  echo "[deploy] Docker detected. Building image '${IMAGE_NAME}'..."
  local npm_registry
  local node_image
  npm_registry=${NPM_REGISTRY:-https://registry.npmmirror.com}

  choose_node_image() {
    if [ -n "${NODE_IMAGE:-}" ]; then
      echo "$NODE_IMAGE"
      return
    fi

    # Tencent Cloud Lighthouse provides a built-in Docker Hub mirror
    # (mirror.ccs.tencentyun.com). Prefer it when metadata is reachable.
    if curl -fsS --connect-timeout 2 --max-time 3 http://metadata.tencentyun.com/latest/meta-data/instance-id >/dev/null 2>&1; then
      echo "mirror.ccs.tencentyun.com/library/node:22-alpine"
      return
    fi

    echo "docker.m.daocloud.io/library/node:22-alpine"
  }

  node_image=$(choose_node_image)

  echo "[deploy] Using Node base image '${node_image}'..."

  if ! docker build --build-arg "NPM_REGISTRY=${npm_registry}" --build-arg "NODE_IMAGE=${node_image}" -t "$IMAGE_NAME" .; then
    echo "[deploy] Docker build failed (likely due to network access). Falling back to local runtime." >&2
    return 1
  fi

  if docker ps -a --format '{{.Names}}' | grep -Eq "^${CONTAINER_NAME}$"; then
    echo "[deploy] Removing existing container '${CONTAINER_NAME}'..."
    docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
  fi

  echo "[deploy] Starting container '${CONTAINER_NAME}' (app port ${APP_PORT} -> host port ${HOST_PORT})..."
  docker run -d --name "$CONTAINER_NAME" -e PORT="$APP_PORT" -p "${HOST_PORT}:80" "$IMAGE_NAME"
  echo "[deploy] Done. Service should be reachable at http://localhost:${HOST_PORT}"
}

start_with_local_runtime() {
  local npm_registry
  npm_registry=${NPM_REGISTRY:-https://registry.npmmirror.com}

  echo "[deploy] Using registry '${npm_registry}' for installs..."
  export npm_config_registry="$npm_registry"
  export NPM_CONFIG_REGISTRY="$npm_registry"
  export BUN_INSTALL_REGISTRY="$npm_registry"

  if command_exists bun; then
    echo "[deploy] Docker not found; falling back to Bun local run."

    echo "[deploy] Installing root dependencies..."
    bun install

    echo "[deploy] Installing frontend dependencies..."
    cd frontend && bun install && cd ..

    echo "[deploy] Building frontend..."
    cd frontend && bun run build && cd ..

    echo "[deploy] Preparing assets..."
    PORT="$APP_PORT" bun run prepare-assets

    echo "[deploy] Starting server directly from TypeScript via Bun (Ctrl+C to stop)..."
    PORT="$APP_PORT" bun run start
    return
  fi

  if command_exists npm && command_exists node; then
    echo "[deploy] Docker and Bun not available; using npm + Node fallback."

    echo "[deploy] Installing root dependencies with npm..."
    npm install

    echo "[deploy] Installing frontend dependencies with npm..."
    npm --prefix frontend install

    echo "[deploy] Building frontend with npm..."
    npm run build:node

    echo "[deploy] Preparing assets..."
    PORT="$APP_PORT" npm run prepare-assets

    echo "[deploy] Starting server via ts-node (Ctrl+C to stop)..."
    PORT="$APP_PORT" npm run start:node
    return
  fi

  echo "[deploy] Docker, Bun, and npm are unavailable. Please install one of them to deploy." >&2
  exit 1
}

main() {
  if command_exists docker; then
    if ! start_with_docker; then
      start_with_local_runtime
    fi
  else
    start_with_local_runtime
  fi
}

main "$@"
