/**
 * LaunchBase Stripe Products Configuration
 * 
 * Founding Client Beta Pricing:
 * - $499 one-time setup fee
 * - $79/month ongoing (future subscription)
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

export type ProductKey = keyof typeof PRODUCTS;
