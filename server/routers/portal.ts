// server/routers/portal.ts
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getShipPacketByRunId, getIntakeById, decrementIntakeCredit } from "../db";
import { validateIntakeCredits } from "../db-helpers";
import { enqueueExecuteRunPlan } from "../jobs/runPlanQueue";

export const portalRouter = router({
  requestChanges: protectedProcedure
    .input(z.object({ runId: z.string() }))
    .mutation(async ({ input }) => {
      const ship = await getShipPacketByRunId(input.runId);
      if (!ship) throw new Error("ShipPacket not found");

      const intake = await getIntakeById(ship.intakeId);
      if (!intake) throw new Error("Intake not found");

      // CRITICAL: Validate credits invariants before any action
      validateIntakeCredits(intake);

      if ((intake.creditsRemaining ?? 0) <= 0) {
        return {
          ok: false,
          needsPurchase: true,
          message: "No revision credits remaining. Purchase more to continue.",
          checkoutUrl: null, // Phase 2: createStripeCreditCheckout(intake)
        };
      }

      await decrementIntakeCredit(intake.id, 1);
      enqueueExecuteRunPlan(input.runId);

      return { ok: true, enqueued: true };
    }),

  approve: protectedProcedure
    .input(z.object({ runId: z.string() }))
    .mutation(async ({ input }) => {
      const ship = await getShipPacketByRunId(input.runId);
      if (!ship) throw new Error("ShipPacket not found");

      const intake = await getIntakeById(ship.intakeId);
      if (!intake) throw new Error("Intake not found");

      // CRITICAL: Validate credits invariants before any action
      validateIntakeCredits(intake);

      // Approve consumes 0 credits
      // Just update status to APPROVED
      const { updateShipPacketStatus } = await import("../db");
      await updateShipPacketStatus(ship.id, "APPROVED");

      return { ok: true, approved: true };
    }),
});
