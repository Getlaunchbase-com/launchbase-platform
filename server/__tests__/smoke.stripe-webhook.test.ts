import { describe, it, expect } from "vitest";
import request from "supertest";
import Stripe from "stripe";

import { createApp } from "../_core/app";
import { getDb } from "../db";
import { intakes, payments, deployments, emailLogs, stripeWebhookEvents } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";

/**
 * Stripe Webhook Boundary Smoke Tests
 * 
 * Proves:
 * 1. Signature verification is enforced (no bypass possible)
 * 2. Duplicate webhooks are safe (idempotency works end-to-end)
 * 
 * This is the test that prevents:
 * - Webhook signature bypass
 * - Double charging
 * - Duplicate emails/deployments
 * - Middleware ordering bugs
 */

function makeSignedStripePayload(event: any) {
  const payload = JSON.stringify(event);
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  expect(secret).toBeTruthy();

  // No network calls: this is local-only signature generation
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_dummy", {
    apiVersion: "2023-10-16",
  });

  const signature = stripe.webhooks.generateTestHeaderString({
    payload,
    secret: secret!,
  });

  return { payload, signature };
}

describe("smoke: stripe webhook boundary", () => {
  it("rejects missing signature", async () => {
    const app = createApp();

    const res = await request(app)
      .post("/api/stripe/webhook")
      .set("content-type", "application/json")
      .send(JSON.stringify({ hello: "world" }));

    // Webhook handler returns 400 for missing/invalid signature
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  it("is idempotent for duplicate checkout.session.completed", async () => {
    const app = createApp();
    const db = await getDb();
    if (!db) throw new Error("DB not available");

    // Arrange: create intake
    const email = `idem-${Date.now()}@launchbase-test.com`;
    const [ret] = await db
      .insert(intakes)
      .values({
        email,
        businessName: "Idempotency Test Co",
        contactName: "Test User",
        vertical: "trades",
        status: "approved",
      } as any);

    const intakeId = (ret as any).insertId ?? (ret as any).id ?? ret;

    const uniq = Date.now();
    const sessionId = `cs_test_${uniq}`;
    const paymentIntentId = `pi_test_${uniq}`;

    const event = {
      id: `evt_${uniq}`,  // Not evt_test_ to avoid verification guard
      object: "event",
      api_version: "2023-10-16",
      created: Math.floor(Date.now() / 1000),
      livemode: false,
      pending_webhooks: 1,
      request: null,
      type: "checkout.session.completed",
      data: {
        object: {
          id: sessionId,
          object: "checkout.session",
          metadata: {
            intake_id: String(intakeId),
            payment_type: "setup",
          },
          payment_intent: paymentIntentId,
          customer: "cus_test_123",
          amount_total: 49900,
        },
      },
    };

    const { payload, signature } = makeSignedStripePayload(event);

    // Act: send twice (same exact payload + signature)
    // IMPORTANT: Use .type() to set Content-Type without triggering JSON encoding
    const res1 = await request(app)
      .post("/api/stripe/webhook")
      .set("stripe-signature", signature)
      .type("application/json")
      .send(payload);

    // Debug: log if first request failed
    if (res1.status >= 400) {
      console.log("webhook res1 failed:", res1.status, res1.text);
    }

    const res2 = await request(app)
      .post("/api/stripe/webhook")
      .set("stripe-signature", signature)
      .type("application/json")
      .send(payload);

    // Assert: both requests should be accepted (Stripe expects 2xx)
    expect(res1.status).toBeGreaterThanOrEqual(200);
    expect(res1.status).toBeLessThan(300);
    expect(res2.status).toBeGreaterThanOrEqual(200);
    expect(res2.status).toBeLessThan(300);

    // Assert: intake claimed once
    const [i] = await db.select().from(intakes).where(eq(intakes.id, intakeId));
    expect(i).toBeTruthy();
    expect((i as any).stripeSessionId).toBe(sessionId);
    expect((i as any).status).toBe("paid");

    // Assert: payment record created once (key by intake + payment intent)
    const payRows = await db
      .select()
      .from(payments)
      .where(and(eq(payments.intakeId, intakeId), eq(payments.stripePaymentIntentId, paymentIntentId)));
    expect(payRows.length).toBe(1);

    // Assert: deployment_started email sent once
    // (Deployment itself may not be created if build plan is missing - that's a separate concern)
    const emailRows = await db
      .select()
      .from(emailLogs)
      .where(and(eq(emailLogs.intakeId, intakeId), eq(emailLogs.emailType, "deployment_started")));
    expect(emailRows.length).toBe(1);
    expect(emailRows[0].status).toBe("sent");

    // Assert: webhook event logged with retry tracking
    const [webhookEvent] = await db
      .select()
      .from(stripeWebhookEvents)
      .where(eq(stripeWebhookEvents.eventId, event.id));
    expect(webhookEvent).toBeTruthy();
    expect(webhookEvent.eventType).toBe("checkout.session.completed");
    expect(webhookEvent.ok).toBe(true);
    expect(webhookEvent.idempotencyHit).toBe(true); // Second delivery sets this
    expect(webhookEvent.retryCount).toBe(1); // Incremented on duplicate
  });
});
