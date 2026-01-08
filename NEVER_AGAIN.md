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


---

## Database Index Strategy for Tenant Filtering

**Contract:** All tenant-filtered queries must have matching composite indexes to prevent slow queries as data grows.

**Forever Rule:** Index to match your WHERE + ORDER BY.

**Indexes Created:**

1. **email_logs:**
   - `idx_email_logs_tenant_sentAt` → Matches `WHERE tenant=? AND sentAt >= ? ORDER BY sentAt DESC`
   - `idx_email_logs_tenant_status_sentAt` → Matches `WHERE tenant=? AND status=? AND sentAt >= ?`

2. **deployments:**
   - `idx_deployments_tenant_createdAt` → Matches `WHERE tenant=? AND createdAt >= ? ORDER BY createdAt DESC`
   - `idx_deployments_tenant_status_createdAt` → Matches `WHERE tenant=? AND status=? AND createdAt >= ?`

**Query Pattern:**
```sql
-- Health metrics query (24h window)
SELECT * FROM email_logs 
WHERE tenant='vinces' AND sentAt >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
ORDER BY sentAt DESC;
```

**Index Selection Logic:**
- MySQL uses leftmost prefix matching
- `(tenant, sentAt)` index works for: `WHERE tenant=?`, `WHERE tenant=? AND sentAt>=?`
- `(tenant, status, sentAt)` index works for: `WHERE tenant=?`, `WHERE tenant=? AND status=?`, `WHERE tenant=? AND status=? AND sentAt>=?`

**Verification:**
```sql
SHOW INDEX FROM email_logs WHERE Key_name LIKE 'idx_%';
SHOW INDEX FROM deployments WHERE Key_name LIKE 'idx_%';
```

**Enforcement:** No automated test (indexes are infrastructure), but query performance monitoring should alert if queries exceed 100ms.

**When to Add More Indexes:**
- If you add filtering by `emailType` or `deliveryProvider` → add composite index
- If you add filtering by `urlMode` or `templateVersion` → add composite index
- Always match the WHERE clause order in your index column order

**Anti-Pattern to Avoid:**
- ❌ Adding indexes on every column (index bloat slows writes)
- ❌ Creating indexes without checking query patterns first
- ✅ Add indexes only for columns used in WHERE, JOIN, ORDER BY of frequent queries


---

## Rollback System (Jan 2026)

**Contract:** One-click rollback with enterprise safety rails (block if deploy in flight, clone from snapshot, tenant isolation).

**Forever Rules:**

1. **Rollback is clone-from-snapshot only** — Never mutate past deployments. Always create a new deployment row with `trigger='rollback'` and copy `buildPlanSnapshot` + `templateVersion` from the source.

2. **Rollback blocked when deploy in flight** — If any deployment for the intake has `status IN ('queued', 'running')`, throw `PRECONDITION_FAILED`. This prevents two deployments fighting and keeps outcomes predictable.

3. **Tenant isolation enforced** — Cannot rollback across tenants. The rollback mutation checks that the requesting user's tenant matches the intake's tenant.

4. **Snapshot immutability** — `buildPlanSnapshot` is set at deployment creation time and never mutated. The worker must use the snapshot (not regenerate from intake) to ensure rollback is deterministic.

5. **Audit trail required** — Every rollback deployment must set:
   - `trigger = 'rollback'`
   - `rolledBackFromDeploymentId = source.id`
   - `status = 'queued'` (processed like normal deployment)

**UI Safety Rails:**

1. **Show rollback button on all deployments** — Let server enforce rules, but disable client-side when:
   - Any deployment is queued/running for that intake
   - No successful deployment exists for that intake

2. **Confirmation modal must show target** — Display the deployment #, timestamp, and templateVersion being rolled back to, so users know exactly what they're restoring.

3. **Trigger badges for audit** — Every deployment row must show its trigger (Auto/Manual/ROLLBACK) and "Rolled back from #X" when applicable.

**Definition of Done:**
- ✅ 7 FOREVER tests passing in `server/__tests__/rollback.test.ts`
- ✅ Clone templateVersion + buildPlanSnapshot exactly
- ✅ Set trigger=rollback and rolledBackFromDeploymentId
- ✅ Throw when no successful deployment exists
- ✅ Throw when deployment queued/running (in-flight block)
- ✅ Enforce tenant isolation
- ✅ Return correct deployment IDs
- ✅ Allow multiple rollbacks in sequence

**Test Location:** `server/__tests__/rollback.test.ts`

**Enforcement:** Tests use `afterEach` to mark in-flight deployments as failed (prevents test pollution). Each test creates rollback, verifies behavior, and cleanup happens automatically.

**Common Pitfalls:**
- ❌ Don't regenerate build plan on rollback — use snapshot
- ❌ Don't allow rollback when deploy is queued/running
- ❌ Don't skip tenant isolation check
- ❌ Don't delete rollback deployments from history (audit trail)



---

## Real-Time Alert System (Jan 2026)

**Contract:** Fingerprint-based dedupe prevents spam loops. Alerts only go to vince@vincessnowplow.com.

**Forever Rules:**

1. **Fingerprint-based dedupe** — One row per unique `(tenant, alertKey, fingerprint)`. UNIQUE constraint enforces no duplicates at DB level. Same problem = same fingerprint = single alert row.

2. **Bucket thresholds to reduce noise** — Don't alert every minute. Use discrete buckets:
   - Email failures: `3plus` or `10plus`
   - Deploy failures: `2plus` or `5plus`
   - Webhook staleness: `2h`, `6h`, `12h`, or `24h+`

3. **Upsert + send-once flow** — Check if alert exists by fingerprint. If exists → update `lastSeenAt`. If new → insert + send email + set `sentAt`. This guarantees no duplicate alerts on retries.

4. **Auto-resolve when conditions clear** — Mark `status=resolved` and set `resolvedAt` when alert is no longer present in evaluation. No manual acknowledgment needed.

5. **Recipient hard-locked** — Alerts ONLY go to `vince@vincessnowplow.com`. Hard-coded in `alerts.ts`, not env-dependent. Even if env is misconfigured, recipient stays locked.

6. **Always include clickable link** — Every alert message includes direct link to `/admin/health?tenant={tenant}` (full URL if `PUBLIC_BASE_URL` set, otherwise path-only).

7. **Always log delivery status** — Track `sentAt`, `deliveryProvider`, `deliveryMessageId`, and `lastError` for every alert attempt.

**Alert Thresholds:**
- **Email failures** (warn): ≥3 in last 24h
- **Webhook staleness** (crit): No events in >2h
- **Deploy failures** (warn): ≥2 in last 24h

**Cron Schedule:**
- Endpoint: `POST /api/cron/alerts`
- Frequency: Every 10-15 minutes
- Evaluates both tenants: `launchbase` and `vinces`
- Logs to `worker_runs` table for observability

**Tenant Isolation:**
- Each alert tied to single tenant
- Cannot process alerts for `tenant=all`
- Fingerprints include tenant to prevent cross-tenant collisions

**Database Schema:**

Table: `alert_events`
- UNIQUE KEY: `(tenant, alertKey, fingerprint)`
- Indexes: `(tenant, status, lastSeenAt)`, `(tenant, sentAt)`, `(tenant, alertKey, lastSeenAt)`
- Auto-resolve via `status` and `resolvedAt` fields

**Fingerprint Format:**
```
{tenant}|{alertKey}|{bucket}
```

Examples:
- `launchbase|health:webhooks_stale|2h`
- `vinces|health:email_failures|3plus`
- `launchbase|health:deploy_failures|5plus`

**Definition of Done:**
- ✅ alert_events table created with UNIQUE constraint
- ✅ Fingerprint-based upsert logic implemented
- ✅ Bucket thresholds prevent alert noise
- ✅ Auto-resolve marks alerts resolved when conditions clear
- ✅ Recipient hard-locked to vince@vincessnowplow.com
- ✅ Cron endpoint `/api/cron/alerts` registered
- ✅ ops_alert email template added to all language/audience blocks

**Test Location:** Tests pending (system is functional, tests to be added in follow-up)

**Enforcement:** Manual verification via cron endpoint + alert_events table inspection.

**Common Pitfalls:**
- ❌ Don't send alerts without fingerprint dedupe (spam loop)
- ❌ Don't alert on every evaluation (use buckets)
- ❌ Don't forget to auto-resolve when conditions clear
- ❌ Don't allow recipient to be env-configurable (security risk)



---

## Pricing Model (Jan 2026)

**Contract:** Every service has explicit setup + monthly pricing. No exceptions.

**Forever Rules:**

1. **Explicit pricing always visible** — Homepage MUST show setup + monthly fees for all services. No hiding behind "configure later" or "effort-based" without tiers.

2. **Enrichment Layer is premium** — Intelligence is a separate, optional add-on. Never bundled. Always priced higher than base posting. Current: $199 setup + $79/mo.

3. **No subscription confusion** — Setup fees are one-time (Stripe Checkout). Monthly fees are recurring (Stripe Subscriptions). Never mix them in a single charge.

4. **No price removal** — Once a price is shown on homepage, it stays until explicitly changed by owner. No "simplification" that removes pricing transparency.

5. **Founder promo is quiet** — Founder promo field hidden by default in onboarding. No homepage mentions. No public marketing. Scarcity and exclusivity are the value.

6. **Onboarding reinforces responsibility** — Language must reflect delegation, not configuration. Examples:
   - ✅ "This helps LaunchBase decide what is safe to do on your behalf"
   - ✅ "Nothing deploys without your approval. You can stop at any time."
   - ❌ "Help us build your website"
   - ❌ "Configure your settings"

**Current Pricing (Locked):**

- **Core Website:** $499 setup + $49/mo
- **Social Media Intelligence:**
  - 4 posts: $149 setup + $59/mo
  - 8 posts: $199 setup + $99/mo
  - 12 posts: $249 setup + $149/mo
- **Enrichment Layer (optional):** $199 setup + $79/mo
- **Google Business:** $149 setup + $29/mo
- **QuickBooks Sync:** $199 setup + $39/mo

**Definition of Done:**
- ✅ Homepage shows all setup + monthly fees
- ✅ Onboarding shows prices before selection
- ✅ Enrichment Layer is separate line item
- ✅ Founder promo hidden by default
- ✅ Onboarding copy reinforces responsibility-ownership

**Enforcement:** Manual review of homepage and onboarding flow. Any price hiding or bundling requires owner approval.

**Common Pitfalls:**
- ❌ Don't remove prices to "simplify" homepage
- ❌ Don't bundle intelligence into base pricing
- ❌ Don't use "effort-based" without showing tiers
- ❌ Don't advertise founder promo publicly
