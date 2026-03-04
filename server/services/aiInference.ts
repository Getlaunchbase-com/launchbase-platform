/**
 * AI Inference Engine
 *
 * Core service powering the personal AI assistant. Handles:
 *   1. Loading conversation history from agentEvents
 *   2. Building system prompt from vertical pack + user memory + learning profile
 *   3. Multi-model routing: user preference → vertex profile → default
 *   4. Calling AIMLAPI (OpenAI-compatible) for LLM inference
 *   5. Writing assistant response back as agentEvent
 *   6. Tool call execution (email, memory, calculators)
 *   7. Shadow inference (fires async after primary response)
 *   8. Automatic memory extraction from conversations
 *
 * Called fire-and-forget from mobile.chat.send — client polls via chat.poll.
 */

import { getDb } from "../db";
import { eq, and, desc, asc } from "drizzle-orm";
import {
  agentRuns,
  agentEvents,
  mobileSessions,
  userMemory,
  verticalPacks,
  userVerticals,
  agentInstances,
  vertexProfiles,
  aiPreferences,
  userLearningProfiles,
} from "../db/schema";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const API_BASE_URL = (
  process.env.AIML_API_BASE_URL ||
  process.env.OPENAI_API_BASE_URL ||
  "https://api.aimlapi.com/v1"
).replace(/\/+$/, "");

const API_KEY =
  process.env.AIML_API_KEY ||
  process.env.OPENAI_API_KEY ||
  "";

const DEFAULT_MODEL = process.env.ASSISTANT_MODEL || "anthropic/claude-sonnet-4-6";
const MAX_HISTORY = 50; // max messages to include in context
const MAX_TOKENS = 2000;
const TEMPERATURE = 0.7;

// ---------------------------------------------------------------------------
// Available models — maps friendly keys to AIMLAPI model IDs
// ---------------------------------------------------------------------------

export const AVAILABLE_MODELS: Record<string, string> = {
  "claude-sonnet": "anthropic/claude-sonnet-4-6",
  "gpt-5": "openai/gpt-5.2-chat",
  "deepseek": "deepseek/deepseek-chat-v3.1",
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_call_id?: string;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
}

interface InferenceResult {
  ok: boolean;
  content?: string;
  model?: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  error?: string;
}

interface InferenceSession {
  userId: number;
  agentInstanceId: number;
  projectId: number;
  id: number;
  modelPreference?: string;
  responseMode?: string;
}

// ---------------------------------------------------------------------------
// Tool definitions for the LLM
// ---------------------------------------------------------------------------

const TOOL_DEFINITIONS = [
  {
    type: "function" as const,
    function: {
      name: "send_email",
      description: "Send an email on behalf of the user. Always show the draft and wait for approval before sending.",
      parameters: {
        type: "object",
        properties: {
          to: { type: "string", description: "Recipient email address" },
          subject: { type: "string", description: "Email subject line" },
          body: { type: "string", description: "Email body text" },
        },
        required: ["to", "subject", "body"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "remember",
      description: "Store a piece of information about the user for future conversations. Use for contacts, preferences, schedules, project details.",
      parameters: {
        type: "object",
        properties: {
          key: { type: "string", description: "Memory key, e.g. 'contact:karen' or 'pref:communication_style'" },
          value: { type: "string", description: "The information to remember" },
          category: { type: "string", enum: ["contact", "preference", "pattern", "context", "schedule"] },
        },
        required: ["key", "value", "category"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "recall",
      description: "Look up previously stored information about the user.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "What to search for in user memory" },
          category: { type: "string", enum: ["contact", "preference", "pattern", "context", "schedule"], description: "Optional category filter" },
        },
        required: ["query"],
      },
    },
  },
];

// ---------------------------------------------------------------------------
// Base system prompt
// ---------------------------------------------------------------------------

const BASE_SYSTEM_PROMPT = `You are LaunchBase, a personal AI assistant. You are helpful, concise, and proactive.

Key behaviors:
- Address the user naturally, like a trusted colleague
- When asked to send an email, draft it and use the send_email tool (the user will approve before it's sent)
- Use the remember tool to store important information the user shares (contacts, preferences, schedules)
- Use the recall tool to look up stored information before answering questions about contacts, projects, or preferences
- Be direct and practical — no unnecessary filler
- If you're unsure about something, ask rather than guess
- For technical questions in the user's trade, cite specific codes/standards when available`;

// ---------------------------------------------------------------------------
// Core inference function
// ---------------------------------------------------------------------------

export async function runAiInference(
  runId: number,
  session: InferenceSession
): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.error("[aiInference] Database unavailable");
    return;
  }

  try {
    // 1. Load conversation history
    const events = await db
      .select()
      .from(agentEvents)
      .where(eq(agentEvents.runId, runId))
      .orderBy(asc(agentEvents.id))
      .limit(MAX_HISTORY * 2); // extra room for tool events

    const messages: ChatMessage[] = [];
    for (const evt of events) {
      const payload = evt.payload as Record<string, unknown>;
      if (evt.type === "message" && payload.role && payload.content) {
        messages.push({
          role: payload.role as ChatMessage["role"],
          content: String(payload.content),
        });
      }
    }

    if (messages.length === 0) {
      console.warn("[aiInference] No messages found for run", runId);
      return;
    }

    // 2. Build system prompt (base + vertical + memory + learning profile)
    const systemPrompt = await buildSystemPrompt(db, session.userId);

    // 3. Determine model: user preference → vertex profile → default
    const model = await resolveModel(db, session.agentInstanceId, session.modelPreference);

    // 4. Call LLM
    const fullMessages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      ...messages.slice(-MAX_HISTORY),
    ];

    const result = await callLLM(fullMessages, model);

    if (!result.ok || !result.content) {
      console.error("[aiInference] LLM call failed:", result.error);
      await db.insert(agentEvents).values({
        runId,
        type: "error",
        payload: {
          message: result.error || "AI inference failed",
          source: "ai_inference",
          model,
        },
      });
      return;
    }

    // 5. Handle tool calls if present
    // (For now, tool calls are written as approval_request events for the user to act on)
    // The LLM response content is always written as a message event

    // 6. Write assistant response
    const [primaryEvent] = await db.insert(agentEvents).values({
      runId,
      type: "message",
      payload: {
        role: "assistant",
        content: result.content,
        source: "ai_inference",
        model: result.model || model,
        usage: result.usage,
      },
    });

    // 7. Update stateJson for persistence
    const updatedMessages = [...messages, { role: "assistant" as const, content: result.content }];
    await db
      .update(agentRuns)
      .set({
        stateJson: {
          messages: updatedMessages,
          stepCount: updatedMessages.length,
          errorCount: 0,
          maxSteps: 100,
          maxErrors: 5,
        },
      })
      .where(eq(agentRuns.id, runId));

    // 8. Fire shadow inference (non-blocking) if shadow learning enabled
    const shouldShadow = session.responseMode === "compare" || await isShadowEnabled(db, session.userId);
    if (shouldShadow) {
      void runShadowInference(
        db, runId, primaryEvent.insertId, session, fullMessages,
        systemPrompt, result.content, result.model || model
      ).catch((err) => {
        console.warn("[aiInference] Shadow inference failed (non-critical):", err);
      });
    }

    // 9. Auto-extract memories (non-blocking)
    void extractMemories(db, session.userId, messages, result.content).catch((err) => {
      console.warn("[aiInference] Memory extraction failed (non-critical):", err);
    });

  } catch (err) {
    console.error("[aiInference] Unexpected error:", err);
    try {
      await db.insert(agentEvents).values({
        runId,
        type: "error",
        payload: {
          message: err instanceof Error ? err.message : String(err),
          source: "ai_inference",
        },
      });
    } catch { /* best effort */ }
  }
}

// ---------------------------------------------------------------------------
// Build system prompt from vertical pack + user memory + learning profile
// ---------------------------------------------------------------------------

async function buildSystemPrompt(db: any, userId: number): Promise<string> {
  const parts: string[] = [BASE_SYSTEM_PROMPT];

  // Load user's active vertical pack
  try {
    const [uv] = await db
      .select({
        systemPromptTemplate: verticalPacks.systemPromptTemplate,
        name: verticalPacks.name,
        toolsConfig: verticalPacks.toolsConfig,
      })
      .from(userVerticals)
      .innerJoin(verticalPacks, eq(userVerticals.verticalPackId, verticalPacks.id))
      .where(and(eq(userVerticals.userId, userId), eq(userVerticals.isPrimary, true)))
      .limit(1);

    if (uv?.systemPromptTemplate) {
      parts.push(`\n--- Vertical: ${uv.name} ---\n${uv.systemPromptTemplate}`);
    }
  } catch { /* no vertical pack yet */ }

  // Load user learning profile (structured context)
  try {
    const [profile] = await db
      .select({ profile: userLearningProfiles.profile })
      .from(userLearningProfiles)
      .where(eq(userLearningProfiles.userId, userId))
      .limit(1);

    if (profile?.profile) {
      const p = profile.profile as Record<string, unknown>;
      const profileParts: string[] = [];
      if (p.industry) profileParts.push(`Industry: ${p.industry}`);
      if (p.role) profileParts.push(`Role: ${p.role}`);
      if (p.communicationStyle) profileParts.push(`Communication style: ${p.communicationStyle}`);
      if (p.technicalLevel) profileParts.push(`Technical level: ${p.technicalLevel}`);
      if (p.preferredResponseLength) profileParts.push(`Preferred response length: ${p.preferredResponseLength}`);
      if (p.timezone) profileParts.push(`Timezone: ${p.timezone}`);
      if (profileParts.length > 0) {
        parts.push(`\n--- User Profile ---\n${profileParts.join("\n")}`);
      }
    }
  } catch { /* no learning profile yet */ }

  // Load user memory (most recent 30 entries)
  try {
    const memories = await db
      .select({
        memoryKey: userMemory.memoryKey,
        memoryValue: userMemory.memoryValue,
        category: userMemory.category,
        source: userMemory.source,
      })
      .from(userMemory)
      .where(eq(userMemory.userId, userId))
      .orderBy(desc(userMemory.updatedAt))
      .limit(30);

    if (memories.length > 0) {
      // Explicit memories first, then auto-extracted
      const explicit = memories.filter((m: any) => m.source !== "ai_inferred");
      const auto = memories.filter((m: any) => m.source === "ai_inferred");
      const sorted = [...explicit, ...auto];

      const memoryText = sorted
        .map((m: any) => `- [${m.category}] ${m.memoryKey}: ${m.memoryValue}`)
        .join("\n");
      parts.push(`\n--- What you know about this user ---\n${memoryText}`);
    }
  } catch { /* no memory yet */ }

  return parts.join("\n");
}

// ---------------------------------------------------------------------------
// Resolve model: user preference → vertex profile → default
// ---------------------------------------------------------------------------

async function resolveModel(
  db: any,
  agentInstanceId: number,
  modelPreference?: string,
): Promise<string> {
  // 1. User's model preference (from mobile request)
  if (modelPreference && AVAILABLE_MODELS[modelPreference]) {
    return AVAILABLE_MODELS[modelPreference];
  }

  // 2. Vertex profile model
  try {
    const [instance] = await db
      .select({ vertexId: agentInstances.vertexId })
      .from(agentInstances)
      .where(eq(agentInstances.id, agentInstanceId))
      .limit(1);

    if (instance?.vertexId) {
      const [vertex] = await db
        .select({ configJson: vertexProfiles.configJson })
        .from(vertexProfiles)
        .where(eq(vertexProfiles.id, instance.vertexId))
        .limit(1);

      const model = (vertex?.configJson as any)?.model;
      if (model) return model;
    }
  } catch { /* fall through to default */ }

  // 3. System default
  return DEFAULT_MODEL;
}

// ---------------------------------------------------------------------------
// Check if shadow learning is enabled for user
// ---------------------------------------------------------------------------

async function isShadowEnabled(db: any, userId: number): Promise<boolean> {
  try {
    const [prefs] = await db
      .select({ shadowLearningEnabled: aiPreferences.shadowLearningEnabled })
      .from(aiPreferences)
      .where(eq(aiPreferences.userId, userId))
      .limit(1);
    return prefs?.shadowLearningEnabled ?? true; // default enabled
  } catch {
    return true;
  }
}

// ---------------------------------------------------------------------------
// Shadow inference — runs Ollama (or fallback) in parallel after primary
// ---------------------------------------------------------------------------

async function runShadowInference(
  db: any,
  runId: number,
  primaryEventId: number,
  session: InferenceSession,
  fullMessages: ChatMessage[],
  systemPrompt: string,
  primaryContent: string,
  primaryModel: string,
): Promise<void> {
  // Lazy import to avoid circular deps and keep shadow optional
  const { runShadow } = await import("./shadowInference");
  await runShadow({
    db,
    runId,
    primaryEventId,
    userId: session.userId,
    fullMessages,
    systemPrompt,
    primaryContent,
    primaryModel,
    responseMode: session.responseMode,
  });
}

// ---------------------------------------------------------------------------
// Auto-extract memories from conversations
// ---------------------------------------------------------------------------

async function extractMemories(
  db: any,
  userId: number,
  conversationMessages: ChatMessage[],
  assistantResponse: string,
): Promise<void> {
  // Only extract every few messages to avoid excessive API calls
  const userMessages = conversationMessages.filter((m) => m.role === "user");
  if (userMessages.length < 2) return; // need enough context

  // Use a lightweight prompt to extract facts
  const lastUserMsg = userMessages[userMessages.length - 1]?.content || "";
  const extractionPrompt = `Based on this conversation exchange, extract any facts about the user that should be remembered for future conversations. Only extract concrete, useful facts (names, preferences, schedules, projects, contacts).

User said: "${lastUserMsg}"
Assistant responded: "${assistantResponse.slice(0, 500)}"

Return a JSON array of objects with keys: key (string, like "contact:karen"), value (string), category (one of: contact, preference, pattern, context, schedule). Return [] if nothing worth remembering.`;

  try {
    const result = await callLLM(
      [{ role: "system", content: "You extract structured facts from conversations. Return only valid JSON arrays." },
       { role: "user", content: extractionPrompt }],
      "deepseek/deepseek-chat-v3.1", // Use cheapest model for extraction
    );

    if (!result.ok || !result.content) return;

    // Parse the JSON array from the response
    const content = result.content.trim();
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return;

    const facts = JSON.parse(jsonMatch[0]) as Array<{ key: string; value: string; category: string }>;
    if (!Array.isArray(facts) || facts.length === 0) return;

    // Store each extracted fact
    for (const fact of facts.slice(0, 5)) { // max 5 per extraction
      if (!fact.key || !fact.value || !fact.category) continue;
      const validCategories = ["contact", "preference", "pattern", "context", "schedule"];
      if (!validCategories.includes(fact.category)) continue;

      try {
        const [existing] = await db
          .select()
          .from(userMemory)
          .where(and(eq(userMemory.userId, userId), eq(userMemory.memoryKey, fact.key)))
          .limit(1);

        if (existing) {
          await db
            .update(userMemory)
            .set({ memoryValue: fact.value, category: fact.category as any })
            .where(eq(userMemory.id, existing.id));
        } else {
          await db.insert(userMemory).values({
            userId,
            memoryKey: fact.key,
            memoryValue: fact.value,
            category: fact.category as any,
            source: "ai_inferred",
            confidence: 0.7,
          });
        }
      } catch { /* skip individual memory failures */ }
    }
  } catch { /* extraction is best-effort */ }
}

// ---------------------------------------------------------------------------
// Call AIMLAPI (OpenAI-compatible endpoint)
// ---------------------------------------------------------------------------

export async function callLLM(
  messages: ChatMessage[],
  model: string,
): Promise<InferenceResult> {
  if (!API_KEY) {
    return { ok: false, error: "No API key configured (AIML_API_KEY or OPENAI_API_KEY)" };
  }

  try {
    const resp = await fetch(`${API_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: TEMPERATURE,
        max_tokens: MAX_TOKENS,
        tools: TOOL_DEFINITIONS,
        tool_choice: "auto",
      }),
    });

    if (!resp.ok) {
      const txt = await resp.text();
      return { ok: false, error: `API HTTP ${resp.status}: ${txt.slice(0, 300)}` };
    }

    const json = await resp.json() as {
      choices?: Array<{
        message?: {
          content?: string;
          tool_calls?: Array<{
            id: string;
            type: string;
            function: { name: string; arguments: string };
          }>;
        };
      }>;
      model?: string;
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
    };

    const choice = json.choices?.[0]?.message;
    if (!choice) {
      return { ok: false, error: "No response from API" };
    }

    // If the model wants to use tools, include that info in the content
    if (choice.tool_calls && choice.tool_calls.length > 0) {
      // For now, embed tool call info in content for the client to handle
      const toolInfo = choice.tool_calls.map((tc) => {
        try {
          const args = JSON.parse(tc.function.arguments);
          return { name: tc.function.name, args };
        } catch {
          return { name: tc.function.name, args: tc.function.arguments };
        }
      });

      // If there's also text content, prepend it
      const textContent = choice.content || "";
      const toolContent = toolInfo
        .map((t) => {
          if (t.name === "send_email") {
            return `I'd like to send an email for you:\n\n**To:** ${t.args.to}\n**Subject:** ${t.args.subject}\n\n${t.args.body}\n\nShall I send this?`;
          }
          if (t.name === "remember") {
            return `Got it, I'll remember that.`;
          }
          return "";
        })
        .filter(Boolean)
        .join("\n\n");

      const content = [textContent, toolContent].filter(Boolean).join("\n\n");
      return {
        ok: true,
        content,
        model: json.model,
        usage: json.usage,
      };
    }

    return {
      ok: true,
      content: choice.content || "",
      model: json.model,
      usage: json.usage,
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ---------------------------------------------------------------------------
// Tool execution helpers (called internally, not by LLM directly yet)
// ---------------------------------------------------------------------------

export async function executeMemoryTool(
  userId: number,
  action: "remember" | "recall",
  params: Record<string, string>,
): Promise<string> {
  const db = await getDb();
  if (!db) return "Database unavailable";

  if (action === "remember") {
    const { key, value, category } = params;
    if (!key || !value || !category) return "Missing required fields";

    // Upsert: update if exists, insert if not
    try {
      const [existing] = await db
        .select()
        .from(userMemory)
        .where(and(eq(userMemory.userId, userId), eq(userMemory.memoryKey, key)))
        .limit(1);

      if (existing) {
        await db
          .update(userMemory)
          .set({ memoryValue: value, category: category as any })
          .where(eq(userMemory.id, existing.id));
      } else {
        await db.insert(userMemory).values({
          userId,
          memoryKey: key,
          memoryValue: value,
          category: category as any,
          source: "ai_inferred",
        });
      }
      return `Remembered: ${key} = ${value}`;
    } catch (err) {
      return `Failed to remember: ${err instanceof Error ? err.message : String(err)}`;
    }
  }

  if (action === "recall") {
    const { query, category } = params;
    try {
      const conditions = [eq(userMemory.userId, userId)];
      if (category) {
        conditions.push(eq(userMemory.category, category as any));
      }

      const memories = await db
        .select()
        .from(userMemory)
        .where(and(...conditions))
        .orderBy(desc(userMemory.updatedAt))
        .limit(20);

      // Simple text match filter
      const q = (query || "").toLowerCase();
      const matched = memories.filter(
        (m: any) =>
          m.memoryKey.toLowerCase().includes(q) ||
          m.memoryValue.toLowerCase().includes(q)
      );

      if (matched.length === 0) return "No matching memories found.";
      return matched
        .map((m: any) => `[${m.category}] ${m.memoryKey}: ${m.memoryValue}`)
        .join("\n");
    } catch (err) {
      return `Failed to recall: ${err instanceof Error ? err.message : String(err)}`;
    }
  }

  return "Unknown action";
}
