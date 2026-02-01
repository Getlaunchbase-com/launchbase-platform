/**
 * Marketing Signals tRPC Router
 * Drop-in fix with all required endpoints
 */

import { z } from "zod";
import { router, adminProcedure } from "../../_core/trpc";
import { marketingSignals } from "../../../drizzle/schema";
import { getDb } from "../../db";
import { desc, eq, and, gte, lte, like, or } from "drizzle-orm";
import { seedTestDelawareLLCs } from "../../ingestors/llc/de_test_seeder";
import { ingestDelawareHybrid } from "../../ingestors/llc/de_scrape";

const SIGNAL_STATUS = z.enum(["new", "triaged", "qualified", "rejected", "converted"]);
type SignalStatus = z.infer<typeof SIGNAL_STATUS>;

export const marketingSignalsRouter = router({
  // ✅ Required: list
  list: adminProcedure
    .input(
      z.object({
        status: SIGNAL_STATUS.optional(),
        sourceType: z.string().optional(),
        jurisdiction: z.string().optional(),
        minScore: z.number().int().min(0).max(100).optional(),
        maxScore: z.number().int().min(0).max(100).optional(),
        search: z.string().optional(),
        limit: z.number().int().min(1).max(200).default(50),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const whereParts = [];

      if (input.status) whereParts.push(eq(marketingSignals.status, input.status));
      if (input.sourceType) whereParts.push(eq(marketingSignals.sourceType, input.sourceType));
      if (input.jurisdiction) whereParts.push(eq(marketingSignals.jurisdiction, input.jurisdiction));
      if (typeof input.minScore === "number") whereParts.push(gte(marketingSignals.score, input.minScore));
      if (typeof input.maxScore === "number") whereParts.push(lte(marketingSignals.score, input.maxScore));

      const q = input.search?.trim();
      if (q) {
        const pat = `%${q}%`;
        whereParts.push(
          or(
            like(marketingSignals.entityName, pat),
            like(marketingSignals.jurisdiction, pat),
            like(marketingSignals.sourceType, pat),
            like(marketingSignals.notes, pat)
          )
        );
      }

      const where = whereParts.length ? and(...whereParts) : undefined;

      const rows = await db
        .select()
        .from(marketingSignals)
        .where(where)
        .orderBy(desc(marketingSignals.eventDate), desc(marketingSignals.createdAt))
        .limit(input.limit);

      return { ok: true as const, rows };
    }),

  // ✅ Required: setStatus
  setStatus: adminProcedure
    .input(
      z.object({
        id: z.string().min(1),
        status: SIGNAL_STATUS,
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db
        .update(marketingSignals)
        .set({ status: input.status satisfies SignalStatus })
        .where(eq(marketingSignals.id, input.id));
      return { ok: true as const };
    }),

  // ✅ Required: addNote (append to existing notes)
  addNote: adminProcedure
    .input(
      z.object({
        id: z.string().min(1),
        note: z.string().trim().min(1).max(8000),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const existing = await db
        .select({ notes: marketingSignals.notes })
        .from(marketingSignals)
        .where(eq(marketingSignals.id, input.id))
        .limit(1);

      const prev = existing[0]?.notes ?? "";
      const next = prev ? `${prev}\n\n${input.note}` : input.note;

      await db
        .update(marketingSignals)
        .set({ notes: next })
        .where(eq(marketingSignals.id, input.id));

      return { ok: true as const };
    }),

  // ✅ Required: seed (calls your seeder)
  seed: adminProcedure
    .input(
      z.object({
        count: z.number().int().min(1).max(200).default(10),
      })
    )
    .mutation(async ({ input }) => {
      const result = await seedTestDelawareLLCs(input.count);
      return { ok: true as const, ...result };
    }),

  // Optional: assignment (handy)
  assign: adminProcedure
    .input(
      z.object({
        id: z.string().min(1),
        assignedTo: z.string().trim().min(1).max(128).nullable(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db
        .update(marketingSignals)
        .set({ assignedTo: input.assignedTo ?? null })
        .where(eq(marketingSignals.id, input.id));
      return { ok: true as const };
    }),

  // Optional: fire-and-forget ingest trigger (UI triggers jobs, doesn't wait)
  ingestDelawareLLCs: adminProcedure
    .input(z.object({ dryRun: z.boolean().optional() }).default({}))
    .mutation(async ({ input }) => {
      // don't block UI / request lifecycle
      setImmediate(() => {
        Promise.resolve()
          .then(() => ingestDelawareHybrid({ limit: 100 }))
          .catch((err) => {
            console.error("[marketingSignals.ingestDelawareLLCs] failed:", err);
          });
      });

      return { ok: true as const, started: true as const };
    }),
});
