import { getDb } from "../db";
import { promoCodes, promoRedemptions } from "../../drizzle/schema";
import { eq, and, sql } from "drizzle-orm";

export async function reservePromo(params: {
  promoCode: string;
  intakeId: number;
}): Promise<{ success: true; redemptionId: number } | { success: false; error: string }> {
  const db = await getDb();
  if (!db) return { success: false, error: "Database not available" };

  const [promo] = await db
    .select()
    .from(promoCodes)
    .where(eq(promoCodes.code, params.promoCode))
    .limit(1);

  if (!promo) return { success: false, error: "Invalid promo code" };
  if (!promo.active) return { success: false, error: "Promo code is no longer active" };
  if (promo.expiresAt && new Date(promo.expiresAt) < new Date()) {
    return { success: false, error: "Promo code has expired" };
  }

  const redeemedCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(promoRedemptions)
    .where(
      and(
        eq(promoRedemptions.promoCodeId, promo.id),
        eq(promoRedemptions.status, "redeemed")
      )
    );

  const redeemed = Number(redeemedCount[0]?.count ?? 0);
  if (redeemed >= promo.maxRedemptions) {
    return { success: false, error: "All promo slots have been claimed" };
  }

  const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

  const result = await db.insert(promoRedemptions).values({
    promoCodeId: promo.id,
    intakeId: params.intakeId,
    status: "reserved",
    expiresAt,
  });

  const redemptionId = (result as any).insertId ?? (result as any)[0]?.insertId;

  return { success: true, redemptionId };
}

export async function redeemPromo(params: {
  intakeId: number;
  stripeCustomerId: string;
  stripeCheckoutSessionId: string;
}): Promise<
  | { success: true; founderNumber: number | null; promoCode: string }
  | { success: false; error: string }
> {
  const db = await getDb();
  if (!db) return { success: false, error: "Database not available" };

  const [redemption] = await db
    .select()
    .from(promoRedemptions)
    .where(
      and(
        eq(promoRedemptions.intakeId, params.intakeId),
        eq(promoRedemptions.status, "reserved")
      )
    )
    .limit(1);

  if (!redemption) {
    return { success: false, error: "No promo reservation found" };
  }

  if (new Date(redemption.expiresAt) < new Date()) {
    await db
      .update(promoRedemptions)
      .set({ status: "expired" })
      .where(eq(promoRedemptions.id, redemption.id));
    return { success: false, error: "Promo reservation expired" };
  }

  const [promo] = await db
    .select()
    .from(promoCodes)
    .where(eq(promoCodes.id, redemption.promoCodeId))
    .limit(1);

  if (!promo) return { success: false, error: "Promo code not found" };

  let founderNumber: number | null = null;

  if (promo.code === "BETA-FOUNDERS") {
    for (let num = 1; num <= 10; num++) {
      const claim = await db
        .update(promoRedemptions)
        .set({
          status: "redeemed",
          founderNumber: num,
          stripeCustomerId: params.stripeCustomerId,
          stripeCheckoutSessionId: params.stripeCheckoutSessionId,
          redeemedAt: new Date(),
        })
        .where(
          and(
            eq(promoRedemptions.id, redemption.id),
            eq(promoRedemptions.status, "reserved")
          )
        );

      const affected = (claim as any)?.affectedRows ?? (claim as any)?.[0]?.affectedRows ?? 0;

      if (affected > 0) {
        const checkUnique = await db
          .select()
          .from(promoRedemptions)
          .where(
            and(
              eq(promoRedemptions.promoCodeId, promo.id),
              eq(promoRedemptions.founderNumber, num)
            )
          );

        if (checkUnique.length === 1) {
          founderNumber = num;
          break;
        }
      }
    }

    if (!founderNumber) {
      return { success: false, error: "All founder slots claimed" };
    }
  } else {
    await db
      .update(promoRedemptions)
      .set({
        status: "redeemed",
        stripeCustomerId: params.stripeCustomerId,
        stripeCheckoutSessionId: params.stripeCheckoutSessionId,
        redeemedAt: new Date(),
      })
      .where(eq(promoRedemptions.id, redemption.id));
  }

  return { success: true, founderNumber, promoCode: promo.code };
}

export async function getRedemptionForIntake(intakeId: number) {
  const db = await getDb();
  if (!db) return null;

  const [redemption] = await db
    .select()
    .from(promoRedemptions)
    .where(eq(promoRedemptions.intakeId, intakeId))
    .limit(1);

  return redemption ?? null;
}
