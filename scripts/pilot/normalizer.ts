/**
 * Deterministic Truncation (Production Mode Only)
 * 
 * Normalizes craft fast payloads to EXACTLY 8 proposedChanges
 * by truncating to first 8 if >8 are present.
 * 
 * Never pads, never reorders, never rewrites content.
 */

import type { NormalizationEvent } from './types';

export interface NormalizeResult {
  payload: any;
  event: NormalizationEvent;
}

/**
 * Normalize craft fast payload to EXACTLY 8 proposedChanges
 * 
 * Rules:
 * - If >8: slice(0, 8) and log truncation
 * - If <=8: leave as-is (don't invent items)
 * - Never reorder, rewrite content, or add keys
 */
export function normalizeCraftFastPayload(payload: any): NormalizeResult {
  // Safety checks
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return {
      payload,
      event: { kind: "truncate", applied: false, truncated: false, from: 0, to: 0 },
    };
  }
  
  if (!Array.isArray(payload.proposedChanges)) {
    return {
      payload,
      event: { kind: "truncate", applied: false, truncated: false, from: 0, to: 0 },
    };
  }
  
  const n = payload.proposedChanges.length;
  
  // Truncate if >8
  if (n > 8) {
    return {
      payload: {
        ...payload,
        proposedChanges: payload.proposedChanges.slice(0, 8),
      },
      event: { kind: "truncate", applied: true, truncated: true, from: n, to: 8 },
    };
  }
  
  // Leave as-is if <=8
  return {
    payload,
    event: { kind: "truncate", applied: false, truncated: false, from: n, to: n },
  };
}

/**
 * Log normalization event
 */
export function logNormalizationEvent(role: "systems" | "brand", event: NormalizationEvent): void {
  if (event.truncated) {
    console.log(`[NORMALIZE_FAST] ${role} proposedChanges ${event.from} → ${event.to}`);
  }
}
