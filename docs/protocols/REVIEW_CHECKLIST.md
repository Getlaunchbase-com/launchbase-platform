# Swarm Review Checklist

**Purpose:** Quality gates before shipping any swarm collapse decision

## Pre-Ship Checklist

### 1. Success Criteria Validation
- [ ] All 10 success criteria tested
- [ ] No regressions (existing PASS → FAIL)
- [ ] At least one improvement (FAIL → PASS or quality increase)
- [ ] Automated checks pass (Lighthouse, W3C, link checker)

### 2. Constraint Compliance
- [ ] No changes to "do not change" list from brief
- [ ] Brand colors unchanged
- [ ] Core value prop language intact
- [ ] Accessibility score maintained or improved

### 3. Cost Justification
- [ ] Total cost within policy cap
- [ ] Cost per improvement calculated
- [ ] ROI acceptable (quality gain worth spend)
- [ ] Baseline cost updated if first run

### 4. Artifact Audit
- [ ] All 4 artifacts present (plan, craft, critic, collapse)
- [ ] Only collapse is customerSafe=true
- [ ] stopReason is "ok" (not escalated)
- [ ] No provider errors leaked into collapse

### 5. Changelog Documentation
- [ ] CHANGELOG.md updated with entry
- [ ] Scope clearly described
- [ ] Cost and models recorded
- [ ] Changes listed with rationale
- [ ] Success criteria impact documented

### 6. Code Quality
- [ ] No console errors
- [ ] No broken links
- [ ] HTML validates (W3C)
- [ ] Responsive on 320px-2560px
- [ ] Load time <2s

### 7. Regression Prevention
- [ ] Previous changelog entries reviewed
- [ ] No repeat of past issues
- [ ] No undoing of previous improvements
- [ ] Version control clean (no conflicts)

## Escalation Triggers

Ship is blocked if:

- ❌ Any success criterion regresses
- ❌ "Do not change" constraint violated
- ❌ Cost cap exceeded
- ❌ Accessibility score drops
- ❌ Load time increases >10%
- ❌ Specialist disagreement unresolved

## Post-Ship Actions

After shipping:

1. Commit changes with descriptive message
2. Tag commit with swarm run number
3. Update BASELINE_COST.md if first run
4. Archive swarm artifacts for audit trail
5. Update todo.md with completion status

---

**Version:** 1.0  
**Last Updated:** January 13, 2026  
**Status:** Initial checklist definition
