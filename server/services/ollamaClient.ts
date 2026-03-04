/**
 * Ollama API Client
 *
 * OpenAI-compatible wrapper for Ollama's local API endpoint.
 * Used by shadow inference to run the LaunchBase learning model locally on the VM.
 *
 * Same interface as callLLM() so shadow inference is model-agnostic.
 * Falls back gracefully if Ollama is not running.
 */

interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
}

interface OllamaResult {
  ok: boolean;
  content?: string;
  model?: string;
  error?: string;
}

const OLLAMA_BASE_URL = (
  process.env.OLLAMA_BASE_URL || "http://localhost:11434"
).replace(/\/+$/, "");

// Health check cache (avoid hammering health endpoint)
let lastHealthCheck = 0;
let lastHealthResult = false;
const HEALTH_CACHE_MS = 30_000; // 30s

/**
 * Check if Ollama is running and responsive.
 * Caches result for 30s to avoid excessive health checks.
 */
export async function isOllamaHealthy(): Promise<boolean> {
  const now = Date.now();
  if (now - lastHealthCheck < HEALTH_CACHE_MS) {
    return lastHealthResult;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const resp = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    lastHealthCheck = now;
    lastHealthResult = resp.ok;
    return resp.ok;
  } catch {
    lastHealthCheck = now;
    lastHealthResult = false;
    return false;
  }
}

/**
 * Call Ollama with OpenAI-compatible chat format.
 * Uses Ollama's /api/chat endpoint which accepts messages array.
 */
export async function callOllama(
  messages: ChatMessage[],
  model: string = "launchbase-main",
  timeoutMs: number = 30_000,
): Promise<OllamaResult> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const resp = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        stream: false,
        options: {
          temperature: 0.7,
          num_predict: 2000,
        },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!resp.ok) {
      const txt = await resp.text();
      return { ok: false, error: `Ollama HTTP ${resp.status}: ${txt.slice(0, 200)}` };
    }

    const json = await resp.json() as {
      message?: { role: string; content: string };
      model?: string;
      done?: boolean;
    };

    if (!json.message?.content) {
      return { ok: false, error: "No response from Ollama" };
    }

    return {
      ok: true,
      content: json.message.content,
      model: json.model || model,
    };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return { ok: false, error: `Ollama timeout after ${timeoutMs}ms` };
    }
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * List available models on the Ollama instance.
 */
export async function listOllamaModels(): Promise<string[]> {
  try {
    const resp = await fetch(`${OLLAMA_BASE_URL}/api/tags`);
    if (!resp.ok) return [];

    const json = await resp.json() as { models?: Array<{ name: string }> };
    return (json.models || []).map((m) => m.name);
  } catch {
    return [];
  }
}
