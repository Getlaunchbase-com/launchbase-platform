/**
 * Truthfulness Index - Liar Detector for AI Design Output
 * 
 * Penalizes models for:
 * 1. Constraint violations (wrong keys, wrong counts, forbidden prose)
 * 2. Unbuildable suggestions (magic features, non-existent systems)
 * 3. Unverifiable claims (fake metrics, invented conversion promises)
 * 4. Generic fluff ("make it premium" with no mechanism)
 * 
 * Formula: FinalScore = BaseScore - TruthPenalty (0-300 points)
 * 
 * This separates "confident liars" from "truth-tellers" in tournaments.
 */

export interface TruthfulnessResult {
  truthPenalty: number;
  violations: TruthViolation[];
  truthScore: number; // 0-100, higher is better (100 - penalty%)
}

export interface TruthViolation {
  category: "constraint" | "unbuildable" | "unverifiable" | "fluff";
  severity: "minor" | "major" | "critical";
  penalty: number;
  description: string;
  evidence: string;
}

/**
 * Penalty weights by category and severity
 */
const PENALTY_WEIGHTS = {
  constraint: {
    minor: 10,    // e.g., slightly malformed key
    major: 30,    // e.g., wrong count (7 instead of 8)
    critical: 100, // e.g., completely wrong key format
  },
  unbuildable: {
    minor: 15,    // e.g., vague implementation path
    major: 40,    // e.g., suggests non-existent component
    critical: 120, // e.g., "add AI personalization engine"
  },
  unverifiable: {
    minor: 20,    // e.g., "improves user experience"
    major: 50,    // e.g., "increases conversion by 27%"
    critical: 150, // e.g., "proven to boost revenue 3x"
  },
  fluff: {
    minor: 5,     // e.g., one vague phrase
    major: 20,    // e.g., multiple vague suggestions
    critical: 60,  // e.g., entire output is generic fluff
  },
};

/**
 * Detect constraint violations
 */
function detectConstraintViolations(
  role: string,
  payload: any
): TruthViolation[] {
  const violations: TruthViolation[] = [];
  
  // Designer constraint checks
  if (role.includes("designer")) {
    const changes = payload?.proposedChanges || [];
    const prefix = role.includes("systems") ? "design" : "brand";
    
    // Wrong count
    if (changes.length !== 8) {
      violations.push({
        category: "constraint",
        severity: "major",
        penalty: PENALTY_WEIGHTS.constraint.major,
        description: `Expected EXACTLY 8 changes, got ${changes.length}`,
        evidence: `proposedChanges.length = ${changes.length}`,
      });
    }
    
    // Wrong key format
    for (let i = 0; i < changes.length; i++) {
      const key = changes[i]?.targetKey;
      if (!key || !key.startsWith(`${prefix}.`)) {
        violations.push({
          category: "constraint",
          severity: "critical",
          penalty: PENALTY_WEIGHTS.constraint.critical,
          description: `Invalid targetKey at index ${i}`,
          evidence: `targetKey="${key}" (must start with ${prefix}.)`,
        });
      }
    }
  }
  
  // Critic constraint checks
  if (role.includes("critic")) {
    const issues = payload?.issues || [];
    const fixes = payload?.suggestedFixes || [];
    
    // Wrong count
    if (issues.length < 10) {
      violations.push({
        category: "constraint",
        severity: "major",
        penalty: PENALTY_WEIGHTS.constraint.major,
        description: `Expected ≥10 issues, got ${issues.length}`,
        evidence: `issues.length = ${issues.length}`,
      });
    }
    
    if (fixes.length < 10) {
      violations.push({
        category: "constraint",
        severity: "major",
        penalty: PENALTY_WEIGHTS.constraint.major,
        description: `Expected ≥10 fixes, got ${fixes.length}`,
        evidence: `suggestedFixes.length = ${fixes.length}`,
      });
    }
  }
  
  return violations;
}

/**
 * Detect unbuildable suggestions
 */
function detectUnbuildableSuggestions(payload: any): TruthViolation[] {
  const violations: TruthViolation[] = [];
  
  const changes = payload?.proposedChanges || [];
  const unbuildablePatterns = [
    /add.*personalization.*engine/i,
    /implement.*AI.*system/i,
    /integrate.*machine learning/i,
    /add.*recommendation.*algorithm/i,
    /create.*dynamic.*content.*system/i,
    /build.*custom.*analytics/i,
    /add.*real-time.*data.*processing/i,
  ];
  
  for (let i = 0; i < changes.length; i++) {
    const value = changes[i]?.value || "";
    const rationale = changes[i]?.rationale || "";
    const combined = `${value} ${rationale}`.toLowerCase();
    
    for (const pattern of unbuildablePatterns) {
      if (pattern.test(combined)) {
        violations.push({
          category: "unbuildable",
          severity: "critical",
          penalty: PENALTY_WEIGHTS.unbuildable.critical,
          description: `Suggests magic feature without implementation path`,
          evidence: value.slice(0, 100),
        });
        break; // One violation per change
      }
    }
  }
  
  return violations;
}

/**
 * Detect unverifiable claims
 */
function detectUnverifiableClaims(payload: any): TruthViolation[] {
  const violations: TruthViolation[] = [];
  
  const changes = payload?.proposedChanges || payload?.issues || [];
  const claimPatterns = [
    /increase.*conversion.*by.*\d+%/i,
    /boost.*revenue.*by.*\d+x/i,
    /improve.*engagement.*by.*\d+%/i,
    /reduce.*bounce.*rate.*by.*\d+%/i,
    /proven.*to.*increase/i,
    /studies.*show.*\d+%/i,
    /guaranteed.*to.*improve/i,
  ];
  
  for (let i = 0; i < changes.length; i++) {
    const value = changes[i]?.value || changes[i]?.description || "";
    const rationale = changes[i]?.rationale || "";
    const combined = `${value} ${rationale}`;
    
    for (const pattern of claimPatterns) {
      if (pattern.test(combined)) {
        violations.push({
          category: "unverifiable",
          severity: "critical",
          penalty: PENALTY_WEIGHTS.unverifiable.critical,
          description: `Makes unverifiable metric claim`,
          evidence: value.slice(0, 100),
        });
        break;
      }
    }
  }
  
  return violations;
}

/**
 * Detect generic fluff
 */
function detectGenericFluff(payload: any): TruthViolation[] {
  const violations: TruthViolation[] = [];
  
  const changes = payload?.proposedChanges || payload?.issues || [];
  const fluffPatterns = [
    /make.*it.*feel.*premium/i,
    /improve.*trust/i,
    /enhance.*user.*experience/i,
    /make.*it.*more.*professional/i,
    /add.*polish/i,
    /improve.*overall.*quality/i,
  ];
  
  let fluffCount = 0;
  const fluffExamples: string[] = [];
  
  for (let i = 0; i < changes.length; i++) {
    const value = changes[i]?.value || changes[i]?.description || "";
    
    // Check if value is pure fluff (no mechanism)
    const hasFluffPhrase = fluffPatterns.some(p => p.test(value));
    const hasMechanism = /\d+|px|rem|%|button|card|cta|hero|grid|flex|spacing|padding|margin|border|color|font/i.test(value);
    
    if (hasFluffPhrase && !hasMechanism) {
      fluffCount++;
      if (fluffExamples.length < 3) {
        fluffExamples.push(value.slice(0, 60));
      }
    }
  }
  
  // Penalize based on fluff density
  if (fluffCount >= 3) {
    violations.push({
      category: "fluff",
      severity: "critical",
      penalty: PENALTY_WEIGHTS.fluff.critical,
      description: `${fluffCount} changes are generic fluff with no mechanism`,
      evidence: fluffExamples.join("; "),
    });
  } else if (fluffCount === 2) {
    violations.push({
      category: "fluff",
      severity: "major",
      penalty: PENALTY_WEIGHTS.fluff.major,
      description: `${fluffCount} changes are generic fluff with no mechanism`,
      evidence: fluffExamples.join("; "),
    });
  } else if (fluffCount === 1) {
    violations.push({
      category: "fluff",
      severity: "minor",
      penalty: PENALTY_WEIGHTS.fluff.minor,
      description: `${fluffCount} change is generic fluff with no mechanism`,
      evidence: fluffExamples[0] || "",
    });
  }
  
  return violations;
}

/**
 * Calculate Truthfulness Index for a specialist output
 */
export function calculateTruthfulnessIndex(
  role: string,
  payload: any
): TruthfulnessResult {
  const violations: TruthViolation[] = [];
  
  // Run all detectors
  violations.push(...detectConstraintViolations(role, payload));
  violations.push(...detectUnbuildableSuggestions(payload));
  violations.push(...detectUnverifiableClaims(payload));
  violations.push(...detectGenericFluff(payload));
  
  // Calculate total penalty (capped at 300)
  const truthPenalty = Math.min(
    300,
    violations.reduce((sum, v) => sum + v.penalty, 0)
  );
  
  // Truth score: 0-100 (higher is better)
  const truthScore = Math.max(0, 100 - (truthPenalty / 3));
  
  return {
    truthPenalty,
    violations,
    truthScore,
  };
}

/**
 * Calculate aggregate truthfulness for a full run (systems + brand + critic)
 */
export function calculateAggregateTruthfulness(
  systemsPayload: any,
  brandPayload: any,
  criticPayload: any
): TruthfulnessResult {
  const systemsTruth = calculateTruthfulnessIndex("designer_systems_fast", systemsPayload);
  const brandTruth = calculateTruthfulnessIndex("designer_brand_fast", brandPayload);
  const criticTruth = calculateTruthfulnessIndex("design_critic_ruthless", criticPayload);
  
  const allViolations = [
    ...systemsTruth.violations,
    ...brandTruth.violations,
    ...criticTruth.violations,
  ];
  
  const totalPenalty = Math.min(
    300,
    allViolations.reduce((sum, v) => sum + v.penalty, 0)
  );
  
  const avgTruthScore = (systemsTruth.truthScore + brandTruth.truthScore + criticTruth.truthScore) / 3;
  
  return {
    truthPenalty: totalPenalty,
    violations: allViolations,
    truthScore: Math.round(avgTruthScore),
  };
}
