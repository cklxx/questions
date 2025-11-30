# Bun-based container for the prompt template platform
ARG BUN_IMAGE=oven/bun:1-alpine
FROM ${BUN_IMAGE}

WORKDIR /app

ARG NPM_REGISTRY=https://registry.npmmirror.com
ENV NODE_ENV=production
ENV PORT=80
ENV NPM_CONFIG_REGISTRY=$NPM_REGISTRY

# Install dependencies via Bun (uses lockfile and Chinese mirror by default)
COPY package.json bun.lock tsconfig.json ./
COPY scripts ./scripts
RUN bun install --frozen-lockfile --registry=${NPM_REGISTRY}

# Copy source code and assets
COPY src ./src
COPY data ./data
COPY public ./public

# Prepare vendor assets for the public build
RUN bun run prepare-assets

EXPOSE 80

CMD ["bun", "start"]
