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

export type TruncateEvent = {
  kind: "truncate";
  applied: boolean;
  truncated?: boolean;
  from: number;
  to: number;
};

export type CoerceRisksEvent = {
  kind: "coerce_risks";
  applied: boolean;
  coercedCount: number;
  fromType: "object";
  toType: "string";
  truncated?: boolean;
  from?: number;
  to?: number;
};

// Union (still useful for generic handling / logging)
export type NormalizationEvent = TruncateEvent | CoerceRisksEvent;

// Role-specific events (prevents accidentally writing the wrong kind to a role)
export type NormalizationEventsByRole = {
  systems: TruncateEvent;
  brand: TruncateEvent;
  critic: CoerceRisksEvent;
};

export interface NormalizationTracking {
  enabled: boolean;
  applied: boolean;
  mode: NormalizationMode;
  events: NormalizationEventsByRole;
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
  selector?: RoleUsage; // Optional: only present in creative production mode
  critic: RoleUsage;
  totals: RoleUsage;
}

export interface SelectionTracking {
  enabled: boolean;
  systems: {
    candidatesCount: number;
    cappedCount: number;
    selectedCount: number;
    selectorModel: string;
  };
  brand: {
    candidatesCount: number;
    cappedCount: number;
    selectedCount: number;
    selectorModel: string;
  };
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
    
    // NEW: Selection tracking (creative production mode only)
    selection?: SelectionTracking;
  };
}

// Helper to create default normalization tracking
export function createNormalizationTracking(
  enabled: boolean,
  mode: NormalizationMode = "truncate_first_n"
): NormalizationTracking {
  return {
    enabled,
    applied: false,
    mode,
    events: {
      systems: { kind: "truncate", applied: false, from: 0, to: 0 },
      brand: { kind: "truncate", applied: false, from: 0, to: 0 },
      critic: {
        kind: "coerce_risks",
        applied: false,
        coercedCount: 0,
        fromType: "object",
        toType: "string",
      },
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
