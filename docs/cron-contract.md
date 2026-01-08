# Cron Endpoint Contract

**Status:** Locked (enforced by Vitest regression tests)  
**Last Updated:** 2026-01-05  
**Context:** Prevents repeat of production incident where cron-job.org received HTML 200 instead of JSON, causing silent failures.

---

## The Three Invariants (Never Break These)

### 1. `/api/*` never returns HTML

**Rule:** Any request under `/api/*` MUST return JSON, never HTML.

**Why:** If API routes fall through to SPA serving, external services (cron jobs, webhooks) receive HTML 200 responses and silently fail.

**Enforcement:**
- API guard in `server/_core/app.ts` (line ~170): `app.all("/api/*", ...)`
- Vitest test: `server/api-routing-guardrails.test.ts`

**What this catches:**
- Misconfigured routing
- SPA fallthrough bugs
- Missing route handlers

---

### 2. `/api/cron/*` is POST-only (except `/health`)

**Rule:** Cron job endpoints MUST use POST. GET requests MUST return 405 JSON with `Allow: POST` header.

**Why:** 
- POST prevents accidental browser prefetch/crawlers from triggering jobs
- Explicit 405 prevents false success (200 HTML from SPA fallthrough)
- Consistent with webhook patterns (Stripe, GitHub, etc.)

**Canonical endpoints:**
- `POST /api/cron/run-next-deploy` - Run next queued deployment
- `POST /api/cron/auto-advance` - Auto-advance stuck applications
- `GET /api/cron/health` - Health check (unauthenticated)

**Authentication:**
- Header: `Authorization: Bearer <WORKER_TOKEN>` OR `x-worker-token: <WORKER_TOKEN>`
- Both formats supported for compatibility

**Enforcement:**
- Route handlers in `server/worker/cronEndpoints.ts`
- Vitest tests verify 405 response for GET requests

---

### 3. `/api/worker/*` returns deprecation headers

**Rule:** Legacy `/api/worker/*` endpoints MUST include deprecation headers until migration is complete.

**Headers:**
```
X-LaunchBase-Deprecated: true
X-LaunchBase-Use: /api/cron/<endpoint>
X-LaunchBase-Removal: after migration
```

**Why:** Provides telemetry to track migration progress and alerts developers using old endpoints.

**Migration plan:**
1. ✅ Add deprecation headers to `/api/worker/*`
2. ✅ Create `/api/cron/*` as canonical endpoints
3. ⏳ Switch cron-job.org to `/api/cron/*`
4. ⏳ Monitor console warnings for 24-48 hours
5. ⏳ Delete `/api/worker/*` routes after zero hits

**Enforcement:**
- Wrapper function in `server/_core/app.ts`: `withDeprecationHeaders()`
- Console warnings logged on every call
- Vitest test verifies headers present even on 401 responses

---

## Implementation Details

### Route Registration Order (Critical)

From `server/_core/app.ts`:

```typescript
1. Stripe webhook (raw body, MUST be first)
2. Global body parsers (express.json, express.urlencoded)
3. Worker endpoints (back-compat with deprecation)
4. Cron endpoints (canonical)
5. Referral redirects
6. OAuth routes
7. tRPC API
8. API guard (MUST be last - catches unmatched /api/*)
```

**Why this order matters:**
- Stripe webhook needs raw body before parsers
- tRPC middleware must run before API guard
- API guard must be last to catch unmatched routes

### API Guard Placement

**Location:** `server/_core/app.ts` (after all route registrations)

```typescript
// CRITICAL: API must never fall through to SPA/static
// Must be AFTER all /api routes + middleware
app.all("/api/*", (_req, res) => {
  res.status(404).json({ ok: false, error: "api_route_not_found" });
});
```

**DO NOT move this to `serveStatic()`** - it's a platform invariant, not a static serving detail.

---

## Testing

### Regression Tests

**File:** `server/api-routing-guardrails.test.ts`

**Tests:**
1. `/api/__does_not_exist__` returns JSON 404 (never HTML)
2. `GET /api/cron/run-next-deploy` returns 405 JSON + Allow header
3. `GET /api/cron/auto-advance` returns 405 JSON + Allow header
4. `POST /api/worker/*` includes deprecation headers
5. `GET /api/cron/health` returns JSON with database status

**Run tests:**
```bash
pnpm test api-routing-guardrails
```

### Manual Verification

Before publishing:

```bash
# Health check (should return JSON 200)
curl https://your-site.manus.space/api/cron/health

# POST to cron endpoint (should return JSON, may be 401 without token)
curl -X POST https://your-site.manus.space/api/cron/run-next-deploy

# GET to cron endpoint (should return 405 JSON with Allow: POST)
curl https://your-site.manus.space/api/cron/run-next-deploy

# Unmatched API route (should return JSON 404, never HTML)
curl https://your-site.manus.space/api/__does_not_exist__
```

---

## Migration Checklist

### For LaunchBase Platform

- [x] Create `/api/cron/*` endpoints
- [x] Add deprecation headers to `/api/worker/*`
- [x] Add Vitest regression tests
- [x] Document cron contract
- [ ] Update cron-job.org to use `/api/cron/*` POST
- [ ] Monitor deprecation warnings for 24-48 hours
- [ ] Delete `/api/worker/*` routes
- [ ] Update this doc to mark migration complete

### For Customer Sites (Future)

When LaunchBase becomes a platform:

1. **Centralized cron:** LaunchBase platform runs ONE cron that checks all customer sites
2. **Customer sites never hold tokens:** Tokens stay in platform, not customer code
3. **Customer sites expose health checks:** Each site provides `/api/cron/health` for platform monitoring
4. **Platform handles retries:** Customer sites don't need their own cron-job.org accounts

---

## Common Mistakes to Avoid

### ❌ DON'T: Add GET endpoints for cron jobs

```typescript
// ❌ BAD: GET allows accidental triggers
app.get("/api/cron/run-deploy", handler);
```

```typescript
// ✅ GOOD: POST-only with explicit 405 for GET
app.post("/api/cron/run-deploy", handler);
app.get("/api/cron/run-deploy", handleMethodNotAllowed);
```

### ❌ DON'T: Return HTML from `/api/*`

```typescript
// ❌ BAD: Falls through to SPA
app.use("*", (req, res) => {
  res.sendFile("index.html");
});
```

```typescript
// ✅ GOOD: API guard before SPA fallback
app.all("/api/*", (req, res) => {
  res.status(404).json({ ok: false, error: "api_route_not_found" });
});
app.use("*", (req, res) => {
  res.sendFile("index.html");
});
```

### ❌ DON'T: Put API guard in `serveStatic()`

```typescript
// ❌ BAD: Guard only applies in production
function serveStatic(app) {
  app.all("/api/*", ...); // Only runs in prod
}
```

```typescript
// ✅ GOOD: Guard in createApp() (runs everywhere)
function createApp() {
  // ... routes ...
  app.all("/api/*", ...); // Runs in dev, prod, tests
}
```

---

## References

- **Incident Report:** 2024-12-24 - Cron jobs failing silently due to HTML 200 responses
- **Original Issue:** `/api/worker/*` endpoints returned SPA HTML when called with GET
- **Root Cause:** Missing POST-only enforcement + SPA fallthrough
- **Fix:** This contract + regression tests

---

## Infrastructure Change Rule

**Cron endpoints are infrastructure. Changes require updating both cron-job.org configuration and regression tests in the same PR.**

This prevents:
- Route changes without scheduler updates
- Method changes without test updates
- Silent production failures

**Before merging any cron endpoint changes:**
1. Update cron-job.org configuration (if URL/method changed)
2. Update Vitest tests (if behavior changed)
3. Run `pnpm test api-routing-guardrails`
4. Document the change in this file

---

## Questions?

If you're unsure whether a change violates this contract, ask:

1. Does this change affect routing under `/api/*`?
2. Could this cause an API route to return HTML?
3. Does this change the HTTP method for cron endpoints?

If yes to any, review this doc and run the regression tests before merging.
