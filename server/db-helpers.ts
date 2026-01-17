// server/db-helpers.ts
// Shared helpers for database operations

/**
 * Returns default credit values for a new intake based on tier.
 * 
 * CRITICAL: All intake inserts MUST use this helper to ensure credits are initialized correctly.
 * The Drizzle ORM overrides DB defaults when fields are omitted, so we MUST set them explicitly.
 * 
 * @param tier - The pricing tier (standard, growth, premium)
 * @returns Object with creditsIncluded, creditsRemaining, creditsConsumed
 */
export function getDefaultIntakeCredits(tier: "standard" | "growth" | "premium" = "standard"): {
  creditsIncluded: number;
  creditsRemaining: number;
  creditsConsumed: number;
} {
  const creditsByTier = {
    standard: 1,
    growth: 3,
    premium: 10,
  };

  const credits = creditsByTier[tier];

  return {
    creditsIncluded: credits,
    creditsRemaining: credits,
    creditsConsumed: 0,
  };
}
