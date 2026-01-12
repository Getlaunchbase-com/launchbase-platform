/**
 * AI Provider Factory
 * 
 * Transport layer for AI providers (aiml/memory/log).
 * Mirrors EMAIL_TRANSPORT pattern for deterministic testing.
 */

import type { AiProvider, AiChatRequest, AiChatResponse, AiChatMessage } from "./types";
import { aimlProvider } from "./aimlProvider";
import { safeError, safePreview, toSafeClientMessage, toErrorFingerprint } from "../security/redaction";
import crypto from "node:crypto";

// ============================================
// HELPERS
// ============================================

function hashText(s: string) {
  return crypto.createHash("sha256").update(s).digest("hex").slice(0, 12);
}

// ============================================
// TRANSPORT TYPES
// ============================================

export type AiTransport = "aiml" | "memory" | "log";

// ============================================
// SCHEMA-VALID FIXTURES (for memory transport)
// ============================================

/**
 * Infer targetKey from request messages to ensure fixture matches what runAiTennis expects
 */
function inferTargetKey(messages: Array<{ role: string; content: string }>): string {
  const text = messages.map(m => m.content).join("\n");

  // Extract targetKey from messages (looks for hero.headline, hero.cta, etc.)
  const match = text.match(/\b(hero\.(headline|subheadline|cta)|trust\.items|services\.items|socialProof\.(reviews|outcomes|credentials))\b/i);
  if (match?.[0]) return match[0];

  // Default to hero.headline
  return "hero.headline";
}

/**
 * Build copy_proposal fixture with dynamic targetKey
 */
function buildCopyProposalFixture(targetKey: string) {
  return {
    schemaVersion: "v1",
    variants: [
      {
        targetKey,
        value: "Ship faster with LaunchBase",
        rationale: "Short, benefit-led, and clear on outcome.",
        confidence: 0.84,
        risks: ["May be too generic for niche audiences"],
      },
    ],
    requiresApproval: true,
    confidence: 0.84,
    risks: [],
    assumptions: ["Audience is evaluating a platform product"],
  };
}

/**
 * Minimal schema-valid fixture for critique (critique step)
 */
const FIXTURE_CRITIQUE_V1 = {
  schemaVersion: "v1",
  pass: true,
  issues: [],
  suggestedFixes: [],
  confidence: 0.8,
  requiresApproval: true,
  evaluationCriteria: {
    clarity: 0.8,
    trust: 0.8,
    scanability: 0.8,
    mobileFold: 0.8,
    sectionContractCompliance: 1.0,
  },
};

/**
 * Minimal schema-valid fixture for decision_collapse (collapse step)
 */
const FIXTURE_DECISION_COLLAPSE_V1 = {
  schemaVersion: "v1",
  selectedProposal: {
    type: "copy" as const,
    targetKey: "hero.headline",
    value: "Launch faster with LaunchBase",
  },
  reason: "Best clarity and strongest value proposition.",
  approvalText: "Approve this copy change for hero.headline.",
  previewRecommended: true,
  needsHuman: false,
  confidence: 0.85,
  requiresApproval: true,
  roundLimit: 2,
  costCapUsd: 2,
};

/**
 * Minimal schema-valid fixture for intent_parse
 */
const FIXTURE_INTENT_PARSE_V1 = {
  schemaVersion: "v1",
  intentType: "COPY_CHANGE",
  targetKeys: ["hero.headline"],
  userText: "Test request",
  proposedDirection: "Update hero headline",
  needsHuman: false,
  confidence: 0.85,
  requiresApproval: true,
};

/**
 * Trace object type (supports both string and object formats)
 */
type TraceObj =
  | string
  | {
      jobId?: string;
      step?: string;   // "generate" | "critique" | "collapse"
      schema?: string; // "copy_proposal" | "critique" | "decision_collapse"
      round?: number;
    }
  | undefined;

/**
 * Parse trace from string or object
 */
function parseTrace(t?: unknown): any {
  if (typeof t !== "string") return t;
  if (t.startsWith("{")) {
    try { return JSON.parse(t); } catch { return null; }
  }
  return null;
}

/**
 * Route trace to contract type
 * Handles both string traces and object traces with step/schema mapping
 */
function contractFromTrace(trace: TraceObj): string | null {
  // Parse JSON string traces
  const parsed = parseTrace(trace);
  const traceObj = parsed || trace;
  // 1) If trace is an object and includes schema, use it directly
  if (traceObj && typeof traceObj === "object") {
    const schema = String((traceObj as any).schema || "").toLowerCase();
    if (schema === "copy_proposal") return "copy_proposal";
    if (schema === "critique") return "critique";
    if (schema === "decision_collapse") return "decision_collapse";
    if (schema === "intent_parse") return "intent_parse";

    // 2) Otherwise map step -> contract
    const step = String((traceObj as any).step || "").toLowerCase();
    if (step === "generate") return "copy_proposal";
    if (step === "critique") return "critique";
    if (step === "collapse") return "decision_collapse";
    if (step === "intent_parse" || step === "intent") return "intent_parse";
  }

  // 3) If trace is a string, do keyword matching
  const t = (typeof traceObj === "string" ? traceObj : JSON.stringify(traceObj || {})).toLowerCase();
  if (t.includes("copy_proposal") || t.includes("generate_candidates") || t.includes('"step":"generate"') || t.includes("generate")) {
    return "copy_proposal";
  }
  if (t.includes("critique") || t.includes('"step":"critique"')) return "critique";
  if (t.includes("decision_collapse") || t.includes('"step":"collapse"') || t.includes("collapse")) return "decision_collapse";
  if (t.includes("intent_parse") || t.includes("intent")) return "intent_parse";

  return null;
}

/**
 * Get fixture for contract type
 */
function fixtureForContract(type: string, messages?: Array<{ role: string; content: string }>, trace?: any): unknown {
  switch (type) {
    case "copy_proposal": {
      const targetKey = messages ? inferTargetKey(messages) : "hero.headline";
      return buildCopyProposalFixture(targetKey);
    }
    case "critique":
      return FIXTURE_CRITIQUE_V1;
    case "decision_collapse": {
      const caps = trace?.caps || { roundLimit: 2, costCapUsd: 2 };
      return {
        ...FIXTURE_DECISION_COLLAPSE_V1,
        roundLimit: caps.roundLimit,
        costCapUsd: caps.costCapUsd,
      };
    }
    case "intent_parse":
      return FIXTURE_INTENT_PARSE_V1;
    default:
      // Fallback for unknown contract types
      return { 
        schemaVersion: "v1", 
        requiresApproval: true, 
        needsHuman: true, 
        confidence: 0.5 
      };
  }
}

// ============================================
// MEMORY TRANSPORT (for tests)
// ============================================

/**
 * In-memory storage for deterministic test responses
 * Key: ${step}:${model}:${hash}
 */
const memoryStore = new Map<string, string>();

/**
 * Seed a response for memory transport (used in tests)
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
function simpleHash(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Memory transport provider (deterministic, for tests)
 */
const memoryProvider: AiProvider = {
  async chat(req: AiChatRequest): Promise<AiChatResponse> {
    const { model, messages, trace } = req;

    // Env-controlled modes for testing error paths
    const mode = process.env.MEMORY_PROVIDER_MODE;

    if (mode === "throw") {
      const msg = process.env.MEMORY_PROVIDER_THROW_MESSAGE || "memory provider throw";
      throw new Error(msg);
    }

    if (mode === "raw") {
      const raw = process.env.MEMORY_PROVIDER_RAW_TEXT ?? '{"ok":true}';
      return {
        rawText: raw,
        usage: { inputTokens: 1, outputTokens: 1 },
        providerMeta: {
          requestId: `memory-raw-${Date.now()}`,
          model: model || "memory-model",
          finishReason: "stop",
        },
      };
    }

    // Build key from step + model + user message content
    const parsedTraceForKey = parseTrace(trace);
    const traceStep = parsedTraceForKey?.step || (typeof trace === "object" ? (trace as any).step : undefined) || "unknown";
    const userMessage = messages.find((m) => m.role === "user")?.content || "";
    const hash = simpleHash(userMessage);
    const key = `${traceStep}:${model}:${hash}`;

    // Lookup response
    const rawText = memoryStore.get(key);

    if (!rawText) {
      console.warn("[AI:memory] No seeded response found, returning default valid JSON", {
        key,
        trace,
        availableKeys: Array.from(memoryStore.keys()),
      });

      // Return default valid JSON for each schema type
      // Route by trace string (contains contract name)
      const contractType = contractFromTrace(trace);
      const parsedTrace = parseTrace(trace);
      const defaultText = contractType 
        ? JSON.stringify(fixtureForContract(contractType, messages, parsedTrace))
        : "{}";

      return {
        rawText: defaultText,
        usage: {
          inputTokens: 0,
          outputTokens: 0,
        },
        providerMeta: {
          requestId: `memory-${Date.now()}`,
          model,
          finishReason: "stop",
        },
      };
    }

    console.log("[AI:memory] Using seeded response", {
      key,
      trace,
      responseLength: rawText.length,
    });

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
  trace: string | {
    jobId: string;
    step: string;
    schema?: string;
    round: number;
  };
}

/**
 * Router options for completeJson
 */
export interface RouterOpts {
  task?: "chat" | "json" | "embedding" | string;
  useRouter?: boolean;
  strict?: boolean;
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
  routerOpts?: RouterOpts
): Promise<CompleteJsonResult> {
  const selectedTransport = transport || (process.env.AI_PROVIDER as AiTransport) || "aiml";
  const provider = getAiProvider(selectedTransport);
  const startTime = Date.now();

  let finalModel = options.model;
  const trace = typeof options.trace === "string" 
    ? options.trace 
    : `${options.trace.jobId}:${options.trace.step}:${options.trace.round}`;

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
      // NEVER log error.message/stack/object (can contain prompt/user text)
      console.warn("[AI] ModelRouter failed", {
        trace,
        transport: selectedTransport,
        requestedModel: options.model,
        task: routerOpts.task || "json",
        ...toErrorFingerprint(err),
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
    // NEVER log error.message/stack/object (can contain prompt/user text)
    console.error("[AI] Provider chat failed", {
      trace,
      transport: selectedTransport,
      model: finalModel,
      ...toErrorFingerprint(err),
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

  try {
    json = JSON.parse(response.rawText);
  } catch (err) {
    // NEVER log rawText content - only fingerprint
    const raw = response.rawText ?? "";
    console.warn("[AI] JSON parse failed", {
      trace: trace ?? "unknown",
      model: response.providerMeta?.model || model,
      requestId: response.providerMeta?.requestId || "unknown",
      rawLen: raw.length,
      rawHash: hashText(raw),
      firstChar: raw.length ? raw.charCodeAt(0) : null,
      lastChar: raw.length ? raw.charCodeAt(raw.length - 1) : null,
      error: toErrorFingerprint(err),
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
