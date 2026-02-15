# Security Hardening Checklist

**Status:** Integrated
**Branch:** `integrate-security-hardening`
**Date:** 2026-02-15

---

## Architecture Overview

This security hardening layer adds eight defense-in-depth components to the LaunchBase platform:

1. **Rate Limiting (tRPC)** — In-memory sliding-window limiter per IP/user on tRPC procedures
2. **Rate Limiting (Express)** — HTTP-level rate limiter middleware for artifact routes and APIs
3. **Project Access Verification** — Tenant-scoped RBAC for resource access
4. **Project Isolation** — Per-project collaborator-based access control (owner/editor/viewer)
5. **Audit Logging** — Append-only security event log with buffered writes
6. **Input Sanitization** — XSS/SQLi pattern detection (defense-in-depth)
7. **CSRF Protection** — Origin/Referer validation for mutations
8. **Artifact Protection** — Authenticated downloads with directory traversal prevention + S3 presigned URLs

### File Inventory

| File | Purpose |
|------|---------|
| `server/security/index.ts` | Re-exports all security modules |
| `server/security/rateLimit.ts` | Sliding-window rate limiter (tRPC-level) |
| `server/security/verifyProjectAccess.ts` | Tenant-scoped RBAC |
| `server/security/auditLog.ts` | Buffered audit event writer |
| `server/security/inputSanitizer.ts` | XSS/SQLi detection + CSRF |
| `server/middleware/rateLimiter.ts` | Express-level rate limiter middleware |
| `server/auth/verifyProjectAccess.ts` | Project-level access control (per-project RBAC) |
| `server/routes/artifactsRouter.ts` | Secure artifact download router (auth + traversal prevention) |
| `server/routers/admin/operatorOS.ts` | Operator OS admin dashboard tRPC router |
| `server/db/schema.ts` | `projects`, `project_collaborators`, `agent_artifacts`, `security_audit_log`, `rate_limit_violations` tables |
| `SECURITY_HARDENING_CHECKLIST.md` | This file |

---

## Security Tests (8 checks)

### Test 1: Rate Limiting — Public Form Submission

**What:** Intake submission endpoint (`intake.submit`) enforces 5 requests/minute per IP.

**How to verify:**
```bash
# Submit 6 rapid requests — 6th should return TOO_MANY_REQUESTS
for i in $(seq 1 6); do
  curl -s -X POST http://localhost:3000/trpc/intake.submit \
    -H "Content-Type: application/json" \
    -d '{"json":{"businessName":"Test","contactName":"Test","email":"test@test.com","vertical":"trades"}}' \
    | head -c 200
  echo ""
done
```

**Expected:** First 5 succeed. 6th returns `{"error":{"code":"TOO_MANY_REQUESTS",...}}`.

---

### Test 2: Rate Limiting — Analytics Endpoint

**What:** Analytics tracking (`analytics.track`) enforces 100 requests/minute per IP.

**How to verify:**
```bash
# Rapid-fire analytics events should eventually hit the limit
for i in $(seq 1 101); do
  curl -s -X POST http://localhost:3000/trpc/analytics.track \
    -H "Content-Type: application/json" \
    -d '{"json":{"eventName":"test_event"}}' > /dev/null
done
echo "101st request should be rate-limited"
```

**Expected:** First 100 succeed. 101st returns `TOO_MANY_REQUESTS`.

---

### Test 3: Input Sanitization — XSS Detection

**What:** Intake submissions containing `<script>` tags are flagged in audit log.

**How to verify:**
```bash
curl -X POST http://localhost:3000/trpc/intake.submit \
  -H "Content-Type: application/json" \
  -d '{"json":{"businessName":"<script>alert(1)</script>","contactName":"Test","email":"test@test.com","vertical":"trades"}}'
```

**Expected:** Request proceeds (Zod validates; XSS is logged, not blocked), but the audit buffer contains a `suspicious_input` entry.

---

### Test 4: Admin Action Auditing

**What:** Admin status changes log to audit trail.

**How to verify:**
1. Log in as admin
2. Change an intake status via the admin panel
3. Check the `security_audit_log` table (or server logs) for an `admin_action` event

**Expected:** Row in `security_audit_log` with `eventType = 'admin_action'`, correct intake ID, and actor info.

---

### Test 5: Project Access — Staging Bypass Warning

**What:** `verifyProjectAccess` allows unauthenticated access ONLY when `ALLOW_STAGING_BYPASS=true` AND `NODE_ENV !== 'production'`.

**How to verify:**
```typescript
import { verifyProjectAccess } from "./server/security";

// Should throw UNAUTHORIZED in production
verifyProjectAccess(
  { user: null },
  { type: "intake", id: 1, tenant: "launchbase" }
);
```

**Expected:**
- In production (`NODE_ENV=production`): Throws `UNAUTHORIZED`
- In staging with bypass: Returns `{ granted: true, reason: "staging_bypass" }`

---

### Test 6: Artifact Auth — Unauthenticated Denied

**What:** Unauthenticated requests to `/api/artifacts/:id` return 401.

**How to verify:**
```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/artifacts/1
```

**Expected:** HTTP 401 with `{"error":{"code":"UNAUTHORIZED",...}}`.

---

### Test 7: Artifact Auth — Wrong Project Returns 403

**What:** Authenticated user without project access gets 403.

**How to verify:**
1. Log in as a user who is NOT a collaborator on the artifact's project
2. Request `GET /api/artifacts/:id`
3. Should return 403

**Expected:** HTTP 403 with `{"error":{"code":"FORBIDDEN",...}}`.

---

### Test 8: Express Rate Limiter — Artifact Downloads

**What:** Artifact download endpoint enforces 30 requests/minute per IP.

**How to verify:**
```bash
# Requires auth cookie — replace with valid session
for i in $(seq 1 31); do
  curl -s -o /dev/null -w "%{http_code}\n" \
    -H "Cookie: session=YOUR_SESSION_COOKIE" \
    http://localhost:3000/api/artifacts/1
done
```

**Expected:** First 30 return 401/403/200 (depending on auth/access). 31st returns 429.

---

## Pre-Production Checklist

- [ ] **Remove staging escape hatch** — Delete `ALLOW_STAGING_BYPASS` in both `server/security/verifyProjectAccess.ts` and `server/auth/verifyProjectAccess.ts`
- [ ] **Register audit writer** — Call `registerAuditWriter()` in server startup to connect audit buffer to database
- [ ] **Run `pnpm db:push`** — Apply `projects`, `project_collaborators`, `agent_artifacts`, `security_audit_log`, and `rate_limit_violations` table migrations
- [ ] **Mount artifacts router** — In Express app setup: `app.use("/api/artifacts", RATE_LIMITERS.artifacts(), artifactsRouter)`
- [ ] **Set `ARTIFACTS_DIR`** — Configure local artifact storage path (or set `ARTIFACTS_S3_BUCKET` for S3)
- [ ] **Verify rate limit thresholds** — Adjust `RATE_LIMITS` and `RATE_LIMITERS` constants based on actual traffic patterns
- [ ] **Enable CSRF validation** — Add `enforceInputSecurity(ctx.req, input)` to tRPC middleware for all mutations
- [ ] **Review allowed origins** — Update `getAllowedOrigins()` with production domain(s)
- [ ] **Set up alerting** — Monitor `security_audit_log` for `severity = 'crit'` events via Operator OS dashboard
- [ ] **Load test rate limiter** — Verify memory footprint under sustained load (cleanup runs every 5 min)
- [ ] **Configure Redis** — When `REDIS_URL` is set, migrate rate limiter from in-memory to Redis-backed store

---

## Rate Limit Tiers

| Tier | Key | Max Requests | Window | Applied To |
|------|-----|-------------|--------|-----------|
| Global | `api:global` | 100 | 60s | All endpoints |
| Auth | `api:auth` | 10 | 60s | Login/session endpoints |
| Mutation | `api:mutation` | 30 | 60s | All mutations |
| Public Form | `api:publicForm` | 5 | 60s | Intake, feedback, checkout, suite apply |

---

## Audit Event Types

| Event Type | Severity | Description |
|-----------|----------|-------------|
| `auth_success` | info | Successful authentication |
| `auth_failure` | warn | Failed authentication attempt |
| `access_denied` | warn | Authorization check failed |
| `rate_limit_hit` | warn | Rate limit exceeded |
| `admin_action` | info | Admin performed a state change |
| `project_access_granted` | info | Resource access approved |
| `project_access_denied` | warn | Resource access denied |
| `suspicious_input` | warn | XSS/SQLi pattern detected in input |
| `csrf_violation` | crit | Origin validation failed |
| `session_created` | info | New session established |
| `session_destroyed` | info | Session terminated |
| `privilege_escalation_attempt` | crit | Unauthorized role escalation |

---

## Remaining Soft Spots

> **Before production: Remove the staging escape hatch in BOTH `verifyProjectAccess` modules.**
>
> When `ALLOW_STAGING_BYPASS=true`, unauthenticated users bypass access checks.
> This is acceptable for staging/development but MUST be removed for production.
>
> Locations:
> - `server/security/verifyProjectAccess.ts` — tenant-scoped RBAC bypass
> - `server/auth/verifyProjectAccess.ts` — project-level access bypass
