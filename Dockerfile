# Bun-based container for the prompt template platform
FROM oven/bun:1.1.4
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Install dependencies
COPY package.json package-lock.json tsconfig.json ./
# Ensure postinstall scripts are available during bun install
COPY scripts ./scripts
RUN bun install

# Copy source code and assets
COPY src ./src
COPY data ./data
COPY public ./public

# Prepare assets
RUN bun run prepare-assets

EXPOSE 3000
CMD ["bun", "src/server.ts"]
