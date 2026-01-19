/**
 * AI Provider Factory
 * 
 * Transport layer for AI providers (aiml/memory/log).
 * Mirrors EMAIL_TRANSPORT pattern for deterministic testing.
 */

import type { AiProvider, AiChatRequest, AiChatResponse, AiChatMessage } from "./types";
import { aimlProvider } from "./aimlProvider";
import { safeError, safePreview, toSafeClientMessage } from "../security/redaction";

// ============================================
// TRANSPORT TYPES
// ============================================

export type AiTransport = "aiml" | "memory" | "log";

// ============================================
// MEMORY TRANSPORT (for tests)
// ============================================

/**
 * In-memory storage for deterministic test responses
 * Key: ${step}:${model}:${hash}
 */
const memoryStore = new Map<string, string>();

/**
 * Seed a response for memory transport using trace-based key (PREFERRED)
 * This is deterministic and doesn't depend on prompt content.
 */
export function seedMemoryTraceResponse(
  schema: string,
  model: string,
  jobId: string,
  round: number,
  response: string
): void {
  const key = `${schema}:${model}:${jobId}:${round}`;
  memoryStore.set(key, response);
}

/**
 * Seed a response for memory transport using hash-based key (LEGACY)
 * Kept for backward compatibility but brittle (depends on prompt rendering).
 * @deprecated Use seedMemoryTraceResponse instead
 */
export function seedMemoryResponse(
  step: string,
  model: string,
  userTextHash: string,
  response: string
): void {
  const key = `${step}:${model}:${userTextHash}`;
  memoryStore.set(key, response);
}

/**
 * Clear all memory responses (used in tests)
 */
export function clearMemoryResponses(): void {
  memoryStore.clear();
}

/**
 * Simple hash function for memory keys
 */
export function simpleHash(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

type TraceParsed = {
  jobId?: string;
  step?: string;
  schema?: string;
  round?: number;
  caps?: { roundLimit?: number; costCapUsd?: number };
};

function parseTrace(trace: unknown): TraceParsed {
  if (!trace) return {};

  // If object, return as-is
  if (typeof trace === "object") return trace as TraceParsed;

  if (typeof trace !== "string") return {};

  let s = trace.trim();

  // Attempt up to 2 parses to handle double-stringify
  for (let i = 0; i < 2; i++) {
    if (!(s.startsWith("{") || s.startsWith('"'))) break;
    try {
      const parsed = JSON.parse(s);
      if (typeof parsed === "string") {
        s = parsed.trim();
        continue; // try parsing again
      }
      return parsed as TraceParsed; // object
    } catch {
      break;
    }
  }

  return {};
}

function schemaFromTraceOrFallback(request: { trace?: any; model?: string }): string | undefined {
  const t = parseTrace(request.trace);
  if (t?.schema && typeof t.schema === "string") return t.schema;

  const traceStr =
    typeof request.trace === "string" ? request.trace : JSON.stringify(request.trace ?? "");

  if (traceStr.includes('"schema":"copy_proposal"') || traceStr.includes("copy_proposal")) return "copy_proposal";
  if (traceStr.includes('"schema":"critique"') || traceStr.includes("critique")) return "critique";
  if (traceStr.includes('"schema":"decision_collapse"') || traceStr.includes("decision_collapse")) return "decision_collapse";

  return undefined;
}

/**
 * Memory transport provider (deterministic, for tests)
 */
const memoryProvider: AiProvider = {
  async chat(req: AiChatRequest): Promise<AiChatResponse> {
    const { model, messages, trace } = req;
    const traceObj = parseTrace(trace);

    // Try trace-based key first (PREFERRED - deterministic, no prompt dependency)
    const schema = traceObj?.schema;
    const jobId = traceObj?.jobId;
    const round = traceObj?.round ?? 0;
    const traceKey = schema && jobId ? `${schema}:${model}:${jobId}:${round}` : null;

    let rawText: string | undefined;

    if (traceKey) {
      // Try exact match first
      rawText = memoryStore.get(traceKey);
      
      // Wildcard matching ONLY in tests (for unpredictable Date.now() jobIds)
      // Production code should use deterministic jobIds or mock Date.now()
      if (!rawText && schema && jobId && typeof process !== 'undefined' && (process.env.VITEST === 'true' || process.env.VITEST === '1')) {
        for (const [key, value] of Array.from(memoryStore.entries())) {
          if (key.startsWith(`${schema}:${model}:`) && key.endsWith(`:${round}`)) {
            rawText = value;
            break;
          }
        }
      }
    }

    // Fallback to hash-based key (LEGACY - brittle but keeps old tests working)
    // WARNING: This uses prompt content for keys - deprecated, use trace-based seeding
    if (!rawText) {
      const userMessage = messages.find((m) => m.role === "user")?.content || "";
      const hash = simpleHash(userMessage);
      const hashKey = `${traceObj?.step || "unknown"}:${model}:${hash}`;
      rawText = memoryStore.get(hashKey);
    }

    if (!rawText) {
      // No seeded response found, return schema-based fixture

      // Schema-first routing
      const schemaRaw = schemaFromTraceOrFallback(req);
      const schema = schemaRaw ?? "v2"; // Default to v2 if undefined
      let fixture: any;

      switch (schema) {
        case "intent_parse":
          fixture = {
            userText: "I want to rewrite my homepage copy",
            intent: "copy_rewrite",
            confidence: 0.95,
            issues: [],
            needsHuman: false,
          };
          break;

        case "copy_proposal":
          fixture = {
            schemaVersion: "v1",
            requiresApproval: true,
            variants: [
              {
                targetKey: "hero.headline",
                value: "Transform Your Business",
                rationale: "Clear, benefit-led headline for above-the-fold.",
                confidence: 0.9,
                risks: [],
              },
            ],
            confidence: 0.9,
            risks: [],
            assumptions: ["User wants homepage hero copy rewrite"],
          };
          break;

        case "critique":
          fixture = {
            schemaVersion: "v1",
            pass: true,
            issues: [],
            suggestedFixes: [],
            confidence: 0.85,
            requiresApproval: true,
            evaluationCriteria: {
              clarity: 0.8,
              trust: 0.8,
              scanability: 0.8,
              mobileFold: 0.8,
              sectionContractCompliance: 0.8,
            },
          };
          break;

        case "decision_collapse": {
          const caps = traceObj?.caps ?? {};
          const roundLimit = Math.max(0, Math.min(2, Number(caps.roundLimit ?? 2)));
          const costCapUsd = Math.max(0, Math.min(10, Number(caps.costCapUsd ?? 2)));

          fixture = {
            schemaVersion: "v1",
            selectedProposal: {
              targetKey: "hero.headline",
              value: "Transform Your Business",
              rationale: "Clear, benefit-led headline for above-the-fold.",
              confidence: 0.9,
              risks: [],
            },
            reason: "Best balance of clarity and impact.",
            approvalText: "Approve updated hero headline.",
            previewRecommended: true,
            needsHuman: false,
            confidence: 0.9,
            requiresApproval: true,
            roundLimit,
            costCapUsd,
          };
          break;
        }

        case "v2":
          // Generic v2 fixture for tests that don't specify a schema
          fixture = {
            schemaVersion: "v2",
            success: true,
            message: "Memory provider generic v2 response",
            data: {},
          };
          break;

        default:
          throw new Error("SENTINEL::MEMORY_PROVIDER_DEFAULT_BRANCH::v2 (schema: " + schema + ")");
      }

      return {
        rawText: JSON.stringify(fixture),
        usage: {
          inputTokens: 0,
          outputTokens: 0,
        },
        providerMeta: {
          requestId: `memory-${Date.now()}`,
          model: `memory:${schema ?? "none"}`,
          finishReason: "stop",
        } as any,
      };
    }

    // Response found and will be returned

    return {
      rawText,
      usage: {
        inputTokens: 100, // Fake
        outputTokens: 200, // Fake
      },
      providerMeta: {
        requestId: `memory-${Date.now()}`,
        model,
        finishReason: "stop",
      },
    };
  },
};

// ============================================
// LOG TRANSPORT (for debugging)
// ============================================

/**
 * Log transport provider (prints request, returns invalid JSON)
 */
const logProvider: AiProvider = {
  async chat(req: AiChatRequest): Promise<AiChatResponse> {
    console.log("[AI:log] Chat request", {
      model: req.model,
      messageCount: req.messages.length,
      temperature: req.temperature,
      maxTokens: req.maxTokens,
      trace: req.trace,
      messages: req.messages.map((m) => ({
        role: m.role,
        contentLength: m.content.length,
        contentPreview: m.content.slice(0, 100),
      })),
    });

    // Return empty JSON (will fail validation to catch quickly)
    return {
      rawText: "{}",
      usage: {
        inputTokens: 0,
        outputTokens: 0,
      },
      providerMeta: {
        requestId: `log-${Date.now()}`,
        model: req.model,
        finishReason: "stop",
      },
    };
  },
};

// ============================================
// FACTORY
// ============================================

/**
 * Get AI provider based on transport configuration
 * 
 * @param transport - Transport type (default: from env AI_TRANSPORT or "aiml")
 * @returns AiProvider instance
 */
export function getAiProvider(transport?: AiTransport): AiProvider {
  // Read from env at call time (not module load time) so tests can override
  const selectedTransport = transport || (process.env.AI_PROVIDER as AiTransport) || "aiml";

  switch (selectedTransport) {
    case "aiml":
      return aimlProvider;

    case "memory":
      return memoryProvider;

    case "log":
      return logProvider;

    default:
      console.warn(`[AI] Unknown transport: ${selectedTransport}, falling back to aiml`);
      return aimlProvider;
  }
}

/**
 * Get current transport name
 */
export function getCurrentTransport(): AiTransport {
  return (process.env.AI_PROVIDER as AiTransport) || "aiml";
}

// ============================================
// HIGH-LEVEL WRAPPER (completeJson)
// ============================================

/**
 * CompleteJson request options
 */
export interface CompleteJsonOptions {
  model: string;
  messages: AiChatMessage[];
  temperature?: number;
  maxTokens?: number;
  trace: {
    jobId: string;
    step: string;
    round: number;
  };
}

/**
 * CompleteJson response
 */
export interface CompleteJsonResult {
  rawText: string;
  json: any | null;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
  meta: {
    provider: string;
    model: string;
    requestId: string;
    finishReason: string;
  };
  cost: {
    estimatedUsd: number;
    creditsUsed: number | null;
  };
  latencyMs: number;
}

/**
 * High-level wrapper that calls provider.chat() and parses JSON
 * 
 * This is the interface tests and orchestrators should use.
 * 
 * Supports optional ModelRouter integration for automatic failover.
 */
export async function completeJson(
  options: CompleteJsonOptions,
  transport?: AiTransport,
  routerOpts?: { task?: string; useRouter?: boolean; strict?: boolean }
): Promise<CompleteJsonResult> {
  const selectedTransport = transport || (process.env.AI_PROVIDER as AiTransport) || "aiml";
  const provider = getAiProvider(selectedTransport);
  const startTime = Date.now();

  let finalModel = options.model;
  const trace = `${options.trace.jobId}:${options.trace.step}:${options.trace.round}`;

  // If router enabled and transport is aiml, use ModelRouter for failover
  if (routerOpts?.useRouter && selectedTransport === "aiml") {
    try {
      const { modelRouter } = await import("../index");
      const result = await modelRouter.route(
        {
          task: routerOpts.task || "json",
          requestedModelId: options.model,
          maxAttempts: 3,
        },
        async (modelId) => {
          finalModel = modelId;
          return await provider.chat({
            ...options,
            model: modelId,
            jsonOnly: true,
          });
        }
      );

      const latencyMs = Date.now() - startTime;
      return buildCompleteJsonResult(result, finalModel, selectedTransport, latencyMs, trace);
    } catch (err) {
      // Do NOT log raw error object.
      const e = safeError(err);
      console.warn("[AI] ModelRouter failed", {
        trace,
        transport: selectedTransport,
        requestedModel: options.model,
        task: routerOpts.task || "json",
        error: e,
      });

      // STRICT MODE: no fallback
      if (routerOpts.strict) {
        throw new Error(toSafeClientMessage({ trace, hint: "router_strict" }));
      }
      // Non-strict fallback continues below.
    }
  }

  // Call provider directly (no router)
  try {
    const response = await provider.chat({
      ...options,
      jsonOnly: true,
    });

    const latencyMs = Date.now() - startTime;
    return buildCompleteJsonResult(response, finalModel, selectedTransport, latencyMs, trace);
  } catch (err) {
    // Ensure we never leak provider message details to callers up-stack.
    const e = safeError(err);
    console.error("[AI] Provider chat failed", {
      trace,
      transport: selectedTransport,
      model: finalModel,
      error: e,
    });
    throw new Error(toSafeClientMessage({ trace }));
  }
}

/**
 * Helper to build CompleteJsonResult from provider response
 */
function buildCompleteJsonResult(
  response: AiChatResponse,
  model: string,
  transport: string,
  latencyMs: number,
  trace?: string
): CompleteJsonResult {
  let json: any | null = null;

  // Strip markdown code blocks if present (common with Llama models)
  let textToParse = response.rawText;
  const mdJsonMatch = textToParse.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (mdJsonMatch) {
    textToParse = mdJsonMatch[1].trim();
  }

  try {
    json = JSON.parse(textToParse);
  } catch (err) {
    // NEVER log rawText preview. Log only a hash + length.
    console.warn("[AI] Failed to parse JSON response", {
      trace,
      model: response.providerMeta?.model || model,
      requestId: response.providerMeta?.requestId || "unknown",
      rawText: safePreview(response.rawText),
      error: safeError(err),
    });
  }

  // Calculate cost (rough estimate for now)
  const inputTokens = response.usage?.inputTokens || 0;
  const outputTokens = response.usage?.outputTokens || 0;
  const estimatedUsd = (inputTokens * 0.00001 + outputTokens * 0.00003); // Rough GPT-4o-mini pricing

  return {
    rawText: response.rawText,
    json,
    usage: {
      inputTokens,
      outputTokens,
    },
    meta: {
      provider: transport,
      model: response.providerMeta?.model || model,
      requestId: response.providerMeta?.requestId || "unknown",
      finishReason: response.providerMeta?.finishReason || "unknown",
    },
    cost: {
      estimatedUsd,
      creditsUsed: null, // TODO: Extract from AIML response headers
    },
    latencyMs,
  };
}
