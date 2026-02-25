# LaunchBase Platform

Full-stack platform for small business website generation, deployment, and ongoing management. Express + tRPC backend, React + Vite frontend, MySQL via Drizzle ORM.

## Quick Start

```bash
# 1. Install dependencies
pnpm install

# 2. Copy and fill environment config
cp .env.example .env
# Edit .env — at minimum set DATABASE_URL

# 3. Push schema to database
pnpm db:push

# 4. Start dev server
pnpm dev
```

The app starts at `http://localhost:3000`.

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start dev server with hot reload (tsx watch) |
| `pnpm build` | Build client (Vite) + server (esbuild) |
| `pnpm build:stamped` | Build with GIT_SHA and BUILD_TIME baked in |
| `pnpm start` | Start production server from `dist/` |
| `pnpm check` | TypeScript type-check (no emit) |
| `pnpm test` | Run tests via vitest |
| `pnpm smoke` | Run smoke tests only |
| `pnpm db:push` | Generate + apply database migrations |
| `pnpm format` | Format code with prettier |

## Architecture

```
server/
  _core/
    index.ts       # Express entry point — helmet, CORS, pino, tRPC mount
    env.ts         # Environment validation (crashes on missing required vars)
    trpc.ts        # tRPC router + procedure factories
    logger.ts      # Structured logging (pino)
  db/
    schema.ts      # Drizzle ORM schema (71 tables)
    index.ts       # Connection factory + CRUD helpers
  routers/
    _incoming_routers.ts  # Main tRPC app router (merges all sub-routers)
    admin/                # Admin-only tRPC routers
    mobile/               # Mobile API routers
  routes/
    artifactsRouter.ts    # Express router for binary artifact downloads
  services/               # Business logic (agent health, design, email)
  stripe/                 # Stripe checkout + webhook handling
  security/               # Rate limiting, input sanitization, audit log
  contracts/              # Agent-stack contract handshake system

client/
  src/
    pages/          # React pages (admin dashboard, intake wizard, etc.)
    components/     # Shared UI components (shadcn/ui based)
    hooks/          # React hooks (tRPC client, auth, etc.)

shared/             # Types and contracts shared between client + server
```

## Environment Variables

See `.env.example` for the full list. Required in production:

- `DATABASE_URL` — MySQL connection string
- `JWT_SECRET` — Auth token signing key
- `SESSION_SECRET` — Session cookie signing key
- `MOBILE_ADMIN_SECRET` — Mobile API authentication secret

## Database

MySQL via Drizzle ORM. Schema defined in `server/db/schema.ts`.

```bash
# Generate and apply migrations
pnpm db:push

# Or with drizzle-kit directly
npx drizzle-kit generate   # generate SQL migrations
npx drizzle-kit migrate    # apply pending migrations
```

## Docker

```bash
# Build image
docker build -t launchbase .

# Run with docker-compose (includes MySQL)
docker compose up
```

The Dockerfile uses multi-stage builds, runs as non-root, and includes a health check.

## Security

- **Helmet** — sets CSP, HSTS, X-Frame-Options, X-Content-Type-Options
- **CORS** — locked to `PUBLIC_BASE_URL` in production, permissive in dev
- **Rate limiting** — per-endpoint limits on both tRPC and Express layers
- **Input sanitization** — server/security/inputSanitizer.ts
- **Audit logging** — security events written to `security_audit_log` table
- **Contract handshake** — agent-stack validates schema compatibility before dispatching

## Endpoints

| Path | Type | Description |
|------|------|-------------|
| `/healthz` | GET | Liveness probe |
| `/readyz` | GET | Readiness probe |
| `/api/build-info` | GET | Deployed commit + build time |
| `/api/trpc/*` | tRPC | All application procedures |
| `/api/artifacts/:id` | GET | Download agent-generated artifacts |
| `/api/contracts/handshake` | POST | Agent contract validation |
| `/api/contracts/info` | GET | Current contract definitions |

## License

MIT
