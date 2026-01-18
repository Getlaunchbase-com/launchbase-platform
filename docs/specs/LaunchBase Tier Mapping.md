# LaunchBase Tier Mapping

Based on the ExamplesViewer component and tier descriptions, here's the complete mapping:

## Tier Descriptions (from UI)

### Before
- **Description**: "Your starting point — functional, but not optimized for clarity or conversion."
- **Purpose**: Baseline/reference (not a purchasable tier)

### Standard
- **Description**: "Polish pass — tightened messaging, better spacing, clearer CTA hierarchy."
- **Purpose**: Entry-level tier with basic improvements

### Growth
- **Description**: "Conversion pass — trust strip, outcome bullets, proof elements."
- **Purpose**: Mid-tier focused on conversion optimization

### Premium
- **Description**: "Full transformation — premium positioning + design system + strongest hierarchy."
- **Purpose**: High-end tier with complete redesign and Builder.io execution

---

## Proposed Tier Mapping

### (a) Credit Counts Per Tier

| Tier | Credits Included | Cost Per Loop | Use Case |
|------|------------------|---------------|----------|
| **Standard** | **1 credit** | $0.26 | Single improvement loop, showroom preview only |
| **Growth** | **3 credits** | $0.26 | Multiple revision rounds (2-3 loops), showroom preview |
| **Premium** | **10 credits** | $0.26 | Multi-loop polish + Builder.io execution + pressure testing |

**Credit Rules:**
- Each "Request Changes" = 1 credit = 1 additional loop
- "Approve" = 0 credits consumed
- Buy-more packs: +1 credit ($X), +3 credits ($Y), +10 credits ($Z)

---

### (b) Loop Budgets Per Tier

| Tier | Initial Loops | Max Loops (with buy-more) | Budget Per Loop |
|------|---------------|---------------------------|-----------------|
| **Standard** | 1 loop | Unlimited (buy credits) | $0.30 max (P90) |
| **Growth** | 2-3 loops | Unlimited (buy credits) | $0.30 max (P90) |
| **Premium** | 5-10 loops | Unlimited (buy credits) | $0.30 max (P90) |

**Budget Constraints:**
- **Cost**: $0.26/loop (P50), $0.30/loop (P90)
- **Latency**: 76s/loop (P50), 95s/loop (P90)
- **Stack**: GPT-5.2 (systems) + GPT-4o-mini (brand) + Llama 8B (selector) + Sonnet 4.0 (critic)

---

### (c) Builder.io vs Showroom Routing

| Tier | Preview Type | Builder.io Enabled | Allowed Surfaces | Execution Flow |
|------|--------------|-------------------|------------------|----------------|
| **Standard** | **Showroom** | ❌ No | N/A | Intake → Field General → Creative Swarm → Showroom Preview → Approve → Deploy |
| **Growth** | **Showroom** | ❌ No | N/A | Intake → Field General → Creative Swarm (2-3 loops) → Showroom Preview → Approve → Deploy |
| **Premium** | **Builder.io** | ✅ Yes | `homepage_ui`, `landing_page_ui`, `pricing_ui` | Intake → Field General → Creative Swarm → **Builder Executor** → Pressure Test → Final Arbiter → Preview → Approve → Deploy |

**Builder.io Gating Rules:**
- **Premium tier only**: Builder.io is ONLY enabled for Premium customers
- **UI surfaces only**: Builder can ONLY modify safe UI surfaces (homepage_ui, landing_page_ui, pricing_ui)
- **No sensitive operations**: Builder CANNOT touch auth, payments, QuickBooks, email/SMS, phone routing
- **Multi-loop polish**: Premium includes pressure testing swarm + Final Arbiter (GPT-5.2) for ship/don't ship decisions

---

## Implementation Mapping

### Field General Tier Logic (runFieldGeneral.ts)

```typescript
function tierBudget(tier: Tier) {
  switch (tier) {
    case "standard":
      return {
        maxLoops: 1,
        maxUsdPerLoop: 0.30,
        maxSecondsPerLoop: 95,
        creditsIncluded: 1,
      };
    case "growth":
      return {
        maxLoops: 3,
        maxUsdPerLoop: 0.30,
        maxSecondsPerLoop: 95,
        creditsIncluded: 3,
      };
    case "premium":
      return {
        maxLoops: 10,
        maxUsdPerLoop: 0.30,
        maxSecondsPerLoop: 95,
        creditsIncluded: 10,
      };
  }
}

function tierBuilderGate(tier: Tier): BuilderGate {
  if (tier === "premium") {
    return {
      enabled: true,
      allowedSurfaces: ["homepage_ui", "landing_page_ui", "pricing_ui"],
      maxIterations: 5, // 3-5 builder passes for Premium
    };
  }
  return {
    enabled: false,
    reason: "tier_not_premium",
  };
}
```

### Database Schema (Intakes Table)

Add credits tracking to intakes:

```typescript
// drizzle/schema.ts
export const intakes = mysqlTable("intakes", {
  // ... existing fields ...
  
  // Credits tracking
  creditsIncluded: int("creditsIncluded").notNull().default(1),
  creditsRemaining: int("creditsRemaining").notNull().default(1),
  creditsConsumed: int("creditsConsumed").notNull().default(0),
});
```

### Portal API (requestChanges mutation)

```typescript
// server/routers/portal.ts
requestChanges: protectedProcedure
  .input(z.object({ runId: z.string() }))
  .mutation(async ({ ctx, input }) => {
    const ship = await getShipPacketByRunId(input.runId);
    if (!ship) throw new Error("ShipPacket not found");

    const intake = await getIntakeById(ship.intakeId);
    if (!intake) throw new Error("Intake not found");

    // Check credits
    if (intake.creditsRemaining <= 0) {
      return {
        ok: false,
        needsPurchase: true,
        message: "No revision credits remaining. Purchase more to continue.",
        checkoutUrl: null, // TODO: createStripeCreditCheckout(intake)
      };
    }

    // Consume 1 credit
    await decrementIntakeCredit(intake.id, 1);

    // Enqueue new loop
    await enqueueExecuteRunPlan(input.runId);

    return { ok: true, enqueued: true };
  }),
```

---

## Visual Hierarchy (from ExamplesViewer)

The tier progression shows clear visual improvements:

1. **Before → Standard**: Polish pass (spacing, hierarchy, CTA clarity)
2. **Standard → Growth**: Conversion pass (trust elements, proof, outcome bullets)
3. **Growth → Premium**: Full transformation (premium positioning, design system, strongest hierarchy)

This maps directly to the AI swarm intensity:
- **Standard**: 1 loop (basic improvements)
- **Growth**: 2-3 loops (conversion optimization)
- **Premium**: 5-10 loops (full redesign + Builder.io execution)

---

## Pricing Structure (from Homepage)

**LaunchBase Website Base:**
- Setup: $499
- Monthly: $49/month

**Tier Pricing (Proposed):**
- **Standard**: $499 setup + $49/month (1 credit included)
- **Growth**: $799 setup + $99/month (3 credits included)
- **Premium**: $1,499 setup + $199/month (10 credits included)

**Buy-More Credit Packs (Proposed):**
- +1 credit: $29
- +3 credits: $79
- +10 credits: $199

---

## Summary

✅ **Standard Tier**: 1 credit, 1 loop, showroom preview, $0.26/loop  
✅ **Growth Tier**: 3 credits, 2-3 loops, showroom preview, $0.26/loop  
✅ **Premium Tier**: 10 credits, 5-10 loops, Builder.io execution, $0.26/loop  

✅ **Builder.io**: Premium only, UI surfaces only (homepage_ui, landing_page_ui, pricing_ui)  
✅ **Credits**: "Request Changes" = 1 credit, "Approve" = 0 credits  
✅ **Buy-More**: Stripe checkout for +1/+3/+10 credit packs when exhausted  
