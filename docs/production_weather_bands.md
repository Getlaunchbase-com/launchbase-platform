# Production Weather Bands - Creative Production Stack

**Last Updated:** 2026-01-16  
**Baseline:** 20-run pilot (Web×10 + Marketing×10)  
**Stack:** `stack_creative_production_default.json`

## Measured Performance (Baseline)

### Reliability
- **Valid Rate:** 100.0% (20/20)
- **Retry Rate:** 0.0% (0/20)
- **Failure Rate:** 0.0% (0/20)
- **Selector Fallback Rate:** 0.0% (Llama 8B handled all selections)

### Cost
- **P50:** $0.2589
- **P90:** $0.2633
- **Average:** $0.2572

### Latency
- **P50:** 76.0s
- **P90:** 88.0s
- **Average:** 76.4s

## Weather Band Thresholds

### 🟢 GREEN (Healthy)
System operating within expected parameters. No action required.

- **Valid%:** ≥ 95%
- **Cost P90:** ≤ $0.30
- **Latency P90:** ≤ 95s
- **Fallback%:** ≤ 10%

### 🟡 YELLOW (Degraded)
System experiencing minor degradation. Monitor closely.

- **Valid%:** 90-95%
- **Cost P90:** $0.30-0.35
- **Latency P90:** 95-120s
- **Fallback%:** 10-20%

### 🔴 RED (Critical)
System requires immediate attention. Investigate and fix.

- **Valid%:** < 90%
- **Cost P90:** > $0.35
- **Latency P90:** > 120s
- **Fallback%:** > 20%

## Tier Pricing (Compute Floor)

These are **compute costs only**. Customer pricing should include value margin + service overhead.

### Standard (1 loop)
- **Compute Cost:** $0.26/job
- **Latency:** ~76s
- **Use Case:** Simple updates, single-pass improvements

### Growth (3 loops)
- **Compute Cost:** $0.78/job
- **Latency:** ~4 minutes
- **Use Case:** Iterative refinement, customer feedback loops

### Premium (10 loops)
- **Compute Cost:** $2.60/job
- **Latency:** ~13 minutes
- **Use Case:** High-polish outcomes, multiple revision cycles

## Alert Configuration

### Monitoring Metrics
- Valid% (per lane + overall)
- Fallback% (selector primary → fallback transitions)
- Cost P50/P90 (per lane + overall)
- Latency P50/P90 (per lane + overall)
- Retry rate (per role: systems, brand, selector, critic)

### Alert Triggers
- **Immediate:** Valid% < 90% OR Fallback% > 20%
- **Warning:** Valid% < 95% OR Cost P90 > $0.30 OR Latency P90 > 95s
- **Info:** Fallback% > 10% (selector health degrading)

## Next Optimization Targets

### Critic Cost Reduction
- **Current:** Sonnet 4.0 ($0.10-0.12 per run)
- **Target:** Claude 3.7 Sonnet ($0.06-0.08 per run)
- **Expected Savings:** ~$0.04/run (15% total cost reduction)
- **Risk:** Must maintain 100% VALID rate and 10/10 issues/fixes

### Selector Verbosity Reduction
- **Current:** ~1700 input tokens, ~600 output tokens
- **Target:** ~1500 input tokens, ~400 output tokens
- **Expected Savings:** ~$0.01/run (4% total cost reduction)
- **Method:** Tighter prompt, shorter rationales

## Baseline Data Location

Full 20-run pilot data stored at:
```
/home/ubuntu/launchbase/runs/baselines/creative_prod_default_pilot20_20260116/
```

Contains 20 JSON files with complete run metadata for reproducibility and debugging.
