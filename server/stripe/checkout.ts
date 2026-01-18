import Stripe from "stripe";
import { PRODUCTS, MODULE_PRODUCTS, ModuleKey } from "./products";
import { computePricing, type PricingInput, type SocialTier } from "../../client/src/lib/computePricing";

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
  // Check if this intake has a promo reservation
  const { getRedemptionForIntake } = await import("../services/promoService");
  const redemption = await getRedemptionForIntake(intakeId);
  
  const isFounder = redemption?.status === "reserved" && new Date(redemption.expiresAt) > new Date();
  const setupFee = isFounder ? 30000 : PRODUCTS.SETUP_FEE.priceInCents;

  // Build line items starting with base setup fee
  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
    {
      price_data: {
        currency: PRODUCTS.SETUP_FEE.currency,
        product_data: {
          name: isFounder ? "LaunchBase Setup Fee (Founder)" : PRODUCTS.SETUP_FEE.name,
          description: isFounder ? "Beta Founders Program - $300 setup" : PRODUCTS.SETUP_FEE.description,
        },
        unit_amount: setupFee,
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

export interface CreateServiceCheckoutParams {
  intakeId: number;
  customerEmail: string;
  customerName: string;
  origin: string;
  tenant: string;
  promoCode?: string | null;
  serviceSelections: {
    website: boolean;
    emailService: boolean;
    socialMediaTier: SocialTier | null;
    enrichmentLayer: boolean;
    googleBusiness: boolean;
    quickBooksSync: boolean;
  };
}

/**
 * Create a Stripe Checkout Session for service selections (new onboarding flow)
 */
export async function createServiceCheckoutSession({
  intakeId,
  customerEmail,
  customerName,
  origin,
  tenant,
  promoCode,
  serviceSelections,
}: CreateServiceCheckoutParams): Promise<{ url: string; sessionId: string }> {
  // Check if this intake has a promo reservation
  const { getRedemptionForIntake } = await import("../services/promoService");
  const redemption = await getRedemptionForIntake(intakeId);
  
  const isFounderReserved = redemption?.status === "reserved" && new Date(redemption.expiresAt) > new Date();

  // Compute pricing using the locked pricing model
  const pricing = computePricing({
    ...serviceSelections,
    promoCode: promoCode ?? null,
    isFounderReserved,
  });

  // Build line items from pricing output
  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];

  // If founder promo, use single $300 line item
  if (isFounderReserved) {
    lineItems.push({
      price_data: {
        currency: "usd",
        product_data: {
          name: "LaunchBase Setup (Beta Founder)",
          description: "Beta Founders Program - All services setup",
        },
        unit_amount: 30000, // $300
      },
      quantity: 1,
    });
  } else {
    // Add each setup line item
    for (const item of pricing.setupLineItems) {
      lineItems.push({
        price_data: {
          currency: "usd",
          product_data: {
            name: item.label,
            description: `Setup fee for ${item.label}`,
          },
          unit_amount: item.amountCents,
        },
        quantity: 1,
      });
    }

    // Add bundle discount as negative line item if applicable
    if (pricing.setupDiscountCents > 0) {
      lineItems.push({
        price_data: {
          currency: "usd",
          product_data: {
            name: "Bundle Discount",
            description: "50% off Social Media setup when 2+ services selected",
          },
          unit_amount: -pricing.setupDiscountCents,
        },
        quantity: 1,
      });
    }
  }

  // Store pricing snapshot in intake for audit trail
  const { getDb } = await import("../db");
  const db = await getDb();
  if (db) {
    const { intakes } = await import("../../drizzle/schema");
    const { eq } = await import("drizzle-orm");
    
    const [intake] = await db.select().from(intakes).where(eq(intakes.id, intakeId));
    if (intake) {
      const rawPayload = (intake.rawPayload as Record<string, unknown>) || {};
      await db.update(intakes)
        .set({
          rawPayload: {
            ...rawPayload,
            pricingSnapshot: {
              timestamp: new Date().toISOString(),
              setupLineItems: pricing.setupLineItems,
              setupSubtotalCents: pricing.setupSubtotalCents,
              setupDiscountCents: pricing.setupDiscountCents,
              setupTotalCents: pricing.setupTotalCents,
              monthlyLineItems: pricing.monthlyLineItems,
              monthlyTotalCents: pricing.monthlyTotalCents,
              selectedServiceCount: pricing.selectedServiceCount,
              notes: pricing.notes,
              isFounder: isFounderReserved,
              promoCode: promoCode || null,
            },
          },
        })
        .where(eq(intakes.id, intakeId));
    }
  }

  // Create Stripe session with audit-grade metadata
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: customerEmail,
    client_reference_id: intakeId.toString(),
    allow_promotion_codes: false, // We handle promos internally
    line_items: lineItems,
    metadata: {
      // Core identifiers
      intake_id: intakeId.toString(),
      customer_email: customerEmail,
      customer_name: customerName,
      tenant,
      payment_type: "service_setup",
      
      // Pricing version for audit
      pricing_version: "v1_2026_01_08",
      
      // Promo tracking
      promo_code: promoCode || "",
      is_founder: isFounderReserved ? "true" : "false",
      
      // Service selections (flattened for easy webhook access)
      website: serviceSelections.website.toString(),
      email_service: serviceSelections.emailService.toString(),
      social_media_tier: serviceSelections.socialMediaTier || "none",
      enrichment_layer: serviceSelections.enrichmentLayer.toString(),
      google_business: serviceSelections.googleBusiness.toString(),
      quickbooks_sync: serviceSelections.quickBooksSync.toString(),
      
      // Pricing snapshot (stringified for audit)
      services_selected_json: JSON.stringify(serviceSelections),
      setup_total_cents: pricing.setupTotalCents.toString(),
      setup_discount_cents: pricing.setupDiscountCents.toString(),
      monthly_total_cents: pricing.monthlyTotalCents.toString(),
      selected_service_count: pricing.selectedServiceCount.toString(),
    },
    success_url: `${origin}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/onboarding?step=9&intake_id=${intakeId}`,
  });

  if (!session.url) {
    throw new Error("Failed to create checkout session URL");
  }

  return {
    url: session.url,
    sessionId: session.id,
  };
}

export { stripe };
