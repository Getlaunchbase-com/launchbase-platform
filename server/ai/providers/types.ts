/**
 * AI Provider Interface
 * 
 * Provider-agnostic interface for AI chat completions.
 * Allows plugging OpenAI, Anthropic, AIML, or other providers without refactor.
 */

// ============================================
// REQUEST TYPES
// ============================================

export interface AiChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AiChatRequest {
  /** Model name (provider-specific, e.g., "gpt-4", "claude-3-sonnet") */
  model: string;

  /** Chat messages */
  messages: AiChatMessage[];

  /** Temperature (0-1, lower = more deterministic) */
  temperature?: number;

  /** Max tokens to generate */
  maxTokens?: number;

  /** Force JSON-only output (always true for LaunchBase) */
  jsonOnly: true;

  /** Trace metadata for logging (no PII) */
  trace: {
    jobId: string;
    step: string;
    round: number;
  };
}

// ============================================
// RESPONSE TYPES
// ============================================

export interface AiChatResponse {
  /** Raw text response from AI */
  rawText: string;

  /** Token usage (if available) */
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
  };

  /** Provider-specific metadata */
  providerMeta?: {
    requestId?: string;
    model?: string;
    finishReason?: string;
  };
}

// ============================================
// PROVIDER INTERFACE
// ============================================

export interface AiProvider {
  /**
   * Send a chat completion request
   * 
   * @param req - Chat request
   * @returns Chat response with raw text and metadata
   * @throws Error if provider fails (caller should wrap into structured error)
   */
  chat(req: AiChatRequest): Promise<AiChatResponse>;
}

// ============================================
// ERROR TYPES
// ============================================

export interface AiProviderError {
  code: "ai_provider_error" | "ai_timeout" | "ai_invalid_response";
  message: string;
  requestId?: string;
  providerName?: string;
}
