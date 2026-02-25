/**
 * SMI (Social Media Intelligence) Checkout Module
 *
 * Creates subscription checkout sessions for the Social Media Intelligence module.
 * Manages subscription status and cancellation via Stripe.
 */

// ---------------------------------------------------------------------------
// createSMICheckoutSession
// ---------------------------------------------------------------------------

export async function createSMICheckoutSession(
  data: Record<string, unknown>,
): Promise<{ sessionId: string; url: string }> {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const email = (data.email as string) || "";
  const userId = data.userId as string | number;
  const successUrl = (data.successUrl as string) || process.env.PUBLIC_BASE_URL || "http://localhost:3000";
  const cancelUrl = (data.cancelUrl as string) || successUrl;
  const priceId = (data.priceId as string) || process.env.SMI_STRIPE_PRICE_ID || "";

  if (!stripeKey) {
    console.log("[stripe/smi] (dev) Would create SMI checkout session for:", email);
    const devId = `cs_smi_dev_${Date.now()}`;
    return {
      sessionId: devId,
      url: `${successUrl}?session_id=${devId}`,
    };
  }

  try {
    const stripe = (await import("stripe")).default;
    const client = new stripe(stripeKey);

    const sessionParams: any = {
      mode: "subscription" as const,
      customer_email: email,
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        userId: String(userId || ""),
        type: "smi_subscription",
      },
    };

    if (priceId) {
      sessionParams.line_items = [{ price: priceId, quantity: 1 }];
    } else {
      // Create ad-hoc price
      sessionParams.line_items = [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "LaunchBase Social Media Intelligence",
              description: "AI-powered weather-aware social media posting",
            },
            unit_amount: 4900, // $49/month
            recurring: { interval: "month" as const },
          },
          quantity: 1,
        },
      ];
    }

    const session = await client.checkout.sessions.create(sessionParams);

    return {
      sessionId: session.id,
      url: session.url || successUrl,
    };
  } catch (err) {
    console.error("[stripe/smi] createSMICheckoutSession error:", err);
    throw new Error(
      `SMI checkout failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

// ---------------------------------------------------------------------------
// getSMISubscriptionStatus
// ---------------------------------------------------------------------------

export async function getSMISubscriptionStatus(
  userId: string,
): Promise<{ active: boolean; currentPeriodEnd?: string }> {
  const stripeKey = process.env.STRIPE_SECRET_KEY;

  if (!stripeKey) {
    // Dev passthrough — no Stripe key, report inactive
    return {
      active: false,
      currentPeriodEnd: undefined,
    };
  }

  try {
    const stripe = (await import("stripe")).default;
    const client = new stripe(stripeKey);

    // Search for subscriptions with this user's metadata
    const subscriptions = await client.subscriptions.search({
      query: `metadata["userId"]:"${userId}" AND metadata["type"]:"smi_subscription"`,
      limit: 1,
    });

    if (subscriptions.data.length === 0) {
      return { active: false };
    }

    const sub = subscriptions.data[0];
    const isActive = sub.status === "active" || sub.status === "trialing";

    return {
      active: isActive,
      currentPeriodEnd: new Date((sub as any).current_period_end * 1000).toISOString(),
    };
  } catch (err) {
    console.error("[stripe/smi] getSMISubscriptionStatus error:", err);
    return { active: false };
  }
}

// ---------------------------------------------------------------------------
// cancelSMISubscription
// ---------------------------------------------------------------------------

export async function cancelSMISubscription(
  subscriptionId: string,
): Promise<{ success: boolean }> {
  const stripeKey = process.env.STRIPE_SECRET_KEY;

  if (!stripeKey) {
    console.log("[stripe/smi] (dev) Would cancel subscription:", subscriptionId);
    return { success: true };
  }

  try {
    const stripe = (await import("stripe")).default;
    const client = new stripe(stripeKey);

    // Cancel at period end (don't immediately revoke access)
    await client.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    });

    console.log(
      `[stripe/smi] Subscription ${subscriptionId} set to cancel at period end`,
    );
    return { success: true };
  } catch (err) {
    console.error("[stripe/smi] cancelSMISubscription error:", err);
    return { success: false };
  }
}
