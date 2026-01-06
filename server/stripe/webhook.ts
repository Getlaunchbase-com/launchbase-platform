import { Request, Response } from "express";
import Stripe from "stripe";
import { constructWebhookEvent } from "./checkout";
import { getDb } from "../db";
import { intakes, payments, intelligenceLayers, buildPlans, approvals, deployments } from "../../drizzle/schema";
import { eq, and, isNull } from "drizzle-orm";
import { sendEmail } from "../email";
import { notifyOwner } from "../_core/notification";
import { Cadence, LayerKey } from "./intelligenceCheckout";
import { logStripeWebhookReceived, finalizeStripeWebhookEvent } from "./webhookLogger";

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

  // Debug: verify raw body is arriving correctly
  console.log(
    "[Webhook body debug]",
    "isBuffer=", Buffer.isBuffer(req.body),
    "typeof=", typeof req.body,
    "content-type=", req.headers["content-type"],
    "first20=", Buffer.isBuffer(req.body) ? req.body.toString("utf8", 0, 20) : String(req.body).slice(0, 20)
  );

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

  // Log webhook receipt immediately (best-effort, never blocks processing)
  await logStripeWebhookReceived(event);

  let intakeId: number | null = null;
  let userId: number | null = null;
  let processingError: string | null = null;

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
    processingError = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: "Webhook handler failed" });
  } finally {
    // Always finalize webhook event status (best-effort)
    await finalizeStripeWebhookEvent(event.id, {
      ok: processingError === null,
      error: processingError,
      intakeId,
      userId,
    });
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

  // Atomic claim: only the first webhook run can set stripeSessionId
  // This prevents race conditions where duplicate webhooks could create duplicate payments
  const claim = await db
    .update(intakes)
    .set({
      stripeSessionId: session.id,
      status: "paid",
      stripeCustomerId: session.customer as string | undefined,
      stripePaymentIntentId: session.payment_intent as string,
      paidAt: new Date(),
    })
    .where(
      and(
        eq(intakes.id, intakeIdNum),
        isNull(intakes.stripeSessionId)
      )
    );

  // Check if we successfully claimed this session (affected rows > 0)
  const claimed =
    // @ts-expect-error drizzle driver variance
    (claim?.rowsAffected ?? claim?.[0]?.affectedRows ?? claim?.affectedRows ?? 0) > 0;

  if (!claimed) {
    console.log(`[Stripe Webhook] ✅ Duplicate checkout completion ignored (session ${session.id}, intake ${intakeId})`);
    return;
  }

  console.log(`[Stripe Webhook] ✅ Successfully claimed session ${session.id} for intake ${intakeId}`);

  // Now safe: only one webhook run reaches here
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

  // Fetch the updated intake
  const [intake] = await db
    .select()
    .from(intakes)
    .where(eq(intakes.id, intakeIdNum));

  if (intake) {
    console.log(`[Stripe Webhook] Intake ${intakeId} marked as paid`);
    
    const firstName = intake.contactName?.split(" ")[0] || "there";
    
    // Send "deployment started" email
    await sendEmail(intakeIdNum, "deployment_started", {
      firstName,
      businessName: intake.businessName,
      email: intake.email,
    });
    
    // Trigger deployment with safety gates
    await triggerDeploymentWithSafetyGates(intakeIdNum, intake, db);
  }
}

/**
 * Trigger deployment with safety gates
 * Only deploys if all prerequisites are met
 */
async function triggerDeploymentWithSafetyGates(
  intakeId: number, 
  intake: typeof intakes.$inferSelect,
  db: Awaited<ReturnType<typeof getDb>>
) {
  const safetyChecks: { check: string; passed: boolean; reason?: string }[] = [];
  
  // Safety gate 1: Intake exists (already passed since we have it)
  safetyChecks.push({ check: "intake_exists", passed: true });
  
  // Safety gate 2: Build plan exists
  const [buildPlan] = await db!
    .select()
    .from(buildPlans)
    .where(eq(buildPlans.intakeId, intakeId))
    .limit(1);
  safetyChecks.push({ 
    check: "build_plan_exists", 
    passed: !!buildPlan,
    reason: buildPlan ? undefined : "No build plan found for this intake"
  });
  
  // Safety gate 3: Preview token exists
  safetyChecks.push({ 
    check: "preview_token_exists", 
    passed: !!intake.previewToken,
    reason: intake.previewToken ? undefined : "No preview token found"
  });
  
  // Safety gate 4: Approval event exists
  const [approval] = await db!
    .select()
    .from(approvals)
    .where(eq(approvals.intakeId, intakeId))
    .limit(1);
  safetyChecks.push({ 
    check: "approval_exists", 
    passed: !!approval,
    reason: approval ? undefined : "Customer has not approved the build plan"
  });
  
  // Safety gate 5: Not already deployed/deploying
  const [existingDeployment] = await db!
    .select()
    .from(deployments)
    .where(eq(deployments.intakeId, intakeId))
    .limit(1);
  const notAlreadyDeployed = !existingDeployment || 
    (existingDeployment.status !== "running" && existingDeployment.status !== "success");
  safetyChecks.push({ 
    check: "not_already_deployed", 
    passed: notAlreadyDeployed,
    reason: notAlreadyDeployed ? undefined : "Deployment already in progress or completed"
  });
  
  // Check if all gates passed
  const allPassed = safetyChecks.every(c => c.passed);
  const failedChecks = safetyChecks.filter(c => !c.passed);
  
  if (!allPassed) {
    console.error(`[Stripe Webhook] Deployment safety gates failed for intake ${intakeId}:`, failedChecks);
    
    // Update intake status to needs_attention
    await db!
      .update(intakes)
      .set({
        status: "paid", // Keep as paid but add internal note
        internalNotes: `[AUTO] Deployment blocked - safety gates failed: ${failedChecks.map(c => c.reason).join(", ")}`,
        updatedAt: new Date(),
      })
      .where(eq(intakes.id, intakeId));
    
    // Notify admin
    await notifyOwner({
      title: `Deployment blocked for ${intake.businessName}`,
      content: `Safety gates failed:\n${failedChecks.map(c => `- ${c.check}: ${c.reason}`).join("\n")}`,
    });
    
    return;
  }
  
  // All gates passed - create deployment
  console.log(`[Stripe Webhook] All safety gates passed for intake ${intakeId}, creating deployment`);
  
  const [deployment] = await db!.insert(deployments).values({
    intakeId,
    buildPlanId: buildPlan!.id,
    status: "queued",
  }).$returningId();
  
  console.log(`[Stripe Webhook] Deployment ${deployment.id} queued for intake ${intakeId}`);
  
  // Note: Actual deployment execution would be handled by a separate worker/job
  // For now, we just queue it and admin can trigger manually or set up a cron job
}
