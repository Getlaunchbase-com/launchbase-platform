/**
 * Shadow Inference Pipeline — Dual Model A/B
 *
 * Fires AFTER primary response completes. Calls shadow model(s) (Ollama/local)
 * with the same conversation context, stores the paired responses for training,
 * and optionally emits the shadow response as an event for compare mode.
 *
 * Dual model mode: runs both launchbase-main and launchbase-sandbox concurrently,
 * storing each response with its lane tag for A/B analysis.
 *
 * Non-blocking: primary response is delivered immediately. Shadow arrives async.
 * Graceful failure: if Ollama/shadow model is down, shadow silently skipped.
 */

import { agentEvents, shadowResponses } from "../db/schema";
import { callOllama, isOllamaHealthy, listOllamaModels } from "./ollamaClient";
import { callLLM } from "./aiInference";

interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
}

interface ShadowParams {
  db: any;
  runId: number;
  primaryEventId: number;
  userId: number;
  fullMessages: ChatMessage[];
  systemPrompt: string;
  primaryContent: string;
  primaryModel: string;
  responseMode?: string;
}

const SHADOW_MODEL_MAIN = process.env.SHADOW_MODEL_MAIN || "launchbase-main";
const SHADOW_MODEL_SANDBOX = process.env.SHADOW_MODEL_SANDBOX || "launchbase-sandbox";
const SHADOW_TIMEOUT_MS = 30_000;
const DUAL_MODE = process.env.SHADOW_DUAL_MODE !== "false"; // default: on

/**
 * Run a single shadow model and store the result.
 */
async function runSingleShadow(
  params: ShadowParams,
  model: string,
  lane: string,
): Promise<{ content: string; model: string } | null> {
  const { db, runId, primaryEventId, userId, fullMessages, systemPrompt, primaryContent, primaryModel } = params;

  let shadowContent: string;
  let shadowModel: string;

  const ollamaUp = await isOllamaHealthy();

  if (ollamaUp) {
    try {
      const result = await callOllama(fullMessages, model, SHADOW_TIMEOUT_MS);
      if (result.ok && result.content) {
        shadowContent = result.content;
        shadowModel = `ollama/${model}`;
      } else {
        console.warn(`[shadowInference] Ollama ${model} call failed:`, result.error);
        return null;
      }
    } catch (err) {
      console.warn(`[shadowInference] Ollama ${model} error:`, err);
      return null;
    }
  } else if (lane === "main") {
    // Only use paid fallback for main lane (not sandbox — to save costs)
    try {
      const result = await callLLM(fullMessages, "deepseek/deepseek-chat-v3.1");
      if (result.ok && result.content) {
        shadowContent = result.content;
        shadowModel = "deepseek/deepseek-chat-v3.1";
      } else {
        return null;
      }
    } catch {
      return null;
    }
  } else {
    return null; // Sandbox only runs on Ollama
  }

  // Store the paired response
  try {
    await db.insert(shadowResponses).values({
      runId,
      eventId: primaryEventId,
      userId,
      primaryModel,
      shadowModel,
      primaryResponse: primaryContent,
      shadowResponse: shadowContent,
      shadowModelLane: lane,
      systemPrompt: systemPrompt.slice(0, 4000),
    });
  } catch (err) {
    console.warn(`[shadowInference] Failed to store ${lane} shadow response:`, err);
  }

  return { content: shadowContent, model: shadowModel };
}

/**
 * Main shadow entry point. Runs dual models if both are available,
 * otherwise runs whichever is available.
 */
export async function runShadow(params: ShadowParams): Promise<void> {
  const { db, runId, responseMode } = params;

  if (DUAL_MODE) {
    // Run both models concurrently
    const [mainResult, sandboxResult] = await Promise.all([
      runSingleShadow(params, SHADOW_MODEL_MAIN, "main"),
      runSingleShadow(params, SHADOW_MODEL_SANDBOX, "sandbox"),
    ]);

    // Emit the main lane response for compare mode (prefer main)
    const compareResult = mainResult || sandboxResult;
    if (responseMode === "compare" && compareResult) {
      await emitShadowEvent(db, runId, compareResult.content, compareResult.model);
    }
  } else {
    // Single model mode (legacy behavior)
    const result = await runSingleShadow(params, SHADOW_MODEL_MAIN, "main");
    if (responseMode === "compare" && result) {
      await emitShadowEvent(db, runId, result.content, result.model);
    }
  }
}

/**
 * Emit shadow response as agent event for compare mode UI.
 */
async function emitShadowEvent(
  db: any,
  runId: number,
  content: string,
  model: string,
): Promise<void> {
  try {
    await db.insert(agentEvents).values({
      runId,
      type: "message",
      payload: {
        role: "assistant",
        content,
        source: "shadow_inference",
        model,
      },
    });
  } catch (err) {
    console.warn("[shadowInference] Failed to emit shadow event:", err);
  }
}

/**
 * Check which shadow models are available on Ollama.
 */
export async function getAvailableShadowModels(): Promise<string[]> {
  try {
    const models = await listOllamaModels();
    const shadowModels = [SHADOW_MODEL_MAIN, SHADOW_MODEL_SANDBOX];
    return models.filter((m: string) => shadowModels.some((s) => m.includes(s)));
  } catch {
    return [];
  }
}
