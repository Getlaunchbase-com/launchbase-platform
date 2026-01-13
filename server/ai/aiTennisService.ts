/**
 * AI Tennis Service Facade
 * 
 * Business-level API for AI Tennis orchestration.
 * No callers should touch runAiTennis directly.
 * 
 * Responsibilities:
 * - Map business requests to AI Tennis inputs
 * - Handle transport selection (aiml/memory/log)
 * - Return business-friendly results
 * - Enforce security (no prompt leakage)
 */

import { runAiTennis, type RunAiTennisResult } from "./runAiTennis";
import type { CopyProposal, DecisionCollapse } from "./contracts/types";

// ============================================
// TYPES
// ============================================

export type AiTennisTransport = "aiml" | "memory" | "log";

export type CopyRefinementRequest = {
  userText: string;
  targetSection?: string; // e.g., "hero", "services", "socialProof"
  currentCopy?: Record<string, any>; // existing copy for context
  constraints?: {
    maxRounds?: number;
    costCapUsd?: number;
    maxTokensTotal?: number;
  };
};

export type CopyRefinementResult = {
  success: boolean;
  proposal?: CopyProposal;
  needsHuman: boolean;
  meta: {
    roundsRun: number;
    estimatedUsd: number;
    calls: number;
    latencyMsTotal: number;
    models: string[];
    requestIds: string[];
    inputTokens: number;
    outputTokens: number;
  };
  error?: string;
};

// ============================================
// SERVICE FACADE
// ============================================

/**
 * Refine homepage copy using AI Tennis orchestration
 * 
 * @param request - Business-level copy refinement request
 * @param transport - Transport mode (aiml for production, memory for tests)
 * @returns Copy proposal with approval workflow metadata
 */
export async function refineCopy(
  request: CopyRefinementRequest,
  transport: AiTennisTransport = "aiml"
): Promise<CopyRefinementResult> {
  try {
    const result: RunAiTennisResult<DecisionCollapse> = await runAiTennis(
      {
        userText: request.userText,
        targetSection: request.targetSection,
        currentCopy: request.currentCopy,
      },
      {
        transport,
        trace: {
          jobId: `copy-refine-${Date.now()}`,
          step: "homepage_copy_refinement",
        },
        outputTypeFinal: "decision_collapse",
        outputTypeCritique: "critique",
        maxRounds: request.constraints?.maxRounds ?? 2,
        costCapUsd: request.constraints?.costCapUsd ?? 2.0,
        maxTokensTotal: request.constraints?.maxTokensTotal ?? 12000,
        temperature: 0.7,
      }
    );

    const decision = result.final;

    // FOREVER CONTRACT: needsHuman forces success: false (escalation, not automation)
    if (decision.needsHuman || decision.selectedProposal === null) {
      return {
        success: false,
        needsHuman: true,
        meta: {
          roundsRun: result.roundsRun,
          estimatedUsd: result.usage.estimatedUsd,
          calls: result.usage.calls,
          latencyMsTotal: result.usage.latencyMsTotal,
          models: result.meta.models,
          requestIds: result.meta.requestIds,
          inputTokens: result.usage.inputTokens,
          outputTokens: result.usage.outputTokens,
        },
      };
    }

    // Wrap selectedProposal into CopyProposal format (1-item variants array)
    // Extract only copy-type fields (strip 'type' field from selectedProposal)
    const selectedCopy = decision.selectedProposal as { type: "copy"; targetKey: any; value: any };
    const proposal: CopyProposal = {
      schemaVersion: "v1",
      variants: [
        {
          targetKey: selectedCopy.targetKey,
          value: selectedCopy.value,
          rationale: decision.reason || "Selected by AI Tennis",
          confidence: decision.confidence,
          risks: decision.assumptions || [],
        },
      ],
      requiresApproval: true,
      confidence: decision.confidence,
      risks: [],
      assumptions: decision.assumptions || [],
    };

    return {
      success: true,
      needsHuman: false,
      proposal,
      meta: {
        roundsRun: result.roundsRun,
        estimatedUsd: result.usage.estimatedUsd,
        calls: result.usage.calls,
        latencyMsTotal: result.usage.latencyMsTotal,
        models: result.meta.models,
        requestIds: result.meta.requestIds,
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
      },
    };
  } catch (err: any) {
    // Security: never leak prompts or internal details
    const safeError = err.message?.includes("schema validation")
      ? "AI output validation failed"
      : err.message?.includes("budget exceeded")
        ? "AI budget exceeded"
        : "AI Tennis orchestration failed";

    return {
      success: false,
      needsHuman: true,
      meta: {
        roundsRun: 0,
        estimatedUsd: 0,
        calls: 0,
        latencyMsTotal: 0,
        models: [],
        requestIds: [],
        inputTokens: 0,
        outputTokens: 0,
      },
      error: safeError,
    };
  }
}

/**
 * Get AI Tennis service health status
 * (Useful for monitoring/diagnostics)
 */
export async function getServiceHealth(): Promise<{
  available: boolean;
  transport: string;
}> {
  return {
    available: true,
    transport: process.env.AI_PROVIDER || "aiml",
  };
}
