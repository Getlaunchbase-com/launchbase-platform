import { describe, it, expect } from "vitest";
import http from "node:http";
import request from "supertest";
import Stripe from "stripe";

import { createApp } from "../_core/app";
import { getDb } from "../db";
import { intelligenceLayers, stripeWebhookEvents } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

/**
 * Stripe invoice.paid Webhook Smoke Test
 * 
 * Proves:
 * 1. Subscription activation is idempotent (UPDATE is safe on retry)
 * 2. Webhook event logging tracks retries correctly
 */

function makeSignedStripePayload(event: any) {
  const payload = JSON.stringify(event);
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  expect(secret).toBeTruthy();

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_dummy", {
    apiVersion: "2023-10-16",
  });

  const signature = stripe.webhooks.generateTestHeaderString({
    payload,
    secret: secret!,
  });

  return { payload, signature };
}

describe("smoke: stripe invoice.paid webhook", () => {
  it("activates subscription and dedupes on eventId", async () => {
    const app = await createApp();
    const server = http.createServer(app);
    const db = await getDb();
    if (!db) throw new Error("DB not available");

    // Arrange: create intelligence_layers record
    const uniq = Date.now();
    const subscriptionId = `sub_test_${uniq}`;
    
    const [ret] = await db
      .insert(intelligenceLayers)
      .values({
        userId: 1,
        cadence: "medium",
        tuningMode: "auto",
        stripeSubscriptionId: subscriptionId,
        stripeCustomerId: `cus_test_${uniq}`,
        moduleStatus: "pending_activation",
      } as any);

    const layerId = (ret as any).insertId ?? (ret as any).id ?? ret;

    // Create invoice.paid event
    const periodEnd = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60; // 30 days from now
    const event = {
      id: `evt_${uniq}`,
      object: "event",
      api_version: "2023-10-16",
      created: Math.floor(Date.now() / 1000),
      livemode: false,
      pending_webhooks: 1,
      request: null,
      type: "invoice.paid",
      data: {
        object: {
          id: `in_test_${uniq}`,
          object: "invoice",
          subscription: subscriptionId,
          period_end: periodEnd,
          amount_paid: 2900,
          status: "paid",
        },
      },
    };

    const { payload, signature } = makeSignedStripePayload(event);

    // Act: send twice (same exact payload)
    const res1 = await request(server)
      .post("/api/stripe/webhook")
      .set("stripe-signature", signature)
      .type("application/json")
      .send(payload);

    const res2 = await request(server)
      .post("/api/stripe/webhook")
      .set("stripe-signature", signature)
      .type("application/json")
      .send(payload);

    // Assert: both accepted
    expect(res1.status).toBeGreaterThanOrEqual(200);
    expect(res1.status).toBeLessThan(300);
    expect(res2.status).toBeGreaterThanOrEqual(200);
    expect(res2.status).toBeLessThan(300);

    // Assert: subscription activated (idempotent UPDATE)
    const [layer] = await db
      .select()
      .from(intelligenceLayers)
      .where(eq(intelligenceLayers.id, layerId));
    
    expect(layer).toBeTruthy();
    expect(layer.moduleStatus).toBe("active");
    expect(layer.lastInvoiceStatus).toBe("paid");
    expect(layer.currentPeriodEnd).toBeTruthy();

    // Assert: webhook event logged with retry tracking
    const [webhookEvent] = await db
      .select()
      .from(stripeWebhookEvents)
      .where(eq(stripeWebhookEvents.eventId, event.id));
    
    expect(webhookEvent).toBeTruthy();
    expect(webhookEvent.eventType).toBe("invoice.paid");
    expect(webhookEvent.ok).toBe(true);
    expect(webhookEvent.idempotencyHit).toBe(true); // Second delivery sets this
    expect(webhookEvent.retryCount).toBe(1); // Incremented on duplicate
  });
});
