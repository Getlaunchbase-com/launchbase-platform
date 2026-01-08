/**
 * LaunchBase Stripe Products Configuration
 * 
 * LOCKED PRICING MODEL (Jan 8, 2026):
 * 
 * Core Website:
 * - $499 setup + $49/month (required, non-toggleable)
 * 
 * Social Media Intelligence:
 * - $299 setup (flat, all tiers)
 * - Monthly: $79 (4 posts), $129 (8 posts), $179 (12 posts)
 * - Bundle discount: 50% off setup when 2+ services selected
 * 
 * Enrichment Layer:
 * - $199 setup + $79/month (optional, premium)
 * 
 * Google Business:
 * - $149 setup + $29/month
 * 
 * QuickBooks Sync:
 * - $199 setup + $39/month
 * 
 * Founder Promo:
 * - Overrides setup fees only (not monthly)
 */

export const PRODUCTS = {
  // One-time setup fee for core website
  SETUP_FEE: {
    name: "LaunchBase Setup Fee",
    description: "Professional website build & deployment for your service business",
    priceInCents: 49900, // $499.00
    currency: "usd",
  },
  
  // Monthly subscription for hosting
  MONTHLY_SUBSCRIPTION: {
    name: "LaunchBase Monthly",
    description: "Hosting, updates & support for your LaunchBase website",
    priceInCents: 7900, // $79.00
    currency: "usd",
    interval: "month" as const,
  },
} as const;

// Social Media Intelligence - Posting Tiers (Locked Pricing)
export const SOCIAL_MEDIA_TIERS = {
  "4posts": {
    id: "social_media_4posts",
    name: "Social Media Intelligence — 4 posts/month",
    description: "Context-aware posting that adapts to your business, location, and timing.",
    priceInCents: 7900, // $79.00
    currency: "usd",
    interval: "month" as const,
    postsPerMonth: 4,
  },
  "8posts": {
    id: "social_media_8posts",
    name: "Social Media Intelligence — 8 posts/month",
    description: "Context-aware posting that adapts to your business, location, and timing.",
    priceInCents: 12900, // $129.00
    currency: "usd",
    interval: "month" as const,
    postsPerMonth: 8,
  },
  "12posts": {
    id: "social_media_12posts",
    name: "Social Media Intelligence — 12 posts/month",
    description: "Context-aware posting that adapts to your business, location, and timing.",
    priceInCents: 17900, // $179.00
    currency: "usd",
    interval: "month" as const,
    postsPerMonth: 12,
  },
} as const;

// Social Media Intelligence - Setup Fee (Flat for all tiers)
export const SOCIAL_MEDIA_SETUP = {
  name: "Social Media Intelligence Setup",
  description: "Account connection, safety rules, brand voice, and approval workflow.",
  priceInCents: 29900, // $299.00
  currency: "usd",
} as const;

// Enrichment Layer (Premium Add-on)
export const ENRICHMENT_LAYER = {
  name: "Intelligent Enrichment Layer",
  description: "Adds contextual decision-making. This is premium. Treated as such.",
  setupPriceInCents: 19900, // $199.00
  monthlyPriceInCents: 7900, // $79.00
  currency: "usd",
  interval: "month" as const,
} as const;

// Business Module Products
export const MODULE_PRODUCTS = {
  google_business: {
    name: "Google Business Setup",
    description: "Profile setup and ongoing visibility monitoring",
    setupPriceInCents: 14900, // $149.00
    monthlyPriceInCents: 2900, // $29.00
    currency: "usd",
  },
  quickbooks: {
    name: "QuickBooks Sync",
    description: "Accounting visibility and error monitoring",
    setupPriceInCents: 19900, // $199.00
    monthlyPriceInCents: 3900, // $39.00
    currency: "usd",
  },
} as const;

// Type exports
export type ProductKey = keyof typeof PRODUCTS;
export type ModuleKey = keyof typeof MODULE_PRODUCTS;
export type SocialMediaTier = keyof typeof SOCIAL_MEDIA_TIERS | "none";

// Service selection interface
export interface ServiceSelection {
  socialMediaTier?: SocialMediaTier;
  enrichmentLayer: boolean;
  googleBusiness: boolean;
  quickBooksSync: boolean;
}

// Calculate total setup fees with bundle discount logic
export function calculateSetupTotal(
  services: ServiceSelection,
  isFounder: boolean = false
): number {
  if (isFounder) {
    // Founder promo: $300 total setup (overrides all setup fees)
    return 30000; // $300.00
  }

  let total = PRODUCTS.SETUP_FEE.priceInCents; // Core website: $499
  let serviceCount = 1; // Core website counts as 1

  // Social Media setup
  if (services.socialMediaTier && services.socialMediaTier !== "none" as any) {
    total += SOCIAL_MEDIA_SETUP.priceInCents; // $299
    serviceCount++;
  }

  // Enrichment Layer setup
  if (services.enrichmentLayer) {
    total += ENRICHMENT_LAYER.setupPriceInCents; // $199
    serviceCount++;
  }

  // Google Business setup
  if (services.googleBusiness) {
    total += MODULE_PRODUCTS.google_business.setupPriceInCents; // $149
    serviceCount++;
  }

  // QuickBooks setup
  if (services.quickBooksSync) {
    total += MODULE_PRODUCTS.quickbooks.setupPriceInCents; // $199
    serviceCount++;
  }

  // Bundle discount: 50% off Social Media setup when 2+ services selected
  if (serviceCount >= 3 && services.socialMediaTier && services.socialMediaTier !== "none" as any) {
    total -= SOCIAL_MEDIA_SETUP.priceInCents / 2; // -$149.50
  }

  return total;
}

// Calculate total monthly fees
export function calculateMonthlyTotal(services: ServiceSelection): number {
  let total = PRODUCTS.MONTHLY_SUBSCRIPTION.priceInCents; // Core website: $49

  // Social Media monthly
  if (services.socialMediaTier && services.socialMediaTier !== "none" as any) {
    total += SOCIAL_MEDIA_TIERS[services.socialMediaTier as keyof typeof SOCIAL_MEDIA_TIERS].priceInCents;
  }

  // Enrichment Layer monthly
  if (services.enrichmentLayer) {
    total += ENRICHMENT_LAYER.monthlyPriceInCents; // $79
  }

  // Google Business monthly
  if (services.googleBusiness) {
    total += MODULE_PRODUCTS.google_business.monthlyPriceInCents; // $29
  }

  // QuickBooks monthly
  if (services.quickBooksSync) {
    total += MODULE_PRODUCTS.quickbooks.monthlyPriceInCents; // $39
  }

  return total;
}
