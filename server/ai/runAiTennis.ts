// server/ai/runAiTennis.ts
import crypto from "node:crypto";

import { completeJson } from "./providers/providerFactory";
import type { AiTransport } from "./providers/providerFactory";

import { getPromptPack } from "./promptPacks/registry";
import type { AiContractType } from "./validateAiOutput";
import { validateAiOutput } from "./validateAiOutput";

// If you have enforceSectionCaps already wired into validateAiOutput harness, great.
// Otherwise you can keep it in the pipeline (optional):
// import { enforceSectionCaps } from "./enforceSectionCaps";

type TennisStep = "generate" | "critique" | "collapse";

export type RunAiTennisOptions = {
  userText: string;

  // Optional context that should influence generation (brand, audience, constraints).
  // IMPORTANT: Never log this.
  context?: string;

  // Requested model id. Router may override.
  model: string;

  // Transport override (aiml/memory/log). If omitted, providerFactory uses env default.
  transport?: AiTransport;

  // Trace root used for logging/telemetry correlation. Never include prompt content.
  trace?: string;

  // Budgets
  maxRounds?: number;          // default from prompt pack
  costCapUsd?: number;         // default from prompt pack
  maxTokensTotal?: number;     // total budget across calls
  maxTokensPerCall?: number;   // per-call cap

  // Temperatures per phase (optional)
  temperatureGenerate?: number;
  temperatureCritique?: number;
  temperatureCollapse?: number;

  // Candidate count preference (the prompt can still override)
  candidateCount?: number;
};

/**
 * Normalized variant format that supports both copy_proposal schema and legacy formats
 */
export type TennisVariant = {
  targetKey: string;       // e.g. "hero.headline", "hero.cta", etc.
  value: any;              // string | object | array (schema allows)
  rationale?: string;
  confidence?: number;
  risks?: string[];
};

export type TennisCritique = {
  score: number;
  issues: string[];
  improvements: string[];
  needsHuman: boolean;
};

export type TennisResult = {
  needsHuman: boolean;
  final: {
    chosenIndex: number | null;
    chosenVariant: TennisVariant | null;
    confidence: number;
    reasoning: string;
  };
  variants: TennisVariant[];
  critiques: TennisCritique[];
  telemetry: {
    traceId: string;
    roundsExecuted: number;
    totalCalls: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    estimatedCostUsd: number;
    modelsUsed: Array<{ step: TennisStep; model: string }>;
    latencyMsTotal: number;
    stopReason:
      | "ok"
      | "cost_cap"
      | "token_cap"
      | "json_parse_failed"
      | "ajv_failed"
      | "needs_human"
      | "no_variants";
  };
};

type BudgetState = {
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  calls: number;
  modelsUsed: Array<{ step: TennisStep; model: string }>;
};

function sha256(text: string): string {
  return crypto.createHash("sha256").update(text).digest("hex");
}

/**
 * Conservative cost estimate (same approach as completeJson()).
 * Keep identical to avoid confusion, or import a shared helper if you add one.
 */
function estimateUsd(inputTokens: number, outputTokens: number): number {
  return inputTokens * 0.00001 + outputTokens * 0.00003;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function clampInt(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.floor(n)));
}

/**
 * Build a schema-valid decision_collapse payload for early-exit paths (budget cap, errors, etc.)
 */
function buildNeedsHumanCollapse(opts: { roundLimit: number; costCapUsd: number; reason: string }) {
  return {
    schemaVersion: "v1",
    selectedProposal: null,
    reason: opts.reason.slice(0, 300),
    approvalText: "Needs human approval due to safety/budget limits.".slice(0, 200),
    previewRecommended: true,
    needsHuman: true,
    confidence: 0.5,
    requiresApproval: true,
    roundLimit: clampInt(opts.roundLimit, 0, 2),
    costCapUsd: clamp(opts.costCapUsd, 0, 10),
  };
}

function safeLog(event: string, payload: Record<string, unknown>) {
  // Never include prompts, userText, context, or rawText.
  // Only safe metadata.
  console.log(`[AI:Tennis] ${event}`, payload);
}

function pickTraceId(trace?: string) {
  const base = trace?.trim() || "ai-tennis";
  // Add randomness so parallel calls don’t collide in logs/tests
  return `${base}:${Date.now()}:${Math.random().toString(16).slice(2)}`;
}

function budgetWouldExceed(
  budget: BudgetState,
  caps: { costCapUsd: number; maxTokensTotal?: number }
): { ok: true } | { ok: false; reason: "cost_cap" | "token_cap" } {
  if (budget.estimatedCostUsd > caps.costCapUsd) return { ok: false, reason: "cost_cap" };
  if (caps.maxTokensTotal != null) {
    const totalTokens = budget.inputTokens + budget.outputTokens;
    if (totalTokens > caps.maxTokensTotal) return { ok: false, reason: "token_cap" };
  }
  return { ok: true };
}

/**
 * Normalize variants from both copy_proposal schema and legacy formats
 * Always returns NormalizedVariant[] (targetKey + value format)
 */
function normalizeVariants(payload: any): TennisVariant[] {
  if (!payload) return [];

  // ✅ New schema shape: copy_proposal.schema.json (variants array with targetKey/value)
  if (Array.isArray(payload.variants)) {
    return payload.variants
      .filter((v: any) => v && typeof v.targetKey === "string" && "value" in v)
      .map((v: any) => ({
        targetKey: v.targetKey,
        value: v.value,
        rationale: typeof v.rationale === "string" ? v.rationale : undefined,
        confidence: typeof v.confidence === "number" ? v.confidence : undefined,
        risks: Array.isArray(v.risks) ? v.risks : undefined,
      }));
  }

  // 🧯 Legacy shape: hero-only { headline, body, cta }
  const out: TennisVariant[] = [];
  if (typeof payload.headline === "string" && payload.headline.length > 0) {
    out.push({
      targetKey: "hero.headline",
      value: payload.headline,
      rationale: payload.rationale,
      confidence: payload.confidence,
      risks: payload.risks,
    });
  }
  if (typeof payload.body === "string" && payload.body.length > 0) {
    out.push({
      targetKey: "hero.subheadline",
      value: payload.body,
      rationale: payload.rationale,
      confidence: payload.confidence,
      risks: payload.risks,
    });
  }
  if (typeof payload.cta === "string" && payload.cta.length > 0) {
    out.push({
      targetKey: "hero.cta",
      value: payload.cta,
      rationale: payload.rationale,
      confidence: payload.confidence,
      risks: payload.risks,
    });
  }

  return out;
}

export async function runAiTennis(opts: RunAiTennisOptions): Promise<TennisResult> {
  const start = Date.now();
  const traceId = pickTraceId(opts.trace);

  // Prompt packs (your registry provides deterministic content)
  const generatorPack = getPromptPack("generate_candidates");
  const criticPack = getPromptPack("critique");
  const collapsePack = getPromptPack("decision_collapse");

  // FIX: PromptPack has maxRounds/costCapUsd directly (no .meta)
  const maxRounds = clamp(opts.maxRounds ?? generatorPack.maxRounds ?? 2, 1, 6);
  const costCapUsd = opts.costCapUsd ?? generatorPack.costCapUsd ?? 2.0;

  // Contract caps: clamp to schema limits for decision_collapse
  const contractCaps = {
    roundLimit: Math.max(0, Math.min(2, maxRounds)),
    costCapUsd: Math.max(0, Math.min(10, costCapUsd)),
  };

  const maxTokensPerCall = opts.maxTokensPerCall ?? 1200;
  const maxTokensTotal = opts.maxTokensTotal ?? 5000;

  const budget: BudgetState = {
    inputTokens: 0,
    outputTokens: 0,
    estimatedCostUsd: 0,
    calls: 0,
    modelsUsed: [],
  };

  const routerOpts = { task: "json", useRouter: true, strict: true } as const;

  safeLog("start", {
    traceId,
    requestedModel: opts.model,
    transport: opts.transport ?? "env",
    maxRounds,
    costCapUsd,
    maxTokensPerCall,
    maxTokensTotal,
  });

  // Helper that always uses strict router mode.
  async function callJson(
    step: TennisStep,
    schema: AiContractType,
    messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
    temperature: number
  ) {
    const before = { ...budget };

    const traceObj = { jobId: traceId, step, schema, round: 0, caps: contractCaps };
    const trace = JSON.stringify(traceObj);
    
    const result = await completeJson(
      {
        model: opts.model,
        messages,
        temperature,
        maxTokens: maxTokensPerCall,
        trace,
      },
      opts.transport,
      routerOpts
    );

    budget.calls += 1;
    budget.inputTokens += result.usage.inputTokens;
    budget.outputTokens += result.usage.outputTokens;
    budget.estimatedCostUsd += estimateUsd(result.usage.inputTokens, result.usage.outputTokens);
    budget.modelsUsed.push({ step, model: result.meta.model });

    // Budget check
    const budgetCheck = budgetWouldExceed(budget, { costCapUsd, maxTokensTotal });
    safeLog("call", {
      traceId,
      step,
      schema,
      modelUsed: result.meta.model,
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      estCostUsdCall: estimateUsd(result.usage.inputTokens, result.usage.outputTokens),
      estCostUsdTotal: budget.estimatedCostUsd,
      tokensTotal: budget.inputTokens + budget.outputTokens,
      finishReason: result.meta.finishReason,
      // NO raw text. Only safe fingerprint.
      rawHash: result.rawText ? sha256(result.rawText) : "none",
      rawLen: result.rawText?.length ?? 0,
      // If budgets exceeded after this call, we’ll stop cleanly.
      budgetOk: budgetCheck.ok,
      budgetReason: budgetCheck.ok ? "ok" : budgetCheck.reason,
    });

    if (!budgetCheck.ok) {
      // Rewind? No. We already spent it. Stop after returning data to caller.
      // Caller decides how to mark needsHuman.
    }

    if (!result.json) {
      process.stderr.write(`[AI:Tennis] json_parse_failed step=${step} schema=${schema}\n`);
      console.error(`[AI:Tennis] JSON_PARSE_FAILED for ${schema}:`, {
        hasRawText: !!result.rawText,
        rawTextLength: result.rawText?.length,
        rawTextPreview: result.rawText?.slice(0, 200),
      });
      return {
        ok: false as const,
        reason: "json_parse_failed" as const,
        errors: ["JSON_PARSE_FAILED"],
        rawHash: result.rawText ? sha256(result.rawText) : "none",
      };
    }

    const validation = validateAiOutput(schema, result.json);
    if (!validation.ok) {
      process.stderr.write(`[AI:Tennis] ajv_failed step=${step} schema=${schema} errors=${validation.errors.length}\n`);
      // Log validation errors for debugging
      console.error(`[AI:Tennis] AJV validation FAILED for ${schema}:`, JSON.stringify(validation.errors, null, 2));
      console.error(`[AI:Tennis] Payload:`, JSON.stringify(result.json, null, 2));
      return {
        ok: false as const,
        reason: "ajv_failed" as const,
        errors: validation.errors,
        rawHash: result.rawText ? sha256(result.rawText) : "none",
      };
    }

    return { ok: true as const, data: validation.data, meta: result.meta };
  }

  // -----------------------
  // Round 1: Generate
  // -----------------------
  const candidateCount = clamp(opts.candidateCount ?? 3, 1, 8);

  const genMessages = [
    { role: "system" as const, content: generatorPack.systemPrompt },
    {
      role: "user" as const,
      content:
        `${generatorPack.taskPrompt}\n\n` +
        `# User Input\n${opts.userText}\n\n` +
        (opts.context ? `# Context\n${opts.context}\n\n` : "") +
        `# Preferences\n` +
        `- candidateCount: ${candidateCount}\n`,
    },
  ];

  const genResp = await callJson(
    "generate",
    "copy_proposal",
    genMessages,
    opts.temperatureGenerate ?? 0.7
  );

  const variants: TennisVariant[] = [];
  const critiques: TennisCritique[] = [];

  let stopReason: TennisResult["telemetry"]["stopReason"] = "ok";

  if (!genResp.ok) {
    stopReason = genResp.reason; // "json_parse_failed" | "ajv_failed"
    console.error("[AI:Tennis] validation failed at GENERATE step", {
      step: "generate",
      reason: genResp.reason,
      errorCount: genResp.errors?.length ?? 0,
      errorPreview: genResp.errors?.slice(0, 3),
    });
    safeLog("stop", { traceId, stopReason, errors: genResp.errors });
    return {
      needsHuman: true,
      final: {
        chosenIndex: null,
        chosenVariant: null,
        confidence: 0,
        reasoning: "Generation step failed schema validation.",
      },
      variants,
      critiques,
      telemetry: {
        traceId,
        roundsExecuted: 0,
        totalCalls: budget.calls,
        totalInputTokens: budget.inputTokens,
        totalOutputTokens: budget.outputTokens,
        estimatedCostUsd: budget.estimatedCostUsd,
        modelsUsed: budget.modelsUsed,
        latencyMsTotal: Date.now() - start,
        stopReason,
      },
    };
  }

  variants.push(...normalizeVariants(genResp.data));

  if (variants.length === 0) {
    stopReason = "no_variants";
    safeLog("stop", { traceId, stopReason });
    return {
      needsHuman: true,
      final: {
        chosenIndex: null,
        chosenVariant: null,
        confidence: 0,
        reasoning: "No candidates produced.",
      },
      variants,
      critiques,
      telemetry: {
        traceId,
        roundsExecuted: 0,
        totalCalls: budget.calls,
        totalInputTokens: budget.inputTokens,
        totalOutputTokens: budget.outputTokens,
        estimatedCostUsd: budget.estimatedCostUsd,
        modelsUsed: budget.modelsUsed,
        latencyMsTotal: Date.now() - start,
        stopReason,
      },
    };
  }

  // If budget exceeded after generation, stop early.
  const postGenBudget = budgetWouldExceed(budget, { costCapUsd, maxTokensTotal });
  if (!postGenBudget.ok) {
    stopReason = postGenBudget.reason;
    safeLog("stop", { traceId, stopReason });
    return {
      needsHuman: true,
      final: {
        chosenIndex: null,
        chosenVariant: null,
        confidence: 0,
        reasoning: "Budget exceeded after generation; requires human review.",
      },
      variants,
      critiques,
      telemetry: {
        traceId,
        roundsExecuted: 1,
        totalCalls: budget.calls,
        totalInputTokens: budget.inputTokens,
        totalOutputTokens: budget.outputTokens,
        estimatedCostUsd: budget.estimatedCostUsd,
        modelsUsed: budget.modelsUsed,
        latencyMsTotal: Date.now() - start,
        stopReason,
      },
    };
  }

  // -----------------------
  // Up to N rounds of critique (bounded)
  // -----------------------
  const roundsToRun = maxRounds; // generation already happened; maxRounds includes critique loop budget

  for (let round = 1; round <= roundsToRun; round++) {
    // Critique each variant (bounded by candidateCount)
    critiques.length = 0;

    for (let i = 0; i < variants.length; i++) {
      const v = variants[i];

      const critiqueMessages = [
        { role: "system" as const, content: criticPack.systemPrompt },
        {
          role: "user" as const,
          content:
            `${criticPack.taskPrompt}\n\n` +
            `# User Input\n${opts.userText}\n\n` +
            (opts.context ? `# Context\n${opts.context}\n\n` : "") +
            `# Candidate Variant (index ${i})\n` +
            `targetKey: ${v.targetKey}\n` +
            `value: ${typeof v.value === 'string' ? v.value : JSON.stringify(v.value)}\n` +
            (v.rationale ? `rationale: ${v.rationale}\n` : '') +
            (v.confidence ? `confidence: ${v.confidence}\n` : ''),
        },
      ];

      const critResp = await callJson(
        "critique",
        "critique",
        critiqueMessages,
        opts.temperatureCritique ?? 0.2
      );

      if (!critResp.ok) {
        stopReason = critResp.reason; // "json_parse_failed" | "ajv_failed"
        console.error("[AI:Tennis] validation failed at CRITIQUE step", {
          step: "critique",
          round,
          variantIndex: i,
          reason: critResp.reason,
          errorCount: critResp.errors?.length ?? 0,
          errorPreview: critResp.errors?.slice(0, 3),
        });
        safeLog("stop", { traceId, stopReason, round, variantIndex: i, errors: critResp.errors });
        return {
          needsHuman: true,
          final: {
            chosenIndex: null,
            chosenVariant: null,
            confidence: 0,
            reasoning: "Critique step failed schema validation.",
          },
          variants,
          critiques,
          telemetry: {
            traceId,
            roundsExecuted: round,
            totalCalls: budget.calls,
            totalInputTokens: budget.inputTokens,
            totalOutputTokens: budget.outputTokens,
            estimatedCostUsd: budget.estimatedCostUsd,
            modelsUsed: budget.modelsUsed,
            latencyMsTotal: Date.now() - start,
            stopReason,
          },
        };
      }

      const critiqueData = critResp.data as any;
      critiques.push({
        score: Number(critiqueData.score ?? 0),
        issues: Array.isArray(critiqueData.issues) ? critiqueData.issues.map(String) : [],
        improvements: Array.isArray(critiqueData.improvements)
          ? critiqueData.improvements.map(String)
          : [],
        needsHuman: !!critiqueData.needsHuman,
      });

      // If any critique escalates, stop
      if (critiques[critiques.length - 1].needsHuman) {
        stopReason = "needs_human";
        safeLog("stop", { traceId, stopReason, round, variantIndex: i });
        return {
          needsHuman: true,
          final: {
            chosenIndex: null,
            chosenVariant: null,
            confidence: 0,
            reasoning: "Critic flagged needsHuman.",
          },
          variants,
          critiques,
          telemetry: {
            traceId,
            roundsExecuted: round,
            totalCalls: budget.calls,
            totalInputTokens: budget.inputTokens,
            totalOutputTokens: budget.outputTokens,
            estimatedCostUsd: budget.estimatedCostUsd,
            modelsUsed: budget.modelsUsed,
            latencyMsTotal: Date.now() - start,
            stopReason,
          },
        };
      }

      // Budget check after each critique
      const budgetCheck = budgetWouldExceed(budget, { costCapUsd, maxTokensTotal });
      if (!budgetCheck.ok) {
        stopReason = budgetCheck.reason;
        safeLog("stop", { traceId, stopReason, round, variantIndex: i });
        return {
          needsHuman: true,
          final: {
            chosenIndex: null,
            chosenVariant: null,
            confidence: 0,
            reasoning: "Budget exceeded during critique; requires human review.",
          },
          variants,
          critiques,
          telemetry: {
            traceId,
            roundsExecuted: round,
            totalCalls: budget.calls,
            totalInputTokens: budget.inputTokens,
            totalOutputTokens: budget.outputTokens,
            estimatedCostUsd: budget.estimatedCostUsd,
            modelsUsed: budget.modelsUsed,
            latencyMsTotal: Date.now() - start,
            stopReason,
          },
        };
      }
    }

    // -----------------------
    // Collapse decision (choose best)
    // -----------------------
    const collapseMessages = [
      { role: "system" as const, content: collapsePack.systemPrompt },
      {
        role: "user" as const,
        content:
          `${collapsePack.taskPrompt}\n\n` +
          `# User Input\n${opts.userText}\n\n` +
          (opts.context ? `# Context\n${opts.context}\n\n` : "") +
          `# Candidates\n` +
          JSON.stringify({ variants, critiques }, null, 2),
      },
    ];

    const collapseResp = await callJson(
      "collapse",
      "decision_collapse",
      collapseMessages,
      opts.temperatureCollapse ?? 0.1
    );

    if (!collapseResp.ok) {
      stopReason = collapseResp.reason; // "json_parse_failed" | "ajv_failed"
      console.error("[AI:Tennis] validation failed at COLLAPSE step", {
        step: "collapse",
        round,
        reason: collapseResp.reason,
        errorCount: collapseResp.errors?.length ?? 0,
        errorPreview: collapseResp.errors?.slice(0, 3),
      });
      safeLog("stop", { traceId, stopReason, round, errors: collapseResp.errors });
      return {
        needsHuman: true,
        final: {
          chosenIndex: null,
          chosenVariant: null,
          confidence: 0,
          reasoning: "Decision collapse failed schema validation.",
        },
        variants,
        critiques,
        telemetry: {
          traceId,
          roundsExecuted: round,
          totalCalls: budget.calls,
          totalInputTokens: budget.inputTokens,
          totalOutputTokens: budget.outputTokens,
          estimatedCostUsd: budget.estimatedCostUsd,
          modelsUsed: budget.modelsUsed,
          latencyMsTotal: Date.now() - start,
          stopReason,
        },
      };
    }

    const collapseData = collapseResp.data as any;
    if (collapseData.needsHuman) {
      stopReason = "needs_human";
      safeLog("stop", { traceId, stopReason, round });
      return {
        needsHuman: true,
        final: {
          chosenIndex: null,
          chosenVariant: null,
          confidence: Number(collapseData.confidence ?? 0),
          reasoning: String(collapseData.reasoning ?? "Model requested human review."),
        },
        variants,
        critiques,
        telemetry: {
          traceId,
          roundsExecuted: round,
          totalCalls: budget.calls,
          totalInputTokens: budget.inputTokens,
          totalOutputTokens: budget.outputTokens,
          estimatedCostUsd: budget.estimatedCostUsd,
          modelsUsed: budget.modelsUsed,
          latencyMsTotal: Date.now() - start,
          stopReason,
        },
      };
    }

    const chosenIndex = Number(collapseData.finalChoice ?? -1);
    const confidence = Number(collapseData.confidence ?? 0);
    const reasoning = String(collapseData.reasoning ?? "");

    if (!Number.isFinite(chosenIndex) || chosenIndex < 0 || chosenIndex >= variants.length) {
      stopReason = "ajv_failed"; // Invalid finalChoice index
      safeLog("stop", { traceId, stopReason, round, chosenIndex });
      return {
        needsHuman: true,
        final: {
          chosenIndex: null,
          chosenVariant: null,
          confidence,
          reasoning: "Collapse returned invalid index; requires human review.",
        },
        variants,
        critiques,
        telemetry: {
          traceId,
          roundsExecuted: round,
          totalCalls: budget.calls,
          totalInputTokens: budget.inputTokens,
          totalOutputTokens: budget.outputTokens,
          estimatedCostUsd: budget.estimatedCostUsd,
          modelsUsed: budget.modelsUsed,
          latencyMsTotal: Date.now() - start,
          stopReason,
        },
      };
    }

    // Success — return immediately (bounded: one collapse per run)
    stopReason = "ok";
    safeLog("done", {
      traceId,
      round,
      chosenIndex,
      confidence,
      estCostUsdTotal: budget.estimatedCostUsd,
      tokensTotal: budget.inputTokens + budget.outputTokens,
    });

    return {
      needsHuman: false,
      final: {
        chosenIndex,
        chosenVariant: variants[chosenIndex],
        confidence,
        reasoning,
      },
      variants,
      critiques,
      telemetry: {
        traceId,
        roundsExecuted: round,
        totalCalls: budget.calls,
        totalInputTokens: budget.inputTokens,
        totalOutputTokens: budget.outputTokens,
        estimatedCostUsd: budget.estimatedCostUsd,
        modelsUsed: budget.modelsUsed,
        latencyMsTotal: Date.now() - start,
        stopReason,
      },
    };
  }

  // If we somehow exit rounds loop without returning, escalate.
  stopReason = "needs_human";
  safeLog("stop", { traceId, stopReason, reason: "round_limit" });

  return {
    needsHuman: true,
    final: {
      chosenIndex: null,
      chosenVariant: null,
      confidence: 0,
      reasoning: "Round limit reached without a decision; requires human review.",
    },
    variants,
    critiques,
    telemetry: {
      traceId,
      roundsExecuted: maxRounds,
      totalCalls: budget.calls,
      totalInputTokens: budget.inputTokens,
      totalOutputTokens: budget.outputTokens,
      estimatedCostUsd: budget.estimatedCostUsd,
      modelsUsed: budget.modelsUsed,
      latencyMsTotal: Date.now() - start,
      stopReason,
    },
  };
}
