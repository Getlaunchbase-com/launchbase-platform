# NEVER AGAIN - Definition of Done

This document contains the "forever contracts" that must never regress. These are not aspirational goals—they are hard boundaries enforced by automated tests.

---

## Stripe Webhook Processing

**Contract:** Idempotent payment processing with atomic claim pattern.

**Definition of Done:**
- ✅ Smoke passes: `pnpm smoke` (all smoke tests green, <10s)
- ✅ Replay does not duplicate:
  - `payments` count = 1 (no duplicate payment records)
  - `email_logs` count = 1 for `deployment_started` (no duplicate emails)
- ✅ `stripe_webhook_events` tracking:
  - First delivery: `retryCount=0`, `idempotencyHit=false`, `ok=true`
  - Replay: `retryCount=1`, `idempotencyHit=true`, `ok=true`
- ✅ Intake claim is atomic:
  - `stripeSessionId` set via atomic UPDATE with `WHERE stripeSessionId IS NULL`
  - Payment record created only after successful claim
  - Email sent only after successful claim

**Test Location:** `server/__tests__/smoke.stripe-checkout-webhook.test.ts`

**Enforcement:** Signed HTTP boundary test with real Stripe signature validation. No mocks.

---

## Admin Authorization

**Contract:** Fail-closed admin access with runtime env reading.

**Definition of Done:**
- ✅ `ADMIN_EMAILS` read at runtime (not module load)
- ✅ Empty/missing `ADMIN_EMAILS` → fail closed (no access)
- ✅ Non-admin email → `FORBIDDEN` error
- ✅ Admin email → access granted
- ✅ Email matching is case-insensitive

**Test Location:** `server/__tests__/admin.stripeWebhooks.test.ts`

**Enforcement:** Unit tests cover all auth paths (unauthenticated, non-admin, admin).

---

## Email Delivery

**Contract:** Idempotent email sending with logging.

**Definition of Done:**
- ✅ Every email logged in `email_logs` table
- ✅ Duplicate webhook replay does not send duplicate emails
- ✅ Email type, recipient, subject, status tracked
- ✅ Failed emails logged with error details

**Test Location:** Covered by smoke tests (webhook replay scenarios)

**Enforcement:** Email count assertions in smoke tests verify no duplicates.

---

## Test Stability

**Contract:** Deterministic, driver-independent test assertions.

**Definition of Done:**
- ✅ All smoke tests use `describe.sequential()` to prevent DB contention
- ✅ All DB assertions use Drizzle `select()` API (no raw SQL return shape issues)
- ✅ Intake creation uses Pattern A (insert + select by unique email)
- ✅ Smoke tests complete in <10s on cold run
- ✅ Individual HTTP+DB tests have 10-20s timeout, complete in <5s

**Enforcement:** CI/CD pipeline runs `pnpm smoke` and `pnpm test` on every commit.

---

## How to Use This Document

1. **Before merging:** Verify all checkboxes pass for affected contracts
2. **Before refactoring:** Read relevant contract to understand boundaries
3. **When adding features:** Update contracts if new "never again" boundaries emerge
4. **When tests fail:** Check if a contract was violated (not just a flaky test)

**Remember:** These are not guidelines. They are **non-negotiable boundaries** that prevent production incidents.
