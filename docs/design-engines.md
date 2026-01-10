# Design Engines

**Last Updated:** Jan 10, 2026

---

## Philosophy

LaunchBase is a **business-launch + operations system** that outputs websites as **credentials, signals, and containers for ops** — not design objects.

Design is a **presentation quality modifier**, not a creative service.

**We are not a website company. We are not a design agency.**

---

## The Design Compiler Model

LaunchBase uses a **Design Compiler** approach:

```
DesignInput (business semantics)
  ↓
Design Engine (candidate generator)
  ↓
DesignOutput[] (layout tokens)
  ↓
PresentationScore (deterministic evaluation)
  ↓
Best Candidate (highest score)
  ↓
Preview → Approval → Deploy
```

**Key principle:** Design engines are **renderers, not thinkers**. They consume structured input and produce scored candidates. LaunchBase selects the winner.

---

## Design Engine Interface

All engines must implement this contract:

```typescript
interface DesignEngine {
  name: string;
  tier: "standard" | "enhanced" | "premium";
  
  // Generate design candidates
  generateCandidates(input: DesignInput, count: number): Promise<DesignOutput[]>;
  
  // Metadata
  cost: {
    fixed: number; // Monthly cost
    perSite: number; // Variable cost per generation
  };
  
  // Capabilities
  capabilities: {
    maxCandidates: number;
    avgGenerationTime: number; // seconds
    supportsExport: boolean;
  };
}
```

---

## Available Engines

### 1. Manus Engine (Standard)

**Status:** ✅ Active (default)

**Tier:** Standard

**Description:** LaunchBase's internal design engine. Fast, reliable, predictable. Optimized for credibility, clarity, and conversion.

**Capabilities:**
- Max candidates: 1 (standard) or 5 (enhanced)
- Generation time: <5s
- Export: Native (already in LaunchBase format)

**Cost:**
- Fixed: $0/mo
- Per-site: $0

**Use when:**
- Standard tier (default)
- Budget-sensitive customers
- Speed is critical
- Proven patterns are sufficient

**Strengths:**
- Zero marginal cost
- Fastest generation
- Fully controlled
- Deterministic output
- No external dependencies

**Limitations:**
- Limited aesthetic variety
- No trendy/experimental layouts

---

### 2. Framer Engine (Premium) 🚧

**Status:** 🚧 Planned (not implemented)

**Tier:** Premium

**Description:** Premium aesthetic layer using Framer's AI-powered design system. Best for high-visual industries (real estate, fitness, luxury services).

**Capabilities:**
- Max candidates: 6+
- Generation time: 30-90s
- Export: Code export to LaunchBase format

**Cost:**
- Fixed: ~$15-40/mo (Framer subscription)
- Per-site: ~$5-15 (API/credit usage)

**Use when:**
- Premium tier selected
- High-visual industry
- Customer explicitly requests "premium look"
- Confidence score indicates design matters

**Strengths:**
- Best-in-class aesthetics
- Component-based output
- Strong design system
- Motion/interaction polish

**Limitations:**
- Higher cost
- Slower generation
- Requires normalization to LaunchBase format
- External dependency

**Integration notes:**
- Framer generates layout + styling
- LaunchBase enforces structure, sections, ops
- Content unchanged
- One pass only (no revision loop)

---

### 3. Lovable Engine (Premium) 🚧

**Status:** 🚧 Planned (not implemented)

**Tier:** Premium

**Description:** SMB conversion-focused AI designer. Optimized for local services, appointments, and professional services.

**Capabilities:**
- Max candidates: 6+
- Generation time: 60-120s
- Export: Code export to LaunchBase format

**Cost:**
- Fixed: ~$25-50/mo (Lovable subscription)
- Per-site: ~$10-30 (usage-based)

**Use when:**
- Premium tier selected
- SMB/local service business
- Conversion optimization priority
- Appointment/booking-heavy

**Strengths:**
- SMB-oriented defaults
- Conversion-focused layouts
- AI copy + layout together
- Less "designer toy," more "business outcome"

**Limitations:**
- Higher cost
- Slower generation
- Early-stage tool (risk)
- Requires normalization

**Integration notes:**
- Lovable generates homepage + sections + copy
- LaunchBase Ask→Understand loop refines
- Still enforce LaunchBase structure
- One pass only

---

### 4. Shopify Engine (Commerce) 🚧

**Status:** 🚧 Planned (not implemented)

**Tier:** Commerce (separate product line)

**Description:** E-commerce tier for product catalogs, inventory, and transactions.

**Capabilities:**
- Max candidates: 1 (Shopify template)
- Generation time: Variable (depends on catalog size)
- Export: Shopify-hosted (not LaunchBase infra)

**Cost:**
- Fixed: $39+/mo (Shopify subscription, customer pays)
- Per-site: $0 (customer subscription)

**Use when:**
- Intake indicates products/inventory
- E-commerce workflow selected
- Customer needs cart/checkout/fulfillment

**Strengths:**
- Full e-commerce platform
- Proven at scale
- Customer pays hosting
- Separate product line (no complexity bleed)

**Limitations:**
- Different workflow entirely
- Not a "design engine" (full platform)
- Customer locked into Shopify

**Integration notes:**
- Separate intake flow
- Separate pricing
- LaunchBase handles onboarding + setup
- Shopify handles hosting + transactions

---

## Engine Selection Logic

```typescript
function selectEngine(input: DesignInput): DesignEngine {
  // Tier-based routing
  if (input.tier === "standard") {
    return ManusEngine;
  }
  
  if (input.tier === "enhanced") {
    return ManusEngine; // Enhanced = more candidates, same engine
  }
  
  if (input.tier === "premium") {
    // Industry-based routing
    if (input.industry === "trades" || input.industry === "appointments") {
      return LovableEngine; // SMB conversion focus
    }
    
    if (input.industry === "professional" || input.industry === "fitness") {
      return FramerEngine; // Aesthetic focus
    }
    
    // Default premium
    return FramerEngine;
  }
  
  // Commerce tier (separate product)
  if (input.primaryCTA === "buy" || input.serviceTypes.includes("products")) {
    return ShopifyEngine;
  }
  
  // Fallback
  return ManusEngine;
}
```

---

## Tier Definitions

### Tier 0: Standard (Default)

**Engine:** Manus  
**Candidates:** 1  
**Scoring:** Guardrails only  
**Speed:** <5s  
**Cost to you:** $0  
**Customer price:** Included  

**Customer promise:**  
> "We get your business live, credible, and operational — fast."

**Internal truth:**  
- Single candidate generation
- Minimal scoring (pass guardrails)
- Fastest path to preview
- Proven patterns only

---

### Tier 1: Enhanced Presentation

**Engine:** Manus (multi-candidate)  
**Candidates:** 3-5  
**Scoring:** Full PresentationScore rubric  
**Speed:** +30-60s  
**Cost to you:** $0 (AI-driven)  
**Customer price:** +$99-$199 one-time  

**Customer promise:**  
> "We run an enhanced presentation pass to optimize layout, visual clarity, and first impression — without changing your content or delaying launch."

**Internal truth:**  
- Generate 3-5 variants (different spacing, hero, typography)
- Score all candidates
- Select highest-scoring
- Still async, still automated
- No subjective promises
- No revision loop

**This is the sweet spot upsell.**

---

### Tier 2: Premium AI Presentation (Future)

**Engine:** Framer or Lovable  
**Candidates:** 6+ (includes external AI)  
**Scoring:** Full rubric + external layout models  
**Speed:** +2-5min  
**Cost to you:** $5-$30 per run  
**Customer price:** +$299-$599 one-time  

**Customer promise:**  
> "We run a premium presentation pass using advanced layout models, then normalize it into our operational system."

**Internal truth:**  
- Route to external AI designer
- Extract layout + styling (not freeform)
- Enforce LaunchBase structure/sections/ops
- One pass only
- Content unchanged
- Ops unchanged

**Important constraints:**  
- No subjective revision loop
- No tool name exposure (by default)
- Bounded scope (presentation only)
- Still LaunchBase workflow

---

## Non-Negotiables (All Engines)

No matter which engine generates candidates, LaunchBase **always enforces:**

1. **Structure:** Fixed page skeleton (Header→Hero→Trust→Services→Social Proof→CTA→Footer)
2. **Sections:** Approved section contracts (max width, allowed layouts, spacing rules)
3. **Guardrails:** Hard rules (font limits, contrast, mobile-safe, etc.)
4. **Scoring:** PresentationScore rubric determines winner
5. **Approval:** Customer approval required before deploy
6. **Audit:** All decisions logged in design_jobs + events
7. **Rollback:** Can revert to previous design
8. **Ops:** SEO, GBP, booking, payments unchanged

**Design engines are replaceable. Workflow is not.**

---

## Operational Guardrails

### Before Generation
- ✅ Intake validated
- ✅ Tier selected
- ✅ DesignInput normalized
- ✅ Engine available (health check)

### During Generation
- ⏱️ Timeout: 120s max
- 🔄 Retry: 3 attempts max
- 📊 Track: generation time, cost, errors

### After Generation
- ✅ Validate DesignOutput schema
- ✅ Check hard guardrails (auto-reject)
- ✅ Calculate PresentationScore
- ✅ Log to design_jobs table
- ✅ Select winner (highest score)

### On Failure
- 🚨 Alert: Notify admin
- 🔄 Fallback: Use Manus engine
- 📝 Log: Error + context
- 🛑 Never: Block customer flow

---

## Kill Switch

**Environment variable:** `DESIGN_ENGINE_OVERRIDE`

**Values:**
- `"auto"` (default): Use tier-based routing
- `"manus"`: Force all traffic to Manus engine
- `"enhanced"`: Force all to Manus enhanced (3-5 candidates)

**Use when:**
- External engine is down
- Cost spike detected
- Quality regression observed
- Testing/debugging

**Command:**
```bash
# Force all to Manus (safe mode)
export DESIGN_ENGINE_OVERRIDE="manus"

# Resume normal routing
export DESIGN_ENGINE_OVERRIDE="auto"
```

---

## Success Metrics

Track per engine:

### Performance
- **Generation time** (p50, p95, p99)
- **Success rate** (% completed without error)
- **Retry rate** (% requiring retry)
- **Timeout rate** (% exceeding 120s)

### Quality
- **Average PresentationScore** (per tier)
- **Score distribution** (histogram)
- **Auto-reject rate** (% failing guardrails)

### Business
- **Approval rate** (% approved without edits)
- **Edit rate** (% requiring customer edits)
- **Time to approval** (SENT → LOCKED)
- **Escalation rate** (% needing human review)
- **Conversion rate** (post-launch CTA performance)

### Cost
- **Fixed cost** (monthly subscription)
- **Variable cost** (per-site generation)
- **Total cost** (monthly burn)
- **Cost per approval** (total cost / approved sites)

---

## Confidence Learning Integration

Feed metrics back into:

1. **Engine selection** (which engine performs best per industry?)
2. **Candidate weighting** (which patterns score highest?)
3. **Rule thresholds** (adjust scoring weights)
4. **Default selections** (pre-select winning patterns)
5. **Tier recommendations** (auto-suggest premium for high-value)

**Goal:** System improves automatically. Premium design becomes predictive, not optional.

---

## Future Extensions

### Phase 1 (Current)
- ✅ Manus engine (standard + enhanced)
- ✅ DesignInput/DesignOutput schema
- ✅ PresentationScore rubric
- ✅ Tier routing logic

### Phase 2 (Next)
- 🚧 Framer engine integration
- 🚧 Lovable engine integration
- 🚧 Confidence learning feedback loop
- 🚧 Preview comparison UI (show multiple candidates)

### Phase 3 (Future)
- 🔮 Shopify engine (commerce tier)
- 🔮 Custom brand engine (elite tier)
- 🔮 A/B testing (deploy multiple, measure conversion)
- 🔮 Predictive tier selection (ML-based routing)

---

## References

- [Design Contract](./design-contract.md) - DesignInput/DesignOutput schemas
- [PresentationScore Rubric](./presentation-score-rubric.md) - Scoring system
- [How LaunchBase Works](./how-launchbase-works.md) - 3-layer architecture
- [NEVER_AGAIN.md](./NEVER_AGAIN.md) - Operational lessons

---

**Remember:** Design engines are **ingredients, not the product**. LaunchBase is the product. Engines are replaceable parts behind a stable interface.
