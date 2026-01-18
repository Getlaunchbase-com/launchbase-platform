/**
 * AI Module Index
 * 
 * Exports model registry, policy, router for use in server.
 */

import OpenAI from "openai";
import { ModelRegistry } from "./modelRouting/modelRegistry";
import { ModelPolicy } from "./modelRouting/modelPolicy";
import { ModelRouter } from "./modelRouting/modelRouter";

// ============================================
// OPENAI CLIENT (for AIML API)
// ============================================

const AIML_API_KEY = process.env.AIML_API_KEY;
const AIML_BASE_URL = process.env.AIML_BASE_URL || "https://api.aimlapi.com/v1";

if (!AIML_API_KEY) {
  console.warn("[AI] AIML_API_KEY not set - model registry will fail to refresh");
}

export const openaiClient = new OpenAI({
  apiKey: AIML_API_KEY || "dummy-key-for-tests",
  baseURL: AIML_BASE_URL,
  timeout: 10000,
});

// ============================================
// MODEL REGISTRY
// ============================================

export const modelRegistry = new ModelRegistry({
  ttlMs: 10 * 60_000, // 10 minutes
  denylist: [], // optional: add models to exclude
  openaiClient,
  logger: console,
});

// ============================================
// MODEL POLICY
// ============================================

export const modelPolicy = new ModelPolicy(modelRegistry);

// ============================================
// MODEL ROUTER
// ============================================

export const modelRouter = new ModelRouter(modelRegistry, modelPolicy, {
  modelFailover: (evt) => console.warn("[model_failover]", evt),
  modelRequest: (evt) => console.info("[model_request]", evt),
});

// ============================================
// BOOT HELPER
// ============================================

/**
 * Initialize model registry (call on server boot)
 */
export async function initializeModelRegistry(): Promise<void> {
  console.log("[AI] Initializing model registry...");
  await modelRegistry.refresh(true);
  console.log("[AI] Model registry initialized:", {
    modelCount: modelRegistry.list().length,
    stale: modelRegistry.snapshot.stale,
  });
}

/**
 * Start background refresh (call after server boot)
 */
export function startModelRegistryRefresh(): void {
  const intervalMs = 10 * 60_000; // 10 minutes
  setInterval(() => {
    modelRegistry.refresh(false).catch((err) => {
      console.error("[AI] Background refresh failed:", err);
    });
  }, intervalMs);
  console.log("[AI] Background refresh started (interval: 10 minutes)");
}
