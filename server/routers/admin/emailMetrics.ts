/**
 * Admin Email Metrics Router
 * Provides operational metrics for email delivery performance
 */

import { z } from "zod";
import { protectedProcedure, router } from "../../_core/trpc";
import { getDb } from "../../db";
import { sql } from "drizzle-orm";

export type AdminEmailMetricsSummary = {
  windowDays: number;
  range: { from: string; to: string }; // ISO
  totals: {
    attempts: number;          // total rows in email_logs in window
    sent: number;              // status="sent"
    failed: number;            // status="failed"
    resendSent: number;        // sent + deliveryProvider="resend"
    notificationSent: number;  // sent + deliveryProvider="notification"
    idempotencyHits: number;   // sum(idempotencyHitCount)
    idempotencyHitEmails: number; // count(*) where idempotencyHitCount>0
  };
  rates: {
    successRatePct: number;    // sent / attempts * 100
    fallbackRatePct: number;   // notificationSent / sent * 100
    idempotencyHitRatePct: number; // idempotencyHitEmails / sent * 100
  };
  topFailureCodes: Array<{
    errorCode: string;
    count: number;
    lastSeenAt: string; // ISO
  }>;
  providerEvents: Array<{
    provider: string;      // "resend" for now
    eventType: string;     // delivered, bounced, complaint, etc
    count: number;
    lastOccurredAt: string; // ISO
  }>;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export const adminEmailMetricsRouter = router({
  getSummary: protectedProcedure
    .input(z.object({
      days: z.number().int().optional(),
      tenant: z.string().min(1).optional().nullable(),
    }).optional())
    .query(async ({ input }): Promise<AdminEmailMetricsSummary> => {
      const days = Math.min(Math.max(input?.days ?? 30, 1), 90); // Clamp to [1, 90]
      const tenant = input?.tenant ?? null;

      // Compute timestamps in JS to avoid MySQL INTERVAL parameter issues
      const to = new Date();
      const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);

      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Q1: Totals + success + provider breakdown
      const tenantFilter = tenant ? sql`AND tenant = ${tenant}` : sql``;
      const totalsResult = await db.execute(sql`
        SELECT
          COUNT(*) AS attempts,
          SUM(status='sent') AS sent,
          SUM(status='failed') AS failed,
          SUM(status='sent' AND deliveryProvider='resend') AS resendSent,
          SUM(status='sent' AND deliveryProvider='notification') AS notificationSent,
          COALESCE(SUM(idempotencyHitCount), 0) AS idempotencyHits,
          SUM(idempotencyHitCount > 0) AS idempotencyHitEmails
        FROM email_logs
        WHERE sentAt >= ${from} AND sentAt < ${to}
          ${tenantFilter}
      `);

      // Drizzle execute() returns [rows, metadata], so we need [0][0] to get the first row
      const totalsRow = (totalsResult as any)[0]?.[0] ?? {};

      // Q2: Top failure codes
      const topFailureCodesResult = await db.execute(sql`
        SELECT
          errorCode,
          COUNT(*) AS count,
          MAX(sentAt) AS lastSeenAt
        FROM email_logs
        WHERE sentAt >= ${from} AND sentAt < ${to}
          AND status='failed'
          AND errorCode IS NOT NULL
          ${tenantFilter}
        GROUP BY errorCode
        ORDER BY count DESC
        LIMIT 10
      `);

      // Q3: Provider events summary (works even before PR3)
      const providerEventsTenantFilter = tenant ? sql`AND l.tenant = ${tenant}` : sql``;
      const providerEventsResult = await db.execute(sql`
        SELECT
          e.provider,
          e.eventType      AS eventType,
          COUNT(*)         AS count,
          MAX(e.occurredAt) AS lastOccurredAt
        FROM email_provider_events e
        JOIN email_logs l
          ON l.id = e.emailLogId
        WHERE e.occurredAt >= ${from}
          AND e.occurredAt <  ${to}
          ${providerEventsTenantFilter}
        GROUP BY e.provider, e.eventType
        ORDER BY count DESC
        LIMIT 25
      `);

      const attempts = Number(totalsRow.attempts ?? 0);
      const sent = Number(totalsRow.sent ?? 0);
      const notificationSent = Number(totalsRow.notificationSent ?? 0);
      const idempotencyHitEmails = Number(totalsRow.idempotencyHitEmails ?? 0);

      const successRatePct = attempts ? (sent / attempts) * 100 : 0;
      const fallbackRatePct = sent ? (notificationSent / sent) * 100 : 0;
      const idempotencyHitRatePct = sent ? (idempotencyHitEmails / sent) * 100 : 0;

      return {
        windowDays: days,
        range: { from: from.toISOString(), to: to.toISOString() },
        totals: {
          attempts,
          sent,
          failed: Number(totalsRow.failed ?? 0),
          resendSent: Number(totalsRow.resendSent ?? 0),
          notificationSent,
          idempotencyHits: Number(totalsRow.idempotencyHits ?? 0),
          idempotencyHitEmails,
        },
        rates: {
          successRatePct: round2(successRatePct),
          fallbackRatePct: round2(fallbackRatePct),
          idempotencyHitRatePct: round2(idempotencyHitRatePct),
        },
        topFailureCodes: ((topFailureCodesResult as any)[0] ?? [])
          .filter((r: any) => r.lastSeenAt) // Skip rows with null timestamps
          .map((r: any) => ({
            errorCode: String(r.errorCode ?? ""),
            count: Number(r.count ?? 0),
            lastSeenAt: new Date(r.lastSeenAt).toISOString(),
          })),
        providerEvents: ((providerEventsResult as any)[0] ?? [])
          .filter((r: any) => r.lastOccurredAt) // Skip rows with null timestamps
          .map((r: any) => ({
            provider: String(r.provider ?? ""),
            eventType: String(r.eventType ?? ""),
            count: Number(r.count ?? 0),
            lastOccurredAt: new Date(r.lastOccurredAt).toISOString(),
          })),
      };
    }),
});
