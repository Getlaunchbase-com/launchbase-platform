/**
import http from "node:http";
 * FOREVER CONTRACT: This test must remain boundary-real (signed webhook).
 * No mocks. Asserts only durable side effects.
 * 
 * Guarantees:
 * - Signed HTTP boundary test with real Stripe signature validation
 * - Atomic claim pattern prevents duplicate payment processing
 * - Idempotent email delivery (no duplicates on webhook replay)
 * - Webhook retry tracking (retryCount, idempotencyHit, ok status)
 */
import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import crypto from "crypto";
import { createApp } from "../_core/app";
import { getDb } from "../db";
import { eq, and } from "drizzle-orm";
import { intakes, payments, emailLogs, stripeWebhookEvents } from "../../drizzle/schema";

function signStripePayload(rawBody: string, secret: string, ts: number) {
  const signedPayload = `${ts}.${rawBody}`;
  const sig = crypto.createHmac("sha256", secret).update(signedPayload).digest("hex");
  return `t=${ts},v1=${sig}`;
}

describe.sequential("smoke: Stripe checkout.session.completed webhook (signed boundary + idempotent)", () => {
  let app: any;
  let db: any;
  let webhookSecret: string;

  beforeAll(async () => {
    app = createApp();
    db = await getDb();
    if (!db) throw new Error("db unavailable");

    webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) throw new Error("STRIPE_WEBHOOK_SECRET missing in test env");
  });

  it("processes once; replay increments retryCount but no duplicate side-effects", { timeout: 10000 }, async () => {
    // 1) Arrange: create intake row (Pattern A: insert + select by unique email)
    const uniqueEmail = `smoke+stripe-${crypto.randomUUID()}@launchbase-test.com`;

    await db.insert(intakes).values({
      email: uniqueEmail,
      businessName: 'Smoke Test Co',
      contactName: 'Test User',
      vertical: 'trades',
      status: 'approved',
    });

    // Read back the row to get the id
    const [intakeRow] = await db
      .select({ id: intakes.id })
      .from(intakes)
      .where(eq(intakes.email, uniqueEmail))
      .limit(1);

    if (!intakeRow) throw new Error("failed to create intake");
    const intakeId = intakeRow.id;

    const eventId = `evt_${crypto.randomUUID().replace(/-/g, "")}`;
    const sessionId = `cs_test_${crypto.randomUUID().replace(/-/g, "")}`;
    const paymentIntentId = `pi_${crypto.randomUUID().replace(/-/g, "")}`;
    const customerId = `cus_${crypto.randomUUID().replace(/-/g, "")}`;

    // IMPORTANT: metadata.intake_id must match handler expectation
    const event = {
      id: eventId,
      object: "event",
      api_version: "2023-10-16",
      created: Math.floor(Date.now() / 1000),
      type: "checkout.session.completed",
      data: {
        object: {
          id: sessionId,
          object: "checkout.session",
          payment_intent: paymentIntentId,
          customer: customerId,
          amount_total: 49900,
          metadata: {
            intake_id: String(intakeId),
            payment_type: "setup",
          },
        },
      },
      livemode: false,
    };

    const rawBody = JSON.stringify(event);
    const ts = Math.floor(Date.now() / 1000);
    const sig = signStripePayload(rawBody, webhookSecret, ts);



    // 2) Act #1 - First delivery
    const r1 = await request(server)
      .post("/api/stripe/webhook")
      .set("Stripe-Signature", sig)
      .set("Content-Type", "application/json")
      .send(rawBody);

    expect(r1.status).toBeLessThan(500);

    // 3) Assert #1 (durable side effects)
    const [updatedIntake] = await db
      .select()
      .from(intakes)
      .where(eq(intakes.id, intakeId))
      .limit(1);
    
    expect(updatedIntake?.status).toBe("paid");
    expect(updatedIntake?.stripeSessionId).toBe(sessionId);

    const paymentRows1 = await db
      .select({ id: payments.id })
      .from(payments)
      .where(
        and(
          eq(payments.intakeId, intakeId),
          eq(payments.stripePaymentIntentId, paymentIntentId)
        )
      );
    expect(paymentRows1.length).toBe(1);

    const emailRows1 = await db
      .select({ id: emailLogs.id, emailType: emailLogs.emailType, status: emailLogs.status })
      .from(emailLogs)
      .where(
        and(
          eq(emailLogs.intakeId, intakeId),
          eq(emailLogs.emailType, "deployment_started"),
          eq(emailLogs.status, "sent")
        )
      );
    expect(emailRows1.length).toBe(1);

    const [wh1] = await db
      .select()
      .from(stripeWebhookEvents)
      .where(eq(stripeWebhookEvents.eventId, eventId))
      .limit(1);
    
    expect(wh1?.eventType).toBe("checkout.session.completed");
    expect(wh1?.retryCount).toBe(0);
    expect(wh1?.idempotencyHit).toBe(false);
    expect(wh1?.ok).toBe(true);

    // 4) Act #2 - Replay (exact same event)
    const r2 = await request(server)
      .post("/api/stripe/webhook")
      .set("Stripe-Signature", sig)
      .set("Content-Type", "application/json")
      .send(rawBody);

    expect(r2.status).toBeLessThan(500);

    // 5) Assert #2 (no duplicates + retry tracked)
    const paymentRows2 = await db
      .select({ id: payments.id })
      .from(payments)
      .where(
        and(
          eq(payments.intakeId, intakeId),
          eq(payments.stripePaymentIntentId, paymentIntentId)
        )
      );
    expect(paymentRows2.length).toBe(1); // Still only 1 payment

    const emailRows2 = await db
      .select({ id: emailLogs.id })
      .from(emailLogs)
      .where(
        and(
          eq(emailLogs.intakeId, intakeId),
          eq(emailLogs.emailType, "deployment_started"),
          eq(emailLogs.status, "sent")
        )
      );
    expect(emailRows2.length).toBe(1); // Still only 1 email

    const [wh2] = await db
      .select()
      .from(stripeWebhookEvents)
      .where(eq(stripeWebhookEvents.eventId, eventId))
      .limit(1);
    
    expect(wh2?.retryCount).toBe(1); // Incremented
    expect(wh2?.idempotencyHit).toBe(true); // Now true
    expect(wh2?.ok).toBe(true); // Still successful
  });
});
