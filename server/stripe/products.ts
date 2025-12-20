/**
 * LaunchBase Stripe Products Configuration
 * 
 * Founding Client Beta Pricing:
 * - $499 one-time setup fee
 * - $79/month ongoing (future subscription)
 * 
 * Business Modules:
 * - Google Ads Lead Engine: $499 setup
 * - QuickBooks Integration: $499 setup + $39/month
 */

export const PRODUCTS = {
  // One-time setup fee
  SETUP_FEE: {
    name: "LaunchBase Setup Fee",
    description: "Professional website build & deployment for your service business",
    priceInCents: 49900, // $499.00
    currency: "usd",
  },
  
  // Monthly subscription (for future use)
  MONTHLY_SUBSCRIPTION: {
    name: "LaunchBase Monthly",
    description: "Hosting, updates & support for your LaunchBase website",
    priceInCents: 7900, // $79.00
    currency: "usd",
    interval: "month" as const,
  },
} as const;

// Business Module Products
export const MODULE_PRODUCTS = {
  google_ads: {
    name: "Lead Engine (Google Ads)",
    description: "Google Ads setup with conversion tracking, starter campaign, and budget guardrails",
    setupPriceInCents: 49900, // $499.00
    monthlyPriceInCents: 0,
    currency: "usd",
  },
  quickbooks: {
    name: "QuickBooks Integration",
    description: "QuickBooks connection with invoice sync and payment tracking",
    setupPriceInCents: 49900, // $499.00
    monthlyPriceInCents: 3900, // $39.00
    currency: "usd",
  },
} as const;

export type ProductKey = keyof typeof PRODUCTS;
export type ModuleKey = keyof typeof MODULE_PRODUCTS;
