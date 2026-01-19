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
import { getPromptPack, type TaskType, type SystemRole } from "./promptPacks/registry";
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
    generator?: SystemRole; // "implementer" typically
    critic?: SystemRole;    // "critic"
    collapse?: SystemRole;  // "field_general" or "implementer"
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
  const genPack = getPromptPack("generate_candidates");
  const critPack = getPromptPack("critique");
  const colPack = getPromptPack("decision_collapse");

  const maxRounds = clampInt(opts.maxRounds ?? genPack.maxRounds ?? 2, 1, 6);
  const costCapUsd = opts.costCapUsd ?? genPack.costCapUsd ?? 2.0;

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

  // Helper to compute critique quality score (0-10 scale) for backward compatibility
  function critiqueQuality10(c: any): number {
    // Legacy support: if score field exists (0-10), use it
    if (typeof c?.score === "number") return c.score;

    // Modern contract: compute from evaluationCriteria average (0-1) → convert to 0-10
    const ec = c?.evaluationCriteria;
    if (ec && typeof ec === "object") {
      const keys = ["clarity", "trust", "scanability", "mobileFold", "sectionContractCompliance"] as const;
      const vals = keys
        .map(k => ec[k])
        .filter(v => typeof v === "number") as number[];
      if (vals.length) {
        const avg01 = vals.reduce((a, b) => a + b, 0) / vals.length; // 0..1
        return avg01 * 10; // normalize to 0..10
      }
    }

    // Fallback: use pass field
    if (typeof c?.pass === "boolean") return c.pass ? 10 : 0;
    return 0;
  }

  // Helper to call completeJson safely
  const callJson = async (phase: TennisPhase, packTask: TaskType, role: SystemRole, payload: any, round: number) => {
    if (budgetTokensRemaining <= 0) throw new Error("AI Tennis token budget exceeded");
    if (budgetCostRemaining <= 0) throw new Error("AI Tennis cost budget exceeded");

    const pack = getPromptPack(packTask);

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
          step: phase,
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
      throw new Error(`AI Tennis ${phase}: json_parse_failed`);
    }

    const schema = pack.outputSchemaName;

    // Hard guard: validate copy_proposal shape before caps enforcement
    if (schema === "copy_proposal" && !Array.isArray(res.json.variants)) {
      throw new Error(`AI Tennis ${phase}: invalid_copy_proposal_missing_variants`);
    }

    // Only apply section caps to copy proposals (they have variants[])
    if (schema === "copy_proposal") {
      return enforceSectionCaps(res.json);
    }

    // Critique / decision_collapse do NOT have variants[] — never run enforceSectionCaps on them
    return res.json;
  };

  // ---- ROUND 0: generate candidates (draft) ----
  const draft0 = await callJson("generate_candidates", "generate_candidates", roles.generator, input, 0);
  
  // Round 0 is ALWAYS copy_proposal, regardless of outputTypeFinal
  const v0Result = validateAiOutputTyped("copy_proposal", draft0);
  if (!v0Result.ok) {
    throw new Error(`AI output failed schema validation (copy_proposal): ${v0Result.errors.join("; ")}`);
  }
  const v0 = v0Result.data;
  drafts.push(v0);

  if (Boolean((v0 as any)?.needsHuman)) {
    needsHuman = true;
    return finish(trace, 0, v0 as TFinal);
  }

  let current = v0;

  // ---- ROUNDS: critique -> collapse ----
  for (let round = 1; round <= maxRounds; round++) {
    const crit = await callJson("critique", "critique", roles.critic, { ...input, draft: current }, round);
    const critVResult = validateAiOutputTyped("critique", crit);
    if (!critVResult.ok) {
      throw new Error(`AI output failed schema validation (critique): ${critVResult.errors.join("; ")}`);
    }
    const critV = critVResult.data;
    critiques.push(critV);

    if (Boolean((critV as any)?.needsHuman)) {
      needsHuman = true;
      break;
    }

    const stopScore = opts.stopWhen?.critiqueScoreGte;
    if (typeof stopScore === "number") {
      const score10 = critiqueQuality10(critV);
      if (score10 >= stopScore) break;
    }

    const col = await callJson("decision_collapse", "decision_collapse", roles.collapse, { ...input, draft: current, critique: critV }, round);
    const colVResult = validateAiOutputTyped("decision_collapse", col);
    if (!colVResult.ok) {
      throw new Error(`AI output failed schema validation (decision_collapse): ${colVResult.errors.join("; ")}`);
    }
    const colV = colVResult.data;
    collapsed.push(colV);

    if (Boolean((colV as any)?.needsHuman)) {
      needsHuman = true;
      current = colV;
      break;
    }

    current = colV;
  }

  // Fix 2: If outputTypeFinal is decision_collapse but we never ran collapse (stopped early),
  // run collapse once to ensure final output matches the requested type
  if (opts.outputTypeFinal === "decision_collapse" && collapsed.length === 0) {
    const finalCrit = await callJson("critique", "critique", roles.critic, { ...input, draft: current }, critiques.length + 1);
    const finalCritVResult = validateAiOutputTyped(opts.outputTypeCritique, finalCrit);
    if (!finalCritVResult.ok) {
      throw new Error(`AI output failed schema validation (${opts.outputTypeCritique}): ${finalCritVResult.errors.join("; ")}`);
    }
    const finalCritV = finalCritVResult.data;
    critiques.push(finalCritV);

    const finalCol = await callJson("decision_collapse", "decision_collapse", roles.collapse, {
      ...input,
      draft: current,
      critique: finalCritV,
    }, critiques.length);

    const finalColVResult = validateAiOutputTyped("decision_collapse", finalCol);
    if (!finalColVResult.ok) {
      throw new Error(`AI output failed schema validation (decision_collapse): ${finalColVResult.errors.join("; ")}`);
    }
    const finalColV = finalColVResult.data;
    collapsed.push(finalColV);

    if (Boolean((finalColV as any)?.needsHuman)) {
      needsHuman = true;
    }

    current = finalColV;
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

type ValidateResult<T> = 
  | { ok: true; data: T }
  | { ok: false; reason: "ajv_failed"; errors: string[] };

function validateAiOutputTyped<T>(type: any, payload: any): ValidateResult<T> {
  const res = validateAiOutput(type, payload);
  if (!res.ok) {
    return { ok: false, reason: "ajv_failed", errors: res.errors };
  }
  return { ok: true, data: res.data as T };
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

function clampNumber(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}
