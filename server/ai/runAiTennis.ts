/**
 * AI Tennis Orchestrator
 * 
 * Bounded generate → critique → collapse rounds with:
 * - Token/cost caps enforcement
 * - Schema validation at every phase
 * - needsHuman escalation
 * - Strict ModelRouter mode (no silent fallback)
 * - Zero prompt leakage (only trace IDs, token counts, models)
 */

import { completeJson, type CompleteJsonOptions } from "./providers/providerFactory";
import { getPromptPack, type PromptPackRole, type PromptPackTask } from "./promptPacks/registry";
import { validateAiOutput } from "./validateAiOutput";
import { enforceSectionCaps } from "./enforceSectionCaps";

type TennisPhase = "generate_candidates" | "critique" | "decision_collapse";

export type RunAiTennisInput = {
  // generic: caller passes domain-specific fields
  [key: string]: any;
};

export type RunAiTennisOptions = {
  transport?: "aiml" | "memory" | "log";
  trace: {
    jobId: string;
    step: string;
  };
  // Router task to match modelPolicy.config.ts, e.g. "json"
  routerTask?: string; // default "json"
  // Overrides (else taken from prompt meta)
  maxRounds?: number;
  costCapUsd?: number;
  maxTokensTotal?: number;   // hard cap across all calls
  maxTokensPerCall?: number; // cap per call
  temperature?: number;

  // Validation types (must exist in validateAiOutput())
  outputTypeFinal: "decision_collapse" | "copy_proposal" | "intent_parse";
  outputTypeCritique: "critique";

  // Early stop conditions
  stopWhen?: {
    critiqueScoreGte?: number; // if critique schema has score
  };

  // Prompt roles (defaults are sane)
  roles?: {
    generator?: PromptPackRole; // "implementer" typically
    critic?: PromptPackRole;    // "critic"
    collapse?: PromptPackRole;  // "field_general" or "implementer"
  };
};

export type RunAiTennisResult<TFinal = any> = {
  trace: string;
  roundsRun: number;
  final: TFinal;
  artifacts: {
    drafts: any[];
    critiques: any[];
    collapsed: any[];
  };
  needsHuman: boolean;
  usage: {
    inputTokens: number;
    outputTokens: number;
    estimatedUsd: number;
    calls: number;
    latencyMsTotal: number;
  };
  meta: {
    models: string[];
    requestIds: string[];
  };
};

export async function runAiTennis<TFinal = any>(
  input: RunAiTennisInput,
  opts: RunAiTennisOptions
): Promise<RunAiTennisResult<TFinal>> {
  const trace = `${opts.trace.jobId}:${opts.trace.step}`;
  const routerTask = opts.routerTask ?? "json";

  const roles = {
    generator: opts.roles?.generator ?? "implementer",
    critic: opts.roles?.critic ?? "critic",
    collapse: opts.roles?.collapse ?? "field_general",
  };

  // Load prompt meta (source of default caps)
  const genPack = getPromptPack("generate_candidates", roles.generator);
  const critPack = getPromptPack("critique", roles.critic);
  const colPack = getPromptPack("decision_collapse", roles.collapse);

  const maxRounds = clampInt(opts.maxRounds ?? genPack.meta.maxRounds ?? 2, 1, 6);
  const costCapUsd = opts.costCapUsd ?? genPack.meta.costCapUsd ?? 2.0;

  const maxTokensTotal = opts.maxTokensTotal ?? 12000;
  const maxTokensPerCall = opts.maxTokensPerCall ?? 2000;

  let budgetTokensRemaining = maxTokensTotal;
  let budgetCostRemaining = costCapUsd;

  const drafts: any[] = [];
  const critiques: any[] = [];
  const collapsed: any[] = [];

  let needsHuman = false;

  let usageInput = 0;
  let usageOutput = 0;
  let usageCost = 0;
  let calls = 0;
  let latencyMsTotal = 0;

  const models: string[] = [];
  const requestIds: string[] = [];

  // Helper to call completeJson safely
  const callJson = async (phase: TennisPhase, packTask: PromptPackTask, role: PromptPackRole, payload: any, round: number) => {
    if (budgetTokensRemaining <= 0) throw new Error("AI Tennis token budget exceeded");
    if (budgetCostRemaining <= 0) throw new Error("AI Tennis cost budget exceeded");

    const pack = getPromptPack(packTask, role);

    // IMPORTANT: we do NOT embed raw prompts in logs anywhere; trace is safe.
    const messages = [
      { role: "system" as const, content: pack.systemPrompt },
      { role: "user" as const, content: renderTaskPrompt(pack.taskPrompt, payload) },
    ];

    const maxTokensThisCall = Math.max(256, Math.min(maxTokensPerCall, budgetTokensRemaining));

    const res = await completeJson(
      {
        model: "router", // placeholder; ModelRouter will resolve actual model
        messages,
        temperature: opts.temperature,
        maxTokens: maxTokensThisCall,
        trace: {
          jobId: opts.trace.jobId,
          step: opts.trace.step,
          round,
        },
      },
      opts.transport,
      { task: routerTask, useRouter: true, strict: true } // STRICT: no silent fallback
    );

    calls += 1;
    latencyMsTotal += res.latencyMs;

    usageInput += res.usage.inputTokens;
    usageOutput += res.usage.outputTokens;
    usageCost += res.cost.estimatedUsd;

    budgetTokensRemaining -= (res.usage.inputTokens + res.usage.outputTokens);
    budgetCostRemaining -= res.cost.estimatedUsd;

    models.push(res.meta.model);
    requestIds.push(res.meta.requestId);

    if (!res.json) {
      // completeJson already tries to parse JSON; treat null as failure
      throw new Error(`AI Tennis ${phase} produced non-JSON output`);
    }

    // normalize / cap sections defensively before validate
    const capped = enforceSectionCaps(res.json);
    return capped;
  };

  // ---- ROUND 0: generate candidates (draft) ----
  const draft0 = await callJson("generate_candidates", "generate_candidates", roles.generator, input, 0);
  const v0 = validateAiOutputTyped(opts.outputTypeFinal, draft0);
  drafts.push(v0);

  if (Boolean((v0 as any)?.needsHuman)) {
    needsHuman = true;
    return finish(trace, 0, v0 as TFinal);
  }

  let current = v0;

  // ---- ROUNDS: critique -> collapse ----
  for (let round = 1; round <= maxRounds; round++) {
    const crit = await callJson("critique", "critique", roles.critic, { ...input, draft: current }, round);
    const critV = validateAiOutputTyped(opts.outputTypeCritique, crit);
    critiques.push(critV);

    if (Boolean((critV as any)?.needsHuman)) {
      needsHuman = true;
      break;
    }

    const stopScore = opts.stopWhen?.critiqueScoreGte;
    if (typeof stopScore === "number" && typeof (critV as any)?.score === "number") {
      if ((critV as any).score >= stopScore) break;
    }

    const col = await callJson("decision_collapse", "decision_collapse", roles.collapse, {
      ...input,
      draft: current,
      critique: critV,
    }, round);

    const colV = validateAiOutputTyped(opts.outputTypeFinal, col);
    collapsed.push(colV);

    if (Boolean((colV as any)?.needsHuman)) {
      needsHuman = true;
      current = colV;
      break;
    }

    current = colV;
  }

  return {
    trace,
    roundsRun: critiques.length,
    final: current as TFinal,
    artifacts: { drafts, critiques, collapsed },
    needsHuman,
    usage: {
      inputTokens: usageInput,
      outputTokens: usageOutput,
      estimatedUsd: usageCost,
      calls,
      latencyMsTotal,
    },
    meta: { models, requestIds },
  };

  function finish(t: string, roundsRun: number, final: TFinal): RunAiTennisResult<TFinal> {
    return {
      trace: t,
      roundsRun,
      final,
      artifacts: { drafts, critiques, collapsed },
      needsHuman: true,
      usage: {
        inputTokens: usageInput,
        outputTokens: usageOutput,
        estimatedUsd: usageCost,
        calls,
        latencyMsTotal,
      },
      meta: { models, requestIds },
    };
  }
}

function validateAiOutputTyped(type: any, payload: any) {
  const res = validateAiOutput(type, payload);
  if (!res.ok) {
    throw new Error(`AI output failed schema validation (${type}): ${res.errors.join("; ")}`);
  }
  return res.data;
}

// Replace {{INPUT_JSON}} placeholders or append JSON payload safely.
// Keep it simple: your prompt already instructs "return JSON only".
function renderTaskPrompt(taskPrompt: string, payload: any): string {
  const serialized = JSON.stringify(payload, null, 2);
  if (taskPrompt.includes("{{INPUT_JSON}}")) {
    return taskPrompt.replaceAll("{{INPUT_JSON}}", serialized);
  }
  return `${taskPrompt}\n\n## INPUT_JSON\n${serialized}`;
}

function clampInt(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}
