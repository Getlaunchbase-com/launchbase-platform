/**
 * LaunchBase Design Tournament — Deterministic Scoring Rubric (v1)
 * 
 * Ranks any run output (systems + brand + critic + collapse) using strict numeric scoring.
 * 
 * FinalScore = QualityScore (0–70) + RigorScore (0–20) + EfficiencyScore (0–10)
 * 
 * TargetKey Taxonomy:
 * - design.* (Systems Designer): layout, spacing, type, tokens, components, conversion, trust, mobile
 * - brand.* (Brand Designer): voiceTone, personality, tokens, components, trust, marketing
 */

export interface ProposedChange {
  targetKey: string;
  value: string;
  rationale: string;
  confidence: number;
  risks?: string[];
}

export interface CriticIssue {
  severity: "critical" | "major" | "minor";
  description: string;
  location: string;
  rationale?: string;
}

export interface CriticFix {
  targetKey: string;
  fix: string;
  rationale: string;
}

export interface RunArtifacts {
  systems: {
    proposedChanges: ProposedChange[];
  };
  brand: {
    proposedChanges: ProposedChange[];
  };
  critic: {
    issues: CriticIssue[];
    suggestedFixes: CriticFix[];
    pass: boolean;
    requiresApproval: boolean;
  };
  meta: {
    totalCostUsd: number;
    durationMs: number;
    stopReason: string;
  };
}

export interface ScoreBreakdown {
  finalScore: number;
  qualityScore: number;
  rigorScore: number;
  efficiencyScore: number;
  breakdown: {
    coverage: number;
    actionability: number;
    conversionArchitecture: number;
    coherence: number;
    criticPressure: number;
    severityDistribution: number;
    cost: number;
    speed: number;
  };
}

/**
 * Score a design run using deterministic rubric
 */
export function scoreDesignRun(artifacts: RunArtifacts): ScoreBreakdown {
  // If run failed, return 0
  if (artifacts.meta.stopReason === "failed" || artifacts.meta.stopReason === "provider_failed") {
    return {
      finalScore: 0,
      qualityScore: 0,
      rigorScore: 0,
      efficiencyScore: 0,
      breakdown: {
        coverage: 0,
        actionability: 0,
        conversionArchitecture: 0,
        coherence: 0,
        criticPressure: 0,
        severityDistribution: 0,
        cost: 0,
        speed: 0,
      },
    };
  }

  const allChanges = [
    ...artifacts.systems.proposedChanges,
    ...artifacts.brand.proposedChanges,
  ];

  // 2) QualityScore (0–70)
  const coverage = scoreCoverage(allChanges);
  const actionability = scoreActionability(allChanges);
  const conversionArchitecture = scoreConversionArchitecture(allChanges);
  const coherence = scoreCoherence(allChanges);
  const qualityScore = coverage + actionability + conversionArchitecture + coherence;

  // 3) RigorScore (0–20)
  const criticPressure = scoreCriticPressure(artifacts.critic);
  const severityDistribution = scoreSeverityDistribution(artifacts.critic);
  const rigorScore = criticPressure + severityDistribution;

  // 4) EfficiencyScore (0–10)
  const cost = scoreCost(artifacts.meta.totalCostUsd);
  const speed = scoreSpeed(artifacts.meta.durationMs);
  const efficiencyScore = cost + speed;

  const finalScore = qualityScore + rigorScore + efficiencyScore;

  return {
    finalScore,
    qualityScore,
    rigorScore,
    efficiencyScore,
    breakdown: {
      coverage,
      actionability,
      conversionArchitecture,
      coherence,
      criticPressure,
      severityDistribution,
      cost,
      speed,
    },
  };
}

/**
 * 2.1 Coverage Score (0–20)
 * Reward hitting the parts of web design that matter.
 * 
 * Domains (4 points each, max 20):
 * - Layout / hierarchy: design.layout.*
 * - Tokens / system: design.tokens.*, design.type.*, design.spacing.*
 * - Components / UI patterns: design.components.*, brand.components.*
 * - Conversion mechanics: design.conversion.*, brand.marketing.*
 * - Mobile behavior: design.mobile.*
 */
function scoreCoverage(changes: ProposedChange[]): number {
  const domains = [
    { name: "layout", prefixes: ["design.layout."] },
    { name: "tokens", prefixes: ["design.tokens.", "design.type.", "design.spacing.", "brand.tokens."] },
    { name: "components", prefixes: ["design.components.", "brand.components."] },
    { name: "conversion", prefixes: ["design.conversion.", "brand.marketing."] },
    { name: "mobile", prefixes: ["design.mobile."] },
  ];

  let score = 0;
  for (const domain of domains) {
    const hasChange = changes.some(c =>
      domain.prefixes.some(prefix => c.targetKey.startsWith(prefix))
    );
    if (hasChange) score += 4;
  }

  return Math.min(score, 20);
}

/**
 * 2.2 Actionability Score (0–20)
 * We want implementable instructions, not generic advice.
 * 
 * A change is "actionable" if value contains at least one of:
 * - a number (48px, 80px, 2-column, 40% scroll, 12px radius)
 * - a layout primitive (grid, stack, sticky, section spacing, breakpoint)
 * - a specific UI element (proof bar, CTA row, hero chips, pricing card)
 */
function scoreActionability(changes: ProposedChange[]): number {
  const actionableChanges = changes.filter(c => {
    const value = c.value.toLowerCase();
    // Check for numbers (48px, 80px, 2-column, 40% scroll, 12px radius)
    const hasNumber = /\d+(?:px|%|rem|em|ms|s|column|col)/.test(value);
    // Check for layout primitives
    const hasLayoutPrimitive = /(grid|stack|sticky|section spacing|breakpoint|flex|absolute|relative|fixed)/.test(value);
    // Check for specific UI elements
    const hasSpecificUI = /(proof bar|cta row|hero chips|pricing card|trust band|sticky cta|button|input|card|modal)/.test(value);
    
    return hasNumber || hasLayoutPrimitive || hasSpecificUI;
  });

  const rate = changes.length > 0 ? actionableChanges.length / changes.length : 0;

  if (rate >= 0.85) return 20;
  if (rate >= 0.70) return 16;
  if (rate >= 0.55) return 12;
  if (rate >= 0.40) return 8;
  return 4;
}

/**
 * 2.3 Conversion Architecture Score (0–15)
 * This is the "does it sell?" part.
 * 
 * - sticky CTA or persistent CTA → +5
 * - trust/proof band / observability / auditability visuals → +5
 * - CTA clarity + hierarchy ("primary/secondary CTA separation") → +5
 */
function scoreConversionArchitecture(changes: ProposedChange[]): number {
  let score = 0;

  // sticky CTA or persistent CTA → +5
  const hasStickyCTA = changes.some(c =>
    /sticky.*cta|persistent.*cta|cta.*sticky/i.test(c.value) ||
    c.targetKey.includes("stickyCta") || c.targetKey.includes("sticky")
  );
  if (hasStickyCTA) score += 5;

  // trust/proof band / observability / auditability visuals → +5
  const hasTrustProof = changes.some(c =>
    /trust|proof|observability|auditability|audit trail|logged|transparent/i.test(c.value) ||
    c.targetKey.includes("trust") || c.targetKey.includes("proof")
  );
  if (hasTrustProof) score += 5;

  // CTA clarity + hierarchy ("primary/secondary CTA separation") → +5
  const hasCTAHierarchy = changes.some(c =>
    /primary.*cta|secondary.*cta|cta.*hierarchy|cta.*clarity/i.test(c.value) ||
    (c.targetKey.includes("cta") && /primary|secondary|hierarchy/.test(c.value))
  );
  if (hasCTAHierarchy) score += 5;

  return Math.min(score, 15);
}

/**
 * 2.4 Coherence Score (0–15)
 * We reward fewer contradictions + strong confidence distribution.
 * 
 * - AvgConfidence ≥0.88 AND LowConfidenceCount ≤1 → 15
 * - AvgConfidence ≥0.82 AND LowConfidenceCount ≤2 → 12
 * - AvgConfidence ≥0.76 → 9
 * - else → 6
 */
function scoreCoherence(changes: ProposedChange[]): number {
  if (changes.length === 0) return 6;

  const avgConfidence = changes.reduce((sum, c) => sum + c.confidence, 0) / changes.length;
  const lowConfidenceCount = changes.filter(c => c.confidence < 0.70).length;

  if (avgConfidence >= 0.88 && lowConfidenceCount <= 1) return 15;
  if (avgConfidence >= 0.82 && lowConfidenceCount <= 2) return 12;
  if (avgConfidence >= 0.76) return 9;
  return 6;
}

/**
 * 3.1 Critic Pressure Score (0–12)
 * We WANT critics to find issues (not 0 issues).
 * 
 * - Issues ≥12 AND Fixes ≥10 → 12
 * - Issues ≥8 AND Fixes ≥8 → 9
 * - Issues ≥5 AND Fixes ≥5 → 6
 * - Issues 1–4 → 3
 * - Issues 0 → 0
 */
function scoreCriticPressure(critic: RunArtifacts["critic"]): number {
  const issues = critic.issues.length;
  const fixes = critic.suggestedFixes.length;

  if (issues >= 12 && fixes >= 10) return 12;
  if (issues >= 8 && fixes >= 8) return 9;
  if (issues >= 5 && fixes >= 5) return 6;
  if (issues >= 1 && issues <= 4) return 3;
  return 0; // 0 issues = 0 score
}

/**
 * 3.2 Severity Distribution Score (0–8)
 * Count severities: critical, major, minor
 * 
 * - ≥2 critical AND ≥4 major AND ≥4 minor → 8
 * - ≥1 critical AND ≥3 major AND ≥3 minor → 6
 * - otherwise → 3
 */
function scoreSeverityDistribution(critic: RunArtifacts["critic"]): number {
  const critical = critic.issues.filter(i => i.severity === "critical").length;
  const major = critic.issues.filter(i => i.severity === "major").length;
  const minor = critic.issues.filter(i => i.severity === "minor").length;

  if (critical >= 2 && major >= 4 && minor >= 4) return 8;
  if (critical >= 1 && major >= 3 && minor >= 3) return 6;
  return 3;
}

/**
 * 4.1 Cost Score (0–6)
 * Score based on totalCostUsd
 * 
 * - ≤$0.12 → 6
 * - ≤$0.18 → 5
 * - ≤$0.25 → 4
 * - ≤$0.40 → 3
 * - ≤$0.60 → 2
 * - > $0.60 → 1
 */
function scoreCost(totalCostUsd: number): number {
  if (totalCostUsd <= 0.12) return 6;
  if (totalCostUsd <= 0.18) return 5;
  if (totalCostUsd <= 0.25) return 4;
  if (totalCostUsd <= 0.40) return 3;
  if (totalCostUsd <= 0.60) return 2;
  return 1;
}

/**
 * 4.2 Speed Score (0–4)
 * Score based on durationMs
 * 
 * - ≤45s → 4
 * - ≤75s → 3
 * - ≤120s → 2
 * - > 120s → 1
 */
function scoreSpeed(durationMs: number): number {
  const durationSec = durationMs / 1000;
  if (durationSec <= 45) return 4;
  if (durationSec <= 75) return 3;
  if (durationSec <= 120) return 2;
  return 1;
}

/**
 * Select Category Champions from scored runs
 */
export interface CategoryChampions {
  systems: {
    model: string;
    score: number;
    runId: string;
  };
  brand: {
    model: string;
    score: number;
    runId: string;
  };
  critic: {
    model: string;
    score: number;
    runId: string;
  };
}

export function selectCategoryChampions(
  runs: Array<{
    runId: string;
    models: {
      designer_systems: string;
      designer_brand: string;
      design_critic_ruthless: string;
    };
    artifacts: RunArtifacts;
    score: ScoreBreakdown;
  }>
): CategoryChampions {
  // Systems Champion: highest (Coverage + Actionability + Coherence) from Systems-only
  const systemsScores = runs.map(r => ({
    model: r.models.designer_systems,
    score: r.score.breakdown.coverage + r.score.breakdown.actionability + r.score.breakdown.coherence,
    runId: r.runId,
  }));
  const systemsChampion = systemsScores.reduce((best, curr) =>
    curr.score > best.score ? curr : best
  );

  // Brand Champion: highest Conversion + Coherence from Brand-only
  const brandScores = runs.map(r => ({
    model: r.models.designer_brand,
    score: r.score.breakdown.conversionArchitecture + r.score.breakdown.coherence,
    runId: r.runId,
  }));
  const brandChampion = brandScores.reduce((best, curr) =>
    curr.score > best.score ? curr : best
  );

  // Critic Champion: highest Critic Pressure + Severity Distribution
  const criticScores = runs.map(r => ({
    model: r.models.design_critic_ruthless,
    score: r.score.breakdown.criticPressure + r.score.breakdown.severityDistribution,
    runId: r.runId,
  }));
  const criticChampion = criticScores.reduce((best, curr) =>
    curr.score > best.score ? curr : best
  );

  return {
    systems: systemsChampion,
    brand: brandChampion,
    critic: criticChampion,
  };
}

/**
 * Validate targetKey format
 * 
 * Must match: ^(design|brand)\.[a-zA-Z0-9]+(\.[a-zA-Z0-9]+)*$
 */
export function validateTargetKey(targetKey: string): boolean {
  const regex = /^(design|brand)\.[a-zA-Z0-9]+(\.[a-zA-Z0-9]+)*$/;
  return regex.test(targetKey);
}

/**
 * Get targetKey domain for coverage scoring
 */
export function getTargetKeyDomain(targetKey: string): string | null {
  if (targetKey.startsWith("design.layout.")) return "layout";
  if (targetKey.startsWith("design.tokens.") || targetKey.startsWith("design.type.") || targetKey.startsWith("design.spacing.") || targetKey.startsWith("brand.tokens.")) return "tokens";
  if (targetKey.startsWith("design.components.") || targetKey.startsWith("brand.components.")) return "components";
  if (targetKey.startsWith("design.conversion.") || targetKey.startsWith("brand.marketing.")) return "conversion";
  if (targetKey.startsWith("design.mobile.")) return "mobile";
  if (targetKey.startsWith("design.trust.") || targetKey.startsWith("brand.trust.")) return "trust";
  return null;
}
