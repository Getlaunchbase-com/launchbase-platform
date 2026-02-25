/**
 * Action request procedures — populated when agent-stack action request pipeline is connected.
 */

import { z } from "zod";
import { router, adminProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { actionRequests, actionRequestEvents } from "../db/schema";
import { desc, eq, and, count, sql } from "drizzle-orm";

export const actionRequestsRouter = router({
  /** List action requests with optional status filter and pagination */
  list: adminProcedure
    .input(
      z.object({
        status: z.enum([
          "pending",
          "sent",
          "responded",
          "applied",
          "confirmed",
          "locked",
          "expired",
          "needs_human"
        ]).optional(),
        limit: z.number().int().min(1).max(100).default(50),
        offset: z.number().int().min(0).default(0),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { requests: [], total: 0 };

      const conditions: any[] = [];
      if (input.status) conditions.push(eq(actionRequests.status, input.status));

      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const rows = await db
        .select()
        .from(actionRequests)
        .where(where)
        .orderBy(desc(actionRequests.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      const [countResult] = await db
        .select({ total: count() })
        .from(actionRequests)
        .where(where);

      return { requests: rows, total: countResult?.total ?? 0 };
    }),

  /** Get a single action request by ID with its events */
  getById: adminProcedure
    .input(z.object({ id: z.number().int() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;

      const [request] = await db
        .select()
        .from(actionRequests)
        .where(eq(actionRequests.id, input.id))
        .limit(1);

      if (!request) return null;

      const events = await db
        .select()
        .from(actionRequestEvents)
        .where(eq(actionRequestEvents.actionRequestId, input.id))
        .orderBy(desc(actionRequestEvents.createdAt));

      return { ...request, events };
    }),

  /** Update status of an action request and add an event record */
  updateStatus: adminProcedure
    .input(
      z.object({
        id: z.number().int(),
        status: z.enum([
          "pending",
          "sent",
          "responded",
          "applied",
          "confirmed",
          "locked",
          "expired",
          "needs_human"
        ]),
        eventType: z.enum([
          "SENT",
          "CUSTOMER_APPROVED",
          "CUSTOMER_EDITED",
          "CUSTOMER_UNCLEAR",
          "APPLIED",
          "LOCKED",
          "EXPIRED",
          "RESENT",
          "ADMIN_APPLY",
          "ADMIN_UNLOCK",
          "ADMIN_EXPIRE",
          "ESCALATED",
          "SEND_FAILED",
          "PREVIEW_VIEWED",
          "PROPOSED_PREVIEW_RENDER_FAILED",
          "AI_PROPOSE_COPY",
        ]),
        reason: z.string().optional(),
        actorId: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      // Get the action request to get intakeId
      const [request] = await db
        .select({ intakeId: actionRequests.intakeId })
        .from(actionRequests)
        .where(eq(actionRequests.id, input.id))
        .limit(1);

      if (!request) throw new Error("Action request not found");

      // Update the status
      await db
        .update(actionRequests)
        .set({ status: input.status })
        .where(eq(actionRequests.id, input.id));

      // Add an event record
      await db.insert(actionRequestEvents).values({
        actionRequestId: input.id,
        intakeId: request.intakeId,
        eventType: input.eventType,
        actorType: "admin",
        actorId: input.actorId ?? ((ctx as any).user?.id?.toString() ?? "unknown"),
        reason: input.reason ?? null,
        meta: null,
      });

      return { success: true, id: input.id, status: input.status };
    }),

  /** List events for a given actionRequestId, ordered by createdAt desc */
  listEvents: adminProcedure
    .input(z.object({ actionRequestId: z.number().int() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { events: [] };

      const events = await db
        .select()
        .from(actionRequestEvents)
        .where(eq(actionRequestEvents.actionRequestId, input.actionRequestId))
        .orderBy(desc(actionRequestEvents.createdAt));

      return { events };
    }),

  /** Count of requests by status */
  summary: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { byStatus: {} };

    const results = await db
      .select({
        status: actionRequests.status,
        count: count(),
      })
      .from(actionRequests)
      .groupBy(actionRequests.status);

    const byStatus: Record<string, number> = {};
    for (const row of results) {
      byStatus[row.status] = row.count;
    }

    return { byStatus };
  }),
});
