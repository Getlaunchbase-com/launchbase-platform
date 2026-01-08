import { getDb } from "./db";
import { decisionLogs, deployments, workerRuns, buildPlans, intakes } from "../drizzle/schema";
import { eq, desc, gte, and, sql, or } from "drizzle-orm";

// Types for observability data
export interface SystemStatus {
  status: "operational" | "degraded" | "down";
  message: string;
  lastChecked: Date;
}

export interface ActivityMetrics {
  lastIntelligenceDecision: Date | null;
  lastDeploymentRun: Date | null;
  postsApprovedThisWeek: number;
  silenceDecisionsThisWeek: number;
}

export interface RecentDecision {
  id: number;
  type: "intelligence" | "deployment" | "silence" | "approval";
  summary: string;
  timestamp: Date;
  outcome: "success" | "skipped" | "pending";
}

export interface IntelligenceInfo {
  industryProfile: string | null;
  profileVersion: string | null;
  intelligenceVersion: string;
  mode: "auto" | "guided" | "custom";
}

export interface ObservabilityData {
  systemStatus: SystemStatus;
  activityMetrics: ActivityMetrics;
  recentDecisions: RecentDecision[];
  intelligenceInfo: IntelligenceInfo;
}

/**
 * Get system status based on recent activity
 */
export async function getSystemStatus(): Promise<SystemStatus> {
  try {
    const db = await getDb();
    if (!db) {
      return {
        status: "down",
        message: "Database unavailable",
        lastChecked: new Date()
      };
    }
    
    // Check if worker has run recently (within last 10 minutes)
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    
    // Raw SQL to bypass type inference issues
    const recentWorkerRuns = await db.execute<{ count: number }[]>(sql`
      SELECT COUNT(*) as count
      FROM worker_runs
      WHERE startedAt >= ${tenMinutesAgo}
    `);
    
    const hasRecentActivity = (recentWorkerRuns as any)[0]?.count > 0;
    
    // Check for any failed deployments in last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const failedDeployments = await db
      .select({ count: sql<number>`count(*)` })
      .from(deployments)
      .where(and(
        eq(deployments.status, "failed"),
        gte(deployments.updatedAt, oneHourAgo)
      ));
    
    const hasFailures = failedDeployments[0]?.count > 0;
    
    if (hasFailures) {
      return {
        status: "degraded",
        message: "Some deployments need attention",
        lastChecked: new Date()
      };
    }
    
    return {
      status: "operational",
      message: "All systems operational",
      lastChecked: new Date()
    };
  } catch (error) {
    return {
      status: "down",
      message: "Unable to check system status",
      lastChecked: new Date()
    };
  }
}

/**
 * Get activity metrics for the dashboard
 */
export async function getActivityMetrics(): Promise<ActivityMetrics> {
  const db = await getDb();
  if (!db) {
    return {
      lastIntelligenceDecision: null,
      lastDeploymentRun: null,
      postsApprovedThisWeek: 0,
      silenceDecisionsThisWeek: 0
    };
  }
  
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  
  // Last intelligence decision (from decision_logs)
  const lastIntelligenceDecisions = await db
    .select({ createdAt: decisionLogs.createdAt })
    .from(decisionLogs)
    .orderBy(desc(decisionLogs.createdAt))
    .limit(1);
  
  // Last deployment run (from worker_runs or deployments)
  const lastDeployments = await db
    .select({ updatedAt: deployments.updatedAt })
    .from(deployments)
    .where(eq(deployments.status, "success"))
    .orderBy(desc(deployments.updatedAt))
    .limit(1);
  
  // Posts approved this week (build plans that moved to approved status)
  const approvedThisWeek = await db
    .select({ count: sql<number>`count(*)` })
    .from(buildPlans)
    .where(and(
      eq(buildPlans.status, "approved"),
      gte(buildPlans.updatedAt, oneWeekAgo)
    ));
  
  // Silence decisions this week (from decision_logs where decision is 'silence' or 'wait')
  const silenceDecisions = await db
    .select({ count: sql<number>`count(*)` })
    .from(decisionLogs)
    .where(and(
      gte(decisionLogs.createdAt, oneWeekAgo),
      or(
        eq(decisionLogs.decision, "silence"),
        eq(decisionLogs.decision, "wait")
      )
    ));
  
  return {
    lastIntelligenceDecision: lastIntelligenceDecisions[0]?.createdAt || null,
    lastDeploymentRun: lastDeployments[0]?.updatedAt || null,
    postsApprovedThisWeek: approvedThisWeek[0]?.count || 0,
    silenceDecisionsThisWeek: silenceDecisions[0]?.count || 0
  };
}

/**
 * Get recent decisions with human-readable summaries
 */
export async function getRecentDecisions(limit: number = 3): Promise<RecentDecision[]> {
  const db = await getDb();
  if (!db) return [];
  
  const decisions: RecentDecision[] = [];
  
  // Get recent decision logs
  const recentLogs = await db
    .select()
    .from(decisionLogs)
    .orderBy(desc(decisionLogs.createdAt))
    .limit(limit * 2); // Get more to filter
  
  for (const log of recentLogs) {
    if (decisions.length >= limit) break;
    
    const decision: RecentDecision = {
      id: log.id,
      type: categorizeDecisionFromLog(log.decision, log.triggerContext),
      summary: generateHumanSummaryFromLog(log.decision, log.triggerContext, log.reason),
      timestamp: log.createdAt,
      outcome: determineOutcomeFromLog(log.decision)
    };
    
    decisions.push(decision);
  }
  
  // If not enough decisions from logs, add recent deployments
  if (decisions.length < limit) {
    const recentDeployments = await db
      .select()
      .from(deployments)
      .orderBy(desc(deployments.updatedAt))
      .limit(limit - decisions.length);
    
    for (const deployment of recentDeployments) {
      decisions.push({
        id: deployment.id,
        type: "deployment",
        summary: generateDeploymentSummary(deployment.status),
        timestamp: deployment.updatedAt,
        outcome: deployment.status === "success" ? "success" : 
                 deployment.status === "failed" ? "skipped" : "pending"
      });
    }
  }
  
  return decisions.slice(0, limit);
}

/**
 * Get intelligence system info
 */
export async function getIntelligenceInfo(): Promise<IntelligenceInfo> {
  const db = await getDb();
  if (!db) {
    return {
      industryProfile: null,
      profileVersion: null,
      intelligenceVersion: "v2.4.0",
      mode: "auto"
    };
  }
  
  // Get the most recent intake to determine industry
  const recentIntake = await db
    .select({ vertical: intakes.vertical })
    .from(intakes)
    .orderBy(desc(intakes.createdAt))
    .limit(1);
  
  return {
    industryProfile: recentIntake[0]?.vertical || null,
    profileVersion: "v1.0",
    intelligenceVersion: "v2.4.0",
    mode: "auto" // Default mode, would come from customer settings
  };
}

/**
 * Get full observability data
 */
export async function getObservabilityData(): Promise<ObservabilityData> {
  const [systemStatus, activityMetrics, recentDecisions, intelligenceInfo] = await Promise.all([
    getSystemStatus(),
    getActivityMetrics(),
    getRecentDecisions(3),
    getIntelligenceInfo()
  ]);
  
  return {
    systemStatus,
    activityMetrics,
    recentDecisions,
    intelligenceInfo
  };
}

// Helper functions for human-readable summaries

function categorizeDecisionFromLog(decision: string, triggerContext: string): RecentDecision["type"] {
  if (decision === "silence" || decision === "wait") {
    return "silence";
  }
  if (decision === "post") {
    return "intelligence";
  }
  return "intelligence";
}

function generateHumanSummaryFromLog(decision: string, triggerContext: string, reason: string): string {
  // Silence decisions
  if (decision === "silence" || decision === "wait") {
    if (triggerContext.includes("weather")) return "No post — weather conditions";
    if (triggerContext.includes("sports")) return "No post — sports event timing";
    if (triggerContext.includes("community")) return "No post — community event";
    if (reason?.includes("safety")) return "No post — safety check triggered";
    if (reason?.includes("relevance")) return "No post — low relevance score";
    return "No post — intentional silence";
  }
  
  // Post decisions
  if (decision === "post") {
    if (triggerContext.includes("weather")) return "Post generated — weather context";
    if (triggerContext.includes("sports")) return "Post generated — sports tie-in";
    if (triggerContext.includes("community")) return "Post generated — community event";
    if (triggerContext.includes("seasonal")) return "Post generated — seasonal content";
    return "Post generated — awaiting approval";
  }
  
  // Default
  return reason || `Decision: ${decision}`;
}

function generateDeploymentSummary(status: string): string {
  switch (status) {
    case "success": return "Deployment completed successfully";
    case "running": return "Deployment in progress";
    case "queued": return "Deployment queued for processing";
    case "failed": return "Deployment needs attention";
    default: return `Deployment status: ${status}`;
  }
}

function determineOutcomeFromLog(decision: string): RecentDecision["outcome"] {
  if (decision === "silence" || decision === "wait") {
    return "skipped";
  }
  if (decision === "post") {
    return "success";
  }
  return "pending";
}

/**
 * Format time ago for display
 */
export function formatTimeAgo(date: Date | null): string {
  if (!date) return "Never";
  
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}
