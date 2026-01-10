# Admin UI: Presentation Section (Frozen Copy)

**Status:** NOT YET IMPLEMENTED  
**Purpose:** Observability-only surface for Tier 1 Enhanced Presentation  
**Location:** Intake admin page (below intake summary, above action requests)

---

## ⚠️ Critical Constraints

This copy is **frozen** and **immutable**. It exists to:
- Prevent future feature creep
- Lock intent before shipping
- Ensure admin UI is observability, not control

**What This Is NOT:**
- ❌ Not a design picker
- ❌ Not a tuning interface
- ❌ Not a feedback form
- ❌ Not customer-facing
- ❌ Not required for launch

**What This IS:**
- ✅ Read-only observability
- ✅ Answers: "Did this help the customer move forward?"

---

## Section Title

```
Presentation
```

**Subtitle:**
> How the customer-facing site is visually presented. Content and operations are unchanged.

---

## Status Line

### When Tier 1 is active:
```
Presentation Mode: Enhanced (Tier 1)
Status: Completed
```

### When Tier 0:
```
Presentation Mode: Standard
```

### When fail-open:
```
Presentation Mode: Standard (fallback)
```

**Important:** Never show errors. Never show stack traces.

---

## Winner Summary (Always Visible)

```
Enhanced Presentation Result

Selected Variant: Trust-First
Presentation Score: 87 / 100
```

### Why this variant was selected

**Reason:**
- Clear visual hierarchy
- Trust signals visible above the fold
- Strong mobile clarity

> This presentation was selected automatically using LaunchBase rules.  
> No customer content or business logic was changed.

---

## Candidate Comparison (Collapsed by Default)

```
Presentation Candidates
```

| Variant       | Score | Rank |
|---------------|-------|------|
| Trust-First   | 87    | 🥇   |
| Balanced      | 81    | 🥈   |
| CTA-Focused   | 68    | 🥉   |

**Important:** Read-only. No controls. No "pick another" button.

---

## Signal Snapshot (Read-only)

```
Evaluation Signals
```

- ✔ Readability
- ✔ Visual hierarchy
- ✔ Mobile fold clarity
- ✔ CTA prominence
- ✔ Brand restraint

> Signals are evaluated deterministically.  
> Scores are logged for learning, not tuning.

---

## Guardrail Notice (Small, Grey Text)

> Admins cannot select, rerun, or override presentation variants.  
> LaunchBase evaluates presentation outcomes based on customer behavior.

**Why this line matters:**  
It stops future feature creep. It locks the system as a compiler, not a design tool.

---

## Debug Metadata (Tiny, Optional)

```
Job ID: 8
Generated at: 2026-01-09 14:32
Reused on reload: Yes
```

This is for internal debugging only. Not customer-facing.

---

## Implementation Notes

**When to build this:**
- ✅ After observing 3-5 real customers
- ✅ After proving Tier 1 reduces time-to-approval
- ✅ After deciding to price or kill Tier 1

**When NOT to build this:**
- ❌ Before observation period
- ❌ Before proving value
- ❌ Before defining kill criteria

**Tech stack:**
- tRPC: `designJobs.byIntake` query (already implemented)
- Component: `DesignPresentationCard.tsx` (not yet created)
- Location: Intake admin page

---

## Observation Period (Current Phase)

**Do NOT build UI yet.**

Instead, manually track for 3-5 customers:

| Intake | Tier | Time to Approval | Edits | Preview Viewed | Human Needed |
|--------|------|------------------|-------|----------------|--------------|
|        |      |                  |       |                |              |

**Decision criteria:**
- If Tier 1 is faster + fewer edits → Price it
- If Tier 1 is same/worse → Kill it or fold into Tier 0

---

## Next Steps (After Observation)

1. **If Tier 1 wins:** Build this UI, price at $149, ship
2. **If Tier 1 loses:** Kill Tier 1, fold learnings into Tier 0
3. **If unclear:** Extend observation to 10 customers

**Do NOT:**
- Tweak scoring weights during observation
- Add Tier 2 before proving Tier 1
- Turn this into a design dashboard
