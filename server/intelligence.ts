/**
 * Intelligence Service
 * 
 * Centralized service for:
 * 1. Logging all Intelligence Core decisions (silence audit trail)
 * 2. Capturing customer feedback on posts
 * 3. Loading and managing industry profiles
 */

import { getDb } from "./db";
import { decisionLogs, approvalFeedback, industryProfiles } from "../drizzle/schema";
import { eq, and, lte, desc } from "drizzle-orm";

/**
 * Log a decision made by the Intelligence Core
 * Tracks all decisions: post, silence, wait
 */
export async function logDecision(params: {
  userId: number;
  decision: "post" | "silence" | "wait";
  severity?: "hard_block" | "soft_block" | "discretionary";
  reason: string;
  triggerContext:
    | "weather_storm"
    | "weather_clear"
    | "weather_extreme"
    | "sports_event"
    | "community_event"
    | "local_trend"
    | "seasonal"
    | "manual"
    | "scheduled";
  conditions?: Record<string, unknown>;
  layersEvaluated?: string[];
  confidenceScore?: number;
  intelligenceVersion?: string;
  socialPostId?: number;
}) {
  try {
    const db = await getDb();
    if (!db) return;
    await db.insert(decisionLogs).values({
      userId: params.userId,
      decision: params.decision,
      severity: params.severity,
      reason: params.reason,
      triggerContext: params.triggerContext,
      conditions: params.conditions || {},
      layersEvaluated: params.layersEvaluated || [],
      confidenceScore: params.confidenceScore || 0,
      intelligenceVersion: params.intelligenceVersion || "v2.4.0",
      socialPostId: params.socialPostId,
      createdAt: new Date(),
    });
  } catch (error) {
    console.error("Failed to log decision:", error);
    // Don't throw - logging failure shouldn't break the pipeline
  }
}

/**
 * Record customer feedback on a post
 */
export async function recordFeedback(params: {
  userId: number;
  socialPostId: number;
  action: "approved" | "edited" | "rejected";
  feedbackType?:
    | "too_promotional"
    | "wrong_tone"
    | "not_relevant"
    | "too_salesy"
    | "timing_wrong"
    | "content_inaccurate"
    | "other";
  freeformNote?: string;
  originalContent?: string;
  editedContent?: string;
  relatedLayers?: string[];
}) {
  try {
    const db = await getDb();
    if (!db) return;
    await db.insert(approvalFeedback).values({
      userId: params.userId,
      socialPostId: params.socialPostId,
      action: params.action,
      feedbackType: params.feedbackType,
      freeformNote: params.freeformNote,
      originalContent: params.originalContent,
      editedContent: params.editedContent,
      relatedLayers: params.relatedLayers || [],
      createdAt: new Date(),
    });
  } catch (error) {
    console.error("Failed to record feedback:", error);
    // Don't throw - feedback failure shouldn't break the workflow
  }
}

/**
 * Load the active industry profile for a given industry
 * Returns the latest active profile effective as of now
 */
export async function getIndustryProfile(industry: string) {
  try {
    const db = await getDb();
    if (!db) return null;
    const result = await db
      .select()
      .from(industryProfiles)
      .where(
        and(
          eq(industryProfiles.industry, industry),
          eq(industryProfiles.status, "active"),
          lte(industryProfiles.effectiveFrom, new Date())
        )
      )
      .orderBy(desc(industryProfiles.profileVersion))
      .limit(1);

    return result.length > 0 ? result[0] : null;
  } catch (error) {
    console.error("Failed to load industry profile:", error);
    return null;
  }
}

/**
 * Get all decision logs for a user
 * Used for Activity tab and analytics
 */
export async function getUserDecisionLogs(
  userId: number,
  limit: number = 50,
  offset: number = 0
): Promise<(typeof decisionLogs.$inferSelect)[]> {
  try {
    const db = await getDb();
    if (!db) return [];
    const logs = await db
      .select()
      .from(decisionLogs)
      .where(eq(decisionLogs.userId, userId))
      .orderBy(desc(decisionLogs.createdAt))
      .limit(limit)
      .offset(offset);

    return logs;
  } catch (error) {
    console.error("Failed to fetch decision logs:", error);
    return [];
  }
}

/**
 * Get feedback metrics for a user
 * Used for analytics and improvement tracking
 */
export async function getUserFeedbackMetrics(userId: number) {
  try {
    const db = await getDb();
    if (!db) return null;
    const feedback = await db
      .select()
      .from(approvalFeedback)
      .where(eq(approvalFeedback.userId, userId));

    // Calculate metrics
    const metrics = {
      totalFeedback: feedback.length,
      approved: feedback.filter((f: typeof approvalFeedback.$inferSelect) => f.action === "approved").length,
      edited: feedback.filter((f: typeof approvalFeedback.$inferSelect) => f.action === "edited").length,
      rejected: feedback.filter((f: typeof approvalFeedback.$inferSelect) => f.action === "rejected").length,
      feedbackTypes: {} as Record<string, number>,
      topLayers: {} as Record<string, number>,
    };

    // Count feedback types
    feedback.forEach((f: typeof approvalFeedback.$inferSelect) => {
      if (f.feedbackType) {
        metrics.feedbackTypes[f.feedbackType] =
          (metrics.feedbackTypes[f.feedbackType] || 0) + 1;
      }
    });

    // Count related layers
    feedback.forEach((f: typeof approvalFeedback.$inferSelect) => {
      if (f.relatedLayers) {
        f.relatedLayers.forEach((layer: string) => {
          metrics.topLayers[layer] = (metrics.topLayers[layer] || 0) + 1;
        });
      }
    });

    return metrics;
  } catch (error) {
    console.error("Failed to fetch feedback metrics:", error);
    return null;
  }
}

/**
 * Get silence statistics for a user
 * Used to show value of silence decisions
 */
export async function getUserSilenceStats(userId: number) {
  try {
    const db = await getDb();
    if (!db) return null;
    const logs = await db
      .select()
      .from(decisionLogs)
      .where(
        and(
          eq(decisionLogs.userId, userId),
          eq(decisionLogs.decision, "silence")
        )
      );

    const stats = {
      totalSilences: logs.length,
      hardBlocks: logs.filter((l: typeof decisionLogs.$inferSelect) => l.severity === "hard_block").length,
      softBlocks: logs.filter((l: typeof decisionLogs.$inferSelect) => l.severity === "soft_block").length,
      discretionary: logs.filter((l: typeof decisionLogs.$inferSelect) => l.severity === "discretionary").length,
      byReason: {} as Record<string, number>,
    };

    logs.forEach((log: typeof decisionLogs.$inferSelect) => {
      stats.byReason[log.reason] = (stats.byReason[log.reason] || 0) + 1;
    });

    return stats;
  } catch (error) {
    console.error("Failed to fetch silence stats:", error);
    return null;
  }
}

/**
 * Create a new industry profile
 * Used by admin to add new industries or update existing ones
 */
export async function createIndustryProfile(params: {
  industry: string;
  profileVersion: string;
  contextWeights: {
    weather: number;
    sports: number;
    community: number;
    trends: number;
  };
  safetyGates: string[];
  toneGuardrails?: {
    conservative?: boolean;
    professional?: boolean;
    energetic?: boolean;
  };
  allowedPostTypes: string[];
  effectiveFrom: Date;
  migrationStrategy?: "auto" | "opt_in" | "frozen";
  description?: string;
}) {
  try {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    await db.insert(industryProfiles).values({
      industry: params.industry,
      profileVersion: params.profileVersion,
      contextWeights: params.contextWeights,
      safetyGates: params.safetyGates,
      toneGuardrails: params.toneGuardrails,
      allowedPostTypes: params.allowedPostTypes,
      effectiveFrom: params.effectiveFrom,
      migrationStrategy: params.migrationStrategy || "auto",
      description: params.description,
      status: "draft",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  } catch (error) {
    console.error("Failed to create industry profile:", error);
    throw error;
  }
}

/**
 * Activate an industry profile
 */
export async function activateIndustryProfile(
  industry: string,
  profileVersion: string
) {
  try {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    await db
      .update(industryProfiles)
      .set({
        status: "active",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(industryProfiles.industry, industry),
          eq(industryProfiles.profileVersion, profileVersion)
        )
      );
  } catch (error) {
    console.error("Failed to activate industry profile:", error);
    throw error;
  }
}
