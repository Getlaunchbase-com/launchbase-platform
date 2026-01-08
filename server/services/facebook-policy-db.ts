/**
 * Database helpers for Facebook policy enforcement
 * 
 * These helpers are extracted to make testing easier:
 * - Mock these helpers instead of Drizzle internals
 * - Keep policy logic testable without DB coupling
 */

import { getDb } from "../db";
import { socialPosts, moduleConnections } from "../../drizzle/schema";
import { eq, and, gte, sql } from "drizzle-orm";

/**
 * Fetch Facebook connection timestamp for a customer + page
 * Returns null if no connection exists
 */
export async function fetchFacebookConnectedAt(input: {
  customerId: string;
  pageId: string;
}): Promise<Date | null> {
  try {
    const db = await getDb();
    if (!db) return null;
    
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
    
    return connection?.createdAt ?? null;
  } catch (error) {
    console.error("[policy-db] Failed to fetch connection:", error);
    return null;
  }
}

/**
 * Count published posts in the last 24 hours for a customer
 * Returns 999 on error (conservative: assume cap reached)
 */
export async function countPublishedPostsToday(customerId: string): Promise<number> {
  try {
    const db = await getDb();
    if (!db) return 999;
    
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
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
    console.error("[policy-db] Failed to count posts:", error);
    return 999;
  }
}
