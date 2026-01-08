# LaunchBase Intelligence Core

**Hard Contract · Versioned · Non-Negotiable**

This document defines the single source of truth for all automated behavior across every customer website, module, and future user interface. It is the constitutional foundation of the LaunchBase platform.

---

## 1. Definition

The **LaunchBase Intelligence Core** is a deterministic decision engine that converts context and configuration into safe, relevant, and human-appropriate actions. It is:

- **Authoritative** — The only source of truth for all decisions
- **Versioned** — Every decision is traceable to a specific version
- **Immutable per execution** — No retroactive changes to past decisions
- **UI-agnostic** — Operates independently of any user interface

**Critical principle:** No UI, API, or human override may bypass the Intelligence Core.

---

## 2. Non-Negotiable Guarantees (Hard Rules)

These rules apply to every customer, every post, every deployment, forever. They cannot be waived, disabled, or overridden.

### Rule 1: Safety Always Wins

Weather gating cannot be overridden. Emergency or hazardous conditions suppress marketing output. Silence is a valid output.

**Guarantee:** If conditions are unsafe → NO POST

This applies to:
- Severe weather (storms, floods, extreme heat/cold)
- Emergency declarations
- Public safety alerts
- Hazardous air quality

### Rule 2: Context Is Read-Only

Intelligence layers observe reality; they never invent events or speculate.

**Allowed sources:**
- Weather data (National Weather Service)
- Public schedules (sports, schools, holidays)
- Publicly verifiable trends (Google Trends, news)
- Business hours and operations

**Forbidden:**
- Opinions or commentary
- Political statements
- Tragedy exploitation
- Rumors or unverified claims

### Rule 3: Industry Interprets Context

The same input produces different outputs depending on industry context. The interpretation logic lives only in the Core.

**Example:**
```
Input: Snowstorm

Snow removal business → "We're ready. Call now for emergency service."
Bar/restaurant → "Cozy indoor specials while it snows outside."
Bakery → "Fresh delivery available despite weather."
```

### Rule 4: UI Can Tune, Never Decide

The user interface may adjust weights, enable/disable layers, and change cadence. It may NOT decide what is safe, what is relevant, or force output.

**UI capabilities:**
- Adjust layer weights (0–100%)
- Enable/disable layers
- Change posting cadence
- Switch between modes (Auto/Guided/Custom)
- Preview outcomes

**UI limitations:**
- Cannot override safety gates
- Cannot force posts during unsafe conditions
- Cannot disable industry logic
- Cannot bypass approval requirements

### Rule 5: Every Output Is Explainable

Every post must be traceable to its inputs, rules, and version. No "the AI decided" explanations.

**Traceability includes:**
- Triggering context (weather, event, trend)
- Industry interpretation applied
- Layer weights used
- Safety gates evaluated
- Version of Intelligence Core used
- Approval status and timestamp

---

## 3. Canonical Intelligence Schema

This is the only object the UI is permitted to modify. It is a declarative contract, not a set of instructions.

```json
{
  "industry": "bar_restaurant",
  "cadence": "medium",
  "mode": "auto",
  "layers": {
    "weather": "locked",
    "sports": "high",
    "community": "low",
    "trends": "off"
  },
  "tone": "professional",
  "approval_required": true,
  "intelligence_version": "v2.4.0"
}
```

### Schema Fields

| Field | Type | Values | Notes |
|-------|------|--------|-------|
| `industry` | string | `bar_restaurant`, `snow_removal`, `plumber`, etc. | Determines context interpretation |
| `cadence` | string | `low`, `medium`, `high` | Posts per week (3, 5, 7) |
| `mode` | string | `auto`, `guided`, `custom` | Presentation mode (see Modes section) |
| `layers.weather` | string | `locked`, `on`, `off` | Weather layer state |
| `layers.sports` | string | `off`, `seasonal`, `playoffs` | Sports layer state |
| `layers.community` | string | `off`, `low`, `medium`, `high` | Community events layer |
| `layers.trends` | string | `off`, `low`, `medium`, `high` | Trend layer state |
| `tone` | string | `conservative`, `professional`, `energetic` | Voice guardrails |
| `approval_required` | boolean | `true`, `false` | Require approval before posting |
| `intelligence_version` | string | `v2.4.0` | Version of Intelligence Core |

### Important Constraints

- This schema is **declarative** — it describes what to do, not how to do it
- No logic lives in this schema
- No branching or conditional logic
- No side effects
- It is a contract between UI and Core, not a set of instructions

---

## 4. Versioning System

Every execution references an explicit version. This allows safe improvements without fear of regression.

### Version Format

```
vMAJOR.MINOR.PATCH
```

### Increment Rules

**PATCH** — No behavior change
- Copy tweaks (grammar, tone refinement)
- Template refinements
- Bug fixes that don't affect logic
- Example: `v2.4.0` → `v2.4.1`

**MINOR** — Non-breaking expansion
- New layer added (e.g., "local events")
- New industry profile added
- Non-breaking rule expansion
- New tone option
- Example: `v2.4.0` → `v2.5.0`

**MAJOR** — Breaking change
- Decision logic changes
- Safety model changes
- Industry reinterpretation
- Cadence algorithm changes
- Example: `v2.4.0` → `v3.0.0`

### MAJOR Version Requirements

When a MAJOR version is released, customers must:
1. Explicitly opt-in to the new version
2. Review a new preview with the updated logic
3. Re-approve their configuration
4. Acknowledge the change in writing

This prevents silent regressions and maintains trust.

### Version Tracking

Every post, preview, and approval must record:
```json
{
  "post_id": "...",
  "intelligence_version": "v2.4.0",
  "generated_at": "2025-12-22T21:00:00Z",
  "approved_at": "2025-12-22T21:05:00Z"
}
```

---

## 5. Intelligence Pipeline (Locked Order)

This order is immutable. No step may be skipped or reordered.

1. **Gather Inputs** — Collect weather, events, trends, time
2. **Normalize Context** — Convert raw data to standard format
3. **Apply Safety Gates** — Check for unsafe conditions
4. **Apply Industry Matrix** — Interpret context for this industry
5. **Apply Cadence Rules** — Check if posting is allowed today
6. **Apply Layer Weights** — Evaluate enabled layers
7. **Decide** — Post | Wait | Silence
8. **Generate Copy** — Create post text
9. **Attach Attribution** — Log version, inputs, rules applied
10. **Await Approval** — If required, wait for human approval

**Critical rule:** If step 3 (Safety Gates) fails, exit immediately. No post is generated.

---

## 6. Intelligence Layers (Read-Only Modules)

Each layer implements this interface:

```typescript
interface IntelligenceLayer {
  name: string;                          // e.g., "Weather", "Sports"
  confidence: number;                    // 0–1, how confident is this layer?
  relevance: number;                     // 0–1, how relevant to this industry?
  allowedIndustries: string[];           // Industries where this layer applies
  weatherCompatibility: WeatherState[];  // Weather conditions where this layer works
  evaluate(): LayerResult;               // Returns { shouldPost, weight, reasoning }
}
```

### Layer Capabilities

Layers can be:
- **Enabled** — Actively evaluated
- **Disabled** — Skipped in pipeline
- **Weighted** — Influence on final decision (0–100%)

### Layer Limitations

Layers cannot:
- Override safety gates
- Override industry logic
- Force output
- Bypass approval requirements
- Modify other layers

### Standard Layers

**Weather Layer**
- Monitors NWS data
- Triggers operational updates (snow removal, HVAC, etc.)
- Suppresses marketing during hazardous conditions
- Always locked for safety-critical industries

**Sports Layer**
- Monitors local sports schedules
- Triggers engagement posts (game day, playoffs, etc.)
- Industry-dependent (bars/restaurants vs. professional services)
- Can be seasonal or always-on

**Community Layer**
- Monitors local events (schools, holidays, festivals)
- Triggers relevant content
- Highly industry-dependent
- Can be weighted by relevance

**Trends Layer**
- Monitors Google Trends, news
- Triggers timely content
- Requires weather compatibility check
- Can be disabled for conservative industries

---

## 7. How This Solves Growing Pains

### Problem: Duplicated Logic Per Customer

**Before:** Logic scattered across customer sites, admin UI, and email templates.

**After:** Single Intelligence Core. Every customer uses the same logic.

### Problem: Regressions and Drift

**Before:** Fixing logic in one place breaks another. Features interact unpredictably.

**After:** Versioning system. Every decision is traceable. Regressions are detectable.

### Problem: Fear of Adding Features

**Before:** Adding a new layer or industry requires ripping apart existing code.

**After:** New features are additive. Add a layer, add an industry, no regressions.

### Problem: Special-Casing Customers

**Before:** "This customer needs different logic" → custom code path.

**After:** All customers use the same Core. Customization is configuration, not code.

---

## 8. What Comes Next (Safely)

Now that the Intelligence Core is locked, it is safe to build:

### Customer Control UI
- Sliders become layer weights
- Toggles become layer flags
- Auto/Guided/Custom are presentation modes
- No risk of breaking logic

### Mobile App Upsell
- Same schema
- Same core
- Zero regression risk
- New revenue stream

### Vertical Expansion
- Add new industry profile
- Zero regression
- Instant availability to all customers

### Integration Expansion
- Add new channels (Google Business, LinkedIn, etc.)
- Same core logic
- Same safety guarantees

---

## 9. Governance

### Who Owns the Intelligence Core?

The Core is owned by the LaunchBase platform team. Customers do not own it.

Customers own:
- Their configuration (schema)
- Their approval decisions
- Their content (within safety rules)

### How Is the Core Updated?

1. Proposed change is documented
2. Version number is assigned
3. Impact analysis is performed
4. Testing is completed
5. Changelog is published
6. Customers are notified
7. If MAJOR: explicit opt-in required

### How Are Bugs Fixed?

- **Logic bug** → PATCH version (if no behavior change) or MINOR (if behavior changes)
- **Safety issue** → MAJOR version, immediate notification, optional rollback
- **Copy/tone issue** → PATCH version

---

## 10. Audit Trail

Every post must be auditable. The system records:

```json
{
  "post_id": "...",
  "customer_id": "...",
  "intelligence_version": "v2.4.0",
  "configuration": { /* schema */ },
  "inputs": {
    "weather": { /* NWS data */ },
    "events": [ /* local events */ ],
    "trends": [ /* trending topics */ ]
  },
  "pipeline_steps": [
    { "step": "gather_inputs", "status": "pass" },
    { "step": "safety_gates", "status": "pass" },
    { "step": "industry_matrix", "status": "pass" },
    { "step": "cadence_rules", "status": "pass" },
    { "step": "layer_weights", "status": "pass" },
    { "step": "decision", "result": "post", "confidence": 0.87 }
  ],
  "generated_post": { /* content */ },
  "approval": {
    "required": true,
    "approved_by": "...",
    "approved_at": "2025-12-22T21:05:00Z"
  },
  "published_at": "2025-12-22T21:30:00Z"
}
```

This audit trail serves:
- **Legal protection** — Prove you followed rules
- **Debugging** — Understand why a post was generated
- **A/B testing** — Compare versions
- **Compliance** — Demonstrate safety

---

## 11. Implementation Checklist

- [ ] Add `intelligence_version` field to `social_posts` table
- [ ] Add `intelligence_version` field to `deployments` table
- [ ] Create `IntelligenceCore` service class
- [ ] Implement Intelligence Pipeline (steps 1–10)
- [ ] Implement Safety Gates module
- [ ] Implement Industry Matrix
- [ ] Implement Layer evaluation
- [ ] Create audit trail logging
- [ ] Add version migration tests
- [ ] Document all layers
- [ ] Create rollback procedures
- [ ] Set up version monitoring

---

## 12. References

This specification is based on platform-grade SaaS principles used by:
- Stripe (versioned API)
- Shopify (app ecosystem)
- HubSpot (workflow engine)

The goal is the same: build once, improve forever, without breaking trust.

---

## Document History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-12-22 | Initial specification |

---

## Questions & Clarifications

**Q: Can a customer disable the Safety Gates?**  
A: No. Safety Gates are non-negotiable. They apply to every customer, always.

**Q: What if a customer wants different logic?**  
A: They adjust configuration (layers, weights, cadence). The Core logic remains the same.

**Q: How do we handle new industries?**  
A: Add a new industry profile to the Industry Matrix. No changes to Core logic.

**Q: Can we roll back to an old version?**  
A: No. We move forward only. If a MAJOR version has issues, we release a fix (v3.0.1) not a rollback.

**Q: Who approves Intelligence Core changes?**  
A: The platform team. Customers do not approve Core changes, only their configuration.
