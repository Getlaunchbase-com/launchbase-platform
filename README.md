# LaunchBase Showrooms

**Purpose:** Training and regression harness for LaunchBase AI Swarm Protocol.

This repository contains 4 digital showrooms (real websites) that serve as:
- **Training data** for Field General + specialist AIs
- **Regression tests** for swarm protocol changes
- **Cost baselines** for ROI measurement
- **Acceptance criteria** for quality gates

## Structure

```
showrooms/
  launchbase/     # LaunchBase marketing site
  site_gpt/       # GPT-style site
  site_manus/     # Manus-style site
  site_4/         # Fourth example site

protocols/
  SWARM_PROTOCOL_V1.md      # How the swarm operates
  REVIEW_CHECKLIST.md       # Quality gates before ship

tools/
  measure_cost.md           # Cost measurement methodology
```

## Each Showroom Contains

- `SHOWROOM_BRIEF.md` — Purpose, audience, brand voice, constraints
- `SUCCESS_CRITERIA.md` — Testable quality criteria (10 bullets max)
- `BASELINE_COST.md` — Token/cost baseline (filled after first runs)
- `CHANGELOG.md` — Append-only log of swarm changes

## Workflow

1. **Same brief** → run swarm → compare diff + cost
2. Learn which specialist mix gives best ROI
3. Regression: ensure changes don't break success criteria
4. Training: Field General references real file structure

## Version Control

- **Commit frequency:** After every swarm collapse that ships
- **Branch strategy:** main = stable, swarm-test-* = experimental runs
- **Do not rename** site folders without updating all references

## Integration

This repo integrates with:
- LaunchBase Engine Interface V1 (policy-driven execution)
- AI Swarm Protocol (Field General + specialists)
- Cost accounting system (token/USD tracking)

---

**Status:** Initial setup (Phase 2.3 Gate 4)  
**Last Updated:** January 13, 2026
# CI trigger Sat Jan 17 23:45:42 EST 2026
