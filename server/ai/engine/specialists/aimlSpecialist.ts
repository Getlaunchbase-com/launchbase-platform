/**
 * AIML Specialist Adapter
 * 
 * Single-responsibility module for calling AIML provider for specialist roles.
 * 
 * Hard rules:
 * - Never store prompts in artifacts
 * - On error: artifact payload is only { ok: false, stopReason, fingerprint }
 * - Minimal JSON schemas (draft/notes for craft, issues/verdict for critic)
 */

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { completeJson } from "../../providers/providerFactory";
import type { ArtifactV1 } from "../types";
import { CraftOutputSchema, getCraftSchemaForRole } from "./schemas/craft.schema";
import { CriticOutputSchema } from "./schemas/critic.schema";
import {
  getModelLadderForRole,
  shouldRetry,
  exceedsBudgetThreshold,
  getNextModel,
  type RetryMetadata,
} from "./retryLadder";
import { validateContentContract } from "./contentValidator";

/**
 * Convert Zod error to string array (handles both .issues and .errors)
 */
function zodIssuesToStrings(err: unknown): string[] {
  const anyErr = err as any;
  const issues = anyErr?.issues ?? anyErr?.errors;
  if (!Array.isArray(issues)) return ["Zod validation failed (no issues)"];
  return issues.map((e: any) => `${(e.path ?? []).join(".")}: ${e.message ?? "Invalid"}`);
}

/**
 * Specialist stopReasons (frozen list)
 * 
 * These are internal-only. Swarm runner may convert to customer-safe stopReasons.
 */
export type SpecialistStopReason =
  | "ok"
  | "router_failed"
  | "provider_failed"
  | "json_parse_failed"
  | "ajv_failed"
  | "timeout"
  | "cost_cap_exceeded";

/**
 * Specialist role config (from policy)
 */
export interface SpecialistRoleConfig {
  transport: "aiml" | "memory";
  model: string;
  capabilities: string[];
  costCapUsd?: number;
  timeoutMs?: number;
}

/**
 * Specialist call input
 */
export interface SpecialistInput {
  role: "craft" | "critic" | "designer_systems" | "designer_brand" | "design_critic" | "design_critic_ruthless" | "prompt_architect" | "prompt_auditor";
  trace: {
    jobId: string;
    runId: string;
  };
  input: {
    plan: any;
    context?: any;
  };
  roleConfig: SpecialistRoleConfig;
}

/**
 * Specialist call output
 */
export interface SpecialistOutput {
  artifact: ArtifactV1;
  meta: {
    model: string;
    requestId: string;
    latencyMs: number;
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
  };
  stopReason: SpecialistStopReason;
}

/**
 * Load prompt pack from file
 */
function loadPromptPack(role: string): string {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  
  // Map role names to prompt pack files
  const promptMap: Record<string, string> = {
    craft: "craft.md",
    critic: "critic.md",
    designer_systems: "designer_systems.md",
    designer_brand: "designer_brand_conversion.md",
    designer_systems_fast: "designer_systems_fast.md",
    designer_brand_fast: "designer_brand_fast.md",
    design_critic: "design_critic.md",
    design_critic_ruthless: "design_critic_ruthless.md",
    prompt_architect: "prompt_architect.md",
    prompt_auditor: "prompt_auditor.md",
    // Lane-specific prompts (Mega Tournament V2)
    designer_systems_fast_web: "designer_systems_fast_web.md",
    designer_brand_fast_web: "designer_brand_fast_web.md",
    design_critic_ruthless_web: "design_critic_ruthless_web.md",
    designer_systems_fast_app: "designer_systems_fast_app.md",
    designer_brand_fast_app: "designer_brand_fast_app.md",
    design_critic_ruthless_app: "design_critic_ruthless_app.md",
    designer_systems_fast_marketing: "designer_systems_fast_marketing.md",
    designer_brand_fast_marketing: "designer_brand_fast_marketing.md",
    design_critic_ruthless_marketing: "design_critic_ruthless_marketing.md",
    designer_systems_fast_artwork: "designer_systems_fast_artwork.md",
    designer_brand_fast_artwork: "designer_brand_fast_artwork.md",
    design_critic_ruthless_artwork: "design_critic_ruthless_artwork.md",
  };
  
  const promptFile = promptMap[role] || `${role}.md`;
  const promptPath = join(__dirname, "promptPacks", promptFile);
  return readFileSync(promptPath, "utf-8");
}

// Load prompt packs at module initialization
const CRAFT_PROMPT = loadPromptPack("craft");
const CRITIC_PROMPT = loadPromptPack("critic");
const DESIGNER_SYSTEMS_PROMPT = loadPromptPack("designer_systems");
const DESIGNER_BRAND_PROMPT = loadPromptPack("designer_brand");
const DESIGNER_SYSTEMS_FAST_PROMPT = loadPromptPack("designer_systems_fast");
const DESIGNER_BRAND_FAST_PROMPT = loadPromptPack("designer_brand_fast");
const DESIGN_CRITIC_PROMPT = loadPromptPack("design_critic");
const DESIGN_CRITIC_RUTHLESS_PROMPT = loadPromptPack("design_critic_ruthless");
const PROMPT_ARCHITECT_PROMPT = loadPromptPack("prompt_architect");
const PROMPT_AUDITOR_PROMPT = loadPromptPack("prompt_auditor");
// Lane-specific prompts (Mega Tournament V2)
const DESIGNER_SYSTEMS_FAST_WEB_PROMPT = loadPromptPack("designer_systems_fast_web");
const DESIGNER_BRAND_FAST_WEB_PROMPT = loadPromptPack("designer_brand_fast_web");
const DESIGN_CRITIC_RUTHLESS_WEB_PROMPT = loadPromptPack("design_critic_ruthless_web");
const DESIGNER_SYSTEMS_FAST_APP_PROMPT = loadPromptPack("designer_systems_fast_app");
const DESIGNER_BRAND_FAST_APP_PROMPT = loadPromptPack("designer_brand_fast_app");
const DESIGN_CRITIC_RUTHLESS_APP_PROMPT = loadPromptPack("design_critic_ruthless_app");
const DESIGNER_SYSTEMS_FAST_MARKETING_PROMPT = loadPromptPack("designer_systems_fast_marketing");
const DESIGNER_BRAND_FAST_MARKETING_PROMPT = loadPromptPack("designer_brand_fast_marketing");
const DESIGN_CRITIC_RUTHLESS_MARKETING_PROMPT = loadPromptPack("design_critic_ruthless_marketing");
const DESIGNER_SYSTEMS_FAST_ARTWORK_PROMPT = loadPromptPack("designer_systems_fast_artwork");
const DESIGNER_BRAND_FAST_ARTWORK_PROMPT = loadPromptPack("designer_brand_fast_artwork");
const DESIGN_CRITIC_RUTHLESS_ARTWORK_PROMPT = loadPromptPack("design_critic_ruthless_artwork");


/**
 * Call AIML provider for specialist role
 * 
 * @param input - Specialist input (role, trace, input, roleConfig)
 * @returns SpecialistOutput with artifact, meta, and stopReason
 */
export async function callSpecialistAIML(
  input: SpecialistInput
): Promise<SpecialistOutput> {
  const { role, trace, input: specInput, roleConfig } = input;

  // Load prompt pack for this role
  const promptMap: Record<string, string> = {
    craft: CRAFT_PROMPT,
    critic: CRITIC_PROMPT,
    designer_systems: DESIGNER_SYSTEMS_PROMPT,
    designer_brand: DESIGNER_BRAND_PROMPT,
    designer_systems_fast: DESIGNER_SYSTEMS_FAST_PROMPT,
    designer_brand_fast: DESIGNER_BRAND_FAST_PROMPT,
    design_critic: DESIGN_CRITIC_PROMPT,
    design_critic_ruthless: DESIGN_CRITIC_RUTHLESS_PROMPT,
    prompt_architect: PROMPT_ARCHITECT_PROMPT,
    prompt_auditor: PROMPT_AUDITOR_PROMPT,
    // Lane-specific prompts (Mega Tournament V2)
    designer_systems_fast_web: DESIGNER_SYSTEMS_FAST_WEB_PROMPT,
    designer_brand_fast_web: DESIGNER_BRAND_FAST_WEB_PROMPT,
    design_critic_ruthless_web: DESIGN_CRITIC_RUTHLESS_WEB_PROMPT,
    designer_systems_fast_app: DESIGNER_SYSTEMS_FAST_APP_PROMPT,
    designer_brand_fast_app: DESIGNER_BRAND_FAST_APP_PROMPT,
    design_critic_ruthless_app: DESIGN_CRITIC_RUTHLESS_APP_PROMPT,
    designer_systems_fast_marketing: DESIGNER_SYSTEMS_FAST_MARKETING_PROMPT,
    designer_brand_fast_marketing: DESIGNER_BRAND_FAST_MARKETING_PROMPT,
    design_critic_ruthless_marketing: DESIGN_CRITIC_RUTHLESS_MARKETING_PROMPT,
    designer_systems_fast_artwork: DESIGNER_SYSTEMS_FAST_ARTWORK_PROMPT,
    designer_brand_fast_artwork: DESIGNER_BRAND_FAST_ARTWORK_PROMPT,
    design_critic_ruthless_artwork: DESIGN_CRITIC_RUTHLESS_ARTWORK_PROMPT,
  };
  const systemPrompt = promptMap[role];
  if (!systemPrompt) throw new Error(`Missing prompt for role: ${role}`);

  // Build user prompt with inputs
  let userPrompt = `# Input Data\n\n${JSON.stringify(specInput.plan, null, 2)}${
    specInput.context ? `\n\n# Context\n\n${JSON.stringify(specInput.context, null, 2)}` : ""
  }`;
  
  // If this is a critic role and craftArtifacts are provided, inject them
  if (role.includes("critic") && specInput.craftArtifacts && Array.isArray(specInput.craftArtifacts)) {
    userPrompt += "\n\n# Upstream Designer Outputs\n\n";
    for (const craft of specInput.craftArtifacts) {
      userPrompt += `## ${craft.role}\n\n${JSON.stringify(craft.output, null, 2)}\n\n`;
    }
    console.log("[SWARM_DEBUG] critic_prompt_has_upstream", true, "promptLen=", userPrompt.length);
  } else if (role.includes("critic")) {
    console.log("[SWARM_DEBUG] critic_prompt_has_upstream", false, "craftArtifactsCount=", specInput.craftArtifacts?.length ?? 0);
  }

  // Bulletproof role classifiers (prefix-based, handles suffixes like _web, _app)
  const isCraftRole = (r: string) =>
    r === "craft" ||
    r.startsWith("designer_systems") ||
    r.startsWith("designer_brand") ||
    r.startsWith("designer_fast");

  const isCriticRole = (r: string) =>
    r === "critic" ||
    r.startsWith("design_critic");

  // Single schema selector (uses getCraftSchemaForRole for fast vs normal)
  const getSchemaForRole = (r: string) => {
    if (isCraftRole(r)) return getCraftSchemaForRole(r);
    if (isCriticRole(r)) return CriticOutputSchema;
    throw new Error(`[SCHEMA_ROUTER] Unknown role="${r}" — no schema available`);
  };

  try {
    // Call provider with timeout
    const timeoutMs = roleConfig.timeoutMs || 25000;
    const requestedMaxTokens = roleConfig.maxTokens ?? 2000;
    console.log(`[AIML_CALL_REQUEST] role=${role} model=${roleConfig.model} requested_max_tokens=${requestedMaxTokens}`);

    const result = await Promise.race([
      completeJson(
        {
          model: roleConfig.model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.7,
          maxTokens: requestedMaxTokens,
          trace: {
            jobId: trace.jobId,
            step: `swarm.specialist.${role}`,
            round: 0,
          },
        },
        roleConfig.transport,
        { task: "json", useRouter: true, strict: false }
      ),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Specialist timeout")), timeoutMs)
      ),
    ]);

    // Log response details
    console.log(`[AIML_CALL_RESPONSE] role=${role} model=${result.meta.model} finish=${result.meta.finishReason} outTok=${result.usage.outputTokens} inTok=${result.usage.inputTokens}`);

    // Check cost cap
    if (roleConfig.costCapUsd && result.cost.estimatedUsd > roleConfig.costCapUsd) {
      return {
        artifact: {
          kind: `swarm.specialist.${role}`,
          payload: {
            ok: false,
            stopReason: "cost_cap_exceeded",
            fingerprint: `${trace.jobId}:${role}:cost_cap`,
          },
          customerSafe: false,
        },
        meta: {
          model: result.meta.model,
          requestId: result.meta.requestId,
          latencyMs: result.latencyMs,
          inputTokens: result.usage.inputTokens,
          outputTokens: result.usage.outputTokens,
          costUsd: result.cost.estimatedUsd,
        },
        stopReason: "cost_cap_exceeded",
      };
    }

    // DEBUG: Log raw response before validation (for 80-token failure debugging)
    try {
      const debugDir = join("/home/ubuntu/launchbase/runs", "debug_raw");
      mkdirSync(debugDir, { recursive: true });
      const debugFile = join(debugDir, `${role}__${result.meta.model.replace(/[^\w.-]/g, "_")}__${Date.now()}.txt`);
      const debugContent = [
        `=== RAW RESPONSE (${role}) ===`,
        `Model: ${result.meta.model}`,
        `Request ID: ${result.meta.requestId}`,
        `Input Tokens: ${result.usage.inputTokens}`,
        `Output Tokens: ${result.usage.outputTokens}`,
        `Finish Reason: ${result.meta.finishReason}`,
        ``,
        `=== RAW TEXT (${result.rawText.length} chars) ===`,
        result.rawText,
        ``,
        `=== PARSED JSON ===`,
        result.json ? JSON.stringify(result.json, null, 2) : "NULL (parse failed)",
      ].join("\n");
      writeFileSync(debugFile, debugContent, "utf8");
      console.log(`[DEBUG] Raw response saved to: ${debugFile}`);
    } catch (debugErr) {
      console.warn("[DEBUG] Failed to write raw response:", debugErr);
    }

    // Guardrail: Warn if output shape doesn't match expected schema
    if (result.json && isCraftRole(role) && (result.json as any)?.issues) {
      console.warn(`[SCHEMA_WARN] role="${role}" looks like critic output; check prompt mapping.`);
    }
    if (result.json && isCriticRole(role) && (result.json as any)?.proposedChanges) {
      console.warn(`[SCHEMA_WARN] role="${role}" looks like craft output; check prompt mapping.`);
    }

    // Short-circuit if JSON parse failed (BEFORE Zod validation)
    // This separates parse failures (retryable) from schema mismatches (non-retryable)
    if (result.json == null) {
      return {
        artifact: {
          kind: `swarm.specialist.${role}`,
          payload: {
            ok: false,
            stopReason: "invalid_json",
            fingerprint: `${trace.jobId}:${role}:json_parse_failed`,
            errors: ["JSON parse failed: result.json was null"],
          },
          customerSafe: false,
        },
        meta: {
          model: result.meta.model,
          requestId: result.meta.requestId,
          latencyMs: result.latencyMs,
          inputTokens: result.usage.inputTokens,
          outputTokens: result.usage.outputTokens,
          costUsd: result.cost.estimatedUsd,
        },
        stopReason: "invalid_json",
      };
    }

    // Select schema for validation (after result exists, before Zod)
    const zodSchema = getSchemaForRole(role);

    // Validate JSON with Zod schema (hard gate)
    const parseResult = zodSchema.safeParse(result.json);
    
    if (!parseResult.success) {
      // DEBUG: Log Zod validation errors
      try {
        const debugDir = join("/home/ubuntu/launchbase/runs", "debug_raw");
        const debugFile = join(debugDir, `${role}__ZOD_ERROR__${Date.now()}.txt`);
        const debugContent = [
          `=== ZOD VALIDATION ERROR (${role}) ===`,
          `Model: ${result.meta.model}`,
          `Request ID: ${result.meta.requestId}`,
          ``,
          `=== ERRORS ===`,
          JSON.stringify(zodIssuesToStrings(parseResult.error), null, 2),
          ``,
          `=== RAW TEXT ===`,
          result.rawText,
        ].join("\n");
        writeFileSync(debugFile, debugContent, "utf8");
        console.log(`[DEBUG] Zod error saved to: ${debugFile}`);
      } catch (debugErr) {
        console.warn("[DEBUG] Failed to write Zod error:", debugErr);
      }

      // Zod validation failed - log details and return error artifact
      console.error(
        `[ZOD_FAIL] role=${role} issues=${(parseResult.error as any).issues?.length ?? 0}`,
        ((parseResult.error as any).issues ?? []).map((i: any) => ({
          path: i.path,
          message: i.message,
          code: i.code,
        }))
      );
      
      return {
        artifact: {
          kind: `swarm.specialist.${role}`,
          payload: {
            ok: false,
            stopReason: "ajv_failed",
            fingerprint: `${trace.jobId}:${role}:zod_validation`,
            errors: zodIssuesToStrings(parseResult.error),
          },
          customerSafe: false,
        },
        meta: {
          model: result.meta.model,
          requestId: result.meta.requestId,
          latencyMs: result.latencyMs,
          inputTokens: result.usage.inputTokens,
          outputTokens: result.usage.outputTokens,
          costUsd: result.cost.estimatedUsd,
        },
        stopReason: "ajv_failed",
      };
    }

    // Auto-reject pass=true in ruthless critic mode (QA guardrail)
    let finalPayload = result.json;
    if (role.includes("critic") && role.includes("ruthless") && finalPayload.pass === true) {
      console.warn(`[CRITIC] Auto-rejecting pass=true in ruthless mode (${role})`);
      finalPayload = {
        ...finalPayload,
        pass: false,
        issues: [
          ...finalPayload.issues,
          {
            severity: "major",
            description: "Critic returned pass=true in ruthless mode; treating as failure to follow contract.",
            location: "design.conversion.scannability",
            rationale: "Ruthless mode must always escalate (pass=false)",
          },
        ],
        suggestedFixes: [
          ...finalPayload.suggestedFixes,
          {
            targetKey: "design.conversion.scannability",
            fix: "Enforce ruthless mode contract: always return pass=false",
            rationale: "QA guardrail to ensure deterministic pipeline behavior",
          },
        ],
      };
    }

    // Success
    return {
      artifact: {
        kind: `swarm.specialist.${role}`,
        payload: finalPayload,
        customerSafe: false, // Always false for specialists
      },
      meta: {
        model: result.meta.model,
        requestId: result.meta.requestId,
        latencyMs: result.latencyMs,
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
        costUsd: result.cost.estimatedUsd,
      },
      stopReason: "ok",
    };
  } catch (err) {
    // Determine stopReason from error
    const errorMessage = err instanceof Error ? err.message : String(err);
    const errorStack = err instanceof Error ? err.stack : undefined;
    let stopReason: SpecialistStopReason = "provider_failed";

    console.error(`[SPECIALIST_ERROR] role=${role} error=${errorMessage}`);
    console.error(`[SPECIALIST_ERROR_STACK]`, errorStack);

    if (errorMessage.includes("timeout")) {
      stopReason = "timeout";
    } else if (errorMessage.includes("router")) {
      stopReason = "router_failed";
    }

    // Return error artifact (no prompt leakage)
    return {
      artifact: {
        kind: `swarm.specialist.${role}`,
        payload: {
          ok: false,
          stopReason,
          fingerprint: `${trace.jobId}:${role}:${stopReason}`,
        },
        customerSafe: false,
      },
      meta: {
        model: roleConfig.model,
        requestId: "none",
        latencyMs: 0,
        inputTokens: 0,
        outputTokens: 0,
        costUsd: 0,
      },
      stopReason,
    };
  }
}

/**
 * Call specialist with automatic retry + fallback ladder
 * 
 * Implements timeout ladder with automatic model fallback:
 * 1. gpt-5.2-pro (180s) → 2. gpt-5.2 (150s) → 3. gpt-4o (90s)
 * 
 * Retry rules:
 * - Max 2 retries (3 attempts total)
 * - Retry only on: timeout, provider_failed, invalid_json
 * - Budget safety: auto-escalate if cost > $2
 * 
 * @param input - Specialist input
 * @param enableLadder - Enable model fallback ladder (default: false for reliability gate)
 * @returns SpecialistOutput with retry metadata
 */
export async function callSpecialistWithRetry(
  input: SpecialistInput,
  enableLadder: boolean = false,
  enableContentValidation: boolean = true
): Promise<SpecialistOutput & { retryMeta?: RetryMetadata }> {
  const { role, roleConfig } = input;
  
  // Get model ladder for this role
  const ladder = getModelLadderForRole(role);
  
  // If ladder disabled, use original model only
  const effectiveLadder = enableLadder ? ladder : [{ model: roleConfig.model, timeoutMs: roleConfig.timeoutMs || 90000 }];
  
  // Retry metadata
  const retryMeta: RetryMetadata = {
    attemptCount: 0,
    attemptModels: [],
    finalModelUsed: roleConfig.model,
    finalTimeoutMs: roleConfig.timeoutMs || 90000,
    totalCost: 0,
  };
  
  let lastError: Error | null = null;
  
  // Try each model in the ladder
  for (let i = 0; i < effectiveLadder.length && i < 3; i++) {
    const currentConfig = effectiveLadder[i];
    retryMeta.attemptCount++;
    retryMeta.attemptModels.push(currentConfig.model);
    
    console.log(`[RETRY_LADDER] Attempt ${retryMeta.attemptCount}: ${currentConfig.model} (timeout: ${currentConfig.timeoutMs}ms)`);
    
    // Update roleConfig with current model + timeout
    const modifiedInput = {
      ...input,
      roleConfig: {
        ...roleConfig,
        model: currentConfig.model,
        timeoutMs: currentConfig.timeoutMs,
      },
    };
    
    try {
      // Call specialist
      const result = await callSpecialistAIML(modifiedInput);
      
      // Update retry metadata
      retryMeta.finalModelUsed = currentConfig.model;
      retryMeta.finalTimeoutMs = currentConfig.timeoutMs;
      retryMeta.totalCost += result.meta.costUsd;
      
      // Budget safety check
      if (exceedsBudgetThreshold(retryMeta.totalCost)) {
        console.warn(`[RETRY_LADDER] Budget threshold exceeded: $${retryMeta.totalCost.toFixed(4)}`);
        return {
          ...result,
          artifact: {
            ...result.artifact,
            payload: {
              ...result.artifact.payload,
              requiresApproval: true,
              budgetExceeded: true,
            },
          },
          retryMeta,
        };
      }
      
      // Content Contract Validator: Check output shape BEFORE declaring success
      if (enableContentValidation && result.stopReason === "ok") {
        const contentValidation = validateContentContract(role, result.artifact?.payload);
        
        if (!contentValidation.valid) {
          console.warn(`[CONTENT_VALIDATOR] Failed: ${contentValidation.reason}`);
          console.log(`[RETRY_LADDER] Content validation failed, trying next model...`);
          
          // Mark as content_failed and retry
          lastError = new Error(`Content validation failed: ${contentValidation.reason}`);
          continue; // Try next model in ladder
        }
        
        console.log(`[RETRY_LADDER] Success on attempt ${retryMeta.attemptCount}`);
        return { ...result, retryMeta };
      }
      
      // If not retryable, return failure immediately
      if (!shouldRetry(result.stopReason)) {
        console.log(`[RETRY_LADDER] Non-retryable failure: ${result.stopReason}`);
        return { ...result, retryMeta };
      }
      
      // Retryable failure - log and continue to next model
      console.log(`[RETRY_LADDER] Retryable failure: ${result.stopReason}, trying next model...`);
      lastError = new Error(`Specialist failed with: ${result.stopReason}`);
      
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.error(`[RETRY_LADDER] Attempt ${retryMeta.attemptCount} threw error:`, lastError.message);
    }
  }
  
  // All retries exhausted - return final failure
  console.error(`[RETRY_LADDER] All ${retryMeta.attemptCount} attempts failed`);
  
  return {
    artifact: {
      kind: `swarm.specialist.${role}`,
      payload: {
        ok: false,
        stopReason: "provider_failed",
        fingerprint: `${input.trace.jobId}:${role}:all_retries_failed`,
        role,
      },
      customerSafe: false,
    },
    meta: {
      model: retryMeta.finalModelUsed,
      requestId: "none",
      latencyMs: 0,
      inputTokens: 0,
      outputTokens: 0,
      costUsd: retryMeta.totalCost,
    },
    stopReason: "provider_failed",
    retryMeta,
  };
}
