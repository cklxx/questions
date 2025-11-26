# Bun-based container for the prompt template platform
ARG BUN_IMAGE=oven/bun:1.1.4
FROM ${BUN_IMAGE}

WORKDIR /app

ARG DEBIAN_MIRROR=auto
ARG NPM_REGISTRY=https://registry.npmmirror.com

ENV NODE_ENV=production
ENV PORT=3000
ENV NPM_CONFIG_REGISTRY=$NPM_REGISTRY
ENV BUN_INSTALL_REGISTRY=$NPM_REGISTRY

RUN set -eux; \
  MIRROR="$DEBIAN_MIRROR"; \
  if [ "$MIRROR" = "auto" ]; then \
    if command -v curl >/dev/null 2>&1; then \
      if curl -fsSL --connect-timeout 3 --max-time 5 http://mirrors.aliyun.com/debian/dists/bookworm/Release >/dev/null; then \
        MIRROR=mirrors.aliyun.com; \
      else \
        MIRROR=deb.debian.org; \
      fi; \
    elif command -v wget >/dev/null 2>&1; then \
      if wget -q --timeout=5 --tries=1 --spider http://mirrors.aliyun.com/debian/dists/bookworm/Release; then \
        MIRROR=mirrors.aliyun.com; \
      else \
        MIRROR=deb.debian.org; \
      fi; \
    else \
      MIRROR=deb.debian.org; \
    fi; \
  fi; \
  sed -i "s@deb.debian.org@${MIRROR}@g" /etc/apt/sources.list; \
  sed -i "s@security.debian.org@${MIRROR}@g" /etc/apt/sources.list; \
  apt-get update; \
  apt-get install -y --no-install-recommends nginx ca-certificates; \
  rm -rf /var/lib/apt/lists/*

# Install dependencies
COPY package.json package-lock.json tsconfig.json ./
# Ensure postinstall scripts are available during bun install
COPY scripts ./scripts
RUN bun install

# Copy source code and assets
COPY src ./src
COPY data ./data
COPY public ./public
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

# Prepare assets
RUN bun run prepare-assets

EXPOSE 80
CMD ["/bin/bash", "-c", "chmod +x /app/scripts/start-with-nginx.sh && /app/scripts/start-with-nginx.sh"]
