# ─────────────────────────────────────────────────────────────────────────────
# LaunchBase Platform — Multi-stage production Dockerfile
# ─────────────────────────────────────────────────────────────────────────────

# Stage 1: Dependencies
FROM node:20-slim AS deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.4.1 --activate
COPY package.json pnpm-lock.yaml ./
COPY patches/ ./patches/
RUN pnpm install --frozen-lockfile --prod=false

# Stage 2: Build
FROM node:20-slim AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.4.1 --activate
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm run build

# Stage 3: Production runtime
FROM node:20-slim AS runtime
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.4.1 --activate

# Security: run as non-root user
RUN groupadd -r appuser && useradd -r -g appuser -d /app appuser

# Copy only what's needed for production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./
COPY --from=build /app/server/contracts/*.json ./server/contracts/
COPY --from=build /app/server/contracts/*.json ./dist/

# Create artifacts directory
RUN mkdir -p /app/artifacts && chown -R appuser:appuser /app

USER appuser

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/healthz').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000

CMD ["node", "dist/index.js"]
