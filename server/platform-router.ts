/**
 * Platform API Router
 * Endpoints for customer sites to consume LaunchBase platform services
 * 
 * Slice A: Facebook Connection + Publish E2E
 */

import { z } from "zod";
import { router, protectedProcedure } from "./_core/trpc";
import { getDb } from "./db";
import { moduleConnections, socialPosts, decisionLogs } from "../drizzle/schema";
import { listPages, connectPage, getSession } from "./services/facebookOAuth";
import { notifyOnDraftAction } from "./services/draftNotifications";
import { eq, and, desc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import crypto from "crypto";

// Helper to hash payload for audit trail
function hashPayload(content: string): string {
  return crypto.createHash("sha256").update(content).digest("hex").slice(0, 16);
}

// Helper to check if within business hours (6 AM - 9 PM Chicago time)
function isWithinBusinessHours(): boolean {
  const now = new Date();
  const chicagoTime = new Date(now.toLocaleString("en-US", { timeZone: "America/Chicago" }));
  const hour = chicagoTime.getHours();
  return hour >= 6 && hour < 21;
}

// Helper to post to Facebook Page
async function postToFacebookPage(
  pageId: string,
  accessToken: string,
  message: string
): Promise<{ success: boolean; postId?: string; error?: string }> {
  try {
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${pageId}/feed`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          access_token: accessToken,
        }),
      }
    );

    const data = await response.json();

    if (data.error) {
      return { success: false, error: data.error.message };
    }

    return { success: true, postId: data.id };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export const platformRouter = router({
  /**
   * Get Facebook connection status for current user
   */
  getFacebookStatus: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
    }

    const [connection] = await db.select().from(moduleConnections).where(
      and(
        eq(moduleConnections.userId, ctx.user.id),
        eq(moduleConnections.connectionType, "facebook_page")
      )
    ).limit(1);

    if (!connection) {
      return {
        connected: false,
        pageId: null,
        pageName: null,
        tokenValid: false,
        lastVerifiedAt: null,
        status: "disconnected" as const,
      };
    }

    // Check if token is expired
    const tokenExpired = connection.tokenExpiresAt
      ? new Date(connection.tokenExpiresAt) < new Date()
      : false;

    return {
      connected: connection.status === "active",
      pageId: connection.externalId,
      pageName: connection.externalName,
      tokenValid: !tokenExpired && connection.status === "active",
      lastVerifiedAt: connection.lastSyncAt?.toISOString() || null,
      status: tokenExpired ? "expired" as const : connection.status === "active" ? "connected" as const : connection.status,
    };
  }),

  /**
   * Verify Facebook connection is still valid
   */
  verifyFacebookConnection: protectedProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();
    if (!db) {
      return { valid: false, error: "Database unavailable" };
    }

    const [connection] = await db.select().from(moduleConnections).where(
      and(
        eq(moduleConnections.userId, ctx.user.id),
        eq(moduleConnections.connectionType, "facebook_page")
      )
    ).limit(1);

    if (!connection || !connection.accessToken) {
      return { valid: false, error: "No Facebook connection found" };
    }

    try {
      // Test the token by fetching page info
      const response = await fetch(
        `https://graph.facebook.com/v18.0/${connection.externalId}?fields=name,access_token&access_token=${connection.accessToken}`
      );
      const data = await response.json();

      if (data.error) {
        // Update connection status to error
        await db
          .update(moduleConnections)
          .set({
            status: "error",
            lastError: data.error.message,
            updatedAt: new Date(),
          })
          .where(eq(moduleConnections.id, connection.id));

        return { valid: false, error: data.error.message };
      }

      // Update last sync time
      await db
        .update(moduleConnections)
        .set({
          status: "active",
          lastSyncAt: new Date(),
          lastError: null,
          updatedAt: new Date(),
        })
        .where(eq(moduleConnections.id, connection.id));

      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : "Verification failed",
      };
    }
  }),

  /**
   * List drafts for current user
   */
  listDrafts: protectedProcedure
    .input(
      z.object({
        status: z
          .enum(["needs_review", "approved", "published", "rejected", "expired"])
          .optional(),
        limit: z.number().min(1).max(100).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        return { drafts: [], total: 0 };
      }

      const conditions = [eq(socialPosts.userId, ctx.user.id)];

      if (input.status) {
        conditions.push(eq(socialPosts.status, input.status));
      }

      const drafts = await db.select().from(socialPosts).where(
        and(...conditions)
      ).orderBy(desc(socialPosts.createdAt)).limit(input.limit);

      return {
        drafts: drafts.map((d: typeof socialPosts.$inferSelect) => ({
          id: d.id,
          content: d.content,
          headline: d.headline,
          postType: d.postType,
          status: d.status,
          whyWeWroteThis: d.whyWeWroteThis,
          reasonChips: d.reasonChips || [],
          confidenceScore: d.confidenceScore,
          scheduledFor: d.scheduledFor?.toISOString() || null,
          expiresAt: d.expiresAt?.toISOString() || null,
          facebookPostId: d.facebookPostId,
          createdAt: d.createdAt.toISOString(),
        })),
        total: drafts.length,
      };
    }),

  /**
   * Approve and publish a draft
   */
  approveDraft: protectedProcedure
    .input(
      z.object({
        draftId: z.number(),
        publishAt: z.string().datetime().optional(), // For scheduled publishing
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      }

      // Get the draft
      const [draft] = await db.select().from(socialPosts).where(
        and(
          eq(socialPosts.id, input.draftId),
          eq(socialPosts.userId, ctx.user.id)
        )
      ).limit(1);

      if (!draft) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Draft not found" });
      }

      if (draft.status === "published") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Draft already published",
        });
      }

      // Get Facebook connection
      const [connection] = await db.select().from(moduleConnections).where(
        and(
          eq(moduleConnections.userId, ctx.user.id),
          eq(moduleConnections.connectionType, "facebook_page")
        )
      ).limit(1);

      if (!connection || !connection.accessToken || !connection.externalId) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Facebook not connected",
        });
      }

      // Safety check: business hours
      if (!isWithinBusinessHours()) {
        // Log the hold decision
        await db.insert(decisionLogs).values({
          userId: ctx.user.id,
          decision: "silence",
          severity: "soft_block",
          reason: "outside_business_hours",
          triggerContext: "manual",
          conditions: {
            draftId: draft.id,
            attemptedAt: new Date().toISOString(),
            reason: "Post held - outside business hours (6 AM - 9 PM Chicago)",
          },
        });

        // Notify owner about the hold
        await notifyOnDraftAction(draft.id, "held", {
          reason: "Outside business hours (6 AM - 9 PM Chicago time)",
        });

        return {
          status: "held" as const,
          reason: "Outside business hours (6 AM - 9 PM Chicago time)",
          externalId: null,
          payloadHash: null,
        };
      }

      // Publish to Facebook
      const payloadHash = hashPayload(draft.content);
      const result = await postToFacebookPage(
        connection.externalId,
        connection.accessToken,
        draft.content
      );

      if (!result.success) {
        // Log the failure
        await db.insert(decisionLogs).values({
          userId: ctx.user.id,
          decision: "silence",
          severity: "hard_block",
          reason: "publish_failed",
          triggerContext: "manual",
          conditions: {
            draftId: draft.id,
            error: result.error,
            payloadHash,
          },
        });

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to publish: ${result.error}`,
        });
      }

      // Update draft status
      await db
        .update(socialPosts)
        .set({
          status: "published",
          facebookPostId: result.postId,
          publishedAt: new Date(),
          approvedAt: new Date(),
          approvedBy: ctx.user.id,
          publishedTo: ["facebook"],
          updatedAt: new Date(),
        })
        .where(eq(socialPosts.id, draft.id));

      // Log the successful publish
      await db.insert(decisionLogs).values({
        userId: ctx.user.id,
        decision: "post",
        reason: "manual_approval",
        triggerContext: "manual",
        conditions: {
          draftId: draft.id,
          externalId: result.postId,
          payloadHash,
          platform: "facebook",
          publishedAt: new Date().toISOString(),
        },
        });

      // Notify owner about successful publish
      await notifyOnDraftAction(draft.id, "published", {
        externalId: result.postId,
      });

      return {
        status: "published" as const,
        externalId: result.postId,
        payloadHash,
        reason: null,
      };
    }),

  /**
   * Create a test draft (dev-only shortcut)
   * Allows testing the pipeline without waiting for real weather
   */
  createTestDraft: protectedProcedure
    .input(
      z.object({
        content: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      }

      const defaultContent = `❄️ Snow in the forecast tonight! Our crews are prepped and ready to keep your property clear and safe.

Stay warm, stay safe — we've got you covered.

#SnowRemoval #WinterReady #ChicagoSuburbs`;

      const [draft] = await db
        .insert(socialPosts)
        .values({
          userId: ctx.user.id,
          content: input.content || defaultContent,
          headline: "Snow Alert - Crews Ready",
          postType: "MONITORING",
          triggerContext: "weather_storm",
          reasonChips: ["Snow expected", "Timing matters"],
          whyWeWroteThis:
            "Snow forecast detected for overnight. This is a good time to reassure customers that crews are prepared.",
          confidenceScore: 85,
          status: "needs_review",
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        })
        .$returningId();

      // Log the draft creation
      await db.insert(decisionLogs).values({
        userId: ctx.user.id,
        decision: "post",
        reason: "test_draft_created",
        triggerContext: "manual",
        conditions: {
          draftId: draft.id,
          source: "dev_shortcut",
          createdAt: new Date().toISOString(),
        },
        });

      // Notify owner about new draft needing review
      await notifyOnDraftAction(draft.id, "created");

      return {
        id: draft.id,
        message: "Test draft created successfully",
      };
    }),

  /**
   * Facebook OAuth: List available pages from connect session
   */
  listFacebookPages: protectedProcedure
    .input(z.object({ connectSessionId: z.string() }))
    .query(async ({ ctx, input }) => {
      const { pages, error } = await listPages(input.connectSessionId, ctx.user.id);
      
      if (error) {
        throw new TRPCError({ code: "BAD_REQUEST", message: error });
      }

      return { pages };
    }),

  /**
   * Facebook OAuth: Connect a specific page
   */
  connectFacebookPage: protectedProcedure
    .input(z.object({
      connectSessionId: z.string(),
      pageId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      }

      const { success, pageName, error } = await connectPage(
        input.connectSessionId,
        ctx.user.id,
        input.pageId
      );

      if (!success) {
        throw new TRPCError({ code: "BAD_REQUEST", message: error || "Connection failed" });
      }

      // Log the connection
      await db.insert(decisionLogs).values({
        userId: ctx.user.id,
        decision: "post",
        reason: "facebook_page_connected",
        triggerContext: "manual",
        conditions: {
          pageId: input.pageId,
          pageName: pageName,
          connectedAt: new Date().toISOString(),
          action: "connect",
        },
      });

      return {
        status: "connected",
        pageId: input.pageId,
        pageName: pageName,
      };
    }),

  /**
   * Facebook OAuth: Get session status (for UI to check if session is valid)
   */
  getFacebookOAuthSession: protectedProcedure
    .input(z.object({ connectSessionId: z.string() }))
    .query(async ({ ctx, input }) => {
      const { session, error } = await getSession(input.connectSessionId, ctx.user.id);
      
      if (error || !session) {
        return {
          valid: false,
          status: "invalid" as const,
          error: error || "Session not found",
        };
      }

      return {
        valid: true,
        status: session.status,
        error: session.error,
        returnTo: session.returnTo,
      };
    }),
});
