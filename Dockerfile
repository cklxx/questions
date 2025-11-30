# Node-based container for the prompt template platform
# Allow the base image to be overridden (e.g., use Tencent Cloud mirror in China)
ARG NODE_IMAGE=node:22-alpine
FROM ${NODE_IMAGE}

WORKDIR /app

ARG NPM_REGISTRY=https://registry.npmmirror.com
ENV PORT=80
ENV NPM_CONFIG_REGISTRY=$NPM_REGISTRY

# Install dependencies (including dev) so tsx is available for the Node entrypoint
COPY package.json package-lock.json tsconfig.json ./
COPY scripts ./scripts
RUN npm ci --include=dev

# Copy source code and assets
COPY src ./src
COPY data ./data
COPY public ./public

# Prepare vendor assets for the public build
RUN bun run prepare-assets

ENV NODE_ENV=production
EXPOSE 80

CMD ["bun", "start"]
