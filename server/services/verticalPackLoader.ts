/**
 * Vertical Pack Loader
 *
 * Loads vertical pack configuration, builds system prompts with user memory,
 * and resolves tool availability for the AI inference engine.
 */

import { getDb } from "../db";
import { eq, and, desc } from "drizzle-orm";
import { verticalPacks, userVerticals, userMemory } from "../db/schema";

// Cache loaded packs for 5 minutes
const packCache = new Map<number, { pack: any; loadedAt: number }>();
const CACHE_TTL = 5 * 60 * 1000;

/**
 * Get the active vertical pack for a user. Returns null if no pack is active.
 */
export async function getPackForUser(userId: number) {
  const db = await getDb();
  if (!db) return null;

  const [result] = await db
    .select({
      packId: verticalPacks.id,
      slug: verticalPacks.slug,
      name: verticalPacks.name,
      systemPromptTemplate: verticalPacks.systemPromptTemplate,
      toolsConfig: verticalPacks.toolsConfig,
      knowledgeBaseRefs: verticalPacks.knowledgeBaseRefs,
      uiExtensions: verticalPacks.uiExtensions,
    })
    .from(userVerticals)
    .innerJoin(verticalPacks, eq(userVerticals.verticalPackId, verticalPacks.id))
    .where(and(eq(userVerticals.userId, userId), eq(userVerticals.isPrimary, true)))
    .limit(1);

  return result || null;
}

/**
 * Build the full system prompt: base + vertical-specific + user memory context.
 */
export async function getSystemPrompt(
  basePrompt: string,
  userId: number,
): Promise<string> {
  const parts: string[] = [basePrompt];

  // Add vertical-specific prompt
  const pack = await getPackForUser(userId);
  if (pack?.systemPromptTemplate) {
    parts.push(`\n--- Vertical: ${pack.name} ---\n${pack.systemPromptTemplate}`);
  }

  // Add user memory context
  const db = await getDb();
  if (db) {
    try {
      const memories = await db
        .select({
          memoryKey: userMemory.memoryKey,
          memoryValue: userMemory.memoryValue,
          category: userMemory.category,
        })
        .from(userMemory)
        .where(eq(userMemory.userId, userId))
        .orderBy(desc(userMemory.updatedAt))
        .limit(30);

      if (memories.length > 0) {
        const memoryText = memories
          .map((m) => `- [${m.category}] ${m.memoryKey}: ${m.memoryValue}`)
          .join("\n");
        parts.push(`\n--- What you know about this user ---\n${memoryText}`);
      }
    } catch { /* no memory yet */ }
  }

  return parts.join("\n");
}

/**
 * Get available tools filtered by the user's vertical pack configuration.
 */
export async function getAvailableTools(userId: number): Promise<string[]> {
  const pack = await getPackForUser(userId);
  if (!pack?.toolsConfig) {
    // Default tools for users without a vertical
    return ["send_email", "remember", "recall"];
  }
  return (pack.toolsConfig as any).enabled || [];
}
