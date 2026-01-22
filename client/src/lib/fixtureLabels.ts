/**
 * Human-readable labels for Swarm test scenarios (fixtures)
 * Maps internal fixture IDs to user-friendly descriptions
 */

export const FIXTURE_LABELS: Record<string, string> = {
  "f1-missing-import": "Missing import",
  "f2-wrong-path": "Wrong path / module not found",
  "f3-type-mismatch": "Type mismatch",
  "f4-unused-import": "Unused import",
  "f5-type-export": "Type export missing",
  "f6-json-import": "JSON import parsing",
  "f7-esm-interop": "ESM interop issue",
  "f8-zod-mismatch": "Zod schema mismatch",
  "f9-drizzle-mismatch": "Database schema mismatch",
  "f10-patch-corrupt": "Patch format corruption",
  "f11-new-file-dep-context": "New file dependency (create + import)",
};

/**
 * Format fixture ID with human-readable label
 * @example formatFixtureLabel("f1-missing-import") => "f1 — Missing import"
 */
export function formatFixtureLabel(fixtureId: string): string {
  const label = FIXTURE_LABELS[fixtureId];
  if (!label) return fixtureId;
  
  // Extract short ID (f1, f2, etc.)
  const shortId = fixtureId.split("-")[0];
  return `${shortId} — ${label}`;
}

/**
 * Get just the human-readable label without the ID prefix
 */
export function getFixtureLabel(fixtureId: string): string {
  return FIXTURE_LABELS[fixtureId] || fixtureId;
}
