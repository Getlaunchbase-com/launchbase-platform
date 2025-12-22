import Stripe from "stripe";

// Initialize Stripe with secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2025-12-15.clover",
});

// Types
export type Cadence = "low" | "medium" | "high";
export type LayerKey = "sports" | "community" | "trends";

// Price IDs from environment variables
// These should be created in Stripe Dashboard and stored in env
const PRICE = {
  cadence: {
    low: process.env.PRICE_CADENCE_LOW || "",
    medium: process.env.PRICE_CADENCE_MED || "",
    high: process.env.PRICE_CADENCE_HIGH || "",
  },
  layer: {
    sports: process.env.PRICE_LAYER_SPORTS || "",
    community: process.env.PRICE_LAYER_COMMUNITY || "",
    trends: process.env.PRICE_LAYER_TRENDS || "",
  },
  setupBase: process.env.PRICE_SETUP_BASE || "",
  setupLayer: process.env.PRICE_SETUP_LAYER || "",
};

// Fallback prices in cents (used when Price IDs not configured)
const FALLBACK_PRICES = {
  cadence: {
    low: 7900,
    medium: 12900,
    high: 19900,
  },
  layer: {
    sports: 2900,
    community: 3900,
    trends: 4900,
  },
  setupBase: 24900,
  setupLayer: 9900,
};

export interface CreateIntelligenceCheckoutParams {
  userId: string;
  customerEmail: string;
  customerName?: string;
  cadence: Cadence;
  layers: LayerKey[];
  founderEligible?: boolean;
  successUrl: string;
  cancelUrl: string;
}

/**
 * Create a Stripe Checkout Session for Social Media Intelligence
 * 
 * Creates:
 * 1. Subscription with cadence as base price
 * 2. Add-on subscriptions for each selected layer
 * 3. One-time setup fees (base + per-layer)
 */
export async function createIntelligenceCheckoutSession({
  userId,
  customerEmail,
  customerName,
  cadence,
  layers,
  founderEligible = false,
  successUrl,
  cancelUrl,
}: CreateIntelligenceCheckoutParams): Promise<{ url: string; sessionId: string }> {
  
  // Build line items
  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];

  // Check if we have Price IDs configured
  const hasPriceIds = PRICE.cadence[cadence] && PRICE.setupBase;

  if (hasPriceIds) {
    // Use pre-created Price IDs (production mode)
    lineItems.push({ price: PRICE.cadence[cadence], quantity: 1 });
    
    for (const layer of layers) {
      if (PRICE.layer[layer]) {
        lineItems.push({ price: PRICE.layer[layer], quantity: 1 });
      }
    }
    
    lineItems.push({ price: PRICE.setupBase, quantity: 1 });
    
    if (layers.length > 0 && PRICE.setupLayer) {
      lineItems.push({ price: PRICE.setupLayer, quantity: layers.length });
    }
  } else {
    // Use inline price_data (development/test mode)
    // Cadence subscription
    lineItems.push({
      price_data: {
        currency: "usd",
        product_data: {
          name: `Social Media Intelligence — ${cadence.charAt(0).toUpperCase() + cadence.slice(1)}`,
          metadata: {
            module: "social_media_intelligence",
            type: "cadence",
            cadence_level: cadence,
          },
        },
        unit_amount: FALLBACK_PRICES.cadence[cadence],
        recurring: { interval: "month" },
      },
      quantity: 1,
    });

    // Layer subscriptions
    const layerNames: Record<LayerKey, string> = {
      sports: "Sports & Events",
      community: "Community & Schools",
      trends: "Local Trends",
    };
    
    for (const layer of layers) {
      lineItems.push({
        price_data: {
          currency: "usd",
          product_data: {
            name: `Local Context — ${layerNames[layer]}`,
            metadata: {
              module: "social_media_intelligence",
              type: "layer",
              layer_key: layer,
            },
          },
          unit_amount: FALLBACK_PRICES.layer[layer],
          recurring: { interval: "month" },
        },
        quantity: 1,
      });
    }

    // Base setup fee (one-time)
    lineItems.push({
      price_data: {
        currency: "usd",
        product_data: {
          name: "LaunchBase — Social Media Intelligence Setup",
          metadata: {
            module: "social_media_intelligence",
            type: "setup",
          },
        },
        unit_amount: FALLBACK_PRICES.setupBase,
      },
      quantity: 1,
    });

    // Per-layer setup fees (one-time)
    if (layers.length > 0) {
      lineItems.push({
        price_data: {
          currency: "usd",
          product_data: {
            name: "LaunchBase — Local Context Layer Setup",
            metadata: {
              module: "social_media_intelligence",
              type: "setup",
            },
          },
          unit_amount: FALLBACK_PRICES.setupLayer,
        },
        quantity: layers.length,
      });
    }
  }

  // Optional founder discount
  const discounts: Stripe.Checkout.SessionCreateParams.Discount[] | undefined =
    founderEligible && process.env.COUPON_FOUNDER_12MO
      ? [{ coupon: process.env.COUPON_FOUNDER_12MO }]
      : undefined;

  // Create checkout session
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer_email: customerEmail,
    line_items: lineItems,
    success_url: successUrl,
    cancel_url: cancelUrl,
    allow_promotion_codes: !discounts, // Allow promo codes if no auto-discount
    discounts,
    
    // Metadata for reconciliation
    metadata: {
      module: "social_media_intelligence",
      user_id: userId,
      cadence,
      layers: JSON.stringify(layers),
      founder_eligible: founderEligible ? "true" : "false",
    },

    // Subscription metadata
    subscription_data: {
      metadata: {
        module: "social_media_intelligence",
        user_id: userId,
        cadence,
        layers: JSON.stringify(layers),
      },
    },

    // Invoice settings
    invoice_creation: { enabled: true },
    billing_address_collection: "auto",
  });

  if (!session.url) {
    throw new Error("Failed to create checkout session URL");
  }

  return {
    url: session.url,
    sessionId: session.id,
  };
}

/**
 * Get checkout session status
 */
export async function getCheckoutSessionStatus(sessionId: string) {
  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["subscription"],
  });

  return {
    status: session.status,
    paymentStatus: session.payment_status,
    customerId: session.customer as string | null,
    subscriptionId: typeof session.subscription === "string" 
      ? session.subscription 
      : session.subscription?.id || null,
    metadata: session.metadata,
  };
}

/**
 * Create a portal session for managing subscriptions
 */
export async function createCustomerPortalSession(
  customerId: string,
  returnUrl: string
): Promise<{ url: string }> {
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });

  return { url: session.url };
}

/**
 * Get customer's active Social Media Intelligence subscription
 */
export async function getIntelligenceSubscription(customerId: string) {
  const subscriptions = await stripe.subscriptions.list({
    customer: customerId,
    status: "active",
    limit: 10,
  });

  // Find the SMI subscription by metadata
  const smiSubscription = subscriptions.data.find(
    sub => sub.metadata.module === "social_media_intelligence"
  );

  if (!smiSubscription) {
    return null;
  }

  // Parse layers from metadata
  let layers: LayerKey[] = [];
  try {
    layers = JSON.parse(smiSubscription.metadata.layers || "[]");
  } catch {
    layers = [];
  }

  return {
    id: smiSubscription.id,
    status: smiSubscription.status,
    cadence: smiSubscription.metadata.cadence as Cadence,
    layers,
    isFounder: smiSubscription.metadata.founder_eligible === "true",
    currentPeriodEnd: new Date((smiSubscription as unknown as { current_period_end: number }).current_period_end * 1000),
    cancelAtPeriodEnd: smiSubscription.cancel_at_period_end,
  };
}

/**
 * Cancel subscription at period end
 */
export async function cancelIntelligenceSubscription(subscriptionId: string) {
  await stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: true,
  });
  return { success: true };
}

/**
 * Reactivate a canceled subscription
 */
export async function reactivateIntelligenceSubscription(subscriptionId: string) {
  await stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: false,
  });
  return { success: true };
}

export { stripe };


/**
 * Wrapper functions for router compatibility
 */

export interface CreateSMICheckoutParams {
  userId: string;
  cadence: Cadence;
  layers: LayerKey[];
  successUrl: string;
  cancelUrl: string;
}

/**
 * Create SMI checkout session (simplified wrapper for router)
 */
export async function createSMICheckoutSession({
  userId,
  cadence,
  layers,
  successUrl,
  cancelUrl,
}: CreateSMICheckoutParams): Promise<{ url: string }> {
  // For now, use a placeholder email - in production this would come from user record
  const result = await createIntelligenceCheckoutSession({
    userId,
    customerEmail: `user-${userId}@launchbase.app`, // Placeholder
    cadence,
    layers,
    founderEligible: true, // Enable founder pricing for early users
    successUrl,
    cancelUrl,
  });
  
  return { url: result.url };
}

/**
 * Get SMI subscription status by user ID
 */
export async function getSMISubscriptionStatus(userId: string) {
  const { getDb } = await import("../db");
  const { intelligenceLayers } = await import("../../drizzle/schema");
  const { eq } = await import("drizzle-orm");
  
  const db = await getDb();
  if (!db) {
    return { hasSubscription: false, status: null };
  }

  const [record] = await db
    .select()
    .from(intelligenceLayers)
    .where(eq(intelligenceLayers.userId, parseInt(userId, 10)))
    .limit(1);

  if (!record || !record.stripeSubscriptionId) {
    return { hasSubscription: false, status: null };
  }

  // Get subscription details from Stripe
  try {
    const subscription = await stripe.subscriptions.retrieve(record.stripeSubscriptionId);
    
    return {
      hasSubscription: true,
      status: subscription.status,
      cadence: record.cadence,
      layers: {
        sports: record.sportsEnabled,
        community: record.communityEnabled,
        trends: record.trendsEnabled,
      },
      currentPeriodEnd: record.currentPeriodEnd,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      moduleStatus: record.moduleStatus,
    };
  } catch {
    return { hasSubscription: false, status: null };
  }
}

/**
 * Cancel SMI subscription by user ID
 */
export async function cancelSMISubscription(userId: string) {
  const { getDb } = await import("../db");
  const { intelligenceLayers } = await import("../../drizzle/schema");
  const { eq } = await import("drizzle-orm");
  
  const db = await getDb();
  if (!db) {
    return { success: false, error: "Database not available" };
  }

  const [record] = await db
    .select()
    .from(intelligenceLayers)
    .where(eq(intelligenceLayers.userId, parseInt(userId, 10)))
    .limit(1);

  if (!record || !record.stripeSubscriptionId) {
    return { success: false, error: "No active subscription found" };
  }

  try {
    await cancelIntelligenceSubscription(record.stripeSubscriptionId);
    
    // Update local record
    await db
      .update(intelligenceLayers)
      .set({
        moduleStatus: "pending_cancellation",
        updatedAt: new Date(),
      })
      .where(eq(intelligenceLayers.id, record.id));

    return { success: true };
  } catch (error) {
    console.error("[SMI] Failed to cancel subscription:", error);
    return { success: false, error: "Failed to cancel subscription" };
  }
}
