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

/**
 * Validates intake credits invariants.
 * 
 * CRITICAL: Call this before any portal action (requestChanges, approve) to prevent
 * silent billing drift or entitlement corruption.
 * 
 * @param intake - The intake object to validate
 * @throws Error if any invariant is violated
 */
export function validateIntakeCredits(intake: {
  id: number;
  creditsIncluded: number;
  creditsRemaining: number;
  creditsConsumed: number;
}): void {
  const violations: string[] = [];

  if (intake.creditsRemaining < 0) {
    violations.push(`creditsRemaining is negative: ${intake.creditsRemaining}`);
  }

  if (intake.creditsConsumed < 0) {
    violations.push(`creditsConsumed is negative: ${intake.creditsConsumed}`);
  }

  if (intake.creditsIncluded < intake.creditsConsumed) {
    violations.push(
      `creditsIncluded (${intake.creditsIncluded}) < creditsConsumed (${intake.creditsConsumed})`
    );
  }

  if (intake.creditsIncluded !== intake.creditsRemaining + intake.creditsConsumed) {
    violations.push(
      `Credits math broken: included=${intake.creditsIncluded}, remaining=${intake.creditsRemaining}, consumed=${intake.creditsConsumed}`
    );
  }

  if (violations.length > 0) {
    const error = new Error(
      `[CREDITS INVARIANT VIOLATION] Intake ${intake.id}: ${violations.join("; ")}`
    );
    console.error(error.message);
    throw error;
  }
}
