# 3-Run End-to-End Test Plan (Validation)

**Status:** READY TO EXECUTE  
**Version:** 1.0  
**Date:** 2026-01-10

---

## Goal

Prove the full system works in the wild with **3 real-ish customer runs** (can be your own test intakes), without changing features.

**We're validating 4 things:**

1. **Tier 1 design pass** actually triggers and persists (job/candidates/winner)
2. **Email automation loop** works end-to-end (Ask → Reply → Apply → Confirm)
3. **Payment-gated flow** stays correct (preview → approve → pay → post-pay actions)
4. **Alerts/guardrails** fire only when they should (schema guard / send failures / escalations)

---

## Human Manual Test Responsibilities (You + Manus)

### You (human) does only these:

1. Submit onboarding as "customer"
2. Open email on mobile + desktop
3. Click preview links
4. Reply to emails with: YES, an edit, and an unclear reply
5. Complete Stripe test payment (you already did this—do it once more in a clean run)

**That's it.**

### Manus does everything else:

- Create/monitor the intake
- Trigger cron endpoints
- Confirm DB records (action_requests, events, design_jobs, candidates)
- Verify status transitions + emails sent + Resend delivery IDs
- Verify applied changes show in preview
- Verify escalation email/flag occurs on unclear reply

---

## Manus AI Bot Responsibilities (What It Must "Own")

### A) Design Engine (Tier 1)

- On preview generation: create 1 design_job, generate 3 candidates, score them, persist winner
- Ensure same intake reloads reuses the job (no duplicates)
- Log events: CREATED → CANDIDATES → SCORED → SELECTED

### B) Ask → Understand → Apply → Confirm Loop

- **Ask:** send action email w/ Approve/Edit + View Proposed Preview
- **Understand:** classify inbound email reply (approve/edit/unclear) with confidence
- **Apply:** apply safe changes automatically when confident
- **Confirm:** send "✅ Updated" email and lock the checklist key
- **Escalate:** if unclear/low confidence → needs_human + ops/customer notification

### C) Ops Safety

- **Prevent spam:** resend cooldown + dedupe
- **Log everything:** action_request_events with message IDs
- **Alert on failure paths:** SEND_FAILED, ESCALATED, schema_out_of_date

---

## The Exact Test Plan (3 Runs)

Each run is one intake. You can reuse "Vince Snow Plow" but change the business name slightly to avoid collisions.

---

### Run 1 — Happy Path (Approve)

#### Human:

1. Submit intake + choose services
2. View preview
3. Pay (Stripe test)
4. Reply "YES" to first action email

#### Manus Must Verify:

- Payment → intake marked paid
- Cron created action request
- Email delivered (Resend messageId exists)
- Reply webhook processed
- Events chain includes: CUSTOMER_APPROVED → APPLIED → LOCKED
- Preview reflects approved change

**Pass condition:** zero human intervention.

---

### Run 2 — Edit Path (Customer Changes Wording)

#### Human:

1. Submit intake
2. Pay
3. Reply with a clear edit, e.g.  
   "Change headline to: Fast Snow Plowing & Salting in Chicago"

#### Manus Must Verify:

- Classified as CUSTOMER_EDITED with sufficient confidence
- Applied safely
- Confirm email sent
- Locked

**Pass condition:** edit applied without escalation.

---

### Run 3 — Unclear Reply (Should Escalate)

#### Human:

1. Submit intake
2. Pay
3. Reply: "hmm not sure, maybe make it better?"

#### Manus Must Verify:

- Classified CUSTOMER_UNCLEAR
- Status → needs_human
- ESCALATED event logged
- Ops/customer escalation notification sent (to the configured email)

**Pass condition:** nothing auto-applies; escalation occurs; no spam.

---

## Automation Tests to Run (Manus Does These)

### A) Cron Checks

- Call `POST /api/cron/action-requests` twice
- Confirm idempotency: no duplicate sends, no duplicate job creation

### B) Resend Verification

- Confirm Resend dashboard shows delivery
- Confirm `meta.resendMessageId` stored in events for SENT/RESENT

### C) Guardrail Checks

- Trigger a controlled SEND_FAILED (use EMAIL_TRANSPORT=log/memory in staging) and confirm:
  - SEND_FAILED event exists
  - No status marked "sent" incorrectly
  - Admin UI shows failure clearly

### D) Tier 1 Verification

- Confirm design_jobs exist for Tier 1 runs
- 3 candidates with scores
- Winner stable across reload

---

## "Test Alert Augment" — What You Should Test

Trigger/confirm these alerts exist and are readable:

- **schema_out_of_date** (only if schema missing; don't force in prod)
- **ESCALATED** (from Run 3)
- **SEND_FAILED** (from controlled failure test)

**Pass condition:** you get notified once, deduped, with intakeId + endpoint + reason + next steps.

---

## Manus's Marching Orders (Copy/Paste)

1. **Prepare 3 fresh intakes** (unique business names).

2. **For each intake:**
   - Ensure Tier 1 triggers (design_job + 3 candidates + winner)
   - Ensure payment marks intake paid
   - Run cron endpoint to send first action request
   - Confirm Resend delivered + messageId logged

3. **Coordinate with Vince to:**
   - Run 1: reply YES
   - Run 2: reply with a clear edit
   - Run 3: reply with an unclear message

4. **After each reply:**
   - Verify correct classification + confidence
   - Verify correct apply/escalate behavior
   - Verify confirmation email or escalation notification
   - Verify preview reflects final state (or remains unchanged on unclear)

5. **Produce a 1-page report:**
   - For each run: timestamps, event chain, any manual touch, and whether Tier 1 improved approval speed
   - Any failures: exact root cause + minimal fix proposal (no scope creep)

---

## Next Steps

Tell me which intake URL you want to start with (or just reuse `/admin/intake/1` if it's clean), and I'll turn this into a checklist-style runbook you can follow line-by-line on your next test.
