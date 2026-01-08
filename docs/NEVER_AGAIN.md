# NEVER AGAIN: Lessons Learned

This document captures every mistake made during development and the correct pattern to use instead. **Read this before starting any new feature.**

---

## Testing Anti-Patterns

### ❌ MISTAKE: Asserting downstream behavior in boundary tests

**What we did wrong:**
```typescript
// Stripe webhook smoke test asserting deployment creation
const depRows = await db.select().from(deployments).where(eq(deployments.intakeId, intakeId));
expect(depRows.length).toBe(1); // ❌ Deployment is gated by business rules!
```

**Why it's wrong:**
- Deployment creation depends on safety gates (build plan exists, preview token exists, approval exists)
- Test intake doesn't satisfy these requirements
- Test fails even though webhook idempotency is working correctly
- Conflates boundary testing with business logic testing

**✅ CORRECT PATTERN: Assert only guaranteed side effects at the boundary**

```typescript
// Stripe webhook idempotency test - assert payment + email, NOT deployment
const emailRows = await db
  .select()
  .from(emailLogs)
  .where(
    and(
      eq(emailLogs.intakeId, intakeId),
      eq(emailLogs.emailType, "deployment_started")
    )
  );
expect(emailRows.length).toBe(1);
expect(emailRows[0].status).toBe("sent");

// ✅ Deployment may not exist if safety gates fail - that's correct behavior
// ✅ This test proves: idempotency works, no duplicate emails, no double charges
```

**Rule:** Stripe webhook idempotency tests must assert idempotency via database side effects (payments + emailLogs), not downstream deployment creation. Deployment is gated by business rules and must not be assumed.

**Reference:** `server/__tests__/smoke.stripe-webhook.test.ts`

### ❌ MISTAKE: Mocking Drizzle internals in tests

**What we did wrong:**
```typescript
// DON'T: Mock Drizzle query builder methods
vi.mocked(db.select).mockReturnValue({
  from: vi.fn().mockReturnValue({
    where: vi.fn().mockReturnValue(...)
  })
});
```

**Why it's wrong:**
- Tests break when query shape changes
- Tests break when schema changes
- You're testing Drizzle, not your code
- Brittle and hard to maintain

**✅ CORRECT PATTERN: Extract DB helpers and mock those**

```typescript
// Step 1: Create server/services/[feature]-db.ts
export async function fetchFacebookConnectedAt(input: {
  customerId: number;
  pageId: string;
}) {
  const db = await getDb();
  const [row] = await db
    .select({ createdAt: moduleConnections.createdAt })
    .from(moduleConnections)
    .where(
      and(
        eq(moduleConnections.userId, input.customerId),
        eq(moduleConnections.externalId, input.pageId),
        eq(moduleConnections.connectionType, "facebook_page")
      )
    )
    .limit(1);
  
  return row?.createdAt ?? null;
}

// Step 2: Use helpers in your service
import { fetchFacebookConnectedAt } from "./facebook-policy-db";
const connectedAt = await fetchFacebookConnectedAt({ customerId, pageId });

// Step 3: Mock the helper (simple!)
vi.mock("../facebook-policy-db", () => ({
  fetchFacebookConnectedAt: vi.fn(),
  countPublishedPostsToday: vi.fn(),
}));

import { fetchFacebookConnectedAt } from "../facebook-policy-db";
(fetchFacebookConnectedAt as any).mockResolvedValue(new Date());
```

**Benefits:**
- Tests stay stable when queries change
- Only test your logic, not Drizzle
- Easy to understand and maintain

---

### ❌ MISTAKE: Exact error message assertions

**What we did wrong:**
```typescript
// DON'T: Assert exact error text
expect(result.error).toBe("Daily limit reached");
expect(result.reasons).toContain("Daily post limit reached (2 posts per 24 hours). Please wait before posting again.");
```

**Why it's wrong:**
- Copy evolves over time
- Product managers change wording
- Tests break when improving UX copy
- Blocks legitimate improvements

**✅ CORRECT PATTERN: Assert semantic meaning**

```typescript
// DO: Assert action + semantic category
expect(result.success).toBe(false);
expect(result.action).toBe("BLOCK");
expect(result.error?.toLowerCase()).toMatch(/limit|cap/);
expect(result.reasons).toBeDefined();
expect(Array.isArray(result.reasons)).toBe(true);
```

**Benefits:**
- Copy can evolve without breaking tests
- Tests verify behavior, not presentation
- Product improvements don't require test rewrites

---

### ❌ MISTAKE: Using `vi.mocked()` without checking Vitest version

**What we did wrong:**
```typescript
// DON'T: Assume vi.mocked() exists
vi.mocked(getWeatherIntelligence).mockResolvedValue(...);
```

**Why it's wrong:**
- `vi.mocked()` isn't available in all Vitest versions
- Creates cryptic "not a function" errors
- Blocks test execution

**✅ CORRECT PATTERN: Use plain cast + vi.fn()**

```typescript
// DO: Mock at top of file, cast when using
vi.mock("../services/weather-intelligence", () => ({
  getWeatherIntelligence: vi.fn(),
}));

import { getWeatherIntelligence } from "../services/weather-intelligence";
const mockGetWeatherIntelligence = getWeatherIntelligence as unknown as ReturnType<typeof vi.fn>;
mockGetWeatherIntelligence.mockResolvedValue({ ... });
```

**Even better: Don't mock if you don't need to**
```typescript
// If policy returns DRAFT before weather logic runs, don't mock weather at all
// Mock the policy result directly instead
```

---

### ❌ MISTAKE: Flipping constants for smoke tests

**What we did wrong:**
```typescript
// DON'T: Change production constants for testing
const DAILY_POST_CAP = 0; // SMOKE TEST
```

**Why it's wrong:**
- Risk of shipping test values to production
- Requires manual revert (easy to forget)
- Creates "oops we shipped cap=0" incidents

**✅ CORRECT PATTERN: Mutation-layer integration test with real DB**

```typescript
// CANONICAL PATTERN: Test at mutation layer with real DB setup
// This is the ONLY way to smoke test caps correctly

it("blocks posting when daily cap is reached", async () => {
  const db = await getDb();
  
  // 1. Arrange: Create connection + 2 published posts (reaching cap)
  await db.insert(moduleConnections).values({
    userId: TEST_USER_ID,
    connectionType: "facebook_page",
    externalId: TEST_PAGE_ID,
    accessToken: "test_token",
    createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
  });
  
  await db.insert(socialPosts).values([
    { userId: TEST_USER_ID, pageId: TEST_PAGE_ID, status: "published", publishedAt: new Date() },
    { userId: TEST_USER_ID, pageId: TEST_PAGE_ID, status: "published", publishedAt: new Date() },
  ]);
  
  // 2. Act: Attempt manual post via mutation
  const caller = appRouter.createCaller({ user: { id: TEST_USER_ID, ... } });
  const result = await caller.facebook.post({ message: "Should be blocked" });
  
  // 3. Assert: Policy blocked it
  expect(result.success).toBe(false);
  expect(result.action).toBe("BLOCK");
  expect(result.error?.toLowerCase()).toMatch(/cap|limit/);
});
```

**Why this is the ONLY correct way:**
- ✅ Tests full stack (DB → policy → mutation → response)
- ✅ No mocking (catches real integration issues)
- ✅ No constant flipping (zero production risk)
- ✅ Would catch policy bypasses, broken queries, wrong thresholds
- ✅ This is what prevents Meta platform violations

**See:** `server/__tests__/smoke.facebook-mutations.test.ts` for the authoritative implementation

---

## API Design Anti-Patterns

### ❌ MISTAKE: Changing endpoint paths without updating external callers

**What we did wrong:**
- Renamed `/api/worker/*` to `/api/cron/*`
- Forgot external cron service still hits old endpoints
- Silent failures in production (HTML 200 responses)

**✅ CORRECT PATTERN: Infrastructure Change Rule**

**When changing cron/webhook endpoints:**

1. **Add deprecation warnings first**
   ```typescript
   // Step 1: Add deprecation headers + logging
   app.post("/api/worker/run-next-deploy", 
     withDeprecationHeaders("Use POST /api/cron/run-next-deploy"),
     handler
   );
   ```

2. **Deploy + monitor for 24-48h**
   - Check `/api/cron/health` for `deprecatedWorkerHits`
   - Verify zero hits on old endpoints

3. **Update external services**
   - Update cron-job.org config
   - Update webhook URLs
   - Update documentation

4. **Delete old endpoints**
   - Only after zero deprecated hits
   - Add regression test to prevent reintroduction
   ```typescript
   it("should return 404 for deleted worker endpoints", async () => {
     const res = await request(app).post("/api/worker/run-next-deploy");
     expect(res.status).toBe(404);
     expect(res.body.ok).toBe(false);
   });
   ```

**Document in code:**
```markdown
## Infrastructure Change Rule

Cron endpoints are infrastructure. Changes require:
1. Updating external scheduler configuration (cron-job.org)
2. Updating regression tests in the same PR
3. Never change paths without deprecation period
```

---

## Database Anti-Patterns

### ❌ MISTAKE: Using driver-specific features (insertId)

**What we did wrong:**
```typescript
// DON'T: Rely on insertId (breaks with some MySQL drivers)
const [result] = await db.insert(workerRuns).values({ ... });
const runId = result.insertId; // ❌ May be undefined
```

**Why it's wrong:**
- `insertId` not guaranteed across all MySQL drivers
- Connection pooling can break it
- Silent failures in production

**✅ CORRECT PATTERN: Use UUID-based keys**

```typescript
// DO: Generate UUID before insert
import { randomUUID } from "crypto";

const runKey = randomUUID();
await db.insert(workerRuns).values({
  runKey,
  workerType: "deployment",
  // ...
});

// Update using UUID
await db.update(workerRuns)
  .set({ finishedAt: new Date(), ok: true })
  .where(eq(workerRuns.runKey, runKey));
```

**Benefits:**
- Works across all MySQL drivers
- Works with connection pooling
- Easier to debug (readable IDs in logs)

---

### ❌ MISTAKE: Letting Drizzle type inference cache issues block you

**What we did wrong:**
- Tried to fix Drizzle type inference errors
- Spent hours debugging TypeScript
- Blocked shipping

**✅ CORRECT PATTERN: Use raw SQL for problematic queries**

```typescript
// When Drizzle type inference fails, use raw SQL
import { sql } from "drizzle-orm";

const result = await db.execute(sql`
  UPDATE worker_runs 
  SET finishedAt = NOW(), ok = ${ok}
  WHERE runKey = ${runKey}
`);
```

**When to use raw SQL:**
- Type inference errors that block shipping
- Complex joins with ambiguous columns
- Performance-critical queries
- When you need exact control over the query

**Document why:**
```typescript
// Using raw SQL to bypass Drizzle type inference cache issues
// with finishedAt column (see PR #123)
```

---

## Deployment Anti-Patterns

### ❌ MISTAKE: No telemetry for migration periods

**What we did wrong:**
- Deprecated endpoints with no visibility
- Couldn't tell if external services migrated
- Had to guess when safe to delete

**✅ CORRECT PATTERN: Queryable telemetry**

```typescript
// Step 1: Track deprecated hits in memory
const deprecatedHits = new Map<string, number>();

function recordDeprecatedHit(path: string) {
  deprecatedHits.set(path, (deprecatedHits.get(path) || 0) + 1);
  console.log(`[Deprecated] ${new Date().toISOString()} ${path} called`);
}

// Step 2: Expose via health endpoint
app.get("/api/cron/health", (req, res) => {
  res.json({
    ok: true,
    timestamp: new Date().toISOString(),
    database: "connected",
    deprecatedWorkerHits: Object.fromEntries(deprecatedHits),
  });
});

// Step 3: Monitor health endpoint
// curl https://your-app.com/api/cron/health
// {"deprecatedWorkerHits": {"POST /api/worker/run-next-deploy": 0}}

// Step 4: Delete when zero hits for 24-48h
```

---

## Testing Strategy

### ✅ CORRECT PATTERN: Three-layer testing

**Layer 1: Unit tests (fast, isolated)**
```typescript
// Test pure functions and business logic
describe("isInApprovalFirstPeriod", () => {
  it("returns true when within 7 days", () => {
    const connectedAt = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
    const now = new Date();
    expect(isInApprovalFirstPeriod(connectedAt, now, 7)).toBe(true);
  });
});
```

**Layer 2: Integration tests (mock external services)**
```typescript
// Test that mutations enforce policy and don't call external APIs when blocked
it("should NOT call Facebook when policy returns BLOCK", async () => {
  vi.mocked(checkFacebookPostingPolicy).mockResolvedValue({
    allowed: false,
    action: "BLOCK",
  });

  const result = await caller.facebook.post({ message: "Test" });

  expect(result.action).toBe("BLOCK");
  expect(facebookPoster.postToFacebook).not.toHaveBeenCalled();
});
```

**Layer 3: Smoke tests (production-like scenarios)**
```typescript
// Test end-to-end flows with realistic data
it("SMOKE: Cap reached returns BLOCK with correct response shape", async () => {
  // Mock DB to simulate cap reached
  mockGetPostCount.mockResolvedValue(2);
  
  const result = await checkFacebookPostingPolicy({
    customerId: "123",
    pageId: "page123",
    mode: "manual",
    postType: "OTHER",
    confidence: null,
    now: new Date(),
  });

  expect(result.action).toBe("BLOCK");
  expect(result.error?.toLowerCase()).toMatch(/limit|cap/);
  console.log("✅ Response:", JSON.stringify(result, null, 2));
});
```

---

## Smoke Test Checklist

Before every production deployment, run these smoke tests:

### 1. Policy Enforcement
- [ ] Cap block returns `BLOCK` with cap reason
- [ ] Connection missing returns `BLOCK` with connection reason
- [ ] Quiet hours (auto mode) returns `QUEUE` with `retryAt`
- [ ] Manual mode bypasses quiet hours (returns `PUBLISH`)

### 2. External API Integration
- [ ] Facebook API not called when policy blocks
- [ ] Facebook API called when policy allows
- [ ] Error responses are user-friendly (no raw Zod errors)

### 3. Cron Endpoints
- [ ] `POST /api/cron/run-next-deploy` returns 200 JSON
- [ ] `POST /api/cron/auto-advance` returns 200 JSON
- [ ] `GET /api/cron/health` shows `lastWorkerRun` data
- [ ] Deprecated endpoints return 404 JSON (if deleted)

### 4. Database
- [ ] Worker runs logged with UUID `runKey`
- [ ] `finishedAt` and `ok` always set (finally block)
- [ ] No `insertId` dependencies

---

## Code Review Checklist

Before merging any PR, verify:

### Testing
- [ ] No Drizzle mocking (use DB helpers instead)
- [ ] No exact error message assertions (use semantic matching)
- [ ] No `vi.mocked()` calls (use plain cast + `vi.fn()`)
- [ ] No production constants changed for testing

### API Design
- [ ] No endpoint path changes without deprecation period
- [ ] Telemetry added for migration periods
- [ ] Health endpoint updated if infrastructure changed
- [ ] External services updated (cron, webhooks)

### Database
- [ ] No `insertId` usage (use UUID keys)
- [ ] Raw SQL used for problematic Drizzle queries
- [ ] Comments explain why raw SQL was needed

### Documentation
- [ ] NEVER_AGAIN.md updated with new lessons
- [ ] README updated if API contract changed
- [ ] Migration guide written if breaking changes

---

## Emergency Rollback Procedure

If production breaks after deployment:

1. **Immediate rollback**
   ```bash
   # Rollback to last known good checkpoint
   pnpm webdev:rollback <version_id>
   ```

2. **Check telemetry**
   ```bash
   curl https://your-app.com/api/cron/health
   # Look for errors, deprecated hits, worker failures
   ```

3. **Check worker logs**
   ```sql
   SELECT * FROM worker_runs 
   WHERE ok = false 
   ORDER BY startedAt DESC 
   LIMIT 10;
   ```

4. **Document incident**
   - Add to NEVER_AGAIN.md
   - Update smoke test checklist
   - Add regression test

---

## Key Principles

1. **Never mock what you don't own** (Drizzle, external libraries)
2. **Test behavior, not presentation** (semantic assertions)
3. **Infrastructure changes require migration periods** (deprecation → monitor → delete)
4. **Always have telemetry** (can't improve what you can't measure)
5. **Document every mistake** (NEVER_AGAIN.md)
6. **Smoke test before every deploy** (catch issues before production)
7. **Use UUIDs for distributed systems** (no `insertId` dependencies)

---

## When in Doubt

Ask yourself:
- Will this test break if I improve the copy?
- Will this work with connection pooling?
- Can I monitor this migration?
- Did I document this mistake in NEVER_AGAIN.md?
- Did I add a smoke test for this scenario?

If the answer to any is "no," stop and fix it before merging.


---

## Stripe Webhook Idempotency

### ✅ CORRECT PATTERN: Webhook event logging with upsert pattern

**Problem:** Stripe retries failed webhooks, causing duplicate charges, emails, and deployments.

**Solution:** Log every webhook delivery with atomic upsert to track retries.

```typescript
// server/stripe/webhookLogger.ts
export async function logStripeWebhookReceived(
  event: Stripe.Event,
  meta?: Record<string, unknown>
): Promise<void> {
  const db = await getDb();
  if (!db) return; // Best-effort, never blocks processing

  try {
    // CRITICAL: This is the ONLY place retryCount increments
    await db.execute(sql`
      INSERT INTO stripe_webhook_events 
        (eventId, eventType, created, receivedAt, ok, error, intakeId, userId, idempotencyHit, retryCount, meta)
      VALUES (
        ${event.id}, 
        ${event.type}, 
        ${event.created}, 
        NOW(), 
        NULL, 
        NULL, 
        NULL, 
        NULL, 
        FALSE, 
        0, 
        ${meta ?? null}
      )
      ON DUPLICATE KEY UPDATE 
        retryCount = retryCount + 1,
        idempotencyHit = TRUE,
        receivedAt = NOW()
    `);
  } catch (err) {
    console.error("[Webhook Logger] Failed to log event receipt:", err);
  }
}
```

**Webhook handler wiring order (MUST follow this sequence):**

```typescript
export async function handleStripeWebhook(req: Request, res: Response) {
  // 1. Signature verification FIRST (reject unverified payloads)
  const signature = req.headers["stripe-signature"];
  if (!signature) return res.status(400).json({ error: "Missing signature" });
  
  let event: Stripe.Event;
  try {
    event = constructWebhookEvent(req.body, signature);
  } catch (err) {
    return res.status(400).json({ error: "Invalid signature" });
  }

  // 2. Log receipt immediately (upsert pattern, best-effort)
  await logStripeWebhookReceived(event);

  // 3. Process event with try/catch/finally
  let processingError: string | null = null;
  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(session);
        break;
      // ... other handlers
    }
    res.json({ received: true });
  } catch (err) {
    processingError = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: "Webhook handler failed" });
  } finally {
    // 4. Always finalize status (never touches retryCount/idempotencyHit)
    await finalizeStripeWebhookEvent(event.id, {
      ok: processingError === null,
      error: processingError,
      intakeId: null, // Optional: capture if available
      userId: null,   // Optional: capture if available
    });
  }
}
```

**Atomic claim pattern for checkout.session.completed:**

```typescript
// CRITICAL: This prevents duplicate charges and emails
const claim = await db
  .update(intakes)
  .set({
    stripeSessionId: session.id,
    status: "paid",
    paidAt: new Date(),
  })
  .where(
    and(
      eq(intakes.id, intakeId),
      isNull(intakes.stripeSessionId) // Only claim if unclaimed
    )
  );

const claimed = (claim?.rowsAffected ?? 0) > 0;
if (!claimed) {
  console.log(`[Stripe Webhook] Duplicate checkout ignored (session ${session.id})`);
  return; // Exit early, no side effects
}

// Safe zone: only first webhook reaches here
await db.insert(payments).values({ ... });
await sendEmail({ ... });
```

**Smoke test assertions (boundary-real):**

```typescript
// Test: Send same webhook twice, assert idempotency
const { payload, signature } = makeSignedStripePayload(event);

const res1 = await request(app)
  .post("/api/stripe/webhook")
  .set("stripe-signature", signature)
  .type("application/json")
  .send(payload);

const res2 = await request(app)
  .post("/api/stripe/webhook")
  .set("stripe-signature", signature)
  .type("application/json")
  .send(payload);

// Assert: Both accepted (Stripe expects 2xx)
expect(res1.status).toBeGreaterThanOrEqual(200);
expect(res2.status).toBeGreaterThanOrEqual(200);

// Assert: Webhook event logged with retry tracking
const [webhookEvent] = await db
  .select()
  .from(stripeWebhookEvents)
  .where(eq(stripeWebhookEvents.eventId, event.id));

expect(webhookEvent.eventType).toBe("checkout.session.completed");
expect(webhookEvent.ok).toBe(true);
expect(webhookEvent.idempotencyHit).toBe(true); // Second delivery sets this
expect(webhookEvent.retryCount).toBe(1); // Incremented on duplicate

// Assert: Payment created once
const payRows = await db.select().from(payments)
  .where(eq(payments.stripePaymentIntentId, paymentIntentId));
expect(payRows.length).toBe(1);

// Assert: Email sent once
const emailRows = await db.select().from(emailLogs)
  .where(and(eq(emailLogs.intakeId, intakeId), eq(emailLogs.emailType, "deployment_started")));
expect(emailRows.length).toBe(1);
```

**Rules:**
1. **Receipt logging MUST use parameterized queries** (prevent SQL injection)
2. **retryCount increments ONLY in upsert** (finalize never touches it)
3. **Finalize runs in finally block** (guarantees execution)
4. **Atomic claim MUST happen before any side effects** (payments, emails, deployments)
5. **Smoke tests MUST assert webhook_events table** (proves retry tracking works)

**Reference:** 
- `server/stripe/webhookLogger.ts` - Logging helpers
- `server/stripe/webhook.ts` - Handler wiring
- `server/__tests__/smoke.stripe-webhook.test.ts` - Idempotency smoke test
- `server/__tests__/smoke.stripe-invoice.test.ts` - Subscription activation test



---

## Template Versioning

### ✅ CORRECT PATTERN: Immutable template versions prevent silent breakage

**Why this matters:**
- Customer sites must never change unexpectedly
- Template improvements should only affect new deployments
- Upgrades must be explicit, auditable, and reversible

**How it works:**
1. Every deployment stores `templateVersion` (e.g., "2026-01-07.1")
2. New deployments get `TEMPLATE_VERSION_CURRENT`
3. Old deployments remain frozen at their original version
4. Template changes never affect existing customer sites

**When to bump `TEMPLATE_VERSION_CURRENT`:**

✅ **BUMP for breaking changes:**
- Layout structure changes
- Component hierarchy changes
- CSS framework updates
- New required features
- Breaking API changes

❌ **DO NOT BUMP for safe changes:**
- Copy/content updates
- Bug fixes that don't change output
- Internal refactoring
- New optional features
- Performance improvements

**How to bump the version:**

1. Update `TEMPLATE_VERSION_CURRENT` in `shared/templateVersion.ts`
2. Add the new version to `TEMPLATE_VERSIONS` array
3. Run tests: `pnpm test template-versioning`
4. Document what changed in this file

**Example:**
```typescript
// shared/templateVersion.ts
export const TEMPLATE_VERSION_CURRENT = "2026-01-15.1"; // Bumped for new hero layout
export const TEMPLATE_VERSIONS = [
  "v1",           // Baseline (all existing sites)
  "2026-01-07.1", // Initial versioned release
  "2026-01-15.1", // New hero layout with CTAs
] as const;
```

**Upgrade path (future):**
- Admin UI will allow explicit site upgrades
- Upgrades create new deployment with new version
- Old deployment remains as rollback point
- Customer approves before going live

**Tests enforce immutability:**
- `server/__tests__/template-versioning.test.ts`
- New deployments must get current version
- Existing deployments must never change version

**Rule:** Template versions are immutable. Once deployed, a site's template version never changes unless explicitly upgraded through admin action.

**Reference:** `shared/templateVersion.ts`, `server/db.ts` (createDeployment)
