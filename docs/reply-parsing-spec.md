# Reply Parsing + Confidence Scoring Spec

**LaunchBase Async Refinement Engine**

---

## 1. Core Goal

Turn messy human email replies into safe, deterministic actions:

- **Approve** → lock + apply
- **Edit** → apply change + confirm
- **Unclear** → ask follow-up
- **Risky** → pause + escalate

**No double-asking. No silent changes. No guessing.**

---

## 2. Message Model (What the Bot Sends)

Every outbound bot email must include:

```typescript
{
  messageId: string,          // immutable
  intakeId: string,
  tenant: string,
  checklistItemId: string,    // what this affects
  proposedValue: string,      // what we're asking to approve
  actionType: "approve" | "edit" | "choose" | "connect",
  allowedReplies: string[],   // YES / NO / READY / SKIP / text
  sentAt: timestamp
}
```

**Critical:** Every reply is scoped to ONE checklist item.

---

## 3. Reply Intake Pipeline

### Step 1: Normalize Input

```
rawReply
→ trim
→ lowercase
→ remove signatures
→ remove quoted text
→ detect emojis
```

**Store original text forever. Never mutate it.**

---

### Step 2: Classify Reply Type

**Order matters.**

```typescript
if (reply ∈ ["yes", "y", "ok", "approved", "👍"]) {
  intent = "APPROVE"
}
else if (reply ∈ ["no", "skip", "later"]) {
  intent = "REJECT"
}
else if (reply contains change words) {
  intent = "EDIT"
}
else if (reply ∈ ["ready", "connected", "done"]) {
  intent = "READY"
}
else {
  intent = "UNCLEAR"
}
```

---

## 4. Confidence Scoring (0.0 → 1.0)

Each reply gets a confidence score.

### Base Scores

| Intent | Base Score |
|--------|-----------|
| APPROVE | 0.95 |
| READY | 0.90 |
| EDIT | 0.75 |
| REJECT | 0.70 |
| UNCLEAR | 0.30 |

### Modifiers

- ✅ Exact keyword match → **+0.05**
- ⚠️ Long reply (>300 chars) → **−0.10**
- ⚠️ Multiple requests → **−0.15**
- ⚠️ Question marks → **−0.10**
- ⚠️ Contradictions → **−0.25**

**Clamp between 0.0–1.0.**

---

## 5. Decision Thresholds

```typescript
if (confidence >= 0.85) {
  autoApply()
}

if (0.60 ≤ confidence < 0.85) {
  applyIfSafe()
  // OR ask clarification (1 follow-up max)
}

if (confidence < 0.60) {
  pauseAndEscalate()
}
```

### Rule:

> **The system must never apply irreversible changes below 0.85.**

---

## 6. Apply Logic (Safe by Design)

### APPROVE

1. Lock checklist item
2. Apply proposed value
3. Write version snapshot
4. Send confirmation email

### EDIT

1. Parse delta only (diff-based)
2. Apply change
3. Lock new value
4. Confirm with "✅ Updated"

### REJECT / SKIP

1. Mark deferred
2. Schedule retry window (e.g. 14 days)
3. **Do NOT re-ask immediately**

### READY (Integrations)

1. Move item to "connection in progress"
2. Trigger next system action (OAuth, invite email, etc.)

---

## 7. Escalation Rules (Human-in-the-loop)

**Escalate if ANY of the following:**

- Confidence < 0.60
- Mentions money, legal, cancellation, refunds
- Mentions "not sure", "confused", "call me"
- Multiple checklist items referenced

### Escalation packet includes:

```typescript
{
  intakeId,
  checklistItemId,
  proposedValue,
  customerReply,
  confidenceScore,
  recommendedAction
}
```

---

## 8. Locking & Memory (Never Ask Twice)

Once applied:

```typescript
checklistItem.status = "locked"
checklistItem.lockedBy = "customer_approval"
checklistItem.lockedAt = timestamp
```

**Future changes require:**

- Explicit new question
- Explicit new approval

---

## 9. Maintenance Mode (Same Engine)

This exact engine handles:

- Google category rejection
- Platform rule changes
- Data drift
- Feature upgrades

**Only the prompt text changes. The logic does not.**

---

## 10. Why This Wins

- ✅ Deterministic
- ✅ Auditable
- ✅ Safe
- ✅ Scales without meetings
- ✅ Customers feel in control without work

**This is responsibility-as-a-service, operationalized.**

---

## Implementation Checklist

- [ ] Create `refinement_messages` table
- [ ] Create `refinement_replies` table
- [ ] Implement reply normalization function
- [ ] Implement intent classification
- [ ] Implement confidence scoring
- [ ] Build auto-apply logic with thresholds
- [ ] Create escalation notification system
- [ ] Add locking mechanism to checklist items
- [ ] Build confirmation email templates
- [ ] Create inbound email webhook
- [ ] Add cron job for sending next question
- [ ] Write tests for all confidence scenarios
