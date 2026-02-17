/**
 * Referral Module
 *
 * Real referral tracking functions querying the referralEvents and referrals tables.
 * Provides top referring sites, conversion funnel, 7-day click trends, and event logging.
 */

import { getDb } from "./db";
import { referralEvents, referrals } from "./db/schema";
import { sql, desc, gte, eq, count } from "drizzle-orm";

// ---------------------------------------------------------------------------
// getTopReferringSites
// ---------------------------------------------------------------------------

export async function getTopReferringSites(_limit?: number, _timeWindowDays?: number, _sortBy?: string): Promise<
  Array<{ domain: string; count: number }>
> {
  try {
    const db = await getDb();
    if (!db) return [];

    const rows = await db
      .select({
        domain: sql<string>`
          COALESCE(
            ${referralEvents.siteSlug},
            SUBSTRING_INDEX(SUBSTRING_INDEX(${referralEvents.referrer}, '/', 3), '/', -1),
            'direct'
          )
        `.as("domain"),
        count: count(),
      })
      .from(referralEvents)
      .where(
        sql`${referralEvents.eventType} = 'badge_click' AND ${referralEvents.isBot} = false`
      )
      .groupBy(sql`domain`)
      .orderBy(desc(count()))
      .limit(20);

    return rows.map((r) => ({
      domain: String(r.domain),
      count: Number(r.count),
    }));
  } catch (err) {
    console.error("[referral] getTopReferringSites error:", err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// getConversionFunnel
// ---------------------------------------------------------------------------

export async function getConversionFunnel(_timeWindowDays?: number): Promise<
  Array<{ stage: string; count: number }>
> {
  try {
    const db = await getDb();
    if (!db) return [];

    const funnelStages = [
      "badge_click",
      "landing_view",
      "apply_start",
      "apply_submit",
    ];

    const rows = await db
      .select({
        eventType: referralEvents.eventType,
        count: count(),
      })
      .from(referralEvents)
      .where(
        sql`${referralEvents.eventType} IN ('badge_click', 'landing_view', 'apply_start', 'apply_submit') AND ${referralEvents.isBot} = false AND ${referralEvents.isDuplicate} = false`
      )
      .groupBy(referralEvents.eventType);

    const countMap = new Map(
      rows.map((r) => [r.eventType, Number(r.count)]),
    );

    return funnelStages.map((stage) => ({
      stage,
      count: countMap.get(stage) ?? 0,
    }));
  } catch (err) {
    console.error("[referral] getConversionFunnel error:", err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// get7DayClicks
// ---------------------------------------------------------------------------

export async function get7DayClicks(): Promise<
  Array<{ date: string; clicks: number }>
> {
  try {
    const db = await getDb();
    if (!db) return [];

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const rows = await db
      .select({
        date: sql<string>`DATE(${referralEvents.createdAt})`.as("date"),
        clicks: count(),
      })
      .from(referralEvents)
      .where(
        sql`${referralEvents.eventType} = 'badge_click' AND ${referralEvents.isBot} = false AND ${referralEvents.createdAt} >= ${sevenDaysAgo}`
      )
      .groupBy(sql`DATE(${referralEvents.createdAt})`)
      .orderBy(sql`DATE(${referralEvents.createdAt})`);

    // Fill in missing days with zero clicks
    const result: Array<{ date: string; clicks: number }> = [];
    const clickMap = new Map(
      rows.map((r) => [String(r.date), Number(r.clicks)]),
    );

    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const dateStr = d.toISOString().split("T")[0];
      result.push({
        date: dateStr,
        clicks: clickMap.get(dateStr) ?? 0,
      });
    }

    return result;
  } catch (err) {
    console.error("[referral] get7DayClicks error:", err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// logReferralEvent
// ---------------------------------------------------------------------------

export async function logReferralEvent(
  event: Record<string, unknown>,
): Promise<void> {
  try {
    const db = await getDb();
    if (!db) {
      console.warn("[referral] Database not available — event dropped");
      return;
    }

    await db.insert(referralEvents).values({
      eventType: (event.eventType as string) || "badge_click",
      siteSlug: (event.siteSlug as string) || null,
      siteId: (event.siteId as number) || null,
      referralId: (event.referralId as string) || null,
      sessionId: (event.sessionId as string) || null,
      visitorHash: (event.visitorHash as string) || null,
      userAgent: (event.userAgent as string) || null,
      referrer: (event.referrer as string) || null,
      utmSource: (event.utmSource as string) || null,
      utmMedium: (event.utmMedium as string) || null,
      utmCampaign: (event.utmCampaign as string) || null,
      utmContent: (event.utmContent as string) || null,
      isDuplicate: (event.isDuplicate as boolean) ?? false,
      isBot: (event.isBot as boolean) ?? false,
      metadata: (event.metadata as Record<string, unknown>) || null,
    });
  } catch (err) {
    // Referral logging should never break the main flow
    console.error("[referral] Failed to log referral event:", err);
  }
}
