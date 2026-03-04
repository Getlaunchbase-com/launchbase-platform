/**
 * Training Data Collector
 *
 * Collects and aggregates user preference signals from compare mode
 * into fine-tuning datasets. Integrates with the existing Vertex AI
 * fine-tuning pipeline (buildFineTunePack).
 *
 * Data flow:
 *   1. User votes in compare mode → shadowResponses.userPreference updated
 *   2. This service exports paired data as instruction/input/output format
 *   3. Feeds into existing buildFineTunePack marketing pipeline
 */

import { getDb } from "../db";
import { eq, and, isNotNull, desc, sql } from "drizzle-orm";
import { shadowResponses, userMemory, agentEvents } from "../db/schema";

interface TrainingExample {
  instruction: string;
  input: string;
  output: string;
  metadata: {
    userId: number;
    runId: number;
    primaryModel: string;
    shadowModel: string;
    preference: string;
    createdAt: string;
  };
}

/**
 * Export training examples from user preference votes.
 * Returns paired data where the user chose one response over another.
 */
export async function exportTrainingData(
  limit: number = 500,
  sinceDate?: Date,
): Promise<TrainingExample[]> {
  const db = await getDb();
  if (!db) return [];

  try {
    const conditions = [isNotNull(shadowResponses.userPreference)];
    if (sinceDate) {
      conditions.push(sql`${shadowResponses.createdAt} >= ${sinceDate.toISOString()}`);
    }

    const rows = await db
      .select()
      .from(shadowResponses)
      .where(and(...conditions))
      .orderBy(desc(shadowResponses.createdAt))
      .limit(limit);

    return rows.map((row: any) => {
      // The preferred response becomes the training output
      const preferredResponse = row.userPreference === "shadow"
        ? row.shadowResponse
        : row.primaryResponse;

      // Build the instruction from the system prompt snapshot
      const instruction = row.systemPrompt
        ? row.systemPrompt.slice(0, 2000)
        : "You are LaunchBase, a personal AI assistant.";

      // Find the user's input from the conversation context
      // (stored in the agentEvents for this run)
      const input = ""; // Will be enriched by enrichTrainingInput()

      return {
        instruction,
        input,
        output: preferredResponse,
        metadata: {
          userId: row.userId,
          runId: row.runId,
          primaryModel: row.primaryModel,
          shadowModel: row.shadowModel,
          preference: row.userPreference,
          createdAt: row.createdAt?.toISOString?.() || "",
        },
      };
    });
  } catch (err) {
    console.error("[trainingCollector] Export failed:", err);
    return [];
  }
}

/**
 * Enrich training examples with user input from conversation history.
 */
export async function enrichTrainingInput(
  examples: TrainingExample[],
): Promise<TrainingExample[]> {
  const db = await getDb();
  if (!db) return examples;

  for (const example of examples) {
    try {
      // Get the last user message from this run
      const events = await db
        .select()
        .from(agentEvents)
        .where(and(
          eq(agentEvents.runId, example.metadata.runId),
          eq(agentEvents.type, "message"),
        ))
        .orderBy(desc(agentEvents.id))
        .limit(10);

      const userMessages = events
        .filter((e: any) => (e.payload as any)?.role === "user")
        .map((e: any) => String((e.payload as any)?.content || ""));

      if (userMessages.length > 0) {
        example.input = userMessages[userMessages.length - 1];
      }
    } catch { /* best effort */ }
  }

  return examples;
}

/**
 * Get aggregate stats for training data quality.
 */
export async function getTrainingStats(): Promise<{
  totalPairs: number;
  votedPairs: number;
  shadowPreferred: number;
  primaryPreferred: number;
}> {
  const db = await getDb();
  if (!db) return { totalPairs: 0, votedPairs: 0, shadowPreferred: 0, primaryPreferred: 0 };

  try {
    const [totalRow] = await db
      .select({ count: sql<number>`count(*)` })
      .from(shadowResponses);

    const [votedRow] = await db
      .select({ count: sql<number>`count(*)` })
      .from(shadowResponses)
      .where(isNotNull(shadowResponses.userPreference));

    const [shadowRow] = await db
      .select({ count: sql<number>`count(*)` })
      .from(shadowResponses)
      .where(eq(shadowResponses.userPreference, "shadow"));

    const [primaryRow] = await db
      .select({ count: sql<number>`count(*)` })
      .from(shadowResponses)
      .where(eq(shadowResponses.userPreference, "primary"));

    return {
      totalPairs: Number(totalRow?.count || 0),
      votedPairs: Number(votedRow?.count || 0),
      shadowPreferred: Number(shadowRow?.count || 0),
      primaryPreferred: Number(primaryRow?.count || 0),
    };
  } catch {
    return { totalPairs: 0, votedPairs: 0, shadowPreferred: 0, primaryPreferred: 0 };
  }
}
