# PresentationScore Rubric

**Purpose:** Deterministic scoring system that replaces human taste with measurable rules. Evaluates design candidates objectively to select the best presentation quality.

**Philosophy:** No vibes. No opinions. Only measurements.

---

## Scoring Overview

Each candidate receives a **PresentationScore** (0-100) based on 5 weighted dimensions:

| Dimension | Weight | Focus |
|-----------|--------|-------|
| **Readability** | 25% | Can users easily consume content? |
| **Visual Hierarchy** | 25% | Is the most important content most prominent? |
| **Mobile Clarity** | 20% | Does it work flawlessly on mobile? |
| **Conversion Clarity** | 20% | Is the CTA obvious and accessible? |
| **Brand Neutrality** | 10% | Does it avoid over-stylization? |

**Total:** 100%

**Selection:** Highest-scoring candidate wins.

---

## 1. Readability (25%)

**Question:** Can users easily consume content?

### Signals (Deterministic)

#### Font Size (40% of dimension)
- Body text ≥ 18px: **10/10**
- Body text = 16-17px: **7/10**
- Body text < 16px: **0/10** (auto-reject)

#### Line Length (30% of dimension)
- 50-75 characters: **10/10**
- 40-50 or 75-90 characters: **6/10**
- <40 or >90 characters: **2/10**

#### Contrast Ratio (30% of dimension)
- ≥ 7:1 (WCAG AAA): **10/10**
- 4.5-7:1 (WCAG AA): **7/10**
- < 4.5:1: **0/10** (auto-reject)

### Calculation

```typescript
readabilityScore = (
  (fontSizeScore * 0.4) +
  (lineLengthScore * 0.3) +
  (contrastScore * 0.3)
) * 0.25; // 25% weight
```

---

## 2. Visual Hierarchy (25%)

**Question:** Is the most important content most prominent?

### Signals (Deterministic)

#### Headline Dominance (40% of dimension)
- Headline 2.5x+ larger than body: **10/10**
- Headline 2x larger than body: **7/10**
- Headline < 2x larger than body: **3/10**

#### CTA Prominence (30% of dimension)
- CTA has unique color + high contrast: **10/10**
- CTA has unique color OR high contrast: **6/10**
- CTA blends with surroundings: **2/10**

#### Section Spacing (30% of dimension)
- Clear vertical rhythm (consistent spacing multiples): **10/10**
- Some rhythm (mostly consistent): **6/10**
- No rhythm (random spacing): **2/10**

### Calculation

```typescript
hierarchyScore = (
  (headlineDominanceScore * 0.4) +
  (ctaProminenceScore * 0.3) +
  (sectionSpacingScore * 0.3)
) * 0.25; // 25% weight
```

---

## 3. Mobile Clarity (20%)

**Question:** Does it work flawlessly on mobile?

### Signals (Deterministic)

#### Tap Target Size (35% of dimension)
- All tap targets ≥ 48px: **10/10**
- All tap targets ≥ 44px: **8/10**
- Any tap target < 44px: **0/10** (auto-reject)

#### Above-Fold CTA (35% of dimension)
- CTA visible in first viewport (mobile): **10/10**
- CTA visible after 1 scroll: **5/10**
- CTA requires >1 scroll: **0/10**

#### Mobile Viewport Fit (30% of dimension)
- No horizontal scroll, all content fits: **10/10**
- Minor overflow (<10px): **6/10**
- Horizontal scroll required: **0/10** (auto-reject)

### Calculation

```typescript
mobileClarityScore = (
  (tapTargetScore * 0.35) +
  (aboveFoldCTAScore * 0.35) +
  (viewportFitScore * 0.3)
) * 0.20; // 20% weight
```

---

## 4. Conversion Clarity (20%)

**Question:** Is the CTA obvious and accessible?

### Signals (Deterministic)

#### CTA Visibility (40% of dimension)
- CTA in hero + repeated in footer: **10/10**
- CTA in hero only: **7/10**
- CTA not in hero: **3/10**

#### Path Simplicity (30% of dimension)
- 1 primary CTA per section: **10/10**
- 2 CTAs per section: **6/10**
- 3+ CTAs per section: **2/10**

#### Trust Proximity (30% of dimension)
- Trust signals within 1 scroll of CTA: **10/10**
- Trust signals within 2 scrolls: **6/10**
- Trust signals distant from CTA: **3/10**

### Calculation

```typescript
conversionClarityScore = (
  (ctaVisibilityScore * 0.4) +
  (pathSimplicityScore * 0.3) +
  (trustProximityScore * 0.3)
) * 0.20; // 20% weight
```

---

## 5. Brand Neutrality (10%)

**Question:** Does it avoid over-stylization?

### Signals (Deterministic)

#### Font Restraint (40% of dimension)
- 1-2 font families: **10/10**
- 3 font families: **4/10**
- 4+ font families: **0/10** (auto-reject)

#### Color Restraint (40% of dimension)
- 1-2 accent colors: **10/10**
- 3 accent colors: **4/10**
- 4+ accent colors: **0/10** (auto-reject)

#### Animation Restraint (20% of dimension)
- 0-2 animated elements: **10/10**
- 3 animated elements: **5/10**
- 4+ animated elements: **0/10** (auto-reject)

### Calculation

```typescript
brandNeutralityScore = (
  (fontRestraintScore * 0.4) +
  (colorRestraintScore * 0.4) +
  (animationRestraintScore * 0.2)
) * 0.10; // 10% weight
```

---

## Final PresentationScore

```typescript
interface PresentationScore {
  total: number; // 0-100
  dimensions: {
    readability: number; // 0-25
    hierarchy: number; // 0-25
    mobileClarity: number; // 0-20
    conversionClarity: number; // 0-20
    brandNeutrality: number; // 0-10
  };
  signals: {
    fontSize: number;
    lineLength: number;
    contrast: number;
    headlineDominance: number;
    ctaProminence: number;
    sectionSpacing: number;
    tapTargets: number;
    aboveFoldCTA: number;
    viewportFit: number;
    ctaVisibility: number;
    pathSimplicity: number;
    trustProximity: number;
    fontRestraint: number;
    colorRestraint: number;
    animationRestraint: number;
  };
  autoRejected: boolean;
  autoRejectReason?: string;
}

function calculatePresentationScore(candidate: DesignOutput): PresentationScore {
  // 1. Check hard guardrails (auto-reject)
  const guardrailCheck = checkGuardrails(candidate);
  if (!guardrailCheck.passed) {
    return {
      total: 0,
      autoRejected: true,
      autoRejectReason: guardrailCheck.reason,
      // ... zero scores
    };
  }
  
  // 2. Calculate dimension scores
  const readability = calculateReadability(candidate);
  const hierarchy = calculateHierarchy(candidate);
  const mobileClarity = calculateMobileClarity(candidate);
  const conversionClarity = calculateConversionClarity(candidate);
  const brandNeutrality = calculateBrandNeutrality(candidate);
  
  // 3. Sum weighted total
  const total = 
    readability.score + 
    hierarchy.score + 
    mobileClarity.score + 
    conversionClarity.score + 
    brandNeutrality.score;
  
  return {
    total,
    dimensions: {
      readability: readability.score,
      hierarchy: hierarchy.score,
      mobileClarity: mobileClarity.score,
      conversionClarity: conversionClarity.score,
      brandNeutrality: brandNeutrality.score,
    },
    signals: {
      // ... all individual signal scores
    },
    autoRejected: false,
  };
}
```

---

## Scoring Thresholds

### Quality Bands

| Score | Band | Meaning |
|-------|------|---------|
| 90-100 | **Excellent** | Ship immediately |
| 80-89 | **Good** | Ship with confidence |
| 70-79 | **Acceptable** | Ship (standard tier) |
| 60-69 | **Marginal** | Consider regeneration |
| <60 | **Poor** | Regenerate or escalate |

### Tier Requirements

- **Standard:** Best candidate ≥ 70
- **Enhanced:** Best candidate ≥ 80
- **Premium:** Best candidate ≥ 85

If no candidate meets threshold, escalate to human review.

---

## Confidence Learning Integration

Track per `checklistKey` (or `industryType`):
- Average score by tier
- Score vs approval rate correlation
- Score vs edit rate correlation
- Score vs time-to-lock correlation

**Feedback loop:**
- If high-scoring candidates get rejected → adjust weights
- If low-scoring candidates get approved → investigate signal accuracy
- If specific industries prefer specific patterns → adjust defaults

**Goal:** System learns which scores predict customer satisfaction.

---

## Example Scoring

### Candidate A (Trades - Plumber)

**Readability:** 22/25
- Font size: 18px → 10/10
- Line length: 65 chars → 10/10
- Contrast: 6.5:1 → 7/10

**Hierarchy:** 21/25
- Headline dominance: 2.8x → 10/10
- CTA prominence: High contrast + unique color → 10/10
- Section spacing: Consistent rhythm → 6/10

**Mobile Clarity:** 18/20
- Tap targets: All ≥ 48px → 10/10
- Above-fold CTA: Visible → 10/10
- Viewport fit: Perfect → 10/10

**Conversion Clarity:** 17/20
- CTA visibility: Hero + footer → 10/10
- Path simplicity: 1 primary CTA → 10/10
- Trust proximity: Within 1 scroll → 6/10

**Brand Neutrality:** 9/10
- Font restraint: 2 families → 10/10
- Color restraint: 2 accents → 10/10
- Animation restraint: 1 element → 10/10

**Total:** 87/100 (**Good** - ship with confidence)

---

## Implementation Notes

1. **Scoring is deterministic** - same input always produces same score
2. **No ML required** - pure rule-based evaluation
3. **Fast** - can score 100+ candidates in <1s
4. **Explainable** - every score has a reason
5. **Improvable** - weights and thresholds can be tuned via confidence learning

**Next:** Implement scoring engine in TypeScript.
