import { Request, Response } from "express";
import Stripe from "stripe";
import { constructWebhookEvent } from "./checkout";
import { getDb } from "../db";
import { intakes, payments, intelligenceLayers } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { sendEmail } from "../email";
import { Cadence, LayerKey } from "./intelligenceCheckout";

/**
 * Handle Stripe webhook events
 * Route: POST /api/stripe/webhook
 */
export async function handleStripeWebhook(req: Request, res: Response) {
  const signature = req.headers["stripe-signature"] as string;
  
  if (!signature) {
    console.error("[Stripe Webhook] Missing stripe-signature header");
    return res.status(400).json({ error: "Missing signature" });
  }

  let event: Stripe.Event;
  
  try {
    event = constructWebhookEvent(req.body, signature);
  } catch (err) {
    console.error("[Stripe Webhook] Signature verification failed:", err);
    return res.status(400).json({ error: "Invalid signature" });
  }

  // Handle test events for webhook verification
  if (event.id.startsWith("evt_test_")) {
    console.log("[Stripe Webhook] Test event detected, returning verification response");
    return res.json({ verified: true });
  }

  console.log(`[Stripe Webhook] Received event: ${event.type} (${event.id})`);

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        
        // Check if this is a Social Media Intelligence checkout
        if (session.metadata?.module === "social_media_intelligence") {
          await handleIntelligenceCheckoutCompleted(session);
        } else {
          await handleCheckoutCompleted(session);
        }
        break;
      }
      
      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaid(invoice);
        break;
      }
      
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaymentFailed(invoice);
        break;
      }
      
      case "customer.subscription.updated":
      case "customer.subscription.created": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpsert(subscription);
        break;
      }
      
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(subscription);
        break;
      }
      
      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.log(`[Stripe Webhook] Payment succeeded: ${paymentIntent.id}`);
        break;
      }
      
      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.log(`[Stripe Webhook] Payment failed: ${paymentIntent.id}`);
        break;
      }
      
      default:
        console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (err) {
    console.error("[Stripe Webhook] Error processing event:", err);
    res.status(500).json({ error: "Webhook handler failed" });
  }
}

/**
 * Handle Social Media Intelligence checkout completed
 */
async function handleIntelligenceCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.user_id;
  const cadence = session.metadata?.cadence as Cadence;
  const layersJson = session.metadata?.layers || "[]";
  const isFounder = session.metadata?.founder_eligible === "true";
  
  if (!userId) {
    console.error("[Stripe Webhook] Missing user_id in SMI session metadata");
    return;
  }

  const db = await getDb();
  if (!db) {
    console.error("[Stripe Webhook] Database not available");
    return;
  }

  // Parse layers
  let layers: LayerKey[] = [];
  try {
    layers = JSON.parse(layersJson);
  } catch {
    layers = [];
  }

  // Check if user already has an intelligence_layers record
  const [existing] = await db
    .select()
    .from(intelligenceLayers)
    .where(eq(intelligenceLayers.userId, parseInt(userId, 10)));

  const subscriptionId = typeof session.subscription === "string" 
    ? session.subscription 
    : null;

  if (existing) {
    // Update existing record
    await db
      .update(intelligenceLayers)
      .set({
        cadence,
        weatherEnabled: true, // Always enabled
        sportsEnabled: layers.includes("sports"),
        communityEnabled: layers.includes("community"),
        trendsEnabled: layers.includes("trends"),
        stripeSubscriptionId: subscriptionId,
        stripeCustomerId: session.customer as string | null,
        moduleStatus: "pending_activation", // Will be activated on invoice.paid
        isFounder,
        updatedAt: new Date(),
      })
      .where(eq(intelligenceLayers.userId, parseInt(userId, 10)));
  } else {
    // Create new record
    await db.insert(intelligenceLayers).values({
      userId: parseInt(userId, 10),
      cadence,
      tuningMode: "auto",
      weatherEnabled: true,
      sportsEnabled: layers.includes("sports"),
      communityEnabled: layers.includes("community"),
      trendsEnabled: layers.includes("trends"),
      stripeSubscriptionId: subscriptionId,
      stripeCustomerId: session.customer as string | null,
      moduleStatus: "pending_activation",
      isFounder,
    });
  }

  console.log(`[Stripe Webhook] SMI checkout completed for user ${userId}, subscription: ${subscriptionId}`);
}

/**
 * Handle invoice paid - this is the activation trigger
 */
async function handleInvoicePaid(invoice: Stripe.Invoice) {
  // Access subscription from invoice - cast to any for Stripe API compatibility
  const invoiceAny = invoice as unknown as { subscription?: string | { id: string } | null };
  const subscriptionId = typeof invoiceAny.subscription === "string" 
    ? invoiceAny.subscription 
    : invoiceAny.subscription?.id || null;
  
  if (!subscriptionId) {
    console.log("[Stripe Webhook] Invoice paid but no subscription attached");
    return;
  }

  const db = await getDb();
  if (!db) {
    console.error("[Stripe Webhook] Database not available");
    return;
  }

  // Find intelligence_layers record by subscription ID
  const [record] = await db
    .select()
    .from(intelligenceLayers)
    .where(eq(intelligenceLayers.stripeSubscriptionId, subscriptionId));

  if (record) {
    // Activate the module
    await db
      .update(intelligenceLayers)
      .set({
        moduleStatus: "active",
        currentPeriodEnd: invoice.period_end 
          ? new Date(invoice.period_end * 1000) 
          : null,
        lastInvoiceStatus: "paid",
        updatedAt: new Date(),
      })
      .where(eq(intelligenceLayers.id, record.id));

    console.log(`[Stripe Webhook] SMI module activated for user ${record.userId}`);
    
    // TODO: Send activation email
    // TODO: Enable scheduled posting tasks
  }
}

/**
 * Handle invoice payment failed
 */
async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  // Access subscription from invoice - cast to any for Stripe API compatibility
  const invoiceAny = invoice as unknown as { subscription?: string | { id: string } | null };
  const subscriptionId = typeof invoiceAny.subscription === "string" 
    ? invoiceAny.subscription 
    : invoiceAny.subscription?.id || null;
  
  if (!subscriptionId) {
    return;
  }

  const db = await getDb();
  if (!db) {
    console.error("[Stripe Webhook] Database not available");
    return;
  }

  // Find intelligence_layers record by subscription ID
  const [record] = await db
    .select()
    .from(intelligenceLayers)
    .where(eq(intelligenceLayers.stripeSubscriptionId, subscriptionId));

  if (record) {
    await db
      .update(intelligenceLayers)
      .set({
        moduleStatus: "past_due",
        lastInvoiceStatus: "failed",
        updatedAt: new Date(),
      })
      .where(eq(intelligenceLayers.id, record.id));

    console.log(`[Stripe Webhook] SMI module marked past_due for user ${record.userId}`);
    
    // TODO: Send payment failed email
    // TODO: Pause posting tasks (keep drafts only)
  }
}

/**
 * Handle subscription created or updated
 */
async function handleSubscriptionUpsert(subscription: Stripe.Subscription) {
  if (subscription.metadata.module !== "social_media_intelligence") {
    return;
  }

  const db = await getDb();
  if (!db) {
    console.error("[Stripe Webhook] Database not available");
    return;
  }

  const userId = subscription.metadata.user_id;
  const cadence = subscription.metadata.cadence as Cadence;
  
  let layers: LayerKey[] = [];
  try {
    layers = JSON.parse(subscription.metadata.layers || "[]");
  } catch {
    layers = [];
  }

  // Find and update the record
  const [record] = await db
    .select()
    .from(intelligenceLayers)
    .where(eq(intelligenceLayers.stripeSubscriptionId, subscription.id));

  if (record) {
    await db
      .update(intelligenceLayers)
      .set({
        cadence,
        sportsEnabled: layers.includes("sports"),
        communityEnabled: layers.includes("community"),
        trendsEnabled: layers.includes("trends"),
        moduleStatus: subscription.status === "active" ? "active" : 
                      subscription.status === "past_due" ? "past_due" : 
                      record.moduleStatus,
        currentPeriodEnd: (subscription as unknown as { current_period_end?: number }).current_period_end 
          ? new Date((subscription as unknown as { current_period_end: number }).current_period_end * 1000)
          : null,
        updatedAt: new Date(),
      })
      .where(eq(intelligenceLayers.id, record.id));

    console.log(`[Stripe Webhook] SMI subscription updated for user ${userId}`);
  }
}

/**
 * Handle subscription deleted (canceled)
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  if (subscription.metadata.module !== "social_media_intelligence") {
    return;
  }

  const db = await getDb();
  if (!db) {
    console.error("[Stripe Webhook] Database not available");
    return;
  }

  // Find and update the record
  const [record] = await db
    .select()
    .from(intelligenceLayers)
    .where(eq(intelligenceLayers.stripeSubscriptionId, subscription.id));

  if (record) {
    await db
      .update(intelligenceLayers)
      .set({
        moduleStatus: "canceled",
        updatedAt: new Date(),
      })
      .where(eq(intelligenceLayers.id, record.id));

    console.log(`[Stripe Webhook] SMI module canceled for user ${record.userId}`);
    
    // TODO: Send cancellation email
    // TODO: Disable posting tasks
    // TODO: Keep historical posts read-only
  }
}

/**
 * Handle legacy checkout completed (for website setup fees)
 */
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const intakeId = session.metadata?.intake_id;
  const paymentType = session.metadata?.payment_type;
  
  if (!intakeId) {
    console.error("[Stripe Webhook] Missing intake_id in session metadata");
    return;
  }

  const db = await getDb();
  if (!db) {
    console.error("[Stripe Webhook] Database not available");
    return;
  }
  
  const intakeIdNum = parseInt(intakeId, 10);

  // Create payment record
  await db.insert(payments).values({
    intakeId: intakeIdNum,
    stripePaymentIntentId: session.payment_intent as string,
    stripeCustomerId: session.customer as string | undefined,
    paymentType: paymentType === "monthly" ? "monthly" : "setup",
    amountCents: session.amount_total || 0,
    status: "succeeded",
    paidAt: new Date(),
  });

  // Update intake status to paid
  await db
    .update(intakes)
    .set({
      status: "paid",
      stripeCustomerId: session.customer as string | undefined,
      stripePaymentIntentId: session.payment_intent as string,
      paidAt: new Date(),
    })
    .where(eq(intakes.id, intakeIdNum));

  // Fetch the updated intake
  const [intake] = await db
    .select()
    .from(intakes)
    .where(eq(intakes.id, intakeIdNum));

  if (intake) {
    console.log(`[Stripe Webhook] Intake ${intakeId} marked as paid`);
    
    // Send payment confirmation email
    const firstName = intake.contactName?.split(" ")[0] || "there";
    await sendEmail(intakeIdNum, "launch_confirmation", {
      firstName,
      businessName: intake.businessName,
      email: intake.email,
    });
  }
}
