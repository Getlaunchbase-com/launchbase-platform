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
import { CraftOutputSchema } from "./schemas/craft.schema";
import { CriticOutputSchema } from "./schemas/critic.schema";

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
    design_critic: "design_critic.md",
    design_critic_ruthless: "design_critic_ruthless.md",
    prompt_architect: "prompt_architect.md",
    prompt_auditor: "prompt_auditor.md",
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
const DESIGN_CRITIC_PROMPT = loadPromptPack("design_critic");
const DESIGN_CRITIC_RUTHLESS_PROMPT = loadPromptPack("design_critic_ruthless");
const PROMPT_ARCHITECT_PROMPT = loadPromptPack("prompt_architect");
const PROMPT_AUDITOR_PROMPT = loadPromptPack("prompt_auditor");

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
    design_critic: DESIGN_CRITIC_PROMPT,
    design_critic_ruthless: DESIGN_CRITIC_RUTHLESS_PROMPT,
    prompt_architect: PROMPT_ARCHITECT_PROMPT,
    prompt_auditor: PROMPT_AUDITOR_PROMPT,
  };
  const systemPrompt = promptMap[role] || CRAFT_PROMPT;

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
  }

  // Determine Zod schema for validation
  // Designer roles use Craft schema (proposedChanges[])
  // Critic roles use Critic schema (issues[] + suggestedFixes[])
  const useCraftSchema = ["craft", "designer_systems", "designer_brand"].includes(role);
  const zodSchema = useCraftSchema ? CraftOutputSchema : CriticOutputSchema;

  try {
    // Call provider with timeout
    const timeoutMs = roleConfig.timeoutMs || 25000;
    const result = await Promise.race([
      completeJson(
        {
          model: roleConfig.model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.7,
          maxTokens: 2000,
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
          JSON.stringify(parseResult.error.errors, null, 2),
          ``,
          `=== RAW TEXT ===`,
          result.rawText,
        ].join("\n");
        writeFileSync(debugFile, debugContent, "utf8");
        console.log(`[DEBUG] Zod error saved to: ${debugFile}`);
      } catch (debugErr) {
        console.warn("[DEBUG] Failed to write Zod error:", debugErr);
      }

      // Zod validation failed - return error artifact
      return {
        artifact: {
          kind: `swarm.specialist.${role}`,
          payload: {
            ok: false,
            stopReason: "ajv_failed",
            fingerprint: `${trace.jobId}:${role}:zod_validation`,
            errors: parseResult.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`),
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
    let stopReason: SpecialistStopReason = "provider_failed";

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
