/**
 * Health Metrics
 * 
 * Queries for system health dashboard (last 24h metrics)
 */

import { getDb } from "./db";
import { deployments, emailLogs, stripeWebhookEvents, swarmRuns } from "../drizzle/schema";
import { sql, gte, eq, and } from "drizzle-orm";

const TWENTY_FOUR_HOURS_AGO = () => new Date(Date.now() - 24 * 60 * 60 * 1000);

export interface HealthMetrics {
  tenant: "all" | "launchbase" | "vinces";
  deployments: {
    total: number;
    queued: number;
    running: number;
    success: number;
    failed: number;
    lastError: string | null;
    lastDeploymentAt: Date | null;
  };
  emails: {
    total: number;
    sent: number;
    failed: number;
    lastError: string | null;
    currentSender: string;
  };
  stripeWebhooks: {
    total: number;
    ok: number;
    failed: number;
    pending: number;
    retryEvents: number;
    totalRetries: number;
    lastError: string | null;
    lastEventAt: Date | null;
    isStale: boolean;
  };
  swarm: {
    total: number;
    ok: number;
    failed: number;
    lastFailureReason: string | null;
    lastRunAt: Date | null;
  };
  system: {
    uptime: number; // seconds
    startTime: Date;
    environment: string;
  };
}

const serverStartTime = new Date();

export async function getHealthMetrics(tenant?: "launchbase" | "vinces"): Promise<HealthMetrics> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const cutoff = TWENTY_FOUR_HOURS_AGO();

  // Deployment metrics
  const deploymentWhere = tenant
    ? and(gte(deployments.createdAt, cutoff), eq(deployments.tenant, tenant))
    : gte(deployments.createdAt, cutoff);
  
  const deploymentRows = await db
    .select()
    .from(deployments)
    .where(deploymentWhere);

  const deploymentMetrics = {
    total: deploymentRows.length,
    queued: deploymentRows.filter((d) => d.status === "queued").length,
    running: deploymentRows.filter((d) => d.status === "running").length,
    success: deploymentRows.filter((d) => d.status === "success").length,
    failed: deploymentRows.filter((d) => d.status === "failed").length,
    lastError: deploymentRows
      .filter((d) => d.errorMessage)
      .sort((a, b) => (b.updatedAt?.getTime() || 0) - (a.updatedAt?.getTime() || 0))[0]?.errorMessage || null,
    lastDeploymentAt: deploymentRows.length > 0
      ? deploymentRows.sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0))[0].createdAt
      : null,
  };

  // Email metrics
  const emailWhere = tenant
    ? and(gte(emailLogs.sentAt, cutoff), eq(emailLogs.tenant, tenant))
    : gte(emailLogs.sentAt, cutoff);
  
  const emailRows = await db
    .select()
    .from(emailLogs)
    .where(emailWhere);

  const emailMetrics = {
    total: emailRows.length,
    sent: emailRows.filter((e) => e.status === "sent").length,
    failed: emailRows.filter((e) => e.status === "failed").length,
    lastError: emailRows
      .filter((e) => e.errorMessage)
      .sort((a, b) => (b.sentAt?.getTime() || 0) - (a.sentAt?.getTime() || 0))[0]?.errorMessage || null,
    currentSender: "support@getlaunchbase.com",
  };

  // Stripe webhook metrics
  const stripeRows = await db
    .select()
    .from(stripeWebhookEvents)
    .where(gte(stripeWebhookEvents.receivedAt, cutoff));

  const stripeMetrics = {
    total: stripeRows.length,
    ok: stripeRows.filter((e) => e.ok === true).length,
    failed: stripeRows.filter((e) => e.ok === false).length,
    pending: stripeRows.filter((e) => e.ok === null).length,
    retryEvents: stripeRows.filter((e) => e.retryCount > 0).length,
    totalRetries: stripeRows.reduce((sum, e) => sum + (e.retryCount || 0), 0),
    lastError: stripeRows
      .filter((e) => e.error)
      .sort((a, b) => (b.receivedAt?.getTime() || 0) - (a.receivedAt?.getTime() || 0))[0]?.error || null,
    lastEventAt: stripeRows.length > 0
      ? stripeRows.sort((a, b) => (b.receivedAt?.getTime() || 0) - (a.receivedAt?.getTime() || 0))[0].receivedAt
      : null,
    // Only mark as stale if:
    // 1. There was at least 1 webhook in the last 7 days (traffic exists)
    // 2. AND no webhooks in the last 6 hours (went silent)
    // This prevents false alarms during beta/low-traffic periods
    isStale: (() => {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
      
      // Check if there was any traffic in last 7 days
      const hasRecentTraffic = stripeRows.some(e => e.receivedAt && e.receivedAt >= sevenDaysAgo);
      
      if (!hasRecentTraffic) {
        // No traffic in 7 days = not stale, just quiet
        return false;
      }
      
      // Has recent traffic, check if it went silent
      const hasVeryRecentTraffic = stripeRows.some(e => e.receivedAt && e.receivedAt >= sixHoursAgo);
      return !hasVeryRecentTraffic; // Stale if no traffic in last 6h
    })(),
  };

  // System metrics
  const uptime = Math.floor((Date.now() - serverStartTime.getTime()) / 1000);
  const systemMetrics = {
    uptime,
    startTime: serverStartTime,
    environment: process.env.NODE_ENV || "development",
  };

  // Swarm metrics (last 24h)
  const swarmRows = await db
    .select()
    .from(swarmRuns)
    .where(gte(swarmRuns.createdAt, cutoff));
  const lastRunAt = swarmRows.length > 0
    ? swarmRows.sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0))[0].createdAt
    : null;
  const lastFailure = swarmRows
    .filter(r => r.stopReason && r.stopReason !== "ok")
    .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0))[0];
  const swarmMetrics = {
    total: swarmRows.length,
    ok: swarmRows.filter(r => r.stopReason === "ok").length,
    failed: swarmRows.filter(r => r.stopReason && r.stopReason !== "ok").length,
    lastFailureReason: lastFailure?.stopReason || null,
    lastRunAt,
  };

  return {
    tenant: tenant ?? "all",
    deployments: deploymentMetrics,
    emails: emailMetrics,
    stripeWebhooks: stripeMetrics,
    swarm: swarmMetrics,
    system: systemMetrics,
  };
}
