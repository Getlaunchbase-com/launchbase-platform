/**
 * AI Tennis → ActionRequest Service
 * 
 * Converts AI Tennis copy proposals into ActionRequests for customer approval.
 * No direct access to runAiTennis - uses aiTennisService facade.
 * 
 * Responsibilities:
 * - Run AI Tennis with strict mode
 * - Extract selectedProposal from decision_collapse
 * - Persist metadata (traceId, models, rounds, cost)
 * - Never log prompt content
 */

import { refineCopy, type CopyRefinementRequest } from "../ai/aiTennisService";
import { createActionRequest } from "../action-requests";
import { buildAiTennisMeta } from "../ai/aiTennisMeta";

// ============================================
// TYPES
// ============================================

export type ServiceFailReason =
  | "needs_human"
  | "no_selected_proposal"
  | "invalid_selected_proposal"
  | "prompt_pack_load_failed"
  | "ai_tennis_failed"
  | "action_request_create_failed";

export type AiCopyRefineRequest = {
  tenant: "launchbase" | "vinces";
  intakeId: number;
  userText: string;
  targetSection?: string;
  currentCopy?: Record<string, any>;
  constraints?: {
    maxRounds?: number;
    costCapUsd?: number;
  };
};

export type AiCopyRefineResult =
  | {
      success: true;
      actionRequestId: number;
      traceId: string;
      stopReason: "ok";
      meta: {
        rounds: number;
        estimatedUsd: number;
        calls: number;
        models: string[];
      };
    }
  | {
      success: false;
      stopReason: ServiceFailReason;
      traceId: string;
      meta: {
        rounds: number;
        estimatedUsd: number;
        calls: number;
        models: string[];
      };
    };

// ============================================
// SERVICE
// ============================================

/**
 * Generate copy proposal using AI Tennis and create ActionRequest
 * 
 * @param request - Copy refinement request
 * @param transport - AI transport (aiml for production, memory for tests)
 * @returns ActionRequest ID and metadata, or structured failure reason
 */
export async function aiTennisCopyRefine(
  request: AiCopyRefineRequest,
  transport: "aiml" | "memory" | "log" = "aiml"
): Promise<AiCopyRefineResult> {
  const traceId = `ai-copy-${Date.now()}`;

  // Step 1: Run AI Tennis
  let aiResult;
  try {
    aiResult = await refineCopy(
      {
        userText: request.userText,
        targetSection: request.targetSection,
        currentCopy: request.currentCopy,
        constraints: request.constraints,
      },
      transport
    );
  } catch (error) {
    console.error("[aiTennisCopyRefine] AI Tennis failed:", error);
    return {
      success: false,
      stopReason: "ai_tennis_failed",
      traceId,
      meta: { rounds: 0, estimatedUsd: 0, calls: 0, models: [] },
    };
  }

  // Check needsHuman FIRST before checking proposal (needsHuman path has no proposal)
  if (aiResult.needsHuman) {
    return {
      success: false,
      stopReason: "needs_human",
      needsHuman: true,
      traceId,
      meta: {
        rounds: aiResult.meta.roundsRun,
        estimatedUsd: aiResult.meta.estimatedUsd,
        calls: aiResult.meta.calls,
        models: aiResult.meta.models,
      },
    };
  }

  if (!aiResult.success || !aiResult.proposal) {
    return {
      success: false,
      stopReason: "ai_tennis_failed",
      traceId,
      meta: {
        rounds: aiResult.meta.roundsRun,
        estimatedUsd: aiResult.meta.estimatedUsd,
        calls: aiResult.meta.calls,
        models: aiResult.meta.models,
      },
    };
  }

  // Step 2: Extract variant from CopyProposal (refineCopy wraps it in variants array)
  const proposal = aiResult.proposal as any; // CopyProposal shape
  const selected = proposal?.variants?.[0]; // First variant

  if (!selected) {
    return {
      success: false,
      stopReason: "no_selected_proposal",
      traceId,
      meta: {
        rounds: aiResult.meta.roundsRun,
        estimatedUsd: aiResult.meta.estimatedUsd,
        calls: aiResult.meta.calls,
        models: aiResult.meta.models,
      },
    };
  }

  if (!selected.targetKey || !selected.value) {
    return {
      success: false,
      stopReason: "invalid_selected_proposal",
      traceId,
      meta: {
        rounds: aiResult.meta.roundsRun,
        estimatedUsd: aiResult.meta.estimatedUsd,
        calls: aiResult.meta.calls,
        models: aiResult.meta.models,
      },
    };
  }

  // Step 3: Create ActionRequest
  try {
    // Derive real stopReason (FOREVER CONTRACT)
    // Since runAiTennis doesn't expose stopReason yet, derive from success state
    const stopReason: string = aiResult.success
      ? "ok"
      : aiResult.needsHuman
      ? "needs_human"
      : "provider_failed";

    // Build AI Tennis job metadata (no prompt content)
    const jobMeta = buildAiTennisMeta({
      traceId,
      rounds: aiResult.meta.roundsRun,
      models: aiResult.meta.models,
      requestIds: aiResult.meta.requestIds,
      usage: {
        inputTokens: aiResult.meta.inputTokens,
        outputTokens: aiResult.meta.outputTokens,
      },
      costUsd: aiResult.meta.estimatedUsd,
      needsHuman: aiResult.needsHuman,
      stopReason, // Real stopReason, not "completed"
    });

    // Combine job + proposal metadata in rawInbound (Step 2.1 contract)
    const rawInbound = {
      source: "ai_tennis",
      aiTennis: jobMeta.aiTennis, // Correct structure: aiTennis at top level
      proposal: {
        targetKey: selected.targetKey,
        value: selected.value,
        rationale: selected.rationale || "",
        confidence: selected.confidence || 0,
        risks: selected.risks || [], // MUST be array
        assumptions: proposal.assumptions || [], // MUST be array
      },
    };

    const actionRequest = await createActionRequest({
      tenant: request.tenant,
      intakeId: request.intakeId,
      checklistKey: normalizeChecklistKey(selected.targetKey),
      proposedValue: selected.value,
      messageType: "AI_TENNIS_COPY_REFINE",
      confidence: selected.confidence ?? null,
      rawInbound,
    });

    if (!actionRequest) {
      return {
        success: false,
        stopReason: "action_request_create_failed",
        traceId,
        meta: {
          rounds: aiResult.meta.roundsRun,
          estimatedUsd: aiResult.meta.estimatedUsd,
          calls: aiResult.meta.calls,
          models: aiResult.meta.models,
        },
      };
    }

    return {
      success: true,
      actionRequestId: actionRequest.id,
      traceId,
      stopReason: "ok",
      meta: {
        rounds: aiResult.meta.roundsRun,
        estimatedUsd: aiResult.meta.estimatedUsd,
        calls: aiResult.meta.calls,
        models: aiResult.meta.models,
      },
    };
  } catch (err) {
    return {
      success: false,
      stopReason: "action_request_create_failed",
      traceId,
      meta: {
        rounds: aiResult.meta.roundsRun,
        estimatedUsd: aiResult.meta.estimatedUsd,
        calls: aiResult.meta.calls,
        models: aiResult.meta.models,
        ...(process.env.VITEST ? { error: err instanceof Error ? err.message : String(err) } : {}),
      },
    };
  }
}

/**
 * Map AI Tennis variant to ActionRequest checklist key
 * 
 * Handles key normalization (e.g., "hero.headline" → "homepage.headline")
 */
export function normalizeChecklistKey(targetKey: string): string {
  // Map AI Tennis keys to ActionRequest checklist keys
  const keyMap: Record<string, string> = {
    "hero.headline": "homepage.headline",
    "hero.subheadline": "homepage.subheadline",
    "hero.cta": "cta.primary",
  };

  return keyMap[targetKey] || targetKey;
}
