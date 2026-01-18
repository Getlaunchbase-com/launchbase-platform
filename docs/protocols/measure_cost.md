# Cost Measurement Methodology

**Purpose:** Standardized approach to measuring and comparing swarm run costs

## Data Sources

### 1. Swarm Artifacts
Extract from `rawInbound.swarm` metadata:
- Per-specialist token counts (input + output)
- Per-specialist model IDs
- Per-specialist USD cost
- Total tokens across all specialists
- Total USD cost

### 2. Policy Configuration
From `swarm_premium_v1.json` (or active policy):
- Cost cap (max USD allowed)
- Token cap (max tokens allowed)
- Required capabilities
- Preferred capabilities

### 3. Model Registry
From AIML API model registry:
- Model pricing (per 1K tokens)
- Model capabilities
- Model availability

## Calculation Steps

### Step 1: Extract Raw Data
```typescript
const swarmMetadata = result.extensions.swarm;
const craftCost = swarmMetadata.specialists.craft.costUsd;
const criticCost = swarmMetadata.specialists.critic.costUsd;
const fgCost = swarmMetadata.fieldGeneral.costUsd;
const totalCost = craftCost + criticCost + fgCost;
```

### Step 2: Calculate Per-Role Breakdown
```
Craft:
  - Model: {model_id}
  - Tokens: {input_tokens} in + {output_tokens} out
  - Cost: ${cost_usd}

Critic:
  - Model: {model_id}
  - Tokens: {input_tokens} in + {output_tokens} out
  - Cost: ${cost_usd}

Field General:
  - Model: {model_id}
  - Tokens: {input_tokens} in + {output_tokens} out
  - Cost: ${cost_usd}

Total: ${total_cost_usd} ({total_tokens} tokens)
```

### Step 3: Compare to Baseline
```
Baseline: ${baseline_cost} (from BASELINE_COST.md)
Current: ${current_cost}
Delta: ${delta_cost} ({delta_percent}%)
```

### Step 4: Calculate ROI
```
Quality improvements: {count} (success criteria FAIL → PASS)
Cost per improvement: ${cost_per_improvement}
ROI assessment: {acceptable | marginal | poor}
```

## Baseline Establishment

First swarm run on a showroom:

1. Run swarm with `swarm_premium_v1` policy
2. Extract cost data from artifacts
3. Record in `BASELINE_COST.md`
4. Commit baseline to version control

## Future Comparisons

Subsequent runs:

1. Extract cost data
2. Compare to baseline
3. Calculate delta and ROI
4. Document in CHANGELOG.md entry
5. Update baseline if significant improvement

## Cost Optimization Strategies

### Reduce Cost
- Use cheaper models for specialists
- Reduce token limits
- Optimize prompts for conciseness
- Cache common responses

### Maintain Quality
- Keep Field General on reliable model
- Enforce strict schemas for critic
- Maintain success criteria gates
- Test regressions after changes

---

**Version:** 1.0  
**Last Updated:** January 13, 2026  
**Status:** Initial methodology definition
