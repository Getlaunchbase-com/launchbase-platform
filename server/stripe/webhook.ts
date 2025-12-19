import { Request, Response } from "express";
import Stripe from "stripe";
import { constructWebhookEvent } from "./checkout";
import { getDb } from "../db";
import { intakes, payments } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { sendEmail } from "../email";

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
        await handleCheckoutCompleted(session);
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
 * Handle successful checkout session
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
