/**
 * Admin Email Smoke Test Router
 * 
 * Provides admin-only endpoint to test email delivery end-to-end.
 * Uses real production email path and leaves DB trail for auditing.
 */

import { z } from "zod";
import { protectedProcedure, router } from "../../_core/trpc";
import { assertAdminEmail } from "../../utils/admin";
import { getUserEmailFromCtx } from "../../utils/getUserEmailFromCtx";
import { getDb } from "../../db";
import { intakes } from "../../../drizzle/schema";
import { sendEmail } from "../../email";
import { eq, desc } from "drizzle-orm";

export const adminEmailSmokeRouter = router({
  send: protectedProcedure
    .input(
      z.object({
        recipients: z.array(z.string().email()).min(1).max(10),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Layer 1: must be logged in (protectedProcedure)
      const email = getUserEmailFromCtx(ctx);
      // Layer 2: must be admin
      assertAdminEmail(email);

      const db = await getDb();
      if (!db) {
        throw new Error("Database unavailable");
      }

      const results: Array<{ recipient: string; ok: boolean; intakeId?: number }> = [];

      for (const recipient of input.recipients) {
        try {
          // Create minimal intake row (satisfies NOT NULL constraints)
          await db.insert(intakes).values({
            email: recipient,
            businessName: "Email Smoke Test Co",
            contactName: "Smoke Test",
            vertical: "trades",
            status: "new",
          });

          // Query back the intake ID (deterministic, no driver variance)
          const [row] = await db
            .select({ id: intakes.id })
            .from(intakes)
            .where(eq(intakes.email, recipient))
            .orderBy(desc(intakes.createdAt))
            .limit(1);

          if (!row?.id) {
            results.push({ recipient, ok: false });
            continue;
          }

          const intakeId = row.id;

          // Send email using real production path
          const ok = await sendEmail(intakeId, "intake_confirmation", {
            firstName: "Smoke Test",
            businessName: "Email Smoke Test Co",
            email: recipient,
          });

          results.push({ recipient, ok: !!ok, intakeId });
        } catch (err) {
          results.push({ recipient, ok: false });
        }
      }

      return { results };
    }),
});
