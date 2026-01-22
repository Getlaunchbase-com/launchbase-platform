# MINI SOAK TEST SCORECARD
## Control Stack Truth Baseline (8 runs)

**Date:** 2026-01-15
**Stack:** Control Champion (4o + Opus)
**Runs:** 8 (4 lanes × 2 reps)

---

## 🎯 EXECUTIVE SUMMARY

**Overall Performance:**
- Pass rate: 87.5% (7/8)
- Valid (no model drift): 8/8
- Truncations: 0/8
- Avg TruthPenalty: 0.023
- Avg FinalScore: 97.7
- Total Cost: $0.0000

⚠️ **VERDICT: Control stack needs tuning**

---

## 📊 PER-LANE BASELINES

| Lane | Pass | Avg TruthPenalty | Avg FinalScore | σ(score) | Truncations | Invalid |
|------|------|------------------|----------------|----------|-------------|----------|
| web | 2/2 | 0.008 | 99.2 | 0.8 | 0 | 0 |
| app | 2/2 | 0.000 | 100.0 | 0.0 | 0 | 0 |
| marketing | 2/2 | 0.017 | 98.3 | 1.7 | 0 | 0 |
| artwork | 1/2 | 0.067 | 93.3 | 6.7 | 0 | 0 |

---

## 🔬 TRUTH BASELINE LOCKED

These metrics become the Model Weather Control Chart thresholds:

### Web Lane
- **Pass rate baseline:** 100.0%
- **TruthPenalty median:** 0.008
- **FinalScore baseline:** 99.2 ± 0.8
- **Weather alerts:**
  - 🔴 Pass rate < 95%
  - 🔴 Truncations > 0
  - 🔴 Invalid > 0
  - 🟡 TruthPenalty rises ≥0.10 vs baseline
  - 🟡 FinalScore outside ±2σ band

### App Lane
- **Pass rate baseline:** 100.0%
- **TruthPenalty median:** 0.000
- **FinalScore baseline:** 100.0 ± 0.0
- **Weather alerts:**
  - 🔴 Pass rate < 95%
  - 🔴 Truncations > 0
  - 🔴 Invalid > 0
  - 🟡 TruthPenalty rises ≥0.10 vs baseline
  - 🟡 FinalScore outside ±2σ band

### Marketing Lane
- **Pass rate baseline:** 100.0%
- **TruthPenalty median:** 0.017
- **FinalScore baseline:** 98.3 ± 1.7
- **Weather alerts:**
  - 🔴 Pass rate < 95%
  - 🔴 Truncations > 0
  - 🔴 Invalid > 0
  - 🟡 TruthPenalty rises ≥0.10 vs baseline
  - 🟡 FinalScore outside ±2σ band

### Artwork Lane
- **Pass rate baseline:** 50.0%
- **TruthPenalty median:** 0.067
- **FinalScore baseline:** 93.3 ± 6.7
- **Weather alerts:**
  - 🔴 Pass rate < 95%
  - 🔴 Truncations > 0
  - 🔴 Invalid > 0
  - 🟡 TruthPenalty rises ≥0.10 vs baseline
  - 🟡 FinalScore outside ±2σ band

