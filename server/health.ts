/**
 * Health Metrics
 * 
 * Queries for system health dashboard (last 24h metrics)
 */

import { getDb } from "./db";
import { deployments, emailLogs } from "../drizzle/schema";
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
    success: number;
    failed: number;
    lastError: string | null;
    lastWebhookAt: Date | null;
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

  // Stripe webhook metrics (placeholder - will be populated when webhook events table exists)
  const stripeMetrics = {
    total: 0,
    success: 0,
    failed: 0,
    lastError: null,
    lastWebhookAt: null,
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
