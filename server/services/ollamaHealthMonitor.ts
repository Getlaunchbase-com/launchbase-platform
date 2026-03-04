/**
 * Ollama Health Monitoring Service
 *
 * Provides health status endpoint for the admin dashboard and
 * VM cron-based auto-recovery.
 */

import { isOllamaHealthy, listOllamaModels } from "./ollamaClient";

const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";

interface OllamaHealthStatus {
  healthy: boolean;
  url: string;
  models: string[];
  responseTimeMs: number;
  lastCheckedAt: string;
  error?: string;
}

/**
 * Full health check: connectivity + model listing + response time.
 */
export async function getOllamaHealth(): Promise<OllamaHealthStatus> {
  const start = Date.now();

  try {
    const healthy = await isOllamaHealthy();
    if (!healthy) {
      return {
        healthy: false,
        url: OLLAMA_URL,
        models: [],
        responseTimeMs: Date.now() - start,
        lastCheckedAt: new Date().toISOString(),
        error: "Ollama not responding",
      };
    }

    const models = await listOllamaModels();

    return {
      healthy: true,
      url: OLLAMA_URL,
      models,
      responseTimeMs: Date.now() - start,
      lastCheckedAt: new Date().toISOString(),
    };
  } catch (err) {
    return {
      healthy: false,
      url: OLLAMA_URL,
      models: [],
      responseTimeMs: Date.now() - start,
      lastCheckedAt: new Date().toISOString(),
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
