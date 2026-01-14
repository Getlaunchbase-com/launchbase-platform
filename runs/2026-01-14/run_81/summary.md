# Showroom Run Summary

**Showroom:** showroom.coffee-shop.baseline
**Policy:** swarm_premium_v1
**KeyHash:** coffee-shop-baseline-1768415233567
**Timestamp:** 2026-01-14T18:27:24.246Z

## Outcome

- **Status:** succeeded
- **StopReason:** needs_human
- **NeedsHuman:** true
- **Duration:** 10674ms

## Telemetry

- **Total Cost:** $0.0000
- **Craft Cost:** $0.0000
- **Critic Cost:** $0.0000
- **Craft Model:** gpt-4o-mini
- **Critic Model:** gpt-4o-mini

## Artifacts

Total: 4

### swarm.plan

- **CustomerSafe:** false
- **Payload:**
  ```json
  {
  "scope": "showroom.coffee-shop.baseline",
  "inputs": {
    "task": "Write homepage copy for artisan coffee shop",
    "business": "The Daily Grind",
    "description": "Locally roasted coffee, cozy atmosphere, community gathering space"
  },
  "specialists": [
    "craft",
    "critic"
  ],
  "fingerprint": "trc_1768415233567_c9a786cfcb54d:plan"
}
  ```

### swarm.specialist.craft

- **CustomerSafe:** false
- **Payload:**
  ```json
  {
  "ok": false,
  "stopReason": "provider_failed",
  "fingerprint": "trc_1768415233567_c9a786cfcb54d:craft:all_retries_failed",
  "role": "craft"
}
  ```

### swarm.specialist.critic

- **CustomerSafe:** false
- **Payload:**
  ```json
  {
  "ok": false,
  "stopReason": "provider_failed",
  "fingerprint": "trc_1768415233567_c9a786cfcb54d:critic:all_retries_failed",
  "role": "critic"
}
  ```

### swarm.collapse

- **CustomerSafe:** true

## Input Brief

```json
{
  "task": "Write homepage copy for artisan coffee shop",
  "business": "The Daily Grind",
  "description": "Locally roasted coffee, cozy atmosphere, community gathering space"
}
```
