/**
 * Observability Module
 *
 * Aggregates system status, activity metrics, recent decisions,
 * and logs for the admin observability dashboard.
 */

import { getDb } from "./db";
import { decisionLogs, deployments, analyticsEvents } from "./db/schema";
import { desc, sql } from "drizzle-orm";

// ---------------------------------------------------------------------------
// getObservabilityData
// ---------------------------------------------------------------------------

export async function getObservabilityData(): Promise<{
  systemStatus: { healthy: boolean; uptime: number };
  activityMetrics: { lastIntelligenceDecision: Date; lastDeploymentRun: Date };
  recentDecisions: any[];
  intelligenceInfo: { active: boolean };
  logs: any[];
  metrics: any[];
}> {
  const uptime = process.uptime();
  let healthy = true;
  let lastIntelligenceDecision = new Date(0);
  let lastDeploymentRun = new Date(0);
  let recentDecisions: any[] = [];
  const logs: any[] = [];
  const metrics: any[] = [];

  try {
    const db = await getDb();
    if (db) {
      // Get last intelligence decision
      const [lastDecision] = await db
        .select({
          createdAt: decisionLogs.createdAt,
          decision: decisionLogs.decision,
          reason: decisionLogs.reason,
          triggerContext: decisionLogs.triggerContext,
          confidenceScore: decisionLogs.confidenceScore,
        })
        .from(decisionLogs)
        .orderBy(desc(decisionLogs.createdAt))
        .limit(1);

      if (lastDecision) {
        lastIntelligenceDecision = lastDecision.createdAt;
      }

      // Get last deployment
      const [lastDeployment] = await db
        .select({
          createdAt: deployments.createdAt,
          status: deployments.status,
        })
        .from(deployments)
        .orderBy(desc(deployments.createdAt))
        .limit(1);

      if (lastDeployment) {
        lastDeploymentRun = lastDeployment.createdAt;
      }

      // Get recent decisions (last 20)
      recentDecisions = await db
        .select({
          id: decisionLogs.id,
          decision: decisionLogs.decision,
          reason: decisionLogs.reason,
          triggerContext: decisionLogs.triggerContext,
          confidenceScore: decisionLogs.confidenceScore,
          severity: decisionLogs.severity,
          createdAt: decisionLogs.createdAt,
        })
        .from(decisionLogs)
        .orderBy(desc(decisionLogs.createdAt))
        .limit(20);

      // Aggregate recent events as metrics
      const eventCounts = await db
        .select({
          eventName: analyticsEvents.eventName,
          count: sql<number>`COUNT(*)`.as("count"),
        })
        .from(analyticsEvents)
        .where(
          sql`${analyticsEvents.createdAt} >= DATE_SUB(NOW(), INTERVAL 24 HOUR)`
        )
        .groupBy(analyticsEvents.eventName)
        .orderBy(desc(sql`COUNT(*)`))
        .limit(10);

      for (const row of eventCounts) {
        metrics.push({
          name: row.eventName,
          value: Number(row.count),
          period: "24h",
        });
      }
    } else {
      healthy = false;
    }
  } catch (err) {
    healthy = false;
    logs.push({
      level: "error",
      message: `Observability data collection failed: ${err instanceof Error ? err.message : String(err)}`,
      timestamp: new Date().toISOString(),
    });
  }

  return {
    systemStatus: { healthy, uptime },
    activityMetrics: { lastIntelligenceDecision, lastDeploymentRun },
    recentDecisions,
    intelligenceInfo: { active: healthy },
    logs,
    metrics,
  };
}

// ---------------------------------------------------------------------------
// formatTimeAgo
// ---------------------------------------------------------------------------

export function formatTimeAgo(date: Date): string {
  if (!date || date.getTime() === 0) {
    return "never";
  }

  const now = Date.now();
  const diffMs = now - date.getTime();

  if (diffMs < 0) {
    return "just now";
  }

  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);

  if (seconds < 60) {
    return seconds <= 1 ? "just now" : `${seconds} seconds ago`;
  }
  if (minutes < 60) {
    return minutes === 1 ? "1 minute ago" : `${minutes} minutes ago`;
  }
  if (hours < 24) {
    return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
  }
  if (days < 7) {
    return days === 1 ? "1 day ago" : `${days} days ago`;
  }
  if (weeks < 5) {
    return weeks === 1 ? "1 week ago" : `${weeks} weeks ago`;
  }
  return months === 1 ? "1 month ago" : `${months} months ago`;
}
