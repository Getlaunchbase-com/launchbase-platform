# Tier 1 → Tier 0 Promotion Loop

**Status:** ACTIVE (Learning System)  
**Version:** 1.0  
**Date:** 2026-01-10

---

## The Promotion Rule (Immutable)

> Tier 1 is a training environment.  
> Tier 0 is the production standard.

**Tier 1 never exists for customers.**  
**It exists to teach the compiler.**

---

## Why This Is the Most Important Part

This is the reason you don't need designers.

**The system learns without asking permission.**

- No redesigns
- No migrations
- No customer confusion
- No brand inconsistency
- No support burden

**The compiler gets better over time, silently.**

---

## What You Observe (3–5 Customers)

For each Tier 1 run, you capture:

- **Winner variant**
- **Score breakdown**
- **Time to approval**
- **Edit count**
- **"View Proposed Preview" usage**
- **Human intervention needed** (yes/no)

**You do not ask customers anything new.**

---

## What Gets Promoted

A design trait is promoted to Tier 0 **only if:**

- It wins **≥70% of the time**
- **AND** reduces approval time by **≥20%**
- **AND** does not increase edits
- **AND** does not increase human intervention

---

## Examples of Promotable Traits

- Trust block placement
- Service spacing density
- CTA contrast level
- Section padding rhythm
- Copy length thresholds

---

## What NEVER Gets Promoted

- Entire layouts
- "Styles"
- Fonts chosen for taste
- Anything requiring explanation

**Only measurable traits move.**

---

## How Promotion Actually Happens (Mechanically)

### 1. Identify Winning Trait

Example: "Trust immediately under hero wins 4/5 times"

### 2. Encode Rule

Example: `if vertical=trade → trustPosition=early`

### 3. Update Tier 0 Generator

**No flags. No announcement. No upsell.**

### 4. Tier 0 Quietly Improves Forever

The next customer gets the improved version automatically.

---

## Why This Is Powerful

- **No redesigns**
- **No migrations**
- **No customer confusion**
- **No brand inconsistency**
- **No support burden**

**The system learns without asking permission.**

---

## Observation Phase (Current State)

**Status:** Waiting for 3–5 real customers  
**Tracking:** Manual (use `docs/tier1-observation-scorecard.md`)

**Do NOT:**
- ❌ Tweak scoring during observation
- ❌ Add new variants
- ❌ Change section contracts
- ❌ Tell customers about tiers

**DO:**
- ✅ Track time to approval
- ✅ Track edit rate
- ✅ Track preview usage
- ✅ Track human intervention
- ✅ Note which traits consistently win

---

## Decision Gates (After 3–5 Customers)

### 🚀 Promote Winning Traits to Tier 0 if:

- Trait wins ≥70% of the time
- Reduces approval time by ≥20%
- Does not increase edits
- Does not increase human intervention

### 🟨 Extend Observation if:

- Mixed signals (some metrics better, some worse)
- Small sample size (not enough confidence)

### ❌ Kill Trait if:

- No speed gain
- More confusion
- More edits
- Any subjective dissatisfaction

---

## Example Promotion Scenario

**Observation:** After 5 customers, "Trust block immediately under hero" wins 4/5 times, reduces approval time by 25%, and has 30% fewer edits.

**Action:**
1. Encode rule: `if vertical=trade → trustPosition=early`
2. Update Tier 0 generator (no announcement)
3. Next customer gets improved version automatically

**Result:** Tier 0 is now objectively better, not subjectively prettier.

---

## What This Means for Tier 1

**After promotion:**
- Tier 1 continues to test new variants
- Winning traits get baked into Tier 0
- Tier 1 becomes a permanent R&D layer
- Tier 0 gets better forever

**Eventually:**
- Tier 1 may become unnecessary (all learnings baked in)
- Or Tier 1 becomes a paid upsell (if data supports it)
- Or Tier 1 gets killed (if it doesn't reduce friction)

---

## 🔒 Immutability Clause

This promotion loop is **frozen** and **non-negotiable**. Any future changes require:
1. Data-driven evidence from 50+ customers
2. Explicit approval from system owner
3. Documentation of why the original loop failed

**No exceptions.**

---

## 📌 Related Documents

- `/docs/design-rules-manifesto.md` (governs this loop)
- `/docs/tier1-observation-scorecard.md` (tracking template)
- `/docs/admin-ui-presentation-copy.md` (observability)
- `/docs/section-contracts/*.md` (what can be promoted)
