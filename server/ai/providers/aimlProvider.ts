/**
 * AIML API Provider
 * 
 * Real AI provider using AIML API (OpenAI-compatible).
 * Supports 400+ models with JSON-only output enforcement.
 */

import OpenAI from "openai";
import type { AiProvider, AiChatRequest, AiChatResponse } from "./types";
import { safeError, toSafeClientMessage } from "../security/redaction";

// ============================================
// CONFIGURATION
// ============================================

const AIML_API_KEY = process.env.AIML_API_KEY;
const AIML_BASE_URL = process.env.AIML_BASE_URL || "https://api.aimlapi.com/v1";
const REQUEST_TIMEOUT_MS = 60000; // 60 seconds (GPT-5.2 can take 30-50s for complex prompts)

// ============================================
// CLIENT INITIALIZATION
// ============================================

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    if (!AIML_API_KEY) {
      throw new Error("AIML_API_KEY environment variable is required");
    }

    client = new OpenAI({
      apiKey: AIML_API_KEY,
      baseURL: AIML_BASE_URL,
      timeout: REQUEST_TIMEOUT_MS,
    });

    console.log("[AIML] Client initialized", {
      baseURL: AIML_BASE_URL,
      hasApiKey: !!AIML_API_KEY,
      timeout: REQUEST_TIMEOUT_MS,
    });
  }

  return client;
}

// ============================================
// AIML PROVIDER IMPLEMENTATION
// ============================================

export const aimlProvider: AiProvider = {
  async chat(req: AiChatRequest): Promise<AiChatResponse> {
    // NETWORK GUARD: Prevent AIML calls in tests
    if (process.env.NODE_ENV === "test") {
      throw new Error("NETWORK_DISABLED_IN_TESTS: AIML provider cannot be used in test environment");
    }

    const client = getClient();

    const { model, messages, temperature, maxTokens, trace } = req;

    // Log request (no PII)
    console.log("[AIML] Chat request", {
      model,
      messageCount: messages.length,
      temperature,
      maxTokens,
      trace,
      timestamp: new Date().toISOString(),
    });

    try {
      // Call AIML API (OpenAI-compatible)
      const completion = await client.chat.completions.create({
        model,
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        temperature: temperature ?? 0.2,
        max_tokens: maxTokens ?? 1500,
        response_format: { type: "json_object" }, // Force JSON-only
      });

      // Extract response
      const assistantMessage = completion.choices[0]?.message?.content;
      if (!assistantMessage) {
        throw new Error("No response from AI model");
      }

      // Build response
      const response: AiChatResponse = {
        rawText: assistantMessage,
        usage: {
          inputTokens: completion.usage?.prompt_tokens,
          outputTokens: completion.usage?.completion_tokens,
        },
        providerMeta: {
          requestId: completion.id,
          model: completion.model,
          finishReason: completion.choices[0]?.finish_reason,
        },
      };

      // Log success (no PII)
      console.log("[AIML] Chat response", {
        requestId: response.providerMeta?.requestId,
        inputTokens: response.usage?.inputTokens,
        outputTokens: response.usage?.outputTokens,
        finishReason: response.providerMeta?.finishReason,
        trace,
        timestamp: new Date().toISOString(),
      });

      return response;
    } catch (error) {
      const e = safeError(error);

      console.error("[aimlProvider] Error", {
        trace,
        model,
        error: e,
      });

      // Throw sanitized error upward (prevents leaking AIML echo content)
      throw new Error(toSafeClientMessage({ trace }));
    }
  },
};

// ============================================
// HEALTH CHECK
// ============================================

/**
 * Check if AIML provider is configured correctly
 * (Does NOT make an API call, just checks env vars)
 */
export function isAimlConfigured(): boolean {
  return !!AIML_API_KEY;
}

/**
 * Log AIML configuration status (masked)
 */
export function logAimlStatus(): void {
  console.log("[AIML] Configuration status", {
    apiKeyPresent: !!AIML_API_KEY,
    baseURL: AIML_BASE_URL,
    timeout: REQUEST_TIMEOUT_MS,
  });
}
