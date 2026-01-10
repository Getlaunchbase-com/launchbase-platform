import type { DesignOutput } from "./types";

/**
 * Simple scoring function (8 signals, heuristic-based)
 * 
 * Total: ~100 points
 * No complex calculations - just obvious conversion/clarity heuristics
 */

export interface ScoreResult {
  scoreTotal: number;
  scoreBreakdown: Record<string, number>;
}

export function scoreDesign(c: { design: DesignOutput }): ScoreResult {
  const d = c.design;
  const breakdown: Record<string, number> = {};

  // 1) Mobile clarity (heuristic: airy > normal > tight)
  breakdown.mobileClarity = d.tokens.sectionGap === "airy" ? 15 : d.tokens.sectionGap === "normal" ? 12 : 8;

  // 2) CTA prominence (solid > outline)
  breakdown.cta = d.tokens.ctaStyle === "solid" ? 15 : 10;

  // 3) Trust placement (hero > belowHero)
  breakdown.trust = d.tokens.trustPlacement === "hero" ? 12 : 10;

  // 4) Readability (default/bold > compact)
  breakdown.readability = d.tokens.headingScale === "compact" ? 10 : 14;

  // 5) Services scannability (cards > list)
  breakdown.services = d.layout.services === "cards" ? 12 : 10;

  // 6) Brand neutrality (not too fancy: stock/none > abstract)
  breakdown.brandNeutral = d.tokens.imageStyle === "abstract" ? 8 : 12;

  // 7) Conversion redundancy (heroAndBottom > heroOnly)
  breakdown.ctaRedundancy = d.layout.cta === "heroAndBottom" ? 10 : 6;

  // 8) Layout risk penalty (left > center for most verticals)
  breakdown.riskPenalty = d.layout.hero === "center" ? -3 : 0;

  // Sum
  const scoreTotal = Object.values(breakdown).reduce((a, b) => a + b, 0);

  return { scoreTotal, scoreBreakdown: breakdown };
}

/**
 * Rank candidates by score (highest first)
 */
export function rankCandidates(
  scored: Array<{ variantKey: string; design: DesignOutput; score: ScoreResult }>
): Array<{ variantKey: string; design: DesignOutput; scoreTotal: number; scoreBreakdown: Record<string, number>; rank: number }> {
  // Sort by scoreTotal descending
  const sorted = scored.sort((a, b) => b.score.scoreTotal - a.score.scoreTotal);

  // Assign ranks
  return sorted.map((c, index) => ({
    variantKey: c.variantKey,
    design: c.design,
    scoreTotal: c.score.scoreTotal,
    scoreBreakdown: c.score.scoreBreakdown,
    rank: index + 1,
  }));
}
