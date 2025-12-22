/**
 * LaunchBase Stripe Products Configuration
 * 
 * Core Platform:
 * - $499 one-time setup fee (website build)
 * - $79/month ongoing hosting
 * 
 * Social Media Intelligence Module (Model A - Clean Add-on):
 * - Cadence tiers: Low $79, Medium $129, High $199
 * - Local Context layers: Sports $29, Community $39, Trends $49
 * - Setup: $249 base + $99 per layer
 * 
 * Business Modules:
 * - QuickBooks Integration: $249 setup + $79/month
 * - Google Business Assistant: Coming soon
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

// Social Media Intelligence - Cadence Tiers (Base Subscription)
export const CADENCE_PRODUCTS = {
  low: {
    id: "cadence_low",
    name: "Social Media Intelligence — Low",
    description: "Weather-aware, safety-gated social media posting. 1–2 posts per week. Approval before posting.",
    priceInCents: 7900, // $79.00
    currency: "usd",
    interval: "month" as const,
    metadata: {
      module: "social_media_intelligence",
      type: "cadence",
      cadence_level: "low",
      posts_per_week: "1-2",
      posts_included: "8",
      intelligence_checks: "30",
    },
  },
  medium: {
    id: "cadence_medium",
    name: "Social Media Intelligence — Medium",
    description: "Balanced visibility with local awareness. 2–3 posts per week. Recommended for most businesses.",
    priceInCents: 12900, // $129.00
    currency: "usd",
    interval: "month" as const,
    metadata: {
      module: "social_media_intelligence",
      type: "cadence",
      cadence_level: "medium",
      posts_per_week: "2-3",
      posts_included: "12",
      intelligence_checks: "60",
    },
  },
  high: {
    id: "cadence_high",
    name: "Social Media Intelligence — High",
    description: "Maximum visibility with advanced local context. 4–6 posts per week.",
    priceInCents: 19900, // $199.00
    currency: "usd",
    interval: "month" as const,
    metadata: {
      module: "social_media_intelligence",
      type: "cadence",
      cadence_level: "high",
      posts_per_week: "4-6",
      posts_included: "24",
      intelligence_checks: "120",
    },
  },
} as const;

// Social Media Intelligence - Local Context Layers (Add-on Subscriptions)
export const LAYER_PRODUCTS = {
  sports: {
    id: "layer_sports",
    name: "Local Context — Sports & Events",
    description: "References game days, major events, and attendance patterns.",
    priceInCents: 2900, // $29.00
    currency: "usd",
    interval: "month" as const,
    setupPriceInCents: 9900, // $99.00
    metadata: {
      module: "social_media_intelligence",
      type: "layer",
      layer_key: "sports",
      impact: "high",
    },
  },
  community: {
    id: "layer_community",
    name: "Local Context — Community & Schools",
    description: "School schedules, civic events, and community calendars.",
    priceInCents: 3900, // $39.00
    currency: "usd",
    interval: "month" as const,
    setupPriceInCents: 9900, // $99.00
    metadata: {
      module: "social_media_intelligence",
      type: "layer",
      layer_key: "community",
      impact: "medium",
    },
  },
  trends: {
    id: "layer_trends",
    name: "Local Context — Local Trends",
    description: "Geo-filtered trending topics and cultural moments.",
    priceInCents: 4900, // $49.00
    currency: "usd",
    interval: "month" as const,
    setupPriceInCents: 9900, // $99.00
    metadata: {
      module: "social_media_intelligence",
      type: "layer",
      layer_key: "trends",
      impact: "low",
    },
  },
} as const;

// Social Media Intelligence - Setup Fees
export const INTELLIGENCE_SETUP = {
  base: {
    id: "smi_setup_base",
    name: "LaunchBase — Social Media Intelligence Setup",
    description: "One-time setup for Social Media Intelligence module including weather awareness and approval workflow.",
    priceInCents: 24900, // $249.00
    currency: "usd",
    metadata: {
      module: "social_media_intelligence",
      type: "setup",
      setup_type: "base",
    },
  },
  perLayer: {
    id: "smi_setup_layer",
    name: "LaunchBase — Local Context Layer Setup",
    description: "One-time setup fee per Local Context layer.",
    priceInCents: 9900, // $99.00
    currency: "usd",
    metadata: {
      module: "social_media_intelligence",
      type: "setup",
      setup_type: "per_layer",
    },
  },
} as const;

// Business Module Products (Legacy + New)
export const MODULE_PRODUCTS = {
  google_ads: {
    name: "Lead Engine (Google Ads)",
    description: "Google Ads setup with conversion tracking, starter campaign, and budget guardrails",
    setupPriceInCents: 49900, // $499.00
    monthlyPriceInCents: 0,
    currency: "usd",
  },
  quickbooks: {
    name: "QuickBooks Sync",
    description: "Keep invoices, customers, and payments automatically in sync.",
    setupPriceInCents: 24900, // $249.00
    monthlyPriceInCents: 7900, // $79.00
    currency: "usd",
  },
  google_business: {
    name: "Google Business Assistant",
    description: "Responds to reviews, updates listings, and posts when visibility matters.",
    setupPriceInCents: 24900, // $249.00
    monthlyPriceInCents: 4900, // $49.00
    currency: "usd",
    comingSoon: true,
  },
} as const;

// Type exports
export type ProductKey = keyof typeof PRODUCTS;
export type ModuleKey = keyof typeof MODULE_PRODUCTS;
export type CadenceKey = keyof typeof CADENCE_PRODUCTS;
export type LayerKey = keyof typeof LAYER_PRODUCTS;

// Helper to calculate total monthly price for Social Media Intelligence
export function calculateSMIMonthlyPrice(
  cadence: CadenceKey,
  enabledLayers: LayerKey[]
): number {
  let total = CADENCE_PRODUCTS[cadence].priceInCents;
  for (const layer of enabledLayers) {
    total += LAYER_PRODUCTS[layer].priceInCents;
  }
  return total;
}

// Helper to calculate total setup fee for Social Media Intelligence
export function calculateSMISetupFee(enabledLayers: LayerKey[]): number {
  let total = INTELLIGENCE_SETUP.base.priceInCents;
  total += enabledLayers.length * INTELLIGENCE_SETUP.perLayer.priceInCents;
  return total;
}
