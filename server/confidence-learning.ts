/**
 * Confidence Learning: Track approval/rejection patterns by checklist key
 * System uses this to auto-tune confidence thresholds over time
 */

import { getDb } from "./db";
import { confidenceLearning } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";

export interface ConfidenceLearningUpdate {
  checklistKey: string;
  tenant: "launchbase" | "vinces";
  outcome: "approved" | "rejected" | "edited" | "unclear";
}

/**
 * Record an outcome for a checklist key
 * Updates counters and recalculates metrics
 */
export async function recordConfidenceOutcome(input: ConfidenceLearningUpdate): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.error("[ConfidenceLearning] Database not available");
    return;
  }

  try {
    // Find existing record
    const [existing] = await db
      .select()
      .from(confidenceLearning)
      .where(
        and(
          eq(confidenceLearning.checklistKey, input.checklistKey),
          eq(confidenceLearning.tenant, input.tenant)
        )
      )
      .limit(1);

    if (existing) {
      // Update existing record
      const newTotalSent = existing.totalSent + 1;
      const newTotalApproved = existing.totalApproved + (input.outcome === "approved" ? 1 : 0);
      const newTotalRejected = existing.totalRejected + (input.outcome === "rejected" ? 1 : 0);
      const newTotalEdited = existing.totalEdited + (input.outcome === "edited" ? 1 : 0);
      const newTotalUnclear = existing.totalUnclear + (input.outcome === "unclear" ? 1 : 0);

      const newApprovalRate = newTotalSent > 0 ? newTotalApproved / newTotalSent : 0;
      const newEditRate = newTotalSent > 0 ? newTotalEdited / newTotalSent : 0;

      // Calculate recommended threshold
      // Logic: If approval rate > 90%, lower threshold to 0.85
      //        If approval rate < 70%, raise threshold to 0.95
      //        Otherwise, keep at 0.9
      let newRecommendedThreshold = 0.9;
      if (newApprovalRate > 0.9) {
        newRecommendedThreshold = 0.85; // High confidence - can be more aggressive
      } else if (newApprovalRate < 0.7) {
        newRecommendedThreshold = 0.95; // Low confidence - be more conservative
      }

      await db
        .update(confidenceLearning)
        .set({
          totalSent: newTotalSent,
          totalApproved: newTotalApproved,
          totalRejected: newTotalRejected,
          totalEdited: newTotalEdited,
          totalUnclear: newTotalUnclear,
          approvalRate: newApprovalRate,
          editRate: newEditRate,
          recommendedThreshold: newRecommendedThreshold,
        })
        .where(eq(confidenceLearning.id, existing.id));

      console.log(
        `[ConfidenceLearning] Updated ${input.checklistKey}: ${input.outcome} (approval rate: ${(newApprovalRate * 100).toFixed(1)}%, threshold: ${newRecommendedThreshold})`
      );
    } else {
      // Create new record
      const initialApprovalRate = input.outcome === "approved" ? 1.0 : 0.0;
      const initialEditRate = input.outcome === "edited" ? 1.0 : 0.0;

      await db.insert(confidenceLearning).values({
        checklistKey: input.checklistKey,
        tenant: input.tenant,
        totalSent: 1,
        totalApproved: input.outcome === "approved" ? 1 : 0,
        totalRejected: input.outcome === "rejected" ? 1 : 0,
        totalEdited: input.outcome === "edited" ? 1 : 0,
        totalUnclear: input.outcome === "unclear" ? 1 : 0,
        approvalRate: initialApprovalRate,
        editRate: initialEditRate,
        recommendedThreshold: 0.9, // Start conservative
      });

      console.log(`[ConfidenceLearning] Created ${input.checklistKey}: ${input.outcome}`);
    }
  } catch (err: any) {
    console.error(`[ConfidenceLearning] Error recording outcome:`, err.message);
  }
}

/**
 * Get recommended confidence threshold for a checklist key
 * Returns 0.9 if no data exists yet
 */
export async function getRecommendedThreshold(
  checklistKey: string,
  tenant: "launchbase" | "vinces"
): Promise<number> {
  const db = await getDb();
  if (!db) {
    console.error("[ConfidenceLearning] Database not available");
    return 0.9; // Default
  }

  try {
    const [record] = await db
      .select()
      .from(confidenceLearning)
      .where(
        and(
          eq(confidenceLearning.checklistKey, checklistKey),
          eq(confidenceLearning.tenant, tenant)
        )
      )
      .limit(1);

    if (record) {
      return record.recommendedThreshold;
    }

    return 0.9; // Default for new keys
  } catch (err: any) {
    console.error(`[ConfidenceLearning] Error getting threshold:`, err.message);
    return 0.9; // Default on error
  }
}

/**
 * Get learning stats for a checklist key
 */
export async function getConfidenceStats(
  checklistKey: string,
  tenant: "launchbase" | "vinces"
): Promise<{
  totalSent: number;
  approvalRate: number;
  editRate: number;
  recommendedThreshold: number;
} | null> {
  const db = await getDb();
  if (!db) {
    console.error("[ConfidenceLearning] Database not available");
    return null;
  }

  try {
    const [record] = await db
      .select()
      .from(confidenceLearning)
      .where(
        and(
          eq(confidenceLearning.checklistKey, checklistKey),
          eq(confidenceLearning.tenant, tenant)
        )
      )
      .limit(1);

    if (!record) {
      return null;
    }

    return {
      totalSent: record.totalSent,
      approvalRate: record.approvalRate,
      editRate: record.editRate,
      recommendedThreshold: record.recommendedThreshold,
    };
  } catch (err: any) {
    console.error(`[ConfidenceLearning] Error getting stats:`, err.message);
    return null;
  }
}
