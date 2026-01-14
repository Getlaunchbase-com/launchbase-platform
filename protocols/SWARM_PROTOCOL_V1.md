# Swarm Protocol V1

**Purpose:** Define how Field General + specialists collaborate to improve showroom sites

## Protocol Flow

### 1. Field General Issues WorkOrder

- **Input:** SHOWROOM_BRIEF.md + specific scope (e.g., "improve hero clarity")
- **Output:** `swarm.plan` artifact (internal only)
- **Constraints:** Cost cap, token limit, max rounds from policy

### 2. Specialist: Craft

- **Role:** Generate proposals based on plan
- **Input:** Plan + showroom files + brief
- **Output:** `swarm.specialist.craft` artifact with proposals + rationale
- **Model:** Cheaper model with json_output capability

### 3. Specialist: Critic

- **Role:** Find flaws, edge cases, regressions in craft proposals
- **Input:** Plan + craft proposals + success criteria
- **Output:** `swarm.specialist.critic` artifact with concerns + recommendations
- **Model:** Cheaper model with json_schema capability

### 4. Field General Collapse

- **Role:** Decide what ships based on craft + critic input
- **Input:** All specialist artifacts + success criteria
- **Output:** `swarm.collapse` artifact (customerSafe=true) with final decision
- **Model:** Deterministic (no creative drift)

## Artifact Contract

### Internal Artifacts (customerSafe=false)
- `swarm.plan` — Field General's orchestration plan
- `swarm.specialist.craft` — Craft proposals
- `swarm.specialist.critic` — Critic concerns

### Customer-Safe Artifact (customerSafe=true)
- `swarm.collapse` — Final decision + rationale (only artifact visible to customer)

## Cost Accounting

- **Per-specialist tracking:** Tokens and USD cost per specialist call
- **Total cap enforcement:** Sum across all specialists must not exceed policy cap
- **Failure isolation:** If one specialist fails, collapse safely with partial results

## Quality Gates

Before shipping any collapse decision:

1. **Success criteria check:** Does change improve or maintain success criteria?
2. **Regression check:** Does change break any "do not change" constraints?
3. **Cost ROI:** Is quality improvement worth the cost?
4. **Accessibility:** Does change maintain WCAG AA compliance?
5. **Performance:** Does change maintain load time targets?

## Escalation Rules

Swarm escalates to human (`needsHuman: true`) when:

- Specialist disagreement exceeds threshold
- Success criteria would be violated
- Cost cap exceeded before collapse
- Critical regression detected

## Changelog Requirements

Every shipped collapse must:

1. Append entry to showroom's CHANGELOG.md
2. Include scope, cost, models used
3. List changes + rationale
4. Document success criteria impact
5. Include commit hash

---

**Version:** 1.0  
**Last Updated:** January 13, 2026  
**Status:** Initial protocol definition
