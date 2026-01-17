# Creative Production Default Stack - Baseline Pilot (20-run)

**Date:** 2026-01-16  
**Stack:** `stack_creative_production_default.json`  
**Runs:** Web×10 + Marketing×10 (Production Mode, Creative Enabled)

## Stack Configuration

- **Systems Creator:** `openai/gpt-5-2` (burst 8-24, selector caps to 24)
- **Brand Creator:** `openai/gpt-4o-mini-2024-07-18`
- **Selector:** `meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo` (primary) + `mistralai/Mistral-7B-Instruct-v0.3` (fallback)
- **Critic:** `claude-sonnet-4-20250514`

## Results

### Reliability
- **VALID:** 20/20 (100.0%)
- **RETRIED:** 0/20 (0.0%)
- **FAILED:** 0/20 (0.0%)
- **Fallback Rate:** 0% (Llama 8B handled all selections)

### Cost
- **P50:** $0.2589
- **P90:** $0.2633
- **Avg:** $0.2572

### Latency
- **P50:** 76.0s
- **P90:** 88.0s
- **Avg:** 76.4s

### By Lane
- **Web:** 10/10 VALID
- **Marketing:** 10/10 VALID

## Production Weather Bands

### GREEN (Healthy)
- Valid% ≥ 95%
- Cost P90 ≤ $0.30
- Latency P90 ≤ 95s
- Fallback% ≤ 10%

### YELLOW (Degraded)
- Valid% 90-95%
- Cost P90 $0.30-0.35
- Latency P90 95-120s
- Fallback% 10-20%

### RED (Critical)
- Valid% < 90%
- Cost P90 > $0.35
- Latency P90 > 120s
- Fallback% > 20%

## Tier Pricing (Compute Floor)

- **Standard (1 loop):** $0.26/job, ~76s
- **Growth (3 loops):** $0.78/job, ~4min
- **Premium (10 loops):** $2.60/job, ~13min

## Files

This directory contains 20 JSON files (run_*.json) with full run metadata including:
- Status, attempts, lane, rep
- Usage (tokens, cost, latency per role + totals)
- Selection tracking (candidatesCount, cappedCount, selectedCount)
- Models used (systems, brand, selector, critic)
- Stop reasons and normalization events
