/**
 * Learning Profile Service
 *
 * Aggregates user memory entries into a structured profile that gets
 * injected into every AI system prompt. Updated periodically (not every
 * message) to avoid excessive computation.
 *
 * Profile fields:
 *   industry, role, communicationStyle, commonTopics,
 *   preferredResponseLength, technicalLevel, timezone, activeHours
 *
 * Shared across all models (Claude, GPT, DeepSeek all see same user profile).
 */

import { getDb } from "../db";
import { eq, and, desc } from "drizzle-orm";
import { userMemory, userLearningProfiles, agentRuns } from "../db/schema";
import { callLLM } from "./aiInference";

interface UserProfile {
  industry?: string;
  role?: string;
  communicationStyle?: string;
  commonTopics?: string[];
  preferredResponseLength?: "brief" | "moderate" | "detailed";
  technicalLevel?: "beginner" | "intermediate" | "expert";
  timezone?: string;
  activeHours?: string;
}

const UPDATE_INTERVAL_CONVERSATIONS = 10;

/**
 * Check if the user's profile needs updating, and rebuild if so.
 * Called after AI inference completes (non-blocking).
 */
export async function maybeUpdateProfile(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  try {
    // Check current profile state
    const [existing] = await db
      .select()
      .from(userLearningProfiles)
      .where(eq(userLearningProfiles.userId, userId))
      .limit(1);

    // Count conversations since last profile update
    const conversationCount = existing?.conversationCount || 0;
    const shouldUpdate = !existing || (conversationCount > 0 && conversationCount % UPDATE_INTERVAL_CONVERSATIONS === 0);

    if (!shouldUpdate) {
      // Just increment the counter
      if (existing) {
        await db
          .update(userLearningProfiles)
          .set({ conversationCount: conversationCount + 1 })
          .where(eq(userLearningProfiles.id, existing.id));
      }
      return;
    }

    // Build fresh profile from memories
    const profile = await buildProfileFromMemories(db, userId);

    if (existing) {
      await db
        .update(userLearningProfiles)
        .set({
          profile,
          conversationCount: conversationCount + 1,
          lastUpdatedAt: new Date(),
        })
        .where(eq(userLearningProfiles.id, existing.id));
    } else {
      await db.insert(userLearningProfiles).values({
        userId,
        profile,
        conversationCount: 1,
      });
    }
  } catch (err) {
    console.warn("[learningProfile] Profile update failed:", err);
  }
}

/**
 * Build a structured profile from the user's memory entries.
 * Uses a lightweight LLM call to synthesize memories into profile fields.
 */
async function buildProfileFromMemories(db: any, userId: number): Promise<UserProfile> {
  // Gather all memories for this user
  const memories = await db
    .select({
      key: userMemory.memoryKey,
      value: userMemory.memoryValue,
      category: userMemory.category,
    })
    .from(userMemory)
    .where(eq(userMemory.userId, userId))
    .orderBy(desc(userMemory.updatedAt))
    .limit(50);

  if (memories.length === 0) return {};

  const memoryText = memories
    .map((m: any) => `[${m.category}] ${m.key}: ${m.value}`)
    .join("\n");

  const prompt = `Based on these stored memories about a user, synthesize a structured profile. Return valid JSON only.

Memories:
${memoryText}

Return a JSON object with these optional fields:
- industry (string): their trade/industry, e.g. "electrical contracting"
- role (string): their job role, e.g. "project manager", "electrician"
- communicationStyle (string): how they prefer to be communicated with, e.g. "brief and direct", "detailed explanations"
- commonTopics (string[]): topics they frequently discuss
- preferredResponseLength (string): "brief", "moderate", or "detailed"
- technicalLevel (string): "beginner", "intermediate", or "expert"
- timezone (string): their timezone if known
- activeHours (string): when they typically use the app

Only include fields you can confidently infer from the memories. Return {} if insufficient data.`;

  try {
    const result = await callLLM(
      [
        { role: "system", content: "You synthesize user data into structured profiles. Return only valid JSON." },
        { role: "user", content: prompt },
      ],
      "deepseek/deepseek-chat-v3.1", // cheapest model for profile building
    );

    if (!result.ok || !result.content) return {};

    const content = result.content.trim();
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return {};

    return JSON.parse(jsonMatch[0]) as UserProfile;
  } catch {
    return {};
  }
}

/**
 * Get the current learning profile for a user.
 */
export async function getProfile(userId: number): Promise<UserProfile | null> {
  const db = await getDb();
  if (!db) return null;

  try {
    const [row] = await db
      .select({ profile: userLearningProfiles.profile })
      .from(userLearningProfiles)
      .where(eq(userLearningProfiles.userId, userId))
      .limit(1);

    return (row?.profile as UserProfile) || null;
  } catch {
    return null;
  }
}
