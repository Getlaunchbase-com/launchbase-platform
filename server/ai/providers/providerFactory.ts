/**
 * AI Provider Factory
 * 
 * Transport layer for AI providers (aiml/memory/log).
 * Mirrors EMAIL_TRANSPORT pattern for deterministic testing.
 */

import type { AiProvider, AiChatRequest, AiChatResponse, AiChatMessage } from "./types";
import { aimlProvider } from "./aimlProvider";

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

    // Build key from step + model + user message content
    const userMessage = messages.find((m) => m.role === "user")?.content || "";
    const hash = simpleHash(userMessage);
    const key = `${trace.step}:${model}:${hash}`;

    // Lookup response
    const rawText = memoryStore.get(key);

    if (!rawText) {
      console.warn("[AI:memory] No seeded response found, returning default valid JSON", {
        key,
        trace,
        availableKeys: Array.from(memoryStore.keys()),
      });

      // Return default valid JSON for each schema type
      const defaultResponses: Record<string, string> = {
        intent_parse: JSON.stringify({
          schemaVersion: "v1",
          intentType: "COPY_CHANGE",
          targetKeys: ["hero.headline"],
          userText: "Test request",
          proposedDirection: "Update hero headline",
          needsHuman: false,
          confidence: 0.85,
          requiresApproval: true,
        }),
        generate_candidates: JSON.stringify({
          schemaVersion: "v1",
          requiresApproval: true,
          variants: [
            {
              targetKey: "hero.headline",
              value: "Test Headline",
              rationale: "Memory provider default response",
              confidence: 0.85,
              risks: [],
            },
          ],
          confidence: 0.85,
          risks: [],
          assumptions: [],
        }),
        critique: JSON.stringify({
          schemaVersion: "v1",
          pass: true,
          issues: [],
          suggestedFixes: [],
          confidence: 0.9,
          requiresApproval: true,
        }),
        decision_collapse: JSON.stringify({
          schemaVersion: "v1",
          selectedProposal: {
            type: "copy",
            targetKey: "hero.headline",
            value: "Test Headline",
          },
          reason: "Memory provider default response",
          approvalText: "Test approval text",
          previewRecommended: true,
          needsHuman: false,
          confidence: 0.85,
          requiresApproval: true,
          roundLimit: 2,
          costCapUsd: 10,
        }),
      };

      // Use step-specific default or generic JSON
      const defaultText = defaultResponses[trace.step] || "{}";

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
 */
export async function completeJson(
  options: CompleteJsonOptions,
  transport?: AiTransport
): Promise<CompleteJsonResult> {
  // Determine transport (explicit param > env > default)
  const selectedTransport = transport || (process.env.AI_PROVIDER as AiTransport) || "aiml";
  const provider = getAiProvider(selectedTransport);
  const startTime = Date.now();

  // Call provider
  const response = await provider.chat({
    ...options,
    jsonOnly: true,
  });

  const latencyMs = Date.now() - startTime;

  // Parse JSON
  let json: any | null = null;
  try {
    json = JSON.parse(response.rawText);
  } catch (err) {
    console.warn("[AI] Failed to parse JSON response", {
      error: err instanceof Error ? err.message : String(err),
      rawTextPreview: response.rawText.slice(0, 200),
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
      provider: selectedTransport, // Use the actual selected transport
      model: response.providerMeta?.model || options.model,
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
