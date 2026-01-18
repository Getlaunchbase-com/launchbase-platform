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

import { completeJson } from "../../providers/providerFactory";
import type { ArtifactV1 } from "../types";

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
  role: "craft" | "critic";
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
 * Craft specialist JSON schema (minimal)
 */
const CRAFT_SCHEMA = {
  type: "object",
  properties: {
    draft: { type: "string" },
    notes: { type: "array", items: { type: "string" } },
  },
  required: ["draft", "notes"],
  additionalProperties: false,
};

/**
 * Critic specialist JSON schema (minimal)
 */
const CRITIC_SCHEMA = {
  type: "object",
  properties: {
    issues: { type: "array", items: { type: "string" } },
    verdict: { type: "string", enum: ["pass", "revise"] },
    suggestions: { type: "array", items: { type: "string" } },
  },
  required: ["issues", "verdict", "suggestions"],
  additionalProperties: false,
};

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

  // Build system prompt based on role
  const systemPrompt =
    role === "craft"
      ? "You are a craft specialist. Generate high-quality proposals based on the task and inputs. Return JSON with 'draft' (string) and 'notes' (array of strings)."
      : "You are a critic specialist. Find flaws, edge cases, and regressions in proposals. Return JSON with 'issues' (array of strings), 'verdict' ('pass' or 'revise'), and 'suggestions' (array of strings).";

  // Build user prompt
  const userPrompt = `Plan: ${JSON.stringify(specInput.plan, null, 2)}${
    specInput.context ? `\n\nContext: ${JSON.stringify(specInput.context, null, 2)}` : ""
  }\n\nProvide your ${role} response in JSON format.`;

  // Determine expected schema
  const expectedSchema = role === "craft" ? CRAFT_SCHEMA : CRITIC_SCHEMA;

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

    // Validate JSON against schema (simple check, not full Ajv)
    if (!result.json || typeof result.json !== "object") {
      return {
        artifact: {
          kind: `swarm.specialist.${role}`,
          payload: {
            ok: false,
            stopReason: "json_parse_failed",
            fingerprint: `${trace.jobId}:${role}:json_parse`,
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
        stopReason: "json_parse_failed",
      };
    }

    // Basic schema validation
    const requiredFields = role === "craft" ? ["draft", "notes"] : ["issues", "verdict", "suggestions"];
    const missingFields = requiredFields.filter((field) => !(field in result.json));
    if (missingFields.length > 0) {
      return {
        artifact: {
          kind: `swarm.specialist.${role}`,
          payload: {
            ok: false,
            stopReason: "ajv_failed",
            fingerprint: `${trace.jobId}:${role}:ajv`,
            missingFields,
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

    // Success
    return {
      artifact: {
        kind: `swarm.specialist.${role}`,
        payload: result.json,
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


/**
 * Call specialist with automatic retry on transient failures
 * 
 * Retries on: timeout, router_failed, provider_failed
 * Does NOT retry on: ok, json_parse_failed, ajv_failed, cost_cap_exceeded
 * 
 * @param input - Specialist input
 * @param maxAttempts - Maximum retry attempts (default: 3)
 * @returns SpecialistOutput from last attempt
 */
export async function callSpecialistWithRetry(
  input: SpecialistInput,
  maxAttempts: number = 3
): Promise<SpecialistOutput> {
  const retryableReasons: SpecialistStopReason[] = ["timeout", "router_failed", "provider_failed"];
  
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
