/**
 * Obedience Probe Types & Schemas
 * 
 * Purpose: Find craft models that naturally obey EXACTLY 8 in tournament mode
 */

import { z } from 'zod';

// Per-run probe result
export const ProbeRunSchema = z.object({
  probeId: z.string(),
  timestamp: z.string(),
  lane: z.enum(['web', 'marketing', 'app', 'artwork']),
  role: z.enum(['designer_systems_fast', 'designer_brand_fast']),
  model: z.string(),
  rep: z.number().int().positive(),
  
  status: z.enum(['VALID', 'FAILED', 'RETRIED']),
  attempts: z.number().int().positive(),
  stopReason: z.enum(['ok', 'schema_failed', 'invalid_json', 'timeout', 'provider_failed', 'content_noncompliance']),
  
  counts: z.object({
    proposedChanges: z.number().int().nonnegative(),
    anchorCount: z.number().int().nonnegative(),
  }),
  
  obedience: z.object({
    exact8: z.boolean(),
    schemaValid: z.boolean(),
    normalized: z.boolean(), // Must always be false in probes
  }),
  
  usage: z.object({
    inputTokens: z.number().int().nonnegative(),
    outputTokens: z.number().int().nonnegative(),
    latencyMs: z.number().nonnegative(),
    costUsd: z.number().nonnegative(),
  }),
  
  paths: z.object({
    rawArtifact: z.string(),
    parsedPayload: z.string(),
  }),
});

export type ProbeRun = z.infer<typeof ProbeRunSchema>;

// Aggregated probe summary (leaderboard)
export const ProbeSummarySchema = z.object({
  generatedAt: z.string(),
  scope: z.object({
    lane: z.enum(['web', 'marketing', 'app', 'artwork']),
    role: z.enum(['designer_systems_fast', 'designer_brand_fast']),
    repsPerModel: z.number().int().positive(),
    mode: z.literal('tournament'),
  }),
  results: z.array(z.object({
    model: z.string(),
    n: z.number().int().positive(),
    
    exact8Rate: z.number().min(0).max(1),
    schemaValidRate: z.number().min(0).max(1),
    validRate: z.number().min(0).max(1),
    
    avgAttempts: z.number().positive(),
    stopReasonCounts: z.object({
      ok: z.number().int().nonnegative(),
      schema_failed: z.number().int().nonnegative(),
      invalid_json: z.number().int().nonnegative(),
      timeout: z.number().int().nonnegative(),
      provider_failed: z.number().int().nonnegative(),
      content_noncompliance: z.number().int().nonnegative(),
    }),
    
    tokens: z.object({
      inputAvg: z.number().nonnegative(),
      outputAvg: z.number().nonnegative(),
    }),
    latencyMsAvg: z.number().nonnegative(),
    costUsdAvg: z.number().nonnegative(),
  })),
});

export type ProbeSummary = z.infer<typeof ProbeSummarySchema>;

// Probe configuration
export const ProbeConfigSchema = z.object({
  lane: z.enum(['web', 'marketing', 'app', 'artwork']),
  role: z.enum(['designer_systems_fast', 'designer_brand_fast']),
  models: z.array(z.string()),
  reps: z.number().int().positive().default(3),
  mode: z.literal('tournament'),
  allowNormalization: z.literal(false),
  outputDir: z.string().default('/home/ubuntu/launchbase/runs/probes'),
});

export type ProbeConfig = z.infer<typeof ProbeConfigSchema>;

// Promotion rules
export interface PromotionCriteria {
  exact8RateMin: number;      // e.g., 0.67 (67%)
  timeoutRateMax: number;      // e.g., 0.0 (0%)
  avgAttemptsMax: number;      // e.g., 1.5
}

export interface ChampionCriteria {
  exact8RateMin: number;       // e.g., 0.95 (95%)
  minReps: number;             // e.g., 20
}

export const DEFAULT_PROMOTION_CRITERIA: PromotionCriteria = {
  exact8RateMin: 0.67,
  timeoutRateMax: 0.0,
  avgAttemptsMax: 1.5,
};

export const DEFAULT_CHAMPION_CRITERIA: ChampionCriteria = {
  exact8RateMin: 0.95,
  minReps: 20,
};
