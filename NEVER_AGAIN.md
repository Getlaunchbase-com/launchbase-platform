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


---

## Beta Go/No-Go Checklist

**Purpose:** Minimum monitoring required before accepting beta customers.

### Email Delivery Health
- [ ] `/admin/email-monitoring` shows recent emails (last 24h)
- [ ] Test email sent to `vmorre@live.com` (received, not spam)
- [ ] Test email sent to `vince@vincessnowplow.com` (received, not spam)
- [ ] FROM shows: `LaunchBase <support@getlaunchbase.com>` (not `onboarding@resend.dev`)
- [ ] `email_logs` table shows `deliveryProvider="resend"`, `status="sent"`, `errorMessage IS NULL`

### Stripe Webhook Staleness
- [ ] `/admin/stripe-webhooks` shows recent webhook events
- [ ] Last webhook received < 24 hours ago (if any payments processed)
- [ ] No failed webhooks with `status="failed"`

### Deploy Queue Health
- [ ] `/admin/deployments` shows recent deployments
- [ ] No deployments stuck in "pending" for > 2 hours
- [ ] Cron worker last run < 1 hour ago

### Intake Submission Flow
- [ ] Submit test intake through `/apply` form
- [ ] Verify intake appears in `/admin` dashboard
- [ ] Verify confirmation email arrives
- [ ] Verify owner notification received

---

## Incident Response Playbook

### Quick Diagnosis (Check in order)

1. **Email Monitoring** → `/admin/email-monitoring`
   - Failed emails? Check `topError`
   - Common: Domain not verified, API key expired

2. **Stripe Webhooks** → `/admin/stripe-webhooks`
   - Failed webhooks? Check signature mismatch
   - Common: Webhook secret changed, endpoint URL wrong

3. **Deployments** → `/admin/deployments`
   - Stuck deployments? Check error message
   - Common: Build failure, DNS not propagated

4. **Intakes** → `/admin`
   - Missing intakes? Check form validation
   - Common: tRPC mutation failed, DB connection lost

### Common Fixes

**Email Delivery Failing:**
1. Verify domain in Resend Dashboard
2. Set `RESEND_DOMAIN_VERIFIED=true` in secrets
3. Restart server

**Stripe Webhooks Failing:**
1. Get signing secret from Stripe Dashboard
2. Update `STRIPE_WEBHOOK_SECRET` in secrets
3. Restart server

**Deployments Stuck:**
1. Check cron worker logs
2. Manually trigger via `/admin/deploy/{intakeId}`
3. Wait for DNS propagation (5-60 min)

---

## Daily Health Check (5 minutes)

1. **Email**: Sent vs Failed ratio > 95%
2. **Stripe**: No failed webhooks
3. **Deploys**: No stuck deployments
4. **Intakes**: No stuck in "new" > 24h

---

## Forever Rules

1. **Never delete email_logs** - Audit trail for customer communication
2. **Never skip webhook verification** - Prevents fraud
3. **Never deploy without approval** - Manual approval required
4. **Never send emails without logging** - Always log to `email_logs`
