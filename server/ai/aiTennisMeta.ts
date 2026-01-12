/**
 * AI Tennis Metadata Types
 * 
 * Safe, typed metadata for AI Tennis job telemetry.
 * Never stores raw prompts, raw model output, or error messages.
 */

export type AiTennisMeta = {
  traceId: string;
  jobId: string;
  rounds: number;
  models: string[];
  requestIds: string[];
  usage: { inputTokens: number; outputTokens: number };
  costUsd: number;
  stopReason: string;
  needsHuman: boolean;
  // Optional safe fields
  confidence?: number;
};

export type AiTennisProposalMeta = {
  rationale: string;
  risks: string[];
  confidence: number;
};

/**
 * Build AI Tennis metadata for ActionRequest rawInbound
 */
export function buildAiTennisMeta(data: {
  traceId: string;
  rounds: number;
  models: string[];
  requestIds: string[];
  usage: { inputTokens: number; outputTokens: number };
  costUsd: number;
  needsHuman: boolean;
  stopReason?: string;
}): { aiTennis: AiTennisMeta } {
  return {
    aiTennis: {
      traceId: data.traceId,
      jobId: data.traceId, // Use traceId as jobId for now
      rounds: data.rounds,
      models: data.models,
      requestIds: data.requestIds,
      usage: data.usage,
      costUsd: data.costUsd,
      stopReason: data.stopReason || "completed",
      needsHuman: data.needsHuman,
    },
  };
}
