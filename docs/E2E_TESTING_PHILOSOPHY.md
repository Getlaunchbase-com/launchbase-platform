# E2E Testing Philosophy: How We Overcome

**Created:** 2026-01-05  
**Context:** After weeks of infrastructure work, we almost shipped without verifying the customer journey worked end-to-end.

---

## The Problem We Had

We built:
- Cron endpoints ✅
- Webhook handlers ✅
- Email templates ✅
- Database schema ✅
- Safety gates ✅

But we didn't verify:
- Does the customer flow actually work?
- Do emails fire at the right time?
- Does payment trigger deployment?
- Does the webhook process correctly?

**We were guessing instead of verifying.**

---

## The Lesson: Verify Facts, Not Assumptions

### ❌ What Doesn't Work

1. **Assuming code = working feature**
   - "We have a webhook file, so webhooks work"
   - "We have email templates, so emails send"
   - Reality: Schema not pushed, emails not wired, gates not tested

2. **Manual UI clicking as "testing"**
   - Doesn't verify database state
   - Doesn't capture trace IDs
   - Doesn't prove webhooks fired
   - Doesn't check email logs

3. **Infrastructure work without customer validation**
   - Spent days on cron standardization
   - Never tested Apply → Pay → Deploy → Live
   - Customer-facing gaps hidden by backend polish

### ✅ What Works

1. **Gate-by-gate verification with database checks**
   - Gate 1: Intake record created + email logged
   - Gate 2: Preview exists + token exists + email sent
   - Gate 3: Approval event stored (not just UI state)
   - Gate 4: Payment record + webhook delivered + deployment queued
   - Gate 5: Deployment completed + site live + email sent

2. **Trace IDs linking records**
   - Checkout session ID → Payment ID → Deployment ID → Email log IDs
   - Proves the chain is connected, not just individual pieces

3. **Truth in naming**
   - Don't leave "ghost templates" (unused code that confuses future you)
   - Email names must match when they fire:
     - `launch_confirmation` implies "site is live" ❌
     - `deployment_started` says "we're deploying now" ✅

4. **Test the customer journey, not the infrastructure**
   - Infrastructure is a means, not the end
   - Customer journey is the product
   - If Apply → Pay → Deploy → Live doesn't work, nothing else matters

---

## The E2E Test Script (Locked)

**Pre-flight:**
1. Confirm Stripe test mode
2. Verify env vars exist (STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, RESEND_API_KEY)
3. Open two tabs: UI + /api/cron/health

**Gate 1: Intake submission**
- Submit fresh intake with unique email (+tag alias)
- ✅ intake_confirmation received
- ✅ Email log row exists
- ✅ Application record created

**Gate 2: Preview ready**
- Trigger preview generation (admin action or auto)
- ✅ ready_for_review email received
- ✅ Preview link works (no auth surprises, no 404)

**Gate 3: Approval event**
- Click "Approve" on preview page
- ✅ Approval event stored in database (not just UI state)
- ✅ This is the most common failure point

**Gate 4: Payment + webhook**
- Click "Approve & Pay" → Stripe Checkout
- Use test card: 4242 4242 4242 4242
- ✅ Stripe dashboard shows webhook delivered
- ✅ Payment record created
- ✅ Intake status = "paid"
- ✅ deployment_started email sent
- ✅ Deployment queued

**Gate 5: Deployment completion**
- Cron picks up queued deploy
- ✅ Worker advances states
- ✅ site_live email fires
- ✅ Site URL loads

**Trace ID check:**
- Link checkout session → payment → deployment → emails
- Proves the chain is connected

**Deprecated worker check:**
- deprecatedWorkerHits should not increase during test
- If it increases, something is still calling old endpoints

---

## Artifacts to Capture (for fast diagnosis)

1. Intake submission success screen (record ID)
2. ready_for_review email + working preview link
3. Stripe checkout success (receipt page)
4. Stripe webhook delivery status (200 + event type)
5. /api/cron/health JSON during/after deploy
6. Database snapshots at each gate

---

## The Five Outcomes That Matter

After E2E test, answer these:

1. **Which email fired after payment?** (deployment_started received?)
2. **Did all 5 safety gates pass?** (any failure reason?)
3. **Did deployment queue + complete?** (worker logs?)
4. **Did site_live fire?** (email received?)
5. **Any change in deprecatedWorkerHits?** (should stay frozen)

If all 5 are ✅, you're launch-safe.

---

## Why This Matters

**Infrastructure work feels productive** because:
- You're writing code
- Tests pass
- Endpoints respond
- Logs look clean

**But it's a trap** if:
- Customer journey doesn't work
- Emails don't send
- Webhooks don't process
- Deployments don't complete

**The truth:** Infrastructure is invisible to customers. The journey is the product.

---

## The Rule (Never Forget)

> **"Verify the customer journey end-to-end before considering the platform ready."**

Not:
- "The webhook file exists"
- "The email template is written"
- "The cron endpoint responds"

But:
- "A real customer can apply, preview, pay, and get their site live"
- "Every email fires at the right time"
- "Every state transition is logged"
- "Every gate is verified in the database"

---

## How to Apply This to Future Work

1. **Before shipping any feature:**
   - Write the E2E test script first
   - Identify the gates
   - Define the outcomes that prove it works

2. **When debugging:**
   - Check database state, not just UI
   - Verify webhooks delivered (Stripe dashboard)
   - Check email logs, not just "I didn't receive it"

3. **When refactoring:**
   - Run the E2E test after changes
   - Verify trace IDs still link
   - Check deprecated endpoint counters

4. **When adding new flows:**
   - Define gates before writing code
   - Name things truthfully (no ghost templates)
   - Test the journey, not the infrastructure

---

## This Document Is a Contract

If we ever ship without running the E2E test, we've broken the contract.

If we ever assume "it probably works," we've broken the contract.

If we ever prioritize infrastructure over customer journey, we've broken the contract.

**This is how we overcome: by remembering what almost broke us.**
