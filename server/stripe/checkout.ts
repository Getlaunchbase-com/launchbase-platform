import Stripe from "stripe";
import { PRODUCTS, MODULE_PRODUCTS, ModuleKey } from "./products";

// Initialize Stripe with secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2025-12-15.clover",
});

export interface CreateCheckoutParams {
  intakeId: number;
  customerEmail: string;
  customerName: string;
  origin: string;
  modules?: ModuleKey[];
}

/**
 * Create a Stripe Checkout Session for the setup fee + optional modules
 */
export async function createSetupCheckoutSession({
  intakeId,
  customerEmail,
  customerName,
  origin,
  modules = [],
}: CreateCheckoutParams): Promise<{ url: string; sessionId: string }> {
  // Build line items starting with base setup fee
  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
    {
      price_data: {
        currency: PRODUCTS.SETUP_FEE.currency,
        product_data: {
          name: PRODUCTS.SETUP_FEE.name,
          description: PRODUCTS.SETUP_FEE.description,
        },
        unit_amount: PRODUCTS.SETUP_FEE.priceInCents,
      },
      quantity: 1,
    },
  ];

  // Add selected modules
  for (const moduleKey of modules) {
    const moduleProduct = MODULE_PRODUCTS[moduleKey];
    if (moduleProduct) {
      lineItems.push({
        price_data: {
          currency: moduleProduct.currency,
          product_data: {
            name: moduleProduct.name,
            description: moduleProduct.description,
          },
          unit_amount: moduleProduct.setupPriceInCents,
        },
        quantity: 1,
      });
    }
  }

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: customerEmail,
    client_reference_id: intakeId.toString(),
    allow_promotion_codes: true,
    line_items: lineItems,
    metadata: {
      intake_id: intakeId.toString(),
      customer_email: customerEmail,
      customer_name: customerName,
      payment_type: "setup",
      modules: modules.join(","),
    },
    success_url: `${origin}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/payment/cancel?intake_id=${intakeId}`,
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
 * Retrieve a checkout session by ID
 */
export async function getCheckoutSession(sessionId: string) {
  return stripe.checkout.sessions.retrieve(sessionId);
}

/**
 * Verify webhook signature and construct event
 */
export function constructWebhookEvent(
  payload: Buffer,
  signature: string
): Stripe.Event {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";
  return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
}

export { stripe };
