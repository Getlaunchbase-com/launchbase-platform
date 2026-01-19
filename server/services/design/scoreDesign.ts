import type { DesignOutput } from "./generateCandidates";

/**
 * Presentation Score: Deterministic scoring system for design candidates
 * 
 * Total: 1000 points
 * - Readability: 250 (25%)
 * - Visual Hierarchy: 250 (25%)
 * - Mobile Clarity: 200 (20%)
 * - Conversion Clarity: 200 (20%)
 * - Brand Neutrality: 100 (10%)
 * 
 * No vibes. No opinions. Only measurements.
 */

export interface PresentationScore {
  total: number; // 0-1000
  dimensions: {
    readability: number; // 0-250
    hierarchy: number; // 0-250
    mobileClarity: number; // 0-200
    conversionClarity: number; // 0-200
    brandNeutrality: number; // 0-100
  };
  signals: {
    // Readability (3 signals)
    fontScale: number;
    spacingRhythm: number;
    contrastLevel: number;
    
    // Hierarchy (2 signals)
    headlineDominance: number;
    ctaProminence: number;
    
    // Mobile (1 signal)
    foldClarity: number;
    
    // Conversion (1 signal)
    ctaVisibility: number;
    
    // Brand Neutrality (1 signal)
    restraint: number;
  };
  violations: string[];
  autoRejected: boolean;
  autoRejectReason?: string;
}

/**
 * Score a design candidate deterministically
 * 
 * @param candidate - Design output to score
 * @returns Presentation score with breakdown
 */
export function scoreDesign(candidate: DesignOutput): PresentationScore {
  // 1. Check hard guardrails (auto-reject)
  const guardrailCheck = checkGuardrails(candidate);
  if (!guardrailCheck.passed) {
    return {
      total: 0,
      dimensions: {
        readability: 0,
        hierarchy: 0,
        mobileClarity: 0,
        conversionClarity: 0,
        brandNeutrality: 0,
      },
      signals: {
        fontScale: 0,
        spacingRhythm: 0,
        contrastLevel: 0,
        headlineDominance: 0,
        ctaProminence: 0,
        foldClarity: 0,
        ctaVisibility: 0,
        restraint: 0,
      },
      violations: guardrailCheck.violations,
      autoRejected: true,
      autoRejectReason: guardrailCheck.reason,
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
      fontScale: readability.signals.fontScale,
      spacingRhythm: readability.signals.spacingRhythm,
      contrastLevel: readability.signals.contrastLevel,
      headlineDominance: hierarchy.signals.headlineDominance,
      ctaProminence: hierarchy.signals.ctaProminence,
      foldClarity: mobileClarity.signals.foldClarity,
      ctaVisibility: conversionClarity.signals.ctaVisibility,
      restraint: brandNeutrality.signals.restraint,
    },
    violations: [],
    autoRejected: false,
  };
}

/**
 * Check hard guardrails (auto-reject rules)
 */
function checkGuardrails(candidate: DesignOutput): {
  passed: boolean;
  violations: string[];
  reason?: string;
} {
  const violations: string[] = [];

  // Typography guardrails
  if (candidate.typography.maxFonts > 2) {
    violations.push("More than 2 font families");
  }

  // Color guardrails
  if (candidate.colors.maxAccentColors > 2) {
    violations.push("More than 2 accent colors");
  }

  // Mobile guardrails
  if (candidate.mobile.tapTargetScore < 0.8) {
    violations.push("Tap targets too small (<44px equivalent)");
  }

  if (violations.length > 0) {
    return {
      passed: false,
      violations,
      reason: violations.join("; "),
    };
  }

  return { passed: true, violations: [] };
}

/**
 * Calculate Readability score (250 points / 25%)
 * 
 * Signals:
 * - Font scale (100 pts): spacious > balanced > compact
 * - Spacing rhythm (80 pts): loose > balanced > tight
 * - Contrast level (70 pts): high > medium > low
 */
function calculateReadability(candidate: DesignOutput): {
  score: number;
  signals: { fontScale: number; spacingRhythm: number; contrastLevel: number };
} {
  // Font scale scoring
  const fontScaleScores = {
    spacious: 100,
    balanced: 80,
    compact: 60,
  };
  const fontScale =
    fontScaleScores[candidate.typography.scale as keyof typeof fontScaleScores] || 60;

  // Spacing rhythm scoring
  const spacingScores = {
    loose: 80,
    balanced: 70,
    tight: 50,
  };
  const spacingRhythm =
    spacingScores[candidate.spacing.verticalRhythm as keyof typeof spacingScores] || 50;

  // Contrast level scoring (weight contrast)
  const contrastScores = {
    high: 70,
    medium: 60,
    low: 40,
  };
  const contrastLevel =
    contrastScores[candidate.typography.weightContrast as keyof typeof contrastScores] || 40;

  const score = fontScale + spacingRhythm + contrastLevel;

  return {
    score,
    signals: { fontScale, spacingRhythm, contrastLevel },
  };
}

/**
 * Calculate Visual Hierarchy score (250 points / 25%)
 * 
 * Signals:
 * - Headline dominance (130 pts): 3xl > 2xl > xl
 * - CTA prominence (120 pts): floating > inline > below
 */
function calculateHierarchy(candidate: DesignOutput): {
  score: number;
  signals: { headlineDominance: number; ctaProminence: number };
} {
  // Headline dominance scoring
  const headlineScores = {
    "3xl": 130,
    "2xl": 110,
    xl: 80,
  };
  const headlineDominance =
    headlineScores[candidate.hero.headlineSize as keyof typeof headlineScores] || 80;

  // CTA prominence scoring
  const ctaScores = {
    floating: 120, // Always visible
    inline: 100, // Prominent in hero
    below: 80, // Below hero
  };
  const ctaProminence =
    ctaScores[candidate.hero.ctaPosition as keyof typeof ctaScores] || 80;

  const score = headlineDominance + ctaProminence;

  return {
    score,
    signals: { headlineDominance, ctaProminence },
  };
}

/**
 * Calculate Mobile Clarity score (200 points / 20%)
 * 
 * Signals:
 * - Fold clarity (200 pts): from candidate.mobile.foldClarity (0-1 → 0-200)
 */
function calculateMobileClarity(candidate: DesignOutput): {
  score: number;
  signals: { foldClarity: number };
} {
  // Fold clarity: CTA visibility above fold on mobile
  const foldClarity = Math.round(candidate.mobile.foldClarity * 200);

  return {
    score: foldClarity,
    signals: { foldClarity },
  };
}

/**
 * Calculate Conversion Clarity score (200 points / 20%)
 * 
 * Signals:
 * - CTA visibility (200 pts): floating > inline > below, trust indicators boost
 */
function calculateConversionClarity(candidate: DesignOutput): {
  score: number;
  signals: { ctaVisibility: number };
} {
  // Base CTA visibility
  const ctaBaseScores = {
    floating: 120,
    inline: 100,
    below: 80,
  };
  let ctaVisibility =
    ctaBaseScores[candidate.hero.ctaPosition as keyof typeof ctaBaseScores] || 80;

  // Boost if trust indicators visible in hero
  if (candidate.hero.trustIndicatorsVisible) {
    ctaVisibility += 40; // Trust near CTA boosts conversion
  }

  // Boost if trust section is high in order
  const trustSection = candidate.sections.find((s) => s.type === "trust");
  if (trustSection && trustSection.order <= 2) {
    ctaVisibility += 40; // Trust early boosts conversion
  }

  // Cap at 200
  ctaVisibility = Math.min(ctaVisibility, 200);

  return {
    score: ctaVisibility,
    signals: { ctaVisibility },
  };
}

/**
 * Calculate Brand Neutrality score (100 points / 10%)
 * 
 * Signals:
 * - Restraint (100 pts): 2 fonts + 2 colors = 100, 1 font + 1 color = 100, 3+ = penalty
 */
function calculateBrandNeutrality(candidate: DesignOutput): {
  score: number;
  signals: { restraint: number };
} {
  let restraint = 100;

  // Font restraint
  if (candidate.typography.maxFonts > 2) {
    restraint -= 50; // Penalty for >2 fonts
  }

  // Color restraint
  if (candidate.colors.maxAccentColors > 2) {
    restraint -= 50; // Penalty for >2 accent colors
  }

  // Bonus for minimal design
  if ((candidate.typography as any).maxFonts === 1 && (candidate.colors as any).maxAccentColors === 1) {
    restraint = 100; // Perfect restraint
  }

  return {
    score: Math.max(restraint, 0),
    signals: { restraint },
  };
}

/**
 * Get quality band from total score
 */
export function getQualityBand(score: number): {
  band: "excellent" | "good" | "acceptable" | "marginal" | "poor";
  meaning: string;
} {
  if (score >= 900) {
    return { band: "excellent", meaning: "Ship immediately" };
  } else if (score >= 800) {
    return { band: "good", meaning: "Ship with confidence" };
  } else if (score >= 700) {
    return { band: "acceptable", meaning: "Ship (standard tier)" };
  } else if (score >= 600) {
    return { band: "marginal", meaning: "Consider regeneration" };
  } else {
    return { band: "poor", meaning: "Regenerate or escalate" };
  }
}
