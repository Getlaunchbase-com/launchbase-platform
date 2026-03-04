/**
 * Shadow Inference Pipeline
 *
 * Fires AFTER primary response completes. Calls the shadow model (Ollama/local)
 * with the same conversation context, stores the paired responses for training,
 * and optionally emits the shadow response as an event for compare mode.
 *
 * Non-blocking: primary response is delivered immediately. Shadow arrives async.
 * Graceful failure: if Ollama/shadow model is down, shadow silently skipped.
 */

import { agentEvents, shadowResponses } from "../db/schema";
import { callOllama, isOllamaHealthy } from "./ollamaClient";
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

const SHADOW_MODEL = process.env.SHADOW_MODEL || "launchbase-main";
const SHADOW_TIMEOUT_MS = 30_000;

export async function runShadow(params: ShadowParams): Promise<void> {
  const {
    db, runId, primaryEventId, userId,
    fullMessages, systemPrompt, primaryContent, primaryModel,
    responseMode,
  } = params;

  let shadowContent: string;
  let shadowModel: string;

  // Try Ollama first (local, free)
  const ollamaUp = await isOllamaHealthy();

  if (ollamaUp) {
    try {
      const result = await callOllama(fullMessages, SHADOW_MODEL, SHADOW_TIMEOUT_MS);
      if (result.ok && result.content) {
        shadowContent = result.content;
        shadowModel = `ollama/${SHADOW_MODEL}`;
      } else {
        console.warn("[shadowInference] Ollama call failed:", result.error);
        return; // Don't fallback to paid API for shadow
      }
    } catch (err) {
      console.warn("[shadowInference] Ollama error:", err);
      return;
    }
  } else {
    // Ollama not available — use cheapest AIMLAPI model as fallback
    try {
      const result = await callLLM(fullMessages, "deepseek/deepseek-chat-v3.1");
      if (result.ok && result.content) {
        shadowContent = result.content;
        shadowModel = "deepseek/deepseek-chat-v3.1";
      } else {
        return; // Shadow is best-effort
      }
    } catch {
      return;
    }
  }

  // Store the paired responses for training
  try {
    await db.insert(shadowResponses).values({
      runId,
      eventId: primaryEventId,
      userId,
      primaryModel,
      shadowModel,
      primaryResponse: primaryContent,
      shadowResponse: shadowContent,
      systemPrompt: systemPrompt.slice(0, 4000), // truncate for storage
    });
  } catch (err) {
    console.warn("[shadowInference] Failed to store shadow response:", err);
  }

  // Emit shadow response as event (for compare mode display)
  if (responseMode === "compare") {
    try {
      await db.insert(agentEvents).values({
        runId,
        type: "message",
        payload: {
          role: "assistant",
          content: shadowContent,
          source: "shadow_inference",
          model: shadowModel,
        },
      });
    } catch (err) {
      console.warn("[shadowInference] Failed to emit shadow event:", err);
    }
  }
}
