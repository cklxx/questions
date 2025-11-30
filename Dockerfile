# Node-based container for the prompt template platform
ARG NODE_IMAGE=node:22-alpine
FROM ${NODE_IMAGE}

WORKDIR /app

ARG NPM_REGISTRY=https://registry.npmmirror.com
ENV NODE_ENV=production
ENV PORT=80
ENV NPM_CONFIG_REGISTRY=$NPM_REGISTRY

# Install dependencies (including dev deps for tsx runtime)
COPY package.json package-lock.json tsconfig.json ./
COPY scripts ./scripts
RUN npm ci

# Copy source code and assets
COPY src ./src
COPY data ./data
COPY public ./public

# Prepare vendor assets for the public build
RUN npm run prepare-assets

EXPOSE 80

CMD ["npm", "run", "start:node"]
