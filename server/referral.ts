/**
 * Referral Service
 * 
 * Handles badge click tracking, conversion funnel, share events, dedupe, and bot filtering
 * Single source of truth: referral_events table
 */

import { getDb } from "./db";
import { referralEvents } from "../drizzle/schema";
import { eq, and, gte } from "drizzle-orm";
import { createHash } from "crypto";

const BOT_PATTERNS = ["bot", "spider", "crawler", "facebookexternalhit", "twitterbot", "googlebot", "bingbot", "slurp"];
const REFERRAL_ID_SALT = process.env.REFERRAL_ID_SALT || "launchbase-ref-salt";

/**
 * Hash IP address for privacy-safe visitor tracking
 */
function hashIp(ip: string | undefined): string | undefined {
  if (!ip) return undefined;
  return createHash("sha256").update(ip + REFERRAL_ID_SALT).digest("hex").substring(0, 16);
}

/**
 * Check if user agent is a bot
 */
function isBot(userAgent: string | undefined): boolean {
  if (!userAgent) return false;
  const ua = userAgent.toLowerCase();
  return BOT_PATTERNS.some(pattern => ua.includes(pattern));
}

/**
 * Log a referral event with dedupe and bot filtering
 */
export async function logReferralEvent(params: {
  eventType: "badge_click" | "landing_view" | "apply_start" | "apply_submit" | "share_opened" | "share_copy_link" | "share_qr_shown" | "share_social_clicked";
  siteSlug?: string;
  siteId?: number;
  referralId?: string;
  sessionId?: string;
  userAgent?: string;
  referrer?: string;
  ipAddress?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  metadata?: Record<string, unknown>;
}): Promise<boolean> {
  try {
    const db = await getDb();
    if (!db) return false;

    // Check if bot
    const botFlag = isBot(params.userAgent);
    if (botFlag && params.eventType === "badge_click") {
      console.log(`[Referral] Blocked bot event: ${params.userAgent?.substring(0, 50)}`);
      return false;
    }

    // Generate visitor hash
    const visitorHash = params.ipAddress ? hashIp(params.ipAddress) : undefined;
    const sessionId = params.sessionId || (visitorHash ? `sess_${visitorHash}_${Date.now()}` : undefined);

    // Check for duplicates (same visitor_hash + referral_id within 30 minutes for badge clicks)
    let isDuplicate = false;
    if (params.eventType === "badge_click" && visitorHash && params.referralId) {
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
      const recentEvent = await db
        .select()
        .from(referralEvents)
        .where(
          and(
            eq(referralEvents.visitorHash, visitorHash),
            eq(referralEvents.referralId, params.referralId),
            eq(referralEvents.eventType, "badge_click"),
            gte(referralEvents.createdAt, thirtyMinutesAgo)
          )
        )
        .limit(1);

      if (recentEvent.length > 0) {
        isDuplicate = true;
        console.log(`[Referral] Duplicate badge click detected for ${params.referralId}`);
      }
    }

    // Log the event
    await db.insert(referralEvents).values({
      eventType: params.eventType,
      siteSlug: params.siteSlug,
      siteId: params.siteId,
      referralId: params.referralId,
      sessionId,
      visitorHash,
      userAgent: params.userAgent?.substring(0, 500),
      referrer: params.referrer?.substring(0, 500),
      utmSource: params.utmSource,
      utmMedium: params.utmMedium,
      utmCampaign: params.utmCampaign,
      utmContent: params.utmContent,
      isDuplicate,
      isBot: botFlag,
      metadata: params.metadata,
      createdAt: new Date(),
    });

    console.log(`[Referral] Logged ${params.eventType} for ${params.referralId || params.siteSlug || "unknown"}`);
    return true;
  } catch (error) {
    console.error("[Referral] Failed to log event:", error);
    return false;
  }
}

/**
 * Get top referring sites (by clicks or conversions)
 */
export async function getTopReferringSites(
  limit: number = 10,
  timeWindowDays: number = 7,
  sortBy: "clicks" | "conversions" = "clicks"
) {
  try {
    const db = await getDb();
    if (!db) return [];

    const cutoffDate = new Date(Date.now() - timeWindowDays * 24 * 60 * 60 * 1000);
    
    // Get all valid events (non-duplicate, non-bot) from time window
    const events = await db
      .select()
      .from(referralEvents)
      .where(
        and(
          gte(referralEvents.createdAt, cutoffDate),
          eq(referralEvents.isDuplicate, false),
          eq(referralEvents.isBot, false)
        )
      );

    // Group by site
    const siteStats = new Map<
      number,
      {
        siteId: number;
        siteSlug: string;
        clicks: number;
        lands: number;
        applyStarts: number;
        applySubmits: number;
      }
    >();

    for (const event of events) {
      if (!event.siteId) continue;

      if (!siteStats.has(event.siteId)) {
        siteStats.set(event.siteId, {
          siteId: event.siteId,
          siteSlug: event.siteSlug || `site-${event.siteId}`,
          clicks: 0,
          lands: 0,
          applyStarts: 0,
          applySubmits: 0,
        });
      }

      const stats = siteStats.get(event.siteId)!;
      if (event.eventType === "badge_click") stats.clicks++;
      else if (event.eventType === "landing_view") stats.lands++;
      else if (event.eventType === "apply_start") stats.applyStarts++;
      else if (event.eventType === "apply_submit") stats.applySubmits++;
    }

    // Sort and return top N
    const sorted = Array.from(siteStats.values()).sort((a, b) => {
      if (sortBy === "conversions") {
        return b.applySubmits - a.applySubmits;
      }
      return b.clicks - a.clicks;
    });

    return sorted.slice(0, limit);
  } catch (error) {
    console.error("[Referral] Failed to get top sites:", error);
    return [];
  }
}

/**
 * Get conversion funnel for a time window
 */
export async function getConversionFunnel(timeWindowDays: number = 7) {
  try {
    const db = await getDb();
    if (!db) return { clicks: 0, lands: 0, applyStarts: 0, applySubmits: 0, clickToLandRate: "0", landToApplyStartRate: "0", applyStartToSubmitRate: "0" };

    const cutoffDate = new Date(Date.now() - timeWindowDays * 24 * 60 * 60 * 1000);
    
    const events = await db
      .select()
      .from(referralEvents)
      .where(
        and(
          gte(referralEvents.createdAt, cutoffDate),
          eq(referralEvents.isDuplicate, false),
          eq(referralEvents.isBot, false)
        )
      );

    const clicks = events.filter((e) => e.eventType === "badge_click").length;
    const lands = events.filter((e) => e.eventType === "landing_view").length;
    const applyStarts = events.filter((e) => e.eventType === "apply_start").length;
    const applySubmits = events.filter((e) => e.eventType === "apply_submit").length;

    return {
      clicks,
      lands,
      applyStarts,
      applySubmits,
      clickToLandRate: clicks > 0 ? ((lands / clicks) * 100).toFixed(1) : "0",
      landToApplyStartRate: lands > 0 ? ((applyStarts / lands) * 100).toFixed(1) : "0",
      applyStartToSubmitRate: applyStarts > 0 ? ((applySubmits / applyStarts) * 100).toFixed(1) : "0",
    };
  } catch (error) {
    console.error("[Referral] Failed to get funnel:", error);
    return { clicks: 0, lands: 0, applyStarts: 0, applySubmits: 0, clickToLandRate: "0", landToApplyStartRate: "0", applyStartToSubmitRate: "0" };
  }
}

/**
 * Get total clicks for last 7 days (for sidebar badge)
 */
export async function get7DayClicks(): Promise<number> {
  try {
    const db = await getDb();
    if (!db) return 0;

    const cutoffDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    const events = await db
      .select()
      .from(referralEvents)
      .where(
        and(
          gte(referralEvents.createdAt, cutoffDate),
          eq(referralEvents.eventType, "badge_click"),
          eq(referralEvents.isDuplicate, false),
          eq(referralEvents.isBot, false)
        )
      );

    return events.length;
  } catch (error) {
    console.error("[Referral] Failed to get 7d clicks:", error);
    return 0;
  }
}
