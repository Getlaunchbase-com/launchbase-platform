# LaunchBase Smoke Test (Forever Contract)

**Purpose:** Prove the entire paid-customer loop works end-to-end without surprises.

**Pass = we can sell. Fail = stop and fix.**

Runs in production using test cards / test flows.

---

## Preconditions (1 minute)

You can access:

- **LaunchBase site** (prod): https://getlaunchbase.com
- **Admin UI**: `/admin/*`
- **Your inbox**: support@getlaunchbase.com (production sender/reply-to)
- **Ops alerts inbox**: vince@vincessnowplow.com

**Cron jobs exist for:**
- Alerts: `/api/cron/alerts`
- Deployment worker: `/api/cron/run-next-deploy`
- Auto-advance: `/api/cron/auto-advance`

**Dashboards:**
- Health Dashboard: `/admin/health`
- Alerts UI: `/admin/alerts`

---

## Smoke Test Runbook

### 0) Start with Clean Baseline (2 minutes)

**Action:**
1. Open Health Dashboard: `/admin/health?tenant=vinces`
2. Confirm it loads and shows:
   - Deployments (last 24h)
   - Emails (last 24h)
   - Stripe webhooks (last 24h)
   - Uptime

**Record baseline values:**
- Deployments: success / failed / queued
- Emails: sent / failed
- Stripe: ok / failed / pending
- Active alerts count in `/admin/alerts?tenant=vinces`

✅ **PASS** if dashboards load and show tenant-filtered numbers.

---

### 1) Intake Smoke (Customer Entry)

**Action:**

Submit a real intake using URL-prefill routing. Use one of these:

- **New site**: `/apply?audience=biz&websiteStatus=none`
- **Refresh**: `/apply?audience=biz&websiteStatus=existing`
- **Integrate only**: `/apply?audience=biz&websiteStatus=systems_only`

Fill it out with a unique email (recommended format):
```
vince+smoke-YYYYMMDD-HHMM@vincessnowplow.com
```

**Expected:**
- Intake is created
- Tenant derived correctly: `vinces`
- `websiteStatus` stored in:
  - Column AND
  - `rawPayload.websiteStatus`

✅ **PASS** if:
- Intake exists in admin list/details
- `tenant=vinces`
- `websiteStatus` is correct

---

### 2) Email Smoke (Customer-Facing)

**Action:**

After intake submission, confirm:
- Intake confirmation email is received
- Copy matches the chosen `websiteStatus` variant:
  - `none` = "build from scratch"
  - `existing` = "refresh/modernize"
  - `systems_only` = "keep site + integrate"

**Expected:**
- Email arrives (not spam)
- Sender is professional (ex: `support@getlaunchbase.com`)
- Reply-to is correct
- Email logs show provider + status:
  - `deliveryProvider = resend`
  - `status = sent`
  - `errorMessage = null`

✅ **PASS** if:
- Email arrives
- Variant matches
- Email logs show `sent` via `resend`

---

### 3) Payment Smoke (Stripe Idempotency)

**Action:**

Trigger payment for the intake using the normal "create checkout" path.

Complete payment using Stripe test card:
```
Card: 4242 4242 4242 4242
Expiry: Any future date
CVC: Any 3 digits
ZIP: Any 5 digits
```

**Expected:**
- Stripe webhook processes successfully
- Intake becomes `paid`
- Exactly **one** payment record created
- Exactly **one** "deployment_started" (or equivalent) email created
- Replay does not duplicate anything

**Idempotency Check (REQUIRED):**

Run the same webhook event again (or re-trigger a replay path).

✅ **PASS** if:
- Payment count stays at 1
- Email count stays at 1
- Webhook shows `idempotencyHit=true` / retry count increments
- No duplicate side effects

---

### 4) Deployment Smoke (Template + Snapshot Guaranteed)

**Action:**

Trigger/allow deployment to run (worker cron or normal pipeline).

**Expected:**

A deployment record exists with:
- `templateVersion` populated
- `buildPlanSnapshot` populated
- `trigger = auto` (or `manual` if you ran it manually)

✅ **PASS** if:
- Deployment completes successfully
- Template version is present
- Snapshot is present
- Health dashboard updates counts

---

### 5) Rollback Smoke (Must Always Work)

**Action:**

From the deployments admin UI, click **Rollback** for that intake.

**Expected:**
- New deployment created
- `trigger = rollback`
- `rolledBackFromDeploymentId` populated
- Rollback deploy runs cleanly
- No cross-tenant rollback possible

✅ **PASS** if:
- Rollback creates a new deployment
- It references a previous successful deployment
- It completes (or at minimum queues correctly)

---

### 6) Alerts Smoke (Dedupe + Auto-Resolve)

#### Action A — Trigger an Alert

Create an alert condition for tenant `vinces`:
- **Easiest**: Mark or insert 3 email failures in the last 24h

Then run:
- cron-job.org "Run now" for Alerts job (`POST /api/cron/alerts`)

**Expected:**
- You receive exactly **one** ops alert email at: `vince@vincessnowplow.com`
- `/admin/alerts?tenant=vinces` shows an active alert
- Running cron again immediately results in:
  - `deduped` (no new email)

✅ **PASS** if:
- First run: `created>=1` and `sent>=1`
- Second run: `deduped>=1`, `sent=0`

#### Action B — Auto-Resolve

Clear the condition (remove the fake failures), run cron again.

✅ **PASS** if:
- Response shows `resolved>=1`
- UI shows alert moved to resolved

---

## Final Gate: "Go Live" Criteria

✅ **Ship is allowed only if ALL are true:**

1. ✅ Intake created and tenant correct
2. ✅ Customer email delivered with correct `websiteStatus` variant
3. ✅ Stripe payment processed once; replays create no duplicates
4. ✅ Deployment has `templateVersion` + `snapshot`
5. ✅ Rollback creates a rollback deployment
6. ✅ Alerts: trigger once, dedupe works, auto-resolve works

**If any step fails:**
1. **Stop**
2. **Fix root cause**
3. **Re-run the entire smoke test**

---

## Quick Reference

**Dashboards:**
- Health: `/admin/health`
- Alerts: `/admin/alerts`
- Intakes: `/admin/intakes`
- Deployments: `/admin/deployments`

**Cron Endpoints:**
- `/api/cron/alerts`
- `/api/cron/run-next-deploy`
- `/api/cron/auto-advance`

**Test Card:**
```
4242 4242 4242 4242
Any future expiry / Any CVC / Any ZIP
```

**Test Email Format:**
```
vince+smoke-YYYYMMDD-HHMM@vincessnowplow.com
```

---

## What This Smoke Test Guarantees

If this passes:

✔ **Payments cannot double-charge**
✔ **Deployments cannot silently break sites**
✔ **Rollbacks always work**
✔ **Alerts won't spam or go silent**
✔ **Tenants are isolated**
✔ **Emails are professional + reliable**

This is **enterprise-grade operational confidence**.

---

## Notes

- Run this test before any public push or major change
- Document any failures in `docs/INCIDENTS.md`
- Update this runbook if flows change
- This is the forever contract - if it passes, we can sell

**Last Updated:** Jan 8, 2026
