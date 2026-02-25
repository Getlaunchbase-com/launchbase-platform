/**
 * Stripe webhook handling — requires STRIPE_WEBHOOK_SECRET env variable.
 * Webhook events are processed via Express middleware in server/stripe/.
 */

import { z } from "zod";
import { router, adminProcedure } from "../../_core/trpc";
import { getDb } from "../../db";
import { stripeWebhookEvents } from "../../db/schema";
import { desc, eq, and, count, sql } from "drizzle-orm";

export const adminStripeWebhooksRouter = router({
  /** List webhook events with optional eventType filter and pagination */
  listEvents: adminProcedure
    .input(
      z.object({
        eventType: z.string().optional(),
        limit: z.number().int().min(1).max(100).default(50),
        offset: z.number().int().min(0).default(0),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { events: [], total: 0 };

      const conditions: any[] = [];
      if (input.eventType) conditions.push(eq(stripeWebhookEvents.eventType, input.eventType));

      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const rows = await db
        .select()
        .from(stripeWebhookEvents)
        .where(where)
        .orderBy(desc(stripeWebhookEvents.receivedAt))
        .limit(input.limit)
        .offset(input.offset);

      const [countResult] = await db
        .select({ total: count() })
        .from(stripeWebhookEvents)
        .where(where);

      return { events: rows, total: countResult?.total ?? 0 };
    }),

  /** Get a single webhook event by ID */
  getById: adminProcedure
    .input(z.object({ id: z.number().int() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;

      const [row] = await db
        .select()
        .from(stripeWebhookEvents)
        .where(eq(stripeWebhookEvents.id, input.id))
        .limit(1);

      return row ?? null;
    }),

  /** Count by eventType, count of errors, idempotency hit rate */
  summary: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { countByEventType: [], errorCount: 0, idempotencyHitRate: 0 };

    // Count by eventType
    const eventTypeCounts = await db
      .select({
        eventType: stripeWebhookEvents.eventType,
        count: count(),
      })
      .from(stripeWebhookEvents)
      .groupBy(stripeWebhookEvents.eventType);

    // Count of errors (ok = false or error is not null)
    const [errorResult] = await db
      .select({
        errorCount: count(),
      })
      .from(stripeWebhookEvents)
      .where(sql`${stripeWebhookEvents.ok} = 0 OR ${stripeWebhookEvents.error} IS NOT NULL`);

    // Idempotency hit rate
    const [totalResult] = await db
      .select({
        total: count(),
      })
      .from(stripeWebhookEvents);

    const [idempotencyResult] = await db
      .select({
        hits: count(),
      })
      .from(stripeWebhookEvents)
      .where(eq(stripeWebhookEvents.idempotencyHit, true));

    const total = totalResult?.total ?? 0;
    const hits = idempotencyResult?.hits ?? 0;
    const idempotencyHitRate = total > 0 ? hits / total : 0;

    return {
      countByEventType: eventTypeCounts,
      errorCount: errorResult?.errorCount ?? 0,
      idempotencyHitRate,
    };
  }),
});
