/**
 * AIML Specialist Adapter
 * 
 * Single-responsibility module for calling AIML provider for specialist roles.
 * Loads prompts from promptPacks directory based on role name.
 * 
 * Hard rules:
 * - Never store prompts in artifacts
 * - On error: artifact payload is only { ok: false, stopReason, fingerprint }
 */

import { completeJson } from "../../providers/providerFactory";
import type { AiArtifactV1 } from "../types";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

// ES module __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Specialist stopReasons (frozen list)
 */
export type SpecialistStopReason =
  | "ok"
  | "router_failed"
  | "provider_failed"
  | "json_parse_failed"
  | "ajv_failed"
  | "timeout"
  | "cost_cap_exceeded"
  | "schema_failed"
  | "content_noncompliance";

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
  role: string; // Now accepts any role name
  trace: {
    jobId: string;
    runId?: string;
    step?: string;
  };
  input: {
    plan: any;
    context?: any;

    // Optional overrides for repair swarm
    userPromptOverride?: string;
    systemPromptOverride?: string;
  };
  roleConfig: SpecialistRoleConfig;
}

/**
 * Specialist call output
 */
export interface SpecialistOutput {
  artifact: AiArtifactV1;
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

// Cache for loaded prompts
const promptCache = new Map<string, string>();

/**
 * Load prompt from promptPacks directory
 * Tries multiple naming conventions: role.md, role_fast.md, etc.
 */
function loadPrompt(role: string): string {
  // Check cache first
  if (promptCache.has(role)) {
    return promptCache.get(role)!;
  }

  const promptDir = path.join(__dirname, "promptPacks");
  
  // Try different file naming patterns
  const patterns = [
    `${role}.md`,
    `${role}_fast.md`,
    role.replace(/_fast$/, ".md"),
    role.replace(/_ruthless$/, ".md"),
  ];

  for (const pattern of patterns) {
    const filePath = path.join(promptDir, pattern);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, "utf-8");
      promptCache.set(role, content);
      return content;
    }
  }

  // Fallback prompts for known roles
  const fallbacks: Record<string, string> = {
    craft: "You are a craft specialist. Generate high-quality proposals based on the task and inputs. Return JSON with 'draft' (string) and 'notes' (array of strings).",
    critic: "You are a critic specialist. Find flaws, edge cases, and regressions in proposals. Return JSON with 'issues' (array of strings), 'verdict' ('pass' or 'revise'), and 'suggestions' (array of strings).",
    change_selector_fast: `You are a change selector. Given a list of proposed changes, select the best 8 that maximize impact.
Return JSON: { "selectedChanges": [...8 items from input...], "rationale": "why these 8" }
Rules:
- Select EXACTLY 8 changes
- Prioritize by impact on conversion and clarity
- Return raw JSON only, no markdown`,
  };

  if (fallbacks[role]) {
    promptCache.set(role, fallbacks[role]);
    return fallbacks[role];
  }

  // Generic fallback
  const generic = `You are a ${role} specialist. Analyze the input and provide your expert response in JSON format.`;
  promptCache.set(role, generic);
  return generic;
}

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

  // Load system prompt from promptPacks (allow override)
  const systemPrompt =
    specInput.systemPromptOverride ?? loadPrompt(role);

  // Build user prompt (allow override)
  const userPrompt =
    specInput.userPromptOverride ??
    `Plan: ${JSON.stringify(specInput.plan, null, 2)}${
      specInput.context ? `\n\nContext: ${JSON.stringify(specInput.context, null, 2)}` : ""
    }\n\nProvide your ${role} response in JSON format.`;

  // Guard against missing prompt
  if (!userPrompt || typeof userPrompt !== "string") {
    throw new Error(`[AIML] Missing userPrompt (role=${role})`);
  }

  // Debug: Log override status in record mode
  if (process.env.SWARM_RECORD === "1") {
    console.log(`[swarm] role=${role} overrides? system=${!!specInput.systemPromptOverride} user=${!!specInput.userPromptOverride}`);
  }

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
            role, // explicit role for replay provider
            replayRunId: trace.jobId, // stable per job
          },
        },
        roleConfig.transport,
        { task: "json", useRouter: true, strict: false }
      ),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Specialist timeout")), timeoutMs)
      ),
    ]);

    // Handle null result
    if (!result) {
      return {
        artifact: {
          kind: `swarm.specialist.${role}`,
          payload: {
            ok: false,
            stopReason: "provider_failed",
            fingerprint: `${trace.jobId}:${role}:null_result`,
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
        stopReason: "provider_failed",
      };
    }

    // Handle JSON parse failure
    if (!result.json) {
      return {
        artifact: {
          kind: `swarm.specialist.${role}`,
          payload: {
            ok: false,
            stopReason: "json_parse_failed",
            fingerprint: `${trace.jobId}:${role}:json_parse_failed`,
          },
          customerSafe: false,
        },
        meta: {
          model: result.meta?.model || roleConfig.model,
          requestId: result.meta?.requestId || "unknown",
          latencyMs: result.latencyMs || 0,
          inputTokens: result.usage?.inputTokens || 0,
          outputTokens: result.usage?.outputTokens || 0,
          costUsd: result.cost?.estimatedUsd || 0,
        },
        stopReason: "json_parse_failed",
      };
    }

    // Success
    return {
      artifact: {
        kind: `swarm.specialist.${role}`,
        payload: result.json,
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

/**
 * Call specialist with automatic retry on transient failures
 * 
 * Retries on: timeout, router_failed, provider_failed
 * Does NOT retry on: ok, json_parse_failed, ajv_failed, cost_cap_exceeded
 * 
 * @param input - Specialist input
 * @param enableLadder - Whether to enable retry ladder (default: true). If false, only 1 attempt.
 * @returns SpecialistOutput from last attempt
 */
export async function callSpecialistWithRetry(
  input: SpecialistInput,
  enableLadder: boolean = true
): Promise<SpecialistOutput> {
  const retryableReasons: SpecialistStopReason[] = ["timeout", "router_failed", "provider_failed"];
  const maxAttempts = enableLadder ? 3 : 1;
  
  let lastOutput: SpecialistOutput | null = null;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const output = await callSpecialistAIML(input);
    lastOutput = output;
    
    // Success or non-retryable error
    if (output.stopReason === "ok" || !retryableReasons.includes(output.stopReason)) {
      return output;
    }
    
    // Log retry attempt
    console.log(`[callSpecialistWithRetry] Attempt ${attempt}/${maxAttempts} failed with ${output.stopReason}, retrying...`);
    
    // Exponential backoff: 1s, 2s, 4s
    if (attempt < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt - 1) * 1000));
    }
  }
  
  // Return last output after all retries exhausted
  return lastOutput!;
}
