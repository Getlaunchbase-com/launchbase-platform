/**
 * Stripe Checkout Module
 *
 * Creates Stripe Checkout sessions for setup payments and service subscriptions.
 * Uses the Stripe SDK when STRIPE_SECRET_KEY is set. Returns dev-mode
 * passthrough sessions when the key is absent so the intake flow completes.
 */

// ---------------------------------------------------------------------------
// createSetupCheckoutSession
// ---------------------------------------------------------------------------

export async function createSetupCheckoutSession(data: {
  intakeId: number;
  email?: string;
  customerEmail?: string;
  customerName?: string;
  amount?: number;
  successUrl?: string;
  cancelUrl?: string;
  origin?: string;
  modules?: string[];
}): Promise<{ sessionId: string; url: string }> {
  const stripeKey = process.env.STRIPE_SECRET_KEY;

  if (!stripeKey) {
    console.log(
      `[stripe] (dev) Would create setup checkout: intake #${data.intakeId}, $${((data.amount || 0) / 100).toFixed(2)}`,
    );
    const devId = `cs_dev_${Date.now()}_${data.intakeId}`;
    return {
      sessionId: devId,
      url: `${data.successUrl || data.origin || ""}?session_id=${devId}`,
    };
  }

  try {
    const stripe = (await import("stripe")).default;
    const client = new stripe(stripeKey);

    const session = await client.checkout.sessions.create({
      mode: "payment",
      customer_email: data.email,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "LaunchBase Setup Fee",
              description: `Website setup for intake #${data.intakeId}`,
            },
            unit_amount: data.amount,
          },
          quantity: 1,
        },
      ],
      success_url: data.successUrl,
      cancel_url: data.cancelUrl,
      metadata: {
        intakeId: String(data.intakeId),
        type: "setup",
      },
    });

    return {
      sessionId: session.id,
      url: session.url || data.successUrl || "",
    };
  } catch (err) {
    console.error("[stripe] createSetupCheckoutSession error:", err);
    throw new Error(
      `Stripe checkout failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

// ---------------------------------------------------------------------------
// getCheckoutSession
// ---------------------------------------------------------------------------

export async function getCheckoutSession(
  sessionId: string,
): Promise<{
  status: string;
  paymentStatus: string;
  payment_status: string;
  amountTotal: number;
  amount_total: number;
  customer_email?: string;
  metadata?: Record<string, string>;
} | null> {
  const stripeKey = process.env.STRIPE_SECRET_KEY;

  if (!stripeKey) {
    // Dev passthrough — return "paid" for dev-prefixed session IDs
    if (sessionId.startsWith("cs_dev_")) {
      return {
        status: "complete",
        paymentStatus: "paid",
        payment_status: "paid",
        amountTotal: 49900,
        amount_total: 49900,
        customer_email: undefined,
        metadata: {},
      };
    }
    return null;
  }

  try {
    const stripe = (await import("stripe")).default;
    const client = new stripe(stripeKey);

    const session = await client.checkout.sessions.retrieve(sessionId);

    return {
      status: session.status || "unknown",
      paymentStatus: session.payment_status,
      payment_status: session.payment_status,
      amountTotal: session.amount_total || 0,
      amount_total: session.amount_total || 0,
      customer_email: typeof session.customer_email === "string" ? session.customer_email : undefined,
      metadata: (session.metadata as Record<string, string>) || {},
    };
  } catch (err) {
    console.error("[stripe] getCheckoutSession error:", err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// createServiceCheckoutSession
// ---------------------------------------------------------------------------

export async function createServiceCheckoutSession(data: {
  intakeId?: number;
  userId?: number;
  moduleKey?: string;
  customerEmail?: string;
  customerName?: string;
  email?: string;
  amount?: number;
  successUrl?: string;
  cancelUrl?: string;
  origin?: string;
  tenant?: string;
  promoCode?: string;
  serviceSelections?: Record<string, unknown>;
  lineItems?: Array<{ name: string; amount: number; quantity?: number }>;
}): Promise<{ sessionId: string; url: string }> {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const email = data.customerEmail || data.email;

  if (!stripeKey) {
    console.log(
      `[stripe] (dev) Would create service checkout: ${data.moduleKey || "service"}, $${((data.amount || 0) / 100).toFixed(2)}`,
    );
    const devId = `cs_svc_dev_${Date.now()}_${data.moduleKey || "service"}`;
    return {
      sessionId: devId,
      url: `${data.successUrl || data.origin || ""}?session_id=${devId}`,
    };
  }

  try {
    const stripe = (await import("stripe")).default;
    const client = new stripe(stripeKey);

    // Build line items
    const lineItems = data.lineItems
      ? data.lineItems.map((item) => ({
          price_data: {
            currency: "usd",
            product_data: { name: item.name },
            unit_amount: item.amount,
          },
          quantity: item.quantity || 1,
        }))
      : [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: data.moduleKey
                  ? `LaunchBase: ${data.moduleKey.replace(/_/g, " ")}`
                  : "LaunchBase Service",
              },
              unit_amount: data.amount,
            },
            quantity: 1,
          },
        ];

    const session = await client.checkout.sessions.create({
      mode: "payment",
      customer_email: email,
      line_items: lineItems,
      success_url: data.successUrl,
      cancel_url: data.cancelUrl,
      metadata: {
        intakeId: data.intakeId ? String(data.intakeId) : "",
        userId: data.userId ? String(data.userId) : "",
        moduleKey: data.moduleKey || "",
        type: "service",
      },
    });

    return {
      sessionId: session.id,
      url: session.url || data.successUrl || "",
    };
  } catch (err) {
    console.error("[stripe] createServiceCheckoutSession error:", err);
    throw new Error(
      `Stripe checkout failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}
