import { z } from "zod";
import { notifyOwner } from "./notification";
import { adminProcedure, publicProcedure, router } from "./trpc";
import { sendEmail } from "../email";
import { getDb } from "../db";
import { emailLogs } from "../../drizzle/schema";
import { desc, sql, and, gte } from "drizzle-orm";

export const systemRouter = router({
  health: publicProcedure
    .input(
      z.object({
        timestamp: z.number().min(0, "timestamp cannot be negative"),
      })
    )
    .query(() => ({
      ok: true,
    })),

  notifyOwner: adminProcedure
    .input(
      z.object({
        title: z.string().min(1, "title is required"),
        content: z.string().min(1, "content is required"),
      })
    )
    .mutation(async ({ input }) => {
      const delivered = await notifyOwner(input);
      return {
        success: delivered,
      } as const;
    }),

  // Admin-only: Send test email to verify Resend configuration
  sendTestEmail: adminProcedure
    .input(
      z.object({
        recipientEmail: z.string().email("valid email required"),
        emailType: z.enum(["intake_confirmation", "ready_for_review", "site_live"]).default("intake_confirmation"),
      })
    )
    .mutation(async ({ input }) => {
      // Send test email with dummy data
      const result = await sendEmail(
        0, // intakeId=0 for test emails
        input.emailType,
        {
          firstName: "Test",
          businessName: "Test Business",
          email: input.recipientEmail,
          previewUrl: "https://example.com/preview",
          liveUrl: "https://example.com",
          language: "en",
          audience: "biz",
          websiteStatus: "none",
        }
      );

      return {
        success: result.ok,
        provider: result.provider,
        error: result.error,
        warning: result.warning,
      };
    }),

  // Admin-only: Get email delivery stats for last 24h
  getEmailStats: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { recentEmails: [], stats: { sent: 0, failed: 0, topError: null } };

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Get last 50 emails
    const recentEmails = await db
      .select()
      .from(emailLogs)
      .where(gte(emailLogs.sentAt, oneDayAgo))
      .orderBy(desc(emailLogs.sentAt))
      .limit(50);

    // Calculate stats
    const sent = recentEmails.filter((e) => e.status === "sent").length;
    const failed = recentEmails.filter((e) => e.status === "failed").length;

    // Find most common error
    const errors = recentEmails
      .filter((e) => e.status === "failed" && e.errorMessage)
      .map((e) => e.errorMessage!);

    const errorCounts = errors.reduce((acc, err) => {
      acc[err] = (acc[err] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const topError = Object.entries(errorCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

    return {
      recentEmails: recentEmails.map((e) => ({
        id: e.id,
        emailType: e.emailType,
        recipientEmail: e.recipientEmail,
        status: e.status,
        deliveryProvider: e.deliveryProvider,
        errorMessage: e.errorMessage,
        sentAt: e.sentAt,
      })),
      stats: {
        sent,
        failed,
        topError,
      },
    };
  }),
});
