/**
 * normalizeCriticRisks.ts
 * 
 * Surgical normalizer for critic `risks` field schema drift.
 * 
 * Issue: Claude Opus 4 returns risks as objects with {description, mitigation}
 * instead of plain strings as specified in schema.
 * 
 * Solution: Convert objects → strings deterministically in production mode only.
 * Tournament mode keeps strict validation to measure model obedience.
 */

/**
 * Normalize critic risks field from objects to strings
 * 
 * Converts:
 * - {description: "...", mitigation: "..."} → "... (Mitigation: ...)"
 * - {description: "..."} → "..."
 * - any other object → JSON.stringify(obj)
 * - string → unchanged
 * 
 * @returns {payload, coercedCount} - coercedCount is number of items coerced
 */
export function normalizeCriticRisks(payload: any): { payload: any; coercedCount: number } {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { payload, coercedCount: 0 };
  }

  const risks = payload.risks;
  if (!Array.isArray(risks)) {
    return { payload, coercedCount: 0 };
  }

  let coercedCount = 0;

  const normalized = risks.map((r: any) => {
    // Already a string - no coercion needed
    if (typeof r === 'string') {
      return r;
    }

    // Object - coerce to string
    if (r && typeof r === 'object') {
      coercedCount += 1;
      
      const desc = typeof r.description === 'string' ? r.description.trim() : '';
      const mit = typeof r.mitigation === 'string' ? r.mitigation.trim() : '';
      
      if (desc && mit) {
        return `${desc} (Mitigation: ${mit})`;
      }
      
      if (desc) {
        return desc;
      }
      
      // Last resort: stringify the object
      return JSON.stringify(r);
    }

    // Fallback: convert to string
    coercedCount += 1;
    return String(r);
  });

  return {
    payload: { ...payload, risks: normalized },
    coercedCount,
  };
}
