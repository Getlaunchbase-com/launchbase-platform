/**
 * Email delivery metrics — requires Resend API integration.
 * Email events are tracked via webhook callbacks.
 */

import { z } from "zod";
import { router, adminProcedure } from "../../_core/trpc";
import { getDb } from "../../db";
import { emailLogs, emailProviderEvents } from "../../db/schema";
import { desc, eq, and, count, sql, gte } from "drizzle-orm";

export const adminEmailMetricsRouter = router({
  /** List email logs with optional filters and pagination */
  list: adminProcedure
    .input(
      z.object({
        emailType: z
          .enum([
            "intake_confirmation",
            "in_progress",
            "ready_for_review",
            "review_nudge",
            "launch_confirmation",
            "deployment_started",
            "site_live",
            "preview_followup",
            "testimonial_request",
            "founding_client_lockin",
            "founder_welcome",
            "day7_checkin",
            "day30_value",
            "contact_form_confirmation",
            "ops_alert",
          ])
          .optional(),
        status: z.enum(["sent", "failed", "opened", "clicked"]).optional(),
        recipientEmail: z.string().email().optional(),
        limit: z.number().int().min(1).max(100).default(50),
        offset: z.number().int().min(0).default(0),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { emails: [], total: 0 };

      const conditions: any[] = [];
      if (input.emailType) conditions.push(eq(emailLogs.emailType, input.emailType));
      if (input.status) conditions.push(eq(emailLogs.status, input.status));
      if (input.recipientEmail) conditions.push(eq(emailLogs.recipientEmail, input.recipientEmail));

      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const rows = await db
        .select()
        .from(emailLogs)
        .where(where)
        .orderBy(desc(emailLogs.sentAt))
        .limit(input.limit)
        .offset(input.offset);

      const [countResult] = await db
        .select({ total: count() })
        .from(emailLogs)
        .where(where);

      return { emails: rows, total: countResult?.total ?? 0 };
    }),

  /** Get a single email log by ID, including its provider events */
  getById: adminProcedure
    .input(z.object({ id: z.number().int() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;

      const [email] = await db
        .select()
        .from(emailLogs)
        .where(eq(emailLogs.id, input.id))
        .limit(1);

      if (!email) return null;

      const events = await db
        .select()
        .from(emailProviderEvents)
        .where(eq(emailProviderEvents.emailLogId, input.id))
        .orderBy(desc(emailProviderEvents.occurredAt));

      return { ...email, events };
    }),

  /** Aggregate stats: count by status and emailType */
  summary: adminProcedure
    .input(
      z.object({
        sinceDaysAgo: z.number().int().min(1).max(365).optional(),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { byStatus: [], byEmailType: [] };

      const conditions: any[] = [];
      if (input.sinceDaysAgo) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - input.sinceDaysAgo);
        conditions.push(gte(emailLogs.sentAt, cutoffDate));
      }

      const where = conditions.length > 0 ? and(...conditions) : undefined;

      // Count by status
      const byStatus = await db
        .select({
          status: emailLogs.status,
          count: count(),
        })
        .from(emailLogs)
        .where(where)
        .groupBy(emailLogs.status);

      // Count by emailType
      const byEmailType = await db
        .select({
          emailType: emailLogs.emailType,
          count: count(),
        })
        .from(emailLogs)
        .where(where)
        .groupBy(emailLogs.emailType);

      return { byStatus, byEmailType };
    }),

  /** List provider events for a given emailLogId */
  listProviderEvents: adminProcedure
    .input(z.object({ emailLogId: z.number().int() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { events: [] };

      const events = await db
        .select()
        .from(emailProviderEvents)
        .where(eq(emailProviderEvents.emailLogId, input.emailLogId))
        .orderBy(desc(emailProviderEvents.occurredAt));

      return { events };
    }),

  /** Calculate delivery success rate over the last N days */
  deliveryRate: adminProcedure
    .input(
      z.object({
        sinceDaysAgo: z.number().int().min(1).max(365).default(30),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db)
        return {
          total: 0,
          sent: 0,
          failed: 0,
          opened: 0,
          clicked: 0,
          deliveryRate: 0,
          openRate: 0,
        };

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - input.sinceDaysAgo);

      const stats = await db
        .select({
          status: emailLogs.status,
          count: count(),
        })
        .from(emailLogs)
        .where(gte(emailLogs.sentAt, cutoffDate))
        .groupBy(emailLogs.status);

      const statusMap: Record<string, number> = {};
      let total = 0;
      for (const row of stats) {
        statusMap[row.status] = row.count;
        total += row.count;
      }

      const sent = statusMap.sent ?? 0;
      const failed = statusMap.failed ?? 0;
      const opened = statusMap.opened ?? 0;
      const clicked = statusMap.clicked ?? 0;

      const deliveryRate = total > 0 ? ((sent + opened + clicked) / total) * 100 : 0;
      const openRate = total > 0 ? ((opened + clicked) / total) * 100 : 0;

      return {
        total,
        sent,
        failed,
        opened,
        clicked,
        deliveryRate: Math.round(deliveryRate * 100) / 100,
        openRate: Math.round(openRate * 100) / 100,
      };
    }),
});
