import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { marketingInboxItem } from "../../drizzle/schema";
import { and, desc, eq, like, or } from "drizzle-orm";
import { nanoid } from "nanoid";
import { getDb } from "../db";

const Status = z.enum(["new", "triaged", "queued", "running", "done", "archived"]);

export const marketingInboxRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        status: Status.optional(),
        q: z.string().min(1).optional(),
        limit: z.number().int().min(1).max(200).default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const whereParts: any[] = [];
      if (input.status) whereParts.push(eq(marketingInboxItem.status, input.status));

      if (input.q) {
        const q = `%${input.q}%`;
        whereParts.push(
          or(
            like(marketingInboxItem.title, q),
            like(marketingInboxItem.source, q),
            like(marketingInboxItem.url, q),
            like(marketingInboxItem.summary, q)
          )
        );
      }

      const where = whereParts.length ? and(...whereParts) : undefined;

      const rows = await db
        .select()
        .from(marketingInboxItem)
        .where(where)
        .orderBy(desc(marketingInboxItem.createdAt))
        .limit(input.limit);

      return { ok: true as const, rows };
    }),

  create: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1).max(512),
        url: z.string().url().optional(),
        source: z.string().min(1).max(64),
        sourceKey: z.string().max(256).optional(),
        summary: z.string().optional(),
        payload: z.record(z.string(), z.any()).default({}),
        priority: z.enum(["low", "normal", "high"]).default("normal"),
        score: z.number().int().min(0).max(1000).default(0),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const id = nanoid(16);

      await db.insert(marketingInboxItem).values({
        id,
        status: "new",
        priority: input.priority,
        score: input.score,
        title: input.title,
        url: input.url,
        source: input.source,
        sourceKey: input.sourceKey,
        summary: input.summary,
        payload: input.payload,
      });

      return { ok: true as const, id };
    }),

  setStatus: protectedProcedure
    .input(z.object({ id: z.string().min(1), status: Status }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      await db
        .update(marketingInboxItem)
        .set({ status: input.status })
        .where(eq(marketingInboxItem.id, input.id));
      return { ok: true as const };
    }),

  assign: protectedProcedure
    .input(z.object({ id: z.string().min(1), assignedTo: z.string().max(128).nullable() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      await db
        .update(marketingInboxItem)
        .set({ assignedTo: input.assignedTo ?? null })
        .where(eq(marketingInboxItem.id, input.id));
      return { ok: true as const };
    }),

  updateNotes: protectedProcedure
    .input(z.object({ id: z.string().min(1), notes: z.string().nullable() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      await db
        .update(marketingInboxItem)
        .set({ notes: input.notes ?? null })
        .where(eq(marketingInboxItem.id, input.id));
      return { ok: true as const };
    }),
});
