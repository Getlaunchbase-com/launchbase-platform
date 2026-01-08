import { z } from "zod";
import { sql } from "drizzle-orm";
import { protectedProcedure, router } from "../../_core/trpc";
import { getDb } from "../../db";
import { assertAdminEmail } from "../../utils/admin";
import { getUserEmailFromCtx } from "../../utils/getUserEmailFromCtx";

// Type normalization helpers for MySQL driver variance
function toBool(v: unknown): boolean | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v === 1;
  if (typeof v === "string") return v === "1" || v.toLowerCase() === "true";
  return null;
}

function toNum(v: unknown): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return v;
  if (typeof v === "string") return Number(v) || 0;
  return 0;
}

function toIso(v: unknown): string | null {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "string") return new Date(v).toISOString();
  return null;
}

export const adminStripeWebhooksRouter = router({
  rollup: protectedProcedure
    .input(
      z.object({
        sinceHours: z.number().int().min(1).max(24 * 30).default(24),
      })
    )
    .query(async ({ ctx, input }) => {
      const email = getUserEmailFromCtx(ctx);
      assertAdminEmail(email);

      const db = await getDb();
      if (!db) throw new Error("db_unavailable");

      const since = new Date(Date.now() - input.sinceHours * 60 * 60 * 1000);

      // 24h rollup + lastEventAt
      const rows = await db.execute(sql`
        SELECT
          COUNT(*) AS total,
          SUM(CASE WHEN ok = 1 THEN 1 ELSE 0 END) AS okCount,
          SUM(CASE WHEN ok = 0 THEN 1 ELSE 0 END) AS failCount,
          SUM(CASE WHEN ok IS NULL THEN 1 ELSE 0 END) AS pendingCount,
          SUM(CASE WHEN retryCount > 0 THEN 1 ELSE 0 END) AS retryEvents,
          SUM(CASE WHEN retryCount > 0 THEN retryCount ELSE 0 END) AS totalRetries,
          MAX(receivedAt) AS lastEventAt
        FROM stripe_webhook_events
        WHERE receivedAt >= ${since}
      `);

      const roll = (rows as any)?.[0]?.[0] ?? (rows as any)?.[0] ?? null;

      // Top event types
      const topTypesRows = await db.execute(sql`
        SELECT eventType, COUNT(*) AS n
        FROM stripe_webhook_events
        WHERE receivedAt >= ${since}
        GROUP BY eventType
        ORDER BY n DESC
        LIMIT 12
      `);

      const topTypesRaw = (topTypesRows as any)?.[0] ?? topTypesRows;
      const topTypes = (topTypesRaw || []).map((r: any) => ({
        eventType: r.eventType,
        count: toNum(r.n),
      }));

      return {
        sinceHours: input.sinceHours,
        total: toNum(roll?.total),
        ok: toNum(roll?.okCount),
        failed: toNum(roll?.failCount),
        pending: toNum(roll?.pendingCount),
        retryEvents: toNum(roll?.retryEvents),
        totalRetries: toNum(roll?.totalRetries),
        lastEventAt: toIso(roll?.lastEventAt),
        isStale: roll?.lastEventAt
          ? Date.now() - new Date(roll.lastEventAt).getTime() > 6 * 60 * 60 * 1000
          : true,
        topTypes,
      };
    }),

  list: protectedProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(500).default(100),
        sinceHours: z.number().int().min(1).max(24 * 30).default(24),
        status: z.enum(["all", "ok", "failed", "pending"]).default("all"),
        eventType: z.string().trim().min(1).max(64).optional(),
        retriesOnly: z.boolean().default(false),
      })
    )
    .query(async ({ ctx, input }) => {
      const email = getUserEmailFromCtx(ctx);
      assertAdminEmail(email);

      const db = await getDb();
      if (!db) throw new Error("db_unavailable");

      const since = new Date(Date.now() - input.sinceHours * 60 * 60 * 1000);

      // Build WHERE conditions safely with SQL templates
      const whereParts: any[] = [sql`receivedAt >= ${since}`];

      if (input.status === "ok") whereParts.push(sql`ok = 1`);
      if (input.status === "failed") whereParts.push(sql`ok = 0`);
      if (input.status === "pending") whereParts.push(sql`ok IS NULL`);

      if (input.eventType) whereParts.push(sql`eventType = ${input.eventType}`);
      if (input.retriesOnly) whereParts.push(sql`retryCount > 0`);

      // Join where with AND
      const whereSql =
        whereParts.length === 1
          ? whereParts[0]
          : whereParts.reduce((acc, p) => (acc ? sql`${acc} AND ${p}` : p));

      const rows = await db.execute(sql`
        SELECT
          eventId,
          eventType,
          created,
          receivedAt,
          ok,
          error,
          intakeId,
          userId,
          idempotencyHit,
          retryCount,
          meta
        FROM stripe_webhook_events
        WHERE ${whereSql}
        ORDER BY receivedAt DESC
        LIMIT ${input.limit}
      `);

      const raw = (rows as any)?.[0] ?? rows;

      const events = (raw || []).map((r: any) => ({
        eventId: r.eventId,
        eventType: r.eventType,
        created: toNum(r.created), // unix seconds
        receivedAt: toIso(r.receivedAt),
        ok: toBool(r.ok),
        error: r.error ?? null,
        intakeId: r.intakeId ?? null,
        userId: r.userId ?? null,
        idempotencyHit: toBool(r.idempotencyHit) === true,
        retryCount: toNum(r.retryCount),
        meta: r.meta ?? null,
      }));

      return {
        limit: input.limit,
        sinceHours: input.sinceHours,
        status: input.status,
        eventType: input.eventType ?? null,
        retriesOnly: input.retriesOnly,
        events,
      };
    }),
});
