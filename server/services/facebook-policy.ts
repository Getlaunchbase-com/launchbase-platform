/**
 * Facebook Posting Policy Enforcement
 * 
 * Launch hardening rules to maintain Meta platform trust:
 * 1. Approval-first for first 7 days (no auto-posting)
 * 2. Hard daily caps (prevent spam)
 * 3. Quiet hours enforcement (6 AM - 9 PM Chicago time)
 * 4. Conservative auto-post allowlist (OPS_ALERT, WEATHER_ALERT only)
 * 
 * These rules are NON-NEGOTIABLE and cannot be bypassed.
 */

import { getDb } from "../db";
import { socialPosts, moduleConnections } from "../../drizzle/schema";
import { eq, and, gte, sql } from "drizzle-orm";
import { fetchFacebookConnectedAt, countPublishedPostsToday } from "./facebook-policy-db";

// Policy constants
const APPROVAL_FIRST_DAYS = 7; // Days to require manual approval for all posts
const DAILY_POST_CAP = 2; // Maximum posts per calendar day (conservative for Day 1)
const AUTO_CONFIDENCE_THRESHOLD = 0.9; // 90% confidence required for auto-posting
const QUIET_HOURS_START = 21; // 9 PM Chicago time (hour in 24h format)
const QUIET_HOURS_END = 6; // 6 AM Chicago time (hour in 24h format)

// Post types that CAN be auto-approved after the approval-first period
const AUTO_APPROVE_ALLOWLIST: PolicyPostType[] = [
  "OPS_ALERT",      // Operational safety (storm active, closures)
  "WEATHER_ALERT",  // Weather-related but not urgent ops
];

export type PolicyMode = "manual" | "auto";
export type PolicyPostType = "OPS_ALERT" | "WEATHER_ALERT" | "OTHER";
export type PolicyAction = "PUBLISH" | "DRAFT" | "QUEUE" | "BLOCK";

export interface PolicyCheckResult {
  allowed: boolean;           // true only when PUBLISH
  action: PolicyAction;       // authoritative outcome
  requiresApproval?: boolean; // true only for DRAFT
  reasons?: string[];         // human-readable, ordered
  retryAt?: string;           // ISO timestamp, only for QUEUE
}

/**
 * Check if we're still in the "approval-first" window for this connection
 * This is PER-CONNECTION, not global
 */
export function isInApprovalFirstPeriod(connectedAt: Date, now: Date, days: number): boolean {
  const ms = now.getTime() - connectedAt.getTime();
  return ms < days * 24 * 60 * 60 * 1000;
}

/**
 * Check if current time is within quiet hours (Chicago timezone)
 */
export function isQuietHours(now: Date): boolean {
  // Convert to Chicago time (UTC-6 or UTC-5 depending on DST)
  const chicagoTime = new Date(now.toLocaleString("en-US", { timeZone: "America/Chicago" }));
  const hour = chicagoTime.getHours();
  
  // Quiet hours: 9 PM (21:00) to 6 AM (06:00)
  return hour >= QUIET_HOURS_START || hour < QUIET_HOURS_END;
}

/**
 * Calculate next allowed posting time (after quiet hours)
 */
export function getNextAllowedTime(now: Date): Date {
  const chicagoTime = new Date(now.toLocaleString("en-US", { timeZone: "America/Chicago" }));
  const hour = chicagoTime.getHours();
  
  let nextAllowed: Date;
  
  if (hour >= QUIET_HOURS_START) {
    // After 9 PM → next day at 6 AM
    nextAllowed = new Date(chicagoTime);
    nextAllowed.setDate(nextAllowed.getDate() + 1);
    nextAllowed.setHours(QUIET_HOURS_END, 0, 0, 0);
  } else {
    // Before 6 AM → today at 6 AM
    nextAllowed = new Date(chicagoTime);
    nextAllowed.setHours(QUIET_HOURS_END, 0, 0, 0);
  }
  
  return nextAllowed;
}

/**
 * Get count of posts published in the last 24 hours for a specific customer
 * Note: Currently counts all posts for the customer (not per-page)
 * This is conservative and prevents spam across all connected pages
 */
export async function getPostCountLast24Hours(customerId: string): Promise<number> {
  try {
    const db = await getDb();
    if (!db) return 999; // Conservative: assume cap reached if DB unavailable
    
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    // Count all published posts for this customer in last 24h
    // Note: social_posts has userId, which should match customerId
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(socialPosts)
      .where(
        and(
          eq(socialPosts.userId, parseInt(customerId)),
          eq(socialPosts.status, "published"),
          gte(socialPosts.publishedAt, twentyFourHoursAgo)
        )
      );
    
    return result[0]?.count || 0;
  } catch (error) {
    console.error("[policy] Failed to get post count:", error);
    return 999; // Conservative: assume cap reached on error
  }
}

/**
 * Check if a post type is allowed for auto-approval
 */
export function isAutoApproveAllowed(postType: PolicyPostType): boolean {
  return AUTO_APPROVE_ALLOWLIST.includes(postType);
}

/**
 * Comprehensive policy check before posting to Facebook
 * This is the single gate that all posts must pass through
 * 
 * Callers MUST switch on action, not allowed.
 * action is the authority, allowed is a convenience.
 */
export async function checkFacebookPostingPolicy(input: {
  customerId: string;
  pageId: string;
  mode: PolicyMode;
  postType: PolicyPostType;
  confidence: number | null; // 0-1 scale, null for manual
  now: Date;
}): Promise<PolicyCheckResult> {
  
  // Fetch connection details (connectedAt) from module_connections
  // Query by BOTH customerId AND pageId to ensure correct connection
  let connectedAt: Date | null = null;
  
  try {
    const db = await getDb();
    if (!db) {
      // DB unavailable - fail conservatively
      return {
        allowed: false,
        action: input.mode === "auto" ? "DRAFT" : "BLOCK",
        requiresApproval: input.mode === "auto" ? true : undefined,
        reasons: ["Database temporarily unavailable. Please try again."],
      };
    }
    
    const [connection] = await db
      .select({ createdAt: moduleConnections.createdAt })
      .from(moduleConnections)
      .where(
        and(
          eq(moduleConnections.userId, parseInt(input.customerId)),
          eq(moduleConnections.externalId, input.pageId),
          eq(moduleConnections.connectionType, "facebook_page")
        )
      )
      .limit(1);
    
    if (!connection) {
      // Connection not found - fail conservatively
      return {
        allowed: false,
        action: input.mode === "auto" ? "DRAFT" : "BLOCK",
        requiresApproval: input.mode === "auto" ? true : undefined,
        reasons: ["Facebook connection not found. Please reconnect your Facebook page."],
      };
    }
    
    connectedAt = connection.createdAt;
  } catch (error) {
    console.error("[policy] Failed to fetch connection:", error);
    // Query failed - fail conservatively
    return {
      allowed: false,
      action: input.mode === "auto" ? "DRAFT" : "BLOCK",
      requiresApproval: input.mode === "auto" ? true : undefined,
      reasons: ["Unable to verify Facebook connection. Please try again."],
    };
  }
  
  // Rule 1: Daily post cap (applies to ALL posts, manual or auto)
  const postCount = await getPostCountLast24Hours(input.customerId);
  if (postCount >= DAILY_POST_CAP) {
    return {
      allowed: false,
      action: "BLOCK",
      reasons: [
        `Daily post limit reached (${DAILY_POST_CAP} posts per 24 hours). Please try again later.`,
      ],
    };
  }
  
  // Rule 2: Approval-first for first 7 days (auto only, per-connection)
  if (input.mode === "auto" && isInApprovalFirstPeriod(connectedAt, input.now, APPROVAL_FIRST_DAYS)) {
    return {
      allowed: false,
      action: "DRAFT",
      requiresApproval: true,
      reasons: [
        `Approval required during first ${APPROVAL_FIRST_DAYS} days after Facebook connection.`,
      ],
    };
  }
  
  // Rule 3: Auto-posting allowlist enforcement (auto only, after approval-first period)
  if (input.mode === "auto" && !isAutoApproveAllowed(input.postType)) {
    return {
      allowed: false,
      action: "DRAFT",
      requiresApproval: true,
      reasons: [
        `Auto-posting is limited to ${AUTO_APPROVE_ALLOWLIST.join(" and ")} only. Post type "${input.postType}" requires manual approval.`,
      ],
    };
  }
  
  // Rule 4: Confidence threshold (auto only)
  if (input.mode === "auto" && (input.confidence === null || input.confidence < AUTO_CONFIDENCE_THRESHOLD)) {
    return {
      allowed: false,
      action: "DRAFT",
      requiresApproval: true,
      reasons: [
        "Confidence below threshold for auto-posting. Manual review recommended.",
      ],
    };
  }
  
  // Rule 5: Quiet hours
  // Auto posts → QUEUE (system will retry)
  // Manual posts → PUBLISH (user explicitly acting)
  if (isQuietHours(input.now)) {
    if (input.mode === "auto") {
      const retryAt = getNextAllowedTime(input.now);
      return {
        allowed: false,
        action: "QUEUE",
        reasons: [
          "Outside business hours (6 AM - 9 PM Chicago time). Post queued for next allowed window.",
        ],
        retryAt: retryAt.toISOString(),
      };
    }
    // Manual posts proceed even during quiet hours (user explicitly approved)
  }
  
  // All checks passed - safe to publish
  return {
    allowed: true,
    action: "PUBLISH",
  };
}

/**
 * Get current policy status (for observability/debugging)
 * Requires customerId and pageId to fetch connection-specific data
 */
export async function getPolicyStatus(customerId: string, pageId: string): Promise<{
  connected: boolean;
  inApprovalFirstPeriod: boolean;
  daysUntilAutoPostEnabled: number;
  isQuietHours: boolean;
  postsLast24Hours: number;
  postsRemainingToday: number;
  autoApproveAllowlist: PolicyPostType[];
}> {
  const now = new Date();
  
  // Fetch connection to get connectedAt
  let connectedAt: Date | null = null;
  try {
    const db = await getDb();
    if (db) {
      const [connection] = await db
        .select({ createdAt: moduleConnections.createdAt })
        .from(moduleConnections)
        .where(
          and(
            eq(moduleConnections.userId, parseInt(customerId)),
            eq(moduleConnections.externalId, pageId),
            eq(moduleConnections.connectionType, "facebook_page")
          )
        )
        .limit(1);
      
      if (connection) {
        connectedAt = connection.createdAt;
      }
    }
  } catch (error) {
    console.error("[policy] Failed to fetch connection for status:", error);
  }
  
  const inApprovalFirst = connectedAt ? isInApprovalFirstPeriod(connectedAt, now, APPROVAL_FIRST_DAYS) : true;
  const daysSinceConnected = connectedAt ? (now.getTime() - connectedAt.getTime()) / (1000 * 60 * 60 * 24) : 0;
  const daysRemaining = Math.max(0, APPROVAL_FIRST_DAYS - daysSinceConnected);
  
  const postCount = await getPostCountLast24Hours(customerId);
  
  return {
    connected: connectedAt !== null,
    inApprovalFirstPeriod: inApprovalFirst,
    daysUntilAutoPostEnabled: Math.ceil(daysRemaining),
    isQuietHours: isQuietHours(now),
    postsLast24Hours: postCount,
    postsRemainingToday: Math.max(0, DAILY_POST_CAP - postCount),
    autoApproveAllowlist: AUTO_APPROVE_ALLOWLIST,
  };
}
