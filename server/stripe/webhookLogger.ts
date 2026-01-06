import type Stripe from "stripe";
import { getDb } from "../db";
import { sql } from "drizzle-orm";

/**
 * Log webhook receipt immediately after signature verification
 * Uses upsert to handle duplicate deliveries safely
 * 
 * IMPORTANT: This is the ONLY place retryCount increments.
 * finalizeStripeWebhookEvent must NEVER increment retryCount.
 */
export async function logStripeWebhookReceived(
  event: Stripe.Event,
  meta?: Record<string, unknown>
): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.error("[Webhook Logger] Database not available");
    return;
  }

  try {
    // Use parameterized query to prevent SQL injection
    await db.execute(sql`
      INSERT INTO stripe_webhook_events 
        (eventId, eventType, created, receivedAt, ok, error, intakeId, userId, idempotencyHit, retryCount, meta)
      VALUES (
        ${event.id}, 
        ${event.type}, 
        ${event.created}, 
        NOW(), 
        NULL, 
        NULL, 
        NULL, 
        NULL, 
        FALSE, 
        0, 
        ${meta ?? null}
      )
      ON DUPLICATE KEY UPDATE 
        retryCount = retryCount + 1,
        idempotencyHit = TRUE,
        receivedAt = NOW()
    `);
  } catch (err) {
    // Never let logging break webhook processing
    console.error("[Webhook Logger] Failed to log event receipt:", err);
  }
}

/**
 * Update webhook event with final processing status
 * Called in finally block after handler completes
 */
export async function finalizeStripeWebhookEvent(
  eventId: string,
  fields: {
    ok: boolean;
    error?: string | null;
    intakeId?: number | null;
    userId?: number | null;
  }
): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.error("[Webhook Logger] Database not available");
    return;
  }

  try {
    // Use parameterized query to prevent SQL injection
    await db.execute(sql`
      UPDATE stripe_webhook_events 
      SET 
        ok = ${fields.ok},
        error = ${fields.error ?? null},
        intakeId = ${fields.intakeId ?? null},
        userId = ${fields.userId ?? null}
      WHERE eventId = ${eventId}
    `);
  } catch (err) {
    // Never let logging break webhook response
    console.error("[Webhook Logger] Failed to finalize event status:", err);
  }
}
