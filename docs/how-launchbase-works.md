# How LaunchBase Turns Intake → Live Site

## Purpose

LaunchBase's core product is not "websites." It's a repeatable, auditable system that converts customer intent into a correct live site with minimal back-and-forth.

The engine is designed to:

- **Ask** the customer for approvals in small, low-friction steps
- **Understand** replies safely (confidence gated)
- **Apply** changes deterministically
- **Confirm** outcomes and maintain an audit trail
- **Escalate** to humans only when needed

This prevents rework, support thrash, and "mystery state" debugging.

---

## The Architecture: 3 Layers

### Layer 1 — Core Engine (Do Not Bypass)

This is the "truth." Every meaningful customer decision flows through here.

#### Key entities

**`action_requests`**: the canonical unit of customer approval work

- Status machine: `pending → sent → approved/edited/needs_human → applied → locked` (and admin controls)
- Includes proposed value, checklist key, expiry, sendCount / lastSentAt

**`action_request_events`**: append-only audit ledger

- Who/what/when/why (actorType, reason, meta, timestamps)
- Never updated, never deleted

#### Core invariants

- The engine is **deterministic**: given the same inputs, it produces the same outcomes.
- "Apply" is guarded by **confidence thresholds + safe keys**.
- **Locks prevent re-asking** already approved items.
- **Every transition creates an audit event**.
- **Idempotency**: duplicate replies and retries cannot double-apply.

#### Files (conceptual)

- Sequencing logic (Day 0–3, later Day 4+)
- Classification + confidence scoring
- Apply + lock logic
- Event logging choke point (`logActionEvent()`)

---

### Layer 2 — Channels (Replaceable Interfaces)

Channels deliver "Ask / Approve / Edit / Confirm," but **do not own state**.

#### Email

**Provider:** Resend

**Outbound:** sends action request emails with:
- Approve link
- Edit link
- View Proposed Preview link (optional)

**Inbound:** Resend webhook classifies customer reply:
- `APPROVE` / `EDIT` / `UNCLEAR`
- Confidence score
- Apply automatically when safe, otherwise escalate

#### Admin UI

**Shows:**
- Status chips
- sendCount / lastSentAt
- Recent audit activity (last 5 events)

**Allows controlled actions:**
- Resend (rate-limited)
- Expire (reason required)
- Unlock (reason required)
- Admin Apply (reason required)

#### Cron

- Drives sequencing (Day 0–3 questions)
- Only advances when prior items are locked/expired/needs_human
- Never re-asks locked keys

#### Email transport abstraction

- `EMAIL_TRANSPORT=resend|log|memory`
- Business logic is transport-agnostic.
- Tests run on deterministic memory transport.

---

### Layer 3 — Website Output (Composable Result)

This layer is what customers ultimately see: previews and live sites.

#### Outputs

- Preview HTML (base template)
- "Proposed Preview" overlays (no DB writes)
- Final approved content pushed into build plan / deployment artifacts

**Important rule:** The website output is **downstream of approvals** — do not let templates or UI bypass the engine and mutate canonical values without events.

---

## The Canonical Workflow: Ask → Understand → Apply → Confirm

### 1) Ask

System generates a proposed value (from intake + templates) and sends a single-purpose email.

**Event examples:**
- `SENT` / `RESENT` (meta includes `resendMessageId`)

### 2) Understand

Customer response enters via:
- Approve link (token)
- Edit form (token)
- Reply-to email (webhook)

**Classification outputs:**
- `approved`
- `edited` (exact / ambiguous)
- `unclear` → needs human

**Event examples:**
- `CUSTOMER_APPROVED`
- `CUSTOMER_EDITED`
- `CUSTOMER_UNCLEAR`
- `ESCALATED`

### 3) Apply

If confidence meets threshold and key is safe:
- Apply the change
- Log `APPLIED`
- Lock key (prevent re-asking)
- Log `LOCKED`

### 4) Confirm

System sends confirmation and proceeds to next step (via sequencer) when safe.

---

## Operational Guardrails

### Rate limits

- **Resend cannot spam:** resend blocked if `lastSentAt < 10 minutes`

### Reasons required

All admin state changes require a reason:
- `ADMIN_APPLY`
- `ADMIN_EXPIRE`
- `ADMIN_UNLOCK`

### Audit logging never blocks flow

`logActionEvent()` must not throw. If logging fails, the system continues and writes to console.

---

## What "Done" Means

When this system is working:

- We can **reconstruct any customer journey from events alone**
- We can **safely automate 70%+ of refinement**
- Humans intervene **only on needs_human**
- Tests don't require real email delivery (`EMAIL_TRANSPORT=memory`)

---

## Do Not Break These Rules

1. **Don't mutate customer-facing canonical values without an event.**
2. **Don't bypass locks.**
3. **Don't add special cases in UI.**
4. **Don't couple business logic to Resend SDK.**

If you need a new behavior, **add it to the engine first**, then expose it through channels.

---

## Reference

- **Core Engine:** `server/action-requests.ts`, `server/action-request-events.ts`
- **Email Channel:** `server/email.ts`, `server/emailTransport.ts`, `server/api.webhooks.resend.ts`
- **Admin UI:** `server/routers/actionRequestsRouter.ts`
- **Cron:** `server/worker/actionRequestSequencer.ts`
- **Tests:** `server/__tests__/e2e-action-request-loop.test.ts`

---

## For New Team Members

Read this doc first, then:

1. Read `docs/NEVER_AGAIN.md` for anti-patterns
2. Read `docs/email-verification.md` for debugging email flows
3. Run E2E tests: `pnpm test e2e-action-request-loop`
4. Ask questions in context of the 3-layer model

---

## Version History

- **Jan 10, 2026:** Initial version documenting 3-layer architecture
- **Future:** Update when adding new channels (SMS, Slack, etc.)
