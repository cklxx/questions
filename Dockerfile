# Bun-based container for the prompt template platform
FROM oven/bun:1.1.4

WORKDIR /app

ARG DEBIAN_MIRROR=mirrors.aliyun.com

ENV NODE_ENV=production
ENV PORT=3000

RUN set -eux; \
  sed -i "s@deb.debian.org@${DEBIAN_MIRROR}@g" /etc/apt/sources.list; \
  sed -i "s@security.debian.org@${DEBIAN_MIRROR}@g" /etc/apt/sources.list; \
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
