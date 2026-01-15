/**
 * Pilot Run Types with Validation Policy Extension
 * 
 * Includes:
 * - runMode: "tournament" | "production"
 * - allowNormalization: boolean
 * - meta.normalization: tracking truncation events
 * - meta.usage: per-role token usage (systems/brand/critic/totals)
 */

export type RunMode = "tournament" | "production";

export type NormalizationMode = "truncate_first_n";

export interface ValidationPolicy {
  mode: "schema_first";
  enableContentValidator: boolean;
  contentValidatorPhase: "before_schema" | "after_schema";
  treatWrongCountAs: string;
  
  // NEW: Mode-based normalization
  runMode: RunMode;
  allowNormalization: boolean;
  normalizationMode?: NormalizationMode;
}

export interface NormalizationEvent {
  truncated: boolean;
  from: number;
  to: number;
}

export interface NormalizationTracking {
  enabled: boolean;
  applied: boolean;
  mode: NormalizationMode;
  events: {
    systems: NormalizationEvent;
    brand: NormalizationEvent;
    critic: NormalizationEvent;
  };
}

export interface RoleUsage {
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  costUsd: number;
}

export interface UsageTracking {
  systems: RoleUsage;
  brand: RoleUsage;
  critic: RoleUsage;
  totals: RoleUsage;
}

export interface PilotRun {
  lane: string;
  rep: number;
  runId: string;
  timestamp: string;
  status: "VALID" | "FAILED" | "INVALID";
  runMode: RunMode;
  
  systems: {
    changes: any[];
    anchorCount: number;
  };
  
  brand: {
    changes: any[];
    anchorCount: number;
  };
  
  critic: {
    issues: any[];
    suggestedFixes: any[];
    pass: boolean;
  };
  
  finalScore: number;
  truthPenalty: number;
  qualityPenalty: number;
  
  meta: {
    totalCostUsd: number;
    totalLatencyMs: number;
    attempts: number;
    
    models: {
      systems: string;
      brand: string;
      critic: string;
    };
    
    stopReasons: {
      systems: string;
      brand: string;
      critic: string;
    };
    
    requestIds: {
      systems: string;
      brand: string;
      critic: string;
    };
    
    // NEW: Normalization tracking
    normalization: NormalizationTracking;
    
    // NEW: Per-role usage tracking
    usage: UsageTracking;
  };
}

// Helper to create default normalization tracking
export function createNormalizationTracking(enabled: boolean, mode: NormalizationMode = "truncate_first_n"): NormalizationTracking {
  return {
    enabled,
    applied: false,
    mode,
    events: {
      systems: { truncated: false, from: 0, to: 0 },
      brand: { truncated: false, from: 0, to: 0 },
      critic: { truncated: false, from: 0, to: 0 },
    },
  };
}

// Helper to create default usage tracking
export function createUsageTracking(): UsageTracking {
  const zero: RoleUsage = { inputTokens: 0, outputTokens: 0, latencyMs: 0, costUsd: 0 };
  return {
    systems: { ...zero },
    brand: { ...zero },
    critic: { ...zero },
    totals: { ...zero },
  };
}

// Helper to create validation policy
export function createValidationPolicy(runMode: RunMode): ValidationPolicy {
  return {
    mode: "schema_first",
    enableContentValidator: true,
    contentValidatorPhase: "after_schema",
    treatWrongCountAs: "content_noncompliance",
    runMode,
    allowNormalization: runMode === "production",
    normalizationMode: "truncate_first_n",
  };
}
