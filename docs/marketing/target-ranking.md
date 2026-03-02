# Target Ranking

## Objective
Prioritize only high-value marketing records for fine-tuning and experiment promotion.

## Target Value Score (TVS)
Score each record from `0-100`:

1. `Business Impact` (0-25)
2. `Evidence Strength` (0-20)
3. `Actionability` (0-15)
4. `Audience Fit` (0-15)
5. `Novelty` (0-10)
6. `Compliance Safety` (0-10)
7. `Attribution Quality` (0-5)

## Hard Filters
1. Source URL/path present.
2. Timestamp present.
3. Channel/source-type present.
4. No critical compliance violations.
5. Duplicate similarity below threshold.
6. `TVS >= 75`.

## Tier Policy
1. `Tier A (85-100)`: immediate training + experiment candidate.
2. `Tier B (75-84)`: include in training queue.
3. `Tier C (<75)`: reject or manual review.

## Output Fields (required)
1. `target_id`
2. `source_url`
3. `captured_at`
4. `vertical`
5. `persona`
6. `hypothesis`
7. `evidence`
8. `action_steps`
9. `expected_kpi`
10. `compliance_flags`
11. `novelty_score`
12. `tvs`
13. `tier`
