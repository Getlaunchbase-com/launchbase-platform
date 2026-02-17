/**
 * Analytics Module
 *
 * Real event tracking against the analyticsEvents table.
 * Provides funnel metrics, build quality metrics, vertical breakdowns,
 * and daily health aggregations.
 */

import { getDb } from "./db";
import { analyticsEvents } from "./db/schema";
import { sql, eq, desc, gte, count } from "drizzle-orm";

// ---------------------------------------------------------------------------
// trackEvent
// ---------------------------------------------------------------------------

export async function trackEvent(event: {
  eventName: string;
  intakeId?: number;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const db = await getDb();
    if (!db) {
      console.warn("[analytics] Database not available — event dropped:", event.eventName);
      return;
    }

    await db.insert(analyticsEvents).values({
      eventName: event.eventName,
      intakeId: event.intakeId ?? null,
      metadata: event.metadata ?? null,
      vertical: (event.metadata?.vertical as string) ?? null,
      stepNumber: (event.metadata?.stepNumber as number) ?? null,
      sessionId: (event.metadata?.sessionId as string) ?? null,
    });
  } catch (err) {
    // Analytics should never break the main flow
    console.error("[analytics] Failed to track event:", event.eventName, err);
  }
}

// ---------------------------------------------------------------------------
// getFunnelMetrics
// ---------------------------------------------------------------------------

export async function getFunnelMetrics(_start?: Date, _end?: Date): Promise<
  Array<{ eventName: string; count: number }>
> {
  try {
    const db = await getDb();
    if (!db) return [];

    const funnelEvents = [
      "intake_started",
      "intake_step_completed",
      "intake_submitted",
      "build_plan_generated",
      "build_plan_approved",
      "payment_completed",
      "site_deployed",
    ];

    const rows = await db
      .select({
        eventName: analyticsEvents.eventName,
        count: count(),
      })
      .from(analyticsEvents)
      .where(sql`${analyticsEvents.eventName} IN (${sql.join(funnelEvents.map(e => sql`${e}`), sql`, `)})`)
      .groupBy(analyticsEvents.eventName)
      .orderBy(sql`FIELD(${analyticsEvents.eventName}, ${sql.join(funnelEvents.map(e => sql`${e}`), sql`, `)})`);

    // Ensure all funnel stages are represented even if count is 0
    const resultMap = new Map(rows.map((r) => [r.eventName, Number(r.count)]));
    return funnelEvents.map((name) => ({
      eventName: name,
      count: resultMap.get(name) ?? 0,
    }));
  } catch (err) {
    console.error("[analytics] getFunnelMetrics error:", err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// getBuildQualityMetrics
// ---------------------------------------------------------------------------

export async function getBuildQualityMetrics(_start?: Date, _end?: Date): Promise<
  Array<{ metric: string; value: number }>
> {
  try {
    const db = await getDb();
    if (!db) return [];

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Count approved, rejected, and revision-requested builds in last 30 days
    const rows = await db
      .select({
        eventName: analyticsEvents.eventName,
        count: count(),
      })
      .from(analyticsEvents)
      .where(
        sql`${analyticsEvents.eventName} IN ('build_plan_approved', 'build_plan_rejected', 'revision_requested', 'site_deployed', 'deployment_failed') AND ${analyticsEvents.createdAt} >= ${thirtyDaysAgo}`
      )
      .groupBy(analyticsEvents.eventName);

    const counts = new Map(rows.map((r) => [r.eventName, Number(r.count)]));
    const approved = counts.get("build_plan_approved") ?? 0;
    const rejected = counts.get("build_plan_rejected") ?? 0;
    const revisions = counts.get("revision_requested") ?? 0;
    const deployed = counts.get("site_deployed") ?? 0;
    const deployFailed = counts.get("deployment_failed") ?? 0;

    const total = approved + rejected;
    const approvalRate = total > 0 ? Math.round((approved / total) * 100) : 0;
    const deploySuccessRate =
      deployed + deployFailed > 0
        ? Math.round((deployed / (deployed + deployFailed)) * 100)
        : 0;

    return [
      { metric: "approval_rate", value: approvalRate },
      { metric: "revision_count", value: revisions },
      { metric: "deploy_success_rate", value: deploySuccessRate },
      { metric: "total_approved", value: approved },
      { metric: "total_deployed", value: deployed },
    ];
  } catch (err) {
    console.error("[analytics] getBuildQualityMetrics error:", err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// getVerticalMetrics
// ---------------------------------------------------------------------------

export async function getVerticalMetrics(_start?: Date, _end?: Date): Promise<
  Array<{ vertical: string; count: number }>
> {
  try {
    const db = await getDb();
    if (!db) return [];

    const rows = await db
      .select({
        vertical: analyticsEvents.vertical,
        count: count(),
      })
      .from(analyticsEvents)
      .where(
        sql`${analyticsEvents.vertical} IS NOT NULL AND ${analyticsEvents.eventName} = 'intake_submitted'`
      )
      .groupBy(analyticsEvents.vertical)
      .orderBy(desc(count()));

    return rows.map((r) => ({
      vertical: r.vertical ?? "unknown",
      count: Number(r.count),
    }));
  } catch (err) {
    console.error("[analytics] getVerticalMetrics error:", err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// getDailyHealth
// ---------------------------------------------------------------------------

export async function getDailyHealth(): Promise<
  Array<{ date: string; events: number; errors: number }>
> {
  try {
    const db = await getDb();
    if (!db) return [];

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const rows = await db
      .select({
        date: sql<string>`DATE(${analyticsEvents.createdAt})`.as("date"),
        events: count(),
        errors: sql<number>`SUM(CASE WHEN ${analyticsEvents.eventName} LIKE '%error%' OR ${analyticsEvents.eventName} LIKE '%failed%' THEN 1 ELSE 0 END)`.as(
          "errors"
        ),
      })
      .from(analyticsEvents)
      .where(gte(analyticsEvents.createdAt, sevenDaysAgo))
      .groupBy(sql`DATE(${analyticsEvents.createdAt})`)
      .orderBy(sql`DATE(${analyticsEvents.createdAt})`);

    return rows.map((r) => ({
      date: String(r.date),
      events: Number(r.events),
      errors: Number(r.errors ?? 0),
    }));
  } catch (err) {
    console.error("[analytics] getDailyHealth error:", err);
    return [];
  }
}
