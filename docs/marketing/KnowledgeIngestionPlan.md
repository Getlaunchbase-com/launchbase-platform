# Marketing Knowledge Ingestion Plan (Enterprise Safe)

## Goal
Build a world-class marketing knowledge base with both:
- best practices (what to do),
- failure patterns (what not to do),
for grassroots through enterprise contexts.

## Legal + Safety Gate
Only ingest data with one of:
1. Public domain license,
2. Open license allowing commercial use,
3. Explicit purchased/license rights,
4. Internal first-party data.

Do not bulk ingest copyrighted books/content without license.

## Corpus Layers
1. Foundations (principles)
- buyer psychology frameworks
- messaging, offers, positioning
- channel economics

2. Tactical grassroots
- local outreach, referral loops, direct response, community-led growth
- channel playbooks for low-budget operators

3. Enterprise scale
- multi-channel attribution
- lifecycle automation
- segmentation and retention systems

4. Anti-pattern corpus
- campaigns with poor outcomes
- misleading claims, compliance failures
- wasted-spend patterns and churn triggers

## Data Schemas
Use structured JSONL with fields:
- `id`
- `source_url`
- `license_type`
- `vertical`
- `segment`
- `channel`
- `intent_stage`
- `content_type` (`principle` | `playbook` | `case_study` | `anti_pattern`)
- `claim`
- `evidence`
- `recommended_action`
- `risk_flags`
- `quality_score`
- `ingested_at`

## Training Targets
Create three datasets:
1. `marketing_research.jsonl` (source-grounded synthesis)
2. `marketing_actions.jsonl` (context -> action plan)
3. `marketing_failures.jsonl` (pattern -> avoid + correction)

## Evaluation
For each model/lane:
- answer quality on benchmark prompts
- policy/compliance pass rate
- actionability score
- hallucination rate
- cost per high-quality recommendation

## Promotion Rule
Model/prompt changes are promoted only if:
- quality improves on benchmark set,
- compliance remains green,
- operational cost stays within threshold.

## Operational Cadence
- Daily: ingest + normalize + dedupe.
- Weekly: benchmark + compare models.
- Monthly: curriculum refresh by vertical and channel.
