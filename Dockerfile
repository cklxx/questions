# Multi-stage Bun-based container for the prompt template platform
FROM oven/bun:1.1.4 AS deps
WORKDIR /app

# Install dependencies first to leverage caching
COPY package.json package-lock.json tsconfig.json ./
RUN bun install

FROM deps AS build
COPY src ./src
COPY data ./data
COPY public ./public
RUN bun run build

FROM oven/bun:1.1.4 AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./package.json
COPY --from=deps /app/tsconfig.json ./tsconfig.json
COPY --from=build /app/dist ./dist
COPY --from=build /app/public ./public
COPY --from=build /app/data ./data

EXPOSE 3000
CMD ["bun", "run", "start:bun"]
