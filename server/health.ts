/**
 * Health Metrics
 * 
 * Queries for system health dashboard (last 24h metrics)
 */

import { getDb } from "./db";
import { deployments, emailLogs, stripeWebhookEvents } from "../drizzle/schema";
import { sql, gte } from "drizzle-orm";

const TWENTY_FOUR_HOURS_AGO = () => new Date(Date.now() - 24 * 60 * 60 * 1000);

export interface HealthMetrics {
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
  system: {
    uptime: number; // seconds
    startTime: Date;
    environment: string;
  };
}

const serverStartTime = new Date();

export async function getHealthMetrics(): Promise<HealthMetrics> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const cutoff = TWENTY_FOUR_HOURS_AGO();

  // Deployment metrics
  const deploymentRows = await db
    .select()
    .from(deployments)
    .where(gte(deployments.createdAt, cutoff));

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
  const emailRows = await db
    .select()
    .from(emailLogs)
    .where(gte(emailLogs.sentAt, cutoff));

  const emailMetrics = {
    total: emailRows.length,
    sent: emailRows.filter((e) => e.status === "sent").length,
    failed: emailRows.filter((e) => e.status === "failed").length,
    lastError: emailRows
      .filter((e) => e.errorMessage)
      .sort((a, b) => (b.sentAt?.getTime() || 0) - (a.sentAt?.getTime() || 0))[0]?.errorMessage || null,
    currentSender: process.env.RESEND_DOMAIN_VERIFIED === "true" 
      ? "support@getlaunchbase.com" 
      : "onboarding@resend.dev",
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
    isStale: stripeRows.length === 0 || 
      (stripeRows.length > 0 && 
       (Date.now() - (stripeRows.sort((a, b) => (b.receivedAt?.getTime() || 0) - (a.receivedAt?.getTime() || 0))[0].receivedAt?.getTime() || 0)) > 6 * 60 * 60 * 1000),
  };

  // System metrics
  const uptime = Math.floor((Date.now() - serverStartTime.getTime()) / 1000);
  const systemMetrics = {
    uptime,
    startTime: serverStartTime,
    environment: process.env.NODE_ENV || "development",
  };

  return {
    deployments: deploymentMetrics,
    emails: emailMetrics,
    stripeWebhooks: stripeMetrics,
    system: systemMetrics,
  };
}
