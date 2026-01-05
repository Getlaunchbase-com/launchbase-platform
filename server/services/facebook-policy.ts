/**
 * Facebook Posting Policy Enforcement
 * 
 * Launch hardening rules to maintain Meta platform trust:
 * 1. Approval-first for first 7 days (no auto-posting)
 * 2. Hard daily caps (prevent spam)
 * 3. Quiet hours enforcement (6 AM - 9 PM Chicago time)
 * 4. Conservative auto-post allowlist (weather + safety only)
 * 
 * These rules are NON-NEGOTIABLE and cannot be bypassed.
 */

import { getDb } from "../db";
import { socialPosts } from "../../drizzle/schema";
import { eq, and, gte, sql } from "drizzle-orm";

// Launch date - used to calculate "first 7 days" window
// Set this to your actual Facebook integration launch date
const LAUNCH_DATE = new Date("2026-01-06T00:00:00Z"); // Update this when you launch

// Policy constants
const APPROVAL_FIRST_DAYS = 7; // Days to require manual approval for all posts
const DAILY_POST_CAP = 10; // Maximum posts per 24-hour period
const QUIET_HOURS_START = 21; // 9 PM Chicago time (hour in 24h format)
const QUIET_HOURS_END = 6; // 6 AM Chicago time (hour in 24h format)

// Post types that CAN be auto-approved after the approval-first period
const AUTO_APPROVE_ALLOWLIST = [
  "ALL_CLEAR",      // Weather all-clear
  "MONITORING",     // Weather monitoring
  "ACTIVE_STORM",   // Active storm warning
  "WEATHER_UPDATE", // Weather update
];

export interface PolicyCheckResult {
  allowed: boolean;
  reason?: string;
  requiresApproval?: boolean;
}

/**
 * Check if we're still in the "approval-first" launch window
 */
export function isInApprovalFirstPeriod(): boolean {
  const now = new Date();
  const daysSinceLaunch = (now.getTime() - LAUNCH_DATE.getTime()) / (1000 * 60 * 60 * 24);
  return daysSinceLaunch < APPROVAL_FIRST_DAYS;
}

/**
 * Check if current time is within quiet hours (Chicago timezone)
 */
export function isQuietHours(): boolean {
  const now = new Date();
  
  // Convert to Chicago time (UTC-6 or UTC-5 depending on DST)
  const chicagoTime = new Date(now.toLocaleString("en-US", { timeZone: "America/Chicago" }));
  const hour = chicagoTime.getHours();
  
  // Quiet hours: 9 PM (21:00) to 6 AM (06:00)
  return hour >= QUIET_HOURS_START || hour < QUIET_HOURS_END;
}

/**
 * Get count of posts published in the last 24 hours
 */
export async function getPostCountLast24Hours(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(socialPosts)
    .where(
      and(
        eq(socialPosts.status, "published"),
        gte(socialPosts.publishedAt, twentyFourHoursAgo)
      )
    );
  
  return result[0]?.count || 0;
}

/**
 * Check if a post type is allowed for auto-approval
 */
export function isAutoApproveAllowed(postType: string): boolean {
  return AUTO_APPROVE_ALLOWLIST.includes(postType);
}

/**
 * Comprehensive policy check before posting to Facebook
 * This is the single gate that all posts must pass through
 */
export async function checkFacebookPostingPolicy(input: {
  postType: string;
  isManualApproval: boolean;
}): Promise<PolicyCheckResult> {
  // Rule 1: Approval-first for first 7 days
  if (isInApprovalFirstPeriod()) {
    if (!input.isManualApproval) {
      return {
        allowed: false,
        requiresApproval: true,
        reason: `Approval required: LaunchBase is in launch mode (first ${APPROVAL_FIRST_DAYS} days). All posts need manual review.`,
      };
    }
  }
  
  // Rule 2: Auto-approve allowlist (only applies after approval-first period)
  if (!isInApprovalFirstPeriod() && !input.isManualApproval) {
    if (!isAutoApproveAllowed(input.postType)) {
      return {
        allowed: false,
        requiresApproval: true,
        reason: `Post type "${input.postType}" requires manual approval. Only ${AUTO_APPROVE_ALLOWLIST.join(", ")} can be auto-posted.`,
      };
    }
  }
  
  // Rule 3: Quiet hours enforcement
  if (isQuietHours()) {
    return {
      allowed: false,
      reason: "Outside business hours (6 AM - 9 PM Chicago time). Post will be held for review.",
    };
  }
  
  // Rule 4: Daily post cap
  const postCount = await getPostCountLast24Hours();
  if (postCount >= DAILY_POST_CAP) {
    return {
      allowed: false,
      reason: `Daily post limit reached (${DAILY_POST_CAP} posts per 24 hours). This prevents spam and maintains platform trust.`,
    };
  }
  
  // All checks passed
  return {
    allowed: true,
  };
}

/**
 * Get current policy status (for observability/debugging)
 */
export async function getPolicyStatus(): Promise<{
  inApprovalFirstPeriod: boolean;
  daysUntilAutoPostEnabled: number;
  isQuietHours: boolean;
  postsLast24Hours: number;
  postsRemainingToday: number;
  autoApproveAllowlist: string[];
}> {
  const inApprovalFirst = isInApprovalFirstPeriod();
  const now = new Date();
  const daysSinceLaunch = (now.getTime() - LAUNCH_DATE.getTime()) / (1000 * 60 * 60 * 24);
  const daysRemaining = Math.max(0, APPROVAL_FIRST_DAYS - daysSinceLaunch);
  
  const postCount = await getPostCountLast24Hours();
  
  return {
    inApprovalFirstPeriod: inApprovalFirst,
    daysUntilAutoPostEnabled: Math.ceil(daysRemaining),
    isQuietHours: isQuietHours(),
    postsLast24Hours: postCount,
    postsRemainingToday: Math.max(0, DAILY_POST_CAP - postCount),
    autoApproveAllowlist: AUTO_APPROVE_ALLOWLIST,
  };
}
