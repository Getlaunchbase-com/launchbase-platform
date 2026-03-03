/**
 * Morning Briefing Engine
 *
 * Generates personalized morning briefings by:
 *   1. Querying recent agentEvents for unresolved items
 *   2. Loading pending approval requests
 *   3. Loading relevant user memory (recent contacts, active projects)
 *   4. Calling LLM to synthesize a natural briefing
 *   5. Storing as a briefing event in agentEvents
 */

import { getDb } from "../db";
import { eq, and, desc, gte } from "drizzle-orm";
import { agentRuns, agentEvents, userMemory } from "../db/schema";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const API_BASE_URL = (
  process.env.AIML_API_BASE_URL ||
  process.env.OPENAI_API_BASE_URL ||
  "https://api.aimlapi.com/v1"
).replace(/\/+$/, "");

const API_KEY = process.env.AIML_API_KEY || process.env.OPENAI_API_KEY || "";
const BRIEFING_MODEL = process.env.BRIEFING_MODEL || "anthropic/claude-sonnet-4-6";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BriefingData {
  greeting: string;
  items: Array<{
    type: "pending_approval" | "recent_conversation" | "memory_reminder" | "tip";
    summary: string;
    actionable: boolean;
  }>;
  generatedAt: string;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

/**
 * Generate a morning briefing for a user.
 */
export async function generateBriefing(userId: number): Promise<BriefingData | null> {
  const db = await getDb();
  if (!db) return null;

  // Gather context
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // 1. Recent conversations (last 24h)
  const recentRuns = await db
    .select({
      id: agentRuns.id,
      goal: agentRuns.goal,
      status: agentRuns.status,
      createdAt: agentRuns.createdAt,
    })
    .from(agentRuns)
    .where(and(eq(agentRuns.createdBy, userId), gte(agentRuns.createdAt, since24h)))
    .orderBy(desc(agentRuns.createdAt))
    .limit(5);

  // 2. Pending approvals
  const pendingApprovals = await db
    .select()
    .from(agentEvents)
    .where(eq(agentEvents.type, "approval_request"))
    .orderBy(desc(agentEvents.ts))
    .limit(5);

  // Filter to those belonging to this user's runs
  const userRunIds = new Set(recentRuns.map((r) => r.id));
  const userPending = pendingApprovals.filter((e) => userRunIds.has(e.runId));

  // 3. User memory (recent contacts, active projects)
  const memories = await db
    .select()
    .from(userMemory)
    .where(eq(userMemory.userId, userId))
    .orderBy(desc(userMemory.updatedAt))
    .limit(10);

  // 4. Build context for LLM
  const contextParts: string[] = [];

  if (recentRuns.length > 0) {
    contextParts.push(
      "Recent conversations:\n" +
        recentRuns.map((r) => `- "${r.goal?.slice(0, 100)}" (${r.status})`).join("\n")
    );
  }

  if (userPending.length > 0) {
    contextParts.push(
      `Pending actions: ${userPending.length} items waiting for approval`
    );
  }

  if (memories.length > 0) {
    const contactMemories = memories.filter((m) => m.category === "contact");
    const projectMemories = memories.filter((m) => m.category === "context");
    if (contactMemories.length > 0) {
      contextParts.push(
        "Known contacts:\n" +
          contactMemories.map((m) => `- ${m.memoryKey}: ${m.memoryValue}`).join("\n")
      );
    }
    if (projectMemories.length > 0) {
      contextParts.push(
        "Active projects:\n" +
          projectMemories.map((m) => `- ${m.memoryKey}: ${m.memoryValue}`).join("\n")
      );
    }
  }

  if (contextParts.length === 0) {
    // No context to brief on
    return {
      greeting: getGreeting(),
      items: [
        {
          type: "tip",
          summary: "Start a conversation to get personalized briefings based on your activity.",
          actionable: false,
        },
      ],
      generatedAt: new Date().toISOString(),
    };
  }

  // 5. Call LLM for briefing synthesis
  if (!API_KEY) {
    // Fallback without LLM
    return buildSimpleBriefing(recentRuns, userPending, memories);
  }

  try {
    const resp = await fetch(`${API_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: BRIEFING_MODEL,
        messages: [
          {
            role: "system",
            content: `You are generating a morning briefing for a tradesperson. Be concise, warm, and practical. Format as a short greeting followed by 2-4 bullet points of what's important today. Never exceed 150 words total.`,
          },
          {
            role: "user",
            content: `Generate my morning briefing based on:\n\n${contextParts.join("\n\n")}`,
          },
        ],
        temperature: 0.7,
        max_tokens: 300,
      }),
    });

    if (resp.ok) {
      const json = await resp.json() as any;
      const content = json.choices?.[0]?.message?.content || "";

      return {
        greeting: getGreeting(),
        items: [
          {
            type: "memory_reminder",
            summary: content,
            actionable: userPending.length > 0,
          },
        ],
        generatedAt: new Date().toISOString(),
      };
    }
  } catch { /* fall through to simple briefing */ }

  return buildSimpleBriefing(recentRuns, userPending, memories);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning!";
  if (hour < 17) return "Good afternoon!";
  return "Good evening!";
}

function buildSimpleBriefing(
  runs: Array<{ id: number; goal: string | null; status: string }>,
  pending: any[],
  memories: any[],
): BriefingData {
  const items: BriefingData["items"] = [];

  if (runs.length > 0) {
    items.push({
      type: "recent_conversation",
      summary: `You had ${runs.length} conversation${runs.length > 1 ? "s" : ""} recently.`,
      actionable: false,
    });
  }

  if (pending.length > 0) {
    items.push({
      type: "pending_approval",
      summary: `${pending.length} action${pending.length > 1 ? "s" : ""} waiting for your approval.`,
      actionable: true,
    });
  }

  if (items.length === 0) {
    items.push({
      type: "tip",
      summary: "No pending items. Ask me anything to get started!",
      actionable: false,
    });
  }

  return {
    greeting: getGreeting(),
    items,
    generatedAt: new Date().toISOString(),
  };
}
