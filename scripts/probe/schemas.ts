import { z } from "zod";

export const StopReasonSchema = z.enum([
  "ok",
  "schema_failed",
  "invalid_json",
  "timeout",
  "provider_failed",
  "content_noncompliance",
  "unknown",
]);

export const ProbeStatusSchema = z.enum(["VALID", "FAILED", "RETRIED"]);

export const ProbeRunSchema = z.object({
  probeId: z.string().min(1),
  timestamp: z.string().min(1),
  lane: z.string().min(1),
  role: z.string().min(1),
  model: z.string().min(1),
  rep: z.number().int().min(1),

  status: ProbeStatusSchema,
  attempts: z.number().int().min(1),
  stopReason: StopReasonSchema,

  counts: z.object({
    proposedChanges: z.number().int().min(0),
    anchorCount: z.number().int().min(0),
  }),

  obedience: z.object({
    exact8: z.boolean(),
    schemaValid: z.boolean(),
    normalized: z.boolean(),
  }),

  usage: z.object({
    inputTokens: z.number().int().min(0),
    outputTokens: z.number().int().min(0),
    latencyMs: z.number().int().min(0),
    costUsd: z.number().min(0),
  }),

  paths: z
    .object({
      rawArtifact: z.string().min(1),
      parsedPayload: z.string().min(1),
    })
    .partial(),
});

export type ProbeRun = z.infer<typeof ProbeRunSchema>;

export const ProbeSummaryRowSchema = z.object({
  model: z.string().min(1),
  n: z.number().int().min(1),

  exact8Rate: z.number().min(0).max(1),
  schemaValidRate: z.number().min(0).max(1),
  validRate: z.number().min(0).max(1),

  avgAttempts: z.number().min(1),
  stopReasonCounts: z.record(StopReasonSchema, z.number().int().min(0)),

  tokens: z.object({
    inputAvg: z.number().min(0),
    outputAvg: z.number().min(0),
  }),

  latencyMsAvg: z.number().min(0),
  costUsdAvg: z.number().min(0),
});

export type ProbeSummaryRow = z.infer<typeof ProbeSummaryRowSchema>;

export const ProbeSummarySchema = z.object({
  generatedAt: z.string().min(1),
  scope: z.object({
    lane: z.string().min(1),
    role: z.string().min(1),
    repsPerModel: z.number().int().min(1),
    mode: z.enum(["tournament", "production"]),
  }),
  results: z.array(ProbeSummaryRowSchema).min(1),
});

export type ProbeSummary = z.infer<typeof ProbeSummarySchema>;
