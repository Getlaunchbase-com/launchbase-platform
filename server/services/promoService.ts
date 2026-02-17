/**
 * Promo Service
 *
 * Handles promo code reservation and validation against the
 * promoCodes and promoRedemptions tables.
 */

import { getDb } from "../db";
import { promoCodes, promoRedemptions } from "../db/schema";
import { eq, and, count } from "drizzle-orm";

// ---------------------------------------------------------------------------
// reservePromo
// ---------------------------------------------------------------------------

export async function reservePromo(opts: {
  promoCode: string;
  intakeId: number;
}): Promise<{ success: boolean; error?: string; discount?: number }> {
  try {
    const db = await getDb();
    if (!db) {
      return { success: false, error: "Database not available" };
    }

    const { promoCode, intakeId } = opts;

    // 1. Look up the promo code
    const [code] = await db
      .select()
      .from(promoCodes)
      .where(eq(promoCodes.code, promoCode.toUpperCase()))
      .limit(1);

    if (!code) {
      return { success: false, error: "Invalid promo code" };
    }

    // 2. Check if code is active
    if (!code.active) {
      return { success: false, error: "This promo code is no longer active" };
    }

    // 3. Check if code has expired
    if (code.expiresAt && code.expiresAt < new Date()) {
      return { success: false, error: "This promo code has expired" };
    }

    // 4. Check redemption count against max
    const [redemptionCount] = await db
      .select({ count: count() })
      .from(promoRedemptions)
      .where(eq(promoRedemptions.promoCodeId, code.id));

    const currentRedemptions = Number(redemptionCount?.count ?? 0);

    if (currentRedemptions >= code.maxRedemptions) {
      return { success: false, error: "This promo code has reached its maximum redemptions" };
    }

    // 5. Check if this intake already used this code
    const [existingRedemption] = await db
      .select()
      .from(promoRedemptions)
      .where(
        and(
          eq(promoRedemptions.promoCodeId, code.id),
          eq(promoRedemptions.intakeId, intakeId),
        ),
      )
      .limit(1);

    if (existingRedemption) {
      return { success: false, error: "This promo code has already been applied to this order" };
    }

    // 6. Calculate the next founder number
    const founderNumber = currentRedemptions + 1;

    // 7. Reserve the promo code
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24-hour reservation

    await db.insert(promoRedemptions).values({
      promoCodeId: code.id,
      intakeId,
      status: "reserved",
      founderNumber,
      expiresAt,
    });

    console.log(
      `[promo] Reserved code "${promoCode}" for intake #${intakeId} (founder #${founderNumber})`,
    );

    return {
      success: true,
      discount: code.setupFeeAmount,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);

    // Handle duplicate key (race condition)
    if (errorMsg.includes("Duplicate") || errorMsg.includes("unique")) {
      return { success: false, error: "This promo code has already been applied" };
    }

    console.error("[promo] reservePromo error:", errorMsg);
    return { success: false, error: "Failed to apply promo code. Please try again." };
  }
}
